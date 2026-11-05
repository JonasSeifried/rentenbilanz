// Steuerprofil (neu, nicht im Original): Kirchensteuer (kist) und Zusammenveranlagung (married, incSpouse, incSpouseRet).
// Erwartete Werte aus einer eigenen, von der Engine unabhängigen Veranlagung nach § 32a Abs. 1/5, § 10 Abs. 1 Nr. 4,
// § 10c, § 10a Abs. 2, § 2 Abs. 6, § 20 Abs. 9, § 32d Abs. 1 S. 3–5, § 51a Abs. 2 EStG und §§ 3, 4 SolZG.
// Herleitung und Quellen: docs/kirchensteuer-splitting.md.
import { describe, expect, it } from 'vitest';
import { analyze } from '../src/lib/engine/analyze';
import { combo, emptySplit, type Split } from '../src/lib/engine/combo';
import { readParams } from '../src/lib/engine/core';
import { ALL_FIXES, type FixId } from '../src/lib/engine/fixes';
import { DEFAULTS, type Inputs } from '../src/lib/engine/inputs';
import { decodeState, encodeState } from '../src/lib/link';
import { sanitize } from '../src/lib/storage';
import { rechenweg } from '../src/lib/rechenweg';
import { changedSettings } from '../src/lib/settingsChanged';

const P = (patch: Partial<Inputs> = {}) => readParams({ ...DEFAULTS, ...patch });
const without = (...ids: FixId[]) => ({ fixes: new Set([...ALL_FIXES].filter(f => !ids.includes(f))) });
const only = (k: keyof Split, v: number): Split => ({ ...emptySplit(), [k]: v });

/** Tarif 2026 (§ 32a Abs. 1), zvE und Steuer auf volle Euro abgerundet; Inflation 0 in allen Proben. */
function est(v: number): number {
  const x = Math.floor(Math.max(0, v)), y = (x - 12348) / 1e4, z = (x - 17799) / 1e4;
  const raw = x <= 12348 ? 0 : x <= 17799 ? (914.51 * y + 1400) * y
    : x <= 69878 ? (173.10 * z + 2397) * z + 1034.87
    : x <= 277825 ? .42 * x - 11135.63 : .45 * x - 19470.38;
  return Math.floor(Math.max(0, raw));
}
/** Eine Veranlagung: ESt (Splitting: 2 × Tarif der Hälfte), Zulage z hinzugerechnet, Soli und KiSt darauf, KiSt als SA. */
function assess(x: number, o: { kist?: number; married?: boolean; ded?: number; z?: number } = {}) {
  const k = (o.kist ?? 0) / 100, m = !!o.married, ded = o.ded ?? 0, z = o.z ?? 0;
  const tariff = (v: number) => m ? 2 * est(Math.max(0, v) / 2) : est(v);
  const sap = m ? 72 : 36, fg = m ? 40700 : 20350;
  let E = tariff(x - ded), K = k * (E + z);
  for (let i = 0; i < 60; i++) { E = tariff(x - ded - Math.max(0, K - sap)); K = k * (E + z); }
  const A = E + z, soli = Math.max(0, Math.min(.055 * A, .119 * (A - fg)));
  return { est: E, kist: K, soli, total: A + soli + K };
}
/** Zusätzliche AVD-Erstattung eines Jahres (§ 10a Abs. 2 nach tariflicher ESt, § 2 Abs. 6). */
function avdRefund(x: number, ded: number, z: number, o: { kist?: number; married?: boolean } = {}) {
  const b = assess(x, o), a = assess(x, { ...o, ded, z });
  return { useSA: b.est - a.est > z, refund: b.est - a.est > z ? b.total - a.total : 0 };
}

describe('Steuerprofil aus: bitgleich', () => {
  it('Partner-Einkommen wirkt nur verheiratet; Standard unverändert', () => {
    const base = analyze(P()), other = analyze(P({ incSpouse: 0, incSpouseRet: 99999 }));
    expect(other.stats).toStrictEqual(base.stats);
    for (const k of ['etf', 'avd', 'ins'] as const) {
      expect(other.res[k]!.net).toStrictEqual(base.res[k]!.net);
      expect(other.res[k]!.heir(28)).toStrictEqual(base.res[k]!.heir(28));
    }
    expect(other.res.avd!.heirMarried!(28)).toStrictEqual(base.res.avd!.heirMarried!(28));
  });
  it('Eingaben des Originals ohne die neuen Schlüssel: keine Kirchensteuer, ledig', () => {
    const { kist: _a, married: _b, incSpouse: _c, incSpouseRet: _d, ...legacy } = DEFAULTS;
    const p = readParams(legacy as Inputs);
    expect(p.kist).toBe(0); expect(p.married).toBe(false);
    expect(readParams({ ...DEFAULTS, kist: 9 }).kist).toBeCloseTo(0.09, 12);
    expect(readParams({ ...DEFAULTS, kist: 50 }).kist).toBe(0.1);
  });
});

