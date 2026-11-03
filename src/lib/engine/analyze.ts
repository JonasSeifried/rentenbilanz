// Auswertung und Szenarien: Port des Originals (legacy/index.html: analyze, scenarios) plus dokumentierte
// Korrekturen (fixes.ts, docs/abweichungen-vom-original.md); mit NO_FIXES bitgleich zum Original (Golden-Test).
// Die Szenario-Beschriftungen sind neutral formuliert (keine Rechenrelevanz).
import { eur } from '../format';
import { model, type ModelResult, type Params, type ProductKey } from './engine';
import { fixesOf, type EngineOptions } from './fixes';

export interface Product { key: ProductKey; name: string; short: string; nom: string; color: string }

export const PRODUCTS: readonly Product[] = [
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
  R: (x: number, t: number) => number;
  active: Product[];
  stats: Partial<Record<ProductKey, Stats>>;
  ownOf: (pr: Product) => number;
  fairOwn: boolean;
  refundSpent: boolean;
  lead: Product | null;
  canRank: boolean;
}

// Rechnet ein Szenario durch und leitet die Vergleichskennzahlen ab.
export function analyze(p: Params, opts?: EngineOptions): Analysis {
  const rankReal = fixesOf(opts).has('rankReal');
  const m = model(p, opts), { res, T, n, tH, I } = m;
  const R = (x: number, t: number) => p.real ? x / I(t) : x;
  const active = PRODUCTS.filter(pr => res[pr.key]).map(pr => pr.key === 'ins'
    ? Object.assign({}, pr, { name: pr.name + (res.ins!.lump ? ' (Kapitalauszahlung)' : ' (Leibrente)') }) : pr);
  // Alle Produkte über denselben Zeitraum Rentenbeginn … Auszahlplan-Ende
  const stats: Analysis['stats'] = {};
  active.forEach(pr => {
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
  const refundSpent = !!(res.avd && !p.reinvest && res.avd.ref! > 0);
  const rankBy = rankReal ? (k: ProductKey) => stats[k]!.cumHReal : (k: ProductKey) => stats[k]!.cumH;
  const lead = active.length > 1 && fairOwn ? active.reduce((a, b) => rankBy(b.key) > rankBy(a.key) ? b : a) : null;
  const canRank = !!lead && !refundSpent;
  return Object.assign({}, m, { p, R, active, stats, ownOf, fairOwn, refundSpent, lead, canRank });
}

/** Stabile Kennung je Szenario-Zeile (für Oberfläche und Kombi-Robustheit; das Label kann sich ändern). */
export type ScenarioId = 'kv' | 'avdCost' | 'refund' | 'g' | 'incWork' | 'incRetLow' | 'incRetHigh' | 'insMode' | 'insCost';

export interface ScenarioDef { id: ScenarioId; label: string; p: Params }
export interface Scenario extends ScenarioDef { a: Analysis }

// „Was die Empfehlung kippen würde“: je Zeile genau eine Annahme geändert. Reihenfolge wie im Original.
export function scenarioList(p: Params): ScenarioDef[] {
  const list: ScenarioDef[] = [];
  const add = (id: ScenarioId, label: string, patch: Partial<Params>) => list.push({ id, label, p: Object.assign({}, p, patch) });
  add('kv', p.kvOn ? 'Als Rentner in der KVdR oder privat versichert' : 'Als Rentner freiwillig gesetzlich versichert', { kvOn: !p.kvOn });
  if (p.on.avd && p.avdCost < 0.01) add('avdCost', 'AVD kostet 1,0 % (Deckel Standarddepot)', { avdCost: 0.01 });
  if (p.on.avd && p.reinvest) add('refund', 'Steuererstattung ausgegeben statt angelegt', { reinvest: false });
  add('g', 'Rendite 2 Prozentpunkte niedriger', { g: p.g - 0.02, gPay: p.gPay - 0.02 });
  add('incWork', 'Gehalt 30 % niedriger (' + eur(p.incWork * 0.7) + ')', { incWork: p.incWork * 0.7 });
  if (p.incRet >= 15000) add('incRetLow', 'Einkommen im Alter ' + eur(p.incRet - 15000) + ' statt ' + eur(p.incRet), { incRet: p.incRet - 15000 });
  add('incRetHigh', 'Einkommen im Alter ' + eur(p.incRet + 20000) + ' statt ' + eur(p.incRet), { incRet: p.incRet + 20000 });
  if (p.on.ins) add('insMode', p.insLump ? 'Versicherung als lebenslange Rente' : 'Versicherung mit Kapitalauszahlung', { insLump: !p.insLump });
  if (p.on.ins && p.insEff < 0.015) add('insCost', 'Versicherung mit 1,5 % Kosten (typisch für Provisionstarife)', { insEff: 0.015 });
  return list;
}

export function scenarios(p: Params, opts?: EngineOptions): Scenario[] {
  return scenarioList(p).map(s => Object.assign(s, { a: analyze(s.p, opts) }));
}
