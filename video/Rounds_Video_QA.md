# Rounds demo video: QA results (2026-11-14)

File: `Rounds_Final_Demo_1080p.mp4`, 20.5 MB.

## Technical checks (measured with ffprobe and ffmpeg)

| Check | Requirement | Result |
|---|---|---|
| Duration | ≤ 180 s, target 160–175 s | **172.2 s (2:52.2)** ✅ |
| Video | ≥ 1920×1080, ≥ 30 fps | H.264 High, **1920×1080, 30 fps**, yuv420p, faststart ✅ |
| Audio | AAC, clear voice | AAC-LC 48 kHz stereo, 147 kb/s. Integrated loudness **−16.7 LUFS**, peak −4.3 dB (no clipping), LRA 4.6 LU ✅ |
| Silences | — | 2 silences over 3 s, both intended (title card, end card) ✅ |
| Background music | None | None ✅ |
| Subtitles | English, synced to speech | `Rounds_Subtitles.srt`: 29 cues, timed from each line's measured audio. Also burned into the video. Text identical to the narration (checked by script) ✅ |
| Narration pace | 105–115 wpm | 307 words over 2:39 of narration time ≈ **115 wpm** including pauses ✅ (upper edge) |

## Content checks (frame-by-frame contact sheets of the final render)

| Check | Result |
|---|---|
| Real app footage only | ✅ Every app shot is a screen recording of real runs. No mock-ups. |
| On-device vs cloud labels | ✅ Badges come from the SDK's `inferenceSource`: Cloud AI · 149.2s (compile), On-device AI · 69.4s (note, offline), Cloud AI (review), On-device AI (handover) |
| OFFLINE / SYNCED states | ✅ Pills reflect runtime state: Offline from `navigator.onLine`; "Saved on device · 7 to sync" → **Synced** from unacknowledged Firestore writes |
| Narration matches visuals | ✅ After fixing clock drift (see below), each line plays over its matching action: the Offline pill during "the connection drops", the on-device result during the Gemini Nano line, the alarm and repeat banner during scene 5, the cloud review during the reconnect line, the handover during scene 7 |
| Shortened waits are disclosed | ✅ Yellow captions give the real durations (149 s cloud compile, 69 s on-device note check, 8 s cloud review wait, about 48 s on-device handover) and the speed-ups (1.5×, 1.6–2×, 2.5×) |
| No secrets or personal data | ✅ No API keys, tokens, emails or account names on screen. The anonymous workspace ID and Firebase project ID are not shown. Dev tools are not shown. |
| No third-party logos | ✅ None. Firebase and Gemini are named in speech and text only, not as logos (Devpost rule on third-party marks). |
| Fictional data | ✅ The manual is labelled DEMO ONLY on screen. Earlier shifts come from the labelled "Seed demo history (synthetic)" button, pressed off camera. |
| Text readable, nothing cropped | ✅ Subtitles stay inside the safe area. A few scene chips and captions partly cover the app's top edge; checked that they hide nothing the narration refers to. |

## Problems found during QA and fixed

1. **AI handover error (take 1).** The on-device summary said "Seal and leakage checks were not performed", which was false. Root cause: our facts text printed "not recorded" for a check with no reading. Fixed the facts text and the prompt, added a deterministic guard that rejects "not done" claims, and added a test (31/31 pass). Re-recorded everything as take 2.
2. **Recording clock drift.** The screencast's clock ran 19–24% long, so the first edit missed the handover and the cloud result. Each clip was retimed to its real wall-clock length using the event log, and the cuts were re-checked frame by frame.
3. **A click during smooth scrolling missed (take 1, scene 7).** The recorder now waits for scrolling to settle before clicking.
4. **Scene 4 opened on the supervisor screen** (off-camera setup visible). The cut now starts on the Technician tab.
5. **Audio was mono at 96 kHz.** Now 48 kHz stereo.

## Known limitations (not fixed)

- **Voice quality.** You chose the built-in macOS "Reed" voice. It is clear and evenly paced, but it is a classic synthetic voice, not a natural neural voice. **I could not listen to the audio**, so pronunciation (for example "Gemini" and "S D K") is not verified by ear. Please listen before uploading. If any word sounds wrong, I can regenerate that line with a spelling tweak in a few minutes.
- **Compiler wording varies between runs.** In this take the step titles read "Discharge Pressure Check" and so on. The reference screenshots in `evidence/` come from other runs.
- **Scene 3 shows 1 of the 4 exclusions.** The caption says so.
- **On-device AI output is imperfect.** The note summary in scene 4 is cut off mid-word ("…steady gauge re"). That is the real model output, shown as is.
- **Not uploaded.** YouTube upload waits for your approval.

## Files

| File | Description |
|---|---|
| `Rounds_Final_Demo_1080p.mp4` | Final video |
| `Rounds_Subtitles.srt` | Subtitles to upload to YouTube as English captions |
| `Rounds_Narration_Script.md` | Narration as spoken |
| `Rounds_Storyboard.md` | Scenes and timings |
| `Rounds_Narration.wav` | Narration track, 48 kHz PCM |
| `Rounds_Thumbnail_1280x720.png` | YouTube thumbnail |
| `Rounds_YouTube.md` | YouTube title and description |
| `raw/` | Original recordings: `*.webm` (take 2) and `take1/`, plus event logs |
| `audio/` | Per-line voice files |
| `record.mjs`, `edit.py`, `overlays.mjs`, `thumb.mjs`, `plan.json` | Scripts to reproduce the recording and the edit |
