// Rechenweg als Markdown: Eingaben, Modellgrenzen, Ergebnisse und Jahreswerte je Teilnehmer. Gedacht zum Nachrechnen
// durch Menschen oder eine KI (einzelne Jahre prüfen statt das Endergebnis „auf Sicht“ beurteilen).
// Reine Funktion, liest nur, was die Engine ohnehin liefert; keine eigene Rechnung außer dem Beitrag laut Eingabe.
import type { Inputs, InputKey } from './engine/inputs';
import { AMOUNT, type Analysis, type ContenderKey } from './engine/analyze';
import { splitSum } from './engine/combo';
import { SITE } from './site';

/** Beschriftung und Einheit je Eingabe (Einheit leer = Zahl/Schalter ohne Einheit). */
const LABELS: Readonly<Record<InputKey, readonly [string, string]>> = Object.freeze({
  a0: ['Alter heute', 'Jahre'], incWork: ['Zu versteuerndes Einkommen im Beruf (heutiges Geld)', '€/Jahr'],
  incRet: ['Sonstiges zu versteuerndes Einkommen im Alter (heutiges Geld)', '€/Jahr'],
  setAll: ['Monatsbeitrag je Produkt (Vorgabe für alle)', '€/Monat'], g: ['Rendite vor Kosten, Ansparphase', '% p. a.'],
  R: ['Rentenbeginn', 'Alter'], kvOn: ['Im Alter freiwillig gesetzlich versichert (KV/PV auf Kapitalerträge)', ''],
  etfOn: ['ETF-Depot im Vergleich', ''], avdOn: ['Altersvorsorgedepot im Vergleich', ''], insOn: ['Fondsgeb. Rentenversicherung im Vergleich', ''], fondOn: ['Aktiver Fonds im Vergleich', ''],
  H: ['Auszahlplan bis', 'Alter'], gPay: ['Rendite vor Kosten, Auszahlphase', '% p. a.'], einmal: ['AVD: 30 % Einmalauszahlung bei Rentenbeginn', ''],
  insLump: ['Versicherung: Kapitalauszahlung statt Leibrente', ''], rf: ['Versicherung: Rentenfaktor', '€ Monatsrente je 10.000 €'],
  gz: ['Versicherung: Rentengarantiezeit', 'Jahre'],
  deathAge: ['Erbfall: Todesalter', 'Alter'], heirHalf: ['Erbfall: Erbe bei Auszahlung mindestens 62', ''],
  incHeir: ['Erbfall: zu versteuerndes Einkommen der Erben (heutiges Geld)', '€/Jahr'],
  studyEnd: ['Ausbildung/Studium bis', 'Alter (16 = keine)'], incStudy: ['Zu versteuerndes Einkommen in der Ausbildung', '€/Jahr'],
  eligStudy: ['In der Ausbildung zulageberechtigt', ''], kvRate: ['KV/PV-Satz im Alter', '%'],
  infl: ['Inflation', '% p. a.'], dyn: ['Beitragsdynamik', '% p. a.'], basis: ['Basiszins Vorabpauschale', '%'],
  etfM: ['ETF: Monatsbeitrag', '€/Monat'], etfTer: ['ETF: laufende Kosten (TER)', '% p. a.'],
  avdM: ['AVD: Monatsbeitrag', '€/Monat'], avdCost: ['AVD: Kosten', '% p. a.'], kids: ['Kinder mit Kinderzulage', 'Anzahl'],
  kidsFrom: ['Kinderzulage ab', 'Alter'], kidsYears: ['Kinderzulage für', 'Jahre'], bonus: ['AVD: Berufseinsteigerbonus', ''],
  reinvest: ['AVD: Steuererstattung wird angelegt', ''],
  insM: ['Versicherung: Monatsbeitrag', '€/Monat'], insEff: ['Versicherung: Effektivkosten', '% p. a.'],
  fondM: ['Aktiver Fonds: Monatsbeitrag', '€/Monat'], fondAA: ['Aktiver Fonds: Ausgabeaufschlag (Anteil am Bruttobeitrag)', '%'],
  fondTer: ['Aktiver Fonds: laufende Kosten', '% p. a.'],
  shift: ['Alle Produkte schichten vor Rentenbeginn um (Standarddepot-Anteile)', ''], safeRate: ['Rendite der sicheren Anlage', '% p. a.'],
  kvKind: ['KV-Status im Alter (0 KVdR, 1 freiwillig, 2 privat, 3 unklar; nur Oberfläche)', ''],
  kvGrossRet: ['Sonstige KV-Bruttoeinnahmen im Alter (−1 = wie Einkommen im Alter)', '€/Jahr'],
  payResidual: ['Auszahlung aller Depots als Restkapital ÷ Restjahre', ''], fundingDelay: ['AVD-Förderung ein Jahr später', ''],
  indexAllowance: ['Sparer-Pauschbetrag wächst mit der Inflation (hypothetisch)', ''],
  avdPayCost: ['AVD: Kosten in der Auszahlphase (−1 = wie Ansparphase)', '% p. a.'],
  etfPayTer: ['ETF: Kosten in der Auszahlphase (−1 = wie Ansparphase)', '% p. a.'],
  fondPayTer: ['Aktiver Fonds: Kosten in der Auszahlphase (−1 = wie Ansparphase)', '% p. a.'],
  real: ['Anzeige in heutiger Kaufkraft', ''],
  combo: ['Kombi im Vergleich', ''], cEtf: ['Kombi: ETF', '€/Monat'], cAvd: ['Kombi: AVD', '€/Monat'], cIns: ['Kombi: Versicherung', '€/Monat'], cFond: ['Kombi: aktiver Fonds', '€/Monat'],
});

