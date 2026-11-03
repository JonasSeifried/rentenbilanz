// Screenshots für die visuelle Prüfung: node scripts/shots.mjs [url]
import { chromium, devices } from '@playwright/test';
const url = process.argv[2] || 'http://localhost:4173/';
const browser = await chromium.launch();
const shots = [
  ['desktop-light', { viewport: { width: 1366, height: 900 }, colorScheme: 'light' }],
  ['desktop-dark', { viewport: { width: 1366, height: 900 }, colorScheme: 'dark' }],
  ['mobile-light', { ...devices['iPhone 13'], colorScheme: 'light' }],
];
for (const [name, opts] of shots) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(url);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `screenshots/${name}.png`, fullPage: true });
  for (const t of ['detail', 'heirs', 'settings']) {
    await page.click(`#tab-${t}`);
    await page.waitForTimeout(200);
    await page.screenshot({ path: `screenshots/${name}-${t}.png`, fullPage: true });
  }
  if (errors.length) console.log(name, 'Konsole:', errors);
  await ctx.close();
}
await browser.close();
console.log('ok');
