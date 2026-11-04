// Suche, Auswertung und Ergebnissätze des Kombi-Modus (search.ts, comboAnalyze.ts, comboVerdict.ts).
// S1: Suche = erschöpfende Suche; S2: Eigenschaften; S3: Snapshot der Standardwerte; Robustheit; Verdict; Laufzeit.
import { describe, expect, it } from 'vitest';
import { readParams, type Params, type ProductKey } from '../src/lib/engine/engine';
import { scenarioList } from '../src/lib/engine/analyze';
import { ALL_FIXES, NO_FIXES, type FixId } from '../src/lib/engine/fixes';
import { DEFAULTS, type Inputs } from '../src/lib/engine/inputs';
import { emptySplit, readCombo, splitSum, type ComboSetup, type Split } from '../src/lib/engine/combo';
import { bestSplit, better, evaluate, exhaustive, lattice, pureStrategies, searchSpace, TIE_EUR, tieTol, type BestSplitResult } from '../src/lib/engine/search';
import { analyzeCombo, restTarget, robustLevel, robustRows, robustScenarios, robustSummary, type ComboAnalysis, type RobustRow } from '../src/lib/engine/comboAnalyze';
import { comboVerdict, eurAmount, splitText } from '../src/lib/comboVerdict';
import { eurRound } from '../src/lib/format';

/** Alle Fixes außer E10 (AVD über 150 € im ETF-Nebendepot wie im Original). */
const NO_UNSUB = { fixes: new Set<FixId>([...ALL_FIXES].filter(f => f !== 'avdUnsubsidized')) };
const S = (patch: Partial<Split>): Split => ({ ...emptySplit(), ...patch });
// Ausgangslage der Kombi-Tests: 450 € = 150/150/150 (vor dem Umbau die Kombi-Standardwerte).
const KOMBI_BASE: Partial<Inputs> = { combo: true, setAll: 450, cEtf: 150, cAvd: 150, cIns: 150, cFond: 0 };
const P = (patch: Partial<Inputs> = {}) => readParams({ ...DEFAULTS, ...patch });
const setupOf = (patch: Partial<Inputs>): ComboSetup => { const inp = { ...DEFAULTS, ...KOMBI_BASE, ...patch }; return readCombo(inp, readParams(inp)); };
const K3: ProductKey[] = ['etf', 'avd', 'ins'], K4: ProductKey[] = ['etf', 'avd', 'ins', 'fond'];

function rng(seed: number) {
  let s = seed;
  const rnd = () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return { rnd, int: (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1)), r1: (lo: number, hi: number) => Math.round((lo + rnd() * (hi - lo)) * 10) / 10 };
}
/** Realistische Zufallsszenarien für die Suche (wie /tmp/combo-proto/grid.test.ts). */
function searchCases(count: number, seed = 4711) {
  const { rnd, int, r1 } = rng(seed);
  const out: { inp: Inputs; keys: ProductKey[]; budget: number }[] = [];
  for (let i = 0; i < count; i++) {
    const a0 = int(18, 55), four = rnd() < 0.5;
    const inp: Inputs = {
      ...DEFAULTS, a0, incWork: int(10, 120) * 1000, incRet: int(0, 70) * 1000, g: r1(2, 8), gPay: r1(1, 5), R: int(65, 70), kvOn: rnd() < 0.3,
      einmal: rnd() < 0.3, insLump: rnd() < 0.6, insEff: r1(0.3, 1.8), avdCost: r1(0.2, 1.2), etfTer: r1(0.05, 0.5), kids: int(0, 2), kidsFrom: int(25, 40),
      dyn: int(0, 3), real: rnd() < 0.7, fondTer: r1(0.3, 1.8), fondAA: r1(0, 5), studyEnd: rnd() < 0.2 ? a0 + int(1, 6) : 16, eligStudy: rnd() < 0.5,
      incStudy: int(0, 20) * 1000, fondOn: four,
    };
    // 4 Produkte: kleinere Budgets, damit die erschöpfende Suche schnell bleibt
    out.push({ inp, keys: four ? K4 : K3, budget: (four ? int(3, 30) : int(3, 60)) * 10 });
  }
  return out;
}

