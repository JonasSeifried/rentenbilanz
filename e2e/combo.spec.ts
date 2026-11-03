import { test, expect, type Page } from '@playwright/test';

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

test('Kombi-Modus: Aufteilen, Rest geben, beste Aufteilung übernehmen, Neuladen', async ({ page }) => {
  await page.goto('./');
  await page.getByTestId('mode-combo').click();
  await expect(page.getByText('Monatliches Budget')).toBeVisible();
  await expect(page.getByTestId('split-status')).toContainText('Verteilt 450 € von 450 €');
  await expect(page.getByTestId('combo-verdict')).toBeVisible();
  await expect(page.getByTestId('tile-etf')).toHaveCount(0);

  await setField(page, 'cBudget', '500');
  await expect(page.getByTestId('split-status')).toContainText('noch 50 € offen');
  await expect(page.getByTestId('combo-verdict')).toContainText('Noch 50 € offen');
  await page.getByTestId('split-rest').click();
  await expect(field(page, 'split-etf')).toHaveValue('200');
  await expect(page.getByTestId('split-status')).toContainText('Verteilt 500 € von 500 €');

  // beste Aufteilung erscheint (entprellt), „übernehmen“ setzt sie
  await setField(page, 'split-etf', '500');
  await setField(page, 'split-avd', '0');
  await setField(page, 'split-ins', '0');
  await expect(page.getByTestId('combo-row-pure-etf')).toBeVisible();
  const adopt = page.getByTestId('combo-adopt');
  await expect(adopt).toBeVisible({ timeout: 10_000 });
  await adopt.click();
  await expect(page.getByTestId('split-status')).toContainText('Verteilt 500 € von 500 €');
  await expect(page.getByTestId('combo-verdict')).toContainText('rechnerisch die beste');
  await expect(adopt).toHaveCount(0);

  // Detail- und Erbfall-Tab
  await page.getByRole('tab', { name: /Rente/ }).click();
  await expect(page.getByTestId('combo-detail')).toContainText('Gesamt');
  await page.getByRole('tab', { name: /Erbfall/ }).click();
  await expect(page.getByTestId('combo-heirs')).toContainText('nur im Einzelvergleich');

  await page.reload();
  await expect(page.getByTestId('mode-combo')).toHaveAttribute('aria-pressed', 'true');
  await expect(field(page, 'cBudget')).toHaveValue('500');
});

test('Geteilter Link mit Kombi-Schlüsseln öffnet den Kombi-Modus', async ({ page }) => {
  await page.goto('./#v=1&combo=1&cBudget=500&cEtf=300&cAvd=150&cIns=50&cFond=0');
  await expect(page.getByTestId('mode-combo')).toHaveAttribute('aria-pressed', 'true');
  await expect(field(page, 'cBudget')).toHaveValue('500');
  await expect(field(page, 'split-etf')).toHaveValue('300');
  await expect(page.getByTestId('split-status')).toContainText('Verteilt 500 € von 500 €');
});

test('Gleich-viel-Modus bleibt ohne Kombi-Oberfläche', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('combo-split')).toHaveCount(0);
  await expect(field(page, 'setAll')).toBeVisible();
});
