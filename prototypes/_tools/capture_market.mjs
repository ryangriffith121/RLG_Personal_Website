// Screenshots the market dashboard (run with: python server.py --offline --no-browser --port 8765)
import { chromium } from 'playwright-core';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const out = process.argv[2];
const browser = await chromium.launch({ executablePath: CHROME, args: ['--use-angle=d3d11', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
await page.goto('http://127.0.0.1:8765/', { waitUntil: 'networkidle' });
await page.waitForTimeout(6000);
await page.screenshot({ path: `${out}/market_dashboard.png` });
await page.waitForTimeout(4000);
await page.screenshot({ path: `${out}/market_dashboard_2.png` });
console.log('errors', errors);
await browser.close();
