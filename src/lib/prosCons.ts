// „Was die Zahlen nicht zeigen“: Vor- und Nachteile je Produkt und häufige Fragen, die nicht im Kapital oder in der
// Monatsrente stecken (Verfügbarkeit, Umschichten, Schutz, Bindung, Kostenrisiko). Neutral formuliert, Rechtsaussagen mit
// Fundstelle. Reine Funktionen: Texte hängen nur von den Params und den gewählten Produkten ab (tests/pros-cons.test.ts).
import type { Params, ProductKey } from './engine/core';
import type { Tab } from './link';
import { SITE } from './site';

/** Ein Punkt; `field` = Feld-ID, zu der ein Link mit `fieldLabel` führt (focusField(tab, field), Standard „settings“). */
export interface Point { text: string; field?: string; fieldLabel?: string; tab?: Tab }
export interface ProsCons { key: ProductKey; title: string; pros: Point[]; cons: Point[] }
export interface Faq { id: string; q: string; a: string[] }

const pc = (x: number) => (Math.round(x * 1e4) / 100).toLocaleString('de-DE') + ' %';
const GRUNDSICHERUNG = 'Grundsicherung (früher Bürgergeld)';

export function prosCons(p: Params, keys: readonly ProductKey[]): ProsCons[] {
  const out: ProsCons[] = [];
  if (keys.includes('etf')) out.push({
    key: 'etf', title: 'ETF-Depot',
    pros: [
      { text: 'Jederzeit verfügbar: ganz oder teilweise verkaufen, den Sparplan pausieren oder ändern, ohne Abzüge.' },
      { text: 'Freie Wahl von Broker und ETF. Der Umzug zu einem anderen Broker (Depotübertrag) ist kostenlos.' },
      { text: 'Vererbbar ohne Förderrückzahlung, die Erben übernehmen die Anschaffungskosten.' },
    ],
    cons: [
      { text: 'Umschichten kostet Steuern: Wer den ETF wechselt oder vor der Rente in sichere Anlagen umschichtet, verkauft und versteuert die Gewinne über dem Sparer-Pauschbetrag sofort. Gerechnet ist ein ETF ohne Umschichtung bis zur Auszahlung.' },
      { text: 'Bei der ' + GRUNDSICHERUNG + ' zählt das Depot über den Freibeträgen als Vermögen, anders als gefördertes Altersvorsorgevermögen und Altersvorsorge-Versicherungen (§ 12 SGB II).' },
      { text: 'Kein Schutz vor dem eigenen Zugriff: Was jederzeit verfügbar ist, ist auch schnell vor der Rente ausgegeben.' },
      { text: 'Der Auszahlplan endet mit ' + p.H + '. Wer älter wird, braucht dann anderes Geld.' },
    ],
  });
  if (keys.includes('avd')) out.push({
    key: 'avd', title: 'Altersvorsorgedepot',
    pros: [
      { text: 'Umschichten und Fondswechsel innerhalb des Depots sind steuerfrei. Versteuert wird erst die Auszahlung.' },
      { text: 'Gefördertes Altersvorsorgevermögen zählt bei der ' + GRUNDSICHERUNG + ' nicht als Vermögen (§ 12 SGB II).' },
      { text: 'Das Geld ist für die Rente reserviert und wird nicht nebenbei ausgegeben.' },
    ],
    cons: [
      { text: 'Gebunden bis zum Rentenbeginn (65 bis 70, früher nur mit gesetzlicher Altersrente). Wer vorher kündigt, zahlt Zulagen und Steuervorteile zurück, die Erträge werden versteuert (schädliche Verwendung, § 93 EStG).' },
      { text: 'Ausgezahlt wird als Auszahlplan bis mindestens 85, höchstens 30 % auf einmal. Über das ganze Kapital frei verfügen kann man nicht.' },
      { text: 'Die Kosten stehen erst mit den Angeboten fest. Gedeckelt sind sie nur im Standarddepot, auf 1,0 % (§ 2a Abs. 2 AltZertG). Gerechnet: ' + pc(p.avdCost) + ' im Jahr.', field: 'f-avdCost', fieldLabel: 'Kosten ändern' },
      p.avdStd
        ? { text: 'Gerechnet mit der Umschichtung des Standarddepots: ab 5 Jahre vor Rentenbeginn höchstens 50 %, ab 2 Jahren höchstens 30 % in Aktien, der Rest mit ' + pc(p.avdSafe) + ' im Jahr.', field: 'f-avdStd', fieldLabel: 'Umschichtung ändern' }
        : { text: 'Das Standarddepot schichtet ab 5 Jahre vor Rentenbeginn in sichere Anlagen um (§ 1 Abs. 1c Nr. 5 AltZertG). Gerechnet ist ein Depot ohne Umschichtung.', field: 'f-avdStd', fieldLabel: 'Umschichtung einschalten' },
      { text: 'Erben alle außer dem Ehepartner, gehen Zulagen und Steuervorteil zurück (siehe „Erbfall“).' },
      { text: 'Neues Produkt ab ' + SITE.avdStart + ': Anbieter, Kosten und Verwaltungspraxis (z. B. BMF-Schreiben, Krankenkassen) stehen teils noch nicht fest.' },
    ],
  });
  if (keys.includes('ins')) out.push({
    key: 'ins', title: 'Fondsgebundene Rentenversicherung',
    pros: [
      p.insLump
        ? { text: 'Statt Kapital ist eine lebenslange Rente wählbar, egal wie alt man wird. Gerechnet ist die Kapitalauszahlung.', field: 'f-insLump', fieldLabel: 'Leibrente rechnen', tab: 'detail' }
        : { text: 'Lebenslange Rente, egal wie alt man wird. Die Summe oben endet mit ' + p.H + ', die Rente läuft weiter.' },
      { text: 'Fondswechsel innerhalb der Versicherung sind steuerfrei.' },
      { text: 'Für die Altersvorsorge bestimmte Versicherungsverträge zählen bei der ' + GRUNDSICHERUNG + ' nicht als Vermögen (§ 12 SGB II).' },
    ],
    cons: [
      { text: 'Abschluss- und Vertriebskosten fallen vor allem in den ersten Jahren an. Wer früh kündigt oder Beiträge senkt, bekommt oft deutlich weniger zurück als eingezahlt.' },
      { text: 'Der Rentenfaktor ist oft nur teilweise garantiert und kann später gesenkt werden.' },
      { text: 'Fondsauswahl und Kosten legt der Vertrag fest. Ein Wechsel zu einem anderen Anbieter ist meist nur über eine Kündigung möglich.' },
    ],
  });
  if (keys.includes('fond')) out.push({
    key: 'fond', title: 'Aktiver Fonds',
    pros: [
      { text: 'Jederzeit verfügbar wie ein ETF.' },
      { text: 'Das Fondsmanagement kann vom Index abweichen, z. B. in einer Krise umschichten, ohne dass du verkaufen musst.' },
      { text: 'Den Ausgabeaufschlag vermeiden Direktbanken und Fondsvermittler oft ganz oder teilweise.', field: 'f-fondAA', fieldLabel: 'Aufschlag ändern' },
    ],
    cons: [
      { text: 'Über lange Zeiträume schneidet die Mehrheit der aktiven Fonds nach Kosten schlechter ab als ihr Vergleichsindex (z. B. SPIVA-Berichte von S&P Dow Jones Indices). Gerechnet ist dieselbe Rendite wie beim ETF, nur mit höheren Kosten.' },
      { text: 'Wechsel in einen anderen Fonds kostet Steuern wie beim ETF-Depot.' },
    ],
  });
  return out;
}

