# LeafDoc demo script

A four-minute walkthrough for the STEM2Connect AI Hackathon. Times are a guide, not a rule.

## Before you start (10 minutes before)

- [ ] Open https://leafdocc.vercel.app on the phone you will demo with, and install it to the home screen once so the icon is already there.
- [ ] Run one full scan on that phone. This warms the serverless function, proves the key works, and leaves a scan in "Past scans" so the history beat has content.
- [ ] Save two photos to the camera roll: one clearly diseased leaf (spots, blight, mildew) and one healthy plant. Do not rely on finding a plant at demo time.
- [ ] Set the phone to Do Not Disturb, brightness high, and a 10-minute screen timeout.
- [ ] Have the laptop open on the same result page as a backup, in case the venue Wi-Fi dies.
- [ ] Know your one sentence: *"LeafDoc turns one photo into a treatment plan a farmer can act on today, in their own language."*

## 0:00–0:30 — The problem

> "A farmer sees spots on a leaf. They don't know if it's fungus, a pest, or a nutrient problem. The extension officer is two hours away, the lab test costs more than the crop, and most apps answer in English with one confident guess."

Show the home screen. Point at the headline and the three steps.

## 0:30–1:20 — A real scan

1. Tap **Take photo** (or **Upload**), choose the diseased-leaf photo.
2. Add a second photo if you have one: the whole plant.
3. Type one line of notes: *"Yellow spots on older leaves, spreading for a week."*
4. Point out the **Region** selector — leave it on **Nigeria**.
5. Tap **Diagnose**. While it loads:

> "It checks the photo quality first, then asks Gemini for ranked causes with the symptoms it can actually see — not one guess."

## 1:20–2:20 — Reading the result

Work top to bottom, narrating only what is on screen:

- **Confidence bar**: "It shows how sure it is. Under 60% it stops and asks me questions instead of pretending."
- **Triage card**: "Act today, this week, or monitor — plus the first three things to do."
- **Treatment tabs**: "Household and organic first: remove leaves, improve airflow, soap or neem. Chemicals second, with active ingredients, not brand names."
- **Eat warning**: if it appears, read it. "It tells me not to eat this if a chemical is on the list."
- **Listen**: tap it, let one sentence play, stop it. "Every result can be read aloud, and the interface is in 12 languages."
- **Ask a follow-up**: type *"Can I still eat this?"* and send. "The chat answers about this specific plant."

## 2:20–3:00 — The parts that make it usable

- Tap **Add reminders to my calendar** → the `.ics` file downloads. "Day 1 treat, day 3 check, day 7 re-scan."
- Tap **Save as image** → open the saved card. "This is what a farmer sends to a neighbour on WhatsApp."
- Open **Past scans** → **My plants**. "Scans stay on the phone, grouped by plant, so you can compare this week with last week."
- Toggle **Low-data mode**, mention it re-encodes the same photo to about half the bytes.
- Turn on airplane mode, start a scan, show the queued notice, turn airplane mode off, show it send. *Skip this if the venue network is unreliable — it needs a real connection to finish.*

## 3:00–3:30 — Honesty

Open **How accurate is LeafDoc?** from the footer.

> "It says 'Not yet measured'. I would rather ship that than invent a number. The method and the command to reproduce it are on the page, and the result screen always shows confidence plus a 'not a lab test' disclaimer."

## 3:30–4:00 — Close

> "One photo, one plan, in your language, on the phone you already have — and it keeps working when the signal drops. Next step is running the labelled evaluation and connecting local extension officers."

## If something breaks

| Problem | What to do |
|---|---|
| Scan spins for more than 25 seconds | The app times out with a specific message. Say "it fails loudly instead of hanging", tap **Try again**. |
| "GEMINI_API_KEY is not set" | Switch to the laptop backup already showing a result. Do not debug live. |
| No network at all | Show the offline queue and the cached app shell, then the laptop result. |
| Wrong diagnosis on the demo photo | Use it: "This is why it gives 2–3 candidates and a confidence number, and why it asks follow-up questions." |

## Do not

- Do not claim a measured accuracy figure.
- Do not promise an outbreak map — it is not built, on purpose.
- Do not read the disclaimer word for word; point at it and summarise.
