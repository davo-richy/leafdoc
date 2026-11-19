// Server-side checks for uploaded photos.
// The browser already resizes images, but a request can be made by hand, so the API
// checks the base64 payload itself instead of trusting the client's MIME type.
// Nothing here writes a photo to disk or to a log.

export const MAX_IMAGES = 4;
export const MAX_BYTES_PER_IMAGE = 1_500_000; // ~1.5 MB decoded
// Kept below Vercel's 4.5 MB request-body limit once base64 adds ~33% overhead.
export const MAX_BYTES_TOTAL = 3_000_000;

const fail = (status, error, message) => ({ ok: false, status, error, message });

// Accept only what Gemini's vision endpoint reliably reads.
function sniff(buf) {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf.length > 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return "";
}

// Tolerate a full data URL, then the bare base64 the app sends.
function stripDataUrl(value) {
  if (typeof value !== "string") return "";
  const comma = value.indexOf(",");
  return value.startsWith("data:") && comma !== -1 ? value.slice(comma + 1) : value;
}

export function validateImages(input) {
  const list = Array.isArray(input) ? input.slice(0, MAX_IMAGES) : [];
  if (!list.length) return fail(400, "no_image", "Please add at least one photo.");

  const images = [];
  let total = 0;

  for (const raw of list) {
    const data = stripDataUrl(raw?.data);
    if (!data) return fail(400, "bad_image", "One of the photos could not be read. Try taking it again.");
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(data) || data.length % 4 === 1) {
      return fail(400, "bad_image", "One of the photos could not be read. Try taking it again.");
    }

    const padding = data.endsWith("==") ? 2 : data.endsWith("=") ? 1 : 0;
    const bytes = Math.floor((data.length * 3) / 4) - padding;
    if (bytes < 1024) return fail(400, "bad_image", "One of the photos is empty. Try taking it again.");
    if (bytes > MAX_BYTES_PER_IMAGE) {
      return fail(413, "image_too_large", "That photo is too large. Try a smaller one.");
    }
    total += bytes;
    if (total > MAX_BYTES_TOTAL) {
      return fail(413, "images_too_large", "Those photos are too large together. Try fewer or smaller photos.");
    }

    // The detected type wins over whatever the request claimed.
    const mime = sniff(Buffer.from(data, "base64"));
    if (!mime) return fail(415, "unsupported_image", "Please send a JPEG, PNG or WebP photo.");

    images.push({ mime, data });
  }

  return { ok: true, images };
}
