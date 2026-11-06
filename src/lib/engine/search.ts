// Suche nach der rechnerisch besten Aufteilung eines Monatsbudgets (Kombi-Modus).
// Zielgröße: Summe netto von Rentenbeginn bis Auszahlplan-Ende in heutiger Kaufkraft (cumHReal, Fix rankReal, E1),
// unabhängig vom Anzeige-Schalter. Reine Funktionen auf serialisierbaren Eingaben (worker-fähig).
//
// Verfahren „AVD-Raster“ (docs/kombi-modus.md): Die AVD-Kurve hat zwei Buckel (Ende der 50-%-Grundzulage bei 30 €
// und Förderhöchstbetrag 150 €; mit Kindern ein Knick bei 25 €); mit Fix avdUnsubsidized (E10) folgt bis 570 € der
// ungeförderte Teil im Vertrag. Deshalb wird jeder AVD-Betrag des Rasters
// einzeln gerechnet und nur der Rest per Tauschsuche (50 €, dann 10 €) auf die anderen Produkte verteilt,
// warm gestartet vom Optimum des vorigen AVD-Betrags.

import type { Params, ProductKey } from './core';
import { fixesOf, lawOf, type EngineOptions } from './fixes';
import { CURRENT_LAW } from './law';
import { combo, comboStats, emptySplit, SPLIT_KEYS, type ComboStats, type Split } from './combo';

/** Unterschiede bis 1 € (Summe bis H, heutige Kaufkraft) gelten in der Suche als gleich. */
export const TIE_EUR = 1;
/**
 * Gleichwertig für die genannte Aufteilung: Unterschiede bis 0,1 % der Zielgröße (mindestens TIE_EUR). Das liegt weit unter der
 * Genauigkeit jeder Annahme (Rendite, Kosten, Steuersatz). Innerhalb dieser Spanne nennt der Rechner die einfachere,
 * flexiblere Aufteilung (weniger Produkte, mehr ETF), nicht die mit dem letzten Euro mehr.
 */
export const TIE_REL = 0.001;
export const tieTol = (value: number): number => Math.max(TIE_EUR, TIE_REL * Math.abs(value));
/** Rasterweite der Suche in €/Monat. */
export const STEP = 10;
/** Förderhöchstbetrag AVD in €/Monat (Rechtsstand 2026: 1.800 €/Jahr = 150 €). */
export const avdCap = (opts?: EngineOptions): number => lawOf(opts).avd.subMax / 12;
/** Förderhöchstbetrag des aktuellen Rechtsstands in €/Monat (Oberfläche). */
export const AVD_CAP = CURRENT_LAW.avd.subMax / 12;
/**
 * Bis zu diesem Monatsbetrag rechnet das AVD anders als ein ETF: mit Fix avdUnsubsidized (E10) bis zum Höchstbetrag
 * (2026: 6.840 €/Jahr = 570 €, ungefördert im Vertrag), ohne ihn bis zum Förderhöchstbetrag. Darüber liegt alles im ETF-Nebendepot.
 */
export function avdRasterMax(opts?: EngineOptions): number {
  return fixesOf(opts).has('avdUnsubsidized') ? lawOf(opts).avd.max / 12 : avdCap(opts);
}

export interface Cand { split: Split; stats: ComboStats; value: number }

/** Zielgröße: mit Fix rankReal (Standard) immer cumHReal, sonst cumH in der Anzeige-Einheit. */
export function objective(stats: ComboStats, opts?: EngineOptions): number {
  return fixesOf(opts).has('rankReal') ? stats.cumHReal : stats.cumH;
}

let evalCount = 0;
/** Anzahl der Auswertungen seit Programmstart (für Tests und Messungen). */
export const evaluations = () => evalCount;

export function evaluate(p: Params, split: Split, opts?: EngineOptions): Cand {
  evalCount++;
  const stats = comboStats(p, combo(p, split, opts));
  return { split, stats, value: objective(stats, opts) };
}

const nonzero = (s: Split) => SPLIT_KEYS.filter(k => s[k] > 0).length;
/** Nur die Gleichstandsregeln von `better` (ohne Zielgröße): a einfacher/flexibler als b? */
export function simpler(a: Cand, b: Cand): boolean {
  const na = nonzero(a.split), nb = nonzero(b.split);
  if (na !== nb) return na < nb;
  if (a.split.etf !== b.split.etf) return a.split.etf > b.split.etf;
  if (a.split.ins !== b.split.ins) return a.split.ins < b.split.ins;
  return a.value > b.value;
}

