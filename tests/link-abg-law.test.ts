// Abgeltungsteuersatz im Link und im Speicher folgt dem Rechtsstand (link.ts LAW_KEYS, docs/jaehrliche-pflege.md Regel 5).
// Simuliert eine neue Tabelle mit anderem Satz (27 %) als CURRENT_LAW: Ein Link oder Speicherstand ohne abgRate
// bedeutet dann „geltendes Recht“ (27 %), keine hypothetische Steueränderung „25 % statt 27 %“.
// Der Satz 27 % ist erfunden und nur hier im Test.
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../src/lib/engine/law', async importOriginal => {
  const m = await importOriginal<typeof import('../src/lib/engine/law')>();
  const { fn: _fn, ...BASE } = m.LAW_2026;
  const L = m.defineLaw({ ...BASE, id: 'abg27', year: 2098, abg: { rate: .27, withSoli: .27 * 1.055, soliFactor: 1.055, divisor: 1 / .27 } });
  return { ...m, LAWS: Object.freeze([...m.LAWS, L]), CURRENT_LAW: L };
});
import { decodeState, encodeState, LINK_BASE_V1 } from '../src/lib/link';
import { loadSaved, saveInputs, STORAGE_KEY } from '../src/lib/storage';
import { DEFAULTS, type Inputs } from '../src/lib/engine/inputs';
import { CURRENT_LAW } from '../src/lib/engine/law';
import { readParams } from '../src/lib/engine/core';
import { scenarioList } from '../src/lib/engine/analyze';
import { changedSettings } from '../src/lib/settingsChanged';

// Standardeingaben mit den eingefrorenen Annahmen der Link-Basis (kvRate, basis bleiben im Link bewusst fest).
const STD: Inputs = { ...DEFAULTS, kvRate: LINK_BASE_V1.kvRate, basis: LINK_BASE_V1.basis };
const ids = (i: Inputs) => scenarioList(readParams(i)).map(s => s.id);
/** Wie die App „hypothetische Steueränderung“ erkennt (combo.ts, rechenweg.ts, analyze.ts, AssumptionCheck). */
const taxChange = (i: Inputs) => readParams(i).abgRate !== CURRENT_LAW.abg.rate || i.abgRate !== DEFAULTS.abgRate;

function fakeStorage(init: Record<string, string> = {}) {
  const data = new Map(Object.entries(init));
  (globalThis as unknown as { window: unknown }).window = { localStorage: {
    getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, String(v)); }, removeItem: (k: string) => { data.delete(k); },
  } };
  return data;
}
afterEach(() => { delete (globalThis as unknown as { window?: unknown }).window; });

describe('Probe-Tabelle mit Abgeltungsteuer 27 % ist aktiv', () => {
  it('CURRENT_LAW und DEFAULTS', () => {
    expect(CURRENT_LAW.abg.rate).toBe(.27);
    expect(DEFAULTS.abgRate).toBe(27);
    expect(LINK_BASE_V1.abgRate).toBe(25); // eingefrorene Basis bleibt unverändert (Speicher-Migration v1)
  });
});

describe('Link', () => {
  it('alter Link ohne abgRate = geltendes Recht (27 %), keine Steueränderung', () => {
    const i = decodeState('#v=1&a0=40').inputs!;
    expect(i.abgRate).toBe(27);
    expect(taxChange(i)).toBe(false);
    expect(ids(i)).toContain('taxAbg'); expect(ids(i)).not.toContain('taxNow');
    expect(changedSettings(i)).not.toContain('abgRate');
    // Link ganz ohne v (sehr alt) ebenso
    expect(decodeState('#a0=40').inputs!.abgRate).toBe(27);
  });
  it('Kodieren: geltender Satz wird nicht gespeichert, Standardeingaben ergeben v=1', () => {
    expect(encodeState(STD, 'overview')).toBe('v=1');
    expect(encodeState({ ...STD, a0: 40 }, 'overview')).toBe('v=1&a0=40');
  });
  it('hypothetische Abweichung wird gespeichert, auch der frühere Satz 25 %', () => {
    for (const r of [25, 30, 0]) {
      const s = encodeState({ ...STD, abgRate: r }, 'overview');
      expect(s).toBe('v=1&abgRate=' + r);
      const i = decodeState('#' + s).inputs!;
      expect(i.abgRate).toBe(r);
      expect(taxChange(i)).toBe(true);
      expect(ids(i)).toContain('taxNow');
    }
  });
  it('Grenzfall: alter Link mit hypothetisch 27 % wird gelesen wie geschrieben; 27 % ist jetzt geltendes Recht', () => {
    const i = decodeState('#v=1&abgRate=27&taxFrom=50').inputs!;
    expect(i.abgRate).toBe(27);
    expect(taxChange(i)).toBe(false);
    // neu kodiert entfällt abgRate; der Stichtag bleibt (wirkt ohne Änderung nicht)
    expect(encodeState(i, 'overview')).toBe('v=1&taxFrom=50');
  });
});

describe('Speicher', () => {
  it('v2 ohne abgRate = geltendes Recht; Abweichung bleibt; geltender Satz wird nicht gespeichert', () => {
    fakeStorage({ [STORAGE_KEY]: JSON.stringify({ v: 2, inputs: { a0: 40 } }) });
    expect(loadSaved()!.abgRate).toBe(27);
    fakeStorage({ [STORAGE_KEY]: JSON.stringify({ v: 2, inputs: { abgRate: 25 } }) });
    expect(loadSaved()!.abgRate).toBe(25);
    const d = fakeStorage();
    saveInputs({ ...DEFAULTS, a0: 33 });
    expect(JSON.parse(d.get(STORAGE_KEY)!).inputs).toEqual({ a0: 33 });
  });
  it('v1 (volles Objekt mit Basiswert 25) = geltendes Recht', () => {
    fakeStorage({ [STORAGE_KEY]: JSON.stringify({ v: 1, inputs: { ...LINK_BASE_V1, a0: 35 } }) });
    const i = loadSaved()!;
    expect(i.abgRate).toBe(27);
    expect(i.a0).toBe(35);
  });
});
