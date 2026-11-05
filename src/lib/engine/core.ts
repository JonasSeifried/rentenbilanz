// Gemeinsame Grundlagen beider Engines: Steuertarif, Konstanten, Eingaben (Params). Die Rechnung selbst steht in
// combo.ts (eine Engine für Einzelprodukte und Kombi); engine.ts ist nur noch die Referenz des Originals (Golden-Test).

import type { Inputs } from './inputs';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// --- Steuer (Tarif 2026, Grundtarif) ---
function tariff(x: number): number {
  let t: number;
  if (x <= 12348) t = 0;
  else if (x <= 17799) { const y = (x - 12348) / 1e4; t = (914.51 * y + 1400) * y; }
  else if (x <= 69878) { const z = (x - 17799) / 1e4; t = (173.10 * z + 2397) * z + 1034.87; }
  else if (x <= 277825) t = 0.42 * x - 11135.63;
  else t = 0.45 * x - 19470.38;
  return Math.max(0, t);
}
/** Referenz des Originals: Einkommen abgerundet, Steuerbetrag noch ungerundet. */
export function est(x: number): number { return tariff(Math.floor(Math.max(0, x))); }
export function soli(t: number): number { const fg = 20350; return t <= fg ? 0 : Math.min(0.055 * t, 0.119 * (t - fg)); }
export function tax(x: number): number { const t = est(x); return t + soli(t); }
/** Indexierter Tarif; Einkommen und ESt im nominalen Steuerjahr auf volle Euro abgerundet (§ 32a). */
export function tax2026(incomeNom: number, index = 1): number {
  const income = Math.floor(Math.max(0, incomeNom));
  const t = Math.floor(tariff(income / index) * index);
  return t + soli(t / index) * index;
}
export const ERTRAG: Record<number, number> = { 60: 22, 61: 22, 62: 21, 63: 20, 64: 19, 65: 18, 66: 18, 67: 17, 68: 16, 69: 15, 70: 15 };
export const KV_BBG = 69750; // Beitragsbemessungsgrenze KV/PV 2026, €/Jahr
/** AVD: geförderte Eigenbeiträge höchstens 1.800 €/Jahr; Eigenbeiträge insgesamt höchstens 6.840 €/Jahr (AVRG). */
export const AVD_SUB_MAX = 1800, AVD_MAX = 6840;
/**
 * Umschichtung vor Rentenbeginn (Schalter `shift`, alle Produkte) mit den Anteilen des Standarddepots (§ 1 Abs. 1c Nr. 5
 * AltZertG ab 01.01.2027): fünf Jahre vor der Auszahlungsphase höchstens 50 %, zwei Jahre vorher und zu Beginn höchstens
 * 30 % im chancenreichen Fonds (Risikoklasse 3–5), der Rest im sicheren (Risikoklasse 1–2). Gerechnet wird mit diesen
 * Höchstanteilen, gestuft zu Jahresbeginn.
 */
export const AVD_STD_GLIDE: readonly { yearsBefore: number; risky: number }[] = Object.freeze([{ yearsBefore: 2, risky: 0.3 }, { yearsBefore: 5, risky: 0.5 }]);

/** Anteil im chancenreichen Fonds zu Beginn von Ansparjahr t < n (1 ohne Umschichtung oder vor dem Zeitfenster). */
export function riskyShare(p: Params, t: number, n: number): number {
  if (!p.shift || t >= n) return 1;
  const before = n - t;
  const step = AVD_STD_GLIDE.find(s => before <= s.yearsBefore);
  return step ? step.risky : 1;
}

/**
 * Jahresrendite vor Kosten in einem Vertrag, der steuerfrei umschichtet (AVD, Versicherung), im Jahr t (Rentenbeginn
 * bei t = n). Ohne Umschichtung exakt p.g bzw. p.gPay (bitgleich zum Original). Mit Umschichtung in den letzten fünf
 * Ansparjahren die Mischung aus p.g und p.safeRate. In der Auszahlphase gilt wie bei allen Produkten p.gPay.
 */
