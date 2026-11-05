import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

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
  (page as unknown as { __errors: string[] }).__errors = errors;
});
test.afterEach(async ({ page }) => {
  expect((page as unknown as { __errors: string[] }).__errors).toEqual([]);
});

test('Kombi: über „+ Kombi“ zusammenstellen, im Vergleich sehen, bearbeiten, entfernen', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('tile-kombi')).toHaveCount(0);
  await page.getByTestId('kombi-add').click();
  const dlg = page.getByTestId('kombi-dialog');
  await expect(dlg).toBeVisible();

  // Vorbelegung: Monatsbeitrag gleichmäßig auf die verglichenen Produkte
  await expect(field(page, 'kombi-budget')).toHaveValue('150');
  await expect(page.getByTestId('kombi-status')).toContainText('Verteilt 150 € von 150 €');

  // Budget ändern skaliert die Aufteilung mit
  await setField(page, 'kombi-budget', '450');
  await expect(field(page, 'kombi-etf')).toHaveValue('150');
  await setField(page, 'kombi-ins', '0');
  await expect(page.getByTestId('kombi-status')).toContainText('noch 150 € offen');
  await expect(page.getByTestId('kombi-apply')).toBeDisabled();
  await page.getByTestId('kombi-fix').click();
  await expect(field(page, 'kombi-etf')).toHaveValue('300');
  await expect(page.getByTestId('kombi-status')).toContainText('Verteilt 450 € von 450 €');
  await expect(page.getByTestId('kombi-result')).toBeVisible();
  // Suche nach der höchsten Summe nur auf Wunsch (opt-in), neutral formuliert
  await expect(page.getByTestId('kombi-use-best')).toHaveCount(0);
  await expect(page.getByTestId('kombi-result')).not.toContainText('höchste Summe unter');
  await page.getByTestId('kombi-search').click();
  await expect(page.getByTestId('kombi-search')).toHaveCount(0);
  await expect(page.getByTestId('kombi-result')).toContainText('höchste Summe unter diesen Annahmen');
  await expect(page.getByTestId('kombi-result')).not.toContainText(/beste|vorne|rechnerisch|empfehl/i);
  await expect(page.getByTestId('kombi-use-best')).toBeVisible();

  // Zu viel verteilt: Überschuss abziehen nimmt vom größten Anteil
  await setField(page, 'kombi-avd', '400');
  await expect(page.getByTestId('kombi-status')).toContainText('250 € zu viel');
  await page.getByTestId('kombi-fix').click();
  await expect(page.getByTestId('kombi-status')).toContainText('Verteilt 450 € von 450 €');
  await expect(field(page, 'kombi-avd')).toHaveValue('150');

  await page.getByTestId('kombi-apply').click();
  await expect(dlg).toBeHidden();
  await expect(page.getByTestId('tile-kombi')).toBeVisible();
  await expect(page.getByTestId('kombi-chip')).toContainText('300 € ETF + 150 € AVD');
  await expect(field(page, 'setAll')).toHaveValue('450');
  await expect(page.getByTestId('contrib-etf')).toContainText('450 €');
  await expect(page.getByTestId('scenarios')).toContainText('Kombi');

  // Monatsbeitrag ändern: Die Kombi wird proportional mitgenommen
  await setField(page, 'setAll', '300');
  await expect(page.getByTestId('kombi-chip')).toContainText('200 € ETF + 100 € AVD');

  // Detail und Erbfall
  await page.getByRole('tab', { name: /Rente/ }).click();
  await expect(page.getByTestId('detail-table')).toContainText('Kombi');
  await page.getByRole('tab', { name: /Erbfall/ }).click();
  await expect(page.getByTestId('heirs-table')).toContainText('Kombi – Ehepartner erbt');
  await expect(page.getByTestId('heirs-table')).toContainText('Kombi – Kinder / Partner ohne Trauschein');
  await expect(page.getByTestId('heirs-table')).toContainText('Gemeinsam versteuert');
  await page.getByRole('tab', { name: /Überblick/ }).click();

  await page.reload();
  await expect(page.getByTestId('tile-kombi')).toBeVisible();

  // Bearbeiten über die Kachel, Esc verwirft den Entwurf
  await page.getByTestId('kombi-edit').click();
  await expect(dlg).toBeVisible();
  await expect(field(page, 'kombi-etf')).toHaveValue('200');
  await setField(page, 'kombi-etf', '0');
  await page.keyboard.press('Escape');
  await expect(dlg).toBeHidden();
  await expect(page.getByTestId('kombi-chip')).toContainText('200 € ETF + 100 € AVD');

  // Entfernen
  await page.getByTestId('kombi-chip').click();
  await page.getByTestId('kombi-remove').click();
  await expect(dlg).toBeHidden();
  await expect(page.getByTestId('tile-kombi')).toHaveCount(0);
  await expect(page.getByTestId('kombi-add')).toBeVisible();
});

test('Geteilter Link mit Kombi zeigt sie im Vergleich', async ({ page }) => {
  await page.goto('./#v=1&combo=1&cEtf=100&cAvd=50');
  await expect(page.getByTestId('tile-kombi')).toBeVisible();
  await expect(page.getByTestId('kombi-chip')).toContainText('100 € ETF + 50 € AVD');
});

for (const scheme of ['light', 'dark'] as const) {
  test(`Barrierefreiheit (axe) mit Kombi, ${scheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('./#v=1&combo=1&cEtf=100&cAvd=50');
    const axe = () => new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    let r = await axe();
    expect(r.violations.map(v => `Seite: ${v.id} – ${v.nodes.slice(0, 3).map(n => n.target.join(' ')).join(', ')}`)).toEqual([]);
    await page.getByTestId('kombi-chip').click();
    await expect(page.getByTestId('kombi-result')).toBeVisible();
    r = await axe();
    expect(r.violations.map(v => `Dialog: ${v.id} – ${v.nodes.slice(0, 3).map(n => n.target.join(' ')).join(', ')}`)).toEqual([]);
  });
}
