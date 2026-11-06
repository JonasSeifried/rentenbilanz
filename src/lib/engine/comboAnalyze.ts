// Auswertung des Kombi-Modus: deine Aufteilung, reine Strategien, beste Aufteilung, Wechselwirkung, Robustheit.
// Alle Vergleiche über die Zielgröße der Suche (cumHReal, heutige Kaufkraft), unabhängig vom Anzeige-Schalter.
//
// Aufruf aus der Oberfläche (Vorschlag, docs/kombi-modus.md):
//   const setup = readCombo(inputs, p);                       // synchron
//   const C = analyzeCombo(p, setup, lastBest);               // synchron in $derived (≈ 0,1–0,5 ms)
//   lastBest = bestSplit(p, setup.budget, setup.keys);        // 120 ms entprellt (≈ 3–8 ms)
//   for (const row of robustRows(p, setup, lastBest.split))   // je Zeile ein Leerlauf-Slot, Generationszähler
// analyzeCombo verwendet `lastBest` nur, wenn dessen Signatur zu (p, Budget, Produkte) passt, sonst best = 'pending'.

import type { Params, ProductKey } from './core';
import { scenarioList, type ScenarioId } from './analyze';
import { lawOf, type EngineOptions } from './fixes';
import { combo, comboStats, emptySplit, partStats, splitSum, SPLIT_KEYS, type ComboResult, type ComboSetup, type ComboStats, type Split } from './combo';
import {
  bestSplit, better, comboSig, evaluate, objective, pureStrategies, TIE_EUR, tieTol,
  type BestSplitResult, type Cand, type CurvePoint, type PureStrategy,
} from './search';

/** Toleranz für „Budget vollständig verteilt“ (€/Monat). */
export const SPLIT_EPS = 0.005;

export interface ComboEval {
  split: Split; res: ComboResult; stats: ComboStats;
  /** Zielgröße (cumHReal). */
  value: number;
  /** Kennzahlen je Teil (anteilige Zuordnung der gemeinsamen Abzüge). */
  partStats: Partial<Record<ProductKey, ComboStats>>;
}

export interface BestView {
  split: Split; stats: ComboStats; value: number; curve: CurvePoint[];
  /** Deine (nicht auf dem 10-€-Raster liegende) Aufteilung ist besser als das Raster-Optimum und wird als beste gezeigt. */
  fromUser: boolean;
  /** Deine Aufteilung ist vollständig und höchstens tieTol schlechter als die beste (gleichwertig). */
  userIsBest: boolean;
  /** Rechnerisches Maximum, wenn die genannte Aufteilung eine gleichwertige einfachere ist (siehe BestSplitResult.top). */
  top: { split: Split; stats: ComboStats; value: number } | null;
  /** Abstand beste − deine (Summe bis H, heutige Kaufkraft, ≥ 0); null ohne vollständige Aufteilung. */
  deltaUser: number | null;
  /** Abstand im Monatsdurchschnitt (Anzeige-Einheit); null ohne vollständige Aufteilung. */
  deltaUserMonthly: number | null;
  /** Vorteil der besten Aufteilung gegenüber der besten reinen Strategie (heutige Kaufkraft, ≥ 0). */
  mixGain: number;
  /** mixGain > TIE_EUR: Die beste Aufteilung ist eine echte Mischung. */
  isMix: boolean;
}

export interface ComboAnalysis {
  p: Params;
  /** Signatur für bestSplit/robustRows (comboSig). */
  sig: string;
  budget: number; keys: ProductKey[]; split: Split;
  /** Σ Aufteilung; gap = budget − allocated (positiv: noch offen, negativ: zu viel). */
  allocated: number; gap: number; complete: boolean;
  /** Produkt für „Rest … geben“: ETF, sonst das erste Nicht-AVD-Produkt, sonst AVD. */
  restTarget: ProductKey | null;
  /** Deine Aufteilung (mit Kosten-Lauf); null, wenn nichts verteilt ist. Auch bei unvollständiger Aufteilung gerechnet. */
  user: ComboEval | null;
  /** Reine Strategien (ganzes Budget in ein Produkt), in Produktreihenfolge. */
  pure: PureStrategy[];
  bestPure: PureStrategy | null;
  /** null: weniger als zwei Produkte oder Budget 0. 'pending': Suche läuft noch bzw. passt nicht zu den Eingaben. */
  best: BestView | 'pending' | null;
  /** Σ der Teile deiner Aufteilung, jeder allein gerechnet (heutige Kaufkraft); null bei weniger als zwei Teilen. */
  separate: number | null;
  /** Wechselwirkung = gemeinsam − getrennt (heutige Kaufkraft). Negativ: gemeinsam mehr Abgaben. */
  interaction: number | null;
  /** AVD gewählt, Erstattung ausgegeben, und es gäbe eine: kein fairer Vergleich. */
  refundSpent: boolean;
  /** Es darf eine beste Aufteilung genannt werden: ≥ 2 Produkte, Budget > 0, keine ausgegebene Erstattung. */
  canRank: boolean;
}

