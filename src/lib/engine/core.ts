// Gemeinsame Grundlagen beider Engines: Steuertarif, Konstanten, Eingaben (Params). Die Rechnung selbst steht in
// combo.ts (eine Engine für Einzelprodukte und Kombi); engine.ts ist nur noch die Referenz des Originals (Golden-Test).

import type { Inputs } from './inputs';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// --- Steuer (Tarif 2026, Grundtarif) ---
export function est(x: number): number {
  x = Math.floor(Math.max(0, x));
  let t: number;
  if (x <= 12348) t = 0;
  else if (x <= 17799) { const y = (x - 12348) / 1e4; t = (914.51 * y + 1400) * y; }
  else if (x <= 69878) { const z = (x - 17799) / 1e4; t = (173.10 * z + 2397) * z + 1034.87; }
  else if (x <= 277825) t = 0.42 * x - 11135.63;
  else t = 0.45 * x - 19470.38;
  return Math.max(0, t);
}
export function soli(t: number): number { const fg = 20350; return t <= fg ? 0 : Math.min(0.055 * t, 0.119 * (t - fg)); }
export function tax(x: number): number { const t = est(x); return t + soli(t); }
export const ERTRAG: Record<number, number> = { 60: 22, 61: 22, 62: 21, 63: 20, 64: 19, 65: 18, 66: 18, 67: 17, 68: 16, 69: 15, 70: 15 };
export const KV_BBG = 69750; // Beitragsbemessungsgrenze KV/PV 2026, €/Jahr
/** AVD: geförderte Eigenbeiträge höchstens 1.800 €/Jahr; Eigenbeiträge insgesamt höchstens 6.840 €/Jahr (AVRG). */
export const AVD_SUB_MAX = 1800, AVD_MAX = 6840;
/**
 * Standarddepot (§ 1 Abs. 1c Nr. 5 AltZertG ab 01.01.2027): fünf Jahre vor der Auszahlungsphase höchstens 50 %, zwei Jahre
 * vorher und zu Beginn höchstens 30 % im chancenreichen Fonds (Risikoklasse 3–5), der Rest im sicheren (Risikoklasse 1–2).
 * Gerechnet wird mit diesen Höchstanteilen, gestuft zu Jahresbeginn.
 */
export const AVD_STD_GLIDE: readonly { yearsBefore: number; risky: number }[] = Object.freeze([{ yearsBefore: 2, risky: 0.3 }, { yearsBefore: 5, risky: 0.5 }]);

/**
 * Jahresrendite des AVD vor Kosten im Jahr t (Rentenbeginn bei t = n). Ohne Standarddepot-Umschichtung exakt p.g bzw. p.gPay
 * (bitgleich zum Original). Mit Umschichtung in den letzten fünf Jahren der Ansparphase die Mischung aus p.g und p.avdSafe.
 * In der Auszahlphase gilt wie bei allen Produkten p.gPay (die Aufteilung dort regelt das Gesetz nicht).
 */
export function avdGrowth(p: Params, t: number, n: number): number {
  if (t >= n) return p.gPay;
  if (!p.avdStd) return p.g;
  const before = n - t;
  const step = AVD_STD_GLIDE.find(s => before <= s.yearsBefore);
  return step ? step.risky * p.g + (1 - step.risky) * p.avdSafe : p.g;
}

export type ProductKey = 'etf' | 'avd' | 'ins' | 'fond';

export interface Params {
  a0: number; studyEnd: number; incStudy: number; eligStudy: boolean;
  incWork: number; incRet: number; R: number; H: number;
  kvOn: boolean; kvRate: number;
  g: number; gPay: number; infl: number; dyn: number; basis: number;
  etfM: number; etfTer: number;
  avdM: number; avdCost: number; kids: number; kidsFrom: number; kidsYears: number;
  /** Standarddepot mit gesetzlicher Umschichtung vor Rentenbeginn; avdSafe = Rendite des sicheren Fonds. Neu, nicht im Original. */
  avdStd: boolean; avdSafe: number;
  bonus: boolean; reinvest: boolean; einmal: boolean;
  insM: number; insEff: number; rf: number; gz: number; insLump: boolean;
  fondM: number; fondAA: number; fondTer: number;
  deathAge: number; heirHalf: boolean;
  /** Zu versteuerndes Einkommen der Erben (heutiges Geld). Nur mit Fix heirTax wirksam. */
  incHeir: number;
  real: boolean;
  on: Record<ProductKey, boolean>;
}

