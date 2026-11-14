// Renders the video's text graphics as 1920x1080 PNGs (transparent unless a card) with headless Chrome.
// Usage: node overlays.mjs <spec.json>   spec: [{ file, kind: 'title'|'end'|'sub'|'chip'|'caption', text, sub? }]
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const spec = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  userDataDir: path.join(os.tmpdir(), 'rounds-overlay-profile'),
  args: ['--hide-scrollbars', '--force-color-profile=srgb'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const base = `
  * { margin: 0; box-sizing: border-box; }
  html, body { width: 1920px; height: 1080px; background: transparent; font-family: -apple-system, 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased; }
`;
function html(item) {
  switch (item.kind) {
    case 'title':
      return `<style>${base}
        body { background: #121417; color: #f1f3f5; display: flex; flex-direction: column; justify-content: center; padding: 0 180px; }
        .logo { font-size: 44px; color: #6ea8fe; margin-bottom: 18px; }
        h1 { font-size: 132px; letter-spacing: -2px; font-weight: 750; }
        p { font-size: 44px; color: #c3c9d0; margin-top: 18px; max-width: 1400px; line-height: 1.3; }
        .meta { font-size: 28px; color: #8a939c; margin-top: 56px; letter-spacing: .5px; }
      </style><div class="logo">◎</div><h1>${esc(item.text)}</h1><p>${esc(item.sub ?? '')}</p><div class="meta">${esc(item.meta ?? '')}</div>`;
    case 'end':
      return `<style>${base}
        body { background: #121417; color: #f1f3f5; display: flex; flex-direction: column; justify-content: center; padding: 0 180px; }
        h1 { font-size: 104px; font-weight: 750; letter-spacing: -1.5px; }
        ul { list-style: none; padding: 0; margin-top: 40px; }
        li { font-size: 44px; color: #d5dade; margin: 14px 0; }
        li b { color: #6ea8fe; font-weight: 650; }
        .url { font-size: 36px; color: #8fd19e; margin-top: 56px; }
        .meta { font-size: 26px; color: #8a939c; margin-top: 18px; }
      </style><h1>${esc(item.text)}</h1><ul>${(item.points ?? []).map((p) => `<li>${p}</li>`).join('')}</ul><div class="url">${esc(item.url ?? '')}</div><div class="meta">${esc(item.meta ?? '')}</div>`;
    case 'sub':
      return `<style>${base}
        .wrap { position: absolute; left: 0; right: 0; bottom: 56px; display: flex; justify-content: center; }
        .box { max-width: 1500px; background: rgba(10,12,14,.78); color: #fff; font-size: 40px; line-height: 1.32; font-weight: 560; padding: 14px 30px; border-radius: 12px; text-align: center; }
      </style><div class="wrap"><div class="box">${esc(item.text)}</div></div>`;
    case 'chip':
      return `<style>${base}
        .chip { position: absolute; left: 48px; top: 120px; background: rgba(18,20,23,.86); color: #e9ecef; border: 2px solid #3b4249; font-size: 30px; font-weight: 650; padding: 10px 22px; border-radius: 999px; }
      </style><div class="chip">${esc(item.text)}</div>`;
    case 'caption':
      return `<style>${base}
        .cap { position: absolute; right: 48px; top: 120px; background: rgba(255,214,102,.95); color: #1b1b1b; font-size: 30px; font-weight: 680; padding: 12px 24px; border-radius: 12px; }
      </style><div class="cap">${esc(item.text)}</div>`;
  }
}
for (const item of spec) {
  await page.setContent(html(item), { waitUntil: 'load' });
  await page.screenshot({ path: item.file, omitBackground: !['title', 'end'].includes(item.kind) });
}
await browser.close();
console.log('rendered', spec.length);
