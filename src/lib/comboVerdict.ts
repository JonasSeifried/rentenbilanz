// Ergebnissatz im Kombi-Modus (Kombi-Design §4.3, UX U5). Neutral: „rechnerisch“, „unter diesen Annahmen“,
// nie „optimal für dich“ oder „empfehlen“. Abstände (Δ) immer in heutiger Kaufkraft (Fix rankReal, E1);
// im Nominalmodus mit dem Zusatz „(in heutiger Kaufkraft)“. Monatsdurchschnitte in der Anzeige-Einheit.
import type { ProductKey } from './engine/engine';
import { SPLIT_KEYS, type Split } from './engine/combo';
import type { ComboAnalysis, RobustSummary } from './engine/comboAnalyze';
import { AVD_CAP, TIE_EUR, TIE_REL } from './engine/search';
import { eur, eurRound } from './format';

export type ComboVerdictKind = 'needTwo' | 'unallocated' | 'refundSpent' | 'ok';
export interface ComboVerdict {
  kind: ComboVerdictKind;
  headline: string;
  lines: string[];
  /** Kleingedrucktes unter dem Ergebnis. */
  note: string;
  /** Die beste Aufteilung wird noch berechnet (Oberfläche: aria-busy, „wird berechnet …“). */
  pending: boolean;
}

export const COMBO_NOTE = 'Modellrechnung mit konstanter Rendite, keine Anlageberatung. Nicht gerechnet: Verfügbarkeit (ETF jederzeit, AVD und Versicherung gebunden) und Absicherung (lebenslange Rente).';

const LONG: Record<ProductKey, string> = { etf: 'ETF-Depot', avd: 'Altersvorsorgedepot', ins: 'Rentenversicherung', fond: 'aktiver Fonds' };
const SHORT: Record<ProductKey, string> = { etf: 'ETF', avd: 'AVD', ins: 'Versicherung', fond: 'Akt. Fonds' };

