// Rechen-Engine: Port des Originals (legacy/index.html, geprüfter Stand, Commit 2ce0d56) plus dokumentierte
// Korrekturen (fixes.ts, docs/abweichungen-vom-original.md); mit NO_FIXES bitgleich zum Original (Golden-Test).
// Jede Korrektur hängt an genau einem Schalter (F.*), der Pfad ohne Schalter ist Zeichen für Zeichen das Original.
// Wichtig: Die Kombi-Engine spiegelt diese Rechnung (mit allen Korrekturen). Änderungen hier dort nachziehen.

import { eur } from '../format';
import { fixesOf, type EngineOptions } from './fixes';
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

export interface HeirValue { val: number; note: string }

export interface FundRun {
  vals: number[]; bases: number[]; owns: number[]; net: number[];
  sellNet: (idx: number) => number;
  own: number; ownReal: number; capR: number; capNet: number; tEnd: number;
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

export interface ModelResult {
  res: Partial<Record<ProductKey, ProductResult>>;
  T: number; n: number; tH: number;
  I: (t: number) => number;
}

// --- Engine ---
// Zeitachse: t = 0 … T-1 sind Jahre ab heute; vals[t] ist der Wert zu Beginn von Jahr t (= Alter a0 + t).
export function model(p: Params, opts?: EngineOptions): ModelResult {
  const fx = fixesOf(opts);
  const F = {
    bonus: fx.has('bonusOutsideSA'), // E3
    kvInv: fx.has('kvInvestBase'),   // E6
    kvShared: fx.has('kvSharedRoom'), // E7
    kvSpread: fx.has('kvLumpSpread'), // E8
    heir: fx.has('heirTax'),         // E2
    unsub: fx.has('avdUnsubsidized'), // E10
  };
  const T = 100 - p.a0, n = p.R - p.a0, tH = p.H - p.a0;
  const I = (t: number) => Math.pow(1 + p.infl, t);
  const incAt = (t: number) => (p.a0 + t < p.studyEnd ? p.incStudy : p.incWork);
  // Zusatzsteuer bzw. Ersparnis durch nominale Beträge auf ein Einkommen in heutigem Geld (Tarif wächst mit der Inflation).
  const taxAdd = (incReal: number, addNom: number, t: number) => addNom <= 0 ? 0 : (tax(incReal + addNom / I(t)) - tax(incReal)) * I(t);
  const taxSave = (incReal: number, dedNom: number, t: number) => (tax(incReal) - tax(Math.max(0, incReal - dedNom / I(t)))) * I(t);
  // KV/PV für freiwillig Versicherte: voller Satz auf Zusatzeinnahmen bis zur Beitragsbemessungsgrenze.
  const kvRoom = (t: number) => Math.max(0, (KV_BBG - p.incRet) * I(t));
  const kvAdd = (addNom: number, t: number) => p.kvOn && addNom > 0 ? p.kvRate * Math.min(addNom, kvRoom(t)) : 0;
  const kvLump = (addNom: number, t: number) => p.kvOn && addNom > 0 ? p.kvRate * Math.min(addNom, 10 * kvRoom(t)) : 0; // auf 120 Monate verteilt
  // Fix kvSharedRoom (E7): KV-Jahresbuch je Produkt. Alle laufenden beitragspflichtigen Beträge (nominal) eines Jahres
  // werden gesammelt und erst dann gemeinsam bis zur Beitragsbemessungsgrenze verbeitragt.
  const kvBook = () => new Array<number>(T).fill(0);
  const applyKv = (net: number[], book: number[]) => { for (let t = 0; t < T; t++) if (book[t] > 0) net[t] -= kvAdd(book[t], t); };
  const dynF = (t: number) => Math.pow(1 + p.dyn, t);
  const Rn = (x: number, t: number) => p.real ? x / I(t) : x; // für Beträge in Hinweistexten (gleiche Basis wie die Anzeige)
  const annuityDue = (V: number, rr: number, rem: number) => rem <= 1 ? V : (Math.abs(rr) < 1e-9 ? V / rem : V * rr / ((1 + rr) * (1 - Math.pow(1 + rr, -rem))));

  // Investmentfonds (ETF / aktiver Fonds / Nebendepot / Kapitalauszahlung der Versicherung)
  // kvSink (nur mit Fix kvSharedRoom): Die KV-Basis wird dort eingetragen statt hier abgezogen.
  function runFund(monthly: number[], lumpEnd: number[] | null, ter: number, aa: number, payEndAge: number, kvSink?: number[]): FundRun {
    const tEnd = payEndAge - p.a0;
    let V = 0, B = 0, own = 0, ownReal = 0;
    const vals = [0], bases = [0], owns = [0], net = new Array<number>(T).fill(0);
    for (let t = 0; t < T; t++) {
      const accum = t < n;
      const rm = Math.pow(1 + (accum ? p.g : p.gPay) - ter, 1 / 12) - 1;
      let spb = 1000, payY = 0, dedY = 0, kvBase = 0;
      if (!accum && t < tEnd && V > 0) {
        const W = annuityDue(V, p.gPay - ter, tEnd - t);
        const gain = Math.max(0, W * (V - B) / V);
        const tb = Math.max(0, gain * 0.7 - spb); spb = Math.max(0, spb - gain * 0.7);
        // Fix kvInvestBase (E6): beitragspflichtig sind 70 % des Gewinnanteils (Teilfreistellung § 20 InvStG), siehe unten auch die Vorabpauschale.
        if (F.kvInv || kvSink) { dedY = tb * 0.26375; kvBase = F.kvInv ? 0.7 * gain : gain; }
        else dedY = tb * 0.26375 + kvAdd(gain, t);
        B -= W * B / V; V -= W; payY = W;
      }
      const Vs = V; let cY = 0, newSh = 0;
      for (let m = 1; m <= 12; m++) {
        if (accum && monthly[t] > 0) { const c = monthly[t], inv = c * (1 - aa); V += inv; B += c; own += c; ownReal += c / I(t); cY += inv; newSh += inv * (13 - m) / 12; }
        V *= 1 + rm;
      }
      if (V > 0 && p.basis > 0) {
        const vp = Math.min((Vs + newSh) * p.basis * 0.7, Math.max(0, V - Vs - cY));
        const tx = Math.max(0, vp * 0.7 - spb) * 0.26375;
        if (tx > 0) { B *= (V - tx) / V; V -= tx; }
        B += vp;
        if (F.kvInv && !accum && t < tEnd) kvBase += 0.7 * vp; // Vorabpauschale in der Rentenphase (§ 16 Abs. 1 Nr. 2 InvStG)
      }
      if (kvBase > 0) { if (kvSink) kvSink[t] += kvBase; else dedY += kvAdd(kvBase, t); }
      // Einmalbeträge (Steuererstattung, Kapitalauszahlung) erhöhen die Anschaffungskosten, sind aber kein eigenes Geld.
      if (accum && lumpEnd && lumpEnd[t] > 0) { V += lumpEnd[t]; B += lumpEnd[t]; }
      net[t] = payY - dedY;
      vals.push(V); bases.push(B); owns.push(own);
    }
    const sellNet = (idx: number) => { const V = vals[idx], B = bases[idx]; return V - Math.max(0, (V - B) * 0.7 - 1000) * 0.26375; };
    return { vals, bases, owns, net, sellNet, own: owns[n], ownReal, capR: vals[n], capNet: sellNet(n), tEnd };
  }

  const res: ModelResult['res'] = {};
  const monthlyArr = (m: number) => Array.from({ length: T }, (_, t) => t < n ? m * dynF(t) : 0);
  const fundNote = 'Nach Steuer bei Verkauf. Behalten die Erben, übernehmen sie den Gewinn steuerlich.';

  // ETF
  if (p.on.etf) {
    const book = F.kvShared ? kvBook() : undefined;
    const r = runFund(monthlyArr(p.etfM), null, p.etfTer, 0, p.H, book) as unknown as ProductResult & FundRun;
    if (book) applyKv(r.net, book);
    const r0 = runFund(monthlyArr(p.etfM), null, 0, 0, p.H);
    r.cost = r0.capR - r.capR; r.foerder = 0; r.foerderReal = 0; r.payEnd = p.H;
    r.heir = idx => ({ val: r.sellNet(idx), note: fundNote });
    res.etf = r;
  }
  // Aktiver Fonds
  if (p.on.fond) {
    const book = F.kvShared ? kvBook() : undefined;
    const r = runFund(monthlyArr(p.fondM), null, p.fondTer, p.fondAA, p.H, book) as unknown as ProductResult & FundRun;
    if (book) applyKv(r.net, book);
    const r0 = runFund(monthlyArr(p.fondM), null, 0, 0, p.H);
    r.cost = r0.capR - r.capR; r.foerder = 0; r.foerderReal = 0; r.payEnd = p.H;
    r.heir = idx => ({ val: r.sellNet(idx), note: fundNote });
    res.fond = r;
  }

  // Altersvorsorgedepot
  if (p.on.avd) {
    const payEnd = p.H, tEnd = payEnd - p.a0; // H ≥ 85 ist durch readParams garantiert
    const run = (cost: number, book?: number[]) => {
      let V = 0, own = 0, ownReal = 0, zul = 0, zulReal = 0, ref = 0, refReal = 0, bonusUsed = false, C0 = 0, noElig = 0, lumpNet = 0;
      const vals = [0], owns = [0], zuls = [0], foer = [0], net = new Array<number>(T).fill(0), refunds = new Array<number>(T).fill(0);
      const overflow = new Array<number>(T).fill(0); // Monatsbeitrag, der nicht ins AVD passt → ETF-Nebendepot
      // Fix avdUnsubsidized (E10): ungeförderte Eigenbeiträge im Vertrag (Vu, Anschaffungskosten Bu). Ohne den Fix bleiben
      // beide 0, jeder Zusatzterm ist dann + 0 und der Pfad bitgleich zum Original.
      let Vu = 0, Bu = 0, ownU = 0, ownUReal = 0;
      const valsU = [0], basesU = [0];
      for (let t = 0; t < T; t++) {
        const age = p.a0 + t, accum = t < n;
        if (t === n) C0 = V;
        let payY = 0, dedY = 0, cashU = 0;
        if (!accum && t < tEnd && (V > 0 || Vu > 0)) {
          let L = 0; if (t === n && p.einmal) { L = 0.3 * V; V -= L; }
          // Auszahlplan nach § 1 Abs. 1 Nr. 4b AltZertG: Restkapital ÷ Restlaufzeit, jährlich neu; im letzten Jahr der Rest.
          const W = V / (tEnd - t);
          V -= W; payY = W + L;
          // E10: Ungeförderter Teil, gleicher Auszahlplan und gleiche 30-%-Quote. Steuerpflichtig ist nur der Gewinnanteil
          // (Leistung − anteilige Beiträge, § 22 Nr. 5 S. 2 Buchst. c EStG), zur Hälfte, wenn der Vertrag 12 Jahre lief
          // (§ 20 Abs. 1 Nr. 6 S. 2 EStG; die Leistung nach dem 62. Lebensjahr ist mit Rentenbeginn ≥ 65 immer erfüllt).
          let Lu = 0, Wu = 0, xL = 0, xW = 0;
          if (Vu > 0) {
            const q = Math.max(0, Vu - Bu) / Vu * (t >= 12 ? 0.5 : 1);
            if (t === n && p.einmal) { Lu = 0.3 * Vu; Bu -= Lu * Bu / Vu; Vu -= Lu; xL = Lu * q; }
            Wu = Vu / (tEnd - t); Bu -= Wu * Bu / Vu; Vu -= Wu; xW = Wu * q;
            cashU = Wu + Lu;
          }
          const taxY = taxAdd(p.incRet, payY + (xW + xL), t), kvL = kvLump(L + Lu, t);
          if (L + Lu > 0) lumpNet = (L + Lu) - (taxY - taxAdd(p.incRet, W + xW, t)) - kvL;
          // Die 30-%-Auszahlung bleibt immer im eigenen Topf kvLump (Rechtslage offen, Befund E9).
          if (book) { dedY = taxY + kvL; book[t] += W + Wu; }
          else dedY = taxY + kvAdd(W + Wu, t) + kvL;
        }
        const elig = accum && (age >= p.studyEnd || p.eligStudy);
        const want = accum ? p.avdM * 12 * dynF(t) : 0;
        if (accum && !elig && want > 0) noElig++;
        const E = elig ? Math.min(want, AVD_SUB_MAX) : 0;
        // E10: Was über den Förderhöchstbetrag geht, bleibt bis zum Höchstbetrag ungefördert im Vertrag. Jahre ohne
        // Förderberechtigung bleiben wie im Original im Nebendepot (ob dann ungefördert eingezahlt werden darf, ist offen).
        const U = F.unsub && elig ? Math.min(want, AVD_MAX) - E : 0;
        overflow[t] = (want - E - U) / 12;
        const rm = Math.pow(1 + avdGrowth(p, t, n) - cost, 1 / 12) - 1;
        for (let m = 1; m <= 12; m++) {
          if (E > 0) { V += E / 12; own += E / 12; }
          if (U > 0) { Vu += U / 12; Bu += U / 12; ownU += U / 12; }
          V *= 1 + rm; Vu *= 1 + rm;
        }
        ownReal += E / I(t); ownUReal += U / I(t);
        if (elig && E >= 120) {
          const grund = 0.5 * Math.min(E, 360) + 0.25 * Math.max(0, Math.min(E, 1800) - 360);
          const kidActive = age >= p.kidsFrom && age < p.kidsFrom + p.kidsYears;
          const kind = kidActive ? p.kids * 300 * Math.min(1, E / 300) : 0;
          let bon = 0; if (p.bonus && !bonusUsed && age < 25) { bon = 200; bonusUsed = true; }
          const z = grund + kind + bon; // gutgeschrieben wird die volle Zulage inkl. Bonus
          // Günstigerprüfung: Original rechnet den Bonus mit. Fix bonusOutsideSA (E3): Die Erhöhung nach § 84 S. 2 EStG
          // bleibt außer Betracht (§ 2 Abs. 6 S. 2 Hs. 2 EStG), weder im Abzug noch bei der Gegenrechnung.
          const zSA = F.bonus ? grund + kind : z;
          V += z; zul += z; zulReal += z / I(t);
          const save = taxSave(incAt(t), E + zSA, t);
          const extra = Math.max(0, save - zSA);
          refunds[t] = extra; ref += extra; refReal += extra / I(t);
        }
        net[t] = (payY + cashU) - dedY;
        vals.push(V); owns.push(own); zuls.push(zul); foer.push(zul + ref); valsU.push(Vu); basesU.push(Bu);
      }
      return { vals, owns, zuls, foer, net, refunds, overflow, own, ownReal, zul, zulReal, ref, refReal, lumpNet, C0: C0 || vals[n], noElig, valsU, basesU, ownU, ownUReal };
    };
    const book = F.kvShared ? kvBook() : undefined; // ein Buch für Auszahlplan und Nebendepot
    const a = run(p.avdCost, book), a0 = run(0);
    // ETF-Nebendepot: nicht förderfähige Beiträge (+ optional die zusätzliche Steuererstattung)
    const side = runFund(a.overflow, p.reinvest ? a.refunds : null, p.etfTer, 0, payEnd, book);
    const side0 = runFund(a.overflow, p.reinvest ? a.refunds : null, 0, 0, payEnd);
    // Spätere Einkommensteuer auf den steuerpflichtigen Betrag X, wenn er über den restlichen Auszahlplan entnommen wird (grob).
    const latentTax = (X: number, t: number) => { const yrs = Math.max(1, tEnd - Math.max(t, n)); return yrs * taxAdd(p.incRet, X / yrs, t); };
    // E10: steuerpflichtiger Gewinn des ungeförderten Teils zum Zeitpunkt idx (hälftig ab 12 Jahren Laufzeit bei der Auszahlung).
    const gainU = (idx: number, half: boolean) => Math.max(0, a.valsU[idx] - a.basesU[idx]) * (half ? 0.5 : 1);
    const r: ProductResult = {
      vals: a.vals.map((v, i) => (v + a.valsU[i]) + side.vals[i]),
      net: a.net.map((v, i) => v + side.net[i]), // KV aus dem gemeinsamen Buch (Fix kvSharedRoom) wird unten abgezogen
      own: (a.own + a.ownU) + side.own, ownReal: (a.ownReal + a.ownUReal) + side.ownReal, sideOwn: side.own, sideOwnReal: side.ownReal,
      ...(F.unsub ? { unsubOwn: a.ownU, unsubOwnReal: a.ownUReal } : {}),
      capR: (a.vals[n] + a.valsU[n]) + side.vals[n], capAVD: a.vals[n] + a.valsU[n], sideR: side.vals[n],
      capNet: (a.vals[n] + a.valsU[n]) - latentTax(a.vals[n] + gainU(n, n >= 12), n) + side.sellNet(n),
      zul: a.zul, zulReal: a.zulReal, ref: a.ref, refReal: a.refReal,
      foerder: a.zul + a.ref, foerderReal: a.zulReal + a.refReal,
      cost: ((a0.vals[n] + a0.valsU[n]) + side0.vals[n]) - ((a.vals[n] + a.valsU[n]) + side.vals[n]), payEnd, noElig: a.noElig, lumpNet: a.lumpNet,
      heir: () => ({ val: 0, note: '' }),
    };
    if (book) applyKv(r.net, book);
    // E10: Der ungeförderte Teil ist nicht schädlich verwendbar (§ 93 betrifft nur gefördertes Vermögen). Er geht an die
    // Erben, die den Gewinn als Leistung nach § 22 Nr. 5 S. 2 Buchst. c EStG mit ihrem Steuersatz versteuern.
    const unsubNote = (idx: number, tx: number) => a.valsU[idx] > 0 ? '; ungeförderter Teil ' + eur(Rn(a.valsU[idx], idx)) + ' ohne Förderrückzahlung, Steuer der Erben auf dessen Gewinn ca. ' + eur(Rn(tx, idx)) : '';
    r.heirMarried = idx => {
      const V = a.vals[idx], lt = latentTax(V, idx);
      const halbU = p.heirHalf && idx >= 12, txU = taxAdd(p.incHeir, gainU(idx, halbU), idx);
      return { val: V - lt + (a.valsU[idx] - txU) + side.sellNet(idx), note: 'Ohne Abzug auf einen eigenen AVD-Vertrag übertragbar, später aber voll steuerpflichtig (ca. ' + eur(Rn(lt, idx)) + ' Einkommensteuer, grob geschätzt und abgezogen)' + unsubNote(idx, txU) };
    };
    r.heir = idx => {
      const V = a.vals[idx], age = p.a0 + idx;
      let back: number, ownR: number, zulR: number;
      if (idx <= n) { back = a.foer[idx]; ownR = a.owns[idx]; zulR = a.zuls[idx]; }
      else { const f = a.C0 > 0 ? V / a.C0 : 0; back = a.foer[n] * f; ownR = a.owns[n] * f; zulR = a.zuls[n] * f; }
      // Steuerpflichtige Erträge = Guthaben − eigene Beiträge − Zulagen. Die Steuererstattungen lagen nie im Vertrag.
      // Original: Steuer mit dem Einkommen und Alter der verstorbenen Person. Fix heirTax (E2): Die Erben versteuern
      // (BMF 05.10.2023 Rn. 229 f.); hälftig nur, wenn der Erbe mindestens 62 ist (heirHalf) und der Vertrag ≥ 12 Jahre lief (Rn. 148).
      const halb = F.heir ? p.heirHalf && idx >= 12 : p.heirHalf && age >= 62 && idx >= 12;
      const rest = Math.max(0, V - back), gain = Math.max(0, V - ownR - zulR) * (halb ? 0.5 : 1);
      const incDeath = F.heir ? p.incHeir : idx < n ? incAt(idx) : p.incRet;
      // E10: gemeinsam mit dem Gewinn des ungeförderten Teils versteuert (ein Tarif)
      const tx = taxAdd(incDeath, gain + gainU(idx, halb), idx);
      return { val: (rest + a.valsU[idx]) - tx + side.sellNet(idx), note: 'Förderung ' + eur(Rn(back, idx)) + ' zurück, ' + (F.heir ? 'Steuer der Erben auf Erträge ' : 'Steuer auf Erträge ') + eur(Rn(tx, idx)) + (halb ? ' (hälftig)' : '') + (a.valsU[idx] > 0 ? '; darin der ungeförderte Teil ' + eur(Rn(a.valsU[idx], idx)) + ' ohne Förderrückzahlung' : '') };
    };
    res.avd = r;
  }

  // Fondsgebundene Rentenversicherung
  if (p.on.ins) {
    const run = (eff: number) => {
      let V = 0, own = 0, ownReal = 0; const vals: (number | null)[] = [0];
      for (let t = 0; t < T; t++) {
        if (t < n) { const c = p.insM * dynF(t), rm = Math.pow(1 + p.g - eff, 1 / 12) - 1; for (let m = 0; m < 12; m++) { V += c; own += c; V *= 1 + rm; } ownReal += 12 * c / I(t); vals.push(V); }
        else vals.push(null);
      }
      return { vals, own, ownReal, C: vals[n] as number };
    };
    const a = run(p.insEff), a0 = run(0);
    const annual = a.C / 10000 * p.rf * 12, ea = ERTRAG[p.R] / 100;
    const annualNet = (t: number) => annual - taxAdd(p.incRet, annual * ea, t);
    // Kapitalauszahlung: 15 % des Gewinns steuerfrei; nach 12 Jahren und ab 62 davon die Hälfte mit persönlichem Satz, sonst Abgeltungsteuer.
    const gain = Math.max(0, a.C - a.own), halb = n >= 12;
    const kapTax = halb ? taxAdd(p.incRet, gain * 0.85 * 0.5, n) : gain * 0.85 * 0.26375;
    // Original: KV auf die Kapitalauszahlung (120 Monate) sofort abgezogen. Fix kvLumpSpread (E8): C/10 in den Jahren n … n+9
    // beitragspflichtig (§ 5 Abs. 4 Beitragsverfahrensgrundsätze Selbstzahler), gezahlt aus den Entnahmen des Folge-ETF.
    const kapNet = F.kvSpread ? a.C - kapTax : a.C - kapTax - kvLump(a.C, n);
    const r = { own: a.own, ownReal: a.ownReal, capR: a.C, capNet: a.C - kapTax, kapNet, foerder: 0, foerderReal: 0, cost: a0.C - a.C, annual, lump: p.insLump } as ProductResult;
    if (p.insLump) {
      const lumpArr = new Array<number>(T).fill(0); lumpArr[n - 1] = kapNet; // landet genau bei Rentenbeginn im ETF
      const book = F.kvShared ? kvBook() : undefined;
      const f = runFund(new Array<number>(T).fill(0), lumpArr, p.etfTer, 0, p.H, book);
      if (F.kvSpread) for (let j = 0; j < 10 && n + j < T; j++) { if (book) book[n + j] += a.C / 10; else f.net[n + j] -= kvAdd(a.C / 10, n + j); }
      if (book) applyKv(f.net, book);
      Object.assign(r, { vals: a.vals.map((v, i) => i <= n ? v : f.vals[i]), net: f.net, payEnd: p.H, lifelong: false });
      r.heir = idx => idx <= n ? { val: a.vals[idx] as number, note: 'Fondsguthaben, einkommensteuerfrei (nur Erbschaftsteuer)' }
                               : { val: f.sellNet(idx), note: 'ETF aus der Kapitalauszahlung. ' + fundNote };
    } else {
      const net = new Array<number>(T).fill(0);
      if (F.kvShared) { const book = kvBook(); for (let t = n; t < T; t++) { net[t] = annualNet(t); book[t] += annual; } applyKv(net, book); }
      else for (let t = n; t < T; t++) net[t] = annualNet(t) - kvAdd(annual, t);
      Object.assign(r, { vals: a.vals, net, payEnd: 100, lifelong: true });
      r.heir = idx => {
        if (idx <= n) return { val: a.vals[idx] as number, note: 'Fondsguthaben, einkommensteuerfrei (nur Erbschaftsteuer)' };
        const rest = Math.max(0, p.R + p.gz - (p.a0 + idx));
        // Restrenten einzeln versteuern; im Kaufkraft-Modus jede Zahlung mit ihrem eigenen Jahr umrechnen (Anzeige teilt später durch I(idx)).
        // Fix heirTax (E2): Die Erben versteuern den Ertragsanteil mit ihrem eigenen Einkommen.
        const heirNet = (t: number) => F.heir ? annual - taxAdd(p.incHeir, annual * ea, t) : annualNet(t);
        let v = 0; for (let k = 0; k < rest; k++) v += heirNet(idx + k) * (p.real ? I(idx) / I(idx + k) : 1);
        return { val: v, note: rest > 0 ? 'Restliche Garantiezeit: ' + rest + ' Jahre, nach Steuer' + (F.heir ? ' der Erben' : '') : 'Garantiezeit abgelaufen – nichts' };
      };
    }
    res.ins = r;
  }
  return { res, T, n, tH, I };
}
