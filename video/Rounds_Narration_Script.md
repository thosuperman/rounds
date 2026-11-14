# Rounds: narration script (as spoken in `Rounds_Final_Demo_1080p.mp4`)

- **Voice:** macOS built-in "Reed (English (US))", rate 142.
- **Pauses:** 0.6 s between sentences and 1.0 s between scenes.
- **Size:** 307 words in 2:52. Effective pace is about 115 words per minute including pauses (2:39 of narration time).
- **Text:** the subtitles (`Rounds_Subtitles.srt`) match this text word for word.
- **TTS input changes:** "SDK" was written as "S D K" so it is read letter by letter. Nothing else was changed for the TTS.

| Time | Scene | Narration |
|---|---|---|
| 0:00 | Title card | (silence) |
| 0:03.5 | 1 · The problem | Every shift, technicians walk plant rooms and basements to check equipment. Down there, the signal is often gone. Rounds brings AI to that inspection round, while approved rules keep the final say on safety. |
| 0:23.4 | 2 · Cloud compiles the manual | A supervisor starts with the equipment manual. This one is fictional, made for the demo. Firebase AI Logic sends it once to Gemini in the cloud. Gemini compiles it into a procedure pack: limits the app can enforce, and one small card per step for the on-device model. |
| 0:48.6 | 3 · Supervisor approves | Every limit must quote the manual word for word, and the app checks each quote in code. Here, it flagged a safety line that Gemini reworded, so the supervisor excludes it. Nothing reaches technicians until every item is approved. |
| 1:09.8 | 4 · Offline, on-device AI | The technician starts the round, and the approved pack is stored on the device. Now the connection drops. At the first check, the technician notes a faint rattling near the pump. Chrome's built-in Gemini Nano, called through the same Firebase AI Logic SDK, reviews the note on the device, offline. |
| 1:37.0 | 5 · Rules flag the reading | Next, an abnormal reading: eighty-two degrees. No AI judges this number. A rule compares it with the approved limit, quotes the manual, and shows the escalation rule the supervisor approved. It also sees that this check failed on an earlier shift. |
| 2:00.1 | 6 · Cloud follow-up | At the vibration check, the reading is high again, with a squeal near the bearing. For a deeper look, the technician sees exactly what would be sent, and agrees. Offline, it waits on the device. When the connection returns, the changes sync, and Gemini in the cloud reviews it with the manual section and this check's history. |
| 2:27.7 | 7 · Handover | At the end of the round, the device drafts the shift handover, on top of facts taken from the recorded readings. Rounds. The cloud prepares the knowledge, the device helps offline, and approved rules decide what is safe. |
| 2:47.2 | End card | (silence) |

Source of truth: `narration.json` (text) and `narration.timed.json` (measured line durations).
