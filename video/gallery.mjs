// Devpost thumbnail and gallery images (3:2) from real frames of the demo recording.
// Usage: node gallery.mjs   (reads build/stills/*.png and ../docs/architecture.png, writes ../docs/devpost/)
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const OUT = '../docs/devpost';
fs.mkdirSync(OUT, { recursive: true });
const img = (f) => `data:image/png;base64,${fs.readFileSync(f).toString('base64')}`;
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

// [file, still, step label, headline, sub-headline, tag kind]
const SHOTS = [
  ['02-cloud-compile', 'build/stills/s2_168.png', '1', 'Cloud AI compiles the manual', 'Gemini via Firebase AI Logic (ONLY_IN_CLOUD) · 149 s · every limit must quote the manual', 'cloud'],
  ['03-supervisor-review', 'build/stills/s3_13.png', '2', 'The supervisor approves every item', 'A safety line the AI paraphrased is flagged and excluded before publishing', 'human'],
  ['04-offline-on-device', 'build/stills/s4_99.png', '3', 'Offline: Gemini Nano checks the note on the device', 'PREFER_ON_DEVICE · network off · 69.4 s · source from response.inferenceSource', 'dev'],
  ['05-rule-alarm', 'build/stills/s5_16.png', '4', 'Rules, not AI, judge the reading', '82 °C ≥ 80 °C alarm limit · manual quote · approved escalation rules · repeat deviation', 'rule'],
  ['06-consent', 'build/stills/s6_24.png', '5', 'Consent before anything goes to the cloud', 'The technician sees the exact text to be sent and queues it while offline', 'consent'],
  ['07-cloud-review', 'build/stills/s6_52.png', '6', 'Back online: Gemini reviews in the cloud', 'The queued request runs after reconnecting (3.0 s) · Synced · advisory only', 'cloud'],
  ['08-handover', 'build/stills/s7_66.png', '7', 'On-device handover over rule-checked facts', 'Gemini Nano drafts the summary (49.1 s) · the measurements table comes from rules', 'dev'],
];
const TAG = { cloud: ['CLOUD AI', '#103a66', '#bfe0ff'], dev: ['ON-DEVICE AI', '#3b2a6b', '#d9c9ff'], rule: ['RULES · NO AI', '#2b3036', '#e9ecef'], human: ['HUMAN APPROVAL', '#5a4310', '#ffe3a3'], consent: ['USER CONSENT', '#2b3036', '#e9ecef'], hyb: ['ON-DEVICE + CLOUD', '#2b3036', '#e9ecef'] };

const base = `*{margin:0;box-sizing:border-box} body{background:#121417;color:#f1f3f5;font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;overflow:hidden;position:relative}`;
const band = (n, h, sub, kind) => `
  <div class="band"><div class="n">${n}</div><div><h1>${esc(h)}</h1><p>${esc(sub)}</p></div>
  <span class="tag" style="background:${TAG[kind][1]};color:${TAG[kind][2]}">${TAG[kind][0]}</span></div>`;
const bandCss = `.band{height:200px;display:flex;align-items:center;gap:28px;padding:0 56px;border-bottom:2px solid #262b31;position:relative}
  .n{flex:none;width:76px;height:76px;border-radius:50%;background:#1f6feb;color:#fff;font-size:40px;font-weight:800;display:flex;align-items:center;justify-content:center}
  h1{font-size:50px;font-weight:750;letter-spacing:-.5px} p{font-size:28px;color:#aab3bc;margin-top:10px}
  .tag{position:absolute;right:56px;top:28px;font-size:22px;font-weight:750;padding:6px 16px;border-radius:999px;letter-spacing:.5px}`;

const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
  userDataDir: path.join(os.tmpdir(), 'rounds-overlay-profile'), args: ['--force-color-profile=srgb'] });
const p = await b.newPage();
async function render(file, w, h, html) {
  await p.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await p.setContent(html, { waitUntil: 'load' });
  await p.screenshot({ path: `${OUT}/${file}.png` });
}

// App screens: 1920x1280 = caption band (200) + full 1920x1080 frame.
for (const [file, still, n, h, sub, kind] of SHOTS) {
  await render(file, 1920, 1280, `<style>${base} body{width:1920px;height:1280px} ${bandCss} .shot{display:block;width:1920px;height:1080px}</style>
    ${band(n, h, sub, kind)}<img class="shot" src="${img(still)}">`);
}

// Ledger: full-page capture, scaled into the 1080 area.
await render('09-hybrid-ledger', 1920, 1280, `<style>${base} body{width:1920px;height:1280px;background:#17191b} ${bandCss}
  .wrap{height:1080px;background:#17191b;display:flex;justify-content:center;align-items:flex-start;padding-top:12px} .wrap img{height:1060px;object-fit:cover;object-position:top;width:${Math.round(1898 * 1060 / 1810)}px}</style>
  ${band('8', 'Hybrid ledger: every AI call and its real source', 'This session: 2 on-device, 2 cloud, 0 failed · rules for readings, AI for notes and reviews', 'hyb')}
  <div class="wrap"><img src="${img('build/stills/ledger_full.png')}"></div>`);

// Architecture: diagram on its own light background, 3:2.
await render('01-architecture', 2400, 1600, `<style>${base} body{width:2400px;height:1600px;background:#f4f4f2;display:flex;align-items:center;justify-content:center}
  img{width:2360px}</style><img src="${img('../docs/architecture.png')}">`);

// Thumbnail 3:2 (Devpost project thumbnail).
await render('00-thumbnail', 1500, 1000, `<style>${base} body{width:1500px;height:1000px}
  .shot{position:absolute;right:48px;top:150px;width:800px;border-radius:18px;box-shadow:0 24px 70px rgba(0,0,0,.6);border:2px solid #2c3238;overflow:hidden}
  .shot div{width:800px;height:560px;background:url(${img('build/stills/s4_99.png')}) no-repeat;background-size:1200px 675px;background-position:-200px 0}
  .txt{position:absolute;left:64px;top:150px;width:560px}
  h1{font-size:120px;font-weight:800;letter-spacing:-3px}
  .tag{display:inline-block;margin:22px 10px 0 0;font-size:32px;font-weight:750;padding:9px 20px;border-radius:999px}
  .dev{background:#3b2a6b;color:#d9c9ff}.cloud{background:#103a66;color:#bfe0ff}.off{background:#5c1a1d;color:#ffc9cc}
  p{font-size:38px;line-height:1.25;color:#d5dade;margin-top:34px;font-weight:650}
  .foot{position:absolute;left:64px;bottom:64px;font-size:26px;color:#8a939c}</style>
  <div class="shot"><div></div></div>
  <div class="txt"><h1>Rounds</h1>
   <div><span class="tag off">OFFLINE</span><span class="tag dev">ON-DEVICE AI</span></div><div><span class="tag cloud">CLOUD AI</span></div>
   <p>Hybrid AI for inspection rounds. Approved rules decide what is safe.</p></div>
  <div class="foot">Firebase AI Logic · Gemini + Gemini Nano · #BuildHybridAI 2026</div>`);
await b.close();
console.log('done');
