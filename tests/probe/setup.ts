// Setzt CURRENT_LAW auf die Probe-Tabelle (nur für vitest.lawprobe.config.ts).
import { vi } from 'vitest';
vi.mock('../../src/lib/engine/law', async importOriginal => {
  const m = await importOriginal<typeof import('../../src/lib/engine/law')>();
  const { LAW_PROBE } = await import('./law-probe');
  return { ...m, LAWS: Object.freeze([...m.LAWS, LAW_PROBE]), CURRENT_LAW: LAW_PROBE };
});
