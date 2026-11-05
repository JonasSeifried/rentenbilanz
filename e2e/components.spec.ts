// Komponenten, Zustand und Test-Infrastruktur (WP3a): Rückgängig per Tastatur, mehrere Tabs, Fehler in Feldern,
// Popover ohne API, Diagramm-Breite, forced-colors, CSP. Die Eigenschaften der Komponenten (limits, stepper, …)
// prüft die Testseite e2e/harness/ (unter /__harness/, nicht Teil des ausgelieferten Rechners).
import { test, expect, type Page } from '@playwright/test';
import { DEFAULTS } from '../src/lib/engine/inputs';
import { STORAGE_KEY } from '../src/lib/storage';

type W = typeof window & { __csp: string[] };

const saved = (page: Page) => page.evaluate(k => {
  const raw = localStorage.getItem(k); return raw ? JSON.parse(raw).inputs : null;
}, STORAGE_KEY).then(diff => (diff ? { ...DEFAULTS, ...diff } : null));
const field = (page: Page, id: string) => page.getByTestId(id);
async function setField(page: Page, id: string, value: string) {
  const f = field(page, id);
  await f.fill(value);
  await f.blur();
}

// Jede Seite: Konsolenfehler, Seitenfehler und CSP-Verletzungen lassen den Test scheitern.
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(() => {
    (window as W).__csp = [];
    document.addEventListener('securitypolicyviolation', e => (window as W).__csp.push(`${e.violatedDirective}: ${e.blockedURI} ${e.sample}`));
  });
  (page as unknown as { __errors: string[] }).__errors = errors;
});
test.afterEach(async ({ page }) => {
  const csp = await page.evaluate(() => (window as W).__csp ?? []).catch(() => []);
  expect(csp, 'CSP-Verletzungen').toEqual([]);
  expect((page as unknown as { __errors: string[] }).__errors, 'Konsolenfehler').toEqual([]);
});

// Ohne den Header wäre der folgende Test wertlos: Der Testserver muss die CSP aus public/_headers mitschicken.
test('Testserver liefert die Sicherheits-Header aus public/_headers', async ({ request }) => {
  const res = await request.get('./');
  expect(res.headers()['content-security-policy']).toContain("default-src 'self'");
  expect(res.headers()['x-content-type-options']).toBe('nosniff');
});

