// Jahreswerte als Text für Oberfläche, Glossar, Rechenweg und Hinweise: aus der Rechtsstand-Tabelle erzeugt, damit
// eine neue Tabelle (law.ts) keinen Text vergisst. LT ist die neueste Tabelle (CURRENT_LAW); lawText(L) für Tests.
// Struktur des Gesetzes (Teilfreistellung 30 %, Altersgrenze 25, Fahrplan des Besteuerungsanteils …) bleibt im Text.
import { CURRENT_LAW, type Law } from './engine/law';

export function lawText(L: Law) {
  const n = (x: number) => x.toLocaleString('de-DE');
  const e = (x: number) => n(x) + ' €';
  const p1 = (x: number) => x.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' %';
  const p = (x: number) => x.toLocaleString('de-DE', { maximumFractionDigits: 3 }) + ' %';
  const { avd, kv, abg } = L;
  /** Abgeltungsteuer einschließlich Soli und Kirchensteuer k (§ 32d Abs. 1 S. 4 EStG), in %. */
  const abgKist = (k: number) => p((abg.soliFactor + k) / (abg.divisor + k) * 100);
  return {
    year: String(L.year),
    /** Sparer-Pauschbetrag je Person / zusammen veranlagt */
    spb: e(L.spb), spb2: e(2 * L.spb),
    saPausch: e(L.saPausch), saPausch2: e(2 * L.saPausch),
    wkRente: e(L.wkPauschRente),
    gfb: e(L.tariff.gfb),
    kvBbg: e(L.kvBbg), kvJaeg: e(L.kvJaeg),
    kvGeneral: p1(kv.general), kvReduced: p1(kv.reduced), zusatz: p1(kv.zusatzAvg),
    pv: p1(kv.pv), pvChildless: p1(kv.pvChildless), pvNoKids: p1(kv.pv + kv.pvChildless),
    /** Beitragssatz freiwillig Versicherter ohne Krankengeld: kinderlos / mit Kind */
    kvVolNoKids: p1(kv.reduced + kv.zusatzAvg + kv.pv + kv.pvChildless), kvVolKids: p1(kv.reduced + kv.zusatzAvg + kv.pv),
    basiszins: p1(L.basiszins * 100), basiszinsSource: L.basiszinsSource,
    abg: p(abg.rate * 100), abgSoli: p(abg.withSoli * 100), abgKist9: abgKist(9 / 100), abgKist8: abgKist(8 / 100),
    avdSubMax: e(avd.subMax), avdMax: e(avd.max), avdSubMaxM: e(avd.subMax / 12), avdMaxM: e(avd.max / 12),
    /** Förderhöchstbetrag je Monat als Zahl ohne € (Beschriftung „max. 150 gefördert“) */
    avdSubMaxMNum: n(avd.subMax / 12),
    avdMinOwn: e(avd.minOwn),
    grundRate1: p(avd.grundRate1 * 100), grundTop1: e(avd.grundTop1), grundRate2: p(avd.grundRate2 * 100),
    grundMax: e(avd.grundRate1 * avd.grundTop1 + avd.grundRate2 * (avd.grundTop2 - avd.grundTop1)),
    kid: e(avd.kid), bonus: e(avd.bonus),
    spouseMinOwn: e(avd.spouseMinOwn), spouseGrundMax: e(avd.spouseGrundMax), avdSubMaxSpouse: e(avd.subMax + avd.spouseRaise),
  };
}

export type LawText = ReturnType<typeof lawText>;
export const LT: LawText = lawText(CURRENT_LAW);