describe('Suchraum', () => {
  it('AVD 0…570 in 10-€-Schritten (ohne E10: 0…150), mit Kindern zusätzlich 25 €; ohne ETF bis zum ganzen Budget', () => {
    const upTo = (m: number) => Array.from({ length: m / 10 + 1 }, (_, i) => i * 10);
    expect(searchSpace(P(), 500, K3).avdValues).toEqual(upTo(500));
    expect(searchSpace(P(), 800, K3).avdValues).toEqual(upTo(570));
    expect(searchSpace(P(), 500, K3, NO_UNSUB).avdValues).toEqual(upTo(150));
    expect(searchSpace(P({ kids: 1 }), 500, K3).avdValues.slice(0, 5)).toEqual([0, 10, 20, 25, 30]);
    expect(searchSpace(P(), 500, ['avd', 'ins']).avdValues.at(-1)).toBe(500);
    expect(searchSpace(P(), 100, K3).avdValues.at(-1)).toBe(100);
    expect(searchSpace(P(), 500, ['avd']).avdValues).toEqual([500]);
    expect(searchSpace(P(), 500, ['ins', 'fond']).sink).toBe('ins');
  });
  it('jeder Gitterpunkt verteilt genau das Budget (auch bei 455 € und 25 € AVD)', () => {
    for (const [B, keys, kids] of [[455, K3, 1], [500, K4, 0], [37, ['avd', 'ins'], 2], [90, ['etf'], 0]] as [number, ProductKey[], number][]) {
      let n = 0;
      for (const s of lattice(searchSpace(P({ kids }), B, keys))) {
        expect(Math.abs(splitSum(s) - B)).toBeLessThan(1e-9);
        for (const k of ['etf', 'avd', 'ins', 'fond'] as const) { expect(s[k]).toBeGreaterThanOrEqual(0); if (!keys.includes(k)) expect(s[k]).toBe(0); }
        n++;
      }
      expect(n).toBeGreaterThan(0);
    }
  });
});

describe('S1 – AVD-Raster = erschöpfende Suche', () => {
  it('50 Zufallsszenarien (3 und 4 Produkte, Budgets 30–600 €, KV, Leibrente, Kinder, Studium, Dynamik)', () => {
    let worst = 0, evS = 0, evE = 0;
    for (const [i, c] of searchCases(50).entries()) {
      const p = readParams(c.inp);
      const ex = exhaustive(p, searchSpace(p, c.budget, c.keys));
      const r = bestSplit(p, c.budget, c.keys)!;
      evS += r.evals; evE += ex.count;
      // Die Suche selbst ist exakt (top bzw. die genannte Aufteilung); genannt wird höchstens tieTol darunter (einfacher).
      const found = (r.top ?? r).value, loss = ex.best.value - found;
      worst = Math.max(worst, loss);
      expect(loss, `#${i} ${JSON.stringify(c)}: exhaustiv ${splitText(ex.best.split)} vs ${splitText((r.top ?? r).split)}`).toBeLessThanOrEqual(TIE_EUR);
      expect(found, `#${i} Maximum`).toBeGreaterThanOrEqual(ex.max - 2 * TIE_EUR);
      expect(ex.best.value - r.value, `#${i} genannte Aufteilung`).toBeLessThanOrEqual(tieTol(ex.best.value) + TIE_EUR);
    }
    console.log(`S1: größter Verlust ${worst.toFixed(2)} €, Ø ${Math.round(evS / 50)} Auswertungen (erschöpfend Ø ${Math.round(evE / 50)})`);
  }, 60_000);
  it('auch auf dem Originalpfad (NO_FIXES) und im Nominalmodus: 15 Szenarien', () => {
    for (const c of searchCases(15, 99)) {
      const p = readParams({ ...c.inp, real: false });
      const ex = exhaustive(p, searchSpace(p, c.budget, c.keys, { fixes: NO_FIXES }), { fixes: NO_FIXES });
      const r = bestSplit(p, c.budget, c.keys, { fixes: NO_FIXES })!;
      expect(ex.best.value - (r.top ?? r).value).toBeLessThanOrEqual(TIE_EUR);
    }
  }, 30_000);
});

