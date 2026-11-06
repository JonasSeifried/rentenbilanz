// Regeltests mit Beträgen von 2026 (Steuer auf 70.000 €, KV-BBG 69.750 €, 150 € gefördert …) rechnen fest mit dem
// Rechtsstand 2026, auch wenn neuere Tabellen dazukommen. Eingebunden in der Testdatei mit
//   vi.mock('../src/lib/engine/law', async orig => (await import('./helpers/law-2026')).pin2026(await orig()));
// Damit sind CURRENT_LAW und alles, was beim Laden daraus entsteht (DEFAULTS, LIMITS, Oberflächenkonstanten), 2026.
// Was die App mit der neuesten Tabelle rechnet, prüfen das Live-Fixture und tests/law.test.ts; den Zukunftsfall prüft
// npm run test:law-probe (eine erfundene neuere Tabelle darf nur die erwarteten Tests rot machen).
import type * as LawModule from '../../src/lib/engine/law';

export function pin2026(m: typeof LawModule): typeof LawModule {
  return { ...m, LAWS: Object.freeze([m.LAW_2026]), CURRENT_LAW: m.LAW_2026 };
}
