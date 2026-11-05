import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readParams } from '../src/lib/engine/engine';
import { analyze } from '../src/lib/engine/analyze';
import { DEFAULTS } from '../src/lib/engine/inputs';
import { eur } from '../src/lib/format';
import { STORAGE_KEY } from '../src/lib/storage';

// Zwischenablage abfangen, damit „Link teilen“ in jedem Browser testbar ist
async function stubClipboard(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async (t: string) => { (window as unknown as { __copied: string }).__copied = t; } },
    });
  });
}
const saved = (page: Page) => page.evaluate(k => {
  const raw = localStorage.getItem(k); return raw ? JSON.parse(raw).inputs : null;
}, STORAGE_KEY).then(diff => (diff ? { ...DEFAULTS, ...diff } : null)); // Speicherformat v2 enthält nur Abweichungen
const field = (page: Page, id: string) => page.getByTestId(id);

async function setField(page: Page, id: string, value: string) {
  const f = field(page, id);
  await f.fill(value);
  await f.blur();
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  // Keine externen Anfragen: alles muss vom eigenen Server kommen
  page.on('request', r => {
    const u = new URL(r.url());
    if (!['localhost', '127.0.0.1'].includes(u.hostname) && u.protocol !== 'data:' && u.protocol !== 'about:') errors.push('Externe Anfrage: ' + r.url());
  });
  (page as unknown as { __errors: string[] }).__errors = errors;
});
test.afterEach(async ({ page }) => {
  expect((page as unknown as { __errors: string[] }).__errors, 'Konsolenfehler / externe Anfragen').toEqual([]);
});

test('Startseite rechnet mit den Standardwerten wie die Engine', async ({ page }) => {
  await page.goto('./');
  const A = analyze(readParams({ ...DEFAULTS }));
  for (const pr of A.active) {
    await expect(page.getByTestId('tile-' + pr.key)).toContainText(eur(A.stats[pr.key]!.avgMonthly));
  }
  // Neutral: Beträge in fester Reihenfolge, Abstände, Kosten-Gleichstand; kein Sieger, keine Hervorhebung
  await expect(page.getByTestId('verdict').locator('h2')).toHaveText(/^Ø netto im Monat \(67–90\): ETF-Depot [\d.]+ €, Altersvorsorgedepot [\d.]+ €, Rentenversicherung [\d.]+ €\.$/);
  await expect(page.getByTestId('verdict')).toContainText('mehr aus als das ETF-Depot');
  await expect(page.getByTestId('break-even')).toContainText('Gleichstand mit dem ETF-Depot bis zum Alter von 90 bei 0,87 % AVD-Kosten');
  await expect(page.getByTestId('verdict')).not.toContainText(/vorne|Favorit|Gewinner|Sieger|lohnt/);
  await expect(page.locator('.tiles')).not.toContainText('vorne');
  await expect(page.locator('td.best, .tile.lead, .badge')).toHaveCount(0);
  await expect(page.getByTestId('scenarios').locator('thead')).not.toContainText('Vorne');
  await expect(page.locator('.tile [data-testid^=contrib]')).toHaveCount(3);
  expect(await page.locator('.tile').evaluateAll(els => els.map(e => e.getAttribute('data-testid')))).toEqual(['tile-etf', 'tile-avd', 'tile-ins']);
  await expect(page.getByTestId('disclaimer')).toContainText('keine Anlageberatung');
  await expect(page.getByTestId('disclaimer')).toContainText('Rechtsstand 26.05.2026');
  await expect(field(page, 'a0')).toHaveValue('22');
  await expect(field(page, 'incWork')).toHaveValue('38.000');
  await expect(page.locator('.scen tbody tr')).toHaveCount(16); // Ausgangslage + 9 Zeilen des Originals + Gehaltsentwicklung + Umschichtung + Auszahlprofil, Förderverzug, AVD-Auszahlkosten, Pauschbetrag
});

test('Eingaben werden gespeichert und beim nächsten Besuch wiederhergestellt', async ({ page }) => {
  await page.goto('./');
  expect(await saved(page)).toBeNull(); // ohne Änderung wird nichts gespeichert
  await setField(page, 'incWork', '52.500');
  await page.getByTestId('kv-1').check();
  await expect.poll(() => saved(page).then(s => s?.incWork)).toBe(52500);
  await page.reload();
  await expect(field(page, 'incWork')).toHaveValue('52.500');
  await expect(page.getByTestId('kv-1')).toBeChecked();
  await expect(page).toHaveURL(/\/$/); // Adresszeile bleibt sauber
});

