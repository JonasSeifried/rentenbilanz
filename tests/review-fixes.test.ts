import { describe, expect, it } from 'vitest';
import { analyze } from '../src/lib/engine/analyze';
import { combo, comboStats, emptySplit, SPLIT_KEYS, type Split } from '../src/lib/engine/combo';
import { readParams, tax, tax2026 } from '../src/lib/engine/core';
import { ALL_FIXES, type FixId } from '../src/lib/engine/fixes';
import { DEFAULTS, type Inputs } from '../src/lib/engine/inputs';

const P = (patch: Partial<Inputs> = {}) => readParams({ ...DEFAULTS, kvGrossRet: patch.incRet ?? DEFAULTS.incRet, ...patch });
const S = (s: Partial<Split>): Split => ({ ...emptySplit(), ...s });
const without = (...ids: FixId[]) => ({ fixes: new Set([...ALL_FIXES].filter(f => !ids.includes(f))) });

describe('R8 – gesetzliche Rundung im nominalen Steuerjahr', () => {
  it('Grundfreibetrag, volle Einkommen-Euro und voller ESt-Euro (§ 32a)', () => {
    expect(tax2026(12348.99)).toBe(0);
    // 0,42 × 70.000 − 11.135,63 = 18.264,37; unter der Soli-Freigrenze.
    expect(tax2026(70000.99)).toBe(18264);
    expect(tax2026(70001.99)).toBe(18264);
    expect(tax2026(70002)).toBe(18265);
    expect(tax(70000)).toBeCloseTo(18264.37, 8); // Referenz bleibt unverändert.
  });

  it('rundet erst nach Anwendung des indexierten Tarifs, nicht auf einen heutigen Euro', () => {
    expect(tax2026(140000.99, 2)).toBe(36528);
    expect(tax2026(140001.99, 2)).toBe(36529);
    expect(tax2026(0, 2)).toBe(0);
    expect(tax2026(-1000, 2)).toBe(0);
  });
});

describe('R6 – AVD-Sonderausgaben unabhängig von der Zulagenschwelle', () => {
  it('108 € Eigenbeitrag: keine Zulage/Bonus, aber Sonderausgabenabzug', () => {
    const p = P({ avdM: 9, kids: 2, kidsFrom: 16, kidsYears: 100 });
    const c = combo(p, S({ avd: 9 })), a = c.parts.avd!;
    expect(a.zul).toBe(0);
    let expected = 0;
    for (let t = 0; t < c.n; t++) {
      expected += tax2026(p.incWork * c.I(t), c.I(t)) - tax2026(p.incWork * c.I(t) - 108, c.I(t));
    }
    expect(a.ref).toBeCloseTo(expected, 8);
    expect(a.ref).toBeGreaterThan(0);
    expect(comboStats(p, c).cumHReal).toBeGreaterThan(comboStats(p, combo(p, S({ avd: 9 }), without('avdSmallContribution'))).cumHReal);
  });

  it('kein Beitrag: keine Erstattung; ab 120 € greifen Grund-/Kinderzulage und Bonus unverändert', () => {
    expect(combo(P(), S({ avd: 0 }), { parts: ['avd'] }).parts.avd!.ref).toBe(0);
    for (const amount of [10, 25, 150, 500]) {
      const p = P({ kids: 1, kidsFrom: 16, kidsYears: 100 });
      const a = combo(p, S({ avd: amount })).parts.avd!;
      const b = combo(p, S({ avd: amount }), without('avdSmallContribution')).parts.avd!;
      expect(a.zul).toBe(b.zul); expect(a.ref).toBe(b.ref); expect(a.net).toEqual(b.net);
    }
  });

  it('Dynamik überschreitet 120 €: Bonus erst im ersten zulageberechtigten Jahr, genau einmal', () => {
    const p = P({ dyn: 20 });
    const a = combo(p, S({ avd: 9 })).parts.avd!;
    const b = combo({ ...p, bonus: false }, S({ avd: 9 })).parts.avd!;
    expect(a.vals[1]).toBe(b.vals[1]);
    expect(a.zul! - b.zul!).toBeCloseTo(200, 8);
    expect(a.vals[2]! - b.vals[2]!).toBeCloseTo(200, 8);
  });
});

