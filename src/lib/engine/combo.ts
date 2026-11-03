// Kombi-Engine „Budget aufteilen“: mehrere Produkte gemeinsam gerechnet, Jahr für Jahr mit
//  - einer Einkommensteuer im Alter auf die SUMME der steuerpflichtigen Zahlungen (AVD-Auszahlplan und 30-%-Auszahlung,
//    Ertragsanteil der Leibrente, hälftig steuerpflichtige Kapitalauszahlung der Versicherung),
//  - einem Sparer-Pauschbetrag (1.000 €/Jahr) über alle Fondsdepots (ETF, aktiver Fonds, AVD-Nebendepot,
//    ETF aus der Kapitalauszahlung): erst die Entnahmegewinne, dann die Vorabpauschale mit dem Rest,
//  - einem KV/PV-Jahresbuch bis zur Beitragsbemessungsgrenze über ALLE Produkte (Fix kvSharedRoom, E7).
// Gemeinsame Abzüge werden anteilig nach Bemessungsgrundlage auf die Produkte verteilt (Konvention, docs/kombi-modus.md).
//
// Spiegel der Einzelrechnung: Jede Formel ist aus engine.ts übernommen (Stand mit den Korrekturen aus fixes.ts),
// in derselben Reihenfolge der Gleitkomma-Operationen. Mit nur einem Produkt fällt jede Aufteilung auf den
// ursprünglichen Ausdruck zurück (x·(c/c) = x, max(0, x − f·(x/x)) = max(0, x − f)), deshalb gilt
// combo(p, {k: Betrag}) === model(p).res[k] bitgenau (tests/combo.test.ts, I1) – für jede Teilmenge der Fixes.
// Wichtig: Jede Änderung an engine.ts muss hier nachgezogen werden (I1 schlägt sonst fehl).
//
// Die Option `fixes` gibt es nur, damit I1 auch den Originalpfad prüfen kann. Die App ruft immer ohne Optionen,
// also mit ALL_FIXES. Ohne kvSharedRoom wird (wie im Original) jeder KV-Strom einzeln bis zur BBG begrenzt.

import { tax, ERTRAG, KV_BBG, numOf, type Params, type ProductKey } from './engine';
import { fixesOf, type EngineOptions } from './fixes';
import type { Inputs } from './inputs';

/** Monatsbeitrag je Produkt in € (heutiges Geld, wächst mit der Dynamik wie im Einzelvergleich). */
export type Split = Record<ProductKey, number>;
/** Feste Reihenfolge aller Produkte (wie PRODUCTS in analyze.ts). */
export const SPLIT_KEYS: readonly ProductKey[] = Object.freeze(['etf', 'avd', 'ins', 'fond'] as ProductKey[]);
export const emptySplit = (): Split => ({ etf: 0, avd: 0, ins: 0, fond: 0 });
export const splitSum = (s: Split): number => s.etf + s.avd + s.ins + s.fond;

/** Ergebnis je Teil der Aufteilung. Felder wie ProductResult in engine.ts (ohne Erbfall). */
export interface ComboPart {
  key: ProductKey;
  vals: (number | null)[]; net: number[];
  own: number; ownReal: number; capR: number; capNet: number; cost: number;
  foerder: number; foerderReal: number; payEnd: number; lumpNet: number;
  /** Anteil an den gemeinsamen Abzügen je Jahr (nominal): Einkommensteuer im Alter, Abgeltungsteuer, KV/PV. */
  incTax: number[]; abgTax: number[]; kv: number[];
  /** Einkommensteuerpflichtiger Betrag je Jahr (nominal), Grundlage der gemeinsamen Steuer (Fonds: 0). */
  taxBase: number[];
  // AVD
  capAVD?: number; sideR?: number; sideOwn?: number; sideOwnReal?: number;
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
}

/** Wie Stats in analyze.ts. cumHReal ist die Zielgröße der Suche und des Rankings (Fix rankReal, E1). */
export interface ComboStats { avgMonthly: number; cumH: number; cumHReal: number; cum100: number; lump: number }

export interface ComboSetup {
  /** Monatsbudget gesamt (€). */
  budget: number;
  /** Aufteilung, nur aktive Produkte (Chips) > 0 möglich. */
  split: Split;
  /** Aktive Produkte in fester Reihenfolge. */
  keys: ProductKey[];
}

const INPUT_OF: Record<ProductKey, 'cEtf' | 'cAvd' | 'cIns' | 'cFond'> = { etf: 'cEtf', avd: 'cAvd', ins: 'cIns', fond: 'cFond' };

