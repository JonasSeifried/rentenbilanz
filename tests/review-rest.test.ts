import { describe, expect, it } from 'vitest';
import { combo, comboStats, emptySplit, SPLIT_KEYS, type Split } from '../src/lib/engine/combo';
import { readParams, tax2026 } from '../src/lib/engine/core';
import { ALL_FIXES, type FixId } from '../src/lib/engine/fixes';
import { DEFAULTS, type Inputs } from '../src/lib/engine/inputs';
import { decodeState, encodeState } from '../src/lib/link';
import { sanitize } from '../src/lib/storage';
const P = (patch: Partial<Inputs> = {}) => readParams({ ...DEFAULTS, ...patch });
const S = (patch: Partial<Split>) => ({ ...emptySplit(), ...patch });
const without = (...ids: FixId[]) => ({ fixes: new Set([...ALL_FIXES].filter(f => !ids.includes(f))) });

describe('R3 – gemeinsamer Jahresantrag', () => {
  for (const incRet of [0, 5000, 20000, 90000]) for (const shift of [false, true]) {
    it(`alle Erträge, nach KV, Einkommen ${incRet}, Umschichtung ${shift}`, () => {
      const p = P({ incRet, incWork: 9000, studyEnd: 30, incStudy: 6000, kvOn: true, shift, einmal: true });
      const split = S({ etf: 400, fond: 500, avd: 800, ins: 300 });
      const a = combo(p, split), b = combo(p, split, without('capitalGuenstiger'));
      for (let t = 0; t < a.T; t++) {
        expect(a.kv[t]).toBe(b.kv[t]); // Quellenabzug/Finanzierungsverkäufe bleiben identisch
        for (const k of SPLIT_KEYS) expect(a.parts[k]!.vals[t]).toBe(b.parts[k]!.vals[t]);
        const index = a.I(t), paid = b.abgTax[t], K = paid / .26375;
        let income = (t < a.n ? p.a0 + t < p.studyEnd ? p.incStudy : p.incWork : incRet) * index;
        income += Object.values(a.parts).reduce((v, r) => v + r.taxBase[t], 0);
        if (t >= a.n) income -= a.kv[t];
        // AVD-Beitrag 800 €/Monat: förderfähige 1.800 €, reguläre Zulage 540 €.
        const liability = (x: number) => t < a.n
          ? Math.min(tax2026(Math.max(0, x), index), tax2026(Math.max(0, x - 2340), index) + 540)
          : tax2026(Math.max(0, x), index);
        const tax = Math.min(paid, liability(income + K) - liability(income));
        expect(a.abgTax[t]).toBeCloseTo(tax, 6);
        expect(a.net[t] - b.net[t]).toBeCloseTo(paid - tax, 6);
        expect(Object.values(a.parts).reduce((v, r) => v + r.abgTax[t], 0)).toBeCloseTo(a.abgTax[t], 6);
      }
    });
  }
  it('auch kurze Versicherungsverträge teilen den Freibetrag und nehmen am Jahresantrag teil', () => {
    const p = P({ a0: 60, R: 65, incRet: 0, insEff: 0, basis: 0 });
    const a = combo(p, S({ ins: 500 })), b = combo(p, S({ ins: 500 }), without('capitalGuenstiger'));
    expect(a.abgTax[a.n]).toBe(0);
    expect(b.abgTax[b.n]).toBeGreaterThan(0);
    expect(a.parts.ins!.kapNet).toBe(b.parts.ins!.kapNet); // Erstattung kein Anfangskapital
    expect(a.net[a.n] - b.net[b.n]).toBeCloseTo(b.abgTax[b.n], 7);
  });
});

