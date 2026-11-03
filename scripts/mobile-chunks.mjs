// Mobile-Screenshots in bildschirmhohen Abschnitten: node scripts/mobile-chunks.mjs [tab] [dark]
import { chromium, devices } from '@playwright/test';
const tab = process.argv[2] || 'overview', dark = process.argv[3] === 'dark';
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'], colorScheme: dark ? 'dark' : 'light' });
const page = await ctx.newPage();
await page.goto('http://localhost:4173/');
if (tab !== 'overview') await page.click(`#tab-${tab}`);
await page.waitForTimeout(300);
const h = await page.evaluate(() => document.documentElement.scrollHeight);
const vh = 844;
for (let y = 0, k = 0; y < h; y += vh, k++) {
  await page.screenshot({ path: `screenshots/m-${tab}${dark ? '-dark' : ''}-${k}.png`, fullPage: true, clip: { x: 0, y, width: 390, height: Math.min(vh, h - y) } });
}
console.log(Math.ceil(h / vh), 'Abschnitte');
await browser.close();
