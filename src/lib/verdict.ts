// Ergebnis als Sätze, neutral: Der Rechner sagt nicht, welches Produkt das beste ist (Entscheidung des Betreibers,
// November 2026). Gezeigt werden Beträge in fester Produktreihenfolge, Abstände in € und % und die Annahmen, an denen
// sie hängen (z. B. der Kosten-Gleichstand, engine/breakEven.ts).
// - Abstände immer in heutiger Kaufkraft (`cumHReal`, Befund E1). Im Nominalmodus steht „(in heutiger Kaufkraft)“
//   dabei, weil die nominalen Summen in knappen Fällen andersherum liegen können.
// - Das Szenario „Steuererstattung ausgegeben“ zählt nicht für die Robustheit (dort gibt es keinen fairen Vergleich, U6).
// - Robustheit: In wie vielen Szenarien kehrt sich mindestens ein Abstand zwischen zwei Produkten um?
import type { Analysis, ContenderKey, Product, Scenario } from './engine/analyze';
import type { BreakEven } from './engine/breakEven';
import { eur, eurRound } from './format';
import { splitText } from './comboVerdict';

export type VerdictKind = 'ok' | 'needTwo' | 'unequal' | 'refundSpent';
/** 0 = kein Abstand kehrt sich um, 1 = in weniger als einem Drittel der Szenarien, 2 = in mindestens einem Drittel */
export type Robustness = 0 | 1 | 2;
export interface Verdict {
  kind: VerdictKind;
  headline: string;
  lines: string[];
  /** Kurzfassung für die mobile Ergebnisleiste (nur bei `ok`). */
  peek?: string;
  /** Nur bei `ok`: in wie vielen der vergleichbaren Szenarien sich mindestens ein Abstand umkehrt. */
  robust?: { level: Robustness; flips: number; total: number; example?: string };
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const KOMBI_OF = (A: Analysis) => A.active.find(pr => pr.key === 'kombi')!;
const AVD_OF = (A: Analysis) => A.active.find(pr => pr.key === 'avd')!;

/** Szenarien, die für die Robustheit zählen: ohne „Steuererstattung ausgegeben“ (dort ist kein fairer Vergleich möglich). */
export function comparableScenarios(scen: Scenario[]): Scenario[] {
  return scen.filter(s => s.id !== 'refund' && !s.a.refundSpent);
}

/** Abstand, unter dem zwei Teilnehmer als gleichauf gelten (Summe bis H, heutige Kaufkraft); wie TIE_EUR der Kombi-Suche. */
export const TIE_EUR = 1;

/**
 * Kehrt sich im Szenario `s` mindestens ein Abstand der Ausgangslage `base` um? Gezählt werden nur Paare, die in beiden
 * Rechnungen mehr als TIE_EUR auseinanderliegen (Summe bis H, heutige Kaufkraft). Ohne fairen Vergleich: nein.
 */
export function isFlip(base: Analysis, s: Analysis): boolean {
  if (!base.canRank || !s.canRank) return false;
  const ks = base.active.map(pr => pr.key).filter(k => !!s.stats[k]);
  const d = (a: Analysis, x: ContenderKey, y: ContenderKey) => a.stats[x]!.cumHReal - a.stats[y]!.cumHReal;
  for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) {
    const d0 = d(base, ks[i], ks[j]), d1 = d(s, ks[i], ks[j]);
    if (Math.abs(d0) > TIE_EUR && Math.abs(d1) > TIE_EUR && (d0 > 0) !== (d1 > 0)) return true;
  }
  return false;
}

export function robustness(flips: number, total: number): Robustness {
  if (flips <= 0 || total <= 0) return 0;
  return flips * 3 >= total ? 2 : 1;
}

// ---------------------------------------------------------------- Anzeigenamen

/** Name in Kacheln (kurz, ohne Auszahlungsart). */
export function tileName(pr: Product): string {
  return pr.key === 'ins' ? 'Rentenversicherung' : pr.name;
}
/** Zweite Zeile in der Kachel (nur Versicherung). */
export function tileSub(A: Analysis, pr: Product): string {
  if (pr.key === 'kombi') return A.res.kombi ? splitText(A.res.kombi.split, 'short') : '';
  if (pr.key !== 'ins' || !A.res.ins) return '';
  return 'fondsgebunden · ' + (A.res.ins.lump ? 'Kapitalauszahlung' : 'lebenslange Rente');
}
/** Name in Legenden und Tabellen: „Rentenversicherung (Kapital)“ statt des langen Produktnamens. */
export function legendName(A: Analysis, pr: Product): string {
  if (pr.key !== 'ins' || !A.res.ins) return pr.name;
  return 'Rentenversicherung (' + (A.res.ins.lump ? 'Kapital' : 'Leibrente') + ')';
}

