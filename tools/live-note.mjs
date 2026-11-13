// Live site: open the assigned round and run one on-device note check, waiting for the real result.
import puppeteer from 'puppeteer-core';
const b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9333', defaultViewport: null, protocolTimeout: 600000 });
const page = await b.newPage();
const net = [];
page.on('response', (r) => { if (/firebasevertexai|exchangeRecaptcha/.test(r.url())) net.push(`${r.status()} ${r.url().replace(/\?.*$/, '')}`); });
const click = async (t) => (await page.waitForFunction((t) => [...document.querySelectorAll('button')].find((e) => e.textContent.includes(t) && !e.disabled) || null, { timeout: 30000 }, t)).asElement().click();
await page.goto('https://rounds-hybrid-bfb0.web.app/', { waitUntil: 'networkidle2' });
await click('Technician');
await click('→');
await page.waitForSelector('textarea', { timeout: 30000 });
await page.type('textarea', 'Gauge needle steady, no unusual noise.');
await click('Check my note (local AI)');
await page.waitForFunction(() => document.querySelector('.ai-out'), { timeout: 500000 });
const out = await page.evaluate(() => ({ note: document.querySelector('.ai-out').innerText, onLine: navigator.onLine, origin: location.origin }));
await page.screenshot({ path: '../evidence/23-live-site-on-device.png', fullPage: true });
console.log(JSON.stringify({ ...out, net }, null, 2));
await b.disconnect();
