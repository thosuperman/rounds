#!/usr/bin/env python3
"""Assemble Rounds_Final_Demo_1080p.mp4 from the real recordings, narration and overlays.

Every frame of app footage comes from raw/<scene>.webm (real runs). Long AI waits are cut, and a
caption states the real measured duration. Narration lines (Kokoro TTS, see voice.py) start at\nper-line anchors in each scene; subtitles are split at word timings measured by asr_lines.py.
"""
import json, os, subprocess, sys, math

FPS = 30
W, H = 1920, 1080
MIN_GAP, GAP_SCENE = 0.5, 0.8
TITLE, END = 3.5, 4.5

os.makedirs('build', exist_ok=True)
os.makedirs('overlays', exist_ok=True)
narr = json.load(open('narration.timed.json'))['scenes']
plan = json.load(open('plan.json'))  # per scene: segments [[a,b],...] in raw seconds, chip, captions


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode:
        print(' '.join(cmd)); print(r.stderr[-3000:]); sys.exit(1)
    return r.stdout


def dur(path):
    return float(run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path]).strip())


# 1. Normalise raw recordings to CFR 1080p.
for s in narr:
    src, mid, dst = f"raw/{s['id']}.webm", f"build/{s['id']}_cfr.mp4", f"build/{s['id']}.mp4"
    if not os.path.exists(mid) or os.path.getmtime(mid) < os.path.getmtime(src):
        run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-vf', f'fps={FPS},scale={W}:{H}:flags=lanczos,format=yuv420p',
             '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', '-an', mid])
    if not os.path.exists(dst) or os.path.getmtime(dst) < os.path.getmtime(mid):
        # The screencast's clock runs ~20% long; retime the clip to the real wall-clock length of the
        # scene (from the event log) so footage plays at real speed and matches logged event times.
        ev = json.load(open(f"raw/{s['id']}.events.json"))
        wall = ev[-1]['t'] + 0.3
        k = dur(mid) / wall
        run(['ffmpeg', '-v', 'error', '-y', '-i', mid, '-vf', f'setpts=PTS/{k:.5f},fps={FPS}',
             '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', '-an', dst])
        print(f"{s['id']}: retimed by {k:.3f} to {wall:.1f}s")

# 2. Timeline: title, scenes, end card. Each line starts at its anchor in the scene (the moment its
# action is on screen) or MIN_GAP after the previous line, whichever is later. A scene keeps its full
# footage; if the narration runs past it, the last frame is held.
timeline, subs, t = [], [], TITLE
overlay_spec = []
for s in narr:
    p = plan[s['id']]
    start, prev_end, lines_t = t, -1e9, []
    for i, (line, d) in enumerate(zip(s['lines'], s['durs'])):
        lt = max(start + s['at'][i], prev_end + MIN_GAP)
        timeline.append(('audio', lt, f"audio/{s['id']}_{i}.wav"))
        lines_t.append((lt, d)); prev_end = lt + d
    for i, (line, (lt, d)) in enumerate(zip(s['lines'], lines_t)):
        words, ww = line.split(), s['words'][i]
        cut = None
        if len(words) > 12 and len(ww) == len(words):
            mid = len(words) / 2  # split at the sentence or comma break closest to the middle
            for marks in ('.?:', ','):
                cands = [j for j in range(3, len(words) - 2) if words[j - 1][-1] in marks]
                if cands:
                    cut = min(cands, key=lambda j: abs(j - mid)); break
        nxt = lines_t[i + 1][0] if i + 1 < len(lines_t) else lt + d + 0.8
        end = min(nxt - 0.05, lt + d + 0.5)
        if cut:
            tc = lt + (ww[cut - 1][2] + ww[cut][1]) / 2
            subs.append((lt, tc, ' '.join(words[:cut]), None)); subs.append((tc, end, ' '.join(words[cut:]), None))
        else:
            subs.append((lt, end, line, None))
    scene_len = max(s['footage'], prev_end - start + GAP_SCENE)
    timeline.append(('scene', start, s['id'], scene_len))
    if p.get('chip'):
        timeline.append(('overlay', start, start + scene_len, f"overlays/chip_{s['id']}.png"))
        overlay_spec.append({'file': f"overlays/chip_{s['id']}.png", 'kind': 'chip', 'text': p['chip']})
    for ci, c in enumerate(p.get('captions', [])):
        f = f"overlays/cap_{s['id']}_{ci}.png"
        overlay_spec.append({'file': f, 'kind': 'caption', 'text': c['text']})
        # caption times are relative to the scene's edited footage
        timeline.append(('overlay', start + c['at'], start + c['at'] + c['len'], f))
    t = start + scene_len
total = t + END

for i, (a, b, text, _) in enumerate(subs):
    overlay_spec.append({'file': f'overlays/sub_{i:02d}.png', 'kind': 'sub', 'text': text})
overlay_spec += [
    {'file': 'overlays/title.png', 'kind': 'title', 'text': 'Rounds',
     'sub': 'Offline inspection rounds with hybrid AI: Gemini in the cloud, Gemini Nano on the device, through Firebase AI Logic.',
     'meta': 'Real app, real runs · fictional demo equipment · not for real safety use'},
    {'file': 'overlays/end.png', 'kind': 'end', 'text': 'Rounds',
     'points': ['<b>Cloud</b> prepares the knowledge', '<b>Device</b> helps offline', '<b>Approved rules</b> decide what is safe'],
     'url': 'rounds.hayaix.tech', 'meta': 'Built with Firebase AI Logic · #BuildHybridAI 2026'},
]
json.dump(overlay_spec, open('build/overlays.json', 'w'), indent=1)
run(['node', 'overlays.mjs', 'build/overlays.json'])

