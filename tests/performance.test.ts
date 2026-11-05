// Laufzeitbudgets separat nach den Funktionstests ausführen: npm run test:perf.
// Keine parallelen Golden-/Suchtests im selben Lauf; keine Aussage über kalten Start oder Browser.
import { describe, expect, it } from 'vitest';
import { readParams } from '../src/lib/engine/core';
import { DEFAULTS, type Inputs } from '../src/lib/engine/inputs';
import { ALL_FIXES, NO_FIXES, type FixId } from '../src/lib/engine/fixes';
import { analyze, scenarios } from '../src/lib/engine/analyze';
import { emptySplit, readCombo, type Split } from '../src/lib/engine/combo';
import { bestSplit, evaluate } from '../src/lib/engine/search';
import { analyzeCombo, robustRows } from '../src/lib/engine/comboAnalyze';
import { costBreakEvens } from '../src/lib/engine/breakEven';
const P = (patch: Partial<Inputs> = {}) => readParams({ ...DEFAULTS, ...patch });
const S = (patch: Partial<Split>) => ({ ...emptySplit(), ...patch });
const K4 = ['etf', 'avd', 'ins', 'fond'] as const;
const setupOf = (patch: Partial<Inputs>) => {
  const inp = { ...DEFAULTS, ...patch };
  return readCombo(inp, readParams(inp));
};
const NONE = { fixes: NO_FIXES }, ALL = { fixes: ALL_FIXES };
const DK: Partial<Inputs> = { kvOn: true, kvRate: 21.7 };
const HIGH: Partial<Inputs> = { a0: 30, incWork: 110000, incRet: 45000, setAll: 500, etfM: 500, avdM: 500, insM: 500, fondM: 500, kvOn: true, kvRate: 21.7 };

describe('Laufzeit (Node)', () => {
  const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  const time = (f: () => void) => { const t0 = performance.now(); f(); return performance.now() - t0; };
  // Node-Budget nach explizitem Warm-up, auch beim isolierten Start dieser Tests.
  // Kalte JIT-Kompilierung und einmalige Ausreißer nicht mit dem warmen Budget vermischen.
  it('beste Aufteilung mit 4 Produkten und 500 € < 30 ms; analyzeCombo < 5 ms; Robustheit je Zeile < 50 ms', () => {
    const p = P({ fondOn: true });
    const setup = setupOf({ fondOn: true, setAll: 500, cEtf: 200, cAvd: 150, cIns: 100, cFond: 50 });
    for (let i = 0; i < 30; i++) bestSplit(p, 500, K4); // Aufwärmen unabhängig von vorigen Suchtests
    const tBest = median(Array.from({ length: 7 }, () => time(() => bestSplit(p, 500, K4))));
    const best = bestSplit(p, 500, K4)!;
    for (let i = 0; i < 30; i++) analyzeCombo(p, setup, best);
    const tAna = median(Array.from({ length: 7 }, () => time(() => analyzeCombo(p, setup, best))));
    // Alle Szenariopfade zunächst aufwärmen, dann jede Zeile in drei Durchläufen messen.
    // Median je Zeile dämpft Scheduler-/GC-Ausreißer; Grenzen bleiben unverändert.
    for (const _row of robustRows(p, setup, best.split)) { /* JIT */ }
    const samples: number[][] = [];
    for (let pass = 0; pass < 3; pass++) {
      const gen = robustRows(p, setup, best.split);
      for (let i = 0;; i++) {
        const t0 = performance.now(), r = gen.next(), elapsed = performance.now() - t0;
        if (r.done) break;
        (samples[i] ??= []).push(elapsed);
      }
    }
    const rowTimes = samples.map(median);
    console.log(`Laufzeit: beste Aufteilung (4 Produkte, 500 €, ${best.evals} Auswertungen) ${tBest.toFixed(1)} ms; analyzeCombo ${tAna.toFixed(2)} ms; Robustheit ${rowTimes.length} Zeilen, Median ${median(rowTimes).toFixed(1)} ms, max ${Math.max(...rowTimes).toFixed(1)} ms`);
    expect(tBest).toBeLessThan(30);
    expect(tAna).toBeLessThan(5);
    expect(median(rowTimes)).toBeLessThan(50);
  });
  it('Kosten-Gleichstand für AVD, Versicherung und Fonds (bei jeder Eingabe in der Übersicht) < 15 ms', () => {
    const cases = [P({ fondOn: true }), P({ fondOn: true, kvOn: true, kvRate: 21.7 }), P({ ...HIGH, fondOn: true, fondM: 500 })].map(p => analyze(p));
    for (let i = 0; i < 10; i++) for (const A of cases) costBreakEvens(A);
    const t = median(cases.flatMap(A => Array.from({ length: 7 }, () => time(() => costBreakEvens(A)))));
    console.log(`Laufzeit: Kosten-Gleichstand (3 Produkte) Median ${t.toFixed(1)} ms`);
    expect(t).toBeLessThan(15);
  });
  it('eine Auswertung (ohne Kosten-Lauf) < 0,5 ms', () => {
    const p = P(); const s = S({ etf: 150, avd: 150, ins: 150 });
    for (let i = 0; i < 300; i++) evaluate(p, s);
    const t = time(() => { for (let i = 0; i < 1000; i++) evaluate(p, s); }) / 1000;
    console.log(`Laufzeit: eine Auswertung ${(t * 1000).toFixed(0)} µs`);
    expect(t).toBeLessThan(0.5);
  });
});

describe('Laufzeit', () => {
  it('analyze + scenarios mit ALL_FIXES höchstens 3,5 × (mehr Sensitivitäten und jährliche Steuerprüfung) so lang wie ohne Fixes', () => {
    // Messung (MacBook, Node 26, 2026-11-03): siehe Konsole; ohne Fixes entspricht der Pfad dem Original.
    const cases = [P(), P(DK), P(HIGH), P({ insLump: false, fondOn: true, kvOn: true })];
    const run = (o: { fixes: ReadonlySet<FixId> }) => { for (const p of cases) { analyze(p, o); scenarios(p, o); } };
    const time = (o: { fixes: ReadonlySet<FixId> }) => { const t0 = performance.now(); for (let i = 0; i < 20; i++) run(o); return performance.now() - t0; };
    for (let i = 0; i < 3; i++) { time(NONE); time(ALL); } // Aufwärmen
    let tn = Infinity, ta = Infinity;
    for (let i = 0; i < 7; i++) { tn = Math.min(tn, time(NONE)); ta = Math.min(ta, time(ALL)); }
    console.log(`Laufzeit analyze+scenarios: ohne Fixes ${(tn / 80).toFixed(2)} ms, mit allen ${(ta / 80).toFixed(2)} ms je Fall (× ${(ta / tn).toFixed(2)})`);
    expect(ta / tn).toBeLessThan(3.5);
  }, 60_000);
});
