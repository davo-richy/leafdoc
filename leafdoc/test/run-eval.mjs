// Accuracy test on labeled PlantVillage images.
// Usage:
//   1. Put 30-50 images in test/images/. Name them with the true label first, e.g.
//        Tomato___Late_blight__01.jpg   Apple___healthy__02.jpg
//      (PlantVillage folder names look like Crop___Disease; the part before "__NN" is the label.)
//   2. GEMINI_API_KEY=... node test/run-eval.mjs
// Writes test/accuracy-results.md. A prediction counts as correct when the model's top problem
// (or "healthy") loosely matches the disease part of the label; review the table by hand too.
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { callGemini } from "../lib/gemini.js";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "images");
const out = path.join(path.dirname(fileURLToPath(import.meta.url)), "accuracy-results.md");
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) { console.error("Set GEMINI_API_KEY first."); process.exit(1); }

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const STOP = new Set(["leaf", "of", "the", "and", "disease", "spot", "virus"]);
const tokens = (s) => norm(s).split(" ").filter((w) => w.length > 2 && !STOP.has(w));

function isCorrect(label, r) {
  const [crop, ...rest] = label.split("___");
  const truth = rest.join(" ").replace(/_/g, " ");
  const healthy = /healthy/i.test(truth);
  if (healthy) return !!r.healthy || /healthy|no disease/i.test(r.problems?.[0]?.name || "");
  if (r.healthy) return false;
  const top = [r.problems?.[0]?.name, r.problems?.[1]?.name].filter(Boolean).join(" ");
  const tt = tokens(truth), pt = new Set(tokens(top));
  return tt.length > 0 && tt.some((w) => pt.has(w));
}

const files = (await readdir(dir)).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort();
if (!files.length) { console.error(`No images found in ${dir}`); process.exit(1); }

const rows = []; let correct = 0, counted = 0;
for (const f of files) {
  const label = f.replace(/__\d+\.[a-z]+$/i, "").replace(/\.[a-z]+$/i, "");
  const mime = /png$/i.test(f) ? "image/png" : /webp$/i.test(f) ? "image/webp" : "image/jpeg";
  const data = (await readFile(path.join(dir, f))).toString("base64");
  try {
    const r = await callGemini({ apiKey, model: process.env.GEMINI_MODEL, language: "English", images: [{ mime, data }] });
    const pred = r.healthy ? "healthy" : r.problems?.[0]?.name || "unknown";
    const ok = isCorrect(label, r);
    counted++; if (ok) correct++;
    rows.push(`| ${f} | ${label.replace(/_/g, " ")} | ${pred} (${r.overall_confidence}%) | ${ok ? "✅" : "❌"} | ${r.needs_more_info ? "asked follow-ups" : ""} |`);
    console.log(ok ? "OK " : "BAD", f, "→", pred);
  } catch (e) {
    rows.push(`| ${f} | ${label} | error ${e.status || ""} | – | not counted |`);
    console.log("ERR", f, e.message);
  }
  await new Promise((r) => setTimeout(r, 4500)); // stay under free-tier rate limits
}

const acc = counted ? ((correct / counted) * 100).toFixed(1) : "n/a";
const md = `# Accuracy results

Images tested: ${counted} · Correct: ${correct} · **Accuracy: ${acc}%**

Automatic matching is loose (keyword overlap). Review each row and correct by hand before publishing.

| Image | True label | App prediction | Correct? | Notes |
|---|---|---|---|---|
${rows.join("\n")}

## Where it fails / what we changed
_Fill in after reviewing the table._
`;
await writeFile(out, md);
console.log(`\nAccuracy: ${acc}% (${correct}/${counted}). Wrote ${out}`);
