# Rounds: storyboard (as edited)

**Footage**
- Every shot is a screen recording of the real Rounds web app: dev build on `localhost:5173`, same code as the hosted site, desktop Chrome 157 with built-in Gemini Nano.
- 1280×720 page at 1.5× density, captured at 2560×1440 and downscaled to 1920×1080.
- The workspace was clean (site data cleared, new anonymous user) and used the fictional AquaLift CP-40 manual.

**Labels**
- **Top-left chip:** the role in the current scene.
- **Yellow captions:** footage that was sped up or shortened, with the real measured duration.
- **Status pills:** the app's own UI, driven by runtime state, never added in the edit:
  - Online / Offline from `navigator.onLine`
  - Synced / "Saved on device · N to sync" from unacknowledged Firestore writes
  - On-device AI / Cloud AI from the SDK's `response.inferenceSource`

**Not shown on camera:** between scenes 3 and 4, the app's **Seed demo history (synthetic)** button added two earlier shifts (labelled DEMO-1 and DEMO-2 in the UI), and **Assign round** created the round.

| # | Time | Screen | What is real |
|---|---|---|---|
| 0 | 0:00–0:03.5 | Title card: "Rounds", one-line description, "Real app, real runs · fictional demo equipment · not for real safety use" | — |
| 1 | 0:03.5–0:23.4 | Supervisor tab, empty workspace. Pills: Online · Synced · On-device AI ready | Live app state |
| 2 | 0:23.4–0:48.6 | Compile a manual → Use demo manual (18,649 chars, ≈5,828 tokens shown) → Compile with cloud AI. **Cut**: caption "⏩ Cloud compile took 149 s · wait shortened". Draft pack with badge **Cloud AI · 149.2s** | Real Gemini call through Firebase AI Logic (`ONLY_IN_CLOUD`) |
| 3 | 0:48.6–1:09.8 | Review: each item shows "✓ quote found verbatim in manual". A reworded safety line shows "⚠ AI wording is not verbatim"; **Exclude** strikes it through. **Cut**: caption "3 more reworded lines excluded the same way" (4 were flagged in this run). Approve all items with no findings → Publish | Deterministic quote checks; publish lock |
| 4 | 1:09.8–1:37.0 | Technician → Start (pack cached) → Network goes **Offline** (pill turns red) → reading 4.1 bar → Within limits (shown at 2.5× speed) → note "Faint rattling near the pump. Gauge needle steady." → Check my note (local AI), with live counter "Checking note… 68s". **Cut**: caption "⏩ On-device inference took 69 s · wait shortened". Result badge **On-device AI · 69.4s** | Real on-device Gemini Nano call while `navigator.onLine === false` |
| 5 | 1:37.0–2:00.1 | Next step → 82 °C → **ALARM** (rule-based), with the manual quote and the approved escalation rules → "Repeat deviation" banner (DEMO-2 Evening, 74 °C) | Rule engine only |
| 6 | 2:00.1–2:27.7 | Vibration 5.2 mm/s → Attention + repeat banner → note typed (1.6–2× speed) → Request detailed cloud analysis → consent dialog shows the exact payload (manual §2.3, history) → **Queue for later** → pill "Saved on device · 7 to sync" → network back → **Synced** → **Cut**: "⏩ 8 s cloud wait shortened" → review card with **Cloud AI** badge | Real offline queue; real cloud review after reconnecting |
| 7 | 2:27.7–2:47.2 | Seal step note → Save step → Complete round (1.5× speed) → **Cut**: "⏩ On-device handover took ~48 s · wait shortened" → Handover tab: summary with **On-device AI** badge above the rule-checked facts table (4.1 bar OK, 82 °C ALARM, 5.2 mm/s Attention, seal Checked) | Real on-device summary that passed the output guards |
| 8 | 2:47.2–2:52.2 | End card: cloud prepares the knowledge · device helps offline · approved rules decide what is safe · rounds.hayaix.tech | — |