/** Häufige Fragen; nur die, die zu den gewählten Produkten passen. */
export function faqs(p: Params, keys: readonly ProductKey[]): Faq[] {
  const out: Faq[] = [];
  const avd = keys.includes('avd'), etf = keys.includes('etf');
  if (avd) out.push({
    id: 'avd150', q: 'Lohnt sich mehr als 150 € im Monat im Altersvorsorgedepot?',
    a: [
      'Gefördert sind nur 1.800 € im Jahr (150 € im Monat). Bis 6.840 € im Jahr (570 € im Monat) darf man ungefördert in denselben Vertrag einzahlen: keine Zulage und kein Steuerabzug, aber auch keine Steuer bis zur Auszahlung. Dann ist nur der Gewinn steuerpflichtig, nach 12 Jahren Laufzeit zur Hälfte mit dem persönlichen Steuersatz.',
      'Gegenüber einem ETF-Depot ist das bei niedrigen AVD-Kosten (um 0,5 %) nur knapp besser, bei höheren Kosten, mit Krankenversicherung auf die Auszahlung oder hohem Einkommen im Alter schlechter. Dafür ist das Geld bis zur Rente gebunden. Welche Aufteilung unter deinen Annahmen rechnerisch vorne liegt, zeigt der Kombi-Modus.',
    ],
  });
  out.push({
    id: 'early', q: 'Was passiert, wenn ich das Geld vor der Rente brauche?',
    a: [
      ...(etf || keys.includes('fond') ? ['ETF und Fonds: verkaufen, die Gewinne über dem Sparer-Pauschbetrag werden versteuert. Sonst keine Nachteile.'] : []),
      ...(avd ? ['Altersvorsorgedepot: nur durch Kündigung. Zulagen und Steuervorteile gehen zurück, die Erträge werden versteuert (§ 93 EStG). Beiträge ruhen lassen ist möglich, die Förderung entfällt dann für diese Jahre.'] : []),
      ...(keys.includes('ins') ? ['Rentenversicherung: Kündigung zum Rückkaufswert, in den ersten Jahren oft deutlich unter den Einzahlungen. Beitragsfreistellung ist meist möglich.'] : []),
    ],
  });
  out.push({
    id: 'crash', q: 'Was ist mit Kursschwankungen und einem Crash kurz vor der Rente?',
    a: [
      'Der Rechner rechnet mit einer konstanten Rendite (' + pc(p.g) + ' bis zur Rente, ' + pc(p.gPay) + ' danach). Echte Kurse schwanken. Ein Einbruch kurz vor Rentenbeginn trifft ein reines Aktiendepot voll.',
      'Dagegen hilft Umschichten in sichere Anlagen in den letzten Jahren: im Altersvorsorgedepot und in der Versicherung steuerfrei, im ETF-Depot nur durch Verkauf mit Steuer. Das Standarddepot macht das automatisch (in den Einstellungen einschaltbar). Der Schutz selbst ist im Kapital nicht sichtbar, nur die niedrigere Rendite.',
    ],
  });
  if (avd && etf) out.push({
    id: 'mix', q: 'Warum oft 150 € ins AVD und den Rest ins ETF-Depot?',
    a: [
      'Bis 150 € im Monat bringen die Zulagen viel mehr, als die höheren Kosten des AVD kosten. Darüber gibt es nur noch den Steueraufschub, und der Vorteil schrumpft auf wenige Prozent oder kippt. Das ETF-Depot bleibt dafür jederzeit verfügbar und nutzt den Sparer-Pauschbetrag.',
    ],
  });
  return out.filter(f => f.a.length);
}
