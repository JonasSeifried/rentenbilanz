// Rechenweg als Markdown: Eingaben, Modellgrenzen, Ergebnisse und Jahreswerte je Teilnehmer. Gedacht zum Nachrechnen
// durch Menschen oder eine KI (einzelne Jahre prüfen statt das Endergebnis „auf Sicht“ beurteilen).
// Reine Funktion, liest nur, was die Engine ohnehin liefert; keine eigene Rechnung außer dem Beitrag laut Eingabe.
import { INPUT_KEYS, type Inputs, type InputKey } from './engine/inputs';
import { incomeAt, incomeGrowth, incomePathKind, incomeStartText, type Params, type ProductKey } from './engine/core';
import { AMOUNT, type Analysis, type ContenderKey } from './engine/analyze';
import { splitSum } from './engine/combo';
import { SITE } from './site';
import { costBreakEvens, MAX_COST } from './engine/breakEven';
import { breakEvenText, gapText } from './verdict';

/** Beschriftung und Einheit je Eingabe (Einheit leer = Zahl/Schalter ohne Einheit). */
const LABELS: Readonly<Record<InputKey, readonly [string, string]>> = Object.freeze({
  a0: ['Alter heute', 'Jahre'], incWork: ['Zu versteuerndes Einkommen im Beruf (heutiges Geld)', '€/Jahr'],
  incPeak: ['Gehaltsentwicklung: Zielgehalt, zu versteuern (heutiges Geld; −1 = aus)', '€/Jahr'], incPeakAge: ['Gehaltsentwicklung: Zielgehalt erreicht mit', 'Alter'],
  incRet: ['Sonstiges zu versteuerndes Einkommen im Alter (heutiges Geld)', '€/Jahr'],
  setAll: ['Monatsbeitrag je Produkt (Vorgabe für alle)', '€/Monat'], g: ['Rendite vor Kosten, Ansparphase', '% p. a.'],
  R: ['Rentenbeginn', 'Alter'], kvOn: ['Im Alter freiwillig gesetzlich versichert (KV/PV auf Kapitalerträge)', ''],
  etfOn: ['ETF-Depot im Vergleich', ''], avdOn: ['Altersvorsorgedepot im Vergleich', ''], insOn: ['Fondsgeb. Rentenversicherung im Vergleich', ''], fondOn: ['Aktiver Fonds im Vergleich', ''],
  H: ['Auszahlplan bis', 'Alter'], gPay: ['Rendite vor Kosten, Auszahlphase', '% p. a.'], einmal: ['AVD: 30 % Einmalauszahlung bei Rentenbeginn', ''],
  insLump: ['Versicherung: Kapitalauszahlung statt Leibrente', ''], rf: ['Versicherung: Rentenfaktor', '€ Monatsrente je 10.000 €'],
  gz: ['Versicherung: Rentengarantiezeit', 'Jahre'],
  deathAge: ['Erbfall: Todesalter', 'Alter'], heirHalf: ['Erbfall: Erbe bei Auszahlung mindestens 62', ''],
  incHeir: ['Erbfall: zu versteuerndes Einkommen der Erben (heutiges Geld)', '€/Jahr'],
  kist: ['Kirchensteuersatz (0 = keine)', '%'], married: ['Verheiratet, zusammen veranlagt (Splitting)', ''],
  incSpouse: ['Partner: zu versteuerndes Einkommen vor dem eigenen Rentenbeginn (heutiges Geld)', '€/Jahr'],
  incSpouseRet: ['Partner: zu versteuerndes Einkommen ab dem eigenen Rentenbeginn (heutiges Geld)', '€/Jahr'],
  avdSpouse: ['Partner: eigener Beitrag in seinen geförderten Altersvorsorgevertrag (nur verheiratet)', '€/Monat'],
  abgRate: ['Was-wäre-wenn: Abgeltungsteuersatz ohne Soli/Kirchensteuer (heute 25)', '%'],
  estAdd: ['Was-wäre-wenn: Grenzsteuersatz der Einkommensteuer höher um', 'Prozentpunkte'],
  taxFrom: ['Was-wäre-wenn: Steueränderung gilt ab (−1 = ab Rentenbeginn)', 'Alter'],
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
  allowanceUsed: ['Sparer-Pauschbetrag schon anderweitig genutzt (heutiges Geld)', '€/Jahr'],
  avdPayCost: ['AVD: Kosten in der Auszahlphase (−1 = wie Ansparphase)', '% p. a.'],
  etfPayTer: ['ETF: Kosten in der Auszahlphase (−1 = wie Ansparphase)', '% p. a.'],
  fondPayTer: ['Aktiver Fonds: Kosten in der Auszahlphase (−1 = wie Ansparphase)', '% p. a.'],
  real: ['Anzeige in heutiger Kaufkraft', ''],
  combo: ['Kombi im Vergleich', ''], cEtf: ['Kombi: ETF', '€/Monat'], cAvd: ['Kombi: AVD', '€/Monat'], cIns: ['Kombi: Versicherung', '€/Monat'], cFond: ['Kombi: aktiver Fonds', '€/Monat'],
});