export function restTarget(keys: readonly ProductKey[]): ProductKey | null {
  if (keys.includes('etf')) return 'etf';
  return keys.find(k => k !== 'avd') ?? (keys.includes('avd') ? 'avd' : null);
}

export function evaluateFull(p: Params, split: Split, opts?: EngineOptions): ComboEval {
  const res = combo(p, split, { ...opts, cost: true });
  const stats = comboStats(p, res);
  const ps: ComboEval['partStats'] = {};
  for (const k of SPLIT_KEYS) { const s = partStats(p, res, k); if (s) ps[k] = s; }
  return { split, res, stats, value: objective(stats, opts), partStats: ps };
}

export function analyzeCombo(p: Params, setup: ComboSetup, best?: BestSplitResult | null, opts?: EngineOptions): ComboAnalysis {
  const { budget, keys } = setup;
  const split = emptySplit();
  for (const k of keys) split[k] = setup.split[k];
  const allocated = splitSum(split), gap = budget - allocated;
  const complete = Math.abs(gap) < SPLIT_EPS;
  const sig = comboSig(p, budget, keys, opts);
  const user = allocated > 0 ? evaluateFull(p, split, opts) : null;
  const pure = budget > 0 ? pureStrategies(p, budget, keys, opts) : [];
  const bestPure = pure.reduce<PureStrategy | null>((a, b) => (!a || better(b, a) ? b : a), null);

  // Wechselwirkung: jeder Teil deiner Aufteilung allein gerechnet
  const userKeys = SPLIT_KEYS.filter(k => split[k] > 0);
  let separate: number | null = null, interaction: number | null = null;
  if (user && userKeys.length > 1) {
    separate = 0;
    for (const k of userKeys) separate += evaluate(p, { ...emptySplit(), [k]: split[k] }, opts).value;
    interaction = user.value - separate;
  }

  // Erstattung ausgegeben: Das AVD bekommt netto weniger eigenes Geld als die anderen Produkte.
  const avdRef = user?.res.parts.avd?.ref ?? (keys.includes('avd') && budget > 0 ? combo(p, { ...emptySplit(), avd: budget }, opts).parts.avd!.ref! : 0);
  const refundSpent = keys.includes('avd') && !p.reinvest && avdRef !== 0; // negativ nur mit Partner-Vertrag (Mehrsteuer)
  const canRank = keys.length >= 2 && budget > 0 && !refundSpent;

  let bestView: ComboAnalysis['best'] = null;
  if (keys.length >= 2 && budget > 0) {
    if (!best || best.sig !== sig) bestView = 'pending';
    else {
      let b: Cand & { curve: CurvePoint[] } = { split: best.split, stats: best.stats, value: best.value, curve: best.curve };
      let top: BestView['top'] = best.top ? { split: best.top.split, stats: best.top.stats, value: best.top.value } : null;
      const max = top?.value ?? b.value;
      let fromUser = false;
      // Deine Aufteilung (nicht auf dem 10-€-Raster) übertrifft selbst das rechnerische Maximum um mehr als die Toleranz.
      if (user && complete && user.value > max + tieTol(max)) { b = { split: { ...split }, stats: user.stats, value: user.value, curve: best.curve }; fromUser = true; top = null; }
      const ref = top ? Math.max(b.value, top.value) : b.value;
      const userIsBest = !!user && complete && user.value >= ref - tieTol(ref);
      const mixGain = bestPure ? Math.max(0, b.value - bestPure.value) : 0;
      bestView = {
        ...b, fromUser, userIsBest, top,
        deltaUser: user && complete ? Math.max(0, b.value - user.value) : null,
        deltaUserMonthly: user && complete ? b.stats.avgMonthly - user.stats.avgMonthly : null,
        mixGain, isMix: mixGain > TIE_EUR,
      };
    }
  }
  return {
    p, sig, budget, keys: [...keys], split, allocated, gap, complete, restTarget: restTarget(keys),
    user, pure, bestPure, best: bestView, separate, interaction, refundSpent, canRank,
  };
}

