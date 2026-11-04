// Auswertung und Szenarien: Port des Originals (legacy/index.html: analyze, scenarios) plus dokumentierte
// Korrekturen (fixes.ts, docs/abweichungen-vom-original.md); mit NO_FIXES bitgleich zum Original (Golden-Test).
// Die Szenario-Beschriftungen sind neutral formuliert (keine Rechenrelevanz).
import { eur } from '../format';
import { model, type ModelResult, type Params, type ProductKey, type ProductResult } from './engine';
import { fixesOf, type EngineOptions } from './fixes';
import { combo, comboStats, SPLIT_KEYS, type ComboResult, type Split } from './combo';

/** Ein Teilnehmer am Vergleich: eines der vier Produkte oder die Kombi (mehrere Produkte, gemeinsam gerechnet). */
export type ContenderKey = ProductKey | 'kombi';
export interface Product { key: ContenderKey; name: string; short: string; nom: string; color: string }
export type SingleProduct = Product & { key: ProductKey };

export const KOMBI: Product = { key: 'kombi', name: 'Deine Kombi', short: 'Kombi', nom: 'deine Kombi', color: 'var(--s5)' };

/** Ergebnis der Kombi im Format der Einzelprodukte (Summe der Teile); `combo` und `split` für Details. */
export interface KombiResult extends ProductResult { combo: ComboResult; split: Split }

export const PRODUCTS: readonly SingleProduct[] = [
  { key: 'etf', name: 'ETF-Depot', short: 'ETF', nom: 'das ETF-Depot', color: 'var(--s1)' },
  { key: 'avd', name: 'Altersvorsorgedepot', short: 'AVD', nom: 'das Altersvorsorgedepot', color: 'var(--s2)' },
  { key: 'ins', name: 'Fondsgeb. Rentenversicherung', short: 'Versicherung', nom: 'die Rentenversicherung', color: 'var(--s3)' },
  { key: 'fond', name: 'Aktiver Fonds', short: 'Akt. Fonds', nom: 'der aktive Fonds', color: 'var(--s4)' },
];

/**
 * cumH, cum100, avgMonthly, lump: in der Anzeige-Einheit (real oder nominal, je nach p.real).
 * cumHReal: Summe netto bis H immer in heutiger Kaufkraft; danach wird gerangelt (Fix rankReal, E1).
 * Bei p.real ist cumHReal === cumH.
 */
export interface Stats { avgMonthly: number; cumH: number; cumHReal: number; cum100: number; lump: number }

export interface Analysis extends ModelResult {
  p: Params;
  /** Einzelprodukte aus model() plus `kombi`, falls eine Kombi im Vergleich ist. */
  res: Partial<Record<ProductKey, ProductResult>> & { kombi?: KombiResult };
  R: (x: number, t: number) => number;
  active: Product[];
  stats: Partial<Record<ContenderKey, Stats>>;
  ownOf: (pr: Product) => number;
  fairOwn: boolean;
  refundSpent: boolean;
  lead: Product | null;
  canRank: boolean;
}

/**
 * Kombi als ProductResult: Werte der Teile summiert (vals: null erst, wenn kein Teil mehr einen Wert hat).
 * Kein Erbfall (docs/kombi-modus.md, Grenzen): `heir` liefert nur einen Hinweis, die Oberfläche zeigt die Kombi dort nicht.
 */
export function kombiResult(p: Params, split: Split, opts?: EngineOptions): KombiResult {
  const c = combo(p, split, { ...opts, cost: true });
  const parts = SPLIT_KEYS.map(k => c.parts[k]).filter(x => !!x);
  const vals: (number | null)[] = [];
  for (let t = 0; t < c.T; t++) {
    let v: number | null = null;
    for (const r of parts) { const x = r.vals[t]; if (x != null) v = (v ?? 0) + x; }
    vals.push(v);
  }
  const avd = c.parts.avd;
  return {
    vals, net: c.net, own: c.own, ownReal: c.ownReal, capR: c.capR, capNet: c.capNet, cost: c.cost,
    foerder: c.foerder, foerderReal: c.foerderReal, payEnd: Math.max(...parts.map(r => r.payEnd)),
    heir: () => ({ val: 0, note: 'Für die Kombi nicht gerechnet.' }),
    lumpNet: c.lumpNet, ref: avd?.ref, refReal: avd?.refReal,
    lump: c.parts.ins?.lump, lifelong: !!c.parts.ins?.lifelong,
    combo: c, split: { ...split },
  };
}

