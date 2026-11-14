# Demo video script (target 2:50, ≤ 3:00)

> Pre-production plan. The final narration as spoken is in `video/Rounds_Narration_Script.md`; `docs/VIDEO_SUBTITLES.srt` is a copy of the final subtitles.

- **Format:** screen recording of the real app in desktop Chrome with on-device AI enabled. Narration is calm English at about 110 words per minute (≈ 315 words). English subtitles come from `VIDEO_SUBTITLES.srt`.
- **Honesty rules:**
  - Record real runs only.
  - Long on-device waits (10–80 s on the test Mac) may be shortened with a visible "⏩ wait shortened" caption. Never cut in a different result.
  - Keep the source badge ("On-device" / "Cloud") visible whenever an AI result appears.
  - Show the Network panel or the app's **Offline** pill whenever the device is offline.
- **Before recording:**
  - Use a fresh workspace (new Chrome profile or cleared site data) with the model already downloaded ("On-device AI ready").
  - Window at 1280×800, zoom 110%.

| # | Time | Screen (demo step) | Narration |
|---|---|---|---|
| 1 | 0:00–0:15 | Title card, then the empty Supervisor tab. Caption: "Fictional demo equipment. Not for real safety use." | Inspection rounds happen in basements and pump rooms, often with no signal. Rounds brings AI to the technician there, without letting AI decide what is safe. |
| 2 | 0:15–0:38 | **1–2.** Compile a manual → Use demo manual → Compile with cloud AI. The draft appears with the **Cloud** badge. | A supervisor starts with the equipment manual. Firebase AI Logic sends it once to Gemini in the cloud, which compiles it into a procedure pack: typed limits the app can enforce, and one small card per step for the local model. |
| 3 | 0:38–1:02 | **3.** Scroll the review: quotes with "✓ found verbatim", a paraphrase warning, *Exclude*, *Approve*, *Publish*. | Every limit and safety rule must quote the manual word for word, and the app checks this in code. Here it flagged a sentence the AI reworded, so the supervisor excludes it. Nothing reaches technicians until each item is approved. |
| 4 | 1:02–1:17 | **4.** Assign round → Technician → Start. Green "Pack cached for offline" tag. | The technician starts the round. The approved pack, with its limits and quotes, is now stored on the device, so the whole round works without a network. |
| 5 | 1:17–1:22 | **5.** DevTools Network → Offline. The top pill turns red: **Offline**. | Now the connection drops, as it often does down here. |
| 6 | 1:22–1:45 | **6.** Vibration step: type a note → *Check my note (local AI)* → result with the **On-device** badge. | The technician describes a squeal near the bearing. Chrome's built-in Gemini Nano, called through the same Firebase AI Logic SDK, reviews the note against this step, on the device, offline. It suggests what the note is missing. It is a suggestion, never a decision. |
| 7 | 1:45–2:02 | **7–8.** Enter `82` on the temperature step → **ALARM**, the quote, and the approved escalation rule. | Then an abnormal reading: 82 degrees. No AI judges this number. A rule compares it with the approved limit, shows the manual's sentence, and the escalation rule the supervisor approved. |
| 8 | 2:02–2:20 | **9.** *Request detailed cloud analysis* → consent dialog with the exact payload → *Queue for later*. "Queued" line. | For a deeper look, the technician sees exactly what would be sent, and agrees. While offline, it waits in a queue on the device, with an ID that stops it from being sent twice. |
| 9 | 2:20–2:38 | **10–11.** Network → Online. The queue drains and a review appears with the **Cloud** badge. Brief cut to the Hybrid ledger. | When the connection returns, the review runs in the cloud, with the manual section and this check's history from earlier shifts. The ledger records where every call really ran. |
| 10 | 2:38–2:52 | **12.** Complete round → Handover: an **On-device** summary over the rule-built facts table, with the alarm carried to the next shift. | At the end of the shift, the device drafts the handover. The facts underneath come from the recorded readings, and the open issues carry over to the next technician. |
| 11 | 2:52–2:58 | End card: architecture diagram and repo URL. | Rounds. Cloud for the manual, device for the field, rules for safety. |

**Word count:** narration ≈ 320 words; every scene is 100–124 wpm (checked by script). Read it aloud with a timer before recording, and trim row 3 or 9 if it runs past 2:55.

## Shots to capture first (B-roll in case a live call is slow)
- Compile result with the Cloud badge (about 20 s compile).
- On-device note result captured with the Offline pill visible.
- Queue → drain → Cloud review.
- Handover with the On-device badge.
- Ledger showing both sources.
