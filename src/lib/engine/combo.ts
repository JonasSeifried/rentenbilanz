// Kombi-Engine „Budget aufteilen“: mehrere Produkte gemeinsam gerechnet, Jahr für Jahr mit
//  - einer Einkommensteuer im Alter auf die SUMME der steuerpflichtigen Zahlungen (AVD-Auszahlplan und 30-%-Auszahlung,
//    Ertragsanteil der Leibrente, hälftig steuerpflichtige Kapitalauszahlung der Versicherung),
//  - einem Sparer-Pauschbetrag (1.000 €/Jahr) über alle Fondsdepots (ETF, aktiver Fonds, AVD-Nebendepot,
//    ETF aus der Kapitalauszahlung): erst die Entnahmegewinne, dann die Vorabpauschale mit dem Rest,
//  - einem KV/PV-Jahresbuch bis zur Beitragsbemessungsgrenze über ALLE Produkte (Fix kvSharedRoom, E7).
// Gemeinsame Abzüge werden anteilig nach Bemessungsgrundlage auf die Produkte verteilt (Konvention, docs/kombi-modus.md).
//
// Eine Engine: Die App rechnet auch jedes Einzelprodukt hier (Kombi mit einem Teil, single() in analyze.ts).
// Spiegel der Einzelrechnung: Jede Formel ist aus engine.ts übernommen (Stand mit den Korrekturen aus fixes.ts),
// in derselben Reihenfolge der Gleitkomma-Operationen. Mit nur einem Produkt fällt jede Aufteilung auf den
// ursprünglichen Ausdruck zurück (x·(c/c) = x, max(0, x − f·(x/x)) = max(0, x − f)), deshalb gilt
// combo(p, {k: Betrag}) === model(p).res[k] bitgenau (tests/combo.test.ts, I1) – für jede Teilmenge der Fixes.
// engine.ts ist nur noch Referenz des Originals. Neue Rechnung nur hier, abschaltbar; abgeschaltet bitgleich (I1).
//
// Die Option `fixes` gibt es nur, damit I1 auch den Originalpfad prüfen kann. Die App ruft immer ohne Optionen,
// also mit ALL_FIXES. Ohne kvSharedRoom wird (wie im Original) jeder KV-Strom einzeln bis zur BBG begrenzt.

import { eur } from '../format';
import { tax, avdGrowth, AVD_MAX, AVD_SUB_MAX, ERTRAG, KV_BBG, numOf, type HeirValue, type Params, type ProductKey, type ProductResult } from './core';
import { fixesOf, type EngineOptions } from './fixes';
import type { Inputs } from './inputs';

/** Monatsbeitrag je Produkt in € (heutiges Geld, wächst mit der Dynamik wie im Einzelvergleich). */
export type Split = Record<ProductKey, number>;
/** Feste Reihenfolge aller Produkte (wie PRODUCTS in analyze.ts). */
export const SPLIT_KEYS: readonly ProductKey[] = Object.freeze(['etf', 'avd', 'ins', 'fond'] as ProductKey[]);
export const emptySplit = (): Split => ({ etf: 0, avd: 0, ins: 0, fond: 0 });
export const splitSum = (s: Split): number => s.etf + s.avd + s.ins + s.fond;

/** Ergebnis je Teil der Aufteilung. Felder wie ProductResult (core.ts). */
export interface ComboPart extends ProductResult {
  key: ProductKey;
  vals: (number | null)[]; net: number[];
  own: number; ownReal: number; capR: number; capNet: number; cost: number;
  foerder: number; foerderReal: number; payEnd: number; lumpNet: number;
  /** Anteil an den gemeinsamen Abzügen je Jahr (nominal): Einkommensteuer im Alter, Abgeltungsteuer, KV/PV. */
  incTax: number[]; abgTax: number[]; kv: number[];
  /** Einkommensteuerpflichtiger Betrag je Jahr (nominal), Grundlage der gemeinsamen Steuer (Fonds: 0). */
  taxBase: number[];
  /** Erbwert bei Tod zu Beginn von Jahr idx (nominal), dieser Teil für sich versteuert (wie model()). */
  heir: (idx: number) => HeirValue;
  // AVD
  /** Erbwert, wenn der Ehepartner erbt (AVD auf eigenen Vertrag übertragen). */
  heirMarried?: (idx: number) => HeirValue;
  capAVD?: number; sideR?: number; sideOwn?: number; sideOwnReal?: number; unsubOwn?: number; unsubOwnReal?: number;
  zul?: number; zulReal?: number; ref?: number; refReal?: number; noElig?: number;
  // Versicherung
  kapNet?: number; annual?: number; lump?: boolean; lifelong?: boolean;
}

