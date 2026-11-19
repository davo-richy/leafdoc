import { callGemini } from "../lib/gemini.js";
import { rateLimit, errorReply } from "../lib/guard.js";
import { validateImages } from "../lib/images.js";

export const config = { maxDuration: 60 };

// Fixed list: the region is dropped into the prompt, so it must not be free text.
const REGIONS = ["Nigeria", "Ghana", "Kenya", "Uganda", "Tanzania", "South Africa", "India", "Brazil", "United States", "United Kingdom", "Other"];

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  if (!rateLimit(req, { max: 10, bucket: "diagnose" })) {
    res.setHeader("Retry-After", "600");
    return res.status(429).json({ error: "rate_limited", message: "Too many scans from this connection. Please wait a few minutes and try again." });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "server_not_configured", message: "GEMINI_API_KEY is not set." });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};

    // Validates encoding, size and the real file type; never logs the photo.
    const images = validateImages(body.images);
    if (!images.ok) return res.status(images.status).json({ error: images.error, message: images.message });

    const clean = (s, n) => (typeof s === "string" ? s.slice(0, n) : "");
    const answers = Array.isArray(body.answers)
      ? body.answers.slice(0, 8).map((a) => ({ q: clean(a.q, 300), a: clean(a.a, 500) })).filter((a) => a.a)
      : [];

    const result = await callGemini({
      apiKey,
      model: process.env.GEMINI_MODEL,
      language: clean(body.language, 40) || "English",
      region: REGIONS.includes(body.region) ? body.region : "",
      images: images.images,
      notes: clean(body.notes, 800),
      answers,
      weather: clean(body.weather, 400),
    });

    return res.status(200).json(result);
  } catch (err) {
    return errorReply(res, err);
  }
}
