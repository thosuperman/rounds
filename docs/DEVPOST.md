# Devpost submission: Rounds

> Final version for submission. Nothing has been submitted yet. The repo and video are public; see the checklist below.

## Submission fields (copy into Devpost)

| Field | Value |
|---|---|
| Project name | Rounds |
| Elevator pitch (≤ 200 chars, 166 used) | Offline inspection rounds with hybrid AI. Cloud Gemini compiles the manual, on-device Gemini Nano helps in the field, and approved rules, not AI, decide what is safe. |
| Thumbnail (3:2) | `docs/devpost/00-thumbnail.png` (1500×1000) |
| Video | https://youtu.be/Zj5bSjHjnFY |
| Try it out | https://rounds.hayaix.tech · https://github.com/thosuperman/rounds |
| Built with | firebase-ai-logic, gemini, gemini-nano, chrome-built-in-ai, cloud-firestore, firebase-app-check, firebase-auth, firebase-remote-config, firebase-hosting, react, typescript, vite, pwa, ajv, vitest |
| Story | Everything from **Inspiration** to **Notes for judges** below |

### Form answers

**Project start date (MM-DD-YY):** 11-12-26

**Platform(s):** Web (Chrome) only. No iOS or Android app was built.

**How the project meets the main technology requirement:**

Rounds uses **Firebase AI Logic for all of its generative AI**, through the Web SDK (firebase 13.3) with the Gemini Developer API. It uses both hybrid inference paths, and each task is assigned to one on purpose:

- **On-device (`PREFER_ON_DEVICE`):** Chrome's built-in Gemini Nano checks a technician's note, answers questions about the current step, and drafts the shift handover. This works fully offline. In the demo, a note was checked on the device in 69.4 s with the network off. Cloud fallback for these tasks is used only after the user opts in, so notes are never sent to the cloud without consent.
- **Cloud (`ONLY_IN_CLOUD`):** Gemini compiles the full equipment manual into a procedure pack once. It also runs consented reviews and trend analysis. A review requested offline waits in a queue and runs when the connection returns.
- **The two paths work together.** The cloud model splits the manual into small step cards for the on-device model. A note check then takes 338 tokens instead of 4,744 for the full manual, ran in 34–49 s instead of 109–140 s, and caught an out-of-limit reading in 3 of 3 runs instead of 0 of 3.
- **Every AI result shows where it really ran**, taken from the SDK's `response.inferenceSource`, and every call is recorded in a Hybrid ledger.
- **App Check is enforced** on Firebase AI Logic. A call without a valid token gets HTTP 401.

Measurement limits and safety decisions are made by deterministic, supervisor-approved rules, never by AI.

**Testing instructions or credentials:**

**No login or credentials needed.** Open https://rounds.hayaix.tech. Each browser gets its own new, empty workspace through anonymous sign-in. The equipment manual is fictional and labelled DEMO ONLY.

**Browser:** use desktop Chrome with built-in AI (the Prompt API, tested on Chrome 157), on hardware that meets Chrome's requirements for built-in AI. The top bar shows **On-device AI ready** when Gemini Nano is available. In other browsers everything except on-device AI still works. Turn on **Cloud fallback** in the top bar to run AI help in the cloud; those results are labelled **Cloud AI**. On-device calls take about 10–80 s on a laptop, and a progress timer shows while one runs.

**Steps (about 10 minutes):**
1. **Supervisor** → *Compile a manual* → *Use demo manual* → *Compile with cloud AI* (about 1–2.5 min, labelled Cloud AI).
2. Review the draft. Each item shows its manual quote. Exclude any item flagged "AI wording is not verbatim", then *Approve all items with no findings* → *Publish*.
3. *Seed demo history (synthetic)* → *Assign round*.
4. **Technician** → *Start*. Then go offline: DevTools → Network → Offline. The pill turns red.
5. Enter readings `4.1` and `82`. Rules flag 82 °C as an ALARM, without AI. Write a note → *Check my note (local AI)*. The result is labelled **On-device AI**.
6. At the vibration step, enter `5.2` → *Request detailed cloud analysis* → *Queue for later*.
7. Go back online. The queued review runs on the cloud and the pill shows **Synced**.
8. *Complete round* → **Handover**: an on-device summary above a facts table built by rules.
9. **Hybrid ledger** lists every AI call and where it ran.

