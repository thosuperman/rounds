// Records the real Rounds app, scene by scene, in the test Chrome profile (CDP :9333).
// Every result on screen comes from the running app: real cloud calls, real on-device calls,
// real offline emulation. Timestamps of key events are logged so long waits can be cut and
// labelled honestly in the edit. Usage: node record.mjs [fromScene]
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const APP = 'http://localhost:5173/';
const from = process.argv[2] ?? 's1';
const b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9333', defaultViewport: null, protocolTimeout: 900000 });
let page = (await b.pages()).find((p) => p.url().startsWith(APP));
if (!page) page = await b.newPage();
await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1.5 });
const cdp = await page.createCDPSession();

// Visual cursor that follows real mouse events (the screencast does not include the OS cursor).
await page.evaluateOnNewDocument(() => {
  const add = () => {
    if (document.getElementById('__cursor')) return;
    const c = document.createElement('div');
    c.id = '__cursor';
    c.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M3 2l7 19 2.5-7.5L20 11z" fill="#fff" stroke="#111" stroke-width="1.5" stroke-linejoin="round"/></svg>';
    Object.assign(c.style, { position: 'fixed', left: '0', top: '0', zIndex: '2147483647', pointerEvents: 'none', transform: 'translate(-100px,-100px)', transition: 'transform 0.02s linear', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.5))' });
    document.documentElement.appendChild(c);
    addEventListener('mousemove', (e) => (c.style.transform = `translate(${e.clientX - 3}px,${e.clientY - 2}px)`), true);
    addEventListener('mousedown', () => (c.firstChild.style.transform = 'scale(0.85)'), true);
    addEventListener('mouseup', () => (c.firstChild.style.transform = ''), true);
  };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', add);
  else add();
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let mouse = { x: 640, y: 400 };
let events = [];
let t0 = 0;
const mark = (name, extra = {}) => {
  const e = { name, t: +((Date.now() - t0) / 1000).toFixed(2), ...extra };
  events.push(e);
  console.log('  ', e.t.toFixed(1), name, Object.keys(extra).length ? JSON.stringify(extra) : '');
};

async function findByText(text, sel = 'button, [role=tab], label, summary') {
  const h = await page.waitForFunction(
    (t, s) => [...document.querySelectorAll(s)].find((e) => e.textContent.trim().includes(t) && !e.disabled && e.offsetParent !== null) || null,
    { timeout: 60000 }, text, sel,
  );
  return h.asElement();
}
async function moveTo(el) {
  await el.evaluate((e) => e.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  await sleep(700);
  // wait until smooth scrolling has settled so the click lands where the element really is
  let box = await el.boundingBox();
  for (let i = 0; i < 10; i++) {
    await sleep(120);
    const nb = await el.boundingBox();
    if (nb && box && Math.abs(nb.y - box.y) < 0.5) break;
    box = nb;
  }
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await page.mouse.move(x, y, { steps: 28 });
  mouse = { x, y };
  await sleep(250);
}
async function click(target, sel) {
  const el = typeof target === 'string' ? await findByText(target, sel) : target;
  await moveTo(el);
  await page.mouse.down(); await sleep(90); await page.mouse.up();
  await sleep(400);
}
async function type(selector, text) {
  const el = await page.waitForSelector(selector, { visible: true });
  await moveTo(el);
  await page.mouse.down(); await sleep(60); await page.mouse.up();
  await page.keyboard.down('Meta'); await page.keyboard.press('a'); await page.keyboard.up('Meta');
  await page.keyboard.press('Backspace');
  await page.keyboard.type(text, { delay: 55 });
  await sleep(300);
}
const waitText = (t, timeout = 60000) =>
  page.waitForFunction((t) => document.body.innerText.toLowerCase().includes(t.toLowerCase()), { timeout }, t);
const waitSel = (s, timeout = 60000) => page.waitForSelector(s, { timeout, visible: true });
async function scrollBy(dy) {
  await page.evaluate((dy) => window.scrollBy({ top: dy, behavior: 'smooth' }), dy);
  await sleep(1100);
}
async function scrollToEl(el) {
  await el.evaluate((e) => e.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  await sleep(1100);
}
async function offline(on) {
  await cdp.send('Network.emulateNetworkConditions', { offline: on, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
}

async function scene(id, fn) {
  console.log('scene', id);
  const rec = await page.screencast({ path: `raw/${id}.webm`, fps: 30, quality: 8 });
  t0 = Date.now(); events = [];
  try {
    await fn();
  } finally {
    mark('end');
    await sleep(300);
    await rec.stop();
    fs.writeFileSync(`raw/${id}.events.json`, JSON.stringify(events, null, 1));
  }
}

const order = ['s1', 's2', 's3', 'setup', 's4', 's5', 's6', 's7'];
const run = (id) => order.indexOf(id) >= order.indexOf(from);

// ---------------------------------------------------------------- clean start
if (from === 's1') {
  await offline(false);
  await page.goto('about:blank');
  await cdp.send('Storage.clearDataForOrigin', { origin: 'http://localhost:5173', storageTypes: 'all' });
  await page.goto(APP, { waitUntil: 'networkidle2' });
  await waitText('Procedure packs', 30000).catch(() => {});
  if (!(await page.evaluate(() => document.body.innerText.includes('Procedure packs')))) {
    await (await findByText('Supervisor')).click();
  }
  await waitText('No packs yet', 30000);
  await page.mouse.move(900, 380);
  await sleep(1500);
}

// S1: the supervisor's empty workspace
if (run('s1')) await scene('s1', async () => {
  mark('start');
  await sleep(2500);
  await page.mouse.move(1000, 46, { steps: 30 }); // toward status pills
  await sleep(2500);
  await page.mouse.move(200, 130, { steps: 30 });
  await sleep(2000);
  await page.mouse.move(1100, 160, { steps: 25 });
  await sleep(10000);
});

// S2: cloud compile
if (run('s2')) await scene('s2', async () => {
  mark('start');
  await click('Compile a manual');
  await sleep(800);
  await click('Use demo manual');
  await sleep(1200);
  const tag = await page.$('.card .tag, .card [class*=tag]');
  if (tag) await moveTo(tag);
  await sleep(1500);
  await scrollBy(320);
  await sleep(1500);
  await scrollBy(-320);
  await click('Compile with cloud AI');
  mark('compile_click');
  await waitText('Compiling in the cloud', 5000).catch(() => {});
  await sleep(2500);
  mark('waiting');
  await waitText('awaiting approval', 300000);
  mark('compile_done', {
    label: await page.evaluate(() => document.body.innerText.match(/Compiled by\s*\n?\s*(Cloud AI · [\d.]+s)/)?.[1] ?? null),
  });
  await page.evaluate(() => window.scrollTo({ top: 0 }));
  await sleep(4000);
  const badge = await page.$('.badge.src-IN_CLOUD');
  if (badge) await moveTo(badge);
  await sleep(4000);
});

// S3: review, exclude the flagged paraphrase, approve, publish
if (run('s3')) await scene('s3', async () => {
  mark('start');
  const flagged = await page.evaluate(() => [...document.querySelectorAll('.item')].filter((x) => /not verbatim/.test(x.innerText)).length);
  mark('flagged_count', { flagged });
  const firstItem = await page.$('.item .verified');
  if (firstItem) { await moveTo(firstItem); await sleep(2000); }
  await scrollBy(420);
  await sleep(1500);
  for (let i = 0; i < 6; i++) {
    const h = await page.evaluateHandle(() => [...document.querySelectorAll('.item')].find((x) => /not verbatim/.test(x.innerText) && !x.classList.contains('item-out')) || null);
    const it = h.asElement();
    if (!it) break;
    await scrollToEl(it);
    await sleep(1800);
    const btn = (await it.$$('button')).at(-1);
    await click(btn);
    mark('excluded');
    await sleep(1500);
  }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await sleep(1200);
  await click('Approve all items with no findings');
  mark('approved_all');
  await sleep(1500);
  const pub = await findByText('Publish approved pack');
  await scrollToEl(pub);
  await sleep(1200);
  await click(pub);
  await waitText('Approved by', 30000);
  mark('published');
  await sleep(3500);
});

// Off camera: seed labelled synthetic history and assign the round.
if (run('setup')) {
  console.log('setup (not recorded)');
  await page.evaluate(() => window.scrollTo({ top: 0 }));
  const back = await findByText('← Packs').catch(() => null);
  if (back) await back.click();
  await sleep(1500);
  await (await findByText('Seed demo history')).click();
  await sleep(2500);
  await (await findByText('Assign round')).click();
  await sleep(2000);
  await page.evaluate(() => window.scrollTo({ top: 0 }));
}

// S4: technician, offline, on-device note check
if (run('s4')) await scene('s4', async () => {
  mark('start');
  await click('Technician');
  await sleep(1200);
  await click('Start →');
  await waitText('cached for offline', 30000);
  mark('cached');
  await sleep(2500);
  await offline(true);
  await waitText('offline — will queue', 10000);
  mark('offline');
  await page.mouse.move(870, 46, { steps: 25 });
  await sleep(2500);
  await type('.reading-input', '4.1');
  await click('Record reading');
  await sleep(1500);
  await type('textarea', 'Faint rattling near the pump. Gauge needle steady.');
  await click('Check my note (local AI)');
  mark('note_click');
  await sleep(4000);
  mark('waiting');
  await page.waitForFunction(() => document.querySelector('.ai-out'), { timeout: 400000 });
  const out = await page.evaluate(() => document.querySelector('.ai-out').innerText);
  mark('note_done', { out, onLine: await page.evaluate(() => navigator.onLine) });
  const ai = await page.$('.ai-out');
  await scrollToEl(ai);
  await sleep(1000);
  const badge = await page.$('.ai-out .badge');
  if (badge) await moveTo(badge);
  await sleep(6000);
});

// S5: abnormal reading, rules decide
if (run('s5')) await scene('s5', async () => {
  mark('start');
  await click('Next step →');
  await sleep(1200);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await sleep(1000);
  await type('.reading-input', '82');
  await click('Record reading');
  mark('recorded');
  await sleep(1500);
  const rr = await page.$('.rule-result');
  if (rr) { await scrollToEl(rr); await moveTo(rr); }
  await sleep(5000);
  const rep = await page.$('.repeat-text');
  mark('repeat_banner', { shown: !!rep });
  if (rep) { await scrollToEl(rep); await moveTo(rep); }
  await sleep(6000);
});

// S6: vibration, consented escalation queued offline, then reconnect and cloud review
if (run('s6')) await scene('s6', async () => {
  mark('start');
  await click('Next step →');
  await sleep(1200);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await sleep(800);
  await type('.reading-input', '5.2');
  await click('Record reading');
  await sleep(1500);
  await type('textarea', 'Squeal near the drive end bearing, louder than last shift.');
  await click('Request detailed cloud analysis');
  await waitText('Send to cloud review?', 10000);
  mark('consent');
  await sleep(2500);
  await page.evaluate(() => { const t = document.querySelector('.modal textarea'); t.scrollTo({ top: t.scrollHeight, behavior: 'smooth' }); });
  await sleep(3000);
  await click('Queue for later');
  mark('queued');
  await sleep(1200);
  const q = await page.$('.queued');
  if (q) { await scrollToEl(q); await moveTo(q); }
  await sleep(1500);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await page.mouse.move(950, 46, { steps: 25 });
  mark('sync_pill', { text: await page.evaluate(() => document.querySelector('.topbar')?.innerText.replace(/\n/g, ' | ')) });
  await sleep(3000);
  await offline(false);
  mark('online');
  await waitText('Synced', 60000);
  mark('synced');
  await page.waitForFunction(() => /cloud review ·/i.test(document.body.innerText), { timeout: 180000 });
  mark('review_done');
  const res = await page.evaluateHandle(() => [...document.querySelectorAll('.card')].find((c) => /Cloud review ·/i.test(c.innerText)));
  const el = res.asElement();
  if (el) await scrollToEl(el);
  await sleep(1200);
  const badge = el && (await el.$('.badge.src-IN_CLOUD'));
  if (badge) await moveTo(badge);
  await sleep(7000);
  await scrollBy(250);
  await sleep(3000);
});

// S7: complete the round, on-device handover
if (run('s7')) await scene('s7', async () => {
  mark('start');
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await sleep(1200);
  await click('Next step →');
  await waitText('Save step', 15000);
  await sleep(800);
  await type('textarea', 'Seal dry, no drips.');
  await click('Save step');
  await sleep(1200);
  await click('Complete round');
  mark('complete_click');
  await sleep(3000);
  mark('waiting');
  await waitText('Shift handovers', 400000);
  await sleep(1500);
  mark('handover_done', { text: await page.evaluate(() => document.querySelector('.card')?.innerText.slice(0, 400)) });
  const badge = await page.$('.card .badge');
  if (badge) await moveTo(badge);
  await sleep(5000);
  await scrollBy(300);
  await sleep(5000);
  await scrollBy(300);
  await sleep(5000);
});

await b.disconnect();
console.log('done');