test('Deutsche Zahleneingabe: Komma, Tausenderpunkt und ungültige Werte', async ({ page }) => {
  await page.goto('./');
  await page.click('#tab-settings');
  await setField(page, 'etfM', '1.234');
  await expect.poll(() => saved(page).then(s => s?.etfM)).toBe(1234);
  await setField(page, 'g', '5,5');
  await expect.poll(() => saved(page).then(s => s?.g)).toBe(5.5);
  await field(page, 'g').fill('abc');
  await expect(page.getByText('Bitte eine Zahl eingeben.')).toBeVisible();
  await expect.poll(() => saved(page).then(s => s?.g)).toBe(5.5); // Unsinn wird nicht übernommen
});

test('Zurücksetzen auf Standardwerte, mit Rückgängig', async ({ page }) => {
  await page.goto('./');
  await setField(page, 'a0', '35');
  await expect.poll(() => saved(page).then(s => s?.a0)).toBe(35);
  await page.getByTestId('reset').click();
  await expect(field(page, 'a0')).toHaveValue('22');
  await expect.poll(() => saved(page).then(s => s?.a0)).toBe(22);
  await page.getByTestId('toast-action').click(); // Rückgängig
  await expect(field(page, 'a0')).toHaveValue('35');
  await page.reload();
  await expect(field(page, 'a0')).toHaveValue('35');
});

test('Link teilen und in einem frischen Browser öffnen: Szenario wird direkt übernommen', async ({ page, browser }) => {
  await stubClipboard(page);
  await page.goto('./');
  await setField(page, 'incRet', '31.000');
  await page.click('#tab-heirs');
  await page.getByTestId('share').click();
  const url = await page.evaluate(() => (window as unknown as { __copied: string }).__copied);
  expect(url).toContain('#v=1');
  expect(url).toContain('incRet=31000');
  expect(url).toContain('t=heirs');

  const ctx = await browser.newContext(); // ohne gespeicherte Werte
  const other = await ctx.newPage();
  await other.goto(url);
  await expect(other.getByTestId('incRet')).toHaveValue('31.000');
  await expect(other.locator('#tab-heirs')).toHaveAttribute('aria-selected', 'true');
  await expect(other.getByTestId('shared-banner')).toHaveCount(0);
  await expect(other).not.toHaveURL(/#/); // übernommen, Adresszeile aufgeräumt
  await expect.poll(() => saved(other).then(s => s?.incRet)).toBe(31000);
  await ctx.close();
});

test('Geteilter Link überschreibt gespeicherte Eingaben nicht ungefragt (Zurück)', async ({ page }) => {
  await page.goto('./');
  await setField(page, 'a0', '40');
  await expect.poll(() => saved(page).then(s => s?.a0)).toBe(40);

  await page.goto('about:blank');
  await page.goto('./#v=1&a0=30&setAll=100&etfM=100&avdM=100&insM=100&fondM=100');
  await expect(page.getByTestId('shared-banner')).toBeVisible();
  await expect(field(page, 'a0')).toHaveValue('30');
  await expect(page.getByTestId('save-state')).toContainText('nicht gespeichert');

  // Änderungen im Ansichtsmodus werden nicht gespeichert
  await setField(page, 'a0', '31');
  await page.waitForTimeout(400);
  expect((await saved(page)).a0).toBe(40);

  await page.getByTestId('leave').click();
  await expect(page.getByTestId('shared-banner')).toHaveCount(0);
  await expect(field(page, 'a0')).toHaveValue('40');
  await expect(page).not.toHaveURL(/#/);
});

test('Geteilter Link: Übernehmen speichert das Szenario, Rückgängig stellt das alte wieder her', async ({ page }) => {
  await page.goto('./');
  await setField(page, 'a0', '40');
  await expect.poll(() => saved(page).then(s => s?.a0)).toBe(40);
  // Gleiches Dokument, nur der Hash ändert sich (z. B. Link in denselben Tab eingefügt)
  await page.goto('./#v=1&a0=30');
  await expect(page.getByTestId('shared-banner')).toBeVisible();
  await page.getByTestId('adopt').click();
  await expect(page.getByTestId('shared-banner')).toHaveCount(0);
  await expect.poll(() => saved(page).then(s => s?.a0)).toBe(30);
  await page.reload();
  await expect(field(page, 'a0')).toHaveValue('30');
  await page.goto('./#v=1&a0=33');
  await page.getByTestId('adopt').click();
  await page.getByTestId('toast-action').click();
  await expect.poll(() => saved(page).then(s => s?.a0)).toBe(30);
});

test('Link mit denselben Werten wie gespeichert zeigt kein Banner', async ({ page }) => {
  await page.goto('./');
  await setField(page, 'a0', '40');
  await expect.poll(() => saved(page).then(s => s?.a0)).toBe(40);
  await page.goto('about:blank');
  // kvRate=21.1: Die Link-Basis v1 hat 21,7 (eingefroren), der aktuelle Standard ist 21,1
  await page.goto('./#v=1&a0=40&kvRate=21.1');
  await expect(field(page, 'a0')).toHaveValue('40');
  await expect(page.getByTestId('shared-banner')).toHaveCount(0);
});

test('Ungültige oder fremde Link-Werte werden ignoriert', async ({ page }) => {
  await page.goto('./#v=1&a0=abc&foo=1&kvOn=vielleicht&g=7');
  await expect(field(page, 'a0')).toHaveValue('22');
  await expect(field(page, 'g')).toHaveValue('7');
  await expect(page.getByTestId('kv-1')).not.toBeChecked();
  await page.goto('about:blank');
  await page.goto('./#v=99&a0=50');
  await expect(page.getByTestId('toast')).toContainText('neueren Version');
  await expect(field(page, 'a0')).toHaveValue('22');
});

test('Gespeicherte Eingaben löschen', async ({ page }) => {
  await page.goto('./');
  await setField(page, 'a0', '44');
  await expect.poll(() => saved(page).then(s => s?.a0)).toBe(44);
  await page.click('#tab-settings');
  await page.getByTestId('forget').click();
  expect(await saved(page)).toBeNull();
  await expect(field(page, 'a0')).toHaveValue('22');
  await page.reload();
  expect(await saved(page)).toBeNull();
});

test('Warnungen bei unfairen Vergleichen mit Korrektur per Klick', async ({ page }) => {
  await page.goto('./');
  await page.click('#tab-settings');
  await setField(page, 'etfM', '200');
  await page.click('#tab-overview');
  await expect(page.getByTestId('verdict')).toContainText('nicht bei allen Produkten gleich');
  await page.getByRole('button', { name: /Alle auf 150 €/ }).click();
  await expect(page.getByTestId('verdict')).toContainText('Ø netto im Monat');

  await page.click('#tab-settings');
  await page.getByTestId('reinvest').uncheck();
  await page.click('#tab-overview');
  await expect(page.getByTestId('verdict')).toContainText('kein fairer Vergleich möglich');
  await expect(page.locator('.note').first()).toContainText('Steuererstattung ausgegeben');
  await page.getByRole('button', { name: 'Steuererstattung anlegen' }).click();
  await expect(page.getByTestId('verdict')).toContainText('Ø netto im Monat');
});

test('Umschichtung vor Rentenbeginn: Schalter unter „Markt“, Szenario-Zeile, Ergebnis wie die Engine', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('scenarios')).toContainText('Alle schichten vor der Rente um');
  await page.click('#tab-settings');
  await expect(page.getByTestId('safeRate')).toHaveCount(0);
  await page.getByTestId('shift').check();
  await setField(page, 'safeRate', '1,5');
  await page.click('#tab-overview');
  await expect(page.getByTestId('scenarios')).toContainText('Niemand schichtet vor der Rente um');
  const A = analyze(readParams({ ...DEFAULTS, shift: true, safeRate: 1.5 }));
  await expect(page.getByTestId('tile-etf')).toContainText(eur(A.stats.etf!.avgMonthly));
  await expect(page.getByTestId('tile-avd')).toContainText(eur(A.stats.avd!.avgMonthly));
});