export function contractGrowth(p: Params, t: number, n: number): number {
  if (t >= n) return p.gPay;
  const w = riskyShare(p, t, n);
  return w === 1 ? p.g : w * p.g + (1 - w) * p.safeRate;
}

export type ProductKey = 'etf' | 'avd' | 'ins' | 'fond';

export interface Params {
  a0: number; studyEnd: number; incStudy: number; eligStudy: boolean;
  incWork: number; incRet: number; R: number; H: number;
  /**
   * Gehaltsentwicklung (neu, nicht im Original): zu versteuerndes Zielgehalt in heutigem Geld, erreicht mit Alter incPeakAge.
   * −1 = aus (Gehalt bleibt incWork). Verlauf: incomeAt().
   */
  incPeak: number; incPeakAge: number;
  kvOn: boolean; kvRate: number;
  /** −1: wie incRet (auch in Szenarien, die incRet ändern); sonst eigene KV-Bruttobasis. */
  kvGrossRet: number; payResidual: boolean; fundingDelay: boolean; indexAllowance: boolean;
  /** -1: Kosten der Ansparphase weiterverwenden, sonst separater Satz. */
  avdPayCost: number; etfPayTer: number; fondPayTer: number;
  g: number; gPay: number; infl: number; dyn: number; basis: number;
  etfM: number; etfTer: number;
  avdM: number; avdCost: number; kids: number; kidsFrom: number; kidsYears: number;
  /** Umschichtung vor Rentenbeginn in allen Produkten (Anteile wie Standarddepot); safeRate = Rendite der sicheren Anlage. Neu, nicht im Original. */
  shift: boolean; safeRate: number;
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

/** Sonstige KV-Bruttoeinnahmen im Alter (heutiges Geld): −1 folgt incRet. */
export const kvGross = (p: Params) => p.kvGrossRet < 0 ? p.incRet : p.kvGrossRet;

export function readParams(inp: Inputs): Params {
  const num = (id: keyof Inputs) => numOf(inp[id]);
  const chk = (id: keyof Inputs) => inp[id] === true;
  const pct = (id: keyof Inputs, lo: number, hi: number) => clamp(num(id), lo, hi) / 100;
  // incPeak fehlt (z. B. Eingaben des Originals) ⇒ −1, Gehaltsentwicklung aus; incPeakAge fehlt ⇒ 45 wie DEFAULTS.
  const p: Params = {
    a0: clamp(Math.round(num('a0')), 16, 60), studyEnd: Math.round(num('studyEnd')), incStudy: Math.max(0, num('incStudy')), eligStudy: chk('eligStudy'),
    incWork: Math.max(0, num('incWork')), incPeak: inp.incPeak == null || num('incPeak') < 0 ? -1 : num('incPeak'), incPeakAge: inp.incPeakAge == null ? 45 : clamp(Math.round(num('incPeakAge')), 16, 100), incRet: Math.max(0, num('incRet')), R: clamp(Math.round(num('R')), 65, 70), H: Math.round(num('H')),
    kvGrossRet: num('kvGrossRet') < 0 ? -1 : num('kvGrossRet'), payResidual: chk('payResidual'), fundingDelay: chk('fundingDelay'), indexAllowance: chk('indexAllowance'),
    avdPayCost: num('avdPayCost') < 0 ? -1 : pct('avdPayCost', 0, 10),
    etfPayTer: num('etfPayTer') < 0 ? -1 : pct('etfPayTer', 0, 10),
    fondPayTer: num('fondPayTer') < 0 ? -1 : pct('fondPayTer', 0, 10),
    kvOn: chk('kvOn'), kvRate: pct('kvRate', 0, 40),
    g: pct('g', -50, 30), gPay: pct('gPay', -50, 30), infl: pct('infl', -5, 20), dyn: pct('dyn', -10, 20), basis: pct('basis', 0, 10),
    etfM: Math.max(0, num('etfM')), etfTer: pct('etfTer', 0, 10),
    avdM: Math.max(0, num('avdM')), avdCost: pct('avdCost', 0, 10), kids: clamp(Math.round(num('kids')), 0, 10), kidsFrom: num('kidsFrom'), kidsYears: Math.max(0, num('kidsYears')),
    shift: chk('shift'), safeRate: pct('safeRate', -5, 20),
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

/**
 * Zu versteuerndes Einkommen vor Rentenbeginn im Alter `age` (heutiges Geld).
 * Ausbildung: incStudy. Danach incWork; mit Gehaltsentwicklung (incPeak ≥ 0) ab Berufsbeginn (studyEnd, nach readParams
 * mindestens a0) mit konstantem realem Wachstum bis incPeakAge auf incPeak, danach konstant. Liegt incPeakAge nicht nach
 * dem Berufsbeginn, gilt incPeak sofort. Ist ein Endpunkt 0, wird linear statt geometrisch übergeleitet.
 * Ohne Gehaltsentwicklung exakt der Ausdruck des Originals (Golden-Test).
 */
export function incomeAt(p: Params, age: number): number {
  if (age < p.studyEnd) return p.incStudy;
  if (!(p.incPeak >= 0)) return p.incWork;
  const s = p.studyEnd, e = p.incPeakAge;
  if (e <= s || age >= e) return p.incPeak;
  const f = (age - s) / (e - s);
  return p.incWork > 0 && p.incPeak > 0 ? p.incWork * Math.pow(p.incPeak / p.incWork, f) : p.incWork + (p.incPeak - p.incWork) * f;
}

/**
 * Form der Gehaltsentwicklung für Texte: 'off' (aus), 'noWork' (an, aber Ausbildung bis zur Rente: kein Gehalt wirkt), 'now' (Zielalter nicht nach Berufsbeginn: Zielgehalt sofort,
 * incWork wirkt nicht), 'late' (Zielalter erst ab Rentenbeginn: wird nicht erreicht), sonst 'path'.
 */
export function incomePathKind(p: Params): 'off' | 'noWork' | 'now' | 'late' | 'path' {
  if (!(p.incPeak >= 0)) return 'off';
  if (p.studyEnd >= p.R) return 'noWork';
  if (p.incPeakAge <= p.studyEnd) return 'now';
  return p.incPeakAge >= p.R ? 'late' : 'path';
}

/** Beginn des Verlaufs in Worten: „ab Berufsbeginn (Alter 25)“ nach einer Ausbildung, sonst „ab heute (Alter 40)“. */
export function incomeStartText(p: Params): string {
  return (p.studyEnd > p.a0 ? 'ab Berufsbeginn' : 'ab heute') + ' (Alter ' + p.studyEnd + ')';
}

/** Vorschlag beim Einschalten und im Szenario: +30 % real, auf 100 € gerundet, erreicht nach mindestens 10 Jahren, frühestens mit 45. */
export function suggestedPath(p: Params): { incPeak: number; incPeakAge: number } {
  return { incPeak: Math.round(p.incWork * 1.3 / 100) * 100, incPeakAge: Math.max(45, p.studyEnd + 10) };
}

/** Reales Wachstum des Gehalts in % p. a. bis zum Zielalter (null ohne Gehaltsentwicklung oder ohne Übergang). */
export function incomeGrowth(p: Params): number | null {
  if (!(p.incPeak >= 0) || p.incPeakAge <= p.studyEnd || !(p.incWork > 0) || !(p.incPeak > 0)) return null;
  return Math.pow(p.incPeak / p.incWork, 1 / (p.incPeakAge - p.studyEnd)) - 1;
}

export interface HeirValue {
  val: number; note: string;
  /** Nur gemeinsamer Erbwert der Kombi: Einkommensteuer der Erben im Todesjahr, Kapitalsteuer der Depots nach Günstigerprüfung, kleinster Depotgewinn. */
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