test('keine CSP-Verletzung beim Durchklicken (Tabs, Popover, Diagramm, Farbschema, Schalter)', async ({ page, isMobile }) => {
  await page.goto('./');
  for (const t of ['detail', 'heirs', 'settings', 'overview']) await page.click('#tab-' + t);
  await page.getByRole('button', { name: /Farbschema/ }).click();
  await page.getByTestId('kv-1').check();
  await page.getByTestId('kv-0').check();
  await page.click('#tab-settings');
  await page.getByRole('button', { name: 'Erklärung: Basiszins' }).click();
  await expect(page.getByRole('note').filter({ hasText: 'Bundesfinanzministerium' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.click('#tab-overview');
  const box = await page.locator('#panel-overview .lc svg').first().boundingBox();
  if (box && !isMobile) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.getByTestId('reset').click();
  await setField(page, 'a0', '30');
  await page.emulateMedia({ media: 'print' });
  await page.emulateMedia({ media: 'screen' });
  await page.goto('./__harness/'); // auch die Komponenten ohne App
  await page.getByTestId('t-money').fill('1');
});

// ---------------------------------------------------------------------------------------------- Rückgängig / Hinweise

test('Rückgängig ist per Tastatur erreichbar, bleibt stehen und verfällt nach der nächsten Eingabe', async ({ page }) => {
  await page.clock.install();
  await page.goto('./');
  await setField(page, 'a0', '35');
  await page.clock.runFor(500);
  await expect.poll(() => saved(page).then(s => s?.a0)).toBe(35);

  // Per Tastatur auslösen: Fokus springt auf „Rückgängig“
  await page.getByTestId('reset').focus();
  await page.keyboard.press('Enter');
  await expect(field(page, 'a0')).toHaveValue('22');
  await expect(page.getByTestId('toast-action')).toBeFocused();
  // kein automatisches Ausblenden bei Hinweisen mit Aktion
  await page.clock.runFor(30_000);
  await expect(page.getByTestId('toast')).toBeVisible();
  // Enter löst „Rückgängig“ aus, der Fokus geht zurück zur auslösenden Schaltfläche
  await page.keyboard.press('Enter');
  await expect(field(page, 'a0')).toHaveValue('35');
  await expect(page.getByTestId('toast')).toHaveCount(0);
  await expect(page.getByTestId('reset')).toBeFocused();
  await page.clock.runFor(500);
  await expect.poll(() => saved(page).then(s => s?.a0)).toBe(35);

  // Nach einer Folgeeingabe gibt es keine Rückgängig-Aktion mehr, die sie überschreiben könnte
  await page.getByTestId('reset').click();
  await expect(page.getByTestId('toast-action')).toBeVisible();
  await setField(page, 'incWork', '99.000');
  await expect(page.getByTestId('toast-action')).toHaveCount(0);
  await page.clock.runFor(500);
  expect((await saved(page)).incWork).toBe(99000);
  expect((await saved(page)).a0).toBe(22);
});

test('Rückgängig nach Moduswechsel (Link öffnen) ist ungültig', async ({ page }) => {
  await page.goto('./');
  await setField(page, 'a0', '40');
  await expect.poll(() => saved(page).then(s => s?.a0)).toBe(40);
  await page.getByTestId('reset').click();
  await expect(page.getByTestId('toast-action')).toBeVisible();
  await page.goto('./#v=1&a0=33&g=7');
  await expect(page.getByTestId('toast-action')).toHaveCount(0);
});

test('Hinweise: Esc schließt, ohne Aktion blendet er nach einer Weile aus', async ({ page }) => {
  await page.clock.install();
  await page.goto('./__harness/');
  await page.getByTestId('toast-plain').click();
  await expect(page.getByTestId('toast')).toBeVisible();
  await page.clock.runFor(9000);
  await expect(page.getByTestId('toast')).toHaveCount(0);

  await page.getByTestId('toast-act').click();
  await page.clock.runFor(60_000);
  await expect(page.getByTestId('toast')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('toast')).toHaveCount(0);

  // Maus auf dem Hinweis hält die Zeit an
  await page.getByTestId('toast-plain').click();
  await page.getByTestId('toast').hover();
  await page.clock.runFor(20_000);
  await expect(page.getByTestId('toast')).toBeVisible();
});

test('focusField wechselt den Tab, scrollt und fokussiert', async ({ page }) => {
  await page.goto('./__harness/');
  await page.getByTestId('go-focus').click();
  await expect(page.locator('#t-money')).toBeFocused();
});

// ---------------------------------------------------------------------------------------------- mehrere Tabs

test('Zwei Tabs: Änderungen überschreiben sich nicht und erscheinen live im anderen Tab', async ({ browser }) => {
  const ctx = await browser.newContext();
  const a = await ctx.newPage();
  const b = await ctx.newPage();
  await a.goto('./');
  await b.goto('./');

  await setField(b, 'incWork', '50.000');
  await expect.poll(() => saved(b).then(s => s?.incWork)).toBe(50000);
  // das storage-Ereignis bringt die Änderung in Tab A auf den Bildschirm
  await expect(field(a, 'incWork')).toHaveValue('50.000');

  // Tab A ändert ein anderes Feld: Tab Bs Änderung bleibt gespeichert (nur geänderte Schlüssel werden geschrieben)
  await setField(a, 'incRet', '25.000');
  await expect.poll(() => saved(a).then(s => s?.incRet)).toBe(25000);
  const s = await saved(a);
  expect(s.incWork).toBe(50000);
  await expect(field(b, 'incRet')).toHaveValue('25.000');

  // Auch wenn Tab A vorher nichts von B wusste (Ereignis nicht ausgewertet): kein Rückfall auf alte Werte
  await setField(b, 'a0', '41');
  await expect.poll(() => saved(b).then(s2 => s2?.a0)).toBe(41);
  await setField(a, 'g', '5');
  await expect.poll(() => saved(a).then(s2 => s2?.g)).toBe(5);
  expect((await saved(a)).a0).toBe(41);
  await ctx.close();
});

test('Zwei Tabs: „Zurück zu meinen Eingaben“ zeigt den aktuellen Speicherstand', async ({ browser }) => {
  const ctx = await browser.newContext();
  const a = await ctx.newPage();
  const b = await ctx.newPage();
  await a.goto('./');
  await setField(a, 'a0', '30');
  await expect.poll(() => saved(a).then(s => s?.a0)).toBe(30);
  await b.goto('./');
  await setField(b, 'a0', '35');
  await expect.poll(() => saved(b).then(s => s?.a0)).toBe(35);
  await a.goto('./#v=1&a0=44&g=7');
  await expect(a.getByTestId('shared-banner')).toBeVisible();
  await a.getByTestId('leave').click();
  await expect(field(a, 'a0')).toHaveValue('35');
  await ctx.close();
});

test('Speichern schlägt fehl: Anzeige sagt es ehrlich', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('save-state')).toContainText('gespeichert');
  await page.evaluate(() => {
    Storage.prototype.setItem = function () { throw new DOMException('voll', 'QuotaExceededError'); };
  });
  await setField(page, 'a0', '31');
  await expect(page.getByTestId('save-state')).toContainText('nicht möglich');
});

test('Gespeicherte Eingaben löschen: mit Rückgängig, ehrliche Meldung ohne Speicher', async ({ page }) => {
  await page.goto('./');
  await setField(page, 'a0', '44');
  await expect.poll(() => saved(page).then(s => s?.a0)).toBe(44);
  await page.click('#tab-settings');
  await page.getByTestId('forget').click();
  await expect(page.getByTestId('toast')).toContainText('gelöscht');
  await expect(field(page, 'a0')).toHaveValue('22');
  await page.getByTestId('toast-action').click();
  await expect(field(page, 'a0')).toHaveValue('44');
  await expect.poll(() => saved(page).then(s => s?.a0)).toBe(44);
});

test('Gespeicherte Eingaben löschen ohne Speicher: sagt, dass nichts gespeichert war, und lässt die Eingaben stehen', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('blockiert', 'SecurityError'); } });
  });
  await page.goto('./');
  await setField(page, 'a0', '44');
  await page.click('#tab-settings');
  await page.getByTestId('forget').click();
  await expect(page.getByTestId('toast')).toContainText('kein Speicher');
  await expect(field(page, 'a0')).toHaveValue('44');
});