describe('Kirchensteuer', () => {
  it('Abgeltungsteuer nach § 32d Abs. 1 S. 4: e/(4 + k) zzgl. Soli und KiSt', () => {
    const x = { basis: 3.2, infl: 0 }, fixes = without('vpTaxSale', 'capitalGuenstiger');
    const r0 = combo(P(x), only('etf', 150), fixes).parts.etf!;
    for (const [k, rate] of [[9, 1.145 / 4.09], [8, 1.135 / 4.08]] as const) {
      const rk = combo(P({ ...x, kist: k }), only('etf', 150), fixes).parts.etf!;
      const t = r0.abgTax.findIndex(v => v > 0);
      expect(t).toBeGreaterThan(0);
      expect(rk.abgTax[t]).toBeCloseTo(r0.abgTax[t] / .26375 * rate, 9);
    }
    // 100 € Kapitalerträge bei 9 %: ESt 24,45 €, Soli 1,34 €, KiSt 2,20 € = 27,995 € statt 26,375 €
    expect(100 / 4.09 * 1.145).toBeCloseTo(27.9951, 4);
  });
  it('Leibrente: Einkommensteuer einschließlich Soli und Kirchensteuer, KiSt über 36 € als Sonderausgabe', () => {
    for (const k of [8, 9]) {
      const p = P({ infl: 0, insLump: false, incRet: 30000, kist: k, setAll: 300, insM: 300 });
      const c = combo(p, only('ins', 300)), r = c.parts.ins!;
      const X = r.taxBase[c.n];
      expect(X).toBeGreaterThan(1000);
      expect(r.incTax[c.n]).toBeCloseTo(assess(30000 + X, { kist: k }).total - assess(30000, { kist: k }).total, 9);
    }
    // Ohne Abzug als Sonderausgabe wäre die Mehrsteuer höher (Probe, dass § 10 Abs. 1 Nr. 4 wirkt).
    const a = assess(45000, { kist: 9 }), noDed = est(45000) * 1.09;
    expect(a.est).toBeLessThan(est(45000));
    expect(a.est + a.kist).toBeLessThan(noDed);
  });
  it('AVD-Erstattung: Günstigerprüfung nach tariflicher ESt, KiSt auf ESt einschließlich Zulage', () => {
    for (const incWork of [20000, 38000, 110000]) {
      const p = P({ a0: 60, R: 65, H: 85, infl: 0, dyn: 0, reinvest: false, incWork, kist: 9 });
      const c = combo(p, only('avd', 150));
      const exp = avdRefund(incWork, 1800 + 540, 540, { kist: 9 });
      expect(c.parts.avd!.ref! / c.n).toBeCloseTo(exp.refund, 8);
    }
  });
  it('Erben zahlen dieselbe Kirchensteuer auf die Abgeltungsteuer, ohne Splitting', () => {
    const x = { a0: 40, R: 65, basis: 0, infl: 0, dyn: 0, etfM: 500, setAll: 500, incHeir: 38000 };
    const idx = 10;
    for (const [k, rate] of [[0, .26375], [9, 1.145 / 4.09]] as const) {
      const r = combo(P({ ...x, kist: k }), only('etf', 500)).parts.etf!;
      const V = r.vals[idx]!, own = 500 * 12 * idx;
      const taxable = Math.max(0, (V - own) * .7 - 1000);
      // Günstigerprüfung der Erben: Tarif bei 38.000 € ist teurer als die Abgeltungsteuer
      expect(assess(38000 + taxable, { kist: k }).total - assess(38000, { kist: k }).total).toBeGreaterThan(taxable * rate);
      expect(r.heir(idx).val).toBeCloseTo(V - taxable * rate, 6);
    }
  });
});