/** Betrag in € ohne Scheingenauigkeit bei Rest-Cent: ganze Euro, sonst zwei Nachkommastellen. */
export function eurAmount(x: number): string {
  const r = Math.round(x * 100) / 100;
  return r.toLocaleString('de-DE', Number.isInteger(r) ? {} : { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

/** „350 € ETF-Depot + 150 € Altersvorsorgedepot“, absteigend nach Betrag. */
export function splitText(split: Split, style: 'long' | 'short' = 'long'): string {
  const names = style === 'long' ? LONG : SHORT;
  const ks = SPLIT_KEYS.filter(k => split[k] > 0).sort((a, b) => split[b] - split[a] || SPLIT_KEYS.indexOf(a) - SPLIT_KEYS.indexOf(b));
  return ks.length ? ks.map(k => eurAmount(split[k]) + ' ' + names[k]).join(' + ') : 'nichts verteilt';
}

export function comboVerdict(C: ComboAnalysis, robust?: RobustSummary | null): ComboVerdict {
  const { p } = C;
  const base = { note: COMBO_NOTE, pending: false };
  const range = '(' + p.R + '–' + p.H + ')';
  const kk = p.real ? '' : ' (in heutiger Kaufkraft)';
  const delta = (x: number) => 'rund ' + eurRound(x) + kk;
  const bisH = 'bis zum Alter von ' + p.H;

  if (C.keys.length < 2) return { ...base, kind: 'needTwo', headline: 'Wähle mindestens zwei Produkte zum Aufteilen.', lines: [] };
  if (!(C.budget > 0)) return { ...base, kind: 'unallocated', headline: 'Gib ein Monatsbudget größer als 0 € ein.', lines: [] };
  if (!C.complete) return C.gap > 0
    ? { ...base, kind: 'unallocated', headline: 'Noch ' + eurAmount(C.gap) + ' offen.', lines: ['Verteile das ganze Budget, dann vergleicht der Rechner fair.'] }
    : { ...base, kind: 'unallocated', headline: eurAmount(-C.gap) + ' mehr verteilt als das Budget von ' + eurAmount(C.budget) + '.', lines: ['Verteile genau das Budget, dann vergleicht der Rechner fair.'] };

  const userLine = C.user ? 'Deine Aufteilung: Ø ' + eur(C.user.stats.avgMonthly) + ' netto im Monat ' + range + '.' : '';
  if (C.refundSpent) return {
    ...base, kind: 'refundSpent',
    headline: 'Mit ausgegebener Steuererstattung lässt sich keine Aufteilung fair vergleichen.',
    lines: [
      'Beim Altersvorsorgedepot fließt dann netto weniger eigenes Geld hinein als bei den anderen Produkten. Wird die Erstattung angelegt, ist der Vergleich wieder fair.',
      ...(userLine ? [userLine] : []),
    ],
  };

  const B = C.best;
  if (!B || B === 'pending') return { ...base, kind: 'ok', pending: true, headline: userLine, lines: ['Die rechnerisch beste Aufteilung wird berechnet …'] };

  const lines: string[] = [];
  let headline: string;
  const max = B.top ? Math.max(B.top.value, B.value) : B.value;
  const userExact = !!C.user && C.user.value >= max - TIE_EUR;
  const rel = pct(TIE_REL);
  if (B.userIsBest) headline = userExact
    ? 'Deine Aufteilung ist unter diesen Annahmen rechnerisch die beste: Ø ' + eur(C.user!.stats.avgMonthly) + ' netto im Monat ' + range + '.'
    : 'Deine Aufteilung ist unter diesen Annahmen rechnerisch gleichauf mit der besten (weniger als ' + rel + ' Unterschied): Ø ' + eur(C.user!.stats.avgMonthly) + ' netto im Monat ' + range + '.';
  else {
    headline = userLine;
    lines.push('Rechnerisch am meisten bringt hier ' + splitText(B.split) + ': Ø ' + eur(B.stats.avgMonthly) + ' im Monat. '
      + cap(bisH) + ' sind das zusammen ' + delta(B.deltaUser ?? 0) + ' mehr netto.');
  }
  // Genannt ist eine gleichwertige, einfachere Aufteilung statt des letzten Euros (TIE_REL).
  if (B.top && !(B.userIsBest && userExact)) lines.push('Auf den Euro gerechnet liegt ' + splitText(B.top.split) + ' ' + bisH + ' ' + delta(B.top.value - B.value)
    + ' vorne. Das sind weniger als ' + rel + ' und weit unter der Unsicherheit der Annahmen. Bei so kleinen Unterschieden zählt der Rechner die Aufteilung mit mehr ETF als beste, weil das Geld dort jederzeit verfügbar ist.');
  // Ungeförderter AVD-Teil: Vorteil gegenüber „150 € AVD + Rest“ offen beziffern.
  const cap150 = B.split.avd > AVD_CAP ? B.curve.find(x => x.avd === AVD_CAP) : undefined;
  if (cap150) {
    const d = B.value - cap150.value, rest = { ...cap150.split, avd: 0 };
    const mine = B.userIsBest && SPLIT_KEYS.every(k => Math.abs(C.split[k] - B.split[k]) < 0.005);
    lines.push((mine ? 'In deiner Aufteilung' : B.userIsBest ? 'In der Aufteilung ' + splitText(B.split) : 'Davon') + ' sind ' + eurAmount(B.split.avd - AVD_CAP)
      + ' im Monat ungefördert im Altersvorsorgedepot (keine Zulage, aber keine Steuer bis zur Auszahlung). '
      + 'Mit ' + eurAmount(AVD_CAP) + ' im AVD (voll gefördert) und ' + splitText(rest) + ' wären es ' + bisH + ' ' + (d > TIE_EUR ? delta(d) + ' (' + pct(d / B.value) + ') weniger' : 'praktisch gleich viel') + '. '
      + 'Dieser Vorteil hängt an niedrigen AVD-Kosten (gerechnet: ' + pct(p.avdCost) + ' im Jahr), und das Geld ist bis zur Rente gebunden.');
  }
  // Hat Mischen einen Nachteil?
  if (C.bestPure) lines.push(B.isMix
    ? 'Die rechnerisch beste Aufteilung ist eine Mischung: ' + bisH + ' ' + delta(B.mixGain) + ' mehr netto als „' + C.bestPure.label + '“.'
    : 'Mischen bringt hier rechnerisch nichts gegenüber „' + C.bestPure.label + '“.');
  // Wechselwirkung (gemeinsam − getrennt)
  if (C.interaction !== null && Math.abs(C.interaction) > TIE_EUR) lines.push(C.interaction < 0
    ? 'Gemeinsam gerechnet zahlt deine Aufteilung ' + bisH + ' ' + delta(-C.interaction) + ' mehr Steuern und Abgaben, als wenn jedes Produkt allein gerechnet würde (ein Sparer-Pauschbetrag für alle Depots, progressiver Steuertarif).'
    : 'Gemeinsam gerechnet zahlt deine Aufteilung ' + bisH + ' ' + delta(C.interaction) + ' weniger Abgaben, als wenn jedes Produkt allein gerechnet würde'
      + (p.kvOn ? ', weil die Beitragsbemessungsgrenze der Krankenversicherung die Summe deckelt.' : '.'));
  // Robustheit (U5), sobald die Leerlauf-Rechnung fertig ist
  if (robust && robust.total > 0) {
    const f = robust.flips;
    if (robust.level === 'robust') lines.push('Die rechnerisch beste Aufteilung bleibt in allen ' + robust.total + ' Szenarien unten vorne.');
    else {
      const ex = f[0], example = ' z. B. bei „' + ex.label + '“ (' + splitText(ex.best.split, 'short') + ').';
      const core = 'In ' + f.length + ' von ' + robust.total + ' Szenarien unten ist eine andere Aufteilung rechnerisch vorne,' + example;
      lines.push(robust.level === 'fragile' ? 'Die beste Aufteilung hängt hier stark von den Annahmen ab: ' + core : 'Aber: ' + core);
    }
  }
  return { ...base, kind: 'ok', headline, lines };
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** 0,0081 → „0,8 %“; unter 0,1 % mit zwei Nachkommastellen. */
function pct(x: number): string {
  const v = x * 100;
  return v.toLocaleString('de-DE', { maximumFractionDigits: Math.abs(v) < 0.1 ? 2 : 1 }) + ' %';
}