**Video:** https://youtu.be/Zj5bSjHjnFY · **Code:** https://github.com/thosuperman/rounds (setup steps for running it locally are in the README) · **Legal:** https://rounds.hayaix.tech/terms, /privacy, /disclaimer

**Open-source license URL:** https://github.com/thosuperman/rounds/blob/main/LICENSE (Apache License 2.0)

### Image gallery (upload in this order, 3:2, each under 1 MB)

All app images are real frames from the recorded demo run (the same build as the live site), apart from #9, a screenshot of the same workspace taken after the run with two fresh AI calls (one on-device, one cloud). The equipment is fictional.

| # | File | Caption |
|---|---|---|
| 1 | `docs/devpost/01-architecture.png` | Architecture: cloud Gemini compiles the manual, Gemini Nano helps on the device, and rules plus supervisor approval decide what is safe. |
| 2 | `docs/devpost/02-cloud-compile.png` | Cloud Gemini (ONLY_IN_CLOUD) compiles the manual into a draft pack in 149 s. Every limit must quote the manual word for word. |
| 3 | `docs/devpost/03-supervisor-review.png` | The supervisor approves item by item. A safety line the AI paraphrased is flagged and excluded before publishing. |
| 4 | `docs/devpost/04-offline-on-device.png` | Network off: Gemini Nano checks the technician's note on the device (69.4 s). The label comes from response.inferenceSource. |
| 5 | `docs/devpost/05-rule-alarm.png` | 82 °C is judged by a rule, not AI: alarm, manual quote, approved escalation rules, and a repeat deviation from an earlier shift. |
| 6 | `docs/devpost/06-consent.png` | Before a cloud review, the technician sees the exact text to be sent. Offline, the request is queued on the device. |
| 7 | `docs/devpost/07-cloud-review.png` | Back online, the queued request runs on cloud Gemini (3.0 s) with the manual section and this check's history. Advisory only. |
| 8 | `docs/devpost/08-handover.png` | Gemini Nano drafts the shift handover on the device (49.1 s), above a facts table built by rules from the recorded readings. |
| 9 | `docs/devpost/09-hybrid-ledger.png` | Hybrid ledger: every AI call with its real source, plus the routing policy and the consented cloud review queue. |

The images are rendered by `video/gallery.mjs` from stills of the recording.

### Final checks before Submit

- [x] GitHub repo set to public, and the README renders (checked 2026-11-15)
- [x] YouTube video visibility is Public (checked 2026-11-15: listed on the channel)
- [x] https://rounds.hayaix.tech loads (one reload may be needed after a deploy)
- [x] Legal pages live: https://rounds.hayaix.tech/terms, /privacy, /disclaimer
- [x] License URL works: https://github.com/thosuperman/rounds/blob/main/LICENSE
- [ ] All gallery images uploaded with captions, and the thumbnail set (re-upload images 1 and 9 if older versions were uploaded)
- [ ] Devpost form answers pasted (platform, technology requirement, testing instructions, license URL)
- [ ] Final read-through of the story below

---

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
- **Deterministic domain layer** (TypeScript, 31 tests):
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

- Video: https://youtu.be/Zj5bSjHjnFY
- Repository: https://github.com/thosuperman/rounds (Apache-2.0)
- Live demo: https://rounds.hayaix.tech. On-device AI needs desktop Chrome with built-in AI. In other browsers, readings and rules work, and AI help uses the cloud after you switch on **Cloud fallback** (labelled "Cloud").

## Notes for judges

- The demo manual is **fictional** (DEMO ONLY). Rounds is not certified for industrial safety use.
- App Check is enforced. A local build needs your own Firebase project and debug token (see the README).
