# Rounds — build status (updated 2026-11-15)

## Phase 1 reality check

| Check | Result | Evidence |
|---|---|---|
| New competitors resembling Rounds | **None found.** I searched GitHub for "procedure pack", "shift handover", "maintenance rounds", "inspection hybrid", and code using `PREFER_ON_DEVICE`. The closest hit is a static shift-report page with no AI (saiteja397/industrialops). | `gh search` (Devpost gallery still unpublished) |
| Web SDK API | `firebase@13.3.0` provides `InferenceMode.{PREFER_ON_DEVICE, ONLY_ON_DEVICE, PREFER_IN_CLOUD, ONLY_IN_CLOUD}`, `response.inferenceSource` (`on_device` / `in_cloud`), `onDeviceParams.promptOptions.responseConstraint` (JSON Schema on-device), `inCloudParams.generationConfig.responseJsonSchema`, and `initializeDeviceModel()` | `node_modules/@firebase/ai/dist/ai-public.d.ts` |
| Web on-device model | **Real local inference works on this Intel MacBook Pro.** Chrome 157, test profile. Availability went `downloadable` → download → `available`. A structured JSON prompt returned valid JSON in 9.1 s. `contextWindow` = 9216. | `tools/cdp-eval.mjs` runs |
| iOS SDK API | ⚠ **Firebase iOS SDK 13.0 removed `HybridModel`**, but the hybrid guide still documents it. The new `GeminiLanguageModel` path needs Xcode 27; this Mac has Xcode 26.5. **Plan: pin firebase-ios-sdk 12.19.3**, which still includes `HybridModel` (verified in source). | `FirebaseAI/CHANGELOG.md` 13.0.0 |
| iOS device | The iPhone 17e is on **iOS 27.2** and Xcode 26.5 has only the 26.5 SDK. Whether Xcode 26.5 can install on iOS 27.2 is **not verified yet**. The iPhone 13 has no Apple Intelligence, so it is the cloud-fallback device. | `devicectl` |
| Cloud model, App Check, costs | Free Spark project `rounds-hybrid-bfb0` using the Gemini Developer API with no billing. See Phase 2. | Firebase console |

**Verdict: GO for Web.** On-device inference is proven on the target Mac. **iOS is CONDITIONAL**: it depends on deploying to the iOS 27.2 iPhone from Xcode 26.5 with SDK 12.19.3.

## Phase 2 verification (2026-11-13, real runs, test Chrome profile, Intel MacBook Pro)

Everything below was executed through the real UI using `tools/ui.mjs` (puppeteer over CDP, real clicks and typing). Offline means Chrome network emulation with `navigator.onLine === false`, checked inside the same session. The source labels come from the SDK's `response.inferenceSource`.

| What | Result | Evidence |
|---|---|---|
| Cloud compile (manual → pack) | ✅ `IN_CLOUD` in 20.6 s (v1) and 20.8 s (v2), schema-valid. All quotes found verbatim and 0 blockers. | `evidence/01`, `12` |
| Publish lock | ✅ Publish stays disabled until every item is approved or (safety/escalation only) excluded. Older versions are retired on publish. | `02`, `13` |
| Readings offline | ✅ Recorded and rule-checked offline. `5,2` parsed as 5.2 mm/s → Attention, with the manual quote. | `03`, `04` |
| On-device note check **offline** | ✅ `ON_DEVICE` in 18.4 s with `navigator.onLine=false`. The ledger row is tagged `offline`. Other on-device runs: 26.7 s, 79.8 s (latency varies a lot on this Intel GPU). | `05` (taken **before** the new guards, so it shows the raw model mistakes), `09` |
| On-device Q&A | ✅ `ON_DEVICE` in 10.1 s, but **online**: the emulation had ended. The answer was "Not covered…" because the v1 pack lacked escalation actions; fixed in v2. | `06-ask-on-device-online.png` |
| Consent → offline queue → drain | ✅ The consent dialog shows the exact payload and offers "Queue for later". The request was queued on the device, then ran `IN_CLOUD` in 9.0 s on reconnect (1 attempt). | `07`, `08`, `10` |
| Handover written on-device **offline** | ✅ `ON_DEVICE`. The deterministic facts table is authoritative. An off-topic AI action exposed a bug, now fixed with `repairActions`. | `11`, `15` |
| Alarm → approved escalation rules | ✅ 82 °C → ALARM. The UI lists the supervisor-approved escalation rules with quotes; there is no hard-coded advice. | `14` |
| Excluded item never reaches technicians | ✅ Absent from the technician view and from the cached pack. | checked via CDP |
| Cross-shift trends | ✅ `IN_CLOUD` in 2.2 s. It cites only recorded values. | `16` |
| App Check | ✅ **Enforced** on AI Logic (`firebaseml.googleapis.com`) and Firestore. A direct call with no token or a forged token gets **401** "App Check token is invalid". The app with the registered debug token still works. | CDP fetch test |

