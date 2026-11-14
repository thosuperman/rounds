#!/usr/bin/env python3
"""Transcribe every narration line with Whisper (faster-whisper small, local) and store word timings.
Used for subtitle split points and as an intelligibility check (does the recogniser hear the script?)."""
import json, re, subprocess, numpy as np
from faster_whisper import WhisperModel
m = WhisperModel('small', device='cpu', compute_type='int8')
NUM = {'82': 'eighty two', '5.2': 'five point two'}
def norm(s):
    for k, v in NUM.items(): s = s.replace(k, v)
    return re.sub(r"[^a-z0-9' ]", ' ', s.lower().replace('-', ' ')).split()
def load(f): return np.frombuffer(subprocess.check_output(['ffmpeg','-v','error','-i',f,'-ar','16000','-ac','1','-f','f32le','-']), np.float32)
J = json.load(open('narration.timed.json'))
errs = tot = 0
for s in J['scenes']:
    s['words'], s['heard'] = [], []
    for i, line in enumerate(s['lines']):
        segs, _ = m.transcribe(load(f"audio/{s['id']}_{i}.wav"), language='en', beam_size=5, temperature=0,
                               condition_on_previous_text=False, word_timestamps=True)
        ws = [w for g in segs for w in g.words]
        s['words'].append([[w.word.strip(), round(w.start, 2), round(w.end, 2), round(w.probability, 2)] for w in ws])
        heard = ' '.join(w.word.strip() for w in ws); s['heard'].append(heard)
        r, h = norm(line), norm(heard)
        diff = [a for a, b in zip(r, h) if a != b] + (['<len>'] if len(r) != len(h) else [])
        errs += len(diff); tot += len(r)
        low = [w for w in s['words'][-1] if w[3] < 0.5]
        print(f"{s['id']}_{i} {'OK ' if not diff else 'DIFF'} heard: {heard}" + (f"   low-confidence: {low}" if low else ''))
json.dump(J, open('narration.timed.json', 'w'), indent=1)
print(f'word mismatches {errs}/{tot}')
