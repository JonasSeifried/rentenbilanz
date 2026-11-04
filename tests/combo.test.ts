// Kombi-Engine (src/lib/engine/combo.ts): Invarianten I1–I8 aus dem Kombi-Design §5.
// I1 ist der „zweite Golden-Test“: Eine Kombination mit nur einem Produkt muss bitgenau model()/analyze() ergeben.
// Er läuft mit ALL_FIXES (Standard), NO_FIXES (Original) und jedem Fix allein, damit Drift zwischen engine.ts
// und combo.ts auf jedem Pfad sofort auffällt.
import { describe, expect, it } from 'vitest';
import { readParams, model, tax, type Params, type ProductKey } from '../src/lib/engine/engine';
import { analyze } from '../src/lib/engine/analyze';
import { ALL_FIXES, FIX_IDS, NO_FIXES, type FixId } from '../src/lib/engine/fixes';
import { DEFAULTS, type Inputs } from '../src/lib/engine/inputs';
import { combo, comboStats, emptySplit, partStats, readCombo, shareAllowance, SPLIT_KEYS, type ComboResult, type Split } from '../src/lib/engine/combo';

const M: Record<ProductKey, keyof Params> = { etf: 'etfM', avd: 'avdM', ins: 'insM', fond: 'fondM' };
const ALL_ON = { etf: true, avd: true, ins: true, fond: true };
const only = (k: ProductKey) => ({ etf: false, avd: false, ins: false, fond: false, [k]: true });
const S = (patch: Partial<Split>): Split => ({ ...emptySplit(), ...patch });

// Benannte Fälle: die 29 aus tests/golden.test.ts plus Kombi-relevante Ränder.
const NAMED: [string, Partial<Inputs>][] = [
  ['Standardwerte', {}],
  ['Original-Defaults', { a0: 23, incWork: 85000, incRet: 40000, studyEnd: 24, incStudy: 35000 }],
  ['Leibrente', { insLump: false }],
  ['Leibrente, lange Garantiezeit, Rente mit 70', { insLump: false, gz: 25, R: 70, H: 95 }],
  ['KV an', { kvOn: true }],
  ['KV an, Leibrente, hohe Rente', { kvOn: true, insLump: false, incRet: 60000 }],
  ['Einmalauszahlung 30 %', { einmal: true }],
  ['Einmalauszahlung mit KV', { einmal: true, kvOn: true }],
  ['Dynamik 3 %', { dyn: 3 }],
  ['Dynamik 5 %, Überlauf', { dyn: 5, setAll: 250, etfM: 250, avdM: 250, insM: 250, fondM: 250 }],
  ['Erbfall 50', { deathAge: 50 }],
  ['Erbfall 80', { deathAge: 80 }],
  ['Erbfall hälftig', { deathAge: 75, heirHalf: true }],
  ['Nicht förderberechtigt im Studium', { a0: 20, studyEnd: 25, incStudy: 8000, eligStudy: false }],
  ['Förderberechtigt im Studium', { a0: 20, studyEnd: 25, incStudy: 8000, eligStudy: true }],
  ['Nominal', { real: false }],
  ['Erstattung ausgegeben', { reinvest: false }],
  ['Kinder', { kids: 2, kidsFrom: 25, kidsYears: 20 }],
  ['Aktiver Fonds', { fondOn: true }],
  ['Ungleiche Beiträge', { etfM: 200 }],
  ['Nur ein Produkt', { avdOn: false, insOn: false }],
  ['Spät einsteigen', { a0: 60, R: 65, H: 85, bonus: true }],
  ['Rendite negativ', { g: -2, gPay: -1 }],
  ['Rendite 0, Basiszins 0, Inflation 0', { g: 0, gPay: 0, basis: 0, infl: 0 }],
  ['Kosten 0', { avdCost: 0, etfTer: 0, insEff: 0 }],
  ['Spitzensteuersatz', { incWork: 300000, incRet: 120000 }],
  ['Kein Einkommen im Alter, KV', { incRet: 0, kvOn: true }],
  ['Bonus aus', { bonus: false }],
  ['Grenzwerte außerhalb', { a0: 10, R: 80, H: 200, deathAge: 5, kvRate: 99, g: 99, infl: -30 }],
  ['High (KV, nahe BBG, Kapitalauszahlung)', { a0: 30, incWork: 110000, incRet: 45000, setAll: 500, etfM: 500, avdM: 500, insM: 500, fondM: 500, kvOn: true }],
  ['KV, Rente 60.000, Einmalauszahlung', { kvOn: true, incRet: 60000, einmal: true }],
  ['Kapitalauszahlung vor 12 Jahren', { a0: 58, R: 67 }],
];

