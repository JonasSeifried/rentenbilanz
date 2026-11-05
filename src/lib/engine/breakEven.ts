// Kosten-Gleichstand („ab welchen Kosten kippt der Abstand“): Für AVD, Versicherung und aktiven Fonds die Kosten, bei
// denen die Summe netto bis zum Ende des Auszahlplans (heutige Kaufkraft, cumHReal) genau der des ETF-Depots
// entspricht. Keine eigene Rechnung: Jede Auswertung ist dieselbe Einzelrechnung wie im Vergleich (`single()` aus
// analyze.ts, also combo.ts mit einem Teil), nur mit geändertem Kostensatz. Alle anderen Eingaben bleiben gleich,
// auch die ETF-Kosten. Gesucht wird per Bisektion zwischen 0 % und MAX_COST.
import { single, type Analysis } from './analyze';
import type { Params, ProductKey } from './core';
import type { EngineOptions } from './fixes';

/** Obere Grenze der Suche (Kosten p. a.). Über 3 % liegt kein realistisches Produkt dieser Art. */
export const MAX_COST = 0.03;
/** Suchgenauigkeit (Kosten p. a.): 0,005 Prozentpunkte, angezeigt wird auf 0,01 Prozentpunkte. */
export const COST_TOL = 0.00005;

export type CostKey = 'avd' | 'ins' | 'fond';
type CostParam = 'avdCost' | 'insEff' | 'fondTer';
export const COST_PARAM: Readonly<Record<CostKey, CostParam>> = Object.freeze({ avd: 'avdCost', ins: 'insEff', fond: 'fondTer' });

export interface BreakEven {
  key: CostKey;
  /** Name der Kosteneingabe in Params. */
  param: CostParam;
  /** Angenommener Kostensatz (Anteil p. a.). */
  assumed: number;
  /**
   * cross: Gleichstand bei `at`. above: Das Produkt zahlt im ganzen Bereich 0 … cap mehr aus als das ETF-Depot.
   * below: Es zahlt auch mit 0 % Kosten weniger aus.
   */
  kind: 'cross' | 'above' | 'below';
  /** Kostensatz beim Gleichstand (Anteil p. a.), nur bei `cross`. */
  at: number | null;
  /** Abstand Produkt − ETF-Depot bei den angenommenen Kosten (Summe bis H, heutige Kaufkraft). */
  gap: number;
  /** Wirkt der Kostensatz auch in der Auszahlphase (AVD und Fonds ohne eigene Auszahlkosten)? */
  payToo: boolean;
  /** Obergrenze des Suchbereichs (MAX_COST oder höher angenommene Kosten). */
  cap: number;
  /** Anzahl Engine-Auswertungen (für Tests und Messungen). */
  evals: number;
}

function sumHReal(p: Params, k: ProductKey, opts?: EngineOptions): number {
  const r = single(p, k, opts), n = p.R - p.a0, tH = p.H - p.a0;
  let s = 0;
  for (let t = n; t < tH; t++) s += r.net[t] / Math.pow(1 + p.infl, t);
  return s;
}

/** Gleichstand eines Produkts mit dem ETF-Depot; null, wenn der Vergleich nicht fair ist oder ein Teil fehlt. */
export function costBreakEven(A: Analysis, key: CostKey, opts?: EngineOptions): BreakEven | null {
  const { p, stats } = A;
  if (!A.canRank || !stats.etf || !stats[key]) return null;
  const param = COST_PARAM[key], assumed = p[param];
  const ref = stats.etf.cumHReal;
  let evals = 0;
  const f = (c: number) => { evals++; return sumHReal({ ...p, [param]: c }, key, opts) - ref; };
  const gap = stats[key]!.cumHReal - ref; // = f(assumed), schon im Vergleich gerechnet
  const payToo = key === 'avd' ? p.avdPayCost < 0 : key === 'fond' ? p.fondPayTer < 0 : false;
  // Mehr Kosten ⇒ weniger Auszahlung. Klammer von den angenommenen Kosten aus wählen (spart eine Auswertung).
  // Suchbereich 0 … max(MAX_COST, angenommen); `cap` nennt die Oberfläche bei „kein Gleichstand“.
  const cap = Math.max(MAX_COST, assumed);
  const base = { key, param, assumed, gap, payToo, cap };
  let lo: number, hi: number, flo: number;
  if (gap === 0) return { ...base, kind: 'cross', at: assumed, evals };
  if (gap > 0) {
    if (assumed >= cap) return { ...base, kind: 'above', at: null, evals };
    if (f(cap) > 0) return { ...base, kind: 'above', at: null, evals };
    lo = assumed; hi = cap; flo = gap;
  } else {
    if (assumed <= 0) return { ...base, kind: 'below', at: null, evals };
    const f0 = f(0);
    if (f0 < 0) return { ...base, kind: 'below', at: null, evals };
    lo = 0; hi = assumed; flo = f0;
  }
  while (hi - lo > COST_TOL) {
    const m = (lo + hi) / 2, fm = f(m);
    if (fm === 0) { lo = hi = m; break; }
    if ((fm > 0) === (flo > 0)) { lo = m; flo = fm; } else hi = m;
  }
  return { ...base, kind: 'cross', at: (lo + hi) / 2, evals };
}

/** Gleichstände für alle Produkte mit Kostenannahme, die mit dem ETF-Depot im Vergleich stehen, in Produktreihenfolge. */
export function costBreakEvens(A: Analysis, opts?: EngineOptions): BreakEven[] {
  return (['avd', 'ins', 'fond'] as const).map(k => costBreakEven(A, k, opts)).filter((b): b is BreakEven => !!b);
}