/** Liest Budget und Aufteilung aus den Eingaben (nicht aus Params: der Golden-Test vergleicht Params mit dem Original). */
export function readCombo(inp: Inputs, p: Params): ComboSetup {
  const keys = SPLIT_KEYS.filter(k => p.on[k]);
  const split = emptySplit();
  for (const k of keys) split[k] = Math.max(0, numOf(inp[INPUT_OF[k]]));
  return { budget: Math.max(0, numOf(inp.cBudget)), split, keys };
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

function run(p: Params, split: Split, opts: EngineOptions, zeroCost: boolean): ComboResult {
  const fx = fixesOf(opts);
  const F = {
    bonus: fx.has('bonusOutsideSA'),  // E3
    kvInv: fx.has('kvInvestBase'),    // E6
    kvShared: fx.has('kvSharedRoom'), // E7
    kvSpread: fx.has('kvLumpSpread'), // E8
  };
  const T = 100 - p.a0, n = p.R - p.a0, tH = p.H - p.a0;
  const I = (t: number) => Math.pow(1 + p.infl, t);
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
  const on = (k: ProductKey) => split[k] > 0;
  const etfTer = zeroCost ? 0 : p.etfTer;
  // KV-Jahresbuch je Teil (nur mit kvSharedRoom): beitragspflichtige Beträge in derselben Reihenfolge wie in model().
  const claims: Partial<Record<ProductKey, number[]>> = {};
  if (F.kvShared) for (const k of SPLIT_KEYS) if (on(k)) claims[k] = zero();

  // ---------- 1) AVD-Vertrag: run() aus model() ohne Steuer und KV (die kommen aus dem gemeinsamen Buch) ----------
  let avd: null | {
    vals: number[]; W: number[]; L: number[]; payY: number[]; paying: boolean[]; refunds: number[]; overflow: number[];
    own: number; ownReal: number; zul: number; zulReal: number; ref: number; refReal: number; noElig: number;
  } = null;
  if (on('avd')) {
    const cost = zeroCost ? 0 : p.avdCost, avdM = split.avd;
    let V = 0, own = 0, ownReal = 0, zul = 0, zulReal = 0, ref = 0, refReal = 0, bonusUsed = false, noElig = 0;
    const vals = [0], W = zero(), L = zero(), payY = zero(), paying = new Array<boolean>(T).fill(false), refunds = zero(), overflow = zero();
    for (let t = 0; t < T; t++) {
      const age = p.a0 + t, accum = t < n;
      if (!accum && t < tEnd && V > 0) {
        let Lx = 0; if (t === n && p.einmal) { Lx = 0.3 * V; V -= Lx; }
        const w = V / (tEnd - t);
        V -= w; W[t] = w; L[t] = Lx; payY[t] = w + Lx; paying[t] = true;
        if (claims.avd) claims.avd[t] += w;
      }
      const elig = accum && (age >= p.studyEnd || p.eligStudy);
      const want = accum ? avdM * 12 * dynF(t) : 0;
      if (accum && !elig && want > 0) noElig++;
      const E = elig ? Math.min(want, 1800) : 0;
      overflow[t] = (want - E) / 12;
      const rm = Math.pow(1 + (accum ? p.g : p.gPay) - cost, 1 / 12) - 1;
      for (let m = 1; m <= 12; m++) { if (E > 0) { V += E / 12; own += E / 12; } V *= 1 + rm; }
      ownReal += E / I(t);
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
      vals.push(V);
    }
    avd = { vals, W, L, payY, paying, refunds, overflow, own, ownReal, zul, zulReal, ref, refReal, noElig };
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
    const xa = avd ? avd.payY[t] : 0, xi = xIns[t];
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
    const Ln = avd.L[n];
    kvLa = kvLump(Ln, n);
    if (Ln > 0) {
      const incO = xIns[n] > 0 ? p.incRet + xIns[n] / I(n) : p.incRet;
      lumpNet = Ln - (taxAdd(incO, avd.payY[n], n) - taxAdd(incO, avd.W[n], n)) - kvLa;
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
  const fundPart = (k: ProductKey, f: Fund): ComboPart => ({
    key: k, vals: f.vals, net: f.net, own: f.own, ownReal: f.ownReal, capR: f.vals[n], capNet: sellNet(f, n), cost: 0,
    foerder: 0, foerderReal: 0, payEnd: p.H, lumpNet: 0, incTax: zero(), abgTax: f.abg, kv: f.kvInline, taxBase: zero(),
  });
  if (fEtf) parts.etf = fundPart('etf', fEtf);
  if (fFond) parts.fond = fundPart('fond', fFond);
  if (avd && fSide) {
    const side = fSide;
    const aNet = zero(), aKv = side.kvInline;
    for (let t = 0; t < T; t++) {
      if (!avd.paying[t]) continue;
      const kvL = t === n ? kvLa : 0;
      if (F.kvShared) aNet[t] = avd.payY[t] - (taxAvd[t] + kvL);
      else { const k = kvAdd(avd.W[t], t); aNet[t] = avd.payY[t] - (taxAvd[t] + k + kvL); aKv[t] += k; kv[t] += k; }
      aKv[t] += kvL;
    }
    const latentTax = (V: number, t: number) => { const yrs = Math.max(1, tEnd - Math.max(t, n)); return yrs * taxAdd(p.incRet, V / yrs, t); };
    parts.avd = {
      key: 'avd', vals: avd.vals.map((v, i) => v + side.vals[i]), net: aNet.map((v, i) => v + side.net[i]),
      own: avd.own + side.own, ownReal: avd.ownReal + side.ownReal, sideOwn: side.own, sideOwnReal: side.ownReal,
      capR: avd.vals[n] + side.vals[n], capAVD: avd.vals[n], sideR: side.vals[n],
      capNet: avd.vals[n] - latentTax(avd.vals[n], n) + sellNet(side, n),
      zul: avd.zul, zulReal: avd.zulReal, ref: avd.ref, refReal: avd.refReal,
      foerder: avd.zul + avd.ref, foerderReal: avd.zulReal + avd.refReal, cost: 0, payEnd: p.H, noElig: avd.noElig, lumpNet,
      incTax: taxAvd, abgTax: side.abg, kv: aKv, taxBase: avd.payY,
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
      parts.ins = { ...base, vals: ins.vals.map((v, i) => i <= n ? v : f.vals[i]), net: f.net, payEnd: p.H, lifelong: false, abgTax: f.abg, kv: iKv };
    } else {
      const net = zero(), iKv = zero();
      for (let t = n; t < T; t++) {
        if (F.kvShared) { net[t] = ins.annual - taxIns[t]; claims.ins![t] += ins.annual; }
        else { const k = kvAdd(ins.annual, t); net[t] = (ins.annual - taxIns[t]) - k; iKv[t] += k; kv[t] += k; }
      }
      parts.ins = { ...base, vals: ins.vals, net, payEnd: 100, lifelong: true, abgTax: zero(), kv: iKv };
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
