// Kombi-Engine (src/lib/engine/combo.ts): Invarianten I1–I8 aus dem Kombi-Design §5.
// I1 ist der „zweite Golden-Test“: Eine Kombination mit nur einem Produkt muss bitgenau model()/analyze() ergeben.
// engine.ts wird auf seinen historischen E-Fixes geprüft; neue R-Fixes haben unabhängige Recht-/Bilanztests.
import { describe, expect, it } from 'vitest';
import { readParams, model, tax, tax2026, type HeirValue, type Params, type ProductKey } from '../src/lib/engine/engine';
import { analyze } from '../src/lib/engine/analyze';
import { ALL_FIXES, FIX_IDS, FIXES, NO_FIXES, type FixId } from '../src/lib/engine/fixes';
import { DEFAULTS, type Inputs } from '../src/lib/engine/inputs';
import { combo, comboStats, emptySplit, partStats, readCombo, shareAllowance, SPLIT_KEYS, type ComboResult, type Split } from '../src/lib/engine/combo';

// engine.ts bleibt Referenz für E1–E10; neue R-Fixes werden ausschließlich in combo.ts gerechnet.
const REFERENCE_IDS = FIX_IDS.filter(f => FIXES[f].finding.startsWith('E') && f !== 'soliOnZulage');
const REFERENCE_FIXES = new Set(REFERENCE_IDS);
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

/** Kennzahlen wie analyze() im Original, direkt aus model() (Referenz; analyze() selbst rechnet über combo()). */
function refStats(p: Params, m: ReturnType<typeof model>, k: ProductKey) {
  const r = m.res[k]!, { n, tH, T, I } = m, R = (x: number, t: number) => p.real ? x / I(t) : x;
  const lump = r.lumpNet ? R(r.lumpNet, n) : 0;
  let sumH = 0; for (let t = n; t < tH; t++) sumH += R(r.net[t], t);
  let sumHR = 0; for (let t = n; t < tH; t++) sumHR += r.net[t] / I(t);
  let cum100 = 0; for (let t = n; t < T; t++) cum100 += R(r.net[t], t);
  return { avgMonthly: (sumH - lump) / (tH - n) / 12, cumH: sumH, cumHReal: sumHR, cum100, lump };
}

