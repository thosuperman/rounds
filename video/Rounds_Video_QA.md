# Rounds demo video: QA results (2026-11-14, voiceover v2)

File: `Rounds_Final_Demo_1080p.mp4`, 20.1 MB. The previous version (macOS "Reed" voice) is kept in `previous_reed/`.

## Why the voiceover was replaced

The first version used the built-in macOS voice "Reed (English (US))". Reed is a classic formant (rule-based) synthesizer, not a neural voice, so it sounds buzzy and flat. Its 307-word script also used long sentences at the top of the pace range (115 wpm). Transcribing the old soundtrack with Whisper confirmed it is harder to understand than the new one (below).

## How the voice was chosen

Engines available on this Mac without paid services:
- **macOS `say`:** only compact and novelty voices are installed (Reed, Eddy, Fred, Ralph and others), with no Enhanced or Premium voices.
- **Piper:** 4 male US neural voices.
- **Kokoro v1.0:** 8 male US neural voices.

Kokoro and Piper are open source (Apache-2.0 and MIT) and run locally.

**Test.** All 16 voices read the same passage, which contains Firebase AI Logic, Gemini, Gemini Nano, on-device AI, hybrid inference and "eighty-two degrees". Each was then transcribed with Whisper (faster-whisper `small`, local) twice: clean, and through a simulated laptop speaker (300 Hz–3.4 kHz band plus noise).
- **Kokoro male voices:** every word recognized in both conditions. They also had the highest recognizer confidence.
- **Reed:** "sync" was heard as "sink" and the leading "When" was dropped, and Reed had the lowest confidence.
- **Ralph, Fred and the Piper john voice:** several errors under the laptop simulation ("undivice AI", "Grows built-in", "PhiBase").

**Second round.** The five best Kokoro voices were tested on harder technical sentences with heavier degradation (400 Hz–3 kHz, about 10 dB SNR). All five were recognized perfectly.

**Chosen: `am_michael`.** Its natural pace is the slowest (about 110 wpm with no stretching), and it has the best quality grade among Kokoro's American male voices.

## Technical checks (measured)

| Check | Requirement | Result |
|---|---|---|
| Duration | under 3:00 | **178.7 s (2:58.7)** ✅ |
| Video | 1080p | H.264 High, **1920×1080, 30 fps**, yuv420p, faststart; full decode with no errors ✅ |
| Audio | clean, consistent | AAC-LC 48 kHz stereo. Integrated **−16.8 LUFS**, loudness range 5.1 LU, peak −4.3 dBFS (no clipping). Every line is normalized to the same loudness before mixing ✅ |
| Pace | 105–115 wpm | 255 words, **110 wpm while speaking** ✅ |
| Pauses | natural, none awkward | 0.5 s minimum between lines. The longest silence during narration is 2.9 s, at scene changes while the footage shows the action. The title card (4.2 s) and end card (5.5 s) are silent by design ✅ |
| Clipped speech | none | Each line is synthesized whole, trimmed of silence, then padded with 0.12 s before and after. No line is cut off by the next one ✅ |
| Background music or noise | none | None. The TTS output is clean and is not a slowed-down recording ✅ |
| Subtitles | accurate, in sync | `Rounds_Subtitles.srt`: 30 cues, text identical to the narration. Long lines are split at sentence or comma breaks using measured word timings. Speech starts 0.0–0.6 s after each cue appears, and no speech plays without a subtitle on screen (measured from the waveform) ✅ |

## Intelligibility check (whole exported video, transcribed by Whisper)

Whisper is used as a stand-in for a first-time listener. It hears only the audio and is not given the script.

| Version | Clean: word errors | Laptop-speaker simulation: word errors |
|---|---|---|
| Previous (Reed) | 10 / 310 (3.2%) | 15 / 310 (4.8%) |
| **New (Kokoro am_michael)** | **1 / 256 (0.4%)**: an extra "A" inserted before "rule" | **0 / 256 (0.0%)** |

Each line was also transcribed on its own (`asr_lines.py`). After three wording fixes, every line is recognized exactly as written:
- "reworded" was heard as "rewarded", so it became "paraphrased".
- "syncs" was heard as "sinks", so it was dropped.
- "Rounds." was heard as "Round,", so the line became "With Rounds, …".

Terms checked: Firebase AI Logic, Gemini, Gemini Nano, hybrid inference, on-device, eighty-two degrees, vibration, bearing.

## Sync checks (frames from the final render)

- I checked contact sheets with one frame under each of the 22 narration lines. Every line plays over its own action:
  - The compile and draft pack.
  - The paraphrased safety line struck through.
  - Publish.
  - The **Offline** pill.
  - The on-device result (**On-device AI · 69.4s**).
  - The 82 °C ALARM and repeat banner.
  - The consent dialog.
  - The queued request.
  - The reconnect.
  - The **Cloud AI** review.
  - The handover.
- **Scene 6 was re-cut for this version.** The old line said "When the connection returns" about 5 s before the pill turned Online. That line is now split in two:
  - "Offline, the request waits on the device" plays over the queued request.
  - "When the connection returns…" starts 0.6 s before the pill turns Online, and continues over the Cloud AI review card.
- **Footage is unchanged** from the previous version: same real recordings, same cuts, same speed-up captions. Narration that runs past a scene's footage holds the last frame: about 1 s in scenes 1, 4 and 7, and 4 s on the cloud review card in scene 6.

## What I could not do

- **I cannot hear audio.** "Listening" here means automatic transcription, recognizer confidence, waveform measurements and frame checks, not a human ear. They show the speech is recognized word for word, even through a simulated laptop speaker. They cannot judge how pleasant the voice sounds. **Please listen once before uploading.** If a word sounds off, regenerating one line takes about a minute (`voice.py`, `asr_lines.py`, `edit.py`).
- **Uploaded** to YouTube: https://youtu.be/Zj5bSjHjnFY

## Reproduce

```
../../.tts/venv/bin/python voice.py 0.76      # Kokoro TTS lines -> audio/*.wav, narration.timed.json
../../.tts/venv/bin/python asr_lines.py       # per-line Whisper check + word timings
python3 edit.py                               # render video, subtitles
../../.tts/venv/bin/python verify_audio.py Rounds_Final_Demo_1080p.mp4 narration.timed.json Rounds_Subtitles.srt
```

The TTS environment (`../../.tts`, outside the repo) contains:
- **Python packages:** `kokoro-onnx`, `faster-whisper`, `piper-tts`, `soundfile`.
- **Kokoro models:** `kokoro-v1.0.onnx` and `voices-v1.0.bin`, from the kokoro-onnx GitHub releases.
- **Piper voices:** from `rhasspy/piper-voices` on Hugging Face.