/**
 * a besser als b? Mehr Zielgröße; bei Gleichstand (≤ TIE_EUR): weniger Produkte, dann mehr ETF (jederzeit verfügbar,
 * nicht eingepreist), dann weniger Versicherung, dann der höhere Wert. Deterministisch.
 */
export function better(a: Cand, b: Cand): boolean {
  if (a.value > b.value + TIE_EUR) return true;
  if (b.value > a.value + TIE_EUR) return false;
  const na = nonzero(a.split), nb = nonzero(b.split);
  if (na !== nb) return na < nb;
  if (a.split.etf !== b.split.etf) return a.split.etf > b.split.etf;
  if (a.split.ins !== b.split.ins) return a.split.ins < b.split.ins;
  return a.value > b.value;
}

export interface Space {
  budget: number; step: number; keys: ProductKey[];
  /** Mögliche AVD-Beträge (aufsteigend); [0], wenn das AVD nicht gewählt ist. */
  avdValues: number[];
  /** Produkte außer dem AVD, auf die der Rest in Schritten von `step` verteilt wird. */
  others: ProductKey[];
  /** Nimmt den Rest auf, der kein Vielfaches von `step` ist: ETF, sonst das erste andere Produkt. */
  sink: ProductKey | null;
}

/**
 * Suchraum: Σ = Budget, nur gewählte Produkte, Schritt 10 €. AVD ∈ {0, 10, …, avdRasterMax} (570 € mit E10, sonst 150 €;
 * + 25 €, wenn Kinder angegeben sind, dort ist die Kinderzulage voll). Ist kein ETF gewählt, darf das AVD bis zum
 * ganzen Budget gehen.
 */
export function searchSpace(p: Params, budget: number, keys: readonly ProductKey[], opts?: EngineOptions, step = STEP): Space {
  const ks = SPLIT_KEYS.filter(k => keys.includes(k));
  const others = ks.filter(k => k !== 'avd');
  const sink = others.includes('etf') ? 'etf' : others[0] ?? null;
  const avdValues: number[] = [];
  if (ks.includes('avd')) {
    if (!others.length) avdValues.push(budget);
    else {
      const max = ks.includes('etf') ? Math.min(budget, avdRasterMax(opts)) : budget;
      for (let u = 0; u * step <= max + 1e-9; u++) avdValues.push(u * step);
      // Knick der Kinderzulage (2026: 300 €/Jahr = 25 €) und Förderhöchstbetrag (2026: 150 €, liegt auf dem Raster)
      const law = lawOf(opts), kidKnee = law.avd.kid / 12, cap = law.avd.subMax / 12;
      if (p.kids > 0 && kidKnee <= max && step === STEP && !avdValues.includes(kidKnee)) { avdValues.push(kidKnee); avdValues.sort((a, b) => a - b); }
      if (cap <= max && step === STEP && !avdValues.includes(cap)) { avdValues.push(cap); avdValues.sort((a, b) => a - b); }
    }
  } else avdValues.push(0);
  return { budget, step, keys: ks, avdValues, others, sink };
}

/** Rest nach dem AVD in ganze Schritte und einen Rest für `sink` zerlegen. */
function restOf(sp: Space, avd: number): { units: number; rem: number } | null {
  const rest = sp.budget - avd;
  if (rest < -1e-9) return null;
  const units = Math.floor(rest / sp.step + 1e-9);
  return { units, rem: Math.max(0, Math.round((rest - units * sp.step) * 100) / 100) };
}

function compose(sp: Space, avd: number, units: readonly number[], rem: number): Split {
  const s = emptySplit();
  if (sp.keys.includes('avd')) s.avd = avd;
  sp.others.forEach((k, i) => { s[k] = units[i] * sp.step; });
  if (sp.sink && rem > 0) s[sp.sink] = Math.round((s[sp.sink] + rem) * 100) / 100;
  return s;
}