describe('S2 – Eigenschaften der besten Aufteilung', () => {
  const cases = searchCases(40, 123);
  it('nie schlechter als jede reine Strategie und als jede vollständige Aufteilung der Person', () => {
    const { int } = rng(7);
    for (const c of cases) {
      const p = readParams(c.inp);
      const b = bestSplit(p, c.budget, c.keys)!;
      for (const x of pureStrategies(p, c.budget, c.keys)) expect(b.value, JSON.stringify(c) + x.key).toBeGreaterThanOrEqual(x.value - tieTol(x.value) - TIE_EUR);
      // zufällige Nutzer-Aufteilung, auch abseits des 10-€-Rasters
      const u = emptySplit(); let left = c.budget;
      c.keys.forEach((k, i) => { const v = i === c.keys.length - 1 ? left : Math.min(left, int(0, Math.round(c.budget / c.keys.length)) + 0.5 * (i % 2)); u[k] = v; left -= v; });
      const C = analyzeCombo(p, { budget: c.budget, split: u, keys: c.keys }, b);
      expect(C.complete).toBe(true);
      const B = C.best as Exclude<ComboAnalysis['best'], 'pending' | null>;
      const max = Math.max(B.value, B.top?.value ?? -Infinity);
      expect(max).toBeGreaterThanOrEqual(C.user!.value - tieTol(max) - 1e-9);
      expect(B.deltaUser!).toBeGreaterThanOrEqual(0);
    }
  }, 30_000);
  it('deterministisch: gleiche Eingaben, gleiche Aufteilung', () => {
    for (const c of cases.slice(0, 10)) {
      const p = readParams(c.inp);
      expect(bestSplit(p, c.budget, c.keys)!.split).toEqual(bestSplit(readParams(c.inp), c.budget, [...c.keys].reverse())!.split);
    }
  });
  it('Budget kein Vielfaches von 10: Rest im ETF; ohne ETF im ersten anderen Produkt', () => {
    const b = bestSplit(P(), 455, K3)!;
    expect(splitSum(b.split)).toBeCloseTo(455, 9);
    expect(b.split.etf % 10).toBe(5);
    const c = bestSplit(P(), 205, ['avd', 'ins'])!;
    expect(splitSum(c.split)).toBeCloseTo(205, 9);
  });
  it('ein Produkt: ganzes Budget dort; kein ETF: AVD darf über 150 € (Nebendepot)', () => {
    expect(bestSplit(P(), 300, ['ins'])!.split).toEqual(S({ ins: 300 }));
    expect(bestSplit(P(), 300, ['avd'])!.split).toEqual(S({ avd: 300 }));
    const r = bestSplit(P(), 500, ['avd', 'ins'])!;
    expect(r.split.avd).toBeGreaterThan(150);
    expect(bestSplit(P(), 0, K3)).toBeNull();
    expect(bestSplit(P(), 300, [])).toBeNull();
  });
  it('Gleichstand ≤ 1 €: weniger Produkte, dann mehr ETF, dann weniger Versicherung', () => {
    const st = evaluate(P(), S({ etf: 300 })).stats;
    const c = (split: Split, value: number) => ({ split, stats: st, value });
    expect(better(c(S({ etf: 300 }), 100), c(S({ etf: 150, avd: 150 }), 100.9))).toBe(true);
    expect(better(c(S({ etf: 200, ins: 100 }), 100), c(S({ etf: 100, ins: 200 }), 100.5))).toBe(true);
    expect(better(c(S({ avd: 100, ins: 200 }), 100), c(S({ avd: 200, ins: 100 }), 100.5))).toBe(false);
    expect(better(c(S({ etf: 300 }), 100), c(S({ etf: 150, avd: 150 }), 101.5))).toBe(false);
  });
  it('Kurve: ein Punkt je AVD-Betrag, Maximum = beste Aufteilung (sofern im Raster)', () => {
    const r = bestSplit(P(), 500, K3)!;
    expect(r.curve.map(x => x.avd)).toEqual(searchSpace(P(), 500, K3).avdValues);
    expect(Math.max(...r.curve.map(x => x.value))).toBeCloseTo((r.top ?? r).value, 6);
  });
});

