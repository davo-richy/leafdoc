import { callGemini } from "../lib/gemini.js";
import { rateLimit, errorReply } from "../lib/guard.js";

export const config = { maxDuration: 60 };

const MAX_IMAGES = 4;
const MAX_B64_CHARS = 2_000_000; // ~1.5MB per image after client-side resize

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  if (!rateLimit(req)) return res.status(429).json({ error: "rate_limited", message: "Too many scans from this connection. Please wait a few minutes and try again." });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "server_not_configured", message: "GEMINI_API_KEY is not set." });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const images = Array.isArray(body.images) ? body.images.slice(0, MAX_IMAGES) : [];
    if (!images.length) return res.status(400).json({ error: "no_image", message: "Please add at least one photo." });
    for (const img of images) {
      if (typeof img?.data !== "string" || img.data.length > MAX_B64_CHARS) {
        return res.status(413).json({ error: "image_too_large", message: "Photo is too large. Try a smaller one." });
      }
    }

    const clean = (s, n) => (typeof s === "string" ? s.slice(0, n) : "");
    const answers = Array.isArray(body.answers)
      ? body.answers.slice(0, 8).map((a) => ({ q: clean(a.q, 300), a: clean(a.a, 500) })).filter((a) => a.a)
      : [];

    const result = await callGemini({
      apiKey,
      model: process.env.GEMINI_MODEL,
      language: clean(body.language, 40) || "English",
      images: images.map((i) => ({ mime: clean(i.mime, 30) || "image/jpeg", data: i.data })),
      notes: clean(body.notes, 800),
      answers,
      weather: clean(body.weather, 400),
    });

    return res.status(200).json(result);
  } catch (err) {
    return errorReply(res, err);
  }
}