/** Modellgrenzen, die man beim Nachprüfen kennen muss (Stand wie unter „Weitere Einstellungen“), passend zu den Schaltern. */
/** Mittelbare Partner-Zulage (nominal) je Teilnehmer mit AVD: Einzelprodukt und Kombi getrennt. */
function spouseZul(A: Analysis): string {
  const one = A.res.avd ? Number(A.res.avd.zulSpouse ?? 0) : null;
  const kombi = A.res.kombi?.combo.parts.avd ? Number(A.res.kombi.combo.parts.avd.zulSpouse ?? 0) : null;
  const bits = [...(one != null ? [(kombi != null ? 'Altersvorsorgedepot ' : '') + n0(one) + ' €'] : []), ...(kombi != null ? ['Kombi ' + n0(kombi) + ' €'] : [])];
  return bits.join(', ');
}

const limitsText = (p: Params, zulSpouse = '') => [
  'Konstante Rendite jedes Jahr, keine Schwankungen und kein Sequenzrisiko.',
  taxText(p),
  ...(p.married ? [spouseAvdText(p, zulSpouse)] : []),
  salaryText(p),
  changeText(p),
  'Abgeltungsteuer ' + (p.kist > 0 ? pct((1.055 + p.kist) / (4 + p.kist)) + ' % einschließlich Soli und Kirchensteuer (§ 32d Abs. 1 S. 4 EStG: 25 % ermäßigt auf e/(4 + k))' : '26,375 %') +
    ', Teilfreistellung 30 % (Aktienfonds), Sparer-Pauschbetrag ' + (p.married ? '2.000 € (zusammen veranlagt; Partner ohne eigene Kapitalerträge außer den unten genannten angenommen) ' : '1.000 € ') +
    (p.indexAllowance ? 'wächst mit der Inflation (hypothetisch, Schalter indexAllowance)' : 'nominal fest') +
    (p.allowanceUsed > 0 ? '; davon ' + n0(p.allowanceUsed) + ' €/Jahr (heutiges Geld, wächst mit der Inflation) schon durch andere Kapitalerträge genutzt, für die eigenen Depots bleibt nominal ' + (p.married ? '2.000 €' : '1.000 €') + (p.indexAllowance ? ' × Inflationsfaktor' : '') + ' minus dieser Betrag, mindestens 0; wächst der Betrag nominal über den Pauschbetrag, fehlt der Überschuss der anderen Erträge in der Günstigerprüfung (§ 32d Abs. 6 EStG). Die Erben haben ihren eigenen vollen Pauschbetrag' + (p.married ? '; erbt der Partner, gilt im Todesjahr der gemeinsame Betrag abzüglich des genutzten' : '') : '') +
    ', Vorabpauschale mit Zufluss im Folgejahr.',
  'Jahresmodell: Beiträge monatlich, Entnahmen jährlich am Jahresanfang; offene Depots ' +
    (p.payResidual ? 'zahlen Restkapital ÷ Restjahre aus.' : 'zahlen eine nominal konstante Annuität aus, das AVD Restkapital ÷ Restjahre.'),
  p.shift ? 'Alle Produkte schichten vor Rentenbeginn um: ab 5 Jahre vorher 50 %, ab 2 Jahren 30 % Aktien, Rest mit safeRate.' : 'Keine Umschichtung vor Rentenbeginn.',
  'Nicht berücksichtigt: Erbschaftsteuer, Ordergebühren und Spreads, Betriebsrente (auch mit Arbeitgeberzuschuss), ' +
    (p.allowanceUsed > 0 ? 'andere Kapitalerträge außerhalb der verglichenen Produkte (nur ihr Verbrauch des Sparer-Pauschbetrags).' : 'andere Kapitalerträge außerhalb der verglichenen Produkte (Sparer-Pauschbetrag voll frei angenommen).'),
];

