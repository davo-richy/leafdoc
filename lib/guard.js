// Tiny in-memory per-IP rate limit. One bucket per route so a scan never uses up
// the follow-up question allowance. It resets on serverless cold starts, so it is a
// speed bump against loops and abuse, not a hard quota.
// Only status codes and upstream error reasons are logged; photos and notes never are.

const hits = new Map();
const MAX_KEYS = 5000;

function clientIp(req) {
  return String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").split(",")[0].trim() || "unknown";
}

function sweep(now, windowMs) {
  for (const [key, times] of hits) {
    const live = times.filter((t) => now - t < windowMs);
    if (live.length) hits.set(key, live);
    else hits.delete(key);
  }
}

export function rateLimit(req, { max = 10, windowMs = 10 * 60 * 1000, bucket = "default" } = {}) {
  const key = `${bucket}:${clientIp(req)}`;
  const now = Date.now();
  const recent = (hits.get(key) || []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  // Keep a burst of distinct IPs from growing the map without limit.
  if (hits.size > MAX_KEYS) sweep(now, windowMs);
  return true;
}

// Google reports most problems as HTTP 400 with a machine-readable reason, so the
// HTTP status alone is not enough to tell a bad key from a bad request.
function googleError(detail) {
  const reason = (detail.match(/"reason"\s*:\s*"([A-Z_]+)"/) || [])[1] || "";
  const message = (detail.match(/"message"\s*:\s*"([^"]*)"/) || [])[1] || "";
  return { reason, message };
}

export function errorReply(res, err) {
  const detail = String(err.detail || "");
  const { reason, message: upstream } = googleError(detail);
  // Deliberately logs no request body: no photos, notes or answers.
  console.error("api error:", err.status, err.message, JSON.stringify({ reason, upstream, tried: err.tried }).slice(0, 500));

  const reply = (code, payload) => res.status(code).json({ ...payload, detail: upstream.slice(0, 300) || undefined });

  if (reason === "API_KEY_INVALID" || reason === "API_KEY_EXPIRED" || /api key not valid|api key expired|api_key_invalid/i.test(detail)) {
    return reply(502, {
      error: "bad_key",
      message: "The AI service rejected the Gemini API key. The site owner needs to check GEMINI_API_KEY in Vercel and redeploy.",
    });
  }
  if (reason === "RESOURCE_EXHAUSTED" || err.status === 429) {
    return reply(429, {
      error: "rate_limited",
      message: "The AI quota for this app is used up right now. Please wait a few minutes and try again.",
    });
  }
  if (err.status === 404 || /no longer available|is not found for API version/i.test(detail)) {
    return reply(502, {
      error: "model_unavailable",
      message: "The AI model is not available for this API key. The site owner needs to update GEMINI_MODEL (try gemini-3.8-flash).",
    });
  }
  if (err.status === 403) {
    return reply(502, {
      error: "access_denied",
      message: "This API key is not allowed to use the Gemini API. The site owner needs to enable it in Google AI Studio.",
    });
  }
  if (/ran out of output tokens/i.test(err.message || "")) {
    return reply(502, {
      error: "truncated",
      message: "The AI answer was cut short. Please try again (fewer photos usually helps).",
    });
  }
  if (err.status === 400) {
    return reply(502, {
      error: "upstream_error",
      message: "The AI service rejected the request. Please try again with a smaller photo.",
    });
  }
  return reply(502, { error: "upstream_error", message: "Could not analyse that. Please try again." });
}