// ---------------------------------------------------------------- Ergebnis

/** Anteil als „14 %“; unter 10 % mit einer Nachkommastelle. */
function pctOf(x: number): string {
  const v = Math.abs(x * 100);
  return v.toLocaleString('de-DE', { maximumFractionDigits: v < 10 ? 1 : 0 }) + ' %';
}

/**
 * Satz zum Abstand zweier Teilnehmer: „Das Altersvorsorgedepot zahlt bis zum Alter von 90 zusammen rund 21.600 € (14 %)
 * mehr aus als das ETF-Depot.“ Prozent bezogen auf `ref`. Bei weniger als TIE_EUR: „praktisch gleich viel“.
 */
export function gapText(A: Analysis, x: Product, ref: Product): string {
  const { p, stats } = A;
  const a = stats[x.key]!.cumHReal, b = stats[ref.key]!.cumHReal, d = a - b;
  const kk = p.real ? '' : ' (in heutiger Kaufkraft)';
  if (Math.abs(d) <= TIE_EUR) return cap(x.nom) + ' und ' + ref.nom + ' zahlen bis zum Alter von ' + p.H + ' praktisch gleich viel aus (weniger als ' + eur(TIE_EUR) + ' Unterschied' + kk + ').';
  const rel = b > 0 ? ' (' + pctOf(d / b) + ')' : '';
  return cap(x.nom) + ' zahlt bis zum Alter von ' + p.H + ' zusammen rund ' + eurRound(Math.abs(d)) + rel + (d > 0 ? ' mehr' : ' weniger') + ' aus als ' + ref.nom + kk + '.';
}

export function verdict(A: Analysis, _scen: Scenario[]): Verdict {
  const { p, active, stats, res } = A;
  if (active.length < 2) return { kind: 'needTwo', headline: 'Für einen Vergleich mindestens ein weiteres Produkt dazunehmen.', lines: [] };
  if (!A.fairOwn) return {
    kind: 'unequal',
    headline: 'Die Monatsbeiträge sind nicht bei allen Produkten gleich.',
    lines: ['So lässt sich kein fairer Vergleich ziehen, weil nicht überall gleich viel eigenes Geld hineinfließt.'],
  };
  if (A.refundSpent) return {
    kind: 'refundSpent',
    headline: 'Mit ausgegebener Steuererstattung ist kein fairer Vergleich möglich.',
    lines: ['Beim Altersvorsorgedepot fließt dann netto weniger eigenes Geld hinein als bei den anderen Produkten. Wird die Erstattung angelegt, ist der Vergleich wieder fair.'],
  };
  const range = p.R + '–' + p.H;
  // Feste Reihenfolge (PRODUCTS, dann Kombi), nicht nach Ergebnis sortiert.
  const headline = 'Ø netto im Monat (' + range + '): ' + active.map(pr => tileName(pr) + ' ' + eur(stats[pr.key]!.avgMonthly)).join(', ') + '.';
  const peek = 'Ø netto/Monat: ' + active.map(pr => pr.short + ' ' + eur(stats[pr.key]!.avgMonthly)).join(' · ');

  // Abstände zum ersten Teilnehmer der festen Reihenfolge (meist das ETF-Depot als einfachste Vergleichsgröße).
  const ref = active[0];
  const lines = active.slice(1).map(pr => gapText(A, pr, ref));
  const avdKombiTie = !!stats.avd && !!stats.kombi && ref.key !== 'avd' && Math.abs(stats.avd.cumHReal - stats.kombi.cumHReal) <= TIE_EUR;
  if (avdKombiTie) lines.push(gapText(A, KOMBI_OF(A), AVD_OF(A)), 'Das Altersvorsorgedepot legt alles über 570 € im Monat (Höchstbetrag 6.840 € im Jahr) im ETF-Nebendepot an und ist damit fast dasselbe wie eine Kombi aus AVD und ETF.');
  // Annahmen, an denen die Beträge hängen
  if (res.avd) {
    let s = 'Gefördert werden beim Altersvorsorgedepot höchstens 150 € im Monat.';
    if ((res.avd.unsubOwn ?? 0) > 0) s += ' Was darüber hinausgeht, bleibt bis 570 € im Monat ungefördert im Vertrag: ohne Zulage, aber erst bei der Auszahlung und nur auf den Gewinn versteuert.';
    if (res.avd.sideOwn! > 0) s += ' Beiträge über 570 € im Monat oder ohne Förderberechtigung rechnet der Rechner im ETF-Nebendepot.';
    if (p.reinvest && res.avd.ref! > 0) s += ' Gerechnet ist, dass die Steuererstattung jedes Jahr mit angelegt wird.';
    lines.push(s);
  }
  if (res.kombi) lines.push('Die Kombi (' + splitText(res.kombi.split, 'short') + ') wird gemeinsam versteuert: ein Steuertarif, ein Sparer-Pauschbetrag für alle Depots.'
    + (res.kombi.split.avd > 150 ? ' Was beim AVD über 150 € im Monat hinausgeht, bleibt ungefördert im Vertrag' + (res.kombi.split.avd > 570 ? ', über 570 € im ETF-Nebendepot.' : '.') : ''));

  const comp = comparableScenarios(_scen);
  const flipped = comp.filter(s => isFlip(A, s.a));
  const level = robustness(flipped.length, comp.length);
  return {
    kind: 'ok', headline, lines, peek,
    robust: { level, flips: flipped.length, total: comp.length, example: flipped[0]?.label },
  };
}

