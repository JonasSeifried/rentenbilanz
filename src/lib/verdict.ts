// Empfehlung als Satz. Logik wie verdictText() im Original, Formulierungen neutral (nicht auf eine Person bezogen).
import type { Analysis, Scenario } from './engine/analyze';
import { eur } from './format';

export type VerdictKind = 'ok' | 'needTwo' | 'unequal' | 'refundSpent';
export interface Verdict { kind: VerdictKind; headline: string; lines: string[] }

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function verdict(A: Analysis, scen: Scenario[]): Verdict {
  const { p, active, stats } = A;
  if (active.length < 2) return { kind: 'needTwo', headline: 'Bitte mindestens zwei Produkte zum Vergleich auswählen.', lines: [] };
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
  const second = active.filter(pr => pr.key !== w.key).reduce((a, b) => stats[b.key]!.cumH > stats[a.key]!.cumH ? b : a);
  const sw = stats[w.key]!, ss = stats[second.key]!, rel = ss.cumH > 0 ? (sw.cumH - ss.cumH) / ss.cumH : 1;
  const headline = (rel < 0.05 ? 'Knapp vorne: ' : 'Rechnerisch vorne: ') + cap(w.nom) + ' mit Ø ' + eur(sw.avgMonthly) + ' netto im Monat (' + p.R + '–' + p.H + ').';
  const lines: string[] = [];
  lines.push('Das sind bis ' + p.H + ' insgesamt ' + eur(sw.cumH - ss.cumH) + ' mehr als ' + second.nom + '.');
  if (w.key === 'avd') lines.push('Unter diesen Annahmen lohnen sich bis zu 150 € im Monat im Altersvorsorgedepot (mehr wird nicht gefördert), alles darüber im ETF' + (p.reinvest ? ', die Steuererstattung jedes Jahr mit angelegt.' : '.'));
  else if (w.key === 'etf') lines.push('Ein ETF-Depot ist außerdem jederzeit verfügbar und damit flexibel, etwa für Notgroschen, Wohnung oder Auszeit.');
  else lines.push('Das ist ungewöhnlich. Ein Blick auf die Kostenannahmen unter „Weitere Einstellungen“ lohnt sich.');
  const flips = scen.filter(s => s.a.lead && s.a.lead.key !== w.key);
  lines.push(flips.length
    ? 'Aber: In ' + flips.length + ' von ' + scen.length + ' Szenarien unten liegt ein anderes Produkt vorne, z. B. bei „' + flips[0].label + '“.'
    : 'Das Ergebnis hält in allen ' + scen.length + ' Szenarien unten.');
  return { kind: 'ok', headline, lines };
}