/** Steuertarif und Steuerprofil in Worten (Kirchensteuer, Zusammenveranlagung), passend zu assess() in combo.ts. */
function taxText(p: Params): string {
  const tariff = p.married
    ? 'Einkommensteuer Tarif 2026 (§ 32a EStG), Splittingtarif (zusammen veranlagt, § 32a Abs. 5) auf das gemeinsame zu versteuernde Einkommen; Partner ' + n0(p.incSpouse) + ' € vor und ' + n0(p.incSpouseRet) + ' € ab Rentenbeginn (heutiges Geld), Soli-Freigrenze verdoppelt'
    : 'Einkommensteuer Tarif 2026 (§ 32a EStG), Grundtarif ledig';
  const church = p.kist > 0
    ? 'Kirchensteuer ' + pct(p.kist) + ' % auf die festzusetzende Einkommensteuer einschließlich hinzugerechneter AVD-Zulage (§ 51a Abs. 2 EStG, ohne Kinderfreibeträge und ohne Kappung); gezahlte Kirchensteuer über ' + (p.married ? '72' : '36') + ' € ist im selben Jahr als Sonderausgabe abgezogen (§ 10 Abs. 1 Nr. 4, § 10c EStG)'
    : 'keine Kirchensteuer';
  const heirs = (p.kist > 0 || p.married ? ' Erben (incHeir) versteuern einzeln im Grundtarif mit 1.000 € Pauschbetrag' + (p.kist > 0 ? ' und demselben Kirchensteuersatz' : '') + '.' : '') +
    (p.married ? ' Erbt der Partner: Todesjahr gemeinsam veranlagt mit dem Partner-Einkommen (Splitting, 2.000 €, Einkommen der verstorbenen Person im Todesjahr 0); spätere Steuer auf das übertragene AVD mit incSpouseRet im Grundtarif.' : '');
  return tariff + ', mit Solidaritätszuschlag; Tarifgrenzen wachsen mit der Inflation; ' + church + '.' + (p.married ? '' : ' Kein Ehegattensplitting.') + heirs;
}

/** Was-wäre-wenn Steueränderung in Worten, passend zu abg()/estAddAt() in combo.ts. */
function changeText(p: Params): string {
  if (p.abgRate === .25 && p.estAdd === 0) return 'Steuerrecht: heute geltendes Recht (Stand 2026) für die ganze Laufzeit; künftige Gesetzesänderungen sind nicht vorweggenommen.';
  const from = p.taxFrom < 0 ? 'ab Rentenbeginn (Alter ' + p.R + ')' : 'ab Alter ' + Math.max(p.taxFrom, p.a0);
  const bits = [
    ...(p.abgRate !== .25 ? ['Abgeltungsteuersatz ' + pct(p.abgRate) + ' % statt 25 % (mit Soli' + (p.kist > 0 ? ' und Kirchensteuer: ESt = e · s/(1 + s · k), verallgemeinert aus § 32d Abs. 1 S. 4 EStG' : '') + '; Teilfreistellung und Sparer-Pauschbetrag unverändert)'] : []),
    ...(p.estAdd !== 0 ? ['Grenzsteuersatz der Einkommensteuer oberhalb des Grundfreibetrags um ' + pct(p.estAdd) + ' Prozentpunkte ' + (p.estAdd > 0 ? 'höher' : 'niedriger') + ' (tarifliche ESt + Satz × (zvE − 12.348 €), heutiges Geld; Soli und Kirchensteuer darauf)'] : []),
  ];
  return 'Was-wäre-wenn Steueränderung (hypothetisch, keine angekündigte Rechtslage): ' + from + ' ' + bits.join('; ') + '. Gilt für alle Zahlungen und Verkäufe ab diesem Jahr, auch für Erben, ohne Bestandsschutz; Beiträge und Erstattungen davor nach heutigem Recht.';
}