/** Satz zur Robustheit (ohne Verweis); die Oberfläche macht „Szenarien“ zum Sprungziel. */
export function robustText(r: NonNullable<Verdict['robust']>): { before: string; link: string; after: string } {
  if (!r.flips) return { before: 'In keinem der ' + r.total + ' ', link: 'Szenarien', after: ' unten kehrt sich ein Abstand zwischen zwei Produkten um.' };
  return {
    before: 'In ' + r.flips + ' von ' + r.total + ' ', link: 'Szenarien',
    after: ' unten kehrt sich mindestens ein Abstand zwischen zwei Produkten um' + (r.example ? ', z. B. bei „' + r.example + '“.' : '.'),
  };
}

// ---------------------------------------------------------------- Kosten-Gleichstand

/** 0,00874 → „0,87 %“ (Gleichstand); angenommene Werte wie eingegeben (bis zwei Nachkommastellen). */
const pc2 = (x: number) => (x * 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' %';
const pcIn = (x: number) => (+(x * 100).toFixed(4)).toLocaleString('de-DE', { maximumFractionDigits: 2 }) + ' %';

/** Bezeichnung der Kostenannahme je Produkt, passend zu den Eingaben (wirkt sie auch in der Auszahlphase?). */
function costLabel(b: BreakEven, shift: boolean): string {
  if (b.key === 'avd') return b.payToo ? 'AVD-Kosten in Anspar- und Auszahlphase' : 'AVD-Kosten in der Ansparphase';
  if (b.key === 'ins') return 'Effektivkosten der Versicherung';
  // Mit Umschichtung hat der sichere Teil des Fonds ETF-Kosten (combo.ts); variiert wird nur der Aktienteil.
  const part = shift ? ' (Aktienteil; der sichere Teil nach der Umschichtung mit ETF-Kosten)' : '';
  return (b.payToo ? 'laufenden Kosten des aktiven Fonds' : 'laufenden Kosten des aktiven Fonds in der Ansparphase') + part;
}

/**
 * „Gleichstand mit dem ETF-Depot bei 0,87 % AVD-Kosten … (angenommen 0,5 %). Darunter zahlt …“ oder ehrlich
 * „kein Gleichstand zwischen 0 und 3 %“. Neutral: nennt die Schwelle, keine Bewertung.
 */
export function breakEvenText(A: Analysis, b: BreakEven): string {
  const { p } = A;
  const pr = A.active.find(x => x.key === b.key)!;
  const etf = A.active.find(x => x.key === 'etf')!;
  const label = costLabel(b, p.shift);
  const extra = (b.key === 'fond' ? '; Ausgabeaufschlag ' + pcIn(p.fondAA) : '') + '; ETF-Kosten ' + pcIn(p.etfTer) + ' unverändert';
  const assumed = ' (angenommen ' + pcIn(b.assumed) + extra + ')';
  // Leibrente: verglichen wird bis zum Ende des Auszahlplans; die Rente zahlt danach weiter (siehe Diagramm).
  const bis = 'bis zum Alter von ' + p.H + (b.key === 'ins' && A.res.ins?.lifelong ? ' (die lebenslange Rente zahlt danach weiter)' : '');
  const range = 'zwischen 0 und ' + pcIn(b.cap).replace(' %', '') + ' %';
  if (b.kind === 'above') return cap(pr.nom) + ' zahlt ' + bis + ' auch mit ' + pcIn(b.cap) + ' ' + label + ' mehr aus als ' + etf.nom + ': ' + range + ' kein Gleichstand' + assumed + '.';
  if (b.kind === 'below') return cap(pr.nom) + ' zahlt ' + bis + ' auch mit 0 % ' + label + ' weniger aus als ' + etf.nom + ': ' + range + ' kein Gleichstand' + assumed + '.';
  return 'Gleichstand mit dem ETF-Depot ' + bis + ' bei ' + pc2(b.at!) + ' ' + label + assumed + '. Mit niedrigeren Kosten zahlt ' + pr.nom + ' mehr aus als ' + etf.nom + ', mit höheren weniger.';
}
