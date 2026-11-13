// Drive the app in the test Chrome profile (remote debugging on :9333) with real mouse/keyboard
// input. Used to capture evidence of actual behaviour; it never fakes model output.
// Usage: node ui.mjs '<json array of steps>'
// Steps: {goto:url} {click:"button text"} {clickSel:"css"} {type:{sel,text}} {wait:ms}
//        {waitText:"text", timeout?} {shot:"file.png"} {text:true} {offline:true|false} {eval:"js"}
import puppeteer from 'puppeteer-core';

const steps = JSON.parse(process.argv[2]);
const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9333', defaultViewport: null });
let page = (await browser.pages()).find((p) => p.url().startsWith('http://localhost:5173'));
if (!page) page = await browser.newPage();
page.on('console', (m) => { if (['error', 'warn'].includes(m.type())) console.log('[page]', m.type(), m.text().slice(0, 300)); });
const cdp = await page.createCDPSession();

async function clickText(t) {
  const h = await page.waitForFunction((t) => {
    const els = [...document.querySelectorAll('button, [role=tab], a, label, summary')];
    return els.find((e) => e.textContent.trim().includes(t) && !e.disabled && e.offsetParent !== null) || null;
  }, { timeout: 15000 }, t);
  await h.asElement().click();
}

for (const s of steps) {
  if (s.goto) await page.goto(s.goto, { waitUntil: 'networkidle2' });
  else if (s.click) await clickText(s.click);
  else if (s.clickSel) await (await page.waitForSelector(s.clickSel)).click();
  else if (s.type) { const el = await page.waitForSelector(s.type.sel); await el.click(); await page.keyboard.down("Meta"); await page.keyboard.press("a"); await page.keyboard.up("Meta"); await page.keyboard.press("Backspace"); await el.type(s.type.text); }
  else if (s.wait) await new Promise((r) => setTimeout(r, s.wait));
  else if (s.waitText) await page.waitForFunction((t) => document.body.innerText.toLowerCase().includes(t.toLowerCase()), { timeout: s.timeout ?? 60000 }, s.waitText);
  else if (s.shot) await page.screenshot({ path: s.shot, fullPage: !!s.full });
  else if (s.text) console.log(await page.evaluate(() => document.body.innerText));
  else if (s.offline !== undefined) {
    await cdp.send('Network.emulateNetworkConditions', { offline: s.offline, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    console.log('network offline =', s.offline);
  } else if (s.eval) console.log(JSON.stringify(await page.evaluate(`(async () => { ${s.eval} })()`), null, 2));
}
await browser.disconnect();