/** Modellgrenzen, die man beim Nachprüfen kennen muss (Stand wie unter „Weitere Einstellungen“). */
const LIMITS_TEXT = [
  'Konstante Rendite jedes Jahr, keine Schwankungen und kein Sequenzrisiko.',
  'Einkommensteuer Tarif 2026 (§ 32a EStG), Grundtarif ledig, mit Solidaritätszuschlag; Tarifgrenzen wachsen mit der Inflation. Keine Kirchensteuer, kein Ehegattensplitting.',
  'Das Einkommen im Beruf bleibt real gleich (keine Gehaltsentwicklung), abgesehen von einer Ausbildungsphase.',
  'Abgeltungsteuer 26,375 %, Teilfreistellung 30 % (Aktienfonds), Sparer-Pauschbetrag 1.000 € nominal, Vorabpauschale mit Zufluss im Folgejahr.',
  'Jahresmodell: Beiträge monatlich, Entnahmen jährlich am Jahresanfang.',
  'Nicht berücksichtigt: Erbschaftsteuer, Ordergebühren und Spreads, Betriebsrente, andere Kapitalerträge außerhalb der verglichenen Produkte.',
];

const pct = (x: number) => String(+(x * 100).toFixed(4)).replace('.', ',');
const n0 = (x: number) => Math.round(x).toLocaleString('de-DE');
const n4 = (x: number) => x.toLocaleString('de-DE', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
const fmtVal = (v: Inputs[InputKey]) => typeof v === 'boolean' ? (v ? 'ja' : 'nein') : String(v).replace('.', ',');

interface Row { own: number; ownReal: number; capR: number; foerder: number; vals: (number | null)[]; net: number[]; incTax: number[]; abgTax: number[]; kv: number[] }

function rowsOf(A: Analysis, k: ContenderKey): { name: string; monthly: number; r: Row } | null {
  const pr = A.active.find(x => x.key === k);
  if (!pr) return null;
  if (k === 'kombi') {
    const kr = A.res.kombi!;
    return { name: pr.name, monthly: splitSum(kr.split), r: { ...kr, incTax: kr.combo.incTax, abgTax: kr.combo.abgTax, kv: kr.combo.kv } };
  }
  const r = A.res[k]!;
  return { name: pr.name, monthly: A.p[AMOUNT[k]], r };
}

/** Markdown mit allem, was zum Nachrechnen eines Szenarios nötig ist. `url` = Link auf genau dieses Szenario. */
export function rechenweg(inputs: Inputs, A: Analysis, url: string, today = new Date()): string {
  const { p, n, T, tH } = A;
  const out: string[] = [];
  out.push(`# ${SITE.name}: Rechenweg`, '');
  out.push(`Erstellt am ${today.toLocaleDateString('de-DE')} mit ${SITE.url || SITE.name}. ${SITE.lawState}; Prüfstand ${SITE.updated}.`);
  out.push(`Szenario-Link: ${url}`);
  out.push(`Quellcode und Methodik: ${SITE.repo} (Rechnung in src/lib/engine/combo.ts, Rechtsgrundlagen in docs/).`, '');
  out.push('Modellrechnung, keine Anlage-, Steuer- oder Rechtsberatung. Zum Prüfen eignen sich einzelne Jahre der Tabellen unten:',
    'Beitrag, Vermögen, Netto-Auszahlung und die Abzüge eines Jahres lassen sich mit den Eingaben und den Modellgrenzen nachrechnen.', '');

  out.push('## Eingaben', '', '| Schlüssel | Bedeutung | Wert | Einheit |', '|---|---|---:|---|');
  for (const key of Object.keys(LABELS) as InputKey[]) {
    const [label, unit] = LABELS[key];
    out.push(`| ${key} | ${label} | ${fmtVal(inputs[key])} | ${unit} |`);
  }
  out.push('');
  out.push('## Modellgrenzen', '', ...LIMITS_TEXT.map(x => '- ' + x), '');

  out.push('## Ergebnis', '');
  out.push(`Zeitraum für den Vergleich: Rentenbeginn mit ${p.R} bis zum Ende des Auszahlplans mit ${p.H} (${tH - n} Jahre). ` +
    `„Heutige Kaufkraft“ = nominal ÷ (1 + ${pct(p.infl)} %)^Jahr.`, '');
  out.push('| Teilnehmer | Eigenbeiträge nominal | Eigenbeiträge heutige Kaufkraft | Förderung nominal | Kapital bei Rentenbeginn nominal | Ø Monat netto | Summe netto bis H | Summe netto bis H, heutige Kaufkraft | Einmalauszahlung netto |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const pr of A.active) {
    const x = rowsOf(A, pr.key)!, s = A.stats[pr.key]!;
    out.push(`| ${x.name} | ${n0(x.r.own)} | ${n0(x.r.ownReal)} | ${n0(x.r.foerder)} | ${n0(x.r.capR)} | ${n0(s.avgMonthly)} | ${n0(s.cumH)} | ${n0(s.cumHReal)} | ${n0(s.lump)} |`);
  }
  out.push('', `Ø Monat, Summe bis H und Einmalauszahlung in der Anzeige-Einheit (${p.real ? 'heutige Kaufkraft' : 'nominal'}); Rangfolge immer nach heutiger Kaufkraft.`, '');

  out.push('## Jahreswerte', '');
  out.push('Alle Beträge nominal in €. „Jahr“ zählt ab heute (Jahr 0 = erstes Sparjahr). Beitrag = Monatsbeitrag laut Eingabe × 12 × (1 + Dynamik)^Jahr bis vor Rentenbeginn.',
    '„Vermögen“ = Stand am Jahresende vor Steuern bei Verkauf; beim AVD mit Zulagen, ungefördertem Teil und dem Nebendepot der angelegten Steuererstattungen. „Netto“ = Auszahlung im Jahr nach allen Abzügen (vor Rentenbeginn: Erstattungen, die ausgezahlt werden).',
    'ESt = zusätzliche Einkommensteuer auf das Produkt (negativ = Entlastung), Abgeltung = Kapitalertragsteuer nach Günstigerprüfung, KV = zusätzliche KV/PV-Beiträge. Inflationsfaktor = (1 + Inflation)^Jahr.', '');
  for (const pr of A.active) {
    const x = rowsOf(A, pr.key)!;
    out.push(`### ${x.name}`, '', '| Jahr | Alter | Beitrag | Vermögen Ende | Netto | ESt | Abgeltung | KV | Inflationsfaktor |', '|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
    for (let t = 0; t < T; t++) {
      const v = x.r.vals[t + 1];
      const contrib = t < n ? x.monthly * 12 * Math.pow(1 + p.dyn, t) : 0;
      out.push(`| ${t} | ${p.a0 + t} | ${n0(contrib)} | ${v == null ? '–' : n0(v)} | ${n0(x.r.net[t] ?? 0)} | ${n0(x.r.incTax[t] ?? 0)} | ${n0(x.r.abgTax[t] ?? 0)} | ${n0(x.r.kv[t] ?? 0)} | ${n4(A.I(t))} |`);
    }
    out.push('');
  }
  return out.join('\n');
}