// ---------------------------------------------------------------------------------------------- Eingabefelder

test('Ungültige Eingabe bleibt stehen, wird angesagt und mit Esc verworfen', async ({ page }) => {
  await page.goto('./');
  await page.click('#tab-settings');
  const g = field(page, 'g');
  await g.fill('abc');
  const live = g.locator('xpath=ancestor::div[contains(@class,"field")]').locator('[aria-live=polite]');
  await expect(live).toContainText('Bitte eine Zahl eingeben.');
  await expect(g).toHaveAttribute('aria-invalid', 'true');
  await g.blur();
  await expect(g).toHaveValue('abc'); // bleibt stehen, springt nicht still zurück
  await expect(live).toContainText('Bitte eine Zahl eingeben.');
  await g.focus();
  await page.keyboard.press('Escape');
  await expect(g).toHaveValue('6');
  await expect(live).toHaveText('');
});

test('Leeres Feld ist „ausstehend“: Fehler erst beim Verlassen, Wert bleibt unverändert', async ({ page }) => {
  await page.goto('./__harness/');
  const f = page.getByTestId('t-pct');
  const live = page.locator('.field').filter({ has: f }).locator('[aria-live=polite]');
  await f.fill('');
  await expect(live).toHaveText('');
  await f.blur();
  await expect(live).toContainText('Bitte eine Zahl eingeben.');
  await expect(page.getByTestId('o-pct')).toHaveText('6');
  await f.fill('7');
  await expect(live).toHaveText('');
  await expect(page.getByTestId('o-pct')).toHaveText('7');
});

test('Grenzen: Wert außerhalb wird erklärt und nicht übernommen; Einheit steht in aria-describedby', async ({ page }) => {
  await page.goto('./__harness/');
  const f = page.getByTestId('t-pct');
  await f.fill('150');
  const live = page.locator('.field').filter({ has: f }).locator('[aria-live=polite]');
  await expect(live).toContainText('Bitte einen Wert zwischen -100 und 100 eingeben.');
  await expect(page.getByTestId('o-pct')).toHaveText('6');
  await f.fill('99');
  await expect(live).toHaveText('');
  await expect(page.getByTestId('o-pct')).toHaveText('99');
  const desc = await f.getAttribute('aria-describedby');
  expect(desc).toContain('t-pct-u');
  await expect(page.locator('#t-pct-u')).toHaveText('% p. a.');
  // 1e300 im Geldfeld
  const m = page.getByTestId('t-money');
  await m.fill('1' + '0'.repeat(300));
  await expect(page.getByTestId('o-money')).toHaveText('38000');
});

