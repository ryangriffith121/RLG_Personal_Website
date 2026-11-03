// node shot.mjs <file-or-url> <out.png> [width] [height] [fullPage]
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'node:url';
const [, , target, out, w = '1440', h = '900', full = '0'] = process.argv;
const url = /^https?:/.test(target) ? target : pathToFileURL(target).href;
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) } });
page.on('pageerror', (e) => console.log('PAGEERROR', String(e)));
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
await page.screenshot({ path: out, fullPage: full === '1' });
await browser.close();
