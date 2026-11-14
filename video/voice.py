#!/usr/bin/env python3
"""Generate the narration lines with Kokoro TTS (am_michael) and record their durations.

Run with the TTS venv: ../../.tts/venv/bin/python voice.py [speed]
Kokoro v1.0 ONNX (Apache-2.0) runs locally; models from github.com/thewh1teagle/kokoro-onnx releases.
Each line is trimmed of edge silence, high-passed at 70 Hz and normalised to -20 LUFS so every line
has the same loudness before the final mix.
"""
import json, os, subprocess, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../.tts'))
from tts import synth

VOICE, SPEED = 'am_michael', float(sys.argv[1]) if len(sys.argv) > 1 else 0.88
os.makedirs('audio', exist_ok=True)
narr = json.load(open('narration.json'))
for s in narr:
    s['durs'] = []
    for i, line in enumerate(s['lines']):
        raw, out = f"audio/{s['id']}_{i}.raw.wav", f"audio/{s['id']}_{i}.wav"
        synth('kokoro', VOICE, line, raw, SPEED)
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', raw, '-af',
            'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.02,areverse,'
            'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.08,areverse,'
            'highpass=f=70,loudnorm=I=-20:TP=-3:LRA=7,aresample=48000,adelay=120,apad=pad_dur=0.12', '-ac', '1', out], check=True)
        os.remove(raw)
        d = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out]))
        s['durs'].append(round(d, 3))
json.dump({'voice': f'kokoro {VOICE} speed {SPEED}', 'scenes': narr}, open('narration.timed.json', 'w'), indent=1)
# report fit against each line's anchor
for s in narr:
    for i, (a, d) in enumerate(zip(s['at'], s['durs'])):
        nxt = s['at'][i + 1] if i + 1 < len(s['at']) else s['footage'] - 1.0
        words = len(s['lines'][i].split())
        print(f"{s['id']}_{i}  {d:5.2f}s / slot {nxt - a - 0.5:5.2f}s  {words / d * 60:4.0f} wpm  {'OVER' if d > nxt - a - 0.5 else ''}")