describe('Zusammenveranlagung', () => {
  it('Leibrente im Splittingtarif mit dem Einkommen des Partners (ab Rentenbeginn)', () => {
    for (const [spouse, k] of [[0, 0], [10000, 0], [60000, 9]] as const) {
      const p = P({ infl: 0, insLump: false, incRet: 30000, married: true, incSpouse: 99999, incSpouseRet: spouse, kist: k, setAll: 300, insM: 300 });
      const c = combo(p, only('ins', 300)), r = c.parts.ins!, X = r.taxBase[c.n], base = 30000 + spouse;
      expect(r.incTax[c.n]).toBeCloseTo(assess(base + X, { married: true, kist: k }).total - assess(base, { married: true, kist: k }).total, 9);
    }
  });
  it('AVD-Erstattung mit Splitting: gemeinsames zvE, eigene Zulage (Partner ohne eigenen Vertrag)', () => {
    for (const [incWork, spouse, k] of [[38000, 0, 0], [38000, 38000, 0], [110000, 0, 0], [110000, 0, 9], [60000, 20000, 8]] as const) {
      const p = P({ a0: 60, R: 65, H: 85, infl: 0, dyn: 0, reinvest: false, incWork, married: true, incSpouse: spouse, incSpouseRet: 0, kist: k });
      const c = combo(p, only('avd', 150));
      const exp = avdRefund(incWork + spouse, 2340, 540, { married: true, kist: k });
      expect(c.parts.avd!.ref! / c.n).toBeCloseTo(exp.refund, 8);
    }
  });
  it('Soli-Freigrenze 40.700 € im Splitting: bei 110.000 € gemeinsam kein Soli', () => {
    const m = assess(110000, { married: true }), s = assess(110000);
    expect(m.soli).toBe(0);
    expect(m.est).toBe(2 * est(55000));
    expect(s.soli).toBeGreaterThan(0);
  });
  it('Sparer-Pauschbetrag 2.000 € für Ehegatten (§ 20 Abs. 9 S. 2), Erben weiter 1.000 €', () => {
    const x = { a0: 40, R: 65, H: 85, basis: 0, infl: 0, dyn: 0, etfM: 500, setAll: 500, incRet: 20000 };
    const fixes = without('capitalGuenstiger');
    const s = combo(P(x), only('etf', 500), fixes), m = combo(P({ ...x, married: true, incSpouseRet: 0 }), only('etf', 500), fixes);
    const n = s.n, xs = s.parts.etf!.abgTax[n] / .26375 + 1000; // steuerpflichtiger Gewinn nach Teilfreistellung
    expect(xs).toBeGreaterThan(2000);
    expect(m.parts.etf!.abgTax[n]).toBeCloseTo((xs - 2000) * .26375, 8);
    // Erbfall vor Rentenbeginn: Depot gleich, Erben mit eigenem Pauschbetrag und Grundtarif ⇒ identisch
    const idx = 10;
    expect(m.parts.etf!.vals[idx]).toBe(s.parts.etf!.vals[idx]);
    expect(m.parts.etf!.heir(idx).val).toBeCloseTo(s.parts.etf!.heir(idx).val, 9);
  });
  it('AVD-Übertrag auf den Partner: spätere Steuer mit dessen Einkommen im Alter, Grundtarif', () => {
    const x = { a0: 40, R: 65, H: 85, infl: 0, dyn: 0, reinvest: false, married: true, incSpouse: 0, incSpouseRet: 15000, kist: 9 };
    const c = combo(P(x), only('avd', 150)), r = c.parts.avd!, idx = 10, yrs = 85 - 65;
    const V = r.vals[idx]!, lt = yrs * (assess(15000 + V / yrs, { kist: 9 }).total - assess(15000, { kist: 9 }).total);
    expect(r.heirMarried!(idx).val).toBeCloseTo(V - lt, 6);
  });
});

describe('Link und Speicher', () => {
  it('kist/married/incSpouse/incSpouseRet hin und zurück; alte Links bleiben ledig ohne Kirchensteuer', () => {
    const inp = { ...DEFAULTS, kist: 9, married: true, incSpouse: 25000, incSpouseRet: 12000 };
    const q = encodeState(inp, 'overview');
    expect(q).toMatch(/kist=9/); expect(q).toMatch(/married=1/);
    expect(decodeState('#' + q).inputs).toMatchObject({ kist: 9, married: true, incSpouse: 25000, incSpouseRet: 12000 });
    expect(decodeState('#v=1&a0=40').inputs).toMatchObject({ kist: 0, married: false });
    expect(decodeState('#v=1&kist=99').inputs!.kist).toBe(0); // außerhalb der Grenzen ignoriert
    expect(sanitize({ kist: 8, married: true })).toMatchObject({ kist: 8, married: true });
  });
});

describe('Texte', () => {
  const md = (x: Partial<Inputs>) => { const inp = { ...DEFAULTS, ...x }; return rechenweg(inp, analyze(readParams(inp)), ''); };
  it('Rechenweg nennt das Steuerprofil so, wie gerechnet wird', () => {
    const off = md({});
    expect(off).toMatch(/Grundtarif ledig/); expect(off).toMatch(/keine Kirchensteuer/); expect(off).toMatch(/Abgeltungsteuer 26,375 %/);
    const on = md({ kist: 9, married: true, incSpouse: 30000, incSpouseRet: 15000 });
    expect(on).toMatch(/Splittingtarif/); expect(on).toMatch(/Partner 30\.000 € vor und 15\.000 € ab Rentenbeginn/);
    expect(on).toMatch(/Kirchensteuer 9 %/); expect(on).toMatch(/Abgeltungsteuer 27,9951 %/); expect(on).toMatch(/Sparer-Pauschbetrag 2\.000 €/);
    expect(on).toMatch(/\| kist \| Kirchensteuersatz \(0 = keine\) \| 9 \|  \| % \|/);
  });
  it('Einstellungs-Badge: Partner-Einkommen zählt nur verheiratet', () => {
    expect(changedSettings({ ...DEFAULTS, incSpouse: 1000 })).toEqual([]);
    expect(changedSettings({ ...DEFAULTS, married: true, incSpouse: 1000 })).toEqual(['married', 'incSpouse']);
    expect(changedSettings({ ...DEFAULTS, kist: 8 })).toEqual(['kist']);
  });
});