test('Dezimalpunkt: Prozentfelder lesen „0.125“ als 0,125, Geldfelder „1.234“ als 1234', async ({ page }) => {
  await page.goto('./__harness/');
  await setField(page, 't-pct', '0.125');
  await expect(page.getByTestId('o-pct')).toHaveText('0.125');
  await setField(page, 't-pct', '4.500'); // Rendite: kein Tausenderpunkt
  await expect(page.getByTestId('o-pct')).toHaveText('4.5');
  await setField(page, 't-money', '1.234');
  await expect(page.getByTestId('o-money')).toHaveText('1234');
  await setField(page, 't-money', '0.125');
  await expect(page.getByTestId('o-money')).toHaveText('0.125');
});

test('effective: „Gerechnet wird mit X.“ nur bei Abweichung', async ({ page }) => {
  await page.goto('./__harness/');
  const f = page.getByTestId('t-age');
  const box = page.locator('.field').filter({ has: f });
  await expect(box).toContainText('Gerechnet wird mit 60.');
  await setField(page, 't-age', '45');
  await expect(box).not.toContainText('Gerechnet wird mit');
});

test('alwaysCommit: Blur nach Eingabe meldet auch den gleichen Wert, ohne Eingabe nicht', async ({ page }) => {
  await page.goto('./__harness/');
  const f = page.getByTestId('t-contrib');
  await f.focus();
  await f.blur(); // nichts getippt
  await expect(page.getByTestId('o-commits')).toHaveText('0');
  await setField(page, 't-contrib', '150'); // gleicher Wert, aber getippt
  await expect(page.getByTestId('o-commits')).toHaveText('1');
  await f.focus();
  await f.fill('160');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('o-commits')).toHaveText('3'); // Eingabe (160) + Enter
});

test('Stepper: Klick = ein Schritt, langer Druck = 5 Schritte pro Wiederholung, Grenzen halten', async ({ page }) => {
  await page.goto('./__harness/');
  const out = page.getByTestId('o-step');
  const plus = page.getByRole('button', { name: 'Betrag erhöhen' });
  const minus = page.getByRole('button', { name: 'Betrag verringern' });
  await expect(plus).toBeVisible();
  const bb = await plus.boundingBox();
  expect(bb!.width).toBeGreaterThanOrEqual(43.5);
  expect(bb!.height).toBeGreaterThanOrEqual(43.5);
  await plus.click();
  await expect(out).toHaveText('160');
  await minus.click();
  await minus.click();
  await expect(out).toHaveText('140');
  // langer Druck
  await plus.hover();
  await page.mouse.down();
  await page.waitForTimeout(700);
  await page.mouse.up();
  await expect.poll(async () => Number(await out.textContent())).toBeGreaterThanOrEqual(190); // 140 + 5·10
  const now = Number(await out.textContent());
  expect(now % 10).toBe(0);
  // Obergrenze 1000
  await page.getByTestId('t-step').fill('995');
  await plus.click();
  await expect(out).toHaveText('1000');
  await plus.click();
  await expect(out).toHaveText('1000');
  // Tastatur: Pfeil hoch/runter, Umschalt = 10 Schritte
  await page.getByTestId('t-step').focus();
  await page.keyboard.press('ArrowDown');
  await expect(out).toHaveText('990');
  await page.keyboard.press('Shift+ArrowDown');
  await expect(out).toHaveText('890');
});

test('Vorzeichen-Button (±) für Felder mit negativen Werten auf Touch-Geräten', async ({ page }) => {
  await page.goto('./__harness/');
  const coarse = await page.evaluate(() => matchMedia('(pointer: coarse)').matches);
  const pm = page.getByRole('button', { name: 'Differenz: Vorzeichen wechseln' });
  if (!coarse) { await expect(pm).toBeHidden(); return; }
  const f = page.getByTestId('t-neg');
  await f.fill('12');
  await expect(page.getByTestId('o-neg')).toHaveText('12');
  await pm.click();
  await expect(f).toHaveValue('-12');
  await expect(page.getByTestId('o-neg')).toHaveText('-12');
  await pm.click();
  await expect(f).toHaveValue('12');
  await expect(f).toHaveAttribute('inputmode', 'decimal');
});

test('disabled: Feld und Schalter sind gesperrt', async ({ page }) => {
  await page.goto('./__harness/');
  await expect(page.getByTestId('t-off')).toBeDisabled();
  await expect(page.locator('#t-sw-off')).toBeDisabled();
  await expect(page.locator('#t-sw')).toBeEnabled();
});