/** Alle Gitterpunkte des Suchraums (für die erschöpfende Suche in Tests). */
export function* lattice(sp: Space): Generator<Split> {
  for (const a of sp.avdValues) {
    const r = restOf(sp, a); if (!r) continue;
    const m = sp.others.length;
    if (!m) { if (r.units === 0 && r.rem === 0) yield compose(sp, a, [], 0); continue; }
    const u = new Array<number>(m).fill(0);
    const rec = function* (i: number, left: number): Generator<Split> {
      if (i === m - 1) { u[i] = left; yield compose(sp, a, u, r.rem); return; }
      for (let x = 0; x <= left; x++) { u[i] = x; yield* rec(i + 1, left - x); }
    };
    yield* rec(0, r.units);
  }
}

export function exhaustive(p: Params, sp: Space, opts?: EngineOptions): { best: Cand; max: number; count: number } {
  let best: Cand | null = null, max = -Infinity, count = 0;
  for (const s of lattice(sp)) { const c = evaluate(p, s, opts); count++; if (c.value > max) max = c.value; if (!best || better(c, best)) best = c; }
  return { best: best!, max, count };
}

export interface PureStrategy { key: ProductKey; label: string; split: Split; stats: ComboStats; value: number }

/** Bezeichnung einer reinen Strategie (UX Teil D). */
export function pureLabel(key: ProductKey, budget: number, opts?: EngineOptions): string {
  const e = (x: number) => Math.round(x).toLocaleString('de-DE') + ' €';
  const AVD_CAP = avdCap(opts);
  switch (key) {
    case 'etf': return 'Alles ins ETF-Depot';
    case 'avd': {
      if (!(budget > AVD_CAP + 1e-9)) return 'Alles ins Altersvorsorgedepot';
      const max = avdRasterMax(opts);
      if (max <= AVD_CAP) return 'Alles ins Altersvorsorgedepot (' + e(AVD_CAP) + ' gefördert + ' + e(budget - AVD_CAP) + ' Nebendepot)';
      return 'Alles ins Altersvorsorgedepot (' + e(AVD_CAP) + ' gefördert + ' + e(Math.min(budget, max) - AVD_CAP) + ' ungefördert'
        + (budget > max + 1e-9 ? ' + ' + e(budget - max) + ' Nebendepot)' : ')');
    }
    case 'ins': return 'Alles in die Rentenversicherung';
    case 'fond': return 'Alles in den aktiven Fonds';
  }
}

/** Reine Strategien: das ganze Budget in ein Produkt (AVD: bis 150 € gefördert, Rest im Nebendepot wie im Einzelvergleich). */
export function pureStrategies(p: Params, budget: number, keys: readonly ProductKey[], opts?: EngineOptions): PureStrategy[] {
  return SPLIT_KEYS.filter(k => keys.includes(k)).map(k => {
    const c = evaluate(p, { ...emptySplit(), [k]: budget }, opts);
    return { key: k, label: pureLabel(k, budget, opts), ...c };
  });
}

export interface CurvePoint { avd: number; split: Split; value: number; avgMonthly: number }

export interface BestSplitResult {
  /** Signatur der Eingaben (comboSig); analyzeCombo nutzt das Ergebnis nur bei gleicher Signatur. */
  sig: string;
  budget: number; keys: ProductKey[];
  split: Split; stats: ComboStats; value: number;
  /** Bestes Ergebnis je AVD-Betrag (Rest bestmöglich verteilt), z. B. für ein Mini-Diagramm. */
  curve: CurvePoint[];
  /**
   * Rechnerisches Maximum, falls es nicht die genannte Aufteilung ist: Die genannte ist dann höchstens tieTol(top.value)
   * schlechter, aber einfacher bzw. flexibler (mehr ETF). Sonst null.
   */
  top: Cand | null;
  /** Anzahl Auswertungen der Kombi-Engine. */
  evals: number;
}

/** Signatur von Params, Budget, Produkten, Fixes und Rechtsstand (stabil, serialisierbar). */
export function comboSig(p: Params, budget: number, keys: readonly ProductKey[], opts?: EngineOptions): string {
  return JSON.stringify([p, budget, SPLIT_KEYS.filter(k => keys.includes(k)), [...fixesOf(opts)].sort(), lawOf(opts).id]);
}

/**
 * Rechnerisch beste Aufteilung („AVD-Raster“, warm gestartet). Reine strategien, die außerhalb des Rasters liegen
 * (AVD über 150 € bei gewähltem ETF), werden zusätzlich geprüft und nur übernommen, wenn sie mehr als TIE_EUR besser sind.
 * Bei weniger als einem Produkt oder Budget 0 gibt es kein Ergebnis (null).
 */
