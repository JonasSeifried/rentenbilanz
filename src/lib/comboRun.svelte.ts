// Kombi-Modus: verbindet die Engine mit der Oberfläche (docs/kombi-modus.md, „Einbindung“).
// - Deine Aufteilung und die reinen Strategien: synchron in $derived.
// - Beste Aufteilung: 120 ms entprellt; bis dahin zeigt die Oberfläche die vorige.
// - Robustheit: eine Zeile je Leerlauf-Slot, Generationszähler verwirft veraltete Läufe.
import { readParams, type Params } from './engine/engine';
import type { Inputs } from './engine/inputs';
import { readCombo } from './engine/combo';
import { bestSplit, comboSig, type BestSplitResult } from './engine/search';
import { analyzeCombo, robustRows, robustSummary, type BestView, type RobustRow } from './engine/comboAnalyze';
import { comboVerdict } from './comboVerdict';

type Idle = (fn: () => void) => void;
const idle: Idle = fn => {
  const w = globalThis as unknown as { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => void };
  if (w.requestIdleCallback) w.requestIdleCallback(fn, { timeout: 300 });
  else setTimeout(fn, 0);
};

export function createComboRun(getInputs: () => Inputs) {
  const p = $derived<Params>(readParams(getInputs()));
  const enabled = $derived(getInputs().combo);
  const setup = $derived(readCombo(getInputs(), p));
  let best = $state<BestSplitResult | null>(null);
  let rows = $state<RobustRow[]>([]);
  let robustDone = $state(false);
  let lastView = $state<BestView | null>(null);

  const C = $derived(enabled ? analyzeCombo(p, setup, best) : null);
  const summary = $derived(robustDone && rows.length ? robustSummary(rows) : null);
  const V = $derived(C ? comboVerdict(C, summary) : null);

  // Beste Aufteilung entprellt
  $effect(() => {
    if (!enabled) { best = null; return; }
    const budget = setup.budget, keys = setup.keys, pp = p;
    if (keys.length < 2 || !(budget > 0)) { best = null; return; }
    if (best && best.sig === comboSig(pp, budget, keys)) return;
    const t = setTimeout(() => { best = bestSplit(pp, budget, keys); }, 120);
    return () => clearTimeout(t);
  });

  // Letzte fertige beste Aufteilung merken (für „wird berechnet …“)
  $effect(() => {
    const b = C?.best;
    if (b && b !== 'pending') lastView = b;
    else if (!b) lastView = null;
  });

  // Robustheit in Leerlauf-Slots
  let gen = 0;
  $effect(() => {
    const my = ++gen;
    rows = []; robustDone = false;
    const c = C;
    if (!c || !c.canRank || !c.complete || !best || c.best === 'pending') return;
    const it = robustRows(c.p, setup, best.split);
    const acc: RobustRow[] = [];
    const step = () => {
      if (my !== gen) return;
      const n = it.next();
      if (n.done) { rows = acc.slice(); robustDone = true; return; }
      acc.push(n.value);
      idle(step);
    };
    idle(step);
  });

  return {
    get p() { return p; },
    get C() { return C; },
    get V() { return V; },
    get lastView() { return lastView; },
    get robustDone() { return robustDone; },
    get robust() { return summary; },
  };
}
export type ComboRun = ReturnType<typeof createComboRun>;
