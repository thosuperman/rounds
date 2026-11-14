// YouTube thumbnail (1280x720) from a real frame of the app (on-device result, offline).
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const bg = fs.readFileSync('build/thumb_bg.png').toString('base64');
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
  userDataDir: path.join(os.tmpdir(), 'rounds-overlay-profile') });
const p = await b.newPage();
await p.setViewport({ width: 1280, height: 720 });
await p.setContent(`<style>
 *{margin:0;box-sizing:border-box} body{width:1280px;height:720px;background:#121417;font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;color:#f1f3f5;overflow:hidden;position:relative}
 .shot{position:absolute;right:36px;top:60px;width:700px;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.6);border:2px solid #2c3238;overflow:hidden}
 .shot img{width:100%;display:block}
 .txt{position:absolute;left:56px;top:70px;width:460px}
 h1{font-size:92px;font-weight:800;letter-spacing:-2px}
 .tag{display:inline-block;margin-top:22px;font-size:30px;font-weight:700;padding:8px 18px;border-radius:999px}
 .dev{background:#3b2a6b;color:#d9c9ff}.cloud{background:#103a66;color:#bfe0ff}.off{background:#5c1a1d;color:#ffc9cc}
 p{font-size:32px;line-height:1.25;color:#d5dade;margin-top:28px;font-weight:600}
</style><div class="shot"><img src="data:image/png;base64,${bg}"></div>
<div class="txt"><h1>Rounds</h1>
<div><span class="tag off">OFFLINE</span> <span class="tag dev">ON-DEVICE AI</span></div>
<div><span class="tag cloud">CLOUD AI</span></div>
<p>Hybrid AI for inspection rounds. Approved rules decide what is safe.</p></div>`);
await p.screenshot({ path: 'Rounds_Thumbnail_1280x720.png' });
await b.close();