/** I1 für eine Teilmenge der Fixes; liefert Anzahl Fälle und verglichener Zahlen. */
function oneProductInvariant(inputs: Inputs[], fixes: ReadonlySet<FixId>) {
  let cases = 0, numbers = 0;
  for (const inp of inputs) {
    const p0 = readParams(inp);
    for (const k of SPLIT_KEYS) {
      const p: Params = { ...p0, on: only(k) };
      const amount = p[M[k]] as number;
      // 0 € = kein Teil (I8); als Einzelprodukt (analyze) wird es mit parts: [k] trotzdem gerechnet.
      const ctx = `${JSON.stringify(inp)} ${k} fixes=[${[...fixes]}]`;
      const m = model(p, { fixes });
      const single = m.res[k]! as unknown as Record<string, unknown>;
      const A = analyze(p, { fixes });
      const c = combo(p, S({ [k]: amount }), { fixes, cost: true, parts: [k] });
      const part = c.parts[k]! as unknown as Record<string, unknown>;
      expect(Object.keys(c.parts), ctx).toEqual([k]);
      for (const [f, v] of Object.entries(single)) {
        if (SKIP.has(f) || typeof v === 'function' || (typeof v !== 'number' && typeof v !== 'boolean')) continue;
        expect(part[f], `${ctx} .${f}`).toBe(v); numbers++;
        expect((A.res[k] as unknown as Record<string, unknown>)[f], `${ctx} analyze .${f}`).toBe(v);
      }
      for (const f of ['net', 'vals'] as const) {
        const a = single[f] as (number | null)[], b = part[f] as (number | null)[];
        expect(b.length, `${ctx} .${f}.length`).toBe(a.length);
        for (let t = 0; t < a.length; t++) if (!Object.is(a[t], b[t])) expect.fail(`${ctx} .${f}[${t}]: model ${a[t]}, combo ${b[t]}`);
        numbers += a.length;
      }
      const net = single.net as number[];
      for (let t = 0; t < net.length; t++) if (!Object.is(net[t], c.net[t])) expect.fail(`${ctx} Summe net[${t}]: model ${net[t]}, combo ${c.net[t]}`);
      // Erbfall für jedes Todesjahr, Wert bitgenau und Hinweistext gleich
      for (const f of ['heir', 'heirMarried'] as const) {
        const a = m.res[k]![f], b = c.parts[k]![f], b2 = A.res[k]![f];
        expect(typeof b, `${ctx} .${f}`).toBe(typeof a);
        if (!a) continue;
        for (let i = 0; i <= m.T; i++) {
          const x: HeirValue = a(i), y: HeirValue = b!(i), z: HeirValue = b2!(i);
          if (!Object.is(x.val, y.val) || x.note !== y.note) expect.fail(`${ctx} .${f}(${i}): model ${x.val} „${x.note}“, combo ${y.val} „${y.note}“`);
          if (!Object.is(x.val, z.val) || x.note !== z.note) expect.fail(`${ctx} analyze .${f}(${i})`);
          numbers++;
        }
      }
      // Kennzahlen wie im Original; Summe, Teil und analyze() identisch
      const st = comboStats(p, c), ps = partStats(p, c, k)!, ref = refStats(p, m, k);
      for (const [f, v] of Object.entries(ref)) {
        expect((st as never)[f], `${ctx} stats.${f}`).toBe(v); expect((ps as never)[f], `${ctx} partStats.${f}`).toBe(v);
        expect((A.stats[k] as never)[f], `${ctx} analyze stats.${f}`).toBe(v); numbers += 3;
      }
      expect(c.own).toBe(single.own); expect(c.ownReal).toBe(single.ownReal); expect(c.capR).toBe(single.capR);
      expect(c.capNet).toBe(single.capNet); expect(c.cost).toBe(single.cost); expect(c.foerder).toBe(single.foerder);
      expect(c.kvClipped).toBe(false);
      if (amount > 0) expect(Object.keys(combo(p, S({ [k]: amount }), { fixes }).parts), ctx).toEqual([k]);
      cases++;
    }
  }
  return { cases, numbers };
}