export interface ComboResult {
  parts: Partial<Record<ProductKey, ComboPart>>;
  /** Netto je Jahr (nominal), Summe der Teile. */
  net: number[];
  own: number; ownReal: number; capR: number;
  /** Kapital nach Steuern bei Rentenbeginn; die Fonds (ETF, aktiver Fonds, Nebendepot) mit einem Pauschbetrag verkauft. */
  capNet: number;
  cost: number; foerder: number; foerderReal: number;
  /** Netto der AVD-30-%-Auszahlung (Grenzsteuer über allen anderen Einkünften des Jahres). */
  lumpNet: number;
  /** Gemeinsame Abzüge je Jahr (nominal). abgTax enthält auch die Abgeltungsteuer einer Kapitalauszahlung vor 12 Jahren. */
  incTax: number[]; abgTax: number[]; kv: number[];
  /** Die BBG hat in mindestens einem Jahr mehrere Produkte gemeinsam gedeckelt (nur mit kvSharedRoom). */
  kvClipped: boolean;
  T: number; n: number; tH: number;
  I: (t: number) => number;
}

export interface ComboOptions extends EngineOptions {
  /** Zweiter Lauf ohne Kosten für `cost` (wie r0/a0/side0 in model()). Die Suche braucht das nicht. */
  cost?: boolean;
  /** Diese Teile auch mit 0 € rechnen (Einzelprodukt mit Beitrag 0, wie model()). Standard: alle Teile mit Betrag > 0. */
  parts?: readonly ProductKey[];
}

/** Wie Stats in analyze.ts. cumHReal ist die Zielgröße der Suche und des Rankings (Fix rankReal, E1). */
export interface ComboStats { avgMonthly: number; cumH: number; cumHReal: number; cum100: number; lump: number }

export interface ComboSetup {
  /** Monatsbudget gesamt (€) = gemeinsamer Monatsbeitrag je Produkt (setAll), damit der Vergleich fair ist. */
  budget: number;
  /** Aufteilung, nur aktive Produkte (Chips) > 0 möglich. */
  split: Split;
  /** Aktive Produkte in fester Reihenfolge. */
  keys: ProductKey[];
}

/** Eingabefeld der Kombi-Aufteilung je Produkt. */
export const INPUT_OF: Readonly<Record<ProductKey, 'cEtf' | 'cAvd' | 'cIns' | 'cFond'>> = Object.freeze({ etf: 'cEtf', avd: 'cAvd', ins: 'cIns', fond: 'cFond' });

/** Liest Budget und Aufteilung aus den Eingaben (nicht aus Params: der Golden-Test vergleicht Params mit dem Original). */
export function readCombo(inp: Inputs, p: Params): ComboSetup {
  const keys = SPLIT_KEYS.filter(k => p.on[k]);
  const split = emptySplit();
  for (const k of keys) split[k] = Math.max(0, numOf(inp[INPUT_OF[k]]));
  return { budget: Math.max(0, numOf(inp.setAll)), split, keys };
}

/** Gespeicherte Aufteilung aller vier Produkte (unabhängig von den Chips); negatives/Unlesbares → 0. */
export function storedSplit(inp: Inputs): Split {
  const s = emptySplit();
  for (const k of SPLIT_KEYS) { const v = numOf(inp[INPUT_OF[k]]); s[k] = isFinite(v) && v > 0 ? v : 0; }
  return s;
}

/**
 * Aufteilung proportional auf ein neues Budget bringen, auf ganze Euro gerundet; der Rundungsrest geht an den
 * größten Teil (bei Gleichstand an den ersten in Produktreihenfolge). Leere Aufteilung oder Budget ≤ 0 → leer.
 */
export function scaleSplit(s: Split, budget: number): Split {
  const out = emptySplit(), sum = splitSum(s);
  if (!(sum > 0) || !(budget > 0)) return out;
  if (Math.abs(sum - budget) < 0.005) return { ...s };
  let big: ProductKey = 'etf';
  for (const k of SPLIT_KEYS) { out[k] = Math.round(s[k] * budget / sum); if (s[k] > s[big]) big = k; }
  out[big] = Math.round((out[big] + budget - splitSum(out)) * 100) / 100;
  return out;
}

/**
 * Die Kombi, die im Vergleich mitläuft: nur, wenn sie eingeschaltet ist und mindestens zwei Produkte enthält.
 * Sie wird immer auf den gemeinsamen Monatsbeitrag (setAll) gebracht, damit gleich viel eigenes Geld hineinfließt.
 */
export function readKombi(inp: Inputs): Split | null {
  if (inp.combo !== true) return null;
  const s = scaleSplit(storedSplit(inp), Math.max(0, numOf(inp.setAll)));
  return SPLIT_KEYS.filter(k => s[k] > 0).length >= 2 ? s : null;
}

/**
 * Anteilige Aufteilung eines gemeinsamen Freibetrags.
 * Σx ≤ f: alle frei, Rest f − Σx. Sonst taxed_i = x_i − f·(x_i/Σx), Rest 0.
 * Bei nur einem Beteiligten exakt max(0, x − f) bzw. max(0, f − x) wie in runFund.
 */