test('Gehaltsentwicklung: Schalter unter „Deine Situation“, Szenario-Zeile, Ergebnis wie die Engine', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('scenarios')).toContainText('Gehalt steigt bis 45 real um 30 %');
  await page.click('#tab-settings');
  await expect(page.getByTestId('incPeak')).toHaveCount(0);
  await page.getByTestId('incPath').check();
  await expect(page.getByTestId('incPeak')).toHaveValue('49.400');
  await setField(page, 'incPeak', '60000');
  await setField(page, 'incPeakAge', '40');
  await expect(page.locator('#panel-settings')).toContainText('real +2,6 % pro Jahr');
  await expect.poll(() => saved(page).then(s => [s?.incPeak, s?.incPeakAge])).toEqual([60000, 40]);
  await page.click('#tab-overview');
  await expect(page.getByTestId('scenarios')).toContainText('Gehalt bleibt konstant bei 38.000 €');
  const A = analyze(readParams({ ...DEFAULTS, incPeak: 60000, incPeakAge: 40 }));
  await expect(page.getByTestId('tile-avd')).toContainText(eur(A.stats.avd!.avgMonthly));
  await page.click('#tab-settings');
  await page.getByTestId('incPath').uncheck();
  await expect.poll(() => saved(page).then(s => s?.incPeak)).toBe(-1);
});

test('Kaufkraft-Umschalter ändert die Beträge', async ({ page }) => {
  await page.goto('./');
  const real = await page.getByTestId('tile-etf').locator('.big').textContent();
  await page.getByTestId('real').uncheck();
  await expect(page.getByTestId('tile-etf').locator('.big')).not.toHaveText(real!);
  const A = analyze(readParams({ ...DEFAULTS, real: false }));
  await expect(page.getByTestId('tile-etf')).toContainText(eur(A.stats.etf!.avgMonthly));
});