// ---------------------------------------------------------------------------------------------- Popover

test('Glossar ohne Popover-API: versteckt, öffnet per Klick, schließt mit Esc und Klick daneben', async ({ page }) => {
  await page.goto('./');
  await page.click('#tab-settings');
  // Popover-API „entfernen“: ohne Attribut verhält sich das Feld wie in einem alten Browser
  const total = await page.evaluate(() => {
    const pops = [...document.querySelectorAll<HTMLElement>('.pop')];
    pops.forEach(p => p.removeAttribute('popover'));
    return pops.length;
  });
  expect(total).toBeGreaterThan(20);
  await expect(page.locator('.pop:visible')).toHaveCount(0);
  const q = page.getByRole('button', { name: 'Erklärung: Basiszins' });
  await q.click();
  const note = page.getByRole('note').filter({ hasText: 'Bundesfinanzministerium' });
  await expect(note).toBeVisible();
  await expect(q).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(note).toBeHidden();
  await expect(q).toHaveAttribute('aria-expanded', 'false');
  await q.click();
  await expect(note).toBeVisible();
  await page.mouse.click(2, 300);
  await expect(note).toBeHidden();
  await q.click();
  await q.click(); // zweiter Klick schaltet um
  await expect(note).toBeHidden();
});

test('Glossar-Popover ist beim ersten Frame schon platziert, bleibt bei Höhenänderung offen, schließt bei Breitenänderung', async ({ page, isMobile }) => {
  test.skip(!!isMobile, 'Fenstergröße ändern: nur Desktop');
  await page.goto('./');
  await page.click('#tab-settings');
  const q = page.getByRole('button', { name: 'Erklärung: Basiszins' });
  await q.scrollIntoViewIfNeeded();
  // Jeden Frame nach dem Klick prüfen: sichtbar nur, wenn schon platziert (nie bei 0,0)
  const frames = await q.evaluate((btn: HTMLElement) => new Promise<{ vis: string; l: number; t: number }[]>(resolve => {
    const pop = document.getElementById(btn.getAttribute('aria-controls')!)!;
    const out: { vis: string; l: number; t: number }[] = [];
    btn.click();
    let n = 0;
    const tick = () => {
      const r = pop.getBoundingClientRect();
      out.push({ vis: getComputedStyle(pop).visibility, l: r.left, t: r.top });
      if (++n < 6) requestAnimationFrame(tick); else resolve(out);
    };
    requestAnimationFrame(tick);
  }));
  for (const f of frames) expect(f.vis === 'visible' && f.l === 0 && f.t === 0, JSON.stringify(f)).toBe(false);
  const note = page.getByRole('note').filter({ hasText: 'Bundesfinanzministerium' });
  await expect(note).toBeVisible();
  const vp = page.viewportSize()!;
  await page.setViewportSize({ width: vp.width, height: vp.height - 120 }); // wie eine Bildschirmtastatur
  await page.waitForTimeout(200);
  await expect(note).toBeVisible();
  const box = await note.boundingBox();
  expect(box!.y + box!.height).toBeLessThanOrEqual(vp.height - 120);
  await page.setViewportSize({ width: vp.width - 100, height: vp.height - 120 });
  await expect(note).toBeHidden();
});

// ---------------------------------------------------------------------------------------------- Diagramm

test('Diagramm nach Tabwechsel ohne Stauchung (viewBox-Breite = Elementbreite)', async ({ page }) => {
  await page.goto('./');
  const ratio = (tab: string) => page.evaluate((t) => {
    const svg = document.querySelector<SVGSVGElement>(`#panel-${t} .lc svg`)!;
    const rect = svg.getBoundingClientRect();
    return { vb: svg.viewBox.baseVal.width, w: rect.width, vis: getComputedStyle(svg).visibility };
  }, tab);
  for (const t of ['heirs', 'detail', 'overview', 'heirs']) {
    await page.click('#tab-' + t);
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));
    const r = await ratio(t);
    expect(r.vis).toBe('visible');
    expect(Math.abs(r.vb - r.w), `Tab ${t}: viewBox ${r.vb} vs Breite ${r.w}`).toBeLessThanOrEqual(1);
  }
  // Zweiter Besuch: schon im ersten Frame nach dem Umschalten passt die Breite (letzte Breite bleibt erhalten)
  const first = await page.evaluate(() => new Promise<{ vb: number; w: number }>(resolve => {
    document.getElementById('tab-overview')!.click();
    requestAnimationFrame(() => {
      const svg = document.querySelector<SVGSVGElement>('#panel-overview .lc svg')!;
      resolve({ vb: svg.viewBox.baseVal.width, w: svg.getBoundingClientRect().width });
    });
  }));
  expect(Math.abs(first.vb - first.w), JSON.stringify(first)).toBeLessThanOrEqual(1);
});