function rng(seed: number) {
  let s = seed;
  const rnd = () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return {
    rnd,
    int: (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1)),
    r1: (lo: number, hi: number) => Math.round((lo + rnd() * (hi - lo)) * 10) / 10,
    b: () => rnd() < 0.5,
  };
}

/** Zufallsszenarien wie im Golden-Test (mulberry32, gleicher Seed). */
function randomInputs(count: number, seed = 20260526): Inputs[] {
  const { rnd, int, r1, b } = rng(seed);
  const out: Inputs[] = [];
  for (let i = 0; i < count; i++) {
    const a0 = int(16, 60), m = int(0, 40) * 10;
    out.push({
      ...DEFAULTS,
      a0, incWork: int(0, 200) * 1000, incRet: int(0, 90) * 1000, setAll: m, g: r1(-3, 10), R: int(65, 70), kvOn: b(),
      etfOn: b(), avdOn: b(), insOn: b(), fondOn: b(),
      H: int(80, 100), gPay: r1(-2, 7), einmal: b(), insLump: b(), rf: int(15, 45), gz: int(0, 30),
      deathAge: int(a0 + 1, 100), heirHalf: b(),
      studyEnd: int(16, 35), incStudy: int(0, 40) * 1000, eligStudy: b(), kvRate: r1(14, 25),
      infl: r1(0, 5), dyn: int(0, 5), basis: r1(0, 5),
      etfM: rnd() < 0.8 ? m : int(0, 40) * 10, etfTer: r1(0, 1),
      avdM: rnd() < 0.8 ? m : int(0, 40) * 10, avdCost: r1(0, 1.5), kids: int(0, 3), kidsFrom: int(20, 45), kidsYears: int(0, 25), bonus: b(), reinvest: b(),
      insM: rnd() < 0.8 ? m : int(0, 40) * 10, insEff: r1(0, 2.5),
      fondM: m, fondAA: r1(0, 6), fondTer: r1(0, 2.5),
      real: b(),
    });
  }
  return out;
}
const SCENARIOS: Inputs[] = [...NAMED.map(([, v]) => ({ ...DEFAULTS, ...v })), ...randomInputs(300)];

// Skalare Felder, die model() je Produkt liefert und die Kombi-Engine gleich liefern muss.
const SKIP = new Set(['tEnd']); // interne Laufzeit von runFund, kein Ergebnis