/** Partner-Vertrag (avdSpouse) in Worten, passend zum AVD-Block in combo.ts. */
function spouseAvdText(p: Params, zulSpouse: string): string {
  if (!(p.avdSpouse > 0)) return 'Partner ohne eigenen geförderten Altersvorsorgevertrag: Günstigerprüfung nur mit den eigenen Beiträgen und der eigenen Zulage (§ 10a Abs. 3 S. 1 EStG).';
  const m = n2(p.avdSpouse) + ' €/Monat (× (1 + Dynamik)^Jahr bis vor Rentenbeginn)';
  const tail = ' Die AVD-Erstattung ist die Änderung der gemeinsamen Steuer durch den eigenen Vertrag (kann negativ sein: Mehrsteuer, mit Wiederanlage aus dem Nebendepot bezahlt, ein ungedeckter Rest bei Rentenbeginn ohne Zins abgezogen); der Partner-Vertrag selbst ist nicht im Vergleich, seine Auszahlungen gehören in das Partner-Einkommen ab Rentenbeginn. Zurechnung für die Förderrückzahlung im Erbfall im Verhältnis der geförderten Eigenbeiträge (§ 10a Abs. 4 S. 3–4).';
  if (p.incSpouse > 0) return 'Partner zahlt ' + m + ' in einen eigenen geförderten Vertrag; mit eigenem Einkommen als unmittelbar förderberechtigt angenommen (rentenversichert, verbeamtet oder selbständig, § 10a Abs. 1 EStG n. F.): eigene Grundzulage aus dem eigenen Beitrag (ab 120 €/Jahr, § 84 S. 1, § 86 n. F.), eigener Höchstbetrag 1.800 €. Die Günstigerprüfung vergleicht die Steuerersparnis beider Abzüge mit beiden Zulagen (§ 10a Abs. 3 S. 5; BMF 05.10.2023 Rn. 110). Diese Ausgangslage gilt für alle Produkte (auch in der Günstigerprüfung der Kapitalerträge).' + tail;
  return 'Partner zahlt ' + m + ' in einen eigenen geförderten Vertrag; ohne eigenes Einkommen als mittelbar zulageberechtigt angenommen (§ 79 S. 2 EStG; nur in Jahren mit eigenem gefördertem Beitrag ab 120 € und einem Partner-Beitrag ab 120 €/Jahr). Partner-Grundzulage aus den eigenen geförderten Beiträgen, höchstens 175 € (§ 84 S. 3–4 n. F.); bei der eigenen Veranlagung zählen beide Beiträge (eigene vorrangig, zusammen bis 1.920 €) und beide Zulagen (§ 10a Abs. 3 S. 2–4 n. F.; BMF Rn. 109). Ohne eigenen Vertrag gäbe es keine Zulage und keinen Abzug für den Partner (BMF Rn. 26/27).' +
    (zulSpouse ? ' Die Partner-Zulage fließt in den Partner-Vertrag und ist nicht im Ergebnis enthalten, zusammen nominal: ' + zulSpouse + '.' : '') + tail;
}

/** Gehaltsverlauf in Worten, passend zu incomeAt (core.ts) einschließlich der Randfälle. */
function salaryText(p: Params): string {
  const kind = incomePathKind(p), gr = incomeGrowth(p);
  const tail = ' (heutiges Geld). Werte je Jahr unter „Einkommen vor Rentenbeginn“. Beiträge folgen dem Gehalt nicht (nur der Dynamik).';
  if (kind === 'off') return 'Das Einkommen im Beruf bleibt real gleich (keine Gehaltsentwicklung), abgesehen von einer Ausbildungsphase.';
  if (kind === 'noWork') return 'Gehaltsentwicklung eingetragen, aber ohne Wirkung: Die Ausbildung dauert bis zum Rentenbeginn (Alter ' + p.studyEnd + '), gerechnet wird durchgehend mit dem Einkommen in der Ausbildung ' + n0(p.incStudy) + ' €.';
  if (kind === 'now') return 'Gehaltsentwicklung: Das Zielalter ' + p.incPeakAge + ' liegt nicht nach dem Beginn des Verlaufs (' + incomeStartText(p) + '); gerechnet wird ' + incomeStartText(p) + ' durchgehend mit dem Zielgehalt ' + n0(p.incPeak) + ' €, das Gehalt ' + n0(p.incWork) + ' € wirkt nicht' + tail;
  const growth = (gr != null ? ' mit konstantem realem Wachstum (' + pct(gr) + ' % p. a.)' : ' linear');
  if (kind === 'late') return 'Gehaltsentwicklung: ' + incomeStartText(p) + ' ' + n0(p.incWork) + ' €,' + growth + ' Richtung ' + n0(p.incPeak) + ' € mit Alter ' + p.incPeakAge + '; das Zielalter liegt nach Rentenbeginn, zuletzt (Alter ' + (p.R - 1) + ') ' + n0(incomeAt(p, p.R - 1)) + ' €' + tail;
  return 'Gehaltsentwicklung: ' + incomeStartText(p) + ' ' + n0(p.incWork) + ' €, bis Alter ' + p.incPeakAge + growth + ' auf ' + n0(p.incPeak) + ' €, danach konstant' + tail;
}

