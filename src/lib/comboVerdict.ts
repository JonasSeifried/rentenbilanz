// Ergebnissatz im Kombi-Modus (Kombi-Design §4.3, UX U5). Neutral: „rechnerisch“, „unter diesen Annahmen“,
// nie „optimal für dich“ oder „empfehlen“. Abstände (Δ) immer in heutiger Kaufkraft (Fix rankReal, E1);
// im Nominalmodus mit dem Zusatz „(in heutiger Kaufkraft)“. Monatsdurchschnitte in der Anzeige-Einheit.
import type { ProductKey } from './engine/engine';
import { SPLIT_KEYS, type Split } from './engine/combo';
import type { ComboAnalysis, RobustSummary } from './engine/comboAnalyze';
import { TIE_EUR } from './engine/search';
import { eur } from './format';

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

/**
 * Gerundeter Betrag (U17): ab 10.000 € auf 100 €, ab 1.000 € auf 10 €, sonst auf 1 €.
 * Gleiche Regel wie eurRound in format.ts (WP3a); hier lokal, damit dieses Modul unabhängig bleibt.
 */
export function eurRound(x: number): string {
  const a = Math.abs(x), step = a >= 10000 ? 100 : a >= 1000 ? 10 : 1;
  return eur(Math.round(x / step) * step);
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
  if (B.userIsBest) headline = 'Deine Aufteilung ist unter diesen Annahmen rechnerisch die beste: Ø ' + eur(C.user!.stats.avgMonthly) + ' netto im Monat ' + range + '.';
  else {
    headline = userLine;
    lines.push('Rechnerisch am meisten bringt hier ' + splitText(B.split) + ': Ø ' + eur(B.stats.avgMonthly) + ' im Monat. '
      + cap(bisH) + ' sind das zusammen ' + delta(B.deltaUser ?? 0) + ' mehr netto.');
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
