# Devpost submission draft: Rounds

> Draft for review. Nothing has been submitted. Before submitting, replace the placeholders `<YouTube URL>`, `<GitHub URL>` and `<demo URL>`.

**Tagline (≤ 200 chars):** Offline inspection rounds with hybrid AI. Cloud Gemini compiles the manual, on-device Gemini Nano helps in the field, and approved rules, not AI, decide what is safe.

## Inspiration

Building and plant maintenance runs on inspection rounds: walk the plant room, read the gauges, write a note, hand over to the next shift. Those rooms are often basements with no signal. Notes are short and inconsistent. A slow drift ("a bit warmer than yesterday") gets lost between shifts. In Japan, where I live, building maintenance is an ageing workforce that increasingly depends on newcomers working in a second language.

AI could help here, but only if it works offline and never gets the final say on safety. That combination is what Firebase AI Logic's hybrid inference makes possible.

## What it does

- **Supervisor:**
  - Uploads an equipment manual. Cloud Gemini, called through Firebase AI Logic, *compiles* it into a small procedure pack: steps, the measurement for each, limits, safety items and escalation rules.
  - Every limit and rule must carry a verbatim quote from the manual. The app checks those quotes in code and flags any sentence the AI reworded.
  - Approves or excludes each item. Nothing is published until every item is handled.
- **Technician:**
  - Downloads the approved pack and runs the round fully offline.
  - Readings are parsed and checked against the approved limits **by rules, with no AI**, and each result shows the manual's sentence. An alarm shows the escalation rule the supervisor approved.
  - **On the device**, Gemini Nano in Chrome, called through the same Firebase AI Logic SDK, checks free-text notes against the step, answers questions *only* from the approved pack, and drafts the shift handover.
- **Escalation:**
  - When the local result is invalid, the question goes beyond the pack, or the technician asks, a cloud review is offered.
  - The cloud gets context the device calls don't carry: the verbatim manual section and this check's history across shifts.
  - The technician sees and can edit the exact text that will be sent.
  - Offline, the request waits in a queue and runs when the connection returns.
- **Repeat deviations:** when a check is out of limits again after an earlier shift's deviation, a rule-based banner shows the manual's escalation rule for repeated deviations.
- **Next shift:** gets a handover whose facts table is built from the recorded data. Open issues carry over, and a cloud trend analysis spots problems that repeat across shifts.
- **Hybrid ledger:** every AI result carries its real source (On-device or Cloud) from `response.inferenceSource`, and every call is logged.

## How I built it

- **Firebase AI Logic (Web SDK 13.3)** with the Gemini Developer API.
  - `PREFER_ON_DEVICE` for device tasks. On a device with no local model, the SDK's cloud fallback is used only after the user opts in, because it would otherwise send notes to the cloud without asking.
  - `ONLY_IN_CLOUD` for compiling the manual, reviews and trends.
- **One JSON Schema per task**, shared by three consumers: the on-device `responseConstraint`, the cloud `responseJsonSchema`, and Ajv validation.
- **Step cards.** A pack is split into per-step cards, capped at 900 tokens (150–210 in the demo), so each on-device call carries one step instead of the whole manual. Measured with Chrome's own token counter and Firebase AI Logic in `ONLY_ON_DEVICE` mode: a note check costs 338 tokens with a step card vs 4,744 with the full 18 KB manual, took 34–49 s vs 109–140 s on my laptop, and caught the out-of-limit reading in 3 of 3 runs vs 0 of 3.
- **Deterministic domain layer** (TypeScript, 30 tests):
  - unit-aware measurement parser
  - threshold checks
  - quote verification
  - publish lock
  - output guards that reject invented numbers and drop numeric AI claims
  - handover guards (no invented numbers, no reassuring wording next to an alarm) and action repair
- **Cloud Firestore** with offline persistence. Security rules (16 emulator tests) enforce:
  - draft → approved → retired, with approved packs immutable
  - only the assigned technician writes readings
  - consent before escalation, with a payload that can't be altered
  - no re-queuing of finished escalations
  - an append-only ledger
- **App Check (enforced)** on AI Logic and Firestore, **Anonymous Auth**, and **Remote Config** for model choice and an escalation kill switch.
- **React + Vite PWA**, glove-friendly: 56 px targets, a numeric keypad, light and dark themes.

## Challenges I ran into

- **Small models make confident mistakes.** In testing, the on-device model claimed a vibration of 5.2 mm/s was "≥ 7.1 mm/s". The fix was a rule: numbers are judged only by the rule engine, and AI concerns containing numbers are removed and shown as removed.
- **The cloud compiler paraphrases.** One run turned a sentence about an alarm into "Do not touch the housing if temperature is high". The quote it cited didn't say that. The paraphrase check now flags this for the supervisor.
- **Offline writes.** Firestore's web write promises only resolve on server acknowledgement, so every write is fire-and-forget and the UI reads from the local cache.
- **On-device latency.** My Intel MacBook Pro takes 10–80 s per on-device call. The app keeps the readings and rules instant and treats AI as an optional assistant, never a step the technician has to wait for.

## Accomplishments I'm proud of

- A real offline round:
  - readings checked offline
  - a note checked by Gemini Nano with `navigator.onLine === false`
  - a consented cloud review queued, then sent automatically after reconnecting
  - a handover drafted on-device
- Safety is enforced in three places: deterministic code, a human approval gate, and server-side security rules. It doesn't rely on prompts.
- App Check enforcement was verified: a direct call without a valid token gets HTTP 401.

## What I learned

The interesting hybrid pattern isn't "on-device, else cloud". It's **the cloud model preparing work for the small model and for the code**: once per manual revision, prose becomes typed limits the rule engine can enforce, each tied to a verified quote, plus small step cards so every on-device call carries one step instead of the whole manual. The same schema then lets either model answer, and code decides whether to trust the answer.

## What's next

- Mobile field clients: on-device AI in the browser needs a desktop-class machine today, while technicians carry phones and tablets.
- iOS client using Apple Foundation Models through Firebase AI Logic. It was planned, but blocked by my Xcode version.
- PDF manuals with page-anchored quotes.
- Multiple users per site, with separate supervisor and technician roles.
- Photo notes once on-device image input is broadly available.
- A pilot with a building-maintenance team.

## Differentiation

I searched GitHub and public hackathon entries (Nov 2026) for hybrid inspection, round or handover tools and found none. Most public entries are offline chat, note-taking or document summarisation. Inspection-checklist apps already exist, but Rounds differs on three points: the cloud *compiles* the manual for the device model, on-device AI runs inside an offline round, and approved rules, not AI, decide what is safe. This is based on a search, not proof that nothing similar exists.

## Built with

firebase-ai-logic · gemini · gemini-nano · chrome-built-in-ai · cloud-firestore · firebase-app-check · firebase-auth · firebase-remote-config · react · typescript · vite · pwa · ajv · vitest

## Links

- Video: `<YouTube URL>`
- Repository: `<GitHub URL>` (Apache-2.0)
- Live demo: `<demo URL>`. On-device AI needs desktop Chrome with built-in AI; other browsers use the cloud and label it so.

## Notes for judges

- The demo manual is **fictional** (DEMO ONLY). Rounds is not certified for industrial safety use.
- App Check is enforced. A local build needs your own Firebase project and debug token (see the README).
