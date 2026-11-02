// Auswertung und Szenarien, 1:1 aus legacy/index.html (analyze, scenarios). Logik unverändert,
// nur die Szenario-Beschriftungen sind neutral formuliert (keine Rechenrelevanz).
import { eur } from '../format';
import { model, type ModelResult, type Params, type ProductKey } from './engine';

export interface Product { key: ProductKey; name: string; short: string; nom: string; color: string }

export const PRODUCTS: readonly Product[] = [
  { key: 'etf', name: 'ETF-Depot', short: 'ETF', nom: 'das ETF-Depot', color: 'var(--s1)' },
  { key: 'avd', name: 'Altersvorsorgedepot', short: 'AVD', nom: 'das Altersvorsorgedepot', color: 'var(--s2)' },
  { key: 'ins', name: 'Fondsgeb. Rentenversicherung', short: 'Versicherung', nom: 'die Rentenversicherung', color: 'var(--s3)' },
  { key: 'fond', name: 'Aktiver Fonds', short: 'Akt. Fonds', nom: 'der aktive Fonds', color: 'var(--s4)' },
];

export interface Stats { avgMonthly: number; cumH: number; cum100: number; lump: number }

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
export function analyze(p: Params): Analysis {
  const m = model(p), { res, T, n, tH, I } = m;
  const R = (x: number, t: number) => p.real ? x / I(t) : x;
  const active = PRODUCTS.filter(pr => res[pr.key]).map(pr => pr.key === 'ins'
    ? Object.assign({}, pr, { name: pr.name + (res.ins!.lump ? ' (Kapitalauszahlung)' : ' (Leibrente)') }) : pr);
  // Alle Produkte über denselben Zeitraum Rentenbeginn … Auszahlplan-Ende
  const stats: Analysis['stats'] = {};
  active.forEach(pr => {
    const r = res[pr.key]!;
    const lump = r.lumpNet ? R(r.lumpNet, n) : 0; // 30-%-Einmalauszahlung separat, nicht in der Monatsrente
    let sumH = 0; for (let t = n; t < tH; t++) sumH += R(r.net[t], t);
    let cum100 = 0; for (let t = n; t < T; t++) cum100 += R(r.net[t], t);
    stats[pr.key] = { avgMonthly: (sumH - lump) / (tH - n) / 12, cumH: sumH, cum100, lump };
  });
  const ownOf = (pr: Product) => p.real ? res[pr.key]!.ownReal : res[pr.key]!.own;
  const owns = active.map(ownOf);
  const fairOwn = active.length > 0 && Math.max(...owns) <= Math.min(...owns) * 1.01 + 1;
  const refundSpent = !!(res.avd && !p.reinvest && res.avd.ref! > 0);
  const lead = active.length > 1 && fairOwn ? active.reduce((a, b) => stats[b.key]!.cumH > stats[a.key]!.cumH ? b : a) : null;
  const canRank = !!lead && !refundSpent;
  return Object.assign({}, m, { p, R, active, stats, ownOf, fairOwn, refundSpent, lead, canRank });
}

export interface Scenario { label: string; p: Params; a: Analysis }

// „Was die Empfehlung kippen würde“: je Zeile genau eine Annahme geändert
export function scenarios(p: Params): Scenario[] {
  const list: { label: string; p: Params }[] = [];
  const add = (label: string, patch: Partial<Params>) => list.push({ label, p: Object.assign({}, p, patch) });
  add(p.kvOn ? 'Als Rentner in der KVdR oder privat versichert' : 'Als Rentner freiwillig gesetzlich versichert', { kvOn: !p.kvOn });
  if (p.on.avd && p.avdCost < 0.01) add('AVD kostet 1,0 % (Deckel Standarddepot)', { avdCost: 0.01 });
  if (p.on.avd && p.reinvest) add('Steuererstattung ausgegeben statt angelegt (dafür vorher mehr Geld zur Verfügung)', { reinvest: false });
  add('Rendite 2 Prozentpunkte niedriger', { g: p.g - 0.02, gPay: p.gPay - 0.02 });
  add('Gehalt 30 % niedriger (' + eur(p.incWork * 0.7) + ')', { incWork: p.incWork * 0.7 });
  if (p.incRet >= 15000) add('Einkommen im Alter ' + eur(p.incRet - 15000) + ' statt ' + eur(p.incRet), { incRet: p.incRet - 15000 });
  add('Einkommen im Alter ' + eur(p.incRet + 20000) + ' statt ' + eur(p.incRet), { incRet: p.incRet + 20000 });
  if (p.on.ins) add(p.insLump ? 'Versicherung als lebenslange Rente' : 'Versicherung mit Kapitalauszahlung', { insLump: !p.insLump });
  if (p.on.ins && p.insEff < 0.015) add('Versicherung mit 1,5 % Kosten (typisch für Provisionstarife)', { insEff: 0.015 });
  return list.map(s => Object.assign(s, { a: analyze(s.p) }));
}