export function shareAllowance(xs: readonly number[], allowance: number): { taxed: number[]; left: number } {
  let S = 0; for (const x of xs) S += x;
  if (S <= allowance) return { taxed: xs.map(x => Math.max(0, x - allowance)), left: allowance - S };
  return { taxed: xs.map(x => x - allowance * (x / S)), left: 0 };
}

interface Fund {
  part: ProductKey; // etf, fond, avd (Nebendepot), ins (ETF aus der Kapitalauszahlung)
  monthly: number[]; lumpEnd: number[] | null; ter: number; aa: number; tEnd: number;
  V: number; B: number; own: number; ownReal: number;
  vals: number[]; bases: number[]; net: number[]; abg: number[]; kvInline: number[];
  pay: boolean; W: number; gain: number; rm: number; vp: number; payY: number; dedY: number; kvBase: number;
}

export function combo(p: Params, split: Split, opts: ComboOptions = {}): ComboResult {
  const main = run(p, split, opts, false);
  if (opts.cost) {
    const z = run(p, split, opts, true);
    for (const k of SPLIT_KEYS) if (main.parts[k]) main.parts[k]!.cost = z.parts[k]!.capR - main.parts[k]!.capR;
    main.cost = z.capR - main.capR;
  }
  return main;
}

function run(p: Params, split: Split, opts: ComboOptions, zeroCost: boolean): ComboResult {
  const fx = fixesOf(opts);
  const F = {
    bonus: fx.has('bonusOutsideSA'),  // E3
    kvInv: fx.has('kvInvestBase'),    // E6
    kvShared: fx.has('kvSharedRoom'), // E7
    kvSpread: fx.has('kvLumpSpread'), // E8
    unsub: fx.has('avdUnsubsidized'), // E10
    heir: fx.has('heirTax'),          // E2
  };
  const T = 100 - p.a0, n = p.R - p.a0, tH = p.H - p.a0;
  const I = (t: number) => Math.pow(1 + p.infl, t);
  const Rn = (x: number, t: number) => p.real ? x / I(t) : x; // für Beträge in Hinweistexten (gleiche Basis wie die Anzeige)
  const incAt = (t: number) => (p.a0 + t < p.studyEnd ? p.incStudy : p.incWork);
  const taxAdd = (incReal: number, addNom: number, t: number) => addNom <= 0 ? 0 : (tax(incReal + addNom / I(t)) - tax(incReal)) * I(t);
  const taxSave = (incReal: number, dedNom: number, t: number) => (tax(incReal) - tax(Math.max(0, incReal - dedNom / I(t)))) * I(t);
  const kvRoom = (t: number) => Math.max(0, (KV_BBG - p.incRet) * I(t));
  const kvAdd = (addNom: number, t: number) => p.kvOn && addNom > 0 ? p.kvRate * Math.min(addNom, kvRoom(t)) : 0;
  const kvLump = (addNom: number, t: number) => p.kvOn && addNom > 0 ? p.kvRate * Math.min(addNom, 10 * kvRoom(t)) : 0;
  const dynF = (t: number) => Math.pow(1 + p.dyn, t);
  const annuityDue = (V: number, rr: number, rem: number) => rem <= 1 ? V : (Math.abs(rr) < 1e-9 ? V / rem : V * rr / ((1 + rr) * (1 - Math.pow(1 + rr, -rem))));
  const zero = () => new Array<number>(T).fill(0);
  const monthlyArr = (m: number) => Array.from({ length: T }, (_, t) => t < n ? m * dynF(t) : 0);
  const tEnd = p.H - p.a0; // Auszahlplan-Ende aller Fonds und des AVD
  const forced = opts.parts;
  const on = (k: ProductKey) => forced ? forced.includes(k) : split[k] > 0;
  const etfTer = zeroCost ? 0 : p.etfTer;
  // KV-Jahresbuch je Teil (nur mit kvSharedRoom): beitragspflichtige Beträge in derselben Reihenfolge wie in model().
  const claims: Partial<Record<ProductKey, number[]>> = {};
  if (F.kvShared) for (const k of SPLIT_KEYS) if (on(k)) claims[k] = zero();

  // ---------- 1) AVD-Vertrag: run() aus model() ohne Steuer und KV (die kommen aus dem gemeinsamen Buch) ----------
  // payY: gefördert ausgezahlt (W + L); xW/xL: steuerpflichtiger Gewinnanteil des ungeförderten Teils (E10);
  // tb = payY + (xW + xL) einkommensteuerpflichtig; cash = payY + (Wu + Lu) ausgezahlt; kvW = W + Wu laufend beitragspflichtig.
  let avd: null | {
    vals: number[]; W: number[]; L: number[]; payY: number[]; paying: boolean[]; refunds: number[]; overflow: number[];
    xW: number[]; Lu: number[]; tb: number[]; cash: number[]; kvW: number[];
    valsU: number[]; basesU: number[]; ownU: number; ownUReal: number;
    owns: number[]; zuls: number[]; foer: number[]; // für den Erbfall (wie in model())
    own: number; ownReal: number; zul: number; zulReal: number; ref: number; refReal: number; noElig: number;
  } = null;
  if (on('avd')) {
    const cost = zeroCost ? 0 : p.avdCost, avdM = split.avd;
    let V = 0, own = 0, ownReal = 0, zul = 0, zulReal = 0, ref = 0, refReal = 0, bonusUsed = false, noElig = 0;
    let Vu = 0, Bu = 0, ownU = 0, ownUReal = 0;
    const vals = [0], W = zero(), L = zero(), payY = zero(), paying = new Array<boolean>(T).fill(false), refunds = zero(), overflow = zero();
    const xW = zero(), Lu = zero(), tb = zero(), cash = zero(), kvW = zero(), valsU = [0], basesU = [0], owns = [0], zuls = [0], foer = [0];
    for (let t = 0; t < T; t++) {
      const age = p.a0 + t, accum = t < n;
      if (!accum && t < tEnd && (V > 0 || Vu > 0)) {
        let Lx = 0; if (t === n && p.einmal) { Lx = 0.3 * V; V -= Lx; }
        const w = V / (tEnd - t);
        V -= w; W[t] = w; L[t] = Lx; payY[t] = w + Lx; paying[t] = true;
        let lu = 0, wu = 0, xl = 0, xw = 0;
        if (Vu > 0) {
          const q = Math.max(0, Vu - Bu) / Vu * (t >= 12 ? 0.5 : 1);
          if (t === n && p.einmal) { lu = 0.3 * Vu; Bu -= lu * Bu / Vu; Vu -= lu; xl = lu * q; }
          wu = Vu / (tEnd - t); Bu -= wu * Bu / Vu; Vu -= wu; xw = wu * q;
        }
        xW[t] = xw; Lu[t] = lu; tb[t] = payY[t] + (xw + xl); cash[t] = payY[t] + (wu + lu); kvW[t] = w + wu;
        if (claims.avd) claims.avd[t] += w + wu;
      }
      const elig = accum && (age >= p.studyEnd || p.eligStudy);
      const want = accum ? avdM * 12 * dynF(t) : 0;
      if (accum && !elig && want > 0) noElig++;
      const E = elig ? Math.min(want, AVD_SUB_MAX) : 0;
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
        const z = grund + kind + bon;
        const zSA = F.bonus ? grund + kind : z; // Günstigerprüfung ohne Bonus (E3); hängt nur am AVD-Teil
        V += z; zul += z; zulReal += z / I(t);
        const save = taxSave(incAt(t), E + zSA, t);
        const extra = Math.max(0, save - zSA);
        refunds[t] = extra; ref += extra; refReal += extra / I(t);
      }
      vals.push(V); valsU.push(Vu); basesU.push(Bu); owns.push(own); zuls.push(zul); foer.push(zul + ref);
    }
    avd = { vals, W, L, payY, paying, refunds, overflow, xW, Lu, tb, cash, kvW, valsU, basesU, ownU, ownUReal, owns, zuls, foer, own, ownReal, zul, zulReal, ref, refReal, noElig };
  }

  // ---------- 2) Versicherung, Ansparphase ----------
  let ins: null | { vals: (number | null)[]; own: number; ownReal: number; C: number; annual: number; ea: number; gain: number; halb: boolean } = null;
  if (on('ins')) {
    const eff = zeroCost ? 0 : p.insEff;
    let V = 0, own = 0, ownReal = 0; const vals: (number | null)[] = [0];
    for (let t = 0; t < T; t++) {
      if (t < n) { const c = split.ins * dynF(t), rm = Math.pow(1 + p.g - eff, 1 / 12) - 1; for (let m = 0; m < 12; m++) { V += c; own += c; V *= 1 + rm; } ownReal += 12 * c / I(t); vals.push(V); }
      else vals.push(null);
    }
    const C = vals[n] as number;
    ins = { vals, own, ownReal, C, annual: C / 10000 * p.rf * 12, ea: ERTRAG[p.R] / 100, gain: Math.max(0, C - own), halb: n >= 12 };
  }

  // ---------- 3) Gemeinsame Einkommensteuer im Alter (hängt nicht an den Fonds, daher vorab) ----------
  const incTax = zero(), abgTax = zero(), kv = zero(), taxAvd = zero(), taxIns = zero(), xIns = zero();
  let kapTaxFlat = 0; // Kapitalauszahlung vor 12 Jahren: Abgeltungsteuer ohne Pauschbetrag (Vereinfachung des Originals)
  if (ins) {
    if (p.insLump) { if (ins.halb) xIns[n] = ins.gain * 0.85 * 0.5; else kapTaxFlat = ins.gain * 0.85 * 0.26375; }
    else for (let t = n; t < T; t++) xIns[t] = ins.annual * ins.ea;
  }
  for (let t = n; t < T; t++) {
    const xa = avd ? avd.tb[t] : 0, xi = xIns[t];
    const X = avd && ins ? xa + xi : avd ? xa : xi;
    if (X <= 0) continue;
    const tot = taxAdd(p.incRet, X, t);
    incTax[t] = tot;
    if (xa > 0) taxAvd[t] = tot * (xa / X);
    if (xi > 0) taxIns[t] = tot * (xi / X);
  }
  // AVD-30-%-Auszahlung: eigener KV-Topf 10 × Spielraum(n), wie im Original (Befund E9 offen).
  // Netto mit der Grenzsteuer auf L über allen anderen Einkünften des Jahres n.
  let lumpNet = 0, kvLa = 0;
  if (avd && avd.paying[n]) {
    const Ln = avd.L[n] + avd.Lu[n];
    kvLa = kvLump(Ln, n);
    if (Ln > 0) {
      const incO = xIns[n] > 0 ? p.incRet + xIns[n] / I(n) : p.incRet;
      lumpNet = Ln - (taxAdd(incO, avd.tb[n], n) - taxAdd(incO, avd.W[n] + avd.xW[n], n)) - kvLa;
    }
    kv[n] += kvLa;
  }
  // Versicherung: Steuer auf die Kapitalauszahlung (gemeinsam im Jahr n) bzw. für die Anzeige allein (Leibrente).
  let kapTax = 0, kapNet = 0, kvLi = 0;
  if (ins) {
    kapTax = p.insLump ? (ins.halb ? taxIns[n] : kapTaxFlat) : (ins.halb ? taxAdd(p.incRet, ins.gain * 0.85 * 0.5, n) : ins.gain * 0.85 * 0.26375);
    // Ohne kvLumpSpread (Original): KV auf die Kapitalauszahlung sofort, eigener Topf 10 × Spielraum(n).
    if (!F.kvSpread) kvLi = kvLump(ins.C, n);
    kapNet = F.kvSpread ? ins.C - kapTax : ins.C - kapTax - kvLi;
    if (p.insLump) { kv[n] += kvLi; abgTax[n] += kapTaxFlat; }
  }

  // ---------- 4) Fonds im Gleichschritt: runFund() aus model(), mit gemeinsamem Pauschbetrag ----------
  const funds: Fund[] = [];
  const mk = (part: ProductKey, monthly: number[], lumpEnd: number[] | null, ter: number, aa: number): Fund => ({
    part, monthly, lumpEnd, ter, aa, tEnd, V: 0, B: 0, own: 0, ownReal: 0, vals: [0], bases: [0], net: zero(), abg: zero(), kvInline: zero(),
    pay: false, W: 0, gain: 0, rm: 0, vp: -1, payY: 0, dedY: 0, kvBase: 0,
  });
  let fEtf: Fund | null = null, fFond: Fund | null = null, fSide: Fund | null = null, fIns: Fund | null = null;
  if (on('etf')) funds.push(fEtf = mk('etf', monthlyArr(split.etf), null, etfTer, 0));
  if (on('fond')) funds.push(fFond = mk('fond', monthlyArr(split.fond), null, zeroCost ? 0 : p.fondTer, zeroCost ? 0 : p.fondAA));
  if (avd) funds.push(fSide = mk('avd', avd.overflow, p.reinvest ? avd.refunds : null, etfTer, 0));
  if (ins && p.insLump) { const la = zero(); la[n - 1] = kapNet; funds.push(fIns = mk('ins', zero(), la, etfTer, 0)); }

  const nf = funds.length, xs = new Array<number>(nf);
  for (let t = 0; t < T; t++) {
    const accum = t < n;
    // Phase 1: Entnahmen am Jahresanfang, Gewinnanteil
    for (let i = 0; i < nf; i++) {
      const f = funds[i];
      f.rm = Math.pow(1 + (accum ? p.g : p.gPay) - f.ter, 1 / 12) - 1;
      f.W = 0; f.gain = 0; f.payY = 0; f.dedY = 0; f.kvBase = 0; f.vp = -1;
      f.pay = !accum && t < f.tEnd && f.V > 0;
      if (f.pay) { f.W = annuityDue(f.V, p.gPay - f.ter, f.tEnd - t); f.gain = Math.max(0, f.W * (f.V - f.B) / f.V); }
      xs[i] = f.gain * 0.7;
    }
    const s1 = shareAllowance(xs, 1000);
    for (let i = 0; i < nf; i++) {
      const f = funds[i];
      if (f.pay) {
        const tb = s1.taxed[i];
        if (F.kvInv || F.kvShared) { f.dedY = tb * 0.26375; f.kvBase = F.kvInv ? 0.7 * f.gain : f.gain; }
        else { const k = kvAdd(f.gain, t); f.dedY = tb * 0.26375 + k; f.kvInline[t] += k; }
        f.abg[t] += tb * 0.26375;
        f.B -= f.W * f.B / f.V; f.V -= f.W; f.payY = f.W;
      }
      // Monatsbeiträge und Wertentwicklung
      const Vs = f.V; let cY = 0, newSh = 0;
      for (let m = 1; m <= 12; m++) {
        if (accum && f.monthly[t] > 0) { const c = f.monthly[t], inv = c * (1 - f.aa); f.V += inv; f.B += c; f.own += c; f.ownReal += c / I(t); cY += inv; newSh += inv * (13 - m) / 12; }
        f.V *= 1 + f.rm;
      }
      if (f.V > 0 && p.basis > 0) f.vp = Math.min((Vs + newSh) * p.basis * 0.7, Math.max(0, f.V - Vs - cY));
      xs[i] = f.vp >= 0 ? f.vp * 0.7 : 0;
    }
    // Phase 2: Vorabpauschale mit dem Rest des gemeinsamen Pauschbetrags
    const s2 = shareAllowance(xs, s1.left);
    for (let i = 0; i < nf; i++) {
      const f = funds[i];
      if (f.vp >= 0) {
        const tx = s2.taxed[i] * 0.26375;
        if (tx > 0) { f.B *= (f.V - tx) / f.V; f.V -= tx; f.abg[t] += tx; }
        f.B += f.vp;
        if (F.kvInv && !accum && t < f.tEnd) f.kvBase += 0.7 * f.vp; // Vorabpauschale in der Rentenphase (E6)
      }
      if (f.kvBase > 0) {
        if (F.kvShared) claims[f.part]![t] += f.kvBase;
        else { const k = kvAdd(f.kvBase, t); f.dedY += k; f.kvInline[t] += k; }
      }
      if (accum && f.lumpEnd && f.lumpEnd[t] > 0) { f.V += f.lumpEnd[t]; f.B += f.lumpEnd[t]; }
      f.net[t] = f.payY - f.dedY;
      f.vals.push(f.V); f.bases.push(f.B);
    }
  }
  for (const f of funds) for (let t = 0; t < T; t++) { abgTax[t] += f.abg[t]; kv[t] += f.kvInline[t]; }
  const sellNet = (f: Fund, idx: number) => { const V = f.vals[idx], B = f.bases[idx]; return V - Math.max(0, (V - B) * 0.7 - 1000) * 0.26375; };

  // ---------- 5) Teile wie in model() zusammensetzen (Netto vor dem gemeinsamen KV-Buch) ----------
  const parts: ComboResult['parts'] = {};
  const fundNote = 'Nach Steuer bei Verkauf. Behalten die Erben, übernehmen sie den Gewinn steuerlich.';
  const fundPart = (k: ProductKey, f: Fund): ComboPart => ({
    key: k, vals: f.vals, net: f.net, own: f.own, ownReal: f.ownReal, capR: f.vals[n], capNet: sellNet(f, n), cost: 0,
    foerder: 0, foerderReal: 0, payEnd: p.H, lumpNet: 0, incTax: zero(), abgTax: f.abg, kv: f.kvInline, taxBase: zero(),
    heir: idx => ({ val: sellNet(f, idx), note: fundNote }),
  });
  if (fEtf) parts.etf = fundPart('etf', fEtf);
  if (fFond) parts.fond = fundPart('fond', fFond);
  if (avd && fSide) {
    const side = fSide;
    const aNet = zero(), aKv = side.kvInline;
    for (let t = 0; t < T; t++) {
      if (!avd.paying[t]) continue;
      const kvL = t === n ? kvLa : 0;
      if (F.kvShared) aNet[t] = avd.cash[t] - (taxAvd[t] + kvL);
      else { const k = kvAdd(avd.kvW[t], t); aNet[t] = avd.cash[t] - (taxAvd[t] + k + kvL); aKv[t] += k; kv[t] += k; }
      aKv[t] += kvL;
    }
    const latentTax = (V: number, t: number) => { const yrs = Math.max(1, tEnd - Math.max(t, n)); return yrs * taxAdd(p.incRet, V / yrs, t); };
    const Vu = avd.valsU[n], gU = Math.max(0, Vu - avd.ownU) * (n >= 12 ? 0.5 : 1); // Anschaffungskosten bei n = Summe der Beiträge
    parts.avd = {
      key: 'avd', vals: avd.vals.map((v, i) => (v + avd.valsU[i]) + side.vals[i]), net: aNet.map((v, i) => v + side.net[i]),
      own: (avd.own + avd.ownU) + side.own, ownReal: (avd.ownReal + avd.ownUReal) + side.ownReal, sideOwn: side.own, sideOwnReal: side.ownReal,
      ...(F.unsub ? { unsubOwn: avd.ownU, unsubOwnReal: avd.ownUReal } : {}),
      capR: (avd.vals[n] + Vu) + side.vals[n], capAVD: avd.vals[n] + Vu, sideR: side.vals[n],
      capNet: (avd.vals[n] + Vu) - latentTax(avd.vals[n] + gU, n) + sellNet(side, n),
      zul: avd.zul, zulReal: avd.zulReal, ref: avd.ref, refReal: avd.refReal,
      foerder: avd.zul + avd.ref, foerderReal: avd.zulReal + avd.refReal, cost: 0, payEnd: p.H, noElig: avd.noElig, lumpNet,
      incTax: taxAvd, abgTax: side.abg, kv: aKv, taxBase: avd.tb,
      heir: () => ({ val: 0, note: '' }),
    };
    // Erbfall wie in model() (Formeln und Reihenfolge der Operationen identisch, I1).
    const a = avd, gainU = (idx: number, half: boolean) => Math.max(0, a.valsU[idx] - a.basesU[idx]) * (half ? 0.5 : 1);
    const unsubNote = (idx: number, tx: number) => a.valsU[idx] > 0 ? '; ungeförderter Teil ' + eur(Rn(a.valsU[idx], idx)) + ' ohne Förderrückzahlung, Steuer der Erben auf dessen Gewinn ca. ' + eur(Rn(tx, idx)) : '';
    parts.avd.heirMarried = idx => {
      const V = a.vals[idx], lt = latentTax(V, idx);
      const halbU = p.heirHalf && idx >= 12, txU = taxAdd(p.incHeir, gainU(idx, halbU), idx);
      return { val: V - lt + (a.valsU[idx] - txU) + sellNet(side, idx), note: 'Ohne Abzug auf einen eigenen AVD-Vertrag übertragbar, später aber voll steuerpflichtig (ca. ' + eur(Rn(lt, idx)) + ' Einkommensteuer, grob geschätzt und abgezogen)' + unsubNote(idx, txU) };
    };
    parts.avd.heir = idx => {
      const V = a.vals[idx], age = p.a0 + idx, C0 = a.vals[n];
      let back: number, ownR: number, zulR: number;
      if (idx <= n) { back = a.foer[idx]; ownR = a.owns[idx]; zulR = a.zuls[idx]; }
      else { const f = C0 > 0 ? V / C0 : 0; back = a.foer[n] * f; ownR = a.owns[n] * f; zulR = a.zuls[n] * f; }
      const halb = F.heir ? p.heirHalf && idx >= 12 : p.heirHalf && age >= 62 && idx >= 12;
      const rest = Math.max(0, V - back), gain = Math.max(0, V - ownR - zulR) * (halb ? 0.5 : 1);
      const incDeath = F.heir ? p.incHeir : idx < n ? incAt(idx) : p.incRet;
      const tx = taxAdd(incDeath, gain + gainU(idx, halb), idx);
      return { val: (rest + a.valsU[idx]) - tx + sellNet(side, idx), note: 'Förderung ' + eur(Rn(back, idx)) + ' zurück, ' + (F.heir ? 'Steuer der Erben auf Erträge ' : 'Steuer auf Erträge ') + eur(Rn(tx, idx)) + (halb ? ' (hälftig)' : '') + (a.valsU[idx] > 0 ? '; darin der ungeförderte Teil ' + eur(Rn(a.valsU[idx], idx)) + ' ohne Förderrückzahlung' : '') };
    };
  }
  if (ins) {
    const base = {
      key: 'ins' as const, own: ins.own, ownReal: ins.ownReal, capR: ins.C, capNet: ins.C - kapTax, kapNet, foerder: 0, foerderReal: 0,
      cost: 0, annual: ins.annual, lump: p.insLump, lumpNet: 0, incTax: taxIns, taxBase: xIns,
    };
    if (p.insLump && fIns) {
      const f = fIns, iKv = f.kvInline;
      iKv[n] += kvLi;
      if (kapTaxFlat > 0) f.abg[n] += kapTaxFlat;
      // Fix kvLumpSpread (E8): C/10 in den Jahren n … n+9 beitragspflichtig
      if (F.kvSpread) for (let j = 0; j < 10 && n + j < T; j++) {
        if (F.kvShared) claims.ins![n + j] += ins.C / 10;
        else { const k = kvAdd(ins.C / 10, n + j); f.net[n + j] -= k; iKv[n + j] += k; kv[n + j] += k; }
      }
      const iv = ins.vals;
      parts.ins = {
        ...base, vals: iv.map((v, i) => i <= n ? v : f.vals[i]), net: f.net, payEnd: p.H, lifelong: false, abgTax: f.abg, kv: iKv,
        heir: idx => idx <= n ? { val: iv[idx] as number, note: 'Fondsguthaben, einkommensteuerfrei (nur Erbschaftsteuer)' }
                              : { val: sellNet(f, idx), note: 'ETF aus der Kapitalauszahlung. ' + fundNote },
      };
    } else {
      const net = zero(), iKv = zero();
      for (let t = n; t < T; t++) {
        if (F.kvShared) { net[t] = ins.annual - taxIns[t]; claims.ins![t] += ins.annual; }
        else { const k = kvAdd(ins.annual, t); net[t] = (ins.annual - taxIns[t]) - k; iKv[t] += k; kv[t] += k; }
      }
      const { vals: iv, annual, ea } = ins;
      const annualNet = (t: number) => annual - taxAdd(p.incRet, annual * ea, t);
      parts.ins = {
        ...base, vals: iv, net, payEnd: 100, lifelong: true, abgTax: zero(), kv: iKv,
        heir: idx => {
          if (idx <= n) return { val: iv[idx] as number, note: 'Fondsguthaben, einkommensteuerfrei (nur Erbschaftsteuer)' };
          const rest = Math.max(0, p.R + p.gz - (p.a0 + idx));
          // Restrenten der Garantiezeit einzeln versteuert; Fix heirTax (E2): mit dem Einkommen der Erben.
          const heirNet = (t: number) => F.heir ? annual - taxAdd(p.incHeir, annual * ea, t) : annualNet(t);
          let v = 0; for (let k = 0; k < rest; k++) v += heirNet(idx + k) * (p.real ? I(idx) / I(idx + k) : 1);
          return { val: v, note: rest > 0 ? 'Restliche Garantiezeit: ' + rest + ' Jahre, nach Steuer' + (F.heir ? ' der Erben' : '') : 'Garantiezeit abgelaufen – nichts' };
        },
      };
    }
  }

  // ---------- 6) Gemeinsames KV-Jahresbuch (Fix kvSharedRoom): eine BBG über alle Teile, anteilig verteilt ----------
  let kvClipped = false;
  if (F.kvShared) {
    const present = SPLIT_KEYS.filter(k => claims[k] && parts[k]);
    for (let t = 0; t < T; t++) {
      let S = 0, cnt = 0;
      for (const k of present) { const c = claims[k]![t]; if (c > 0) { S += c; cnt++; } }
      if (!(S > 0)) continue;
      const tot = kvAdd(S, t);
      if (p.kvOn && cnt > 1 && S > kvRoom(t)) kvClipped = true;
      for (const k of present) {
        const c = claims[k]![t];
        if (!(c > 0)) continue;
        const share = tot * (c / S), r = parts[k]!;
        r.net[t] -= share; r.kv[t] += share; kv[t] += share;
      }
    }
  }

  // ---------- 7) Summen ----------
  const list = SPLIT_KEYS.filter(k => parts[k]).map(k => parts[k]!);
  const net = list.length ? list[0].net.slice() : zero();
  for (let i = 1; i < list.length; i++) { const x = list[i].net; for (let t = 0; t < T; t++) net[t] += x[t]; }
  const sum = (f: (r: ComboPart) => number) => list.reduce((a, r) => a + f(r), 0);
  // Kapital nach Steuern gesamt: Fonds bei Rentenbeginn gemeinsam verkauft (ein Pauschbetrag)
  const capFunds = [fEtf, fFond, fSide].filter((f): f is Fund => !!f);
  let capNet = sum(r => r.capNet);
  if (capFunds.length > 1) {
    let V = 0, G = 0; for (const f of capFunds) { V += f.vals[n]; G += f.vals[n] - f.bases[n]; }
    const joint = V - Math.max(0, G * 0.7 - 1000) * 0.26375;
    capNet += joint - capFunds.reduce((a, f) => a + sellNet(f, n), 0);
  }
  return {
    parts, net, own: sum(r => r.own), ownReal: sum(r => r.ownReal), capR: sum(r => r.capR), capNet, cost: 0,
    foerder: sum(r => r.foerder), foerderReal: sum(r => r.foerderReal), lumpNet,
    incTax, abgTax, kv, kvClipped, T, n, tH, I,
  };
}

/** Wie analyze(): Zeitraum Rentenbeginn … Auszahlplan-Ende; cumH/avgMonthly/cum100/lump in der Anzeige-Einheit. */
export function comboStats(p: Params, c: ComboResult, net: number[] = c.net, lumpNom: number = c.lumpNet): ComboStats {
  const R = (x: number, t: number) => p.real ? x / c.I(t) : x;
  const { n, tH, T } = c;
  const lump = lumpNom ? R(lumpNom, n) : 0;
  let sumH = 0; for (let t = n; t < tH; t++) sumH += R(net[t], t);
  let sumHR = 0; for (let t = n; t < tH; t++) sumHR += net[t] / c.I(t);
  let cum100 = 0; for (let t = n; t < T; t++) cum100 += R(net[t], t);
  return { avgMonthly: (sumH - lump) / (tH - n) / 12, cumH: sumH, cumHReal: sumHR, cum100, lump };
}

/** Kennzahlen eines Teils (die 30-%-Auszahlung gehört zum AVD). */
export function partStats(p: Params, c: ComboResult, k: ProductKey): ComboStats | null {
  const r = c.parts[k];
  return r ? comboStats(p, c, r.net, r.lumpNet) : null;
}