/** I1 für eine Teilmenge der Fixes; liefert Anzahl Fälle und verglichener Zahlen. */
function oneProductInvariant(inputs: Inputs[], fixes: ReadonlySet<FixId>) {
  let cases = 0, numbers = 0;
  for (const inp of inputs) {
    const p0 = readParams(inp);
    for (const k of SPLIT_KEYS) {
      const p: Params = { ...p0, on: only(k) };
      const amount = p[M[k]] as number;
      if (!(amount > 0)) continue; // 0 € = kein Teil (I8)
      const ctx = `${JSON.stringify(inp)} ${k} fixes=[${[...fixes]}]`;
      const single = model(p, { fixes }).res[k]! as unknown as Record<string, unknown>;
      const A = analyze(p, { fixes });
      const c = combo(p, S({ [k]: amount }), { fixes, cost: true });
      const part = c.parts[k]! as unknown as Record<string, unknown>;
      expect(Object.keys(c.parts), ctx).toEqual([k]);
      for (const [f, v] of Object.entries(single)) {
        if (SKIP.has(f) || typeof v === 'function' || (typeof v !== 'number' && typeof v !== 'boolean')) continue;
        expect(part[f], `${ctx} .${f}`).toBe(v); numbers++;
      }
      for (const f of ['net', 'vals'] as const) {
        const a = single[f] as (number | null)[], b = part[f] as (number | null)[];
        expect(b.length, `${ctx} .${f}.length`).toBe(a.length);
        for (let t = 0; t < a.length; t++) if (!Object.is(a[t], b[t])) expect.fail(`${ctx} .${f}[${t}]: model ${a[t]}, combo ${b[t]}`);
        numbers += a.length;
      }
      const net = single.net as number[];
      for (let t = 0; t < net.length; t++) if (!Object.is(net[t], c.net[t])) expect.fail(`${ctx} Summe net[${t}]: model ${net[t]}, combo ${c.net[t]}`);
      // Kennzahlen wie analyze(); Summe und Teil identisch
      const st = comboStats(p, c), ps = partStats(p, c, k)!;
      for (const [f, v] of Object.entries(A.stats[k]!)) { expect((st as never)[f], `${ctx} stats.${f}`).toBe(v); expect((ps as never)[f], `${ctx} partStats.${f}`).toBe(v); numbers += 2; }
      expect(c.own).toBe(single.own); expect(c.ownReal).toBe(single.ownReal); expect(c.capR).toBe(single.capR);
      expect(c.capNet).toBe(single.capNet); expect(c.cost).toBe(single.cost); expect(c.foerder).toBe(single.foerder);
      expect(c.kvClipped).toBe(false);
      cases++;
    }
  }
  return { cases, numbers };
}

describe('I1 – ein Produkt = Einzelrechnung (bitgenau, toBe/Object.is)', () => {
  it('ALL_FIXES: 32 benannte + 300 Zufallsszenarien × 4 Produkte', () => {
    const r = oneProductInvariant(SCENARIOS, ALL_FIXES);
    console.log(`I1 ALL_FIXES: ${r.cases} Fälle, ${r.numbers.toLocaleString('de-DE')} Zahlen bitgleich`);
    expect(r.cases).toBeGreaterThan(1200);
  });
  it('NO_FIXES (Original): dieselben Szenarien', () => {
    expect(oneProductInvariant(SCENARIOS, NO_FIXES).cases).toBeGreaterThan(1200);
  });
  for (const f of FIX_IDS) it(`nur ${f}: benannte + 100 Zufallsszenarien`, () => {
    expect(oneProductInvariant(SCENARIOS.slice(0, NAMED.length + 100), new Set([f])).cases).toBeGreaterThan(450);
  });
  it('alle Fixes außer einem: benannte Szenarien', () => {
    for (const f of FIX_IDS) oneProductInvariant(SCENARIOS.slice(0, NAMED.length), new Set(FIX_IDS.filter(x => x !== f)));
  });
});

const sumParts = (c: ComboResult, f: (k: ProductKey) => number) => SPLIT_KEYS.filter(k => c.parts[k]).reduce((a, k) => a + f(k), 0);
const relClose = (a: number, b: number, rel = 1e-9, abs = 1e-6) => Math.abs(a - b) <= abs + rel * Math.max(Math.abs(a), Math.abs(b));
const MIX: Split = S({ etf: 120, avd: 90, ins: 60, fond: 30 });

