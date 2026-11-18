// Draws the shareable PNG of a result with the Canvas API. No libraries, no network.

const W = 1080;
const H = 1350;
const PAD = 72;
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif';

const C = {
  bg: "#f7f7f4",
  ink: "#1a1a17",
  muted: "#56564f",
  line: "#dbdbd2",
  accent: "#2f5d3a",
  amber: "#8a5a00",
  amberBg: "#fdf6e6",
  red: "#982a16",
};

function wrap(ctx, text, maxWidth) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const test = line ? line + " " + word : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawWrapped(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
  const all = wrap(ctx, text, maxWidth);
  const lines = all.slice(0, maxLines);
  lines.forEach((line, i) => {
    const clipped = i === maxLines - 1 && all.length > maxLines;
    ctx.fillText(clipped ? line.replace(/\s+\S*$/, "") + "…" : line, x, y + i * lineHeight);
  });
  return y + lines.length * lineHeight;
}

export function cardFileName(result) {
  const slug = String(result?.plant || "plant").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `leafdoc-${slug || "plant"}.png`;
}

export async function buildCard({ result, triage, meta, date }) {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");

  ctx.direction = meta && meta.rtl ? "rtl" : "ltr";
  ctx.textAlign = "start";
  ctx.textBaseline = "top";

  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);

  let y = PAD;
  ctx.fillStyle = C.accent;
  ctx.font = `600 34px ${FONT}`;
  ctx.fillText("LeafDoc", PAD, y);

  ctx.textAlign = "end";
  ctx.fillStyle = C.muted;
  ctx.font = `400 26px ${FONT}`;
  ctx.fillText(date || "", W - PAD, y + 6);
  ctx.textAlign = "start";

  y += 62;
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(PAD, y);
  ctx.lineTo(W - PAD, y);
  ctx.stroke();
  y += 40;

  ctx.fillStyle = C.ink;
  ctx.font = `600 64px ${FONT}`;
  y = drawWrapped(ctx, result.plant || "Plant", PAD, y, W - PAD * 2, 76, 2);
  y += 24;

  const levelColor = triage.level === "today" ? C.red : triage.level === "week" ? C.amber : C.accent;
  ctx.fillStyle = levelColor;
  ctx.font = `600 40px ${FONT}`;
  ctx.fillText(triage.title, PAD, y);
  y += 58;

  ctx.fillStyle = C.ink;
  ctx.font = `400 34px ${FONT}`;
  y = drawWrapped(ctx, result.summary || "", PAD, y, W - PAD * 2, 48, 5);
  y += 48;

  ctx.fillStyle = C.muted;
  ctx.font = `600 24px ${FONT}`;
  ctx.fillText("WHAT TO DO", PAD, y);
  y += 44;

  triage.steps.slice(0, 3).forEach((step) => {
    ctx.fillStyle = levelColor;
    ctx.font = `600 32px ${FONT}`;
    ctx.fillText("•", PAD, y);
    ctx.fillStyle = C.ink;
    ctx.font = `400 32px ${FONT}`;
    y = drawWrapped(ctx, step, PAD + 34, y, W - PAD * 2 - 34, 44, 3) + 18;
  });

  if (triage.eat) {
    y += 18;
    ctx.font = `600 28px ${FONT}`;
    const lines = wrap(ctx, triage.eat, W - PAD * 2 - 48);
    const boxH = lines.length * 40 + 40;
    ctx.fillStyle = C.amberBg;
    ctx.fillRect(PAD, y, W - PAD * 2, boxH);
    ctx.fillStyle = C.amber;
    lines.forEach((line, i) => ctx.fillText(line, PAD + 24, y + 20 + i * 40));
    y += boxH;
  }

  ctx.fillStyle = C.muted;
  ctx.font = `400 28px ${FONT}`;
  ctx.fillText(`Confidence ${Math.round(triage.confidence)}%`, PAD, H - 158);

  ctx.strokeStyle = C.line;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(PAD, H - 110);
  ctx.lineTo(W - PAD, H - 110);
  ctx.stroke();

  ctx.fillStyle = C.muted;
  ctx.font = `400 24px ${FONT}`;
  ctx.fillText("AI guidance, not a lab test · leafdocc.vercel.app", PAD, H - 88);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Could not render the image");
  return blob;
}