/** Wie `num(id)` im Original: Komma als Dezimaltrenner erlaubt, Unlesbares → 0. */
export function numOf(v: unknown): number { const x = parseFloat(String(v).replace(',', '.')); return isFinite(x) ? x : 0; }

export function readParams(inp: Inputs): Params {
  const num = (id: keyof Inputs) => numOf(inp[id]);
  const chk = (id: keyof Inputs) => inp[id] === true;
  const pct = (id: keyof Inputs, lo: number, hi: number) => clamp(num(id), lo, hi) / 100;
  const p: Params = {
    a0: clamp(Math.round(num('a0')), 16, 60), studyEnd: Math.round(num('studyEnd')), incStudy: Math.max(0, num('incStudy')), eligStudy: chk('eligStudy'),
    incWork: Math.max(0, num('incWork')), incRet: Math.max(0, num('incRet')), R: clamp(Math.round(num('R')), 65, 70), H: Math.round(num('H')),
    kvOn: chk('kvOn'), kvRate: pct('kvRate', 0, 40),
    g: pct('g', -50, 30), gPay: pct('gPay', -50, 30), infl: pct('infl', -5, 20), dyn: pct('dyn', -10, 20), basis: pct('basis', 0, 10),
    etfM: Math.max(0, num('etfM')), etfTer: pct('etfTer', 0, 10),
    avdM: Math.max(0, num('avdM')), avdCost: pct('avdCost', 0, 10), kids: clamp(Math.round(num('kids')), 0, 10), kidsFrom: num('kidsFrom'), kidsYears: Math.max(0, num('kidsYears')),
    avdStd: chk('avdStd'), avdSafe: pct('avdSafe', -5, 20),
    bonus: chk('bonus'), reinvest: chk('reinvest'), einmal: chk('einmal'),
    insM: Math.max(0, num('insM')), insEff: pct('insEff', 0, 10), rf: Math.max(0, num('rf')), gz: clamp(Math.round(num('gz')), 0, 40), insLump: chk('insLump'),
    fondM: Math.max(0, num('fondM')), fondAA: pct('fondAA', 0, 20), fondTer: pct('fondTer', 0, 10),
    deathAge: Math.round(num('deathAge')), heirHalf: chk('heirHalf'), incHeir: Math.max(0, num('incHeir')),
    real: chk('real'),
    on: { etf: chk('etfOn'), avd: chk('avdOn'), ins: chk('insOn'), fond: chk('fondOn') }
  };
  // Grenzen erzwingen: Ohne das bricht die Rechnung (leere Arrays, negative Laufzeiten).
  p.H = clamp(p.H, Math.max(85, p.R + 1), 100);
  p.studyEnd = clamp(p.studyEnd, p.a0, p.R);
  p.deathAge = clamp(p.deathAge, p.a0 + 1, 100);
  return p;
}

export interface HeirValue {
  val: number; note: string;
  /** Nur gemeinsamer Erbwert der Kombi: Einkommensteuer der Erben im Todesjahr, Abgeltungsteuer der Depots, kleinster Depotgewinn. */
  detail?: { incomeTax: number; abgTax: number; minDepotGain: number };
}

/** Ergebnis je Produkt. Nicht jedes Produkt hat jedes Feld (wie im Original). */
export interface ProductResult {
  vals: (number | null)[]; net: number[];
  own: number; ownReal: number; capR: number; capNet: number;
  cost: number; foerder: number; foerderReal: number; payEnd: number;
  heir: (idx: number) => HeirValue;
  // AVD
  heirMarried?: (idx: number) => HeirValue;
  sideOwn?: number; sideOwnReal?: number; capAVD?: number; sideR?: number;
  /** Ungeförderte Eigenbeiträge im AVD-Vertrag (Fix avdUnsubsidized, E10). */
  unsubOwn?: number; unsubOwnReal?: number;
  zul?: number; zulReal?: number; ref?: number; refReal?: number; noElig?: number; lumpNet?: number;
  // Versicherung
  kapNet?: number; annual?: number; lump?: boolean; lifelong?: boolean;
  // Fonds (aus runFund übernommen)
  [k: string]: unknown;
}