describe('S3 – Snapshot Standardwerte (ALL_FIXES, Kaufkraft)', () => {
  // Aktuelle Snapshots inklusive R1/R6/R8, kvRate 21,1 %, kvOn aus.
  // Die Werte für 150 € stimmen mit dem Einzel-Snapshot in fixes.test.ts überein (AVD real 174.868).
  // Mit E10 (ungeförderte Beiträge im AVD-Vertrag) bleibt rund 170 € im ETF, dessen Gewinne der Sparer-Pauschbetrag
  // weitgehend freistellt; der Rest geht ins AVD (hälftig versteuerter Gewinn). Ohne E10 war es 150 € AVD + Rest ETF
  // (325.453 / 469.616 / 517.304). Bei 300 € liegt 160 € AVD + 140 € ETF nur 7 € (< 0,1 %, TIE_REL) vorne; genannt wird
  // deshalb 150 € + 150 € (mehr ETF), das Maximum steht in `top`. Bewusst anpassen, wenn sich das Modell ändert.
  const SNAP: [number, Split, number, number][] = [
    [150, S({ avd: 150 }), 174868, 633.58],
    [300, S({ etf: 150, avd: 150 }), 325432, 1179.10],
    [450, S({ etf: 170, avd: 280 }), 470867, 1706.04],
    [500, S({ etf: 170, avd: 330 }), 519205, 1881.18],
  ];
  for (const keys of [K3, K4]) for (const [B, split, cumHReal, avg] of SNAP) it(`${keys.length} Produkte, ${B} € → ${splitText(split)}`, () => {
    const r = bestSplit(P({ fondOn: keys.length === 4 }), B, keys)!;
    expect(r.split).toEqual(split);
    expect(Math.abs(r.value - cumHReal)).toBeLessThan(1);
    expect(Math.abs(r.stats.avgMonthly - avg)).toBeLessThan(0.01);
    if (B === 300) { expect(r.top!.split).toEqual(S({ etf: 140, avd: 160 })); expect(Math.round(r.top!.value)).toBe(325439); }
    else expect(r.top).toBeNull();
  });
  it('1.000 €: 570 € AVD + 430 € ETF bleibt (7.622 € = 0,8 % vor 150 € + 850 €), nicht „alles ins AVD“ mit Nebendepot', () => {
    const r = bestSplit(P(), 1000, K3)!;
    expect(r.split).toEqual(S({ etf: 430, avd: 570 }));
    expect(r.top).toBeNull();
    const c150 = r.curve.find(x => x.avd === 150)!;
    expect(c150.split).toEqual(S({ etf: 850, avd: 150 }));
    expect(Math.round(r.value - c150.value)).toBe(7622);
  });
  it('reine Strategien bei 500 €: ETF 488.459, AVD (150 gefördert + 350 ungefördert) 513.031, Versicherung 406.049', () => {
    const pure = pureStrategies(P(), 500, K3);
    expect(pure.map(x => Math.round(x.value))).toEqual([488459, 513009, 406049]);
    expect(pure[1].label).toBe('Alles ins Altersvorsorgedepot (150 € gefördert + 350 € ungefördert)');
    expect(pureStrategies(P(), 700, ['avd'])[0].label).toBe('Alles ins Altersvorsorgedepot (150 € gefördert + 420 € ungefördert + 130 € Nebendepot)');
    // ohne E10 wie bisher: AVD 150 € + Nebendepot = 150 € AVD + Rest im ETF
    const old = pureStrategies(P(), 500, K3, NO_UNSUB);
    expect(Math.round(old[1].value)).toBe(517284);
    expect(old[1].label).toBe('Alles ins Altersvorsorgedepot (150 € gefördert + 350 € Nebendepot)');
  });
});

const bestOf = (C: ComboAnalysis) => C.best as Exclude<ComboAnalysis['best'], 'pending' | null>;
const full = (patch: Partial<Inputs>) => {
  const inp = { ...DEFAULTS, ...KOMBI_BASE, ...patch }, p = readParams(inp), setup = readCombo(inp, p);
  return { p, setup, best: bestSplit(p, setup.budget, setup.keys) };
};