describe('R4 – unabhängige Jahresbilanz eines thesaurierenden Depots', () => {
  for (const kvRate of [0, 10, 30]) it(`Zufluss, Basis, Steuerverkauf, KV und Netto (${kvRate} %)`, () => {
    const p = P({ a0: 60, R: 65, H: 85, infl: 0, etfTer: 0, g: 10, gPay: 4, basis: 10, incWork: 100000, incRet: 60000, kvGrossRet: 20000, kvOn: true, kvRate });
    const c = combo(p, S({ etf: 1000 }));
    let V = 0, B = 0, pending = 0;
    for (let t = 0; t < c.tH; t++) {
      expect(c.parts.etf!.vals[t]).toBeCloseTo(V, 6);
      // Tod vor dem ersten Werktag: VP und kompletter Verkauf im Jahr der Erben.
      const gain = .7 * (pending + (V - B - pending));
      const flatHeir = Math.max(0, gain - 1000) * .26375;
      const tarHeir = tax2026(p.incHeir + Math.max(0, gain - 1000)) - tax2026(p.incHeir);
      expect(c.heir(t).val).toBeCloseTo(V - Math.min(flatHeir, tarHeir), 6);
      const vpTax = Math.max(0, .7 * pending - 1000) * .26375;
      const free = Math.max(0, 1000 - .7 * pending);
      B += pending;
      const q = V > 0 ? Math.max(0, (V - B) / V) : 0;
      const sale = vpTax / (1 - .7 * q * .26375);
      const saleGain = sale * q;
      if (V > 0) B *= 1 - sale / V;
      V -= sale;
      let W = 0, g = 0;
      if (t >= c.n) {
        const remaining = c.tH - t;
        W = remaining === 1 ? V : V * .04 / (1.04 * (1 - 1.04 ** -remaining));
        g = V > 0 ? Math.max(0, W * (V - B) / V) : 0;
        B *= V > 0 ? 1 - W / V : 0; V -= W;
      }
      const payoutTax = Math.max(0, .7 * g - free) * .26375;
      const opening = V, monthly = t < c.n ? 1000 : 0, growth = t < c.n ? 1.1 : 1.04;
      for (let m = 0; m < 12; m++) { V = (V + monthly) * growth ** (1 / 12); B += monthly; }
      const kv = t < c.n ? 0 : p.kvRate * Math.min(49750, .7 * (pending + saleGain + g));
      const relief = t < c.n ? 0 : tax2026(60000) - tax2026(60000 - kv);
      expect(c.abgTax[t]).toBeCloseTo(sale + payoutTax, 6);
      expect(c.kv[t]).toBeCloseTo(kv, 6);
      expect(c.net[t]).toBeCloseTo(W - payoutTax - kv + relief, 6);
      pending = Math.min((opening + monthly * 6.5) * .1 * .7, Math.max(0, V - opening - monthly * 12));
      expect(c.parts.etf!.vals[t + 1]).toBeCloseTo(V, 6);
    }
    expect(c.abgTax[0]).toBe(0);
    expect(V).toBeCloseTo(0, 6);
    expect(pending).toBeCloseTo(0, 6);
  });
});

describe('R5/R7 – getrennte Eingaben und ein Pauschbetrag', () => {
  it('KV-Brutto ändert keine Tarifbasis und wird niemals aus incRet geschätzt', () => {
    expect(P({ incRet: 45000 }).kvGrossRet).toBe(20000);
    const p = P({ kvOn: true, incRet: 45000, kvGrossRet: 69750 });
    const c = combo(p, S({ avd: 500, ins: 500, etf: 500 }));
    expect(c.kv.every(x => x === 0)).toBe(true);
    const b = combo({ ...p, kvGrossRet: 0 }, S({ avd: 500, ins: 500, etf: 500 }));
    expect(b.parts.avd!.taxBase).toEqual(c.parts.avd!.taxBase);
    expect(b.kv[c.n]).toBeGreaterThan(0);
  });
  it('hälftige Versicherung nutzt höchstens einen Freibetrag, Fonds bekommen nur den Rest', () => {
    const p = P({ incRet: 60000, basis: 0, insM: 150 });
    const a = combo(p, S({ ins: 150, etf: 150 })), b = combo(p, S({ ins: 150, etf: 150 }), without('insuranceAllowance'));
    expect(b.parts.ins!.taxBase[a.n] - a.parts.ins!.taxBase[a.n]).toBe(1000);
    const expected = tax2026(p.incRet * a.I(a.n) + b.parts.ins!.taxBase[a.n], a.I(a.n)) - tax2026(p.incRet * a.I(a.n) + a.parts.ins!.taxBase[a.n], a.I(a.n));
    expect(a.parts.ins!.kapNet! - b.parts.ins!.kapNet!).toBeCloseTo(expected, 7);
    expect(a.parts.etf!.abgTax[a.n] - b.parts.etf!.abgTax[b.n]).toBeCloseTo(263.75, 7);
    expect(a.parts.ins!.taxBase.slice(a.n + 1).every(x => x === 0)).toBe(true);
  });
  it('Links/Speicher behalten alle neuen Optionen; alte Links bekommen unabhängige Standardwerte', () => {
    const inputs = { ...DEFAULTS, kvGrossRet: 54000, payResidual: true, fundingDelay: true, indexAllowance: true, avdPayCost: 1.2, etfPayTer: .5, fondPayTer: .8 };
    expect(decodeState(encodeState(inputs, 'settings')).inputs).toEqual(inputs);
    expect(sanitize(inputs)).toEqual(inputs);
    expect(decodeState('v=1&incRet=45000').inputs!.kvGrossRet).toBe(20000);
  });
});

