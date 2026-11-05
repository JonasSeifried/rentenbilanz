// Kombi-Engine „Budget aufteilen“: mehrere Produkte gemeinsam gerechnet, Jahr für Jahr mit
//  - einer Einkommensteuer im Alter auf die SUMME der steuerpflichtigen Zahlungen (AVD-Auszahlplan und 30-%-Auszahlung,
//    Ertragsanteil der Leibrente, hälftig steuerpflichtige Kapitalauszahlung der Versicherung),
//  - einem Sparer-Pauschbetrag (1.000 €/Jahr) über alle Fondsdepots (ETF, aktiver Fonds, AVD-Nebendepot,
//    ETF aus der Kapitalauszahlung): erst die Entnahmegewinne, dann die Vorabpauschale mit dem Rest,
//  - einem KV/PV-Jahresbuch bis zur Beitragsbemessungsgrenze über ALLE Produkte (Fix kvSharedRoom, E7).
// Optional (Schalter shift, Standard aus): Umschichtung vor Rentenbeginn in allen Produkten (Abschnitt 4, Teil-Depots).
// Gemeinsame Abzüge werden anteilig nach Bemessungsgrundlage auf die Produkte verteilt (Konvention, docs/kombi-modus.md).
//
// Eine Engine: Die App rechnet auch jedes Einzelprodukt hier (Kombi mit einem Teil, single() in analyze.ts).
// Spiegel der Einzelrechnung: Jede Formel ist aus engine.ts übernommen (Stand mit den Korrekturen aus fixes.ts),
// in derselben Reihenfolge der Gleitkomma-Operationen. Mit nur einem Produkt fällt jede Aufteilung auf den
// ursprünglichen Ausdruck zurück (x·(c/c) = x, max(0, x − f·(x/x)) = max(0, x − f)), deshalb gilt
// combo(p, {k: Betrag}) === model(p).res[k] bitgenau (tests/combo.test.ts, I1) – ohne neue R-Fixes.
// engine.ts ist nur noch Referenz des Originals. Neue Rechnung nur hier, abschaltbar; abgeschaltet bitgleich (I1).
//
// Die Option `fixes` gibt es nur, damit I1 auch den Originalpfad prüfen kann. Die App ruft immer ohne Optionen,
// also mit ALL_FIXES. Ohne kvSharedRoom wird (wie im Original) jeder KV-Strom einzeln bis zur BBG begrenzt.

