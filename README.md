# 🌿 LeafDoc

> Snap a photo of a sick plant. Get a diagnosis, treatment steps and weather-aware advice in your own language, by text or voice.

**Built for the STEM2Connect AI Hackathon** · Created between Oct 11 and Nov 21, 2026
**Live demo:** [ADD YOUR VERCEL LINK] · **Demo video:** [ADD YOUTUBE/VIMEO LINK] · **Track:** [ADD YOUR TRACK]

---

## The problem

Plant diseases destroy a large share of crops every year. Smallholder farmers and home growers often can't reach an agronomist, can't afford a lab test, and don't know what problem they are facing or what to do about it. By the time they find out, the crop may be lost. Many existing tools are English-only, need strong internet, and give one confident answer with no explanation.

## The solution

LeafDoc lets anyone photograph a plant and get:

- What the plant probably is
- The 2-3 most likely problems, each with a confidence level and the visible symptoms behind it
- Organic and chemical treatment options, plus prevention tips
- Advice that accounts for local weather (optional)
- Everything in the user's own language, readable aloud

It works for any plant and is honest about what it doesn't know: low confidence triggers follow-up questions instead of a confident guess.

## How it works

```
Photo(s) → photo-quality check → Gemini vision analysis
        → follow-up questions (if unsure) → re-analysis
        → structured result → weather-aware advice → text / voice
```

## Features

- Camera capture or upload, up to 4 photos per scan (close-up, whole plant, leaf underside), resized on the device before upload
- Photo-quality check: asks for a better photo if the image is blurry, dark, or not a plant
- Structured diagnosis: plant, 2-3 candidate problems, confidence, observed symptoms, severity
- Follow-up questions when confidence is low, then re-analysis with the answers
- Organic, chemical and prevention advice
- 12 selectable output languages
- Voice input (speak your symptoms) and voice output (read the result aloud) using the browser's Web Speech API
- Follow-up chat on the result ("Can I still eat this?")
- Downloadable calendar reminders (day 1 treat, day 3 check, day 7 re-scan)
- Re-scan a past plant and see a before/after comparison
- Optional weather-aware advice using Open-Meteo (location is only requested if the user opts in)
- Installable PWA with an offline app shell and saved past scans
- Scan history stored only on the user's device
- Printable report, dark mode, onboarding screen
- Clear disclaimer on every result: guidance, not a lab test

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | HTML, CSS, vanilla JavaScript (no framework) |
| Backend | Vercel serverless function (Node.js) |
| AI | Google Gemini API (`gemini-flash-latest`, vision, structured JSON output) |
| Weather | Open-Meteo API (no key needed) |
| Voice | Browser Web Speech API |
| Offline | Service worker + web manifest |
| Storage | Browser localStorage (history stays on the device) |
| Hosting | Vercel |

The serverless function validates and rate-limits requests. The Gemini API key lives only in a Vercel environment variable and is used only inside the serverless function. It is never in frontend code.

## How the idea and the code were made (AI disclosure)

- **I planned the idea myself:** the problem, who it is for, the feature list, the user flow, the decision to be honest about uncertainty, the demo plan, and which features to skip.
- **AI wrote the code:** I used an AI coding assistant, **Claude (Anthropic)**, to build the app from my plan: the frontend, the serverless function and the Gemini prompt. I reviewed the result, ran it, and directed the fixes. [EDIT: add anything you changed by hand, tested, or debugged yourself.]
- **AI inside the product:** **Google Gemini** analyses the photos, reasons over follow-up answers, and writes advice in the chosen language.

## Accuracy

[FILL IN after you run the test. Do not publish numbers you haven't measured.]

I tested LeafDoc on [N] labeled images from the public PlantVillage dataset. Final accuracy: **[X]%**. It most often confused: [list]. What I changed because of it: [list].

Full results: [`test/accuracy-results.md`](test/accuracy-results.md)

## Run it locally

```bash
git clone [YOUR-REPO-URL]
cd leafdoc
cp .env.example .env      # then set GEMINI_API_KEY
npx vercel dev
```

All site files live at the repository root (`index.html`, `style.css`, `app.js`, `api/`), so Vercel serves them with no Root Directory setting.

Open the local URL on a phone or desktop and upload a plant photo. Get a free key from Google AI Studio.

## Deploy

1. Push the repo to GitHub.
2. Import it in Vercel and leave **Root Directory** empty (the project root *is* the site root).
3. Add `GEMINI_API_KEY` under Project Settings → Environment Variables, then redeploy.

## Credits and licenses

- Google Gemini API: diagnosis and multilingual advice
- Open-Meteo: weather data (free, non-commercial use, attribution to open-meteo.com)
- PlantVillage dataset: accuracy testing only
- Web Speech API: browser-native speech recognition and synthesis
- Claude (Anthropic): AI coding assistant
- No third-party JavaScript libraries are used.

## What I learned

[FILL IN in your own words. Ideas: how prompt structure changed the results, what failed in testing, what was new to you (serverless functions, PWA, voice APIs), what you would do differently with more time.]

## Future plans

- Local-expert verification and extension-officer connections
- Anonymous outbreak map from scans
- Offline on-device model for zero-internet use
- More crops and regional treatment databases

## Privacy

Photos are sent to Google Gemini for analysis and are not stored on our server. Scan history is saved only in the user's own browser. Location is requested only if the user turns on weather advice, and only a weather summary is used.

## Disclaimer

LeafDoc provides AI-generated guidance, not a laboratory diagnosis. For serious or spreading problems, consult a local agricultural extension officer or plant pathologist.

## Team

- [YOUR NAME]