describe('I1 – ein Produkt = Einzelrechnung (bitgenau, toBe/Object.is)', () => {
  it('E1–E10: 32 benannte + 300 Zufallsszenarien × 4 Produkte', () => {
    const r = oneProductInvariant(SCENARIOS, REFERENCE_FIXES);
    console.log(`I1 ALL_FIXES: ${r.cases} Fälle, ${r.numbers.toLocaleString('de-DE')} Zahlen bitgleich`);
    expect(r.cases).toBeGreaterThan(1200);
  });
  it('NO_FIXES (Original): dieselben Szenarien', () => {
    expect(oneProductInvariant(SCENARIOS, NO_FIXES).cases).toBeGreaterThan(1200);
  });
  for (const f of REFERENCE_IDS) it(`nur ${f}: benannte + 100 Zufallsszenarien`, () => {
    expect(oneProductInvariant(SCENARIOS.slice(0, NAMED.length + 100), new Set([f])).cases).toBeGreaterThan(450);
  });
  it('alle Fixes außer einem: benannte Szenarien', () => {
    for (const f of REFERENCE_IDS) oneProductInvariant(SCENARIOS.slice(0, NAMED.length), new Set(REFERENCE_IDS.filter(x => x !== f)));
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
  it('R3 erlaubt eine positive Wechselwirkung ohne KV, auch ohne nominale R8-Rundung (D1)', () => {
    const p = readParams({ ...DEFAULTS, a0: 20, incWork: 25000, incRet: 2000,
      R: 67, H: 100, g: 1.2, gPay: 1.3, infl: 4.4, dyn: 1,
      einmal: true, insLump: true, reinvest: false, kvOn: false });
    const split = S({ etf: 120, avd: 90, ins: 60, fond: 30 });
    const interaction = (fixes: ReadonlySet<FixId>) => {
      const joint = comboStats(p, combo(p, split, { fixes })).cumHReal;
      const separate = SPLIT_KEYS.reduce((s, k) => s + comboStats(p, combo(p, S({ [k]: split[k] }), { fixes })).cumHReal, 0);
      return { joint, separate, delta: joint - separate };
    };
    const fixes = new Set([...ALL_FIXES].filter(f => f !== 'taxRounding'));
    const current = interaction(fixes);
    expect(current.joint).toBeCloseTo(23869.339078368866, 7);
    expect(current.separate).toBeCloseTo(23856.13732911591, 7);
    expect(current.delta).toBeCloseTo(13.201749252955779, 7);
    fixes.delete('capitalGuenstiger');
    expect(interaction(fixes).delta).toBeLessThan(0);
    // Auch ohne R8 bleibt die historische Einkommensabrundung aktiv; kein rundungsfreier Beweis.
  });
  it('gemeinsamer Tarif/Pauschbetrag ohne KV; mit KV gilt eine BBG trotz veränderter Steuerverkäufe', () => {
    let maxKvSaving = 0;
    for (const inp of SCENARIOS) {
      const p = readParams(inp);
      const c = combo(p, MIX);
      const sep = SPLIT_KEYS.map(k => combo(p, S({ [k]: MIX[k] })));
      const joint = comboStats(p, c).cumHReal, sepSum = sep.reduce((a, x) => a + comboStats(p, x).cumHReal, 0);
      if (!p.kvOn) {
        // Rundung von Einkommen/ESt kann die Konvexität um wenige nominale Euro pro Jahr verletzen.
        const convexOpts = { fixes: new Set([...ALL_FIXES].filter(f => f !== 'capitalGuenstiger')) };
        const rounded = combo(p, MIX, convexOpts);
        const separateRounded = SPLIT_KEYS.reduce((s, k) => s + comboStats(p, combo(p, S({ [k]: MIX[k] }), convexOpts)).cumHReal, 0);
        const roundingBound = 4 * rounded.net.slice(rounded.n, rounded.tH).reduce((s, _, i) => s + 1 / rounded.I(rounded.n + i), 0);
        expect(comboStats(p, rounded).cumHReal, JSON.stringify(inp)).toBeLessThanOrEqual(separateRounded + roundingBound + 1e-6);
        expect(Number.isFinite(joint) && Number.isFinite(sepSum)).toBe(true);
        // Die Wahl min(Tarif, Abgeltungsteuer) ist an der Wechselstelle nicht konvex.
        // Die historische Konvexitätsinvariante gilt daher nur ohne Kapital-Günstigerprüfung.
        const opts = { fixes: new Set([...ALL_FIXES].filter(f => f !== 'taxRounding' && f !== 'capitalGuenstiger')) };
        const exact = comboStats(p, combo(p, MIX, opts)).cumHReal;
        const separate = SPLIT_KEYS.reduce((s, k) => s + comboStats(p, combo(p, S({ [k]: MIX[k] }), opts)).cumHReal, 0);
        expect(exact).toBeLessThanOrEqual(separate + 1e-6 + Math.abs(separate) * 1e-12);
      }
      else {
        let kvJ = 0, kvS = 0;
        for (let t = 0; t < c.T; t++) { kvJ += c.kv[t] / c.I(t); for (const x of sep) kvS += x.kv[t] / x.I(t); }
        // R2: Ein gemeinsamer Pauschbetrag erzwingt andere Steuerverkäufe und damit andere KV-Basen.
        // Für die tatsächlich realisierten Basen gilt trotzdem genau eine BBG (E9-Teilauszahlung separat).
        for (let t = 0; t < c.T; t++) {
          const room = Math.max(0, (69750 - p.kvGrossRet) * c.I(t));
          const lumpKv = p.einmal && t === c.n ? p.kvRate * Math.min(.3 * c.parts.avd!.capAVD!, 10 * room) : 0;
          expect(c.kv[t]).toBeLessThanOrEqual(p.kvRate * room + lumpKv + 1e-6);
        }
        const opts = { fixes: new Set([...ALL_FIXES].filter(f => f !== 'vpTaxSale')) };
        const oldJoint = combo(p, MIX, opts), oldSep = SPLIT_KEYS.map(k => combo(p, S({ [k]: MIX[k] }), opts));
        const oldKvJ = oldJoint.kv.reduce((s, v, t) => s + v / c.I(t), 0);
        const oldKvS = oldSep.reduce((s, r) => s + r.kv.reduce((a, v, t) => a + v / c.I(t), 0), 0);
        expect(oldKvJ).toBeLessThanOrEqual(oldKvS + 1e-6 + oldKvS * 1e-9);
        maxKvSaving = Math.max(maxKvSaving, kvS - kvJ);
      }
    }
    console.log(`I4: größte KV-Ersparnis durch eine gemeinsame BBG ${Math.round(maxKvSaving).toLocaleString('de-DE')} € (real)`);
  });
  it('Beispiel: KV an, Rente 60.000, Leibrente 300/150/300 → gemeinsam mehr netto (eine BBG statt drei), BBG deckelt gemeinsam', () => {
    const p = readParams({ ...DEFAULTS, kvOn: true, incRet: 60000, kvGrossRet: 60000, insLump: false });
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
  it('incTax nach gemeinsamen KV-Sonderausgaben; AVD-Bemessung unabhängig von der Versicherung', () => {
    for (const inp of SCENARIOS.slice(0, 200)) {
      const p = readParams(inp);
      const c = combo(p, MIX), avdOnly = combo(p, S({ avd: MIX.avd }));
      for (let t = 0; t < c.T; t++) {
        const xa = c.parts.avd!.taxBase[t], xi = c.parts.ins!.taxBase[t];
        expect(xa).toBe(avdOnly.parts.avd!.taxBase[t]);
        const X = xa + xi, I = c.I(t), base = p.incRet * I;
        const gross = tax2026(base + X, I) - tax2026(base, I);
        const net = tax2026(Math.max(0, base + X - c.kv[t]), I) - tax2026(base, I);
        expect(relClose(c.incTax[t], net, 1e-12, 1e-7)).toBe(true);
        for (const r of Object.values(c.parts)) {
          const expected = (X > 0 ? gross * r.taxBase[t] / X : 0)
            - (c.kv[t] > 0 ? (gross - net) * r.kv[t] / c.kv[t] : 0);
          expect(relClose(r.incTax[t], expected, 1e-12, 1e-7)).toBe(true);
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

describe('I9 – Erbfall gemeinsam versteuert', () => {
  const sepSum = (c: ComboResult, idx: number, married: boolean) =>
    SPLIT_KEYS.filter(k => c.parts[k]).reduce((a, k) => { const r = c.parts[k]!; return a + (married && r.heirMarried ? r.heirMarried : r.heir)(idx).val; }, 0);

  it('ein Teil: gemeinsamer Erbwert = Erbwert des Teils (jedes Todesjahr, auch Ehepartner)', () => {
    let n = 0;
    for (const inp of SCENARIOS.slice(0, NAMED.length + 100)) {
      const p0 = readParams(inp);
      for (const k of SPLIT_KEYS) {
        const p = { ...p0, on: only(k) }, amount = p[M[k]] as number;
        if (!(amount > 0)) continue;
        const c = combo(p, S({ [k]: amount }));
        expect(!!c.heirMarried, k).toBe(k === 'avd');
        for (let i = 0; i <= c.T; i++) {
          const a = c.heir(i).val, b = c.parts[k]!.heir(i).val;
          if (!relClose(a, b, 1e-9, 1e-6)) expect.fail(`${JSON.stringify(inp)} ${k} heir(${i}): gemeinsam ${a}, Teil ${b}`);
          if (c.heirMarried) expect(relClose(c.heirMarried(i).val, c.parts.avd!.heirMarried!(i).val, 1e-9, 1e-6)).toBe(true);
          n++;
        }
      }
    }
    expect(n).toBeGreaterThan(10000);
  });

  it('mehrere Teile: gemeinsam nie mehr als einzeln, solange kein Depot im Verlust ist (Progression, ein Pauschbetrag)', () => {
    // Verluste (Kosten über der Rendite, Ausgabeaufschlag des aktiven Fonds) darf die gemeinsame Rechnung mit Gewinnen
    // anderer Depots verrechnen; deshalb nur Szenarien mit positiver Rendite nach Kosten und ohne aktiven Fonds.
    const SPLIT3 = S({ etf: 120, avd: 90, ins: 60 });
    let hits = 0, less = 0;
    for (const inp of SCENARIOS) {
      const p = { ...readParams(inp), on: ALL_ON };
      if (!(p.g - p.etfTer > 0.001 && p.gPay - p.etfTer > 0.001)) continue;
      const c = combo(p, SPLIT3);
      for (let i = 1; i <= c.T; i += 3) {
        const joint = c.heir(i).val, sep = sepSum(c, i, false), jm = c.heirMarried!(i).val, sm = sepSum(c, i, true);
        hits++;
        // Depots im Verlust darf die gemeinsame Rechnung mit Gewinnen verrechnen. Kleine Verluste entstehen auch ohne
        // Kosten: Die Steuer auf die Vorabpauschale senkt Wert und Anschaffungskosten anteilig, danach steigen diese um die
        // volle Vorabpauschale. Solche Jahre auslassen.
        if (c.heir(i).detail!.minDepotGain < 0) continue;
        const tol = 4; // Rundung der vier Tarifauswertungen im Todesjahr, nominal.
        if (joint > sep + tol || jm > sm + tol) expect.fail(`${JSON.stringify(inp)} idx ${i}: gemeinsam ${joint}/${jm} > einzeln ${sep}/${sm}`);
        if (joint < sep - 1) less++;
      }
    }
    expect(hits).toBeGreaterThan(2000);
    expect(less).toBeGreaterThan(500);
  });

  it('ohne heirTax (Originalpfad): Summe der Teile', () => {
    const p = { ...readParams({ ...DEFAULTS, deathAge: 75 }), on: ALL_ON }, c = combo(p, MIX, { fixes: NO_FIXES });
    for (let i = 0; i <= c.T; i++) expect(c.heir(i).val).toBe(sepSum(c, i, false));
  });

  it('Standardwerte, 150 € ETF + 150 € AVD, Tod mit 50: ein Pauschbetrag, Hinweis nennt die Bestandteile', () => {
    const p = { ...readParams({ ...DEFAULTS, deathAge: 50 }), on: ALL_ON }, idx = 50 - p.a0;
    const c = combo(p, S({ etf: 150, avd: 150 }));
    const joint = c.heir(idx), sep = sepSum(c, idx, false);
    expect(joint.val).toBeLessThan(sep); // ETF und Nebendepot teilen sich einen Pauschbetrag
    expect(joint.note).toMatch(/^Gemeinsam versteuert: AVD-Förderung .* zurück; Einkommensteuer der Erben .* in einem Tarif \(AVD-Erträge\); Depots nach Kapitalertragsteuer\/Günstigerprüfung bei Verkauf .* \(ein Sparer-Pauschbetrag\)$/);
    expect(c.heirMarried!(idx).note).toMatch(/^Gemeinsam versteuert: AVD ohne Abzug auf einen Vertrag des Ehepartners übertragbar/);
  });

  it('Leibrente und AVD nach Rentenbeginn: AVD-Erträge und erste Restrente in einem Tarif', () => {
    const p = { ...readParams({ ...DEFAULTS, insLump: false, gz: 20, deathAge: 70, incHeir: 30000 }), on: ALL_ON }, idx = 70 - p.a0;
    const c = combo(p, S({ avd: 150, ins: 150 }));
    const joint = c.heir(idx), sep = sepSum(c, idx, false);
    expect(joint.note).toContain('(AVD-Erträge und Ertragsanteil der Restrente)');
    expect(joint.note).toContain('Restrente noch 17 Jahre');
    expect(joint.val).toBeLessThan(sep); // Progression
    expect(sep - joint.val).toBeLessThan(0.05 * sep);
  });
});

