# YouTube upload

Uploaded: https://youtu.be/Zj5bSjHjnFY

**Title (≤100 chars)**
Rounds: offline inspection rounds with hybrid AI (Firebase AI Logic) | #BuildHybridAI 2026

**Visibility:** Public (required by Devpost). Upload only after approval.
**Captions:** upload `Rounds_Subtitles.srt` as English. Subtitles are also burned into the video.
**Thumbnail:** `Rounds_Thumbnail_1280x720.png`

**Description**

Rounds brings AI to equipment inspection rounds in places with no signal, while approved rules decide what is safe.

What the demo shows (real app, real runs, fictional demo equipment):
0:24 Gemini in the cloud compiles an equipment manual into a procedure pack (Firebase AI Logic, ONLY_IN_CLOUD)
0:49 Every limit must quote the manual word for word. The supervisor excludes AI-reworded lines and approves the rest.
1:10 Offline: Chrome's built-in Gemini Nano checks a technician's note on the device (Firebase AI Logic, PREFER_ON_DEVICE)
1:39 An abnormal reading is flagged by a rule, not by AI, with the approved escalation rule
2:02 A consented cloud review is queued offline, then runs in the cloud when the connection returns
2:34 The device drafts the shift handover on top of rule-checked facts

Long AI waits are shortened in the edit; the real durations are shown on screen.

Live demo: https://rounds.hayaix.tech (on-device AI needs desktop Chrome with built-in AI)
Code: <GitHub URL> (Apache-2.0)

Not certified for industrial safety use. The equipment and limits in the demo are fictional.

#BuildHybridAI #Firebase #GeminiNano

**Tags:** Firebase AI Logic, hybrid AI, on-device AI, Gemini Nano, Gemini, Chrome built-in AI, offline-first, PWA, inspection, maintenance