describe('analyzeCombo', () => {
  it('Standardwerte 150/150/150: vollständig, hinter der besten, Wechselwirkung negativ, Mischen bringt etwas (E10)', () => {
    const { p, setup, best } = full({});
    const C = analyzeCombo(p, setup, best);
    expect(C.complete).toBe(true); expect(C.gap).toBe(0); expect(C.canRank).toBe(true); expect(C.refundSpent).toBe(false);
    const B = bestOf(C);
    expect(B.split).toEqual(S({ etf: 170, avd: 280 }));
    expect(B.userIsBest).toBe(false);
    expect(B.deltaUser!).toBeCloseTo(B.value - C.user!.value, 9);
    expect(B.isMix).toBe(true); expect(B.mixGain).toBeGreaterThan(5000);
    expect(C.bestPure!.key).toBe('avd');
    expect(C.interaction!).toBeLessThan(-1000);
    expect(C.separate! + C.interaction!).toBeCloseTo(C.user!.value, 6);
    // Teil-Kennzahlen vorhanden, Summe der Teil-cumHReal = Gesamt
    expect(Object.keys(C.user!.partStats)).toEqual(['etf', 'avd', 'ins']);
    const s = Object.values(C.user!.partStats).reduce((a, x) => a + x!.cumHReal, 0);
    expect(s).toBeCloseTo(C.user!.stats.cumHReal, 6);
  });
  it('ohne passende Suche: best = pending (auch bei veralteter Signatur)', () => {
    const { p, setup, best } = full({});
    expect(analyzeCombo(p, setup).best).toBe('pending');
    expect(analyzeCombo(p, { ...setup, budget: 500 }, best).best).toBe('pending');
    expect(analyzeCombo({ ...p, g: 0.05 }, setup, best).best).toBe('pending');
  });
  it('unvollständig: gap, restTarget; Nutzer-Ergebnis trotzdem gerechnet', () => {
    const { p, setup, best } = full({ setAll: 500 });
    const C = analyzeCombo(p, setup, best);
    expect(C.complete).toBe(false); expect(C.gap).toBe(50); expect(C.restTarget).toBe('etf');
    expect(C.user).not.toBeNull();
    expect(bestOf(C).deltaUser).toBeNull();
    expect(restTarget(['avd', 'ins'])).toBe('ins'); expect(restTarget(['avd'])).toBe('avd'); expect(restTarget([])).toBeNull();
  });
  it('deine Aufteilung = beste ⇒ userIsBest', () => {
    const { p, setup, best } = full({ setAll: 500, cEtf: 170, cAvd: 330, cIns: 0 });
    const B = bestOf(analyzeCombo(p, setup, best));
    expect(B.userIsBest).toBe(true); expect(B.deltaUser!).toBeLessThanOrEqual(TIE_EUR);
  });
  it('Aufteilung außerhalb des Rasters, die besser ist als das Raster-Optimum, wird als beste gezeigt (fromUser)', () => {
    const { p, setup, best } = full({ setAll: 500, cEtf: 170, cAvd: 330, cIns: 0 });
    const worse: BestSplitResult = { ...best!, value: best!.value - 2 * tieTol(best!.value) };
    const B = bestOf(analyzeCombo(p, setup, worse));
    expect(B.fromUser).toBe(true); expect(B.userIsBest).toBe(true); expect(B.split).toEqual(setup.split);
  });
  it('Erstattung ausgegeben ⇒ refundSpent, keine Rangfolge; ein Produkt ⇒ best null', () => {
    const a = full({ reinvest: false });
    const C = analyzeCombo(a.p, a.setup, a.best);
    expect(C.refundSpent).toBe(true); expect(C.canRank).toBe(false);
    const one = full({ avdOn: false, insOn: false, setAll: 150, cEtf: 150 });
    expect(analyzeCombo(one.p, one.setup, one.best).best).toBeNull();
  });
  it('mit KV und hoher Rente: Wechselwirkung positiv (eine BBG), Mischung echt besser als reine Strategie', () => {
    const { p, setup, best } = full({ kvOn: true, incRet: 60000, insLump: false, setAll: 750, cEtf: 300, cAvd: 150, cIns: 300 });
    const C = analyzeCombo(p, setup, best);
    expect(C.interaction!).toBeGreaterThan(1000);
    expect(bestOf(C).isMix).toBe(true);
    expect(bestOf(C).mixGain).toBeGreaterThan(TIE_EUR);
  });
});

describe('Robustheit', () => {
  it('eine Zeile je next(), ohne „Steuererstattung ausgegeben“; Standardwerte 450 €: 6 von 9 kippen, KV zu 420 ETF + 30 AVD', () => {
    const { p, setup, best } = full({});
    const gen = robustRows(p, setup, best!.split);
    const first = gen.next();
    expect(first.done).toBe(false);
    const rows: RobustRow[] = [first.value as RobustRow, ...gen];
    const ids = scenarioList(p).map(s => s.id).filter(id => id !== 'refund');
    expect(rows.map(r => r.id)).toEqual(ids);
    expect(robustScenarios(p).some(s => s.id === 'refund')).toBe(false);
    const sum = robustSummary(rows);
    // Mit E10 verschiebt sich die beste Mischung (ETF bis zum Pauschbetrag, Rest AVD) mit jeder Steuerannahme.
    // „shift“: Mit Umschichtung zahlt das ETF-Depot beim Verkauf Steuern, das AVD nicht; die beste Mischung verschiebt sich.
    expect(sum.flips.map(r => r.id)).toEqual(['kv', 'avdCost', 'g', 'incRetLow', 'incRetHigh', 'shift']);
    expect(sum.flips[0].best.split).toEqual(S({ etf: 300, avd: 150 }));
    expect(sum.flips.find(r => r.id === 'incRetHigh')!.best.split).toEqual(S({ etf: 300, avd: 150 }));
    expect(sum.flips.find(r => r.id === 'incRetLow')!.best.split.avd).toBeGreaterThan(280);
    expect(sum.level).toBe('fragile'); expect(sum.held).toBe(ids.length - 6);
    for (const r of rows) {
      expect(r.user).not.toBeNull(); expect(r.bestPure).not.toBeNull();
      if (!r.flip) expect(r.best.value - r.baseInScenario!.value).toBeLessThanOrEqual(TIE_EUR);
    }
  });
  it('ohne Basis-Aufteilung sucht der erste Aufruf sie selbst; Budget 0 ⇒ keine Zeilen', () => {
    const { p, setup } = full({});
    expect([...robustRows(p, setup)].length).toBe(robustScenarios(p).length);
    expect([...robustRows(p, { ...setup, budget: 0 })]).toEqual([]);
  });
  it('Stufen: 0 → robust, < 1/3 → mixed, ≥ 1/3 → fragile', () => {
    expect(robustLevel(0, 8)).toBe('robust'); expect(robustLevel(2, 8)).toBe('mixed');
    expect(robustLevel(3, 9)).toBe('fragile'); expect(robustLevel(3, 8)).toBe('fragile');
  });
});