# 3. Build each scene's footage to its exact length.
scene_files = []
for kind, start, sid, length in [x for x in timeline if x[0] == 'scene']:
    p = plan[sid]
    src = f'build/{sid}.mp4'
    rawlen = dur(src)
    parts = []
    for k, seg in enumerate(p['segments']):
        a, b = seg[0], min(seg[1], rawlen)
        speed = seg[2] if len(seg) > 2 else 1.0
        out = f'build/{sid}_seg{k}.mp4'
        vf = f'setpts=(PTS-STARTPTS)/{speed},fps={FPS}' if speed != 1.0 else f'setpts=PTS-STARTPTS,fps={FPS}'
        run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{a:.3f}', '-to', f'{b:.3f}', '-i', src, '-vf', vf, '-c:v', 'libx264', '-preset', 'medium',
             '-crf', '14', '-an', out])
        parts.append(out)
    lst = f'build/{sid}_list.txt'
    open(lst, 'w').write(''.join(f"file '{os.path.basename(x)}'\n" for x in parts))
    joined = f'build/{sid}_joined.mp4'
    run(['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', lst, '-c', 'copy', joined])
    jl = dur(joined)
    fitted = f'build/{sid}_fit.mp4'
    pad = max(0.0, length - jl)
    run(['ffmpeg', '-v', 'error', '-y', '-i', joined, '-vf', f'tpad=stop_mode=clone:stop_duration={pad:.3f}',
         '-t', f'{length:.3f}', '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', '-r', str(FPS), fitted])
    print(f'{sid}: footage {jl:5.1f}s  narration slot {length:5.1f}s  freeze {pad:4.1f}s  trimmed {max(0, jl - length):4.1f}s')
    scene_files.append(fitted)

# cards
for name, d in (('title', TITLE), ('end', END)):
    run(['ffmpeg', '-v', 'error', '-y', '-loop', '1', '-i', f'overlays/{name}.png', '-t', f'{d}', '-r', str(FPS),
         '-vf', 'format=yuv420p', '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', f'build/{name}.mp4'])
open('build/all_list.txt', 'w').write(''.join(f"file '{os.path.basename(x)}'\n" for x in ['build/title.mp4'] + scene_files + ['build/end.mp4']))
run(['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', 'build/all_list.txt', '-c', 'copy', 'build/video_noov.mp4'])

# 4. Overlays (chips, captions, subtitles) with enable windows.
ovs = [(x[1], x[2], x[3]) for x in timeline if x[0] == 'overlay'] + [(a, b, f'overlays/sub_{i:02d}.png') for i, (a, b, _, _) in enumerate(subs)]
inputs, chain, last = ['-i', 'build/video_noov.mp4'], [], '0:v'
for i, (a, b, f) in enumerate(ovs):
    inputs += ['-i', f]
    out = f'v{i}'
    chain.append(f"[{last}][{i + 1}:v]overlay=0:0:enable='between(t,{a:.3f},{b:.3f})'[{out}]")
    last = out
open('build/filter.txt', 'w').write(';\n'.join(chain))

# 5. Narration track: each line placed at its start time.
ain, amix = [], []
lines = [x for x in timeline if x[0] == 'audio']
for i, (_, st, f) in enumerate(lines):
    ain += ['-i', f]
    amix.append(f'[{i}:a]aresample=48000,adelay={int(st * 1000)}|{int(st * 1000)}[a{i}]')
amix.append(''.join(f'[a{i}]' for i in range(len(lines))) + f'amix=inputs={len(lines)}:normalize=0,apad=whole_dur={total:.3f},loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000,aformat=channel_layouts=stereo[aout]')
open('build/afilter.txt', 'w').write(';\n'.join(amix))
run(['ffmpeg', '-v', 'error', '-y', *ain, '-/filter_complex', 'build/afilter.txt', '-map', '[aout]', '-t', f'{total:.3f}', '-c:a', 'pcm_s16le', 'build/narration.wav'])

run(['ffmpeg', '-v', 'error', '-y', *inputs, '-i', 'build/narration.wav', '-/filter_complex', 'build/filter.txt',
     '-map', f'[{last}]', '-map', f'{len(ovs) + 1}:a', '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p',
     '-r', str(FPS), '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-t', f'{total:.3f}', 'Rounds_Final_Demo_1080p.mp4'])


# 6. SRT.
def ts(x):
    ms = int(round(x * 1000)); return f'{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}'


with open('Rounds_Subtitles.srt', 'w') as f:
    for i, (a, b, text, _) in enumerate(subs, 1):
        f.write(f'{i}\n{ts(a)} --> {ts(b)}\n{text}\n\n')
json.dump({'total': total, 'subs': [(a, b, x) for a, b, x, _ in subs], 'timeline': [x for x in timeline]}, open('build/timeline.json', 'w'), indent=1)
print(f'total {total:.1f}s')