### Bugs found by running it, and fixed
1. **Workspace bootstrap was blocked by the rules.** A new user could not `get` their not-yet-existing workspace, so every write was denied. The rule now allows owner probe; test added.
2. **The model invented an alarm concern** ("≥ 7.1 mm/s" when the reading was 5.2). The guard now drops AI concerns that contain numbers, since numbers are judged only by rules. It also drops "missing reading" items when a reading exists. The removed text is shown, not hidden.
3. **Safety text could differ from its quote.** A paraphrase warning was added. Bulk approve skips any item with a finding. The supervisor can exclude safety/escalation items, but never limits.
4. **The compiler lost escalation actions.** The prompt now requires "condition: action" with a verbatim quote, and the v2 pack includes "Contact the shift supervisor…".
5. **The alarm banner had hard-coded advice.** It now shows the approved escalation rules.
6. **Handover action was off-topic** ("Check Vessel for Seal/Leakage" on a vibration issue). Such actions are now replaced with the template and flagged.
7. **Shift label used the UTC date.** It now uses the local date. Steps without a measurement show "Checked", not "Within limits".

### Known limits (honest)
- On-device latency on this Intel Mac is 10–80 s per call. It is usable for a demo, but slow; a Gemini Nano GPU on Apple Silicon or a newer GPU would be faster.
- The compiler dropped the seal step's qualitative criterion ("continuous stream is a deviation"). Supervisor review is the control for this.
- (Resolved 2026-11-14) Production App Check uses a score-based Fraud Defense (reCAPTCHA Enterprise) key in this project. Domains: rounds.hayaix.tech, rounds-hybrid-bfb0.web.app and rounds-hybrid-bfb0.firebaseapp.com. No billing on the project.

## Phase 3: independent judge review and fixes (2026-11-14)

A separate reviewer read the code and docs as a skeptical judge. It scored Technology 4, Design 3, Impact 3 and Idea 4, out of 5. Everything below was fixed and then re-run in the test Chrome profile.