describe('V1/V2/V3 und Auszahlkosten – explizite Sensitivitäten', () => {
  it('Restprofil zahlt jährlich Rest/Restjahre; Kostenwechsel erst ab Rente', () => {
    const p = P({ payResidual: true, basis: 0, incRet: 100000, etfPayTer: 1 });
    const c = combo(p, S({ etf: 150 })), b = combo({ ...p, etfPayTer: -1 }, S({ etf: 150 }));
    expect(c.capR).toBe(b.capR);
    const firstGross = c.net[c.n] + c.incTax[c.n] + c.abgTax[c.n] + c.kv[c.n];
    expect(firstGross).toBeCloseTo(c.capR / (p.H - p.R), 6);
    expect(comboStats(p, c).cumHReal).toBeLessThan(comboStats(p, b).cumHReal);
  });
  it('Verzug: identische Ansprüche, letzte Zahlung nach Rentenbeginn, ohne Rendite kein Geldverlust', () => {
    const p = P({ g: 0, gPay: 0, avdCost: 0, etfTer: 0, basis: 0, infl: 0, incRet: 0 });
    const a = combo(p, S({ avd: 150 })), b = combo({ ...p, fundingDelay: true }, S({ avd: 150 }));
    expect(b.parts.avd!.zul).toBe(a.parts.avd!.zul);
    expect(b.parts.avd!.ref).toBe(a.parts.avd!.ref);
    expect(a.capR - b.capR).toBeCloseTo(540 + a.parts.avd!.ref! / a.n, 6);
    expect(comboStats(p, b).cumHReal).toBeCloseTo(comboStats(p, a).cumHReal, 6);
  });
  it('höhere Auszahlkosten ändern weder Beiträge noch Förderansprüche; Indexierung ist ausdrücklich optional', () => {
    const p = P(), s = S({ avd: 500, etf: 300 });
    const a = combo(p, s), b = combo({ ...p, avdPayCost: .02 }, s);
    expect(a.capR).toBe(b.capR); expect(a.own).toBe(b.own); expect(a.foerder).toBe(b.foerder);
    expect(comboStats(p, b).cumHReal).toBeLessThan(comboStats(p, a).cumHReal);
    expect(comboStats(p, combo({ ...p, indexAllowance: true }, s)).cumHReal).toBeGreaterThan(comboStats(p, a).cumHReal);
    expect(P().indexAllowance).toBe(false);
  });
});