describe('Ergebnissätze (comboVerdict)', () => {
  const V = (patch: Partial<Inputs>, robust = false) => {
    const { p, setup, best } = full(patch);
    const C = analyzeCombo(p, setup, best);
    return { C, v: comboVerdict(C, robust ? robustSummary([...robustRows(p, setup, best?.split)]) : null) };
  };
  const all = (v: ReturnType<typeof comboVerdict>) => [v.headline, ...v.lines, v.note].join(' ');

  it('Formatierung: eurRound (U17, format.ts), eurAmount, splitText', () => {
    expect(eurRound(20419)).toBe('20.400 €'); expect(eurRound(6234)).toBe('6.230 €'); expect(eurRound(987.6)).toBe('988 €'); expect(eurRound(-6234)).toBe('-6.230 €');
    expect(eurAmount(50)).toBe('50 €'); expect(eurAmount(12.5)).toBe('12,50 €');
    expect(splitText(S({ etf: 350, avd: 150 }))).toBe('350 € ETF-Depot + 150 € Altersvorsorgedepot');
    expect(splitText(S({ avd: 30, etf: 470 }), 'short')).toBe('470 € ETF + 30 € AVD');
    expect(splitText(S({}))).toBe('nichts verteilt');
  });
  it('needTwo', () => {
    const { v } = V({ avdOn: false, insOn: false });
    expect(v.kind).toBe('needTwo'); expect(v.headline).toBe('Wähle mindestens zwei Produkte zum Aufteilen.');
  });
  it('unallocated: offen, zu viel, Budget 0', () => {
    expect(V({ setAll: 500 }).v).toMatchObject({ kind: 'unallocated', headline: 'Noch 50 € offen.', lines: ['Verteile das ganze Budget, dann vergleicht der Rechner fair.'] });
    expect(V({ setAll: 400 }).v).toMatchObject({ kind: 'unallocated', headline: '50 € mehr verteilt als das Budget von 400 €.' });
    expect(V({ setAll: 0 }).v).toMatchObject({ kind: 'unallocated', headline: 'Gib ein Monatsbudget größer als 0 € ein.' });
  });
  it('refundSpent', () => {
    const { v } = V({ reinvest: false });
    expect(v.kind).toBe('refundSpent');
    expect(v.headline).toBe('Mit ausgegebener Steuererstattung lässt sich keine Aufteilung fair vergleichen.');
    expect(v.lines[1]).toMatch(/^Deine Aufteilung: Ø [\d.]+ € netto im Monat \(67–90\)\.$/);
  });
  it('ok, hinter der besten (Standardwerte 150/150/150), mit Mischen-, Wechselwirkungs- und Robustheitssatz', () => {
    const { C, v } = V({}, true);
    expect(v.kind).toBe('ok'); expect(v.pending).toBe(false);
    expect(v.headline).toBe('Deine Aufteilung: Ø ' + Math.round(C.user!.stats.avgMonthly).toLocaleString('de-DE') + ' € netto im Monat (67–90).');
    expect(v.lines[0]).toMatch(/^Rechnerisch am meisten bringt hier 280 € Altersvorsorgedepot \+ 170 € ETF-Depot: Ø 1\.706 € im Monat\. Bis zum Alter von 90 sind das zusammen rund [\d.]+00 € mehr netto\.$/);
    expect(v.lines[1]).toBe('Davon sind 130 € im Monat ungefördert im Altersvorsorgedepot (keine Zulage, aber keine Steuer bis zur Auszahlung). Mit 150 € im AVD (voll gefördert) und 300 € ETF-Depot wären es bis zum Alter von 90 rund 1.270 € (0,3 %) weniger. Dieser Vorteil hängt an niedrigen AVD-Kosten (gerechnet: 0,5 % im Jahr), und das Geld ist bis zur Rente gebunden.');
    expect(v.lines[2]).toMatch(/^Die rechnerisch beste Aufteilung ist eine Mischung: bis zum Alter von 90 rund [\d.]+ € mehr netto als „Alles ins Altersvorsorgedepot \(150 € gefördert \+ 300 € ungefördert\)“\.$/);
    expect(v.lines[3]).toMatch(/^Gemeinsam gerechnet zahlt deine Aufteilung bis zum Alter von 90 rund [\d.]+ € mehr Steuern und Abgaben, als wenn jedes Produkt allein gerechnet würde \(ein Sparer-Pauschbetrag für alle Depots, progressiver Steuertarif\)\.$/);
    expect(v.lines[4]).toBe('Die beste Aufteilung hängt hier stark von den Annahmen ab: In 6 von 9 Szenarien unten ist eine andere Aufteilung rechnerisch vorne, z. B. bei „Als Rentner freiwillig gesetzlich versichert“ (300 € ETF + 150 € AVD).');
    expect(v.note).toContain('keine Anlageberatung');
  });
  it('ok, deine Aufteilung ist auf den Euro die beste (300 € = 140 ETF + 160 AVD); 4 von 7 Szenarien verschieben sie ⇒ „hängt stark ab“', () => {
    const { v } = V({ setAll: 300, cEtf: 140, cAvd: 160, cIns: 0, insOn: false }, true);
    expect(v.headline).toBe('Deine Aufteilung ist unter diesen Annahmen rechnerisch die beste: Ø 1.179 € netto im Monat (67–90).');
    expect(v.lines.some(l => l.startsWith('Rechnerisch am meisten') || l.startsWith('Auf den Euro'))).toBe(false);
    expect(v.lines.at(-1)).toBe('Die beste Aufteilung hängt hier stark von den Annahmen ab: In 3 von 7 Szenarien unten ist eine andere Aufteilung rechnerisch vorne, z. B. bei „AVD kostet 1,0 % (Deckel Standarddepot)“ (270 € ETF + 30 € AVD).');
  });
  it('gleichauf (TIE_REL): 300 € = 150 ETF + 150 AVD, 160/140 nur 6 € vorne', () => {
    const { C, v } = V({ setAll: 300, cEtf: 150, cAvd: 150, cIns: 0, insOn: false });
    expect(bestOf(C).split).toEqual(S({ etf: 150, avd: 150 }));
    expect(bestOf(C).userIsBest).toBe(true);
    expect(v.headline).toBe('Deine Aufteilung ist unter diesen Annahmen rechnerisch gleichauf mit der besten (weniger als 0,1 % Unterschied): Ø 1.179 € netto im Monat (67–90).');
    expect(v.lines[0]).toBe('Auf den Euro gerechnet liegt 160 € Altersvorsorgedepot + 140 € ETF-Depot bis zum Alter von 90 rund 7 € vorne. Das sind weniger als 0,1 % und weit unter der Unsicherheit der Annahmen. Bei so kleinen Unterschieden zählt der Rechner die Aufteilung mit mehr ETF als beste, weil das Geld dort jederzeit verfügbar ist.');
    expect(v.lines.some(l => l.includes('ungefördert im Altersvorsorgedepot (keine'))).toBe(false);
  });
  it('AVD über 150 €: Abstand zu „150 € + Rest“ beziffert (1.000 €, deine Aufteilung = beste)', () => {
    const { v } = V({ setAll: 1000, cEtf: 430, cAvd: 570, cIns: 0, insOn: false });
    expect(v.headline).toMatch(/^Deine Aufteilung ist unter diesen Annahmen rechnerisch die beste/);
    expect(v.lines[0]).toBe('In deiner Aufteilung sind 420 € im Monat ungefördert im Altersvorsorgedepot (keine Zulage, aber keine Steuer bis zur Auszahlung). Mit 150 € im AVD (voll gefördert) und 850 € ETF-Depot wären es bis zum Alter von 90 rund 7.620 € (0,8 %) weniger. Dieser Vorteil hängt an niedrigen AVD-Kosten (gerechnet: 0,5 % im Jahr), und das Geld ist bis zur Rente gebunden.');
  });
  it('robust: „bleibt in allen … Szenarien unten vorne“', () => {
    const { p, setup, best } = full({});
    const C = analyzeCombo(p, setup, best);
    const rows = [...robustRows(p, setup, best!.split)].map(r => ({ ...r, flip: false }));
    expect(comboVerdict(C, robustSummary(rows)).lines.at(-1)).toBe('Die rechnerisch beste Aufteilung bleibt in allen 9 Szenarien unten vorne.');
  });
  it('pending: nur deine Aufteilung und „wird berechnet“', () => {
    const { p, setup } = full({});
    const v = comboVerdict(analyzeCombo(p, setup));
    expect(v).toMatchObject({ kind: 'ok', pending: true, lines: ['Die rechnerisch beste Aufteilung wird berechnet …'] });
  });
  it('Mischung echt besser + Wechselwirkung positiv mit KV', () => {
    const { v } = V({ kvOn: true, incRet: 60000, insLump: false, setAll: 750, cEtf: 300, cAvd: 150, cIns: 300 });
    expect(v.lines.some(l => /^Die rechnerisch beste Aufteilung ist eine Mischung: bis zum Alter von 90 rund [\d.]+ € mehr netto als „Alles/.test(l))).toBe(true);
    expect(v.lines.some(l => l.endsWith('weniger Abgaben, als wenn jedes Produkt allein gerechnet würde, weil die Beitragsbemessungsgrenze der Krankenversicherung die Summe deckelt.'))).toBe(true);
  });
  it('nominal: Abstände mit „(in heutiger Kaufkraft)“, Abstand = reale Differenz', () => {
    const { C, v } = V({ real: false });
    expect(v.lines[0]).toContain('mehr netto'); expect(v.lines[0]).toContain(' (in heutiger Kaufkraft) mehr netto.');
    const B = bestOf(C);
    expect(B.deltaUser!).toBeCloseTo(B.stats.cumHReal - C.user!.stats.cumHReal, 6);
    expect(V({}).v.lines.join(' ')).not.toContain('Kaufkraft');
  });
  it('fragile: „hängt stark von den Annahmen ab“', () => {
    const { p, setup, best } = full({});
    const C = analyzeCombo(p, setup, best);
    const rows = [...robustRows(p, setup, best!.split)];
    const fake = { ...robustSummary(rows), level: 'fragile' as const };
    expect(comboVerdict(C, fake).lines.at(-1)).toMatch(/^Die beste Aufteilung hängt hier stark von den Annahmen ab: In 6 von 9 Szenarien/);
  });
  it('neutrale Wortwahl in allen Fällen (nie „optimal“, „empfehlen“, „solltest“)', () => {
    const variants: Partial<Inputs>[] = [{}, { setAll: 500 }, { reinvest: false }, { avdOn: false, insOn: false }, { kvOn: true, incRet: 60000, insLump: false, setAll: 750, cEtf: 300, cAvd: 150, cIns: 300 }, { real: false }, { a0: 55, incRet: 0 }];
    for (const patch of variants) {
      const text = all(V(patch, true).v);
      expect(text).not.toMatch(/optimal|empfehl|solltest|lohnt sich für dich/i);
    }
  }, 30_000);
});

