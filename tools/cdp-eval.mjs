// Evaluate a JS expression in the test Chrome profile (remote debugging on :9333).
// Usage: node cdp-eval.mjs <url> <js-file-or-expression> [--click]
// --click performs a real mouse click on the page first (grants user activation,
// which Chrome requires before downloading the on-device model).
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const [url, exprArg, ...flags] = process.argv.slice(2);
const expr = fs.existsSync(exprArg) ? fs.readFileSync(exprArg, 'utf8') : exprArg;
const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9333', defaultViewport: null });
let page = (await browser.pages()).find((p) => p.url().startsWith(url));
if (!page) {
  page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle2' });
}
page.on('console', (m) => console.log('[page]', m.type(), m.text()));
if (flags.includes('--click')) await page.mouse.click(5, 5);
const result = await page.evaluate(`(async () => { ${expr} })()`);
console.log(JSON.stringify(result, null, 2));
await browser.disconnect();