describe('R1 – gemeinsamer KV/PV-Sonderausgabenabzug', () => {
  for (const patch of [
    { kvOn: true },
    { kvOn: true, incRet: 0, insLump: false },
    { kvOn: true, incRet: 60000, einmal: true },
    { kvOn: true, insLump: false, incRet: 20000 },
  ]) it(`Steuer auf übrige Rente und Zusatzprodukte nach gemeinsamem Beitrag (${JSON.stringify(patch)})`, () => {
    const p = P(patch), split = S({ etf: 150, avd: 150, ins: 150 });
    const c = combo(p, split), before = combo(p, split, without('kvDeductible'));
    expect(c.kv).toEqual(before.kv);
    for (let t = c.n; t < c.T; t++) {
      const I = c.I(t), base = p.incRet * I;
      const X = Object.values(c.parts).reduce((s, r) => s + r.taxBase[t], 0);
      const expected = tax2026(Math.max(0, base + X - c.kv[t]), I) - tax2026(base, I);
      expect(c.incTax[t]).toBeCloseTo(expected, 7);
      expect(c.net[t] - before.net[t]).toBeCloseTo(before.incTax[t] - expected + before.abgTax[t] - c.abgTax[t], 7);
      expect(Object.values(c.parts).reduce((s, r) => s + r.incTax[t], 0)).toBeCloseTo(c.incTax[t], 7);
      expect(c.net[t]).toBeGreaterThanOrEqual(before.net[t] - 1e-7);
    }
  });

  it('ETF allein: Entlastung der Steuer auf die übrige Rente; kein Abzug ohne Beitrag', () => {
    const c = combo(P({ kvOn: true }), S({ etf: 150 }));
    expect(c.incTax[c.n]).toBeLessThan(0);
    for (const patch of [{ kvOn: false }, { kvOn: true, kvRate: 0 }, { kvOn: true, incRet: 90000 }]) {
      const p = P(patch);
      expect(combo(p, S({ etf: 150, avd: 150 })).net).toEqual(combo(p, S({ etf: 150, avd: 150 }), without('kvDeductible')).net);
    }
  });

  it('30-%-Auszahlung: marginale Steuer nach Abzug statt doppelt in der Monatsrente', () => {
    const p = P({ kvOn: true, einmal: true }), c = combo(p, S({ avd: 150 }), without('capitalGuenstiger'));
    const a = c.parts.avd!, n = c.n, I = c.I(n), L = .3 * a.capAVD!;
    const kvL = p.kvRate * Math.min(L, 10 * (69750 - p.incRet) * I);
    const W = .7 * a.capAVD! / (c.tH - n), income = p.incRet * I + W + L - c.kv[n];
    const expected = L - (tax2026(Math.max(0, income), I) - tax2026(Math.max(0, income - L + kvL), I)) - kvL;
    expect(c.lumpNet).toBeCloseTo(expected, 7);
    expect(a.lumpNet).toBe(c.lumpNet);
    const stats = comboStats(p, c);
    expect(stats.avgMonthly * 12 * (p.H - p.R) + stats.lump).toBeCloseTo(stats.cumH, 7);
  });
});

describe('R2 – Vorabpauschale aus einem Anteilsverkauf finanzieren', () => {
  it('erster Sparjahrgang: Verkaufserlös deckt VP-Steuer und eigene Gewinnsteuer exakt', () => {
    const p = P({ etfTer: 0, g: 10, basis: 10 });
    const c = combo(p, S({ etf: 10000 }), without('vpNextYear')), f = c.parts.etf!;
    // Unabhängige Monats-Cashflows des ersten Jahres, vor jeglicher Steuer.
    let gross = 0;
    for (let month = 1; month <= 12; month++) gross += 10000 * Math.pow(1.1, (13 - month) / 12);
    const own = 120000, vp = Math.min(65000 * .1 * .7, gross - own);
    const vpTax = Math.max(0, vp * .7 - 1000) * .26375;
    const q = (gross - own - vp) / gross;
    const sale = gross - f.vals[1]!;
    expect(sale).toBeGreaterThan(vpTax);
    expect(sale - sale * q * .7 * .26375).toBeCloseTo(vpTax, 7);
    expect(f.abgTax[0]).toBeCloseTo(sale, 7);
    // Bei Tod nach dem ersten Sparjahr bleibt die nach dem Steuerverkauf verbliebene Basis bestehen.
    const basis = (own + vp) * (1 - sale / gross);
    const heir = f.vals[1]! - Math.max(0, (f.vals[1]! - basis) * .7 - 1000) * .26375;
    expect(f.heir(1).val).toBeCloseTo(heir, 7);
    expect(f.own).toBeCloseTo(10000 * 12 * c.n, 5);
  });

  it('kein Basiszins: unveränderte Ergebnisse; durch Pauschbetrag gedeckte erste VP ohne Verkauf', () => {
    const p = P({ basis: 0 }), split = S({ etf: 150, avd: 150, ins: 150 });
    const a = combo(p, split), b = combo(p, split, without('vpTaxSale'));
    expect(a.net).toEqual(b.net); expect(a.abgTax).toEqual(b.abgTax);
    const small = combo(P(), S({ etf: 150 })).parts.etf!;
    expect(small.abgTax[0]).toBe(0);
  });

  it('Steuerverkäufe zählen nach Teilfreistellung ins gemeinsame KV-Buch, auch beim sicheren Teil', () => {
    for (const shift of [false, true]) {
      const p = P({ kvOn: true, shift, incRet: 60000 });
      const split = S({ etf: 300, avd: 150, ins: 150, fond: 300 });
      const c = combo(p, split), before = combo(p, split, without('vpTaxSale'));
      expect(comboStats(p, c).cumHReal).toBeLessThan(comboStats(p, before).cumHReal);
      for (let t = c.n; t < c.T; t++) {
        expect(c.kv[t]).toBeLessThanOrEqual(p.kvRate * (69750 - p.incRet) * c.I(t) + 1e-6);
        const X = Object.values(c.parts).reduce((s, r) => s + r.taxBase[t], 0), base = p.incRet * c.I(t);
        expect(c.incTax[t]).toBeCloseTo(tax2026(Math.max(0, base + X - c.kv[t]), c.I(t)) - tax2026(base, c.I(t)), 7);
      }
    }
  });
});

it('aktuelle Engine: Einzelprodukt und analyze identisch, real/nominal gleiche Rangfolge', () => {
  for (const patch of [{}, { kvOn: true }, { shift: true, kvOn: true }, { avdM: 9 }, { a0: 58, insLump: false }]) {
    const p = P({ ...patch, fondOn: true }), a = analyze(p);
    for (const k of SPLIT_KEYS) {
      const c = combo(p, S({ [k]: p[`${k}M`] }), { parts: [k], cost: true });
      expect(c.parts[k]!.net).toEqual(a.res[k]!.net);
      expect(comboStats(p, c).cumHReal).toBe(a.stats[k]!.cumHReal);
    }
    expect(analyze({ ...p, real: false }).lead?.key).toBe(a.lead?.key);
  }
});
