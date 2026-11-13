// Live-site smoke check: real UI on the deployed app, logging App Check, Firestore and AI Logic responses.
import puppeteer from 'puppeteer-core';
const URL = process.argv[2] ?? 'https://rounds-hybrid-bfb0.web.app/';
const b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9333', defaultViewport: null, protocolTimeout: 600000 });
const page = (await b.pages()).find((x) => x.url().includes('web.app')) ?? (await b.newPage());
const seen = [];
page.on('response', (r) => {
  const u = r.url();
  if (/exchangeRecaptcha|exchangeDebug|firebasevertexai|recaptcha\/enterprise\.js|firestore\.googleapis\.com\/google\.firestore\.v1\.Firestore\/Write/.test(u))
    seen.push(`${r.status()} ${u.replace(/\?.*$/, '').replace(/(apps\/)[^:]+:[^/]+/, '$1…')}`);
});
page.on('console', (m) => { if (m.type() === 'error') seen.push(`[console] ${m.text().slice(0, 200)}`); });
const click = async (t) => (await page.waitForFunction((t) => [...document.querySelectorAll('button')].find((e) => e.textContent.includes(t) && !e.disabled) || null, { timeout: 30000 }, t)).asElement().click();
const waitText = (t, timeout = 60000) => page.waitForFunction((t) => document.body.innerText.toLowerCase().includes(t.toLowerCase()), { timeout }, t);
const resume = process.argv.includes('--resume');
if (!resume) {
  await page.goto(URL, { waitUntil: 'networkidle2' });
  await waitText('Procedure packs', 30000).catch(() => {});
  await click('Supervisor');
  await click('Compile a manual');
  await click('Use demo manual');
  await click('Compile with cloud AI');
}
await waitText('awaiting approval', 300000);
const compiled = await page.evaluate(() => document.body.innerText.match(/Compiled by\s*\n?\s*(Cloud[^\n]*)/)?.[1]);
await click('Approve all items with no findings');
await new Promise((r) => setTimeout(r, 800));
// exclude any flagged item so publish is possible
// Exclude flagged items one at a time, as a person would (one click per render).
for (let i = 0; i < 10; i++) {
  const clicked = await page.evaluate(() => {
    const it = [...document.querySelectorAll('.item')].find((x) => /not verbatim/.test(x.innerText) && !x.classList.contains('item-out'));
    const btn = it && [...it.querySelectorAll('button')].find((b) => b.innerText === 'Exclude');
    if (btn) btn.click();
    return !!btn;
  });
  if (!clicked) break;
  await new Promise((r) => setTimeout(r, 600));
}
seen.push('gate: ' + (await page.evaluate(() => document.body.innerText.match(/\d+ item\(s\) awaiting[^\n]*/)?.[0])));
await click('Publish approved pack');
await waitText('Approved by', 30000);
await click('← Packs');
await click('Assign round');
await new Promise((r) => setTimeout(r, 1000));
await click('Technician');
await click('Start →');
await waitText('cached for offline', 30000);
const deviceLabel = await page.evaluate(() => document.querySelector('.topbar')?.innerText);
await page.type('textarea', 'Gauge needle steady, no unusual noise.');
await click('Check my note (local AI)');
await waitText('AI suggestion', 300000);
const note = await page.evaluate(() => document.querySelector('.ai-out')?.innerText);
await page.screenshot({ path: '../evidence/23-live-site-on-device.png', fullPage: true });
console.log(JSON.stringify({ url: page.url(), compiled, deviceLabel, note, network: seen }, null, 2));
await page.close();
await b.disconnect();