test('Tabs per Tastatur, Glossar-Popover, Diagramm per Tastatur', async ({ page, isMobile }) => {
  test.skip(!!isMobile, 'Tastaturbedienung auf Desktop');
  await page.goto('./');
  await page.locator('#tab-overview').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#tab-detail')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#panel-detail')).toBeVisible();
  await page.keyboard.press('End');
  await expect(page.locator('#tab-settings')).toHaveAttribute('aria-selected', 'true');

  // „?“-Symbol im Einstellungs-Tab
  await page.getByRole('button', { name: 'Erklärung: Basiszins' }).click();
  await expect(page.getByRole('note').filter({ hasText: 'Bundesfinanzministerium' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('note').filter({ hasText: 'Bundesfinanzministerium' })).toBeHidden();

  // Unterstrichener Begriff im Fließtext
  await page.click('#tab-overview');
  await page.locator('#panel-overview').getByRole('button', { name: 'Vorabpauschale', exact: true }).click();
  await expect(page.getByRole('note').filter({ hasText: 'fiktiven Mindestertrag' })).toBeVisible();
  await page.keyboard.press('Escape');

  const chart = page.locator('#panel-overview [role=slider]');
  await chart.focus();
  await page.keyboard.press('Home');
  await expect(chart).toHaveAttribute('aria-valuetext', /^Bis Alter 67 ausgezahlt \(netto\): ETF 0 €/);
  await page.keyboard.press('ArrowRight');
  await expect(chart).toHaveAttribute('aria-valuetext', /^Bis Alter 68 ausgezahlt \(netto\): ETF [1-9]/);
});

test('Farbschema umschalten bleibt erhalten', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: /Farbschema: automatisch/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: /Farbschema: hell/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('Läuft auch in einem Unterordner', async ({ page }) => {
  await page.goto('/unterordner/');
  await expect(page.getByTestId('verdict')).toContainText('Ø netto im Monat');
  await page.getByRole('link', { name: 'Impressum' }).click();
  await expect(page).toHaveURL(/\/unterordner\/impressum\.html$/);
  await expect(page.getByRole('heading', { name: 'Impressum' })).toBeVisible();
  await expect(page.getByText('Jonas Seifried').first()).toBeVisible();
  // Anschrift und Telefon kommen beim Build aus den Umgebungsvariablen (playwright.config.ts).
  await expect(page.getByText('Teststraße 1').first()).toBeVisible();
  await expect(page.getByText('Telefon: +49 0000 000000')).toBeVisible();
  await expect(page.getByText('%IMPRESSUM_')).toHaveCount(0);
  await page.getByRole('link', { name: /Zurück zum Rechner/ }).click();
  await expect(page.getByTestId('verdict')).toBeVisible();
});

test('Fußzeile verlinkt den Quellcode auf GitHub', async ({ page }) => {
  await page.goto('./');
  const link = page.getByRole('link', { name: 'Quellcode auf GitHub' });
  await expect(link).toHaveAttribute('href', 'https://github.com/JonasSeifried/rentenbilanz');
  await expect(link).toHaveAttribute('rel', /noopener/);
});

test('Datenschutzseite ist erreichbar', async ({ page }) => {
  await page.goto('./datenschutz.html');
  await expect(page.getByRole('heading', { name: 'Datenschutzerklärung' })).toBeVisible();
  await expect(page.getByText('Cloudflare Pages')).toBeVisible();
});

test('Mobil: kein horizontales Scrollen', async ({ page }) => {
  await page.goto('./');
  for (const t of ['overview', 'detail', 'heirs', 'settings']) {
    await page.click('#tab-' + t);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, 'Tab ' + t).toBeLessThanOrEqual(0);
  }
});

test('Druckansicht zeigt Überblick, Detail und Annahmen', async ({ page, browserName }) => {
  await page.goto('./');
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('#panel-overview')).toBeVisible();
  await expect(page.locator('#panel-detail')).toBeVisible();
  await expect(page.locator('#panel-settings')).toBeVisible();
  await expect(page.locator('#panel-heirs')).toBeHidden();
  await expect(page.locator('.tabbar')).toBeHidden();
  if (browserName === 'chromium') {
    const pdf = await page.pdf({ format: 'A4' });
    expect(pdf.byteLength).toBeGreaterThan(20_000);
  }
});

for (const scheme of ['light', 'dark'] as const) {
  test(`Barrierefreiheit (axe), ${scheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('./');
    for (const t of ['overview', 'detail', 'heirs', 'settings']) {
      await page.click('#tab-' + t);
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      expect(r.violations.map(v => `${t}: ${v.id} – ${v.nodes.slice(0, 3).map(n => n.target.join(' ')).join(', ')}`)).toEqual([]);
    }
  });
}