describe('I2 – Summen und eigenes Geld', () => {
  it('Σ Teile = Gesamt je Jahr; Abzüge je Teil summieren sich; eigenes Geld unabhängig von der Aufteilung; Förderung nur im AVD', () => {
    for (const inp of SCENARIOS) {
      const p = { ...readParams(inp), on: ALL_ON };
      const c = combo(p, MIX, { cost: true });
      const ctx = JSON.stringify(inp);
      for (let t = 0; t < c.T; t++) {
        expect(relClose(sumParts(c, k => c.parts[k]!.net[t]), c.net[t], 1e-12, 1e-6), ctx + ' net ' + t).toBe(true);
        expect(relClose(sumParts(c, k => c.parts[k]!.incTax[t]), c.incTax[t], 1e-12, 1e-6), ctx + ' incTax ' + t).toBe(true);
        expect(relClose(sumParts(c, k => c.parts[k]!.abgTax[t]), c.abgTax[t], 1e-12, 1e-6), ctx + ' abgTax ' + t).toBe(true);
        expect(relClose(sumParts(c, k => c.parts[k]!.kv[t]), c.kv[t], 1e-12, 1e-6), ctx + ' kv ' + t).toBe(true);
      }
      // Fairness: eigenes Geld = Budget × Beitragsmonate (mit Dynamik), egal wie aufgeteilt
      const c2 = combo(p, S({ etf: 300 }));
      let ref = 0, refReal = 0; for (let t = 0; t < c.n; t++) { const y = 300 * 12 * Math.pow(1 + p.dyn, t); ref += y; refReal += y / c.I(t); }
      expect(relClose(c.own, c2.own), ctx).toBe(true);
      expect(relClose(c.own, ref), ctx).toBe(true);
      expect(relClose(c.ownReal, refReal), ctx).toBe(true);
      expect(c.foerder).toBe(c.parts.avd!.foerder);
      for (const k of ['etf', 'ins', 'fond'] as const) expect(c.parts[k]!.foerder).toBe(0);
      // Kosten: Summe der Teile, jeder ≥ 0 bei nichtnegativen Kosten
      expect(relClose(c.cost, sumParts(c, k => c.parts[k]!.cost), 1e-9, 1e-6)).toBe(true);
    }
  });
});

describe('I3 – Zulagen und Erstattungen hängen nur am AVD-Teil', () => {
  it('{avd 150} und {avd 150, etf 350, ins 100} haben identische zul, ref, capAVD, noElig', () => {
    for (const inp of SCENARIOS) {
      const p = readParams(inp);
      const a = combo(p, S({ avd: 150 })).parts.avd!, b = combo(p, S({ avd: 150, etf: 350, ins: 100 })).parts.avd!;
      for (const f of ['zul', 'ref', 'capAVD', 'noElig', 'zulReal', 'refReal'] as const) expect(b[f], JSON.stringify(inp) + f).toBe(a[f]);
    }
  });
});

describe('I4 – gemeinsam gegen getrennt', () => {
  it('ohne KV: gemeinsam nie mehr netto als getrennt (progressiver Tarif, ein Pauschbetrag); mit KV: nie mehr KV als getrennt', () => {
    let maxKvSaving = 0;
    for (const inp of SCENARIOS) {
      const p = readParams(inp);
      const c = combo(p, MIX);
      const sep = SPLIT_KEYS.map(k => combo(p, S({ [k]: MIX[k] })));
      const joint = comboStats(p, c).cumHReal, sepSum = sep.reduce((a, x) => a + comboStats(p, x).cumHReal, 0);
      if (!p.kvOn) expect(joint, JSON.stringify(inp)).toBeLessThanOrEqual(sepSum + 1e-6 + Math.abs(sepSum) * 1e-12);
      else {
        let kvJ = 0, kvS = 0;
        for (let t = 0; t < c.T; t++) { kvJ += c.kv[t] / c.I(t); for (const x of sep) kvS += x.kv[t] / x.I(t); }
        expect(kvJ, JSON.stringify(inp)).toBeLessThanOrEqual(kvS + 1e-6 + kvS * 1e-9);
        maxKvSaving = Math.max(maxKvSaving, kvS - kvJ);
      }
    }
    console.log(`I4: größte KV-Ersparnis durch eine gemeinsame BBG ${Math.round(maxKvSaving).toLocaleString('de-DE')} € (real)`);
  });
  it('Beispiel: KV an, Rente 60.000, Leibrente 300/150/300 → gemeinsam mehr netto (eine BBG statt drei), BBG deckelt gemeinsam', () => {
    const p = readParams({ ...DEFAULTS, kvOn: true, incRet: 60000, insLump: false });
    const split = S({ etf: 300, avd: 150, ins: 300 });
    const c = combo(p, split);
    const sep = SPLIT_KEYS.reduce((a, k) => a + (split[k] > 0 ? comboStats(p, combo(p, S({ [k]: split[k] }))).cumHReal : 0), 0);
    expect(c.kvClipped).toBe(true);
    expect(comboStats(p, c).cumHReal).toBeGreaterThan(sep + 1000);
  });
});

