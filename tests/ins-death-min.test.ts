// R9 – insDeathMinimum: Bei Tod vor Rentenbeginn zahlt die Versicherung mindestens die eingezahlten Beiträge.
import { describe, expect, it } from 'vitest';
import { combo, emptySplit, type Split } from '../src/lib/engine/combo';
import { readParams } from '../src/lib/engine/core';
import { ALL_FIXES } from '../src/lib/engine/fixes';
import { DEFAULTS, type Inputs } from '../src/lib/engine/inputs';

const P = (patch: Partial<Inputs> = {}) => readParams({ ...DEFAULTS, ...patch });
const S = (patch: Partial<Split>): Split => ({ ...emptySplit(), ...patch });
const off = { fixes: new Set([...ALL_FIXES].filter(f => f !== 'insDeathMinimum')) };

describe('R9 – Mindest-Todesfallleistung der Versicherung', () => {
  for (const insLump of [true, false]) it(`schlechte Rendite: Erben bekommen die Beitragssumme (Kapitalauszahlung ${insLump})`, () => {
    const p = P({ g: -2, insLump, dyn: 3 });
    const on = combo(p, S({ ins: 150 })), base = combo(p, S({ ins: 150 }), off);
    const ins = on.parts.ins!;
    let paid = 0;
    for (let t = 1; t < on.n; t++) {
      paid += 12 * 150 * Math.pow(1.03, t - 1);
      const h = ins.heir(t), h0 = base.parts.ins!.heir(t);
      expect(h0.val).toBe(ins.vals[t]);
      expect(h.val).toBeCloseTo(Math.max(paid, ins.vals[t] as number), 6);
      expect(h.val).toBeGreaterThan(h0.val);
      expect(h.note).toMatch(/Mindestleistung/);
    }
    // ab Rentenbeginn (auch Tod genau mit Rentenbeginn) unverändert
    for (let t = on.n; t < on.T; t++) expect(ins.heir(t).val).toBe(base.parts.ins!.heir(t).val);
    // Ansparphase, Kapital und Rente unverändert
    expect(on.capR).toBe(base.capR); expect(on.net).toEqual(base.net);
  });
  it('positive Nettorendite: keine Wirkung', () => {
    const p = P();
    const a = combo(p, S({ ins: 150 })).parts.ins!, b = combo(p, S({ ins: 150 }), off).parts.ins!;
    for (let t = 0; t <= 100 - p.a0; t++) { expect(a.heir(t).val).toBe(b.heir(t).val); expect(a.heir(t).note).toBe(b.heir(t).note); }
  });
  it('Kombi: gemeinsamer Erbfall nutzt die Mindestleistung', () => {
    const p = P({ g: -2, dyn: 0 });
    const split = S({ ins: 100, etf: 50 });
    const a = combo(p, split).heir(10).val, b = combo(p, split, off).heir(10).val;
    const ins = combo(p, split).parts.ins!;
    let paid = 0; for (let t = 0; t < 10; t++) paid += 1200;
    expect(a - b).toBeCloseTo(paid - (ins.vals[10] as number), 6);
  });
});
