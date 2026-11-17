import { askFollowUp } from "../lib/gemini.js";
import { rateLimit, errorReply } from "../lib/guard.js";

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }
  if (!rateLimit(req, { max: 20 })) return res.status(429).json({ error: "rate_limited", message: "Too many questions. Please wait a few minutes." });
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "server_not_configured", message: "GEMINI_API_KEY is not set." });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const question = typeof body.question === "string" ? body.question.trim().slice(0, 300) : "";
    if (!question || !body.diagnosis || typeof body.diagnosis !== "object") {
      return res.status(400).json({ error: "bad_request", message: "Please type a question." });
    }
    const language = typeof body.language === "string" ? body.language.slice(0, 40) : "English";
    const answer = await askFollowUp({ apiKey, model: process.env.GEMINI_MODEL, language, question, diagnosis: body.diagnosis });
    return res.status(200).json({ answer });
  } catch (err) {
    return errorReply(res, err);
  }
}
