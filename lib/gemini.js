// Shared Gemini logic, used by the Vercel function (api/diagnose.js) and the eval script.
// The API key is only ever read from process.env on the server.

// Google now serves older models only to projects that already used them, and its "latest"
// aliases get hot-swapped, so pin a current stable model and keep fallbacks to try in order.
// Override the first choice with GEMINI_MODEL (check Google AI Studio for current names).
export const DEFAULT_MODEL = "gemini-3.8-flash";
export const MODEL_CANDIDATES = ["gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.5-flash-lite", "gemini-flash-latest"];

const STR = { type: "STRING" };
const strArr = { type: "ARRAY", items: STR };

export const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    photo_ok: { type: "BOOLEAN" },
    photo_issue: STR,
    is_plant: { type: "BOOLEAN" },
    plant: STR,
    healthy: { type: "BOOLEAN" },
    summary: STR,
    overall_confidence: { type: "INTEGER" },
    needs_more_info: { type: "BOOLEAN" },
    follow_up_questions: strArr,
    problems: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: STR,
          type: STR,
          confidence: { type: "INTEGER" },
          severity: STR,
          symptoms_observed: strArr,
          explanation: STR,
        },
        required: ["name", "confidence", "symptoms_observed"],
      },
    },
    treatment: {
      type: "OBJECT",
      properties: { organic: strArr, chemical: strArr, prevention: strArr },
    },
    weather_advice: STR,
    urgent_note: STR,
  },
  required: ["photo_ok", "is_plant", "healthy", "overall_confidence", "needs_more_info", "problems"],
};

export function buildSystemPrompt(language) {
  return `You are LeafDoc, an expert plant pathologist and agronomist helping smallholder farmers and home growers.
You examine photos of plants and give careful, honest, practical guidance.

RULES
1. Write EVERY human-readable string in this language: ${language}. Keep JSON keys in English. Keep severity as one of "low", "moderate", "high". Keep problem "type" as one of "fungal", "bacterial", "viral", "pest", "nutrient", "environmental", "other".
2. Photo quality check first. If the image is blurry, too dark, too far away, or not a plant, set photo_ok=false (or is_plant=false), explain in photo_issue what to retake, and return an empty problems array.
3. Give 2-3 candidate problems (fewer only if the plant looks healthy), ordered by confidence. Confidence is an integer 0-100 and should be calibrated: never claim above 90 from a photo alone. For each, list ONLY symptoms you can actually see (symptoms_observed) and briefly explain why it fits.
4. If you are not sure (overall_confidence below 65, or candidates are close), set needs_more_info=true and ask 2-4 short, specific follow_up_questions a farmer can answer easily (old or new leaves? soil wet or dry? how long? spreading? any insects seen?). Saying "I'm not sure" is allowed and better than guessing.
5. If follow-up answers or notes are provided, use them to refine the diagnosis and lower needs_more_info when the evidence supports it.
6. Treatment: give practical organic options and chemical options (name active ingredients, not only brands, and mention to follow the product label), plus prevention tips. Prefer low-cost, locally available actions. If the plant looks healthy, say so and give care tips.
7. If weather data is provided, put concrete timing advice in weather_advice (e.g. delay spraying before rain, avoid watering in the evening in humid conditions). Otherwise leave weather_advice empty.
8. If the problem looks severe or may spread (e.g. quarantine-type diseases), put a short urgent_note advising a local agricultural extension officer.
9. summary: 1-2 plain sentences a farmer would understand. Avoid jargon.
10. This is guidance, not a lab test. Never invent details that are not visible.`;
}

export function buildUserParts({ images = [], notes = "", answers = [], weather = "", language = "English" }) {
  const parts = [];
  images.forEach((img, i) => {
    parts.push({ text: `Photo ${i + 1} of ${images.length}:` });
    parts.push({ inline_data: { mime_type: img.mime || "image/jpeg", data: img.data } });
  });
  let text = `Diagnose this plant. Respond in ${language}.`;
  if (notes) text += `\n\nGrower's notes: ${notes}`;
  if (answers.length) {
    text += "\n\nAnswers to earlier follow-up questions:\n" + answers.map((a) => `- Q: ${a.q}\n  A: ${a.a}`).join("\n");
  }
  if (weather) text += `\n\nLocal weather: ${weather}`;
  parts.push({ text });
  return parts;
}

function parseModelJson(text) {
  const cleaned = text.replace(/^\s*```(?:json)?/i, "").replace(/```\s*$/i, "").trim();
  return JSON.parse(cleaned);
}