describe('I5 – ein Sparer-Pauschbetrag über alle Depots', () => {
  it('shareAllowance: anteilig, Rest, ein Beteiligter wie max(0, x − f)', () => {
    expect(shareAllowance([300, 500], 1000)).toEqual({ taxed: [0, 0], left: 200 });
    const r = shareAllowance([600, 1400], 1000);
    expect(r.left).toBe(0); expect(r.taxed[0]).toBeCloseTo(300, 9); expect(r.taxed[1]).toBeCloseTo(700, 9);
    for (const x of [0, 1, 999.5, 1000, 1000.5, 12345.678]) {
      const s = shareAllowance([x], 1000);
      expect(s.taxed[0]).toBe(Math.max(0, x - 1000)); expect(s.left).toBe(Math.max(0, 1000 - x));
    }
  });
  it('ETF 300 ≡ ETF 100 + gleich teurer Fonds 200 (linear, ein Pauschbetrag) und Symmetrie 100/200 ↔ 200/100', () => {
    for (const inp of SCENARIOS.slice(0, 150)) {
      const p = { ...readParams(inp), fondTer: readParams(inp).etfTer, fondAA: 0 };
      const one = combo(p, S({ etf: 300 })), two = combo(p, S({ etf: 100, fond: 200 })), swap = combo(p, S({ etf: 200, fond: 100 }));
      for (let t = 0; t < one.T; t++) {
        expect(relClose(two.net[t], one.net[t], 1e-9, 1e-6), JSON.stringify(inp) + ' t=' + t).toBe(true);
        expect(relClose(two.abgTax[t], one.abgTax[t], 1e-9, 1e-6)).toBe(true);
        expect(relClose(swap.net[t], two.net[t], 1e-9, 1e-6)).toBe(true);
      }
      expect(relClose(two.capNet, one.capNet, 1e-9, 1e-6)).toBe(true);
    }
  });
});

describe('I6 – gemeinsames Einkommensteuer-Buch', () => {
  it('incTax[t] = taxAdd(Rente, Σ steuerpflichtige Beträge, t), anteilig verteilt; AVD-Bemessung unabhängig von der Versicherung', () => {
    for (const inp of SCENARIOS.slice(0, 200)) {
      const p = readParams(inp);
      const c = combo(p, MIX), avdOnly = combo(p, S({ avd: MIX.avd }));
      const taxAdd = (inc: number, add: number, t: number) => add <= 0 ? 0 : (tax(inc + add / c.I(t)) - tax(inc)) * c.I(t);
      for (let t = 0; t < c.T; t++) {
        const xa = c.parts.avd!.taxBase[t], xi = c.parts.ins!.taxBase[t];
        expect(xa).toBe(avdOnly.parts.avd!.taxBase[t]);
        const X = xa + xi;
        expect(relClose(c.incTax[t], taxAdd(p.incRet, X, t), 1e-12, 1e-9), JSON.stringify(inp) + ' t=' + t).toBe(true);
        if (X > 0) {
          expect(relClose(c.parts.avd!.incTax[t], c.incTax[t] * xa / X, 1e-12, 1e-9)).toBe(true);
          expect(relClose(c.parts.ins!.incTax[t], c.incTax[t] * xi / X, 1e-12, 1e-9)).toBe(true);
        }
      }
    }
  });
});