export function bestSplit(p: Params, budget: number, keys: readonly ProductKey[], opts?: EngineOptions): BestSplitResult | null {
  const sp = searchSpace(p, budget, keys, opts);
  if (!sp.keys.length || !(budget > 0)) return null;
  const before = evalCount;
  const cache = new Map<string, Cand>();
  const ev = (s: Split) => { const key = s.etf + '/' + s.avd + '/' + s.ins + '/' + s.fond; let c = cache.get(key); if (!c) { c = evaluate(p, s, opts); cache.set(key, c); } return c; };
  const m = sp.others.length;
  const climb = (a: number, start: number[], rem: number): { c: Cand; u: number[] } => {
    let u = start.slice(), cur = ev(compose(sp, a, u, rem));
    for (const d of [5, 1]) for (let it = 0; it < 1000; it++) {
      let next: Cand | null = null, nu: number[] | null = null;
      for (let i = 0; i < m; i++) for (let j = 0; j < m; j++) {
        if (i === j || u[i] < d) continue;
        const v = u.slice(); v[i] -= d; v[j] += d;
        const c = ev(compose(sp, a, v, rem));
        if (better(c, next ?? cur)) { next = c; nu = v; }
      }
      if (!next) break;
      cur = next; u = nu!;
    }
    return { c: cur, u };
  };
  let best: Cand | null = null, prev: number[] | null = null;
  const curve: CurvePoint[] = [], byAvd = new Map<number, Cand>();
  sp.avdValues.forEach((a, idx) => {
    const r = restOf(sp, a); if (!r) return;
    let local: { c: Cand; u: number[] } | null = null;
    if (!m) local = { c: ev(compose(sp, a, [], 0)), u: [] };
    else {
      const starts: number[][] = [];
      const edge = idx === 0 || idx === sp.avdValues.length - 1 || !prev;
      if (edge) for (let i = 0; i < m; i++) { const u = new Array<number>(m).fill(0); u[i] = r.units; starts.push(u); }
      if (prev) {
        // vorige Lösung übernehmen, die Differenz beim größten Posten ausgleichen
        const u = prev.slice(); let diff = r.units - u.reduce((x, y) => x + y, 0);
        while (diff !== 0) {
          const big = u.reduce((bi, x, k) => x > u[bi] ? k : bi, 0);
          if (diff > 0) { u[big] += diff; diff = 0; }
          else { const take = Math.min(u[big], -diff); if (take === 0) break; u[big] -= take; diff += take; }
        }
        if (diff === 0) starts.push(u);
      }
      for (const s0 of starts) { const c = climb(a, s0, r.rem); if (!local || better(c.c, local.c)) local = c; }
    }
    prev = local!.u;
    curve.push({ avd: a, split: local!.c.split, value: local!.c.value, avgMonthly: local!.c.stats.avgMonthly });
    byAvd.set(a, local!.c);
    if (!best || better(local!.c, best)) best = local!.c;
  });
  // Reine Strategien außerhalb des Rasters (AVD über avdRasterMax bei gewähltem ETF): nur bei echtem Vorteil
  const alts: Cand[] = [];
  const rasterMax = avdRasterMax(opts);
  for (const k of sp.keys) {
    const c = ev({ ...emptySplit(), [k]: budget });
    if (best && c.value > (best as Cand).value + TIE_EUR) best = c;
    // „Alles ins AVD“ über dem Raster ist nur AVD-Höchstbetrag + ETF-Nebendepot, keine einfachere Alternative.
    if (!(k === 'avd' && budget > rasterMax && sp.others.includes('etf'))) alts.push(c);
  }
  // Gleichwertig (≤ tieTol) und einfacher: reine Strategien und „150 € AVD (Förderhöchstbetrag), Rest bestmöglich“.
  // Bewusst keine beliebigen Rasterpunkte, sonst landete die Wahl irgendwo am Rand der Toleranz.
  const top = best!, tol = tieTol(top.value);
  const cap = avdCap(opts), atCap = byAvd.get(cap);
  if (atCap && top.split.avd > cap) alts.push(atCap);
  let b = top;
  for (const c of alts) if (c.value >= top.value - tol && simpler(c, b)) b = c;
  return { sig: comboSig(p, budget, sp.keys, opts), budget, keys: sp.keys, split: b.split, stats: b.stats, value: b.value, curve, top: b === top ? null : top, evals: evalCount - before };
}