function normalise(r) {
  const clamp = (n) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));
  r.problems = Array.isArray(r.problems) ? r.problems : [];
  r.problems = r.problems.filter((p) => p && p.name).map((p) => ({ ...p, confidence: clamp(p.confidence), symptoms_observed: Array.isArray(p.symptoms_observed) ? p.symptoms_observed : [] }));
  r.overall_confidence = clamp(r.overall_confidence);
  if (!Array.isArray(r.follow_up_questions)) r.follow_up_questions = [];
  return r;
}

async function request({ apiKey, model, body }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = new Error(`Gemini error ${res.status}`);
    err.status = res.status;
    err.detail = await res.text().catch(() => "");
    throw err;
  }
  const json = await res.json();
  const candidate = json?.candidates?.[0];
  const text = candidate?.content?.parts?.map((p) => (p.thought ? "" : p.text || "")).join("") || "";
  if (!text) {
    const e = new Error(candidate?.finishReason === "MAX_TOKENS" ? "Model ran out of output tokens" : "Empty response from model");
    e.status = 502;
    e.detail = `finishReason=${candidate?.finishReason || "unknown"} blockReason=${json?.promptFeedback?.blockReason || "none"}`;
    throw e;
  }
  return text;
}

const MODEL_PROBLEM = /no longer available|not supported|not found|does not exist|unsupported model|is not found for API version/i;

// Another model can only help when this model is missing/retired or busy.
function shouldTryNextModel(err) {
  if (err.status === 404) return true;
  if (err.status === 400) return MODEL_PROBLEM.test(err.detail || "");
  return err.status === 429 || err.status === 503;
}

// Tries the configured model, then each known-good model; retries a busy upstream once.
async function generate({ apiKey, model, body }) {
  const queue = [model, ...MODEL_CANDIDATES].filter((m) => typeof m === "string" && m.trim()).map((m) => m.trim());
  const models = [...new Set(queue)];
  const tried = [];
  let lastErr;
  for (const name of models) {
    tried.push(name);
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await request({ apiKey, model: name, body });
      } catch (err) {
        lastErr = err;
        if (attempt === 0 && (err.status === 503 || err.status === 500)) {
          await new Promise((r) => setTimeout(r, 1200));
          continue;
        }
        break;
      }
    }
    if (!shouldTryNextModel(lastErr)) break;
  }
  if (lastErr) lastErr.tried = tried;
  throw lastErr;
}

export async function callGemini({ apiKey, model, language, ...input }) {
  const generationConfig = {
    temperature: 0.3,
    maxOutputTokens: 8192,
    responseMimeType: "application/json",
    responseSchema: RESPONSE_SCHEMA,
  };
  let body = {
    system_instruction: { parts: [{ text: buildSystemPrompt(language || "English") }] },
    contents: [{ role: "user", parts: buildUserParts({ ...input, language: language || "English" }) }],
    generationConfig,
  };
  let lastErr;
  let schemaRejected = false;
  for (let attempt = 0; attempt < 3; attempt++) {
    let text;
    try {
      text = await generate({ apiKey, model, body });
    } catch (err) {
      // Some models reject the structured-output schema; ask for plain JSON instead of failing.
      if (!schemaRejected && err.status === 400 && /schema|response_mime_type|response_mime/i.test(err.detail || "")) {
        schemaRejected = true;
        const { responseSchema, ...rest } = generationConfig;
        body = { ...body, generationConfig: rest };
        continue;
      }
      throw err;
    }
    try {
      return normalise(parseModelJson(text));
    } catch (e) {
      lastErr = e;
    }
  }
  const e = new Error("Model returned invalid JSON: " + lastErr?.message);
  e.status = 502;
  throw e;
}

// Short follow-up Q&A about an existing diagnosis (no images needed).
export async function askFollowUp({ apiKey, model, language, question, diagnosis }) {
  const system = `You are LeafDoc, a careful plant-health assistant for farmers and home growers.
Answer the grower's follow-up question about their plant in ${language}, in at most 4 short sentences, plain words, no jargon.
Base it on the diagnosis JSON provided. If you are unsure, say so. For food-safety questions, be cautious and mention checking with a local agricultural extension officer when pesticides were used.
End with a reminder that this is guidance, not a lab test.`;
  const body = {
    system_instruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: `Diagnosis: ${JSON.stringify(diagnosis).slice(0, 6000)}\n\nQuestion: ${question}` }] }],
    generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
  };
  return (await generate({ apiKey, model, body })).trim();
}