import { eur } from '../format';
import { est, soli, incomeAt, kvGross, tax, tax2026, contractGrowth, riskyShare, AVD_MAX, AVD_SUB_MAX, ERTRAG, KV_BBG, numOf, type HeirValue, type Params, type ProductKey, type ProductResult } from './core';
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
  /** Gemeinsame Abzüge anteilig, nominal. incTax nach KV/PV-Abzug, ggf. negativ (Entlastung übriger Rente). */
  incTax: number[]; abgTax: number[]; kv: number[];
  /** Einkommensteuerpflichtiger Betrag vor KV/PV-Sonderausgaben (nominal; Fonds: 0). */
  taxBase: number[];
  /** Erbwert bei Tod zu Beginn von Jahr idx (nominal), dieser Teil für sich versteuert (wie model()). */
  heir: (idx: number) => HeirValue;
  // AVD
  /** Erbwert, wenn der Ehepartner erbt (AVD auf eigenen Vertrag übertragen). */
  heirMarried?: (idx: number) => HeirValue;
  capAVD?: number; sideR?: number; sideOwn?: number; sideOwnReal?: number; unsubOwn?: number; unsubOwnReal?: number;
  zul?: number; zulReal?: number; ref?: number; refReal?: number; noElig?: number;
  /**
   * Mittelbare Grundzulage auf den Vertrag des Partners (§ 79 S. 2, § 84 S. 3–4 EStG n. F.), nominal summiert. Entsteht nur
   * durch die eigenen geförderten Beiträge, fließt aber in den Partner-Vertrag und ist nicht im Ergebnis enthalten.
   * Nur gesetzt, wenn > 0 (avdSpouse, Partner ohne eigenes Einkommen).
   */
  zulSpouse?: number;
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
  /**
   * Erbwert aller Teile zusammen (nominal), gemeinsam versteuert: eine Einkommensteuer der Erben im Todesjahr, ein
   * Sparer-Pauschbetrag für alle Depots. heirMarried mit AVD-Teil (Ehepartner übernimmt das geförderte Vermögen) oder bei Zusammenveranlagung (married: Todesjahr gemeinsam veranlagt).
   */
  heir: (idx: number) => HeirValue;
  heirMarried?: (idx: number) => HeirValue;
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
  /** Rendite vor Kosten in der Ansparphase; Teilfreistellung (0,7 Aktienfonds, 1 sichere Anlage ohne Teilfreistellung). */
  gA: number; tf: number;
  /** Umschichtung (shift): sicheres Teil-Depot dieses Depots (Anleihe-/Geldmarkt-ETF) bzw. das Aktien-Depot dazu. */
  safe: Fund | null; risky: Fund | null;
  /** Umschichtung im laufenden Jahr: Verkaufsbetrag aus diesem Depot (> 0) und dessen Gewinn. */
  sell: number; sellGain: number;
  V: number; B: number; own: number; ownReal: number;
  pending: number; pendingAt: number[];
  vals: number[]; bases: number[]; net: number[]; abg: number[]; kvInline: number[];
  pay: boolean; W: number; gain: number; rm: number; vp: number; payY: number; dedY: number; kvBase: number;
  /** Nebendepot: noch nicht gedeckte negative Erstattung (Mehrsteuer durch die gemeinsame Günstigerprüfung mit Partner-Vertrag). */
  owed: number;
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
    soliZ: fx.has('soliOnZulage'),    // E4
    kvInv: fx.has('kvInvestBase'),    // E6
    kvShared: fx.has('kvSharedRoom'), // E7
    kvSpread: fx.has('kvLumpSpread'), // E8
    unsub: fx.has('avdUnsubsidized'), // E10
    heir: fx.has('heirTax'),          // E2
    kvDeduct: fx.has('kvDeductible'), // R1
    small: fx.has('avdSmallContribution'), // R6
    round: fx.has('taxRounding'),    // R8
    gp: fx.has('capitalGuenstiger'), nextVP: fx.has('vpNextYear'),
    grossKV: fx.has('kvGrossIncome'), insAllowance: fx.has('insuranceAllowance'),
    vpSale: fx.has('vpTaxSale'),     // R2
    insMin: fx.has('insDeathMinimum'), // R9
  };
  const T = 100 - p.a0, n = p.R - p.a0, tH = p.H - p.a0;
  const I = (t: number) => Math.pow(1 + p.infl, t);
  const Rn = (x: number, t: number) => p.real ? x / I(t) : x; // für Beträge in Hinweistexten (gleiche Basis wie die Anzeige)
  const incomes = Array.from({ length: n }, (_, t) => incomeAt(p, p.a0 + t)); // einmal je Lauf, nur Ansparjahre (incAt nur für t < n)
  const incAt = (t: number) => incomes[t]; // Ausbildung, Beruf, optional Gehaltsentwicklung (core.ts)
  // Steuerprofil (neu, nicht im Original; docs/kirchensteuer-splitting.md): Kirchensteuer p.kist, Zusammenveranlagung
  // p.married. fam = false ⇒ jeder Ausdruck wie bisher (bitgleich). own = Steuer des eigenen Haushalts (mit Partner
  // gemeinsam), sonst einer einzelnen Person (Erben, überlebender Partner): Grundtarif, gleicher Kirchensteuersatz.
  const fam = p.kist > 0 || p.married;
  // § 32d Abs. 1 S. 3–5 EStG: ESt = e/(4 + k); Soli 5,5 % und Kirchensteuer k darauf ⇒ Satz (1,055 + k)/(4 + k).
  const ABG = p.kist > 0 ? (1.055 + p.kist) / (4 + p.kist) : .26375;
  // Was-wäre-wenn Steueränderung (neu, nicht im Original; docs/steueraenderung.md): ab Jahr tChange (Standard Rentenbeginn)
  // Abgeltungsteuersatz p.abgRate statt 25 % und Grenzsteuersatz der Einkommensteuer um p.estAdd höher. Hypothetisch,
  // keine künftige Rechtslage. Kirchensteuer: § 32d Abs. 1 S. 3–4 verallgemeinert unter der Annahme, dass auch die Ermäßigung
  // um „25 % der Kirchensteuer“ (S. 3) dem neuen Satz folgt: ESt = e · s/(1 + s · k). Bleibt S. 3 bei 25 %: e · s/(1 + 0,25 · k).
  // Standard (25 %, 0) ⇒ jeder Ausdruck wie bisher (bitgleich).
  const tChange = p.taxFrom < 0 ? n : Math.max(0, p.taxFrom - p.a0);
  const ABG_NEW = p.abgRate === .25 ? ABG : p.kist > 0 ? p.abgRate * (1.055 + p.kist) / (1 + p.abgRate * p.kist) : p.abgRate * 1.055;
  const abg = (t: number) => t >= tChange ? ABG_NEW : ABG;
  const estAddAt = (t: number) => t >= tChange ? p.estAdd : 0;
  // § 20 Abs. 9 S. 2 EStG: gemeinsamer Sparer-Pauschbetrag 2.000 € (Partner ohne eigene Kapitalerträge angenommen).
  const SPB = p.married ? 2000 : 1000;
  const partnerNom = (t: number) => (t < n ? p.incSpouse : p.incSpouseRet) * I(t);
  // Partner erbt (verheiratet): Im Todesjahr gemeinsame Veranlagung (§ 26 Abs. 1, beide lebten zu Jahresbeginn) mit dem
  // Partner-Einkommen allein (Tod zu Jahresbeginn), Splitting und 2.000 € Pauschbetrag: own = true mit eigenem Einkommen 0.
  const spouseHeir = p.married;
  /**
   * Veranlagung mit Steuerprofil, nominal: tarifliche ESt auf das zvE nach Abzug `ded` (eigener Haushalt verheiratet:
   * Splitting § 32a Abs. 5 auf eigenes + Partner-zvE), zuzüglich hinzugerechneter Zulage z (§ 2 Abs. 6), darauf Soli
   * (§ 3 Abs. 2/3 SolZG, Freigrenze bei Splitting 40.700 €) und Kirchensteuer (§ 51a Abs. 2 EStG). Gezahlte
   * Kirchensteuer über dem Sonderausgaben-Pauschbetrag (36 €, Ehegatten 72 €, § 10c) mindert das zvE (§ 10 Abs. 1
   * Nr. 4): Beharrungszustand im selben Jahr, Fixpunkt (Kontraktion k · Grenzsteuersatz < 5 %), bis die ESt stehen bleibt,
   * höchstens zehn Schritte. Wegen der Euro-Abrundung kann er zwischen zwei um 1 € verschiedenen Werten pendeln: dann
   * gilt der höhere (unabhängig von der Schrittzahl). `paid` ≥ 0: diese gezahlte KiSt abziehen statt des Fixpunkts
   * (beide Varianten der Günstigerprüfung mit derselben im Jahr gezahlten Kirchensteuer).
   * est = tarifliche ESt ohne z (Vergleichsgröße des § 10a Abs. 2, BFH X R 11/21); church = Kirchensteuer.
   */
  const assess = (xNom: number, t: number, own: boolean, ded = 0, z = 0, paid = -1) => {
    const sp = own && p.married, index = I(t), k = p.kist, sap = sp ? 72 : 36;
    const zve = xNom + (sp ? partnerNom(t) : 0) - ded;
    const estOf = (x: number) => sp ? 2 * incomeTaxNom(Math.max(0, x) / 2, t) : incomeTaxNom(Math.max(0, x), t);
    let est: number, church: number;
    if (paid >= 0) { est = estOf(zve - Math.max(0, paid - sap)); church = k * (est + z); }
    else {
      est = estOf(zve); church = k * (est + z);
      let prev = NaN;
      if (k > 0) for (let i = 0; i < 10; i++) {
        const next = estOf(zve - Math.max(0, church - sap));
        if (next === est) break;
        if (next === prev) { est = Math.max(est, next); church = k * (est + z); break; }
        prev = est; est = next; church = k * (est + z);
      }
    }
    const assessed = est + z;
    const so = (sp ? 2 * soli(assessed / index / 2) : soli(assessed / index)) * index;
    return { est, church, total: assessed + so + church };
  };
  const taxNom = (incomeNom: number, t: number, own = true) => fam ? assess(incomeNom, t, own).total
    : estAddAt(t) !== 0 ? withSoli(incomeTaxNom(incomeNom, t), t)
    : F.round ? tax2026(incomeNom, I(t)) : tax(incomeNom / I(t)) * I(t);
  const withSoli = (e: number, t: number) => e + soli(e / I(t)) * I(t);
  const taxAdd = (incReal: number, addNom: number, t: number, own = true) => addNom <= 0 ? 0 : F.round || fam || estAddAt(t) !== 0
    ? taxNom(incReal * I(t) + addNom, t, own) - taxNom(incReal * I(t), t, own)
    : (tax(incReal + addNom / I(t)) - tax(incReal)) * I(t);
  const taxSave = (incReal: number, dedNom: number, t: number) => fam || estAddAt(t) !== 0
    ? taxNom(incReal * I(t), t) - taxNom(incReal * I(t) - dedNom, t) // Abzug auch über das eigene Einkommen hinaus (Splitting)
    : F.round
    ? taxNom(incReal * I(t), t) - taxNom(Math.max(0, incReal * I(t) - dedNom), t)
    : (tax(incReal) - tax(Math.max(0, incReal - dedNom / I(t)))) * I(t);
  const kvRoom = (t: number) => Math.max(0, (KV_BBG - (F.grossKV ? kvGross(p) : p.incRet)) * I(t));
  const kvAdd = (addNom: number, t: number) => p.kvOn && addNom > 0 ? p.kvRate * Math.min(addNom, kvRoom(t)) : 0;
  const kvLump = (addNom: number, t: number) => p.kvOn && addNom > 0 ? p.kvRate * Math.min(addNom, 10 * kvRoom(t)) : 0;
  // Sparer-Pauschbetrag (§ 20 Abs. 9 EStG) des eigenen Haushalts (verheiratet 2.000 €); allowanceUsed (heutiges Geld)
  // ist anderweitig verbraucht (bei Paaren: vom gemeinsamen Betrag). Die Erben haben ihren eigenen Pauschbetrag
  // (heirAllowance), unabhängig davon; erbt der Partner, gilt im Todesjahr der gemeinsame Betrag (allowance).
  const heirAllowance = (t: number) => 1000 * (p.indexAllowance ? I(t) : 1);
  const allowanceFull = (t: number) => SPB * (p.indexAllowance ? I(t) : 1);
  const allowance = (t: number) => p.allowanceUsed > 0 ? Math.max(0, allowanceFull(t) - p.allowanceUsed * I(t)) : allowanceFull(t);
  const saDed = new Array<number>(T).fill(0), saZ = new Array<number>(T).fill(0);
  // E4: § 10a prüft die tarifliche ESt, danach § 2 Abs. 6 EStG / § 3 Abs. 2 SolZG.
  // Nominale ESt separat benötigt; core.ts und seine historische Rechnung bleiben unverändert.
  // Dieselben Tarifkoeffizienten wie tax2026, ohne zusätzliche Abrundung in heutigen Euro.
  // Was-wäre-wenn: estAddAt(t) Prozentpunkte mehr Grenzsteuersatz oberhalb des Grundfreibetrags (12.348 €, heutiges Geld).
  const incomeTaxNom = (incomeNom: number, t: number) => {
    const index = I(t), d = estAddAt(t);
    if (!F.round) return d === 0 ? est(incomeNom / index) * index : Math.max(0, est(incomeNom / index) + d * Math.max(0, Math.floor(Math.max(0, incomeNom / index)) - 12348)) * index;
    const x = Math.floor(Math.max(0, incomeNom)) / index;
    let e = d === 0 ? 0 : d * Math.max(0, x - 12348);
    if (x > 277825) e += .45 * x - 19470.38;
    else if (x > 69878) e += .42 * x - 11135.63;
    else if (x > 17799) { const z = (x - 17799) / 1e4; e += (173.10 * z + 2397) * z + 1034.87; }
    else if (x > 12348) { const y = (x - 12348) / 1e4; e += (914.51 * y + 1400) * y; }
    return Math.floor(Math.max(0, e) * index);
  };
  const avdLiability = (incomeNom: number, ded: number, z: number, t: number) => {
    if (fam) {
      const b = assess(Math.max(0, incomeNom), t, true);
      if (!(ded > 0)) return b.total;
      if (!F.soliZ) return Math.min(b.total, assess(incomeNom, t, true, ded).total + z);
      // Wie unten: Vergleich der tariflichen ESt. Beide Varianten mit derselben gezahlten Kirchensteuer (§ 10 Abs. 1 Nr. 4),
      // nämlich der des Ergebnisses: Abzug, wenn er mit der Kirchensteuer des Abzugsfalls günstiger ist; sonst ohne.
      const a = assess(incomeNom, t, true, ded, z);
      return assess(incomeNom, t, true, 0, 0, a.church).est - a.est > z ? a.total : b.total;
    }
    const base = taxNom(Math.max(0, incomeNom), t);
    if (!(ded > 0)) return base;
    if (!F.soliZ) return Math.min(base, taxNom(Math.max(0, incomeNom - ded), t) + z);
    const before = incomeTaxNom(incomeNom, t), after = incomeTaxNom(Math.max(0, incomeNom - ded), t);
    // Kein SA-Abzug und keine Hinzurechnung bei Gleichstand oder höherer Zulagenförderung.
    if (before - after <= z) return base;
    const assessed = after + z;
    return assessed + soli(assessed / I(t)) * I(t);
  };
  const dynF = (t: number) => Math.pow(1 + p.dyn, t);
  // Partner mit eigenem gefördertem Vertrag (avdSpouse, nur verheiratet; docs/kirchensteuer-splitting.md). 0 ⇒ bitgleich.
  // Hat der Partner ein eigenes zvE (incSpouse > 0), gilt er als unmittelbar förderberechtigt (Annahme: in der Rentenversicherung
  // pflichtversichert, Beamter oder nach § 10a Abs. 1 S. 5 n. F. selbständig): eigene Zulage aus eigenem Beitrag, eigener
  // Höchstbetrag 1.800 €; die Günstigerprüfung vergleicht die Summe beider Abzüge mit beiden Zulagen (§ 10a Abs. 3 S. 1 und 5,
  // BMF 05.10.2023 Rn. 110). Der Partner-Vertrag besteht in jedem verglichenen Produkt; er ist die Ausgangslage (saDed/saZ).
  // Ohne eigenes zvE: mittelbar zulageberechtigt (§ 79 S. 2), nur wenn auch die Person selbst einen Vertrag hat (BMF Rn. 27):
  // siehe AVD-Block.
  const spouseAvd = p.married && p.avdSpouse > 0, spouseDirect = spouseAvd && p.incSpouse > 0;
  const spouseE = (t: number) => t < n ? p.avdSpouse * 12 * dynF(t) : 0;
  const grundOf = (e: number) => 0.5 * Math.min(e, 360) + 0.25 * Math.max(0, Math.min(e, 1800) - 360); // § 84 S. 1 n. F.
  const spD = new Array<number>(T).fill(0), spZ = new Array<number>(T).fill(0); // Abzug und Zulage des Partners allein
  if (spouseDirect) for (let t = 0; t < n; t++) {
    const e = Math.min(spouseE(t), AVD_SUB_MAX); // eigener Höchstbetrag des Partners (§ 10a Abs. 1 S. 1 n. F.)
    if (!(e >= 120 || (F.small && e > 0))) continue; // Mindesteigenbeitrag 120 € (§ 86 n. F.); darunter mit R6 nur Abzug
    const z = e >= 120 ? grundOf(e) : 0; // nur Grundzulage (Kinder bei der Person, kein Bonus: der zählt nicht, E3)
    spD[t] = e + z; spZ[t] = z; saDed[t] = e + z; saZ[t] = z;
  }
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
    /** Diesem Vertrag zugerechnete Steuerermäßigung (§ 10a Abs. 4 S. 3–4), Teil des Rückzahlungsbetrags; ohne Partner-Vertrag = ref. */
    refBack: number; zulSpouse: number;
  } = null;
  if (on('avd')) {
    const cost = zeroCost ? 0 : p.avdCost, avdM = split.avd;
    let V = 0, own = 0, ownReal = 0, zul = 0, zulReal = 0, ref = 0, refReal = 0, bonusUsed = false, noElig = 0, refBack = 0, zulSpouse = 0;
    let Vu = 0, Bu = 0, ownU = 0, ownUReal = 0;
    const vals = [0], W = zero(), L = zero(), payY = zero(), paying = new Array<boolean>(T).fill(false), refunds = zero(), overflow = zero();
    const delayedZ = zero(), backs = zero();
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
      const payCost = zeroCost ? 0 : p.avdPayCost < 0 ? cost : p.avdPayCost;
      const rm = Math.pow(1 + contractGrowth(p, t, n) - (accum ? cost : payCost), 1 / 12) - 1;
      for (let m = 1; m <= 12; m++) {
        if (E > 0) { V += E / 12; own += E / 12; }
        if (U > 0) { Vu += U / 12; Bu += U / 12; ownU += U / 12; }
        V *= 1 + rm; Vu *= 1 + rm;
      }
      ownReal += E / I(t); ownUReal += U / I(t);
      if (elig && (E >= 120 || (F.small && E > 0))) {
        const hasAllowance = E >= 120;
        const grund = hasAllowance ? 0.5 * Math.min(E, 360) + 0.25 * Math.max(0, Math.min(E, 1800) - 360) : 0;
        const kidActive = age >= p.kidsFrom && age < p.kidsFrom + p.kidsYears;
        const kind = hasAllowance && kidActive ? p.kids * 300 * Math.min(1, E / 300) : 0;
        let bon = 0; if (hasAllowance && p.bonus && !bonusUsed && age < 25) { bon = 200; bonusUsed = true; }
        const z = grund + kind + bon;
        const zSA = F.bonus ? grund + kind : z; // Günstigerprüfung ohne Bonus (E3); hängt nur am AVD-Teil
        if (p.fundingDelay) delayedZ[t + 1] = z; else V += z;
        zul += z; zulReal += z / I(t + (p.fundingDelay ? 1 : 0));
        let extra: number, back: number;
        // Mittelbar zulageberechtigter Partner (§ 79 S. 2): eigener Vertrag, ≥ 120 € eigener Beitrag (Nr. 4 n. F.), Grundzulage
        // aus den eigenen geförderten Beiträgen, höchstens 175 € (§ 84 S. 3–4 n. F.). Bei der Person zählen beide Beiträge
        // (eigene vorrangig, Höchstbetrag + 120 €, § 10a Abs. 3 S. 2–4 n. F.) und beide Zulagen. Ohne eigenen Vertrag der
        // Person gäbe es weder Zulage noch Abzug des Partners (BMF 05.10.2023 Rn. 26/27): Ausgangslage ohne Abzug.
        const eM = spouseAvd && !spouseDirect && hasAllowance ? spouseE(t) : 0;
        if ((spouseDirect && spD[t] > 0) || eM >= 120) {
          const x = incAt(t) * I(t);
          const eP = spouseDirect ? spD[t] - spZ[t] : Math.min(eM, AVD_SUB_MAX + 120 - E);
          const zP = spouseDirect ? spZ[t] : Math.min(175, grund);
          const ded = E + zSA + eP + zP, zz = zSA + zP;
          saDed[t] = ded; saZ[t] = zz;
          const joint = avdLiability(x, ded, zz, t);
          // Erstattung = Änderung der gemeinsamen Steuer durch den eigenen Vertrag (Partner-Vertrag in beiden Fällen gleich).
          extra = (spouseDirect ? avdLiability(x, spD[t], spZ[t], t) : taxNom(x, t)) - joint;
          // Zurechnung der festgestellten Steuerermäßigung im Verhältnis der geförderten Eigenbeiträge (§ 10a Abs. 4 S. 3–4, Rn. 116/118).
          back = Math.max(0, taxNom(x, t) - joint) * (E / (E + eP));
          if (!spouseDirect) zulSpouse += zP;
        } else {
          saDed[t] = E + zSA; saZ[t] = zSA;
          extra = F.soliZ
            ? taxNom(incAt(t) * I(t), t) - avdLiability(incAt(t) * I(t), E + zSA, zSA, t)
            : Math.max(0, taxSave(incAt(t), E + zSA, t) - zSA);
          back = extra;
        }
        refunds[t + (p.fundingDelay ? 1 : 0)] = extra; ref += extra; refReal += extra / I(t + (p.fundingDelay ? 1 : 0));
        backs[t + (p.fundingDelay ? 1 : 0)] = back; refBack += back;
      }
      if (p.fundingDelay) V += delayedZ[t];
      // Erbfall: nur bereits gutgeschriebene Förderung zurückfordern (bei Verzug fehlt die des laufenden Jahres noch).
      const pendZ = p.fundingDelay ? delayedZ[t + 1] : 0, pendR = p.fundingDelay ? backs[t + 1] : 0;
      vals.push(V); valsU.push(Vu); basesU.push(Bu); owns.push(own); zuls.push(zul - pendZ); foer.push(zul + refBack - pendZ - pendR);
    }
    avd = { vals, W, L, payY, paying, refunds, overflow, xW, Lu, tb, cash, kvW, valsU, basesU, ownU, ownUReal, owns, zuls, foer, own, ownReal, zul, zulReal, ref, refReal, noElig, refBack, zulSpouse };
  }

  // ---------- 2) Versicherung, Ansparphase ----------
  let ins: null | { vals: (number | null)[]; paid: number[]; own: number; ownReal: number; C: number; annual: number; ea: number; gain: number; halb: boolean } = null;
  if (on('ins')) {
    const eff = zeroCost ? 0 : p.insEff;
    let V = 0, own = 0, ownReal = 0; const vals: (number | null)[] = [0], paid = [0];
    for (let t = 0; t < T; t++) {
      if (t < n) { const c = split.ins * dynF(t), rm = Math.pow(1 + contractGrowth(p, t, n) - eff, 1 / 12) - 1; for (let m = 0; m < 12; m++) { V += c; own += c; V *= 1 + rm; } ownReal += 12 * c / I(t); vals.push(V); paid.push(own); }
      else vals.push(null);
    }
    const C = vals[n] as number;
    ins = { vals, paid, own, ownReal, C, annual: C / 10000 * p.rf * 12, ea: ERTRAG[p.R] / 100, gain: Math.max(0, C - own), halb: n >= 12 };
  }

  // Fix insDeathMinimum (R9): Tod vor Rentenbeginn (idx < n) zahlt mindestens die eingezahlten Beiträge (Beitragsrückgewähr).
  // idx = n (Tod mit Rentenbeginn) bleibt beim Guthaben, wie die Kapitalabfindung zu diesem Zeitpunkt.
  const insDeath = (idx: number) => {
    const v = ins!.vals[idx] as number, b = ins!.paid[idx];
    const min = F.insMin && idx < n && b > v;
    return { val: min ? b : v, min, note: min ? 'Eingezahlte Beiträge (Mindestleistung, über dem Fondsguthaben), einkommensteuerfrei (nur Erbschaftsteuer)' : 'Fondsguthaben, einkommensteuerfrei (nur Erbschaftsteuer)' };
  };

  // ---------- 3) Gemeinsame Einkommensteuer im Alter (hängt nicht an den Fonds, daher vorab) ----------
  const incTax = zero(), abgTax = zero(), kv = zero(), taxAvd = zero(), taxIns = zero(), xIns = zero();
  let kapTaxFlat = 0; // Kapitalauszahlung vor 12 Jahren: Abgeltungsteuer ohne Pauschbetrag (Vereinfachung des Originals)
  let kapFlatBase = 0; // deren Bemessungsgrundlage (für Abgeltungsteuersatz 0 %, sonst über kapTaxFlat / abg(n) wie bisher)
  if (ins) {
    if (p.insLump) { if (ins.halb) xIns[n] = ins.gain * 0.85 * 0.5; else { kapFlatBase = ins.gain * 0.85; kapTaxFlat = kapFlatBase * abg(n); } }
    else for (let t = n; t < T; t++) xIns[t] = ins.annual * ins.ea;
  }
  const insuranceFree = zero();
  if (F.insAllowance && ins && p.insLump) {
    const x = ins.halb ? xIns[n] : abg(n) > 0 ? kapTaxFlat / abg(n) : kapFlatBase;
    insuranceFree[n] = Math.min(allowance(n), x);
    if (ins.halb) xIns[n] -= insuranceFree[n];
    else kapTaxFlat = (x - insuranceFree[n]) * abg(n);
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
  // Die hypothetische Kapitalwahl hat einen eigenen Freibetrag. Er verändert weder den
  // Pauschbetrag der tatsächlich gewählten Leibrente noch deren Steuer-/KV-Jahresbuch.
  const capitalInsGain = ins ? ins.gain * .85 * (ins.halb ? .5 : 1) : 0;
  const capitalInsFree = F.insAllowance && ins ? (p.insLump ? insuranceFree[n] : Math.min(allowance(n), capitalInsGain)) : 0;
  const capitalInsIncome = ins?.halb ? (p.insLump ? xIns[n] : Math.max(0, capitalInsGain - capitalInsFree)) : 0;
  let kapTax = 0, kapNet = 0, kvLi = 0;
  if (ins) {
    kapTax = p.insLump ? (ins.halb ? taxIns[n] : kapTaxFlat) : (ins.halb ? taxAdd(p.incRet, capitalInsIncome, n) : Math.max(0, capitalInsGain - capitalInsFree) * abg(n));
    // Ohne kvLumpSpread (Original): KV auf die Kapitalauszahlung sofort, eigener Topf 10 × Spielraum(n).
    if (!F.kvSpread) kvLi = kvLump(ins.C, n);
    kapNet = F.kvSpread ? ins.C - kapTax : ins.C - kapTax - kvLi;
    if (p.insLump) { kv[n] += kvLi; abgTax[n] += kapTaxFlat; }
  }

  // ---------- 4) Fonds im Gleichschritt: runFund() aus model(), mit gemeinsamem Pauschbetrag ----------
  const funds: Fund[] = [];
  const mk = (part: ProductKey, monthly: number[], lumpEnd: number[] | null, ter: number, aa: number, gA = p.g, tf = 0.7): Fund => ({
    part, monthly, lumpEnd, ter, aa, tEnd, gA, tf, safe: null, risky: null, sell: 0, sellGain: 0,
    pending: 0, pendingAt: [0],
    V: 0, B: 0, own: 0, ownReal: 0, vals: [0], bases: [0], net: zero(), abg: zero(), kvInline: zero(),
    pay: false, W: 0, gain: 0, rm: 0, vp: -1, payY: 0, dedY: 0, kvBase: 0, owed: 0,
  });
  // Umschichtung (shift): Beiträge und Einmalbeträge gehen nach Zielanteil in das Aktien-Depot und ein sicheres Teil-Depot
  // (Anleihe-/Geldmarkt-ETF: ETF-Kosten, kein Ausgabeaufschlag, Rendite safeRate, keine Teilfreistellung).
  // Ohne Umschichtung gibt es kein Teil-Depot, und jedes Depot rechnet exakt wie runFund() in model().
  const add = (part: ProductKey, monthly: number[], lumpEnd: number[] | null, ter: number, aa: number): Fund => {
    if (!p.shift) { const f = mk(part, monthly, lumpEnd, ter, aa); funds.push(f); return f; }
    const w = (t: number) => riskyShare(p, t, n);
    const r = mk(part, monthly.map((m, t) => m * w(t)), lumpEnd && lumpEnd.map((x, t) => x * w(t)), ter, aa);
    const sf = mk(part, monthly.map((m, t) => m * (1 - w(t))), lumpEnd && lumpEnd.map((x, t) => x * (1 - w(t))), etfTer, 0, p.safeRate, 1);
    r.safe = sf; sf.risky = r; funds.push(r, sf);
    return r;
  };
  let fEtf: Fund | null = null, fFond: Fund | null = null, fSide: Fund | null = null, fIns: Fund | null = null;
  if (on('etf')) fEtf = add('etf', monthlyArr(split.etf), null, etfTer, 0);
  if (on('fond')) fFond = add('fond', monthlyArr(split.fond), null, zeroCost ? 0 : p.fondTer, zeroCost ? 0 : p.fondAA);
  if (avd) fSide = add('avd', avd.overflow, p.reinvest ? avd.refunds : null, etfTer, 0);
  if (ins && p.insLump) { const la = zero(); la[n - 1] = kapNet; fIns = add('ins', zero(), la, etfTer, 0); }

  const settleVP = (f: Fund, vp: number, tx: number, t: number, accum: boolean) => {
    if (F.vpSale) {
      f.B += vp;
      if (tx > 0 && f.V > 0) {
        const q = Math.max(0, (f.V - f.B) / f.V);
        const sale = tx / (1 - q * f.tf * abg(t));
        f.B *= (f.V - sale) / f.V; f.V -= sale; f.abg[t] += sale;
        if (!accum && t < f.tEnd) f.kvBase += q * sale * (F.kvInv ? f.tf : 1);
      }
    } else {
      if (tx > 0 && f.V > 0) { f.B *= (f.V - tx) / f.V; f.V -= tx; f.abg[t] += tx; }
      f.B += vp;
    }
    if (F.kvInv && !accum && t < f.tEnd) f.kvBase += f.tf * vp;
  };
  const nf = funds.length, xs = new Array<number>(nf);
  for (let t = 0; t < T; t++) {
    const accum = t < n;
    // R4: VP-Zufluss am ersten Werktag, vor Entnahmen/Umschichtung. Versicherung hat beim
    // Pauschbetrag Vorrang (tarifbesteuerte Erträge); Bankabzug wird als Jahresabrechnung genähert.
    let free = Math.max(0, allowance(t) - insuranceFree[t]);
    for (const f of funds) { f.payY = 0; f.dedY = 0; f.kvBase = 0; }
    if (F.nextVP) {
      const due = shareAllowance(funds.map(f => f.pending * f.tf), free); free = due.left;
      for (let i = 0; i < nf; i++) {
        const f = funds[i];
        settleVP(f, f.pending, due.taxed[i] * abg(t), t, accum); f.pending = 0;
      }
    }
    // Phase 1: Entnahmen am Jahresanfang, Gewinnanteil
    for (let i = 0; i < nf; i++) {
      const f = funds[i];
      const configured = f.part === 'fond' && !f.risky ? p.fondPayTer : p.etfPayTer;
      const ter = zeroCost ? 0 : !accum && configured >= 0 ? configured : f.ter;
      f.rm = Math.pow(1 + (accum ? f.gA : p.gPay) - ter, 1 / 12) - 1;
      f.W = 0; f.gain = 0; f.vp = -1;
      f.pay = !accum && t < f.tEnd && f.V > 0;
      if (f.pay) { f.W = p.payResidual ? f.V / (f.tEnd - t) : annuityDue(f.V, p.gPay - ter, f.tEnd - t); f.gain = Math.max(0, f.W * (f.V - f.B) / f.V); }
      xs[i] = f.gain * f.tf;
      // Umschichtung zu Jahresbeginn auf den Zielanteil (nur Ansparphase): Verkauf aus dem übergewichteten Teil-Depot,
      // Gewinn anteilig nach Anschaffungskosten (Durchschnitt statt FIFO), Verlust ohne Verrechnung (wie bei Entnahmen).
      f.sell = 0; f.sellGain = 0;
      if (accum && f.safe) {
        const r = f, sf = f.safe, tot = r.V + sf.V, target = riskyShare(p, t, n) * tot;
        const from = r.V > target ? r : sf, x = r.V > target ? r.V - target : target - r.V;
        if (tot > 0 && x > 0 && from.V > 0) { from.sell = x; from.sellGain = Math.max(0, x * (from.V - from.B) / from.V); }
      }
    }
    for (let i = 0; i < nf; i++) if (funds[i].sell > 0) xs[i] += funds[i].sellGain * funds[i].tf;
    const s1 = shareAllowance(xs, free);
    // Umschichtung ausführen: Die Abgeltungsteuer wird aus dem Verkaufserlös bezahlt, der Rest wird umgeschichtet.
    for (let i = 0; i < nf; i++) {
      const f = funds[i];
      if (!(f.sell > 0)) continue;
      const tx = s1.taxed[i] * abg(t), to = (f.safe ?? f.risky)!;
      f.B -= f.sell * f.B / f.V; f.V -= f.sell; f.abg[t] += tx;
      to.V += f.sell - tx; to.B += f.sell - tx;
    }
    for (let i = 0; i < nf; i++) {
      const f = funds[i];
      if (f.pay) {
        const tb = s1.taxed[i];
        if (F.kvInv || F.kvShared) { f.dedY = tb * abg(t); f.kvBase += F.kvInv ? f.tf * f.gain : f.gain; }
        else { const k = kvAdd(f.gain, t); f.dedY = tb * abg(t) + k; f.kvInline[t] += k; }
        f.abg[t] += tb * abg(t);
        f.B -= f.W * f.B / f.V; f.V -= f.W; f.payY = f.W;
      }
      // Monatsbeiträge und Wertentwicklung
      const Vs = f.V; let cY = 0, newSh = 0;
      for (let m = 1; m <= 12; m++) {
        if (accum && f.monthly[t] > 0) { const c = f.monthly[t], inv = c * (1 - f.aa); f.V += inv; f.B += c; f.own += c; f.ownReal += c / I(t); cY += inv; newSh += inv * (13 - m) / 12; }
        f.V *= 1 + f.rm;
      }
      if (f.V > 0 && p.basis > 0) f.vp = Math.min((Vs + newSh) * p.basis * 0.7, Math.max(0, f.V - Vs - cY));
      xs[i] = f.vp >= 0 ? f.vp * f.tf : 0;
    }
    // Phase 2: Vorabpauschale mit dem Rest des gemeinsamen Pauschbetrags
    const s2 = shareAllowance(F.nextVP ? xs.map(() => 0) : xs, s1.left);
    for (let i = 0; i < nf; i++) {
      const f = funds[i];
      if (F.nextVP) f.pending = Math.max(0, f.vp);
      else if (f.vp >= 0) {
        const tx = s2.taxed[i] * abg(t);
        settleVP(f, f.vp, tx, t, accum);
      }
      if (f.kvBase > 0) {
        if (F.kvShared) claims[f.part]![t] += f.kvBase;
        else { const k = kvAdd(f.kvBase, t); f.dedY += k; f.kvInline[t] += k; }
      }
      if ((accum || (p.fundingDelay && f.part === 'avd')) && f.lumpEnd && f.lumpEnd[t] > 0) { f.V += f.lumpEnd[t]; f.B += f.lumpEnd[t]; }
      // Negative Erstattung (nur mit Partner-Vertrag, avdSpouse): Mehrsteuer aus dem Nebendepot entnommen, soweit vorhanden
      // (Näherung: Entnahme zum Durchschnittswert ohne Steuer auf den Gewinnanteil); der Rest wird später gedeckt, notfalls
      // bei Rentenbeginn von der AVD-Auszahlung abgezogen (ohne Zins).
      else if ((accum || (p.fundingDelay && f.part === 'avd')) && f.lumpEnd && f.lumpEnd[t] < 0) f.owed -= f.lumpEnd[t];
      if (f.owed > 0 && f.V > 0) { const x = Math.min(f.owed, f.V); f.B *= (f.V - x) / f.V; f.V -= x; f.owed -= x; }
      f.net[t] = f.payY - f.dedY;
      f.vals.push(f.V); f.bases.push(f.B); f.pendingAt.push(f.pending);
    }
  }
  for (const f of funds) for (let t = 0; t < T; t++) { abgTax[t] += f.abg[t]; kv[t] += f.kvInline[t]; }
  // Ein Depot eines Teils: das Fondsdepot, mit Umschichtung zusammen mit seinem sicheren Teil-Depot (Zahlen summiert).
  interface Depot { vals: number[]; bases: number[]; net: number[]; abg: number[]; kvInline: number[]; own: number; ownReal: number; members: Fund[] }
  const depot = (f: Fund): Depot => {
    if (!f.safe) return { vals: f.vals, bases: f.bases, net: f.net, abg: f.abg, kvInline: f.kvInline, own: f.own, ownReal: f.ownReal, members: [f] };
    const a = f, b = f.safe, sum = (x: number[], y: number[]) => x.map((v, i) => v + y[i]);
    return { vals: sum(a.vals, b.vals), bases: sum(a.bases, b.bases), net: sum(a.net, b.net), abg: sum(a.abg, b.abg), kvInline: sum(a.kvInline, b.kvInline), own: a.own + b.own, ownReal: a.ownReal + b.ownReal, members: [a, b] };
  };
  /** Verkauf aller Fonds der Liste zum Zeitpunkt idx mit einem Sparer-Pauschbetrag; Gewinne je Teilfreistellung. */
  /** own: eigener Haushalt (Rentenbeginn), sonst Erben (Grundtarif, eigener Pauschbetrag). */
  const liquidation = (fs: readonly Fund[], idx: number, income: number, own: boolean, X = 0, free = own ? allowance(idx) : heirAllowance(idx), otherCapital = 0) => {
    let value = 0, gain = 0;
    for (const f of fs) {
      const pending = F.nextVP ? f.pendingAt[idx] : 0;
      value += f.vals[idx];
      // Zugeflossene VP und Veräußerung nach voller Basisanrechnung; im selben Jahr saldiert.
      const basisAfterVP = f.bases[idx] + pending;
      gain += pending * f.tf + (f.vals[idx] - basisAfterVP) * f.tf;
    }
    const taxable = Math.max(0, gain - free);
    const flat = taxable * abg(idx);
    const base = income * I(idx) + X;
    const tariff = taxNom(base + taxable, idx, own) - taxNom(base, idx, own);
    if (!(otherCapital > 0)) return { value, tax: F.gp ? Math.min(flat, tariff) : flat };
    // Kapitalanzeige: kurze Versicherungsleistung und Fonds nehmen gemeinsam an R3 teil.
    // Nur die marginale Fondssteuer zuordnen; eine spätere Erstattung der Versicherung
    // erhöht auch hier nicht deren anfängliche Kapitalauszahlung.
    // Bei vollständiger Liquidation können Fondsverluste die kurze Versicherungsleistung
    // mindern. Erst nach dieser Saldierung bei null abschneiden (§ 20 Abs. 6 EStG).
    const jointCapital = Math.max(0, otherCapital + gain - free);
    const jointFlat = jointCapital * abg(idx), priorFlat = otherCapital * abg(idx);
    if (!F.gp) return { value, tax: jointFlat - priorFlat };
    const priorTariff = taxNom(base + otherCapital, idx, own) - taxNom(base, idx, own);
    const priorTax = Math.min(priorFlat, priorTariff);
    const jointTariff = taxNom(base + jointCapital, idx, own) - taxNom(base, idx, own);
    return { value, tax: Math.min(jointFlat, jointTariff) - priorTax };
  };
  const sellFunds = (fs: readonly Fund[], idx: number, income = p.incHeir, own = false) => {
    if (F.gp || F.nextVP || p.indexAllowance) {
      const l = liquidation(fs, idx, income, own); return l.value - l.tax;
    }
    const spb = own ? allowance(idx) : 1000; // ohne indexAllowance: SPB abzüglich allowanceUsed
    if (fs.length === 1) { const V = fs[0].vals[idx], B = fs[0].bases[idx], tf = fs[0].tf; return V - Math.max(0, (V - B) * tf - spb) * abg(idx); }
    let V = 0, G = 0, X = 0, mixed = false;
    for (const f of fs) { const g = f.vals[idx] - f.bases[idx]; V += f.vals[idx]; G += g; X += g * f.tf; if (f.tf !== 0.7) mixed = true; }
    return V - Math.max(0, (mixed ? X : G * 0.7) - spb) * abg(idx); // nur Aktienfonds: wie bisher G · 0,7
  };
  const sellNet = (d: Depot, idx: number) => sellFunds(d.members, idx);

  // ---------- 5) Teile wie in model() zusammensetzen (Netto vor dem gemeinsamen KV-Buch) ----------
  const parts: ComboResult['parts'] = {};
  const fundNote = 'Nach Steuer bei Verkauf. Behalten die Erben, übernehmen sie den Gewinn steuerlich.';
  const fundNoteSpouse = 'Nach Steuer bei Verkauf im Todesjahr, gemeinsam veranlagt (Splitting, gemeinsamer Sparer-Pauschbetrag). Behält der Partner das Depot, übernimmt er den Gewinn steuerlich.';
  const fundPart = (k: ProductKey, f: Depot): ComboPart => ({
    key: k, vals: f.vals, net: f.net, own: f.own, ownReal: f.ownReal, capR: f.vals[n], capNet: sellFunds(f.members, n, p.incRet, true), cost: 0,
    foerder: 0, foerderReal: 0, payEnd: p.H, lumpNet: 0, incTax: zero(), abgTax: f.abg, kv: f.kvInline, taxBase: zero(),
    heir: idx => ({ val: sellNet(f, idx), note: fundNote }),
    // Verheiratet: erbt der Partner, ist das Todesjahr noch gemeinsam veranlagt (Splitting, gemeinsamer Pauschbetrag).
    ...(spouseHeir ? { heirMarried: (idx: number) => ({ val: sellFunds(f.members, idx, 0, true), note: fundNoteSpouse }) } : {}),
  });
  const dEtf = fEtf && depot(fEtf), dFond = fFond && depot(fFond), dSide = fSide && depot(fSide), dIns = fIns && depot(fIns);
  if (dEtf) parts.etf = fundPart('etf', dEtf);
  if (dFond) parts.fond = fundPart('fond', dFond);
  if (avd && dSide) {
    const side = dSide;
    const aNet = zero(), aKv = side.kvInline;
    for (let t = 0; t < T; t++) {
      if (!avd.paying[t]) continue;
      const kvL = t === n ? kvLa : 0;
      if (F.kvShared) aNet[t] = avd.cash[t] - (taxAvd[t] + kvL);
      else { const k = kvAdd(avd.kvW[t], t); aNet[t] = avd.cash[t] - (taxAvd[t] + k + kvL); aKv[t] += k; kv[t] += k; }
      aKv[t] += kvL;
    }
    const owedLeft = side.members.reduce((s, f) => s + f.owed, 0);
    if (owedLeft > 0) aNet[n] -= owedLeft;
    // Verheiratet: Beim Übertrag auf den Partner versteuert dieser später mit seinem eigenen Einkommen im Alter (Grundtarif).
    const latentTax = (V: number, t: number, survivor = false) => {
      const yrs = Math.max(1, tEnd - Math.max(t, n));
      return yrs * (survivor && p.married ? taxAdd(p.incSpouseRet, V / yrs, t, false) : taxAdd(p.incRet, V / yrs, t));
    };
    const Vu = avd.valsU[n], gU = Math.max(0, Vu - avd.ownU) * (n >= 12 ? 0.5 : 1); // Anschaffungskosten bei n = Summe der Beiträge
    parts.avd = {
      key: 'avd', vals: avd.vals.map((v, i) => (v + avd.valsU[i]) + side.vals[i]), net: aNet.map((v, i) => v + side.net[i]),
      own: (avd.own + avd.ownU) + side.own, ownReal: (avd.ownReal + avd.ownUReal) + side.ownReal, sideOwn: side.own, sideOwnReal: side.ownReal,
      ...(F.unsub ? { unsubOwn: avd.ownU, unsubOwnReal: avd.ownUReal } : {}),
      capR: (avd.vals[n] + Vu) + side.vals[n], capAVD: avd.vals[n] + Vu, sideR: side.vals[n],
      capNet: (avd.vals[n] + Vu) - latentTax(avd.vals[n] + gU, n) + sellFunds(side.members, n, p.incRet, true),
      zul: avd.zul, zulReal: avd.zulReal, ref: avd.ref, refReal: avd.refReal, ...(avd.zulSpouse > 0 ? { zulSpouse: avd.zulSpouse } : {}),
      foerder: avd.zul + avd.ref, foerderReal: avd.zulReal + avd.refReal, cost: 0, payEnd: p.H, noElig: avd.noElig, lumpNet,
      incTax: taxAvd, abgTax: side.abg, kv: aKv, taxBase: avd.tb,
      heir: () => ({ val: 0, note: '' }),
    };
    // Erbfall wie in model() (Formeln und Reihenfolge der Operationen identisch, I1).
    const a = avd, gainU = (idx: number, half: boolean) => Math.max(0, a.valsU[idx] - a.basesU[idx]) * (half ? 0.5 : 1);
    const unsubNote = (idx: number, tx: number) => a.valsU[idx] > 0 ? '; ungeförderter Teil ' + eur(Rn(a.valsU[idx], idx)) + ' ohne Förderrückzahlung, Steuer der Erben auf dessen Gewinn ca. ' + eur(Rn(tx, idx)) : '';
    parts.avd.heirMarried = idx => {
      const V = a.vals[idx], lt = latentTax(V, idx, true);
      const halbU = p.heirHalf && idx >= 12, txU = spouseHeir ? taxAdd(0, gainU(idx, halbU), idx, true) : taxAdd(p.incHeir, gainU(idx, halbU), idx, false);
      const sideNet = spouseHeir ? sellFunds(side.members, idx, 0, true) : sellNet(side, idx);
      return { val: V - lt + (a.valsU[idx] - txU) + sideNet, note: 'Ohne Abzug auf einen eigenen AVD-Vertrag übertragbar, später aber voll steuerpflichtig (ca. ' + eur(Rn(lt, idx)) + ' Einkommensteuer, grob geschätzt und abgezogen)' + unsubNote(idx, txU) };
    };
    parts.avd.heir = idx => {
      const V = a.vals[idx], age = p.a0 + idx, C0 = a.vals[n];
      let back: number, ownR: number, zulR: number;
      if (idx <= n) { back = a.foer[idx]; ownR = a.owns[idx]; zulR = a.zuls[idx]; }
      else { const f = C0 > 0 ? V / C0 : 0; back = (a.zul + a.refBack) * f; ownR = a.owns[n] * f; zulR = a.zul * f; }
      const halb = F.heir ? p.heirHalf && idx >= 12 : p.heirHalf && age >= 62 && idx >= 12;
      const rest = Math.max(0, V - back), gain = Math.max(0, V - ownR - zulR) * (halb ? 0.5 : 1);
      const incDeath = F.heir ? p.incHeir : idx < n ? incAt(idx) : p.incRet;
      const tx = taxAdd(incDeath, gain + gainU(idx, halb), idx, !F.heir);
      return { val: (rest + a.valsU[idx]) - tx + sellNet(side, idx), note: 'Förderung ' + eur(Rn(back, idx)) + ' zurück, ' + (F.heir ? 'Steuer der Erben auf Erträge ' : 'Steuer auf Erträge ') + eur(Rn(tx, idx)) + (halb ? ' (hälftig)' : '') + (a.valsU[idx] > 0 ? '; darin der ungeförderte Teil ' + eur(Rn(a.valsU[idx], idx)) + ' ohne Förderrückzahlung' : '') };
    };
  }
  if (ins) {
    const base = {
      key: 'ins' as const, own: ins.own, ownReal: ins.ownReal, capR: ins.C, capNet: ins.C - kapTax, kapNet, foerder: 0, foerderReal: 0,
      cost: 0, annual: ins.annual, lump: p.insLump, lumpNet: 0, incTax: taxIns, taxBase: xIns,
    };
    if (p.insLump && dIns) {
      const f = dIns, iKv = f.kvInline;
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
        heir: idx => idx <= n ? insDeath(idx)
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
          if (idx <= n) return insDeath(idx);
          const rest = Math.max(0, p.R + p.gz - (p.a0 + idx));
          // Restrenten der Garantiezeit einzeln versteuert; Fix heirTax (E2): mit dem Einkommen der Erben.
          const heirNet = (t: number) => F.heir ? annual - taxAdd(p.incHeir, annual * ea, t, false) : annualNet(t);
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
  // R1: zusätzliche selbst getragene Basis-KV/PV als Sonderausgaben (§ 10 Abs. 1 Nr. 3 EStG).
  // incRet ist das sonstige zvE vor diesen zusätzlichen Beiträgen. Entlastung im Steuerjahr verfügbar,
  // nicht wiederangelegt; negativ ausgewiesene Einkommensteuer ist eine Entlastung auf die übrige Rente.
  if (F.kvDeduct && p.kvOn) for (let t = n; t < T; t++) {
    if (!(kv[t] > 0)) continue;
    const X = list.reduce((s, r) => s + r.taxBase[t], 0), base = p.incRet * I(t);
    const relief = F.round || fam || estAddAt(t) !== 0
      ? taxNom(base + X, t) - taxNom(Math.max(0, base + X - kv[t]), t)
      : (tax(p.incRet + X / I(t)) - tax(Math.max(0, p.incRet + (X - kv[t]) / I(t)))) * I(t);
    incTax[t] -= relief;
    for (const r of list) {
      const share = relief * (r.kv[t] / kv[t]);
      r.incTax[t] -= share; r.net[t] += share;
    }
    // Die Teilauszahlung separat mit ihrer marginalen Steuer nach KV-Abzug ausweisen.
    if (t === n && avd && avd.L[n] + avd.Lu[n] > 0) {
      const L = avd.L[n] + avd.Lu[n], xL = avd.tb[n] - (avd.W[n] + avd.xW[n]);
      const income = base + X - kv[t];
      lumpNet = L - (taxNom(Math.max(0, income), t) - taxNom(Math.max(0, income - xL + kvLa), t)) - kvLa;
      parts.avd!.lumpNet = lumpNet;
    }
  }
  // R3: Jahresantrag für ALLE modellierten Abgeltungserträge. Quellensteuer/Steuerverkäufe
  // bleiben erhalten; Erstattung als Cash im selben Jahr, ohne Wiederanlage (auch beim Ansparen).
  const capitalWithheld = F.gp ? abgTax.slice() : [];
  if (F.gp) for (let t = 0; t < T; t++) {
    const paid = abgTax[t];
    if (!(paid > 0)) continue;
    const K = paid / abg(t);
    const base = (t < n ? incAt(t) : p.incRet) * I(t);
    const X = list.reduce((s, r) => s + r.taxBase[t], 0);
    const income = base + X - (F.kvDeduct && t >= n ? kv[t] : 0);
    const liability = (x: number) => t < n
      ? avdLiability(x, saDed[t], saZ[t], t)
      : taxNom(Math.max(0, x), t);
    const refund = Math.max(0, paid - (liability(income + K) - liability(income)));
    for (const r of list) {
      const share = refund * (r.abgTax[t] / paid);
      r.abgTax[t] -= share; r.net[t] += share;
    }
    abgTax[t] -= refund;
  }
  if (F.gp && avd && avd.L[n] + avd.Lu[n] > 0) {
    const L = avd.L[n] + avd.Lu[n], xL = avd.tb[n] - (avd.W[n] + avd.xW[n]);
    const income = p.incRet * I(n) + list.reduce((s, r) => s + r.taxBase[n], 0) - (F.kvDeduct ? kv[n] : 0);
    const paid = capitalWithheld[n], K = abg(n) > 0 ? paid / abg(n) : 0; // 0 %: nichts einbehalten, min(paid, …) = 0
    const totalTax = (x: number) => taxNom(Math.max(0, x), n) + Math.min(paid,
      taxNom(Math.max(0, x + K), n) - taxNom(Math.max(0, x), n));
    lumpNet = L - (totalTax(income) - totalTax(income - xL + (F.kvDeduct ? kvLa : 0))) - kvLa;
    parts.avd!.lumpNet = lumpNet;
  }
  const net = list.length ? list[0].net.slice() : zero();
  for (let i = 1; i < list.length; i++) { const x = list[i].net; for (let t = 0; t < T; t++) net[t] += x[t]; }
  const sum = (f: (r: ComboPart) => number) => list.reduce((a, r) => a + f(r), 0);
  // Kapital nach Steuern gesamt: Fonds bei Rentenbeginn gemeinsam verkauft (ein Pauschbetrag)
  const capDepots = [dEtf, dFond, dSide].filter((d): d is Depot => !!d);
  let capNet = sum(r => r.capNet);
  if (capDepots.length > 1 || (F.insAllowance && ins && capDepots.length > 0)) {
    const fs = capDepots.flatMap(d => d.members);
    const otherCapital = ins && !ins.halb ? Math.max(0, capitalInsGain - capitalInsFree) : 0;
    const l = liquidation(fs, n, p.incRet, true, capitalInsIncome, Math.max(0, allowance(n) - capitalInsFree), otherCapital);
    const joint = F.insAllowance ? l.value - l.tax : sellFunds(fs, n, p.incRet, true);
    capNet += joint - capDepots.reduce((a, d) => a + sellFunds(d.members, n, p.incRet, true), 0);
  }
  // ---------- 8) Erbfall gemeinsam (docs/kombi-modus.md, Abschnitt „Erbfall“) ----------
  // Tod zu Beginn von Jahr idx; die Erben (eine Person, Einkommen p.incHeir) bekommen alles im selben Jahr.
  //  - Einkommensteuer der Erben im Jahr idx in EINEM Tarif: AVD-Erträge bei schädlicher Verwendung (§ 22 Nr. 5 S. 3,
  //    § 93 Abs. 1 S. 2 EStG; BMF 05.10.2023 Rn. 229 f.), Gewinn des ungeförderten AVD-Teils (§ 22 Nr. 5 S. 2 c) und der
  //    Ertragsanteil der ersten Restrente der Versicherung (§ 22 Nr. 1 S. 3 a bb). Spätere Restrenten wie im Einzelfall.
  //  - Depots (ETF, aktiver Fonds, AVD-Nebendepot, ETF aus der Kapitalauszahlung): Die Erben übernehmen die
  //    Anschaffungskosten (§ 20 Abs. 4 S. 6 EStG, § 19 Abs. 1 InvStG); gerechnet als gemeinsamer Verkauf im Jahr idx mit
  //    EINEM Sparer-Pauschbetrag (§ 20 Abs. 9 EStG), Gewinne und Verluste verrechnet.
  //  - Versicherung vor Rentenbeginn: Todesfallleistung einkommensteuerfrei (§ 20 Abs. 1 Nr. 6 erfasst nur Erlebensfall
  //    und Rückkauf).
  // Ehepartner: gefördertes AVD-Vermögen ohne Rückzahlung auf dessen Vertrag (§ 93 Abs. 1 S. 4 c), spätere Steuer grob
  // geschätzt (latentTax wie im Einzelfall), der Rest wie oben.
  // Ohne Fix heirTax (Original: Steuer mit dem Einkommen der verstorbenen Person) gibt es keine gemeinsame Steuer der
  // Erben; dann ist der Erbwert die Summe der Teile, jeder für sich versteuert.
  const latentTaxO = (V: number, t: number) => {
    const yrs = Math.max(1, tEnd - Math.max(t, n));
    return yrs * (p.married ? taxAdd(p.incSpouseRet, V / yrs, t, false) : taxAdd(p.incRet, V / yrs, t));
  };
  const heirJoint = (idx: number, married: boolean, only?: ProductKey): HeirValue => {
    if (!F.heir) {
      let v = 0; for (const r of list) v += (married && r.heirMarried ? r.heirMarried : r.heir)(idx).val;
      return { val: v, note: 'Teile einzeln versteuert' };
    }
    const sp = married && spouseHeir; // Partner erbt und war mit der Person zusammen veranlagt
    let gross = 0, X = 0, back = 0, lt = 0, halbAvd = false, rentYears = 0, insMinUsed = false;
    const bits: string[] = [];
    if (avd && (!only || only === 'avd')) {
      const a = avd, V = a.vals[idx], C0 = a.vals[n];
      const gU = (half: boolean) => Math.max(0, a.valsU[idx] - a.basesU[idx]) * (half ? 0.5 : 1);
      halbAvd = p.heirHalf && idx >= 12;
      if (married) { lt = latentTaxO(V, idx); gross += V - lt + a.valsU[idx]; X += gU(halbAvd); }
      else {
        let ownR: number, zulR: number;
        if (idx <= n) { back = a.foer[idx]; ownR = a.owns[idx]; zulR = a.zuls[idx]; }
        else { const f = C0 > 0 ? V / C0 : 0; back = (a.zul + a.refBack) * f; ownR = a.owns[n] * f; zulR = a.zul * f; }
        gross += Math.max(0, V - back) + a.valsU[idx];
        X += Math.max(0, V - ownR - zulR) * (halbAvd ? 0.5 : 1) + gU(halbAvd);
      }
    }
    if (ins && (!only || only === 'ins')) {
      if (idx <= n) { const d = insDeath(idx); insMinUsed = d.min; gross += d.val; }
      else if (!p.insLump) {
        rentYears = Math.max(0, p.R + p.gz - (p.a0 + idx));
        const { annual, ea } = ins;
        if (rentYears > 0) { gross += annual; X += annual * ea; }
        for (let k = 1; k < rentYears; k++) {
          const t = idx + k, rent = sp ? taxAdd(t < n ? p.incSpouse : p.incSpouseRet, annual * ea, t, false) : taxAdd(p.incHeir, annual * ea, t, false);
          gross += (annual - rent) * (p.real ? I(idx) / I(t) : 1);
        }
      }
    }
    const tx = sp ? taxAdd(0, X, idx, true) : taxAdd(p.incHeir, X, idx, false);
    const depots = [dEtf, dFond, dSide, idx > n ? dIns : null].filter((d): d is Depot => !!d).flatMap(d => d.members).filter(f => !only || f.part === only);
    let V = 0, minGain = Infinity;
    for (const f of depots) { const g = f.vals[idx] - f.bases[idx]; V += f.vals[idx]; if (g < minGain) minGain = g; }
    const abg = depots.length ? (F.gp || F.nextVP || p.indexAllowance ? liquidation(depots, idx, sp ? 0 : p.incHeir, sp, X).tax : V - sellFunds(depots, idx, sp ? 0 : p.incHeir, sp)) : 0;
    const e = (x: number) => eur(Rn(x, idx));
    if (avd && (!only || only === 'avd')) bits.push(married
      ? 'AVD ohne Abzug auf einen Vertrag des Ehepartners übertragbar (spätere Einkommensteuer ca. ' + e(lt) + ', grob geschätzt und abgezogen)'
      : 'AVD-Förderung ' + e(back) + ' zurück');
    if (tx > 0 || X > 0) bits.push((sp ? 'Einkommensteuer des Partners (gemeinsam veranlagt im Todesjahr) ' : 'Einkommensteuer der Erben ') + e(tx) + ' in einem Tarif (' + [avd && (!only || only === 'avd') ? 'AVD-Erträge' + (halbAvd ? ' hälftig' : '') : '', rentYears > 0 ? 'Ertragsanteil der Restrente' : ''].filter(Boolean).join(' und ') + ')');
    if (depots.length) bits.push((F.gp ? 'Depots nach Kapitalertragsteuer/Günstigerprüfung bei Verkauf ' : 'Depots nach Abgeltungsteuer bei Verkauf ') + e(abg) + ' (ein Sparer-Pauschbetrag)');
    if (ins && (!only || only === 'ins') && idx <= n) bits.push(insMinUsed ? 'Versicherung zahlt die eingezahlten Beiträge (Mindestleistung), einkommensteuerfrei' : 'Versicherung einkommensteuerfrei');
    if (rentYears > 0) bits.push('Restrente noch ' + rentYears + ' Jahre');
    return { val: gross - tx + (V - abg), note: 'Gemeinsam versteuert: ' + bits.join('; '), detail: { incomeTax: tx, abgTax: abg, minDepotGain: minGain } };
  };

  if (F.heir && (F.gp || F.nextVP)) for (const r of list) {
    r.heir = idx => heirJoint(idx, false, r.key);
    if (r.heirMarried || spouseHeir) r.heirMarried = idx => heirJoint(idx, true, r.key); // verheiratet: jeder Teil auch mit Partner als Erben
  }
  return {
    parts, net, own: sum(r => r.own), ownReal: sum(r => r.ownReal), capR: sum(r => r.capR), capNet, cost: 0,
    foerder: sum(r => r.foerder), foerderReal: sum(r => r.foerderReal), lumpNet,
    incTax, abgTax, kv, kvClipped, T, n, tH, I,
    heir: idx => heirJoint(idx, false),
    ...(avd || spouseHeir ? { heirMarried: (idx: number) => heirJoint(idx, true) } : {}),
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