// ---------- Robustheit ----------

export interface RobustRow {
  id: ScenarioId; label: string; p: Params;
  /** Deine Aufteilung in diesem Szenario (null, wenn nichts verteilt ist). */
  user: ComboStats | null;
  /** Beste Aufteilung in diesem Szenario. */
  best: { split: Split; stats: ComboStats; value: number };
  /** Bestes Einzelprodukt (reine Strategie) in diesem Szenario. */
  bestPure: PureStrategy | null;
  /** Die beste Aufteilung der Ausgangslage, in diesem Szenario gerechnet. */
  baseInScenario: { split: Split; stats: ComboStats; value: number } | null;
  /** In diesem Szenario ist eine andere Aufteilung um mehr als tieTol besser als die beste der Ausgangslage. */
  flip: boolean;
}

/** Szenarien der Robustheitstabelle: wie im Einzelvergleich, ohne „Steuererstattung ausgegeben“ (konstruktionsbedingt unfair). */
// Nur der Rechtsstand wird weitergereicht; die Zeilen selbst bleiben (wie bisher) die mit allen Korrekturen.
export function robustScenarios(p: Params, opts?: EngineOptions) {
  return scenarioList(p, null, { law: lawOf(opts) }).filter(s => s.id !== 'refund');
}

/**
 * Robustheitszeilen, je Aufruf von next() genau eine (für Leerlauf-Slots). baseBest = beste Aufteilung der
 * Ausgangslage; fehlt sie, wird sie beim ersten Aufruf zusätzlich gesucht.
 */
export function* robustRows(p: Params, setup: ComboSetup, baseBest?: Split | null, opts?: EngineOptions): Generator<RobustRow, void, undefined> {
  const { budget, keys } = setup;
  if (keys.length < 1 || !(budget > 0)) return;
  const split = emptySplit();
  for (const k of keys) split[k] = setup.split[k];
  const base = baseBest ?? bestSplit(p, budget, keys, opts)?.split ?? null;
  for (const s of robustScenarios(p, opts)) {
    const b = bestSplit(s.p, budget, keys, opts)!;
    const pure = pureStrategies(s.p, budget, keys, opts);
    const bestPure = pure.reduce<PureStrategy | null>((a, x) => (!a || better(x, a) ? x : a), null);
    const user = splitSum(split) > 0 ? evaluate(s.p, split, opts).stats : null;
    const baseIn = base ? evaluate(s.p, base, opts) : null;
    const same = !!base && SPLIT_KEYS.every(k => Math.abs(base[k] - b.split[k]) < SPLIT_EPS);
    const flip = !!baseIn && !same && b.value > baseIn.value + tieTol(b.value);
    yield {
      id: s.id, label: s.label, p: s.p, user,
      best: { split: b.split, stats: b.stats, value: b.value }, bestPure,
      baseInScenario: baseIn ? { split: baseIn.split, stats: baseIn.stats, value: baseIn.value } : null, flip,
    };
  }
}

export type RobustLevel = 'robust' | 'mixed' | 'fragile';
export interface RobustSummary { total: number; flips: RobustRow[]; held: number; level: RobustLevel }

/** Stufen wie im Einzelvergleich (U5): keine Abweichung, weniger als ein Drittel, ab einem Drittel. */
export function robustLevel(flips: number, total: number): RobustLevel {
  return flips === 0 ? 'robust' : flips * 3 < total ? 'mixed' : 'fragile';
}

export function robustSummary(rows: readonly RobustRow[]): RobustSummary {
  const flips = rows.filter(r => r.flip);
  return { total: rows.length, flips, held: rows.length - flips.length, level: robustLevel(flips.length, rows.length) };
}