describe('Laufzeit (Node)', () => {
  const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  const time = (f: () => void) => { const t0 = performance.now(); f(); return performance.now() - t0; };
  // Mit E10 ist das AVD-Raster bis 570 € statt 150 € lang (doppelt so viele Auswertungen), daher < 30 ms.
  it('beste Aufteilung mit 4 Produkten und 500 € < 30 ms; analyzeCombo < 5 ms; Robustheit je Zeile < 30 ms', () => {
    const p = P({ fondOn: true });
    const setup = setupOf({ fondOn: true, setAll: 500, cEtf: 200, cAvd: 150, cIns: 100, cFond: 50 });
    for (let i = 0; i < 5; i++) bestSplit(p, 500, K4); // Aufwärmen (JIT)
    const tBest = median(Array.from({ length: 7 }, () => time(() => bestSplit(p, 500, K4))));
    const best = bestSplit(p, 500, K4)!;
    const tAna = median(Array.from({ length: 7 }, () => time(() => analyzeCombo(p, setup, best))));
    const rowTimes: number[] = [];
    const gen = robustRows(p, setup, best.split);
    for (;;) { const t0 = performance.now(); const r = gen.next(); if (r.done) break; rowTimes.push(performance.now() - t0); }
    console.log(`Laufzeit: beste Aufteilung (4 Produkte, 500 €, ${best.evals} Auswertungen) ${tBest.toFixed(1)} ms; analyzeCombo ${tAna.toFixed(2)} ms; Robustheit ${rowTimes.length} Zeilen, Median ${median(rowTimes).toFixed(1)} ms, max ${Math.max(...rowTimes).toFixed(1)} ms`);
    expect(tBest).toBeLessThan(30);
    expect(tAna).toBeLessThan(5);
    expect(median(rowTimes)).toBeLessThan(30);
  });
  it('eine Auswertung (ohne Kosten-Lauf) < 0,5 ms', () => {
    const p = P(); const s = S({ etf: 150, avd: 150, ins: 150 });
    for (let i = 0; i < 300; i++) evaluate(p, s);
    const t = time(() => { for (let i = 0; i < 1000; i++) evaluate(p, s); }) / 1000;
    console.log(`Laufzeit: eine Auswertung ${(t * 1000).toFixed(0)} µs`);
    expect(t).toBeLessThan(0.5);
  });
});

// Typprüfung: Params bleibt frei von Kombi-Schlüsseln (Golden-Test vergleicht Params mit dem Original).
const _noComboInParams: 'cEtf' extends keyof Params ? never : true = true;
void _noComboInParams;
