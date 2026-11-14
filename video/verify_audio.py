#!/usr/bin/env python3
"""Listen-through proxy for a video: transcribe its whole soundtrack with Whisper and compare with the script.
Usage: verify_audio.py <video> <narration.json> [srt]   Also tests a laptop-speaker simulation (300 Hz-3.4 kHz + noise)."""
import json, re, subprocess, sys, numpy as np
from faster_whisper import WhisperModel
vid, nj = sys.argv[1], json.load(open(sys.argv[2])); nj = nj['scenes'] if isinstance(nj, dict) else nj
srt = sys.argv[3] if len(sys.argv) > 3 else None
NUM = {'82': 'eighty two', '5.2': 'five point two'}
def norm(s):
    for k, v in NUM.items(): s = s.replace(k, v)
    s = s.replace('S D K', 'sdk')
    return re.sub(r"[^a-z0-9' ]", ' ', s.lower().replace('-', ' ')).split()
def wer(r, h):
    d = list(range(len(h) + 1)); ops = []
    for i, rw in enumerate(r, 1):
        p, d[0] = d[0], i
        for j, hw in enumerate(h, 1): p, d[j] = d[j], min(d[j] + 1, d[j - 1] + 1, p + (rw != hw))
    return d[len(h)]
m = WhisperModel('small', device='cpu', compute_type='int8')
ref = norm(' '.join(l for s in nj for l in s['lines']))
for name, af in [('clean', 'anull'), ('laptop', 'highpass=f=300,lowpass=f=3400')]:
    a = np.frombuffer(subprocess.check_output(['ffmpeg', '-v', 'error', '-i', vid, '-af', af, '-ar', '16000', '-ac', '1', '-f', 'f32le', '-']), np.float32).copy()
    if name == 'laptop':
        rng = np.random.default_rng(1); a += rng.normal(0, 1, a.size).astype(np.float32) * np.sqrt(np.mean(a[a != 0] ** 2)) / 10 ** (15 / 20)
    segs, _ = m.transcribe(a, language='en', beam_size=5, temperature=0, condition_on_previous_text=False, word_timestamps=True)
    words = [w for g in segs for w in g.words]
    hyp = norm(' '.join(w.word for w in words))
    e = wer(ref, hyp)
    probs = np.array([w.probability for w in words])
    print(f'[{name}] words heard {len(hyp)} / script {len(ref)}  word errors {e} (WER {e / len(ref):.1%})  mean word confidence {probs.mean():.3f}  words <0.5: {(probs < 0.5).sum()}')
    if name == 'clean':
        print('  transcript:', ' '.join(w.word.strip() for w in words))
        if srt:  # sync: first word of each cue vs cue start
            cues = re.findall(r'(\d\d):(\d\d):(\d\d),(\d+) --> .*\n(.+)', open(srt).read())
            offs = []
            for h, mi, se, ms, text in cues:
                t0 = int(h) * 3600 + int(mi) * 60 + int(se) + int(ms) / 1000
                first = norm(text)[0]
                near = [w for w in words if abs(w.start - t0) < 2.0 and norm(w.word) and norm(w.word)[0] == first]
                if near: offs.append(min((w.start - t0 for w in near), key=abs))
                else: print('  no match for cue at', t0, text)
            offs = np.array(offs)
            print(f'  subtitle sync: {len(offs)}/{len(cues)} cues matched; speech starts after cue by mean {offs.mean():.2f}s, range {offs.min():.2f}..{offs.max():.2f}s')
