# 🌿 LeafDoc

> Photograph a sick plant. Get the likely problem, what to do this week, and how to stop it coming back — in your own language, by text or voice.

**Live demo:** [leafdocc.vercel.app](https://leafdocc.vercel.app)
**Built for:** the STEM2Connect AI Hackathon, 11 October – 21 November 2026
**Demo walkthrough:** [docs/demo-script.md](docs/demo-script.md)

---

## The problem

Plant diseases destroy a large share of crops every year. Smallholder farmers and home growers often can't reach an agronomist, can't afford a lab test, and don't know what problem they are facing or what to do about it. By the time they find out, the crop may be lost. Many existing tools are English-only, need strong internet, and give one confident answer with no explanation.

## What LeafDoc does

LeafDoc turns photos of a plant into a plan a grower can act on:

- What the plant probably is, and whether it looks healthy
- The 2–3 most likely problems, each with a confidence level and the visible symptoms behind it
- A triage line — **Act today**, **This week** or **Monitor** — with the first three steps
- Household and organic options first, then chemical options (active ingredients, not just brand names), then prevention
- A "do not eat" warning when a chemical treatment is on the list
- Advice for the grower's region (Nigeria by default), using materials and product names common there
- Optional weather-aware timing from Open-Meteo
- All of it in one of 12 languages, readable aloud, with voice input for notes
- A shareable summary: WhatsApp message, saved image, or printout

It is honest about uncertainty. Below 60% confidence the result says so and asks follow-up questions instead of guessing.

## How a scan works

```
Photo(s) → client resize (and optional low-data re-encode)
        → POST /api/diagnose → server validates the photos
        → Gemini vision analysis (structured JSON)
        → triage + confidence check → follow-up questions if unsure
        → re-analysis with answers → weather note → text / voice / share
```

If the phone is offline, the scan is kept in an IndexedDB outbox and sent automatically when the connection returns.

## Features

- Camera capture or upload, up to 4 photos per scan (close-up, whole plant, leaf underside), resized on the device before upload
- Photo-quality check: asks for a better photo when an image is blurry, dark, too far away, or not a plant
- Structured diagnosis: plant, 2–3 candidate problems, confidence, observed symptoms, severity
- Follow-up questions below 60% confidence, then re-analysis with the answers
- Act today / This week / Monitor triage with concrete first steps and a food-safety line
- Household, chemical and prevention tabs; region selector with a fixed allowlist of countries
- 12 output languages with a custom language picker; voice input and read-aloud via the Web Speech API
- Follow-up chat about a result ("Can I still eat this?")
- Calendar reminders as an `.ics` file (day 1 treat, day 3 check, day 7 re-scan)
- Compare with the previous scan of the same plant; "My plants" groups scans by plant
- Offline: app shell cached by a service worker, up to 2 queued scans, auto-sent on reconnect
- Low-data mode: one tap re-encodes the same photos to roughly half the bytes
- Save the result as a 1080×1350 image, share to WhatsApp, or print a clean report
- Installable PWA, dark mode, onboarding, printable report — and no accounts at all
- Honest accuracy page (`accuracy.html`) that reports the measured number, or says it has not been measured yet

## Honesty and limits

- Confidence is the model's own estimate, calibrated by the prompt to stay below 90 from a photo alone. It is not a probability from a test set.
- LeafDoc gives guidance, not a laboratory diagnosis. Every result says so.
- There is no outbreak map. A signal like that needs a server-side store and real anonymisation; shipping it without those would put growers' locations at risk, so it was deliberately left out.
- Accuracy has not been measured yet (see below).

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | HTML, CSS, vanilla JavaScript (no framework, no third-party JS libraries) |
| Backend | Vercel serverless functions (Node.js) |
| AI | Google Gemini API (`gemini-3.8-flash`, vision, structured JSON output) |
| Weather | Open-Meteo API (no key needed) |
| Voice | Browser Web Speech API |
| Offline | Service worker, web manifest, IndexedDB outbox |
| Storage | Browser localStorage (scan history) and IndexedDB (queued scans) |
| Hosting | Vercel |

## Privacy and server behavior

- Photos are sent to the Gemini API for analysis and are not stored by LeafDoc. There is no photo bucket, no upload directory and no request-body logging anywhere in the server code.
- The server validates every photo before it reaches Gemini: base64 encoding, 1.5 MB per image, 3 MB total (base64 overhead keeps the request under Vercel's 4.5 MB body limit), and the real file type from magic bytes (JPEG, PNG or WebP). The client's claimed MIME type is ignored.
- Rate limits are per IP and per route — 10 diagnoses and 20 follow-up questions per 10 minutes. They are held in memory for the life of a serverless instance, so they slow loops and abuse down rather than acting as a hard quota.
- `GEMINI_API_KEY` is read only from `process.env` inside `api/*.js` and `lib/*.js`. It is never sent to the browser, never inlined into a build, and never logged.
- Scan history stays in the browser. Location is requested only when the grower turns on weather advice, and only a short weather summary is sent with the request.

## Run it locally

```bash
git clone https://github.com/davo-richy/leafdoc.git
cd leafdoc
cp .env.example .env      # then set GEMINI_API_KEY
npx vercel dev
```

All site files live at the repository root (`index.html`, `style.css`, `app.js`, `api/`), so Vercel serves them with no Root Directory setting. Get a free key from Google AI Studio.

## Deploy

1. Push the repo to GitHub.
2. Import it in Vercel and leave **Root Directory** empty — the project root is the site root.
3. Add `GEMINI_API_KEY` under Project Settings → Environment Variables for **Production** and **Preview**, then redeploy. Environment variables only apply to builds created after they are added.
4. Optional: set `GEMINI_MODEL` to pin a different model. The app tries `gemini-3.8-flash`, `gemini-3.6-flash`, `gemini-3.5-flash-lite`, then `gemini-flash-latest`.

## Accuracy

**Not yet measured.** No labelled test set has been run, so the project publishes no accuracy figure — not in this README, and not on `accuracy.html`, which says "Not yet measured" and explains the method instead.

To measure it, put 30–50 PlantVillage images in `test/images/`, named like `Tomato___Late_blight__01.jpg`, then run:

```bash
GEMINI_API_KEY=your_key node test/run-eval.mjs
```

The script overwrites `test/accuracy-results.md` with a per-image table and the final percentage; the accuracy page reads its wording from that result.

## What changed during testing

- The first prompt gave one confident answer. It now returns 2–3 ranked candidates with the symptoms each one explains, and is allowed to say it is unsure.
- Confidence below 60% used to still show a treatment plan. It now asks 2–4 short questions first and re-analyses with the answers.
- Region was free text in an earlier draft. It is now a fixed allowlist in `api/diagnose.js`, because the value goes into the prompt.
- Model names move: retired aliases return 404 for new keys, so the code pins a current model and falls back through a short list.
- Sending four full-size phone photos was slow on mobile data. Photos are resized in the browser, and low-data mode re-encodes them at about half the size.
- A failed scan used to be lost. It is now queued in IndexedDB (max 2) and sent when the connection returns.

## Credits

- Google Gemini API — diagnosis and multilingual advice
- Open-Meteo — weather data (free, non-commercial use, attribution to open-meteo.com)
- PlantVillage dataset — accuracy testing only
- Web Speech API — browser-native speech recognition and synthesis
- Claude (Anthropic) — AI coding assistant used to build the app from a written plan; the plan, feature decisions and testing were directed by hand
- No third-party JavaScript libraries are used.

## Future plans

- Run the PlantVillage evaluation and publish a real accuracy number
- Local-expert verification and extension-officer connections
- Anonymous outbreak map, once there is a privacy-preserving server-side design
- Offline on-device model for zero-internet use
- More crops and regional treatment databases

## Disclaimer

LeafDoc provides AI-generated guidance, not a laboratory diagnosis. For serious or spreading problems, consult a local agricultural extension officer or plant pathologist.

## Team

Built and maintained by [davo-richy](https://github.com/davo-richy).
