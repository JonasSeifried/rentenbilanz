// Die Option `law` kommt überall an: In diesem Test wirft jeder Zugriff auf CURRENT_LAW einen Fehler, solange
// `armed` gesetzt ist. Mit ausdrücklich übergebenem LAW_2026 müssen alle Einstiegspunkte der Rechnung trotzdem
// durchlaufen (analyze, scenarios, kombiResult, costBreakEvens, bestSplit, analyzeCombo, robustRows, model) und
// bitgenau dasselbe liefern wie derselbe Aufruf ohne Vergiftung (und, solange LAW_2026 die neueste Tabelle ist, wie
// die App). Ein Pfad, der die Option verliert, fiele auf CURRENT_LAW zurück und rechnete später, mit einer neueren
// Tabelle, still mit gemischten Werten.
// Eingabeprüfung (readParams, DEFAULTS, LIMITS) und Oberflächenkonstanten lesen CURRENT_LAW beim Laden des Moduls;
// das ist gewollt und hier vor dem Scharfschalten erledigt.
import { describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ armed: false, hits: [] as string[] }));
vi.mock('../src/lib/engine/law', async importOriginal => {
  const m = await importOriginal<typeof import('../src/lib/engine/law')>();
  const poison = new Proxy(m.CURRENT_LAW, {
    get(t, k, r) {
      if (state.armed) { state.hits.push(String(k)); throw new Error('CURRENT_LAW benutzt (Option law ging verloren): ' + String(k)); }
      return Reflect.get(t, k, r);
    },
  });
  return { ...m, CURRENT_LAW: poison };
});

import { CURRENT_LAW, LAW_2026 } from '../src/lib/engine/law';
import { readParams } from '../src/lib/engine/core';
import { model } from '../src/lib/engine/engine';
import { computeLive, liveCases, canon } from './live/cases';

describe('Option law erreicht jeden Pfad (CURRENT_LAW vergiftet)', () => {
  const all = liveCases();
  // Alle gezielten Fälle (mit Break-even, Suche, Kombi-Analyse, Robustheit) und eine Auswahl der übrigen.
  const cases = all.filter((c, i) => c.deep || i % 25 === 0);
  it(`${cases.length} Fälle: mit LAW_2026 bitgleich zum ungeschärften Lauf, ohne einen Zugriff auf CURRENT_LAW`, () => {
    expect(cases.some(c => c.robust)).toBe(true);
    for (const c of cases) {
      // Vergleichsbasis ungeschärft mit demselben Rechtsstand (unabhängig davon, welche Tabelle gerade die neueste ist).
      const ref = computeLive(c, { law: LAW_2026 }).full;
      const p = readParams(c.inputs);
      const m0 = model(p, { law: LAW_2026 });
      // Solange LAW_2026 die neueste Tabelle ist, muss das auch die App ohne Optionen sein.
      if (CURRENT_LAW.id === LAW_2026.id) expect(computeLive(c).full === ref, c.id + ' App').toBe(true);
      state.armed = true;
      let got: string, m1: ReturnType<typeof model>;
      try { got = computeLive(c, { law: LAW_2026 }).full; m1 = model(p, { law: LAW_2026 }); }
      finally { state.armed = false; }
      expect(state.hits, c.id).toEqual([]);
      expect(got === ref, c.id).toBe(true);
      expect(canon(m1, m1.T) === canon(m0, m0.T), c.id + ' model').toBe(true);
    }
  }, 120_000);
  it('Gegenprobe: ohne Option schlägt die Vergiftung an', () => {
    const p = readParams(all[0].inputs);
    state.armed = true;
    try { expect(() => model(p)).toThrow(/CURRENT_LAW benutzt/); }
    finally { state.armed = false; state.hits.length = 0; }
  });
});
