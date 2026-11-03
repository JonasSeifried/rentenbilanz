import { chromium, devices } from '@playwright/test';
const base = 'http://localhost:4174/';
const b = await chromium.launch();
// Mobil: Detail-Tab, Popover
let ctx = await b.newContext({ ...devices['iPhone 13'] });
let p = await ctx.newPage();
await p.goto(base); await p.click('#tab-detail'); await p.waitForTimeout(300);
await p.screenshot({ path: 'screenshots/x-m-detail.png', fullPage: true });
await p.click('#tab-overview');
await p.getByRole('button', { name: 'Erklärung: Freiwillig gesetzlich versichert im Alter' }).click();
await p.waitForTimeout(200);
await p.screenshot({ path: 'screenshots/x-m-popover.png' });
await ctx.close();
// Desktop: Ansichtsmodus + Tooltip
ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
p = await ctx.newPage();
await p.goto(base); await p.getByTestId('a0').fill('30'); await p.waitForTimeout(400);
await p.goto('about:blank'); await p.goto(base + '#v=1&a0=25&kvOn=1');
await p.waitForTimeout(300);
const box = await p.locator('#panel-overview .plot svg').boundingBox();
await p.mouse.move(box.x + box.width * 0.55, box.y + box.height / 2);
await p.screenshot({ path: 'screenshots/x-d-shared.png', fullPage: true });
await p.emulateMedia({ media: 'print' });
await p.pdf({ path: 'screenshots/druck.pdf', format: 'A4' });
await b.close();
console.log('ok');