it('R4: zwei Teilfreistellungen, erste VP nach Rentenbeginn und KV-Bilanz ohne Steuerverkauf', () => {
  for (const shift of [false, true]) {
    const p = P({ g: 0, safeRate: 0, etfTer: 0, etfPayTer: 0, infl: 0, kvOn: true, kvRate: 10, shift });
    const c = combo(p, S({ etf: 10 })), C = c.capR, years = p.H - p.R;
    const W0 = C * .04 / (1.04 * (1 - 1.04 ** -years));
    const V = (C - W0) * 1.04, B = C - W0;
    const vp = Math.min(B * .032 * .7, V - B);
    const W1 = V * .04 / (1.04 * (1 - 1.04 ** -(years - 1)));
    const gain = Math.max(0, W1 * (V - B - vp) / V);
    const tf = shift ? .3 * .7 + .7 : .7;
    expect(c.kv[c.n]).toBeCloseTo(0, 8);
    expect(c.kv[c.n + 1]).toBeCloseTo(.1 * tf * (vp + gain), 8);
    expect(c.abgTax[c.n + 1]).toBe(0);
  }
});

it('R3 im Erbfall: Fonds gemeinsam mit AVD-Erträgen und erster Restrente im Tarif', () => {
  const p = P({ incWork: 0, incHeir: 5000, insLump: false, gz: 20 });
  const s = S({ etf: 150, fond: 150, avd: 9, ins: 150 }); // keine Zulage, keine AVD-Erstattung
  const a = combo(p, s), b = combo(p, s, without('capitalGuenstiger'));
  for (const idx of [20, a.n, a.n + 3]) {
    const old = b.heir(idx), curr = a.heir(idx), d = old.detail!;
    const base = p.incHeir * a.I(idx), avd = a.parts.avd!, V = avd.vals[idx]!;
    // Historische H2-Zuordnung ist weiterhin ausdrücklich eine offene Näherung.
    const own = idx <= a.n ? 108 * idx : 108 * a.n * V / avd.capAVD!;
    const X = Math.max(0, V - own) + (idx > a.n ? a.parts.ins!.annual! * .17 : 0);
    expect(d.incomeTax).toBeCloseTo(tax2026(base + X, a.I(idx)) - tax2026(base, a.I(idx)), 6);
    const K = d.abgTax / .26375;
    const tariff = tax2026(base + X + K, a.I(idx)) - tax2026(base + X, a.I(idx));
    expect(curr.detail!.incomeTax).toBe(d.incomeTax);
    expect(curr.detail!.abgTax).toBeCloseTo(Math.min(d.abgTax, tariff), 6);
    expect(curr.val - old.val).toBeCloseTo(d.abgTax - curr.detail!.abgTax, 6);
  }
});

it('R1/R3: AVD-Teilauszahlung mit marginalem Netto einschließlich Kapital-Günstigerprüfung', () => {
  const p = P({ incRet: 5000, kvOn: true, einmal: true });
  const s = S({ avd: 150, etf: 150 }), a = combo(p, s), b = combo(p, s, without('capitalGuenstiger'));
  const n = a.n, index = a.I(n), L = .3 * a.parts.avd!.capAVD!;
  const kvL = p.kvRate * Math.min(L, 10 * (69750 - p.kvGrossRet) * index);
  const income = p.incRet * index + Object.values(a.parts).reduce((v, r) => v + r.taxBase[n], 0) - a.kv[n];
  const paid = b.abgTax[n], K = paid / .26375;
  const total = (x: number) => tax2026(x, index) + Math.min(paid, tax2026(x + K, index) - tax2026(x, index));
  expect(a.lumpNet).toBeCloseTo(L - kvL - (total(income) - total(income - L + kvL)), 6);
});

describe('V2 – Erbfall bei Förderverzug', () => {
  it('fordert nur bereits gutgeschriebene Förderung zurück', () => {
    for (const fundingDelay of [false, true]) {
      const p = P({ fundingDelay, g: 0, gPay: 0, avdCost: 0, etfTer: 0, infl: 0, real: false, basis: 0 });
      const c = combo(p, S({ avd: 150 }));
      // Nullrendite: Nicht-Ehepartner erhalten genau die eigenen Beiträge zurück, auch wenn Förderung noch aussteht.
      for (const idx of [1, 2, 5, 20]) {
        expect(c.parts.avd!.heir(idx).val).toBeCloseTo(1800 * idx, 6);
        expect(c.heir(idx).val).toBeCloseTo(1800 * idx, 6);
      }
    }
  });
});
