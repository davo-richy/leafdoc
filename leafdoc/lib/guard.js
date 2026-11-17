// Tiny in-memory per-IP rate limit. It resets on serverless cold starts, so it is a speed bump, not a wall.
const hits = new Map();

export function rateLimit(req, { max = 10, windowMs = 10 * 60 * 1000 } = {}) {
  const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").split(",")[0].trim();
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < windowMs);
  if (recent.length >= max) { hits.set(ip, recent); return false; }
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return true;
}

export function errorReply(res, err) {
  console.error("api error:", err.status, err.message, err.detail?.slice?.(0, 300));
  if (err.status === 429) return res.status(429).json({ error: "rate_limited", message: "The AI is busy right now. Please wait a minute and try again." });
  if (err.status === 404) return res.status(502).json({ error: "model_unavailable", message: "The AI model is not available right now. The site owner needs to update the model name." });
  if (err.status === 401 || err.status === 403) return res.status(502).json({ error: "bad_key", message: "The AI service rejected the server's API key. The site owner needs to check it." });
  return res.status(502).json({ error: "upstream_error", message: "Could not analyse that. Please try again." });
}