describe('I7 – AVD über dem Höchstbetrag = AVD am Höchstbetrag + ETF', () => {
  // Was nicht mehr in den Vertrag passt, liegt im ETF-Nebendepot: mit E10 über 570 €/Monat (6.840 €/Jahr), ohne E10
  // (Original) schon über 150 €. Nebendepot und ETF teilen Pauschbetrag, KV-Buch und Kosten. Exakt linear ist die Summe
  // zweier Depots trotzdem nicht: Die Vorabpauschale ist je Depot auf den tatsächlichen Wertzuwachs gedeckelt (min(…))
  // und Verluste werden je Depot bei 0 abgeschnitten (max(0, …)). Das macht höchstens Promille aus.
  const NO_UNSUB = { fixes: new Set<FixId>([...ALL_FIXES].filter(f => f !== 'avdUnsubsidized')) };
  const pairs: [Split, Split, { fixes: ReadonlySet<FixId> } | undefined][] = [
    [S({ avd: 800 }), S({ avd: 570, etf: 230 }), undefined],
    [S({ avd: 500 }), S({ avd: 150, etf: 350 }), NO_UNSUB],
  ];
  const val = (p: Params, s: Split, o?: { fixes: ReadonlySet<FixId> }) => comboStats(p, combo(p, s, o)).cumHReal;
  it('Standard, DK, High, Dynamik, Kinder: |Δ cumHReal| < 1 €', () => {
    for (const patch of [{}, { kvOn: true }, NAMED[29][1], { kids: 2, kidsFrom: 25, kidsYears: 20 }, { insLump: false, einmal: true }] as Partial<Inputs>[]) {
      const p = readParams({ ...DEFAULTS, ...patch });
      for (const [x, y, o] of pairs) expect(Math.abs(val(p, x, o) - val(p, y, o)), JSON.stringify(patch)).toBeLessThan(1);
    }
  });
  it('mit E10 rechnet AVD 450 € anders als AVD 150 € + 300 € ETF (ungeförderter Teil im Vertrag)', () => {
    const p = readParams({ ...DEFAULTS });
    expect(Math.abs(val(p, S({ avd: 450 })) - val(p, S({ avd: 150, etf: 300 })))).toBeGreaterThan(1000);
  });
  it('alle Szenarien, ohne E10: höchstens 0,1 % Abweichung', () => {
    let worst = 0;
    for (const inp of SCENARIOS) {
      const p = readParams(inp);
      const a = val(p, S({ avd: 500 }), NO_UNSUB), b = val(p, S({ avd: 150, etf: 350 }), NO_UNSUB);
      const rel = Math.abs(a - b) / Math.max(1, Math.abs(b));
      worst = Math.max(worst, rel);
      expect(rel, JSON.stringify(inp)).toBeLessThan(1e-3);
    }
    console.log(`I7: größte relative Abweichung ${(worst * 100).toFixed(4)} %`);
  });
});

describe('I8 – Teile mit 0 €', () => {
  it('ein Produkt mit 0 € (oder negativ/abgewählt) ändert nichts', () => {
    for (const inp of SCENARIOS.slice(0, 50)) {
      const p = readParams(inp);
      const a = combo(p, S({ etf: 200, avd: 150 })), b = combo(p, S({ etf: 200, avd: 150, ins: 0, fond: 0 }));
      expect(b.net).toEqual(a.net);
      expect(Object.keys(b.parts)).toEqual(['etf', 'avd']);
    }
  });
});

describe('readCombo', () => {
  it('liest Budget und Aufteilung aus den Eingaben, nur aktive Produkte, negatives/Unlesbares → 0', () => {
    const inp: Inputs = { ...DEFAULTS, combo: true, setAll: 500, cEtf: 200, cAvd: 150, cIns: 150, cFond: 80 };
    const r = readCombo(inp, readParams(inp));
    expect(r).toEqual({ budget: 500, split: { etf: 200, avd: 150, ins: 150, fond: 0 }, keys: ['etf', 'avd', 'ins'] });
    const bad = { ...inp, fondOn: true, cEtf: -5, cFond: 'x' as unknown as number, setAll: NaN };
    const r2 = readCombo(bad, readParams(bad));
    expect(r2.split).toEqual({ etf: 0, avd: 150, ins: 150, fond: 0 });
    expect(r2.budget).toBe(0);
    expect(r2.keys).toEqual(['etf', 'avd', 'ins', 'fond']);
  });
  it('Standardwerte: Budget = Monatsbeitrag je Produkt (150 €), noch nichts aufgeteilt', () => {
    const r = readCombo({ ...DEFAULTS }, readParams({ ...DEFAULTS }));
    expect(r.budget).toBe(150);
    expect(r.split).toEqual({ etf: 0, avd: 0, ins: 0, fond: 0 });
  });
});