const pct = (x: number) => String(+(x * 100).toFixed(4)).replace('.', ',');
const n0 = (x: number) => isFinite(x) ? (Math.round(x) + 0).toLocaleString('de-DE') : '–';
const n2 = (x: number) => x.toLocaleString('de-DE', { maximumFractionDigits: 2 });
const n4 = (x: number) => x.toLocaleString('de-DE', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
const fmtVal = (v: Inputs[InputKey]) => typeof v === 'boolean' ? (v ? 'ja' : 'nein') : String(v).replace('.', ',');

/** Eingaben, die als Prozent eingegeben und in Params als Anteil geführt werden. */
const PCT = new Set<string>(['g', 'gPay', 'infl', 'dyn', 'basis', 'etfTer', 'avdCost', 'insEff', 'fondAA', 'fondTer', 'kvRate', 'safeRate', 'kist', 'abgRate', 'estAdd', 'avdPayCost', 'etfPayTer', 'fondPayTer']);

/** Prozentfelder, bei denen −1 „wie die Ansparkosten“ bedeutet; andere dürfen negativ sein (Rendite, Inflation …). */
const SENTINEL = new Set<string>(['avdPayCost', 'etfPayTer', 'fondPayTer']);

/** Wert, mit dem die Engine tatsächlich rechnet (nach Grenzen und Rundung in readParams), in der Einheit der Eingabe; null = nicht in Params. */
function effective(p: Params, key: InputKey): number | boolean | null {
  const on: Partial<Record<InputKey, ProductKey>> = { etfOn: 'etf', avdOn: 'avd', insOn: 'ins', fondOn: 'fond' };
  if (on[key]) return p.on[on[key]!];
  if (!(key in p)) return null;
  const v = (p as unknown as Record<string, number | boolean>)[key];
  if (typeof v !== 'number' || !PCT.has(key) || (SENTINEL.has(key) && v < 0)) return v;
  return +(v * 100).toFixed(6);
}

interface Row { own: number; ownReal: number; capR: number; foerder: number; vals: (number | null)[]; net: number[]; incTax: number[]; abgTax: number[]; kv: number[] }

function rowsOf(A: Analysis, k: ContenderKey): { name: string; monthly: number; r: Row } | null {
  const pr = A.active.find(x => x.key === k);
  if (!pr) return null;
  if (k === 'kombi') {
    const kr = A.res.kombi!;
    // kombiResult.vals hat nur T Einträge; hier wie bei den Teilen T + 1 (Index t + 1 = Ende von Jahr t).
    const parts = Object.values(kr.combo.parts);
    const vals = Array.from({ length: A.T + 1 }, (_, i) => {
      let v: number | null = null;
      for (const r of parts) { const x = r.vals[i]; if (x != null) v = (v ?? 0) + x; }
      return v;
    });
    return { name: pr.name, monthly: splitSum(kr.split), r: { ...kr, vals, incTax: kr.combo.incTax, abgTax: kr.combo.abgTax, kv: kr.combo.kv } };
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

  out.push('## Eingaben', '', '„Gerechnet“ ist der Wert nach den Grenzen der Engine (z. B. Rentenbeginn 65–70, Auszahlplan bis 85–100); leer = wie eingegeben.', '',
    '| Schlüssel | Bedeutung | Eingabe | Gerechnet | Einheit |', '|---|---|---:|---:|---|');
  for (const key of INPUT_KEYS) {
    const [label, unit] = LABELS[key];
    const eff = effective(p, key), raw = inputs[key];
    const differs = eff != null && (typeof eff === 'boolean' ? eff !== raw : Math.abs(eff - Number(raw)) > 1e-9);
    out.push(`| ${key} | ${label} | ${fmtVal(raw)} | ${differs ? fmtVal(eff!) : ''} | ${unit} |`);
  }
  out.push('');
  if (A.res.kombi) {
    const sp = A.res.kombi.split;
    out.push(`Die Kombi wird mit dieser Aufteilung gerechnet (auf den Monatsbeitrag ${n2(splitSum(sp))} € skaliert): ` +
      `ETF ${n2(sp.etf)} €, AVD ${n2(sp.avd)} €, Versicherung ${n2(sp.ins)} €, aktiver Fonds ${n2(sp.fond)} € im Monat.`, '');
  }
  out.push('## Modellgrenzen', '', ...limitsText(p, spouseZul(A)).map(x => '- ' + x), '');

  out.push('## Ergebnis', '');
  out.push(`Zeitraum für den Vergleich: Rentenbeginn mit ${p.R} bis zum Ende des Auszahlplans mit ${p.H} (${tH - n} Jahre). ` +
    `„Heutige Kaufkraft“ = nominal ÷ (1 + ${pct(p.infl)} %)^Jahr.`, '');
  out.push('| Teilnehmer | Eigenbeiträge nominal | Eigenbeiträge heutige Kaufkraft | Förderung nominal | Kapital bei Rentenbeginn nominal | Ø Monat netto | Summe netto bis H | Summe netto bis H, heutige Kaufkraft | Einmalauszahlung netto |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const pr of A.active) {
    const x = rowsOf(A, pr.key)!, s = A.stats[pr.key]!;
    out.push(`| ${x.name} | ${n0(x.r.own)} | ${n0(x.r.ownReal)} | ${n0(x.r.foerder)} | ${n0(x.r.capR)} | ${n0(s.avgMonthly)} | ${n0(s.cumH)} | ${n0(s.cumHReal)} | ${n0(s.lump)} |`);
  }
  out.push('', `Ø Monat, Summe bis H und Einmalauszahlung in der Anzeige-Einheit (${p.real ? 'heutige Kaufkraft' : 'nominal'}); Abstände zwischen den Produkten immer in heutiger Kaufkraft.`, '');
  out.push('Der Rechner bewertet die Produkte nicht. Er zeigt Beträge, Abstände und die Annahmen, an denen sie hängen.', '');
  if (A.canRank && A.active.length > 1) {
    out.push('### Abstände', '', ...A.active.slice(1).map(pr => '- ' + gapText(A, pr, A.active[0])), '');
    const be = costBreakEvens(A);
    if (be.length) {
      out.push('### Kosten-Gleichstand mit dem ETF-Depot', '',
        `Kostensatz, bei dem die Summe netto bis Alter ${p.H} (heutige Kaufkraft) gleich der des ETF-Depots ist. Gesucht per Bisektion zwischen 0 % und ${pct(Math.max(MAX_COST, ...be.map(b => b.cap)))} % (Suchintervall am Ende höchstens 0,005 Prozentpunkte breit, angegeben ist dessen Mitte, gerundet auf 0,01 Prozentpunkte) mit derselben Rechnung; alle anderen Eingaben unverändert.`, '',
        ...be.map(b => '- ' + breakEvenText(A, b)), '');
    }
  } else if (A.active.length < 2) out.push('Nur ein Produkt im Vergleich: keine Abstände und kein Kosten-Gleichstand.', '');
  else out.push('Kein fairer Vergleich (ungleiche Beiträge oder ausgegebene Steuererstattung): keine Abstände und kein Kosten-Gleichstand.', '');

  if (p.incPeak >= 0) {
    out.push('## Einkommen vor Rentenbeginn', '', 'Zu versteuerndes Einkommen, mit dem die Ansparphase gerechnet ist (Günstigerprüfung AVD, Kapitalerträge), in heutigem Geld.', '',
      '| Jahr | Alter | Zu versteuerndes Einkommen |', '|---:|---:|---:|');
    for (let t = 0; t < n; t++) out.push(`| ${t} | ${p.a0 + t} | ${n0(incomeAt(p, p.a0 + t))} |`);
    out.push('');
  }
  out.push('## Jahreswerte', '');
  out.push('Alle Beträge nominal in €. „Jahr“ zählt ab heute (Jahr 0 = erstes Sparjahr). Beitrag = eigener Beitrag (Monatsbeitrag × 12 × (1 + Dynamik)^Jahr bis vor Rentenbeginn), ohne Zulagen und Steuererstattungen.',
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
