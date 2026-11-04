// Ergebnis als Satz. Logik wie verdictText() im Original, Formulierungen neutral (nicht auf eine Person bezogen).
// Abweichungen vom Original (Wave 2):
// - Zweitplatzierter und Abstand immer in heutiger Kaufkraft (`cumHReal`, Befund E1). Im Nominalmodus steht
//   „(in heutiger Kaufkraft)“ dabei, weil die nominalen Summen in knappen Fällen andersherum liegen können.
// - Das Szenario „Steuererstattung ausgegeben“ zählt nicht als Kippen (dort gibt es keinen fairen Vergleich, U6).
// - Robustheitsstufen (U5): kippt mindestens ein Drittel der Szenarien, heißt es „Kein klarer Favorit“.
import type { Analysis, ContenderKey, Product, Scenario } from './engine/analyze';
import { eur, eurRound } from './format';
import { splitText } from './comboVerdict';

export type VerdictKind = 'ok' | 'needTwo' | 'unequal' | 'refundSpent';
/** 0 = hält in allen Szenarien, 1 = kippt in weniger als einem Drittel, 2 = kippt in mindestens einem Drittel */
export type Robustness = 0 | 1 | 2;
export interface Verdict {
  kind: VerdictKind;
  headline: string;
  lines: string[];
  /** Nur bei `ok`: wie viele der vergleichbaren Szenarien ein anderes Produkt vorne sehen. */
  robust?: { level: Robustness; flips: number; total: number; example?: string };
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** „als beim ETF-Depot“, „als bei der Rentenversicherung“ … */
export const DATIV: Record<ContenderKey, string> = {
  etf: 'beim ETF-Depot', avd: 'beim Altersvorsorgedepot', ins: 'bei der Rentenversicherung', fond: 'beim aktiven Fonds', kombi: 'bei deiner Kombi',
};

/** Szenarien, die für die Robustheit zählen: ohne „Steuererstattung ausgegeben“ (dort ist kein fairer Vergleich möglich). */
export function comparableScenarios(scen: Scenario[]): Scenario[] {
  return scen.filter(s => s.id !== 'refund' && !s.a.refundSpent);
}

/** Abstand, unter dem zwei Teilnehmer als gleichauf gelten (Summe bis H, heutige Kaufkraft); wie TIE_EUR der Kombi-Suche. */
export const TIE_EUR = 1;

/** Liegt im Szenario ein anderer Teilnehmer als `base` vorne, und zwar um mehr als TIE_EUR? */
export function isFlip(base: ContenderKey, a: Analysis): boolean {
  if (!a.canRank || !a.lead || a.lead.key === base) return false;
  const b = a.stats[base];
  return !b || a.stats[a.lead.key]!.cumHReal - b.cumHReal > TIE_EUR;
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

export function verdict(A: Analysis, scen: Scenario[]): Verdict {
  const { p, active, stats, res } = A;
  if (active.length < 2) return { kind: 'needTwo', headline: 'Für einen Vergleich mindestens ein weiteres Produkt dazunehmen.', lines: [] };
  if (!A.fairOwn) return {
    kind: 'unequal',
    headline: 'Die Monatsbeiträge sind nicht bei allen Produkten gleich.',
    lines: ['So lässt sich kein fairer Vergleich ziehen, weil nicht überall gleich viel eigenes Geld hineinfließt.'],
  };
  if (A.refundSpent) return {
    kind: 'refundSpent',
    headline: 'Mit ausgegebener Steuererstattung gibt es keinen fairen Gewinner.',
    lines: ['Beim Altersvorsorgedepot fließt dann netto weniger eigenes Geld hinein als bei den anderen Produkten. Wird die Erstattung angelegt, ist der Vergleich wieder fair.'],
  };
  const w = A.lead!;
  // Rangfolge und Abstand immer real (E1): Im Nominalmodus kann die nominale Summe andersherum liegen.
  const real = (k: ContenderKey) => stats[k]!.cumHReal;
  const second = active.filter(pr => pr.key !== w.key).reduce((a, b) => real(b.key) > real(a.key) ? b : a);
  const delta = real(w.key) - real(second.key);
  const rel = real(second.key) > 0 ? delta / real(second.key) : 1;

  const comp = comparableScenarios(scen);
  const flipped = comp.filter(s => isFlip(w.key, s.a));
  const level = robustness(flipped.length, comp.length);

  const sw = stats[w.key]!;
  const what = w.nom + ' mit Ø ' + eur(sw.avgMonthly) + ' netto im Monat (' + p.R + '–' + p.H + ').';
  const tie = delta <= TIE_EUR;
  const headline = level === 2
    ? 'Kein klarer Favorit – knapp vorne liegt ' + what
    : tie ? 'Gleichauf: ' + cap(w.nom) + ' und ' + second.nom + ', je Ø ' + eur(sw.avgMonthly) + ' netto im Monat (' + p.R + '–' + p.H + ').'
    : (rel < 0.05 ? 'Knapp vorne: ' : 'Rechnerisch vorne: ') + cap(what);

  const lines: string[] = [];
  const pair = [w.key, second.key];
  const avdKombiTie = tie && pair.includes('avd') && pair.includes('kombi');
  if (tie) {
    lines.push('Bis zum Alter von ' + p.H + ' liegen beide weniger als ' + eur(TIE_EUR) + ' auseinander' + (p.real ? '.' : ' (in heutiger Kaufkraft).'));
    if (avdKombiTie) lines.push('Das Altersvorsorgedepot legt alles über 570 € im Monat (Höchstbetrag 6.840 € im Jahr) im ETF-Nebendepot an und ist damit fast dasselbe wie eine Kombi aus AVD und ETF.');
  } else lines.push('Bis zum Alter von ' + p.H + ' sind das zusammen rund ' + eurRound(delta) + ' mehr netto als ' + DATIV[second.key]
    + (p.real ? '.' : ' (in heutiger Kaufkraft).'));
  if (level < 2 && !avdKombiTie) {
    if (w.key === 'avd') {
      let s = 'Gefördert werden beim Altersvorsorgedepot höchstens 150 € im Monat.';
      if (res.avd && (res.avd.unsubOwn ?? 0) > 0) s += ' Was darüber hinausgeht, bleibt bis 570 € im Monat ungefördert im Vertrag: ohne Zulage, aber erst bei der Auszahlung und nur auf den Gewinn versteuert.';
      if (res.avd && res.avd.sideOwn! > 0) s += ' Beiträge über 570 € im Monat oder ohne Förderberechtigung rechnet der Rechner im ETF-Nebendepot.';
      if (p.reinvest && res.avd && res.avd.ref! > 0) s += ' Gerechnet ist, dass die Steuererstattung jedes Jahr mit angelegt wird.';
      lines.push(s);
    } else if (w.key === 'kombi') {
      lines.push('Die Kombi (' + splitText(res.kombi!.split, 'short') + ') wird gemeinsam versteuert: ein Steuertarif, ein Sparer-Pauschbetrag für alle Depots.'
        + (res.kombi!.split.avd > 150 ? ' Was beim AVD über 150 € im Monat hinausgeht, bleibt ungefördert im Vertrag' + (res.kombi!.split.avd > 570 ? ', über 570 € im ETF-Nebendepot.' : '.') : ''));
    } else if (w.key === 'etf') lines.push('Ein ETF-Depot ist außerdem jederzeit verfügbar und damit flexibel, etwa für Notgroschen, Wohnung oder Auszeit.');
    else lines.push('Das ist ungewöhnlich. Ein Blick auf die Kostenannahmen unter „Weitere Einstellungen & Annahmen“ lohnt sich.');
  }
  return {
    kind: 'ok', headline, lines,
    robust: { level, flips: flipped.length, total: comp.length, example: flipped[0]?.label },
  };
}

/** Satz zur Robustheit (ohne Verweis); die Oberfläche macht „Szenarien“ zum Sprungziel. */
export function robustText(r: NonNullable<Verdict['robust']>): { before: string; link: string; after: string } {
  if (!r.flips) return { before: 'Das Ergebnis hält in allen ' + r.total + ' ', link: 'Szenarien', after: ' unten.' };
  return {
    before: 'Aber: In ' + r.flips + ' von ' + r.total + ' ', link: 'Szenarien',
    after: ' unten liegt ein anderes Produkt vorne' + (r.example ? ', z. B. bei „' + r.example + '“.' : '.'),
  };
}