| Review finding | Fix | Verified by a real run |
|---|---|---|
| "Manual too long for the device" was false (the demo manual was 2.5 KB) | The manual now has 16 sections (18.7 KB) with §1–§3 unchanged. **Measured** instead of claimed (`evidence/token-latency-measurement.json`). | Chrome token counter: manual 4,407 tokens. A note check costs **338 tokens with a step card vs 4,744 with the full manual**. Firebase AI Logic `ONLY_ON_DEVICE`, 3 runs each: **34–49 s vs 109–140 s**. The out-of-limit reading was flagged in **3/3 runs vs 0/3**. |
| Cloud compile with the long manual | — | `IN_CLOUD` in 96.5 s. 0 blockers. It stayed within §2 despite numbers in other sections, and now includes the seal criterion. The paraphrase flag caught an AI-written safety line again (`17`). |
| SDK fallback sent notes to the cloud without consent | Device tasks with no local model are refused unless the user turns on **Cloud fallback** (top bar). Otherwise the app offers the consented review. | Built-in pane (no local model): refused, *nothing sent*. After opt-in: SDK fallback ran `IN_CLOUD` in 10.4 s. |
| Cloud review had no cloud-only context | The payload adds this check's history across shifts and the verbatim manual section (cached for offline). | The review cited the "two consecutive shifts" rule and §2.3 (`20`). |
| The consecutive-shift rule was not applied in code | A rule-based "Repeat deviation" banner, driven by recorded history, lists the approved rule for repeated deviations. | Shown for temperature and vibration (`18`, `19`). |
| A note check before the reading showed "Enter a value." | The interpretation is kept and saved together with the reading. | No error. On-device in 40.1 s, offline (`19`). |
| "Complete round" did not open the handover | It now switches to the Handover tab. | (`21`) |
| Queue could wait 30 s after reconnecting | Retries every 5 s while work is pending. | The cloud result arrived **7 s** after reconnecting. |
| No visible progress during slow on-device calls | Live seconds counter on the button. | "Checking note… 3s" |
| Handover prose said "operating stably" beside an ALARM | Prose that calls the equipment stable, normal or fine while readings are out of limits is rejected. Missing or off-topic actions are repaired by rules (the action check also accepts words from the issue's note). | Reassuring prose was rejected by the guard. Final on-device summary accepted (`22`). |
| "Seen on N shifts" counted rounds | Counts distinct shifts. | Unit test |
| Overclaims in README, Devpost and the video script | Corrected: context claim, consent, ledger scope, consent timestamp, App Check hosting note, iOS mentions, "900-token cards". | Docs review |
| Dead code | Removed the PDF branch, the unused Remote Config default and the Apple model name branch. | `tsc` and build clean |

## Final deliverables (status)

| # | Deliverable | Status |
|---|---|---|
| 1 | Final architecture | `docs/architecture.svg` / `.png`, README |
| 2 | Verified SDK capabilities | Phase 1 table; `inferenceSource` and the `ONLY_ON_DEVICE` / `PREFER_ON_DEVICE` / `ONLY_IN_CLOUD` paths exercised |
| 3 | On-device evidence | Phases 2–3 (offline runs, measurement JSON, screenshots) |
| 4 | Cloud evidence | Compile, review, trends, SDK fallback after opt-in |
| 5 | Features | README "What it does" and "Safety design" |
| 6 | Tests | 41 unit tests (31 domain, 10 legal pages) + 16 rules tests pass; production build passes |
| 7 | Deployment | **Deployed 2026-11-14 to https://rounds-hybrid-bfb0.web.app** (Firebase Hosting, free). Live checks: App Check token from Fraud Defense (exchange 200), cloud compile `IN_CLOUD` 76.4 s, Firestore writes 200, publish lock, and an on-device note check (`ON_DEVICE` 23.4 s, no AI Logic request sent) (`23`). The production bundle contains no debug token. **Custom domain https://rounds.hayaix.tech is live** (Route 53 CNAME, Let's Encrypt certificate). App Check exchange, Firestore and a cloud compile (`IN_CLOUD` 56.7 s) were verified on it. **2026-11-15:** legal pages and the Hybrid ledger wording fix deployed (`f2f57cb`, `b1f0b01`); the live bundle was checked. |
| 8 | Screenshots | `evidence/01–22` (real captures; `05` predates the guards) |
| 9 | Video | **Uploaded: https://youtu.be/Zj5bSjHjnFY** `video/Rounds_Final_Demo_1080p.mp4` (2:58.7, 1080p30), narration v2 with Kokoro TTS `am_michael` (0.4% word errors when transcribed by Whisper, against 3.2% for the old Reed voice), subtitles `video/Rounds_Subtitles.srt`. QA: `video/Rounds_Video_QA.md`. On YouTube with the title from `video/Rounds_YouTube.md`. Visibility **Public** (checked 2026-11-15: listed on the channel, `isUnlisted:false`). |
| 10 | Public repo readiness | **Public** at github.com/thosuperman/rounds (Apache-2.0, secrets scanned across full history 2026-11-15). |
| 11 | Devpost materials | `docs/DEVPOST.md`: final text, submission fields, form answers, thumbnail and 9 captioned gallery images in `docs/devpost/` (images 1 and 9 regenerated 2026-11-15 after the wording fix) |
| 14 | Legal pages | **Live 2026-11-15:** https://rounds.hayaix.tech/terms, /privacy, /disclaimer, linked from the footer of every screen. The privacy policy was written from an audit of the code (`web/src/legal/content.tsx`); update it whenever data handling changes. |
| 12 | Remaining risks | On-device latency 34–80 s on this laptop. Desktop-only on-device AI. Web-only (no iOS). Compile output varies by run, so the paraphrase moment may not repeat on camera. No real users or pilot. |
| 13 | Verdict | **READY to submit.** Repo public, video public, live demo and legal pages live, Devpost text and images final. Left for you: fill in the Devpost form and upload the images, a final read-through, then Submit. |

## Built so far (web)

- `shared/schema/*.json`: one JSON Schema per AI task, shared with iOS. The same schema serves as the on-device `responseConstraint` and the cloud `responseJsonSchema`, and Ajv validates every result against it.
- `web/src/domain`: rule-based logic with no AI involved:
  - measurement parser and unit conversion
  - threshold checks against approved limits only
  - pack verification: each quote must appear verbatim in the manual, and the value and unit must appear inside the quote
  - publish lock that requires per-item supervisor approval
  - on-device token budget per step card
  - output guards: reject invented numbers, filter unsafe wording
  - handover facts and template
- `web/src/ai`: the hybrid layer (`runStructured`, which reports `inferenceSource`), the escalation queue (idempotent ids, transaction lease, retries, quota back-off, consent before upload) and the ledger.
- `web/src/views`:
  - Supervisor: compile, review and approve, assign rounds, issues and trends, seeded demo history
  - Technician: offline round, glove-sized keypad, rule result, local AI note check and Q&A, cloud review queue
  - Handover
  - Hybrid ledger
- PWA service worker (the app shell works offline) and Firestore persistent cache (writes work offline).
- `firestore.rules`, indexes, Remote Config template, Apache-2.0 LICENSE.

## Tests run

- `web`: **41/41** unit tests pass: 31 domain and 10 legal-page tests (`npx vitest run`, 2026-11-15).
- `rules-test`: **16/16** Firestore rules tests pass on the emulator (`npm --prefix rules-test test`, 2026-11-14).
- `web`: `tsc -b` is clean, and `vite build` succeeds.

## Still to do

1. ~~Make the GitHub repo public~~ Done (2026-11-15).
2. ~~Record and upload the video~~ Done: https://youtu.be/Zj5bSjHjnFY, Public.
3. ~~Fill the URLs in `docs/DEVPOST.md`~~ Done.
4. ~~Legal pages (Terms, Privacy, Disclaimer)~~ Done and live.
5. You: fill in the Devpost form from `docs/DEVPOST.md`, upload the thumbnail and gallery with captions, read it through, and submit (deadline Dec 1 07:00 JST).
6. Optional: iOS spike (iPhone 17e, Xcode 26.5 + firebase-ios-sdk 12.19.3).

- Security fix (2026-11-14): the production bundle used to inline the App Check debug token (aliased `import.meta.env`). Fixed before any deploy, and verified absent from `dist/`.