// Rechnet ein Szenario durch und leitet die Vergleichskennzahlen ab.
// `kombi`: Aufteilung einer Kombi, die als weiterer Teilnehmer mitverglichen wird (gemeinsam versteuert, combo.ts).
// Ohne Kombi ist das Ergebnis unverändert (Golden-Test).
export function analyze(p: Params, opts?: EngineOptions, kombi?: Split | null): Analysis {
  const rankReal = fixesOf(opts).has('rankReal');
  const m = model(p, opts), { T, n, tH, I } = m;
  const res: Analysis['res'] = kombi ? { ...m.res, kombi: kombiResult(p, kombi, opts) } : m.res;
  const R = (x: number, t: number) => p.real ? x / I(t) : x;
  const active: Product[] = PRODUCTS.filter(pr => res[pr.key]).map(pr => pr.key === 'ins'
    ? Object.assign({}, pr, { name: pr.name + (res.ins!.lump ? ' (Kapitalauszahlung)' : ' (Leibrente)') }) : pr);
  if (res.kombi) active.push(KOMBI);
  // Alle Produkte über denselben Zeitraum Rentenbeginn … Auszahlplan-Ende
  const stats: Analysis['stats'] = {};
  active.forEach(pr => {
    if (pr.key === 'kombi') { stats.kombi = comboStats(p, res.kombi!.combo); return; }
    const r = res[pr.key]!;
    const lump = r.lumpNet ? R(r.lumpNet, n) : 0; // 30-%-Einmalauszahlung separat, nicht in der Monatsrente
    let sumH = 0; for (let t = n; t < tH; t++) sumH += R(r.net[t], t);
    let sumHR = 0; for (let t = n; t < tH; t++) sumHR += r.net[t] / I(t);
    let cum100 = 0; for (let t = n; t < T; t++) cum100 += R(r.net[t], t);
    stats[pr.key] = { avgMonthly: (sumH - lump) / (tH - n) / 12, cumH: sumH, cumHReal: sumHR, cum100, lump };
  });
  const ownOf = (pr: Product) => p.real ? res[pr.key]!.ownReal : res[pr.key]!.own;
  // Original: Fairness und Rangfolge in der Anzeige-Einheit. Fix rankReal (E1): immer in heutiger Kaufkraft,
  // sonst entscheidet der Anzeige-Schalter (Abzinsung 0 % statt Inflation), welches Produkt vorne liegt.
  const owns = active.map(rankReal ? (pr: Product) => res[pr.key]!.ownReal : ownOf);
  const fairOwn = active.length > 0 && Math.max(...owns) <= Math.min(...owns) * 1.01 + 1;
  const refundSpent = !p.reinvest && ((res.avd?.ref ?? 0) > 0 || (res.kombi?.ref ?? 0) > 0);
  const rankBy = rankReal ? (k: ContenderKey) => stats[k]!.cumHReal : (k: ContenderKey) => stats[k]!.cumH;
  const lead = active.length > 1 && fairOwn ? active.reduce((a, b) => rankBy(b.key) > rankBy(a.key) ? b : a) : null;
  const canRank = !!lead && !refundSpent;
  return Object.assign({}, m, { p, res, R, active, stats, ownOf, fairOwn, refundSpent, lead, canRank });
}

/** Stabile Kennung je Szenario-Zeile (für Oberfläche und Kombi-Robustheit; das Label kann sich ändern). */
export type ScenarioId = 'kv' | 'avdCost' | 'refund' | 'g' | 'incWork' | 'incRetLow' | 'incRetHigh' | 'insMode' | 'insCost';

export interface ScenarioDef { id: ScenarioId; label: string; p: Params }
export interface Scenario extends ScenarioDef { a: Analysis }

// „Was die Empfehlung kippen würde“: je Zeile genau eine Annahme geändert. Reihenfolge wie im Original.
// `kombi`: Enthält die Kombi AVD oder Versicherung, kommen deren Zeilen auch ohne das Einzelprodukt dazu.
export function scenarioList(p: Params, kombi?: Split | null): ScenarioDef[] {
  const list: ScenarioDef[] = [];
  const avd = p.on.avd || (kombi?.avd ?? 0) > 0, ins = p.on.ins || (kombi?.ins ?? 0) > 0;
  const add = (id: ScenarioId, label: string, patch: Partial<Params>) => list.push({ id, label, p: Object.assign({}, p, patch) });
  add('kv', p.kvOn ? 'Als Rentner in der KVdR oder privat versichert' : 'Als Rentner freiwillig gesetzlich versichert', { kvOn: !p.kvOn });
  if (avd && p.avdCost < 0.01) add('avdCost', 'AVD kostet 1,0 % (Deckel Standarddepot)', { avdCost: 0.01 });
  if (avd && p.reinvest) add('refund', 'Steuererstattung ausgegeben statt angelegt', { reinvest: false });
  add('g', 'Rendite 2 Prozentpunkte niedriger', { g: p.g - 0.02, gPay: p.gPay - 0.02 });
  add('incWork', 'Gehalt 30 % niedriger (' + eur(p.incWork * 0.7) + ')', { incWork: p.incWork * 0.7 });
  if (p.incRet >= 15000) add('incRetLow', 'Einkommen im Alter ' + eur(p.incRet - 15000) + ' statt ' + eur(p.incRet), { incRet: p.incRet - 15000 });
  add('incRetHigh', 'Einkommen im Alter ' + eur(p.incRet + 20000) + ' statt ' + eur(p.incRet), { incRet: p.incRet + 20000 });
  if (ins) add('insMode', p.insLump ? 'Versicherung als lebenslange Rente' : 'Versicherung mit Kapitalauszahlung', { insLump: !p.insLump });
  if (ins && p.insEff < 0.015) add('insCost', 'Versicherung mit 1,5 % Kosten (typisch für Provisionstarife)', { insEff: 0.015 });
  return list;
}

export function scenarios(p: Params, opts?: EngineOptions, kombi?: Split | null): Scenario[] {
  return scenarioList(p, kombi).map(s => Object.assign(s, { a: analyze(s.p, opts, kombi) }));
}