test('Diagramm: xMax kürzt die Achse, tipTitle im Tooltip, Marker-Label über der Fläche', async ({ page }) => {
  await page.goto('./__harness/');
  const wide = page.getByTestId('wide-chart');
  const slider = wide.getByRole('slider');
  await expect(slider).toHaveAttribute('aria-valuemax', '80');
  await slider.focus();
  await page.keyboard.press('End');
  await expect(slider).toHaveAttribute('aria-valuetext', /^Mit 80 Jahren: ETF/);
  await page.keyboard.press('ArrowRight');
  await expect(slider).toHaveAttribute('aria-valuetext', /^Mit 80 Jahren: ETF/); // nicht über xMax hinaus
  // Tabelle endet bei 80
  await wide.locator('summary').click();
  await expect(wide.locator('tbody tr').last().locator('td').first()).toHaveText('80');
  // Marker-Label liegt oberhalb der Plotfläche (y < oberer Rand 24)
  const y = await wide.locator('.mlabel').getAttribute('y');
  expect(Number(y)).toBeLessThan(24);
  // Tooltip mit Titel
  const svg = wide.locator('svg').first();
  const box = (await svg.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.5);
  await expect(wide.locator('.tip .t')).toHaveText(/^Mit \d+ Jahren$/);
});

test('Diagramm schmal: Tooltip steht fest oben und wandert nicht mit', async ({ page }) => {
  await page.goto('./__harness/');
  const narrow = page.getByTestId('narrow-chart');
  const svg = narrow.locator('svg').first();
  await svg.scrollIntoViewIfNeeded();
  const box = (await svg.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.6);
  const tip = narrow.locator('.tip');
  await expect(tip).toHaveClass(/fixed/);
  const a = (await tip.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.6);
  const b = (await tip.boundingBox())!;
  expect(Math.abs(a.x - b.x)).toBeLessThan(1);
  expect(Math.abs(a.y - b.y)).toBeLessThan(1);
  expect(a.y).toBeLessThanOrEqual(box.y + 1);
  expect(a.width).toBeGreaterThan(box.width * 0.9);
});

test('Diagramm im Druck: feste Breite 680, danach wieder gemessen', async ({ page, isMobile }) => {
  test.skip(!!isMobile, 'Druck-Emulation reicht in Chromium');
  await page.goto('./__harness/');
  const vb = () => page.getByTestId('wide-chart').locator('svg').first().evaluate((s: SVGSVGElement) => s.viewBox.baseVal.width);
  const before = await vb();
  expect(before).not.toBe(680);
  await page.emulateMedia({ media: 'print' });
  await expect.poll(vb).toBe(680);
  await page.emulateMedia({ media: 'screen' });
  await expect.poll(vb).toBe(before);
});

// ---------------------------------------------------------------------------------------------- forced-colors

test('forced-colors: Schalter an und aus sind unterscheidbar', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'forced-colors-Emulation nur in Chromium');
  await page.emulateMedia({ forcedColors: 'active' });
  await page.goto('./');
  const sw = page.getByTestId('real');
  const look = () => sw.evaluate((el) => {
    const cs = getComputedStyle(el), th = getComputedStyle(el, '::before');
    return { track: cs.backgroundColor, border: cs.borderTopColor, thumb: th.backgroundColor, x: th.transform };
  });
  const off = await look();
  await sw.click();
  await page.waitForTimeout(400); // Übergänge (.15 s) abwarten
  const on = await look();
  expect(on.track).not.toBe(off.track);
  expect(on.thumb).not.toBe(off.thumb);
  expect(on.x).not.toBe(off.x);
  // Farbmarken der Legende behalten ihre Farbe
  const key = page.locator('#panel-overview .lc .legend .key').first();
  const bg = await key.evaluate(el => getComputedStyle(el).backgroundColor);
  expect(bg).not.toBe('rgba(0, 0, 0, 0)');
});
