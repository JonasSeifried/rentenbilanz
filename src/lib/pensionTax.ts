// Hilfsrechnung „Einkommen im Alter“ (incRet) aus der Bruttorente laut Renteninformation. Nur Oberfläche, keine
// Engine-Änderung: Das Ergebnis kann ins Feld incRet übernommen werden (zu versteuerndes Einkommen ohne die
// verglichenen Produkte, nach KV/PV auf die Rente, heutiges Geld). Rechtsgrundlagen:
// - Besteuerungsanteil: § 22 Nr. 1 S. 3 Buchst. a Doppelbuchst. aa EStG (Tabelle i. d. F. des Wachstumschancengesetzes:
//   2020 80 %, 2021 81 %, 2022 82 %, ab 2023 +0,5 Prozentpunkte je Jahr, ab 2058 100 %).
//   Der steuerfreie Teil (Rentenfreibetrag) bleibt für die gesamte Laufzeit in Euro fest; regelmäßige Anpassungen
//   führen nicht zur Neuberechnung (S. 4–7).
// - Werbungskosten-Pauschbetrag 102 € (§ 9a S. 1 Nr. 3 EStG), höchstens bis zur Höhe der Einnahmen.
// - Sonderausgaben-Pauschbetrag 36 € (§ 10c EStG; gilt nicht für Vorsorgeaufwendungen, daher zusätzlich zur KV/PV).
// - KV/PV auf die gesetzliche Rente: KV (allgemeiner Satz 14,6 % und Zusatzbeitrag) je zur Hälfte mit dem Rentenversicherungsträger
//   (§ 249a SGB V), PV allein (§ 59 Abs. 1 SGB XI). Als Basis-KV/PV voll abziehbar (§ 10 Abs. 1 Nr. 3, Abs. 4 S. 4 EStG),
//   ohne 4-%-Kürzung, weil Rentner keinen Krankengeldanspruch haben (§ 10 Abs. 1 Nr. 3 Buchst. a S. 4).
// Heutiges Geld: Die Rente wächst im Modell mit der Inflation (real gleich). Feste Euro-Beträge (Rentenfreibetrag, 102 €, 36 €)
// verlieren dadurch real an Wert; der Durchschnitt über die Auszahljahre ist der Vorschlag zur Übernahme.

/** Besteuerungsanteil der gesetzlichen Rente in Prozent nach dem Jahr des Rentenbeginns. */
export function taxSharePct(year: number): number {
  const y = Math.floor(year);
  if (y <= 2005) return 50;
  if (y <= 2020) return 50 + 2 * (y - 2005);
  if (y <= 2022) return 80 + (y - 2020);
  return Math.min(100, 82 + 0.5 * (y - 2022));
}

/** Allgemeiner KV-Beitragssatz (§ 241 SGB V) und PV-Satz 2026 (§ 55 SGB XI: 3,6 %, kinderlos +0,6 %). */
export const KV_GENERAL = 14.6;
export const PV_RATE = 3.6, PV_CHILDLESS = 0.6;
/** Durchschnittlicher Zusatzbeitrag 2026 (BMG-Bekanntmachung), Vorschlag. */
export const ZUSATZ_AVG = 2.9;
export const WK_PAUSCH = 102, SA_PAUSCH = 36;

export interface PensionInput {
  /** Monatliche Bruttorente laut Renteninformation (heutiges Geld). */
  monthly: number;
  /** Kalenderjahr des Rentenbeginns. */
  startYear: number;
  /** Gesetzlich versichert (KVdR oder freiwillig): Beiträge nach Satz; sonst privat mit eigenem Betrag. */
  statutory: boolean;
  /** Zusatzbeitrag der Krankenkasse in %. */
  zusatz: number;
  /** Kinderlos (PV-Zuschlag 0,6 %). */
  childless: boolean;
  /** Privat versichert: abziehbarer Basisbeitrag KV/PV im Jahr, nach Abzug des Zuschusses der Rentenversicherung (heutiges Geld). */
  privateKv: number;
  /** Weitere zu versteuernde Einkünfte im Alter (heutiges Geld), bereits nach deren eigenen Abzügen. */
  other: number;
  /** Jahre von heute bis Rentenbeginn und Zahl der Auszahljahre (Rentenbeginn bis Auszahlplan-Ende). */
  yearsToStart: number; payYears: number;
  /** Inflation als Anteil (0,02). */
  infl: number;
}

export interface PensionYear {
  /** Jahre nach Rentenbeginn. */
  k: number;
  /** Alles in heutigem Geld (€/Jahr). */
  free: number; wk: number; sa: number; zve: number;
}

export interface PensionResult {
  gross: number; sharePct: number;
  /** Rentenfreibetrag bei Rentenbeginn (heutiges Geld). */
  freeStart: number;
  /** Beitragssatz des Rentners in % (gesetzlich) bzw. null (privat). */
  kvRatePct: number | null;
  kv: number;
  /** Zu versteuerndes Einkommen im ersten, im letzten Auszahljahr und im Durchschnitt (heutiges Geld). */
  start: PensionYear; end: PensionYear; avg: number;
  /** Vorschlag für incRet: Durchschnitt, auf 100 € gerundet. */
  suggestion: number;
}

/** Beitragssatz des Rentners auf die gesetzliche Rente in Prozent (Hälfte KV inkl. Zusatzbeitrag, volle PV). */
export function retireeKvRatePct(zusatz: number, childless: boolean): number {
  return Math.round(((KV_GENERAL + zusatz) / 2 + PV_RATE + (childless ? PV_CHILDLESS : 0)) * 1e6) / 1e6;
}

export function pensionTax(x: PensionInput): PensionResult {
  const gross = Math.max(0, x.monthly) * 12;
  const sharePct = taxSharePct(x.startYear);
  const freeStart = gross * (1 - sharePct / 100);
  const kvRatePct = x.statutory ? retireeKvRatePct(Math.max(0, x.zusatz), x.childless) : null;
  const kv = kvRatePct != null ? gross * kvRatePct / 100 : Math.max(0, x.privateKv);
  const other = Math.max(0, x.other);
  const I = (t: number) => Math.pow(1 + x.infl, t);
  const year = (k: number): PensionYear => {
    const t = x.yearsToStart + k;
    // Rentenfreibetrag nominal fest ab Rentenbeginn: real bei Beginn freeStart, danach / (1 + Inflation)^k.
    const free = freeStart / Math.pow(1 + x.infl, k);
    const wk = Math.min(gross, WK_PAUSCH / I(t)), sa = SA_PAUSCH / I(t);
    return { k, free, wk, sa, zve: Math.max(0, gross - free - wk + other - kv - sa) };
  };
  const yrs = Math.max(1, Math.round(x.payYears));
  let sum = 0; for (let k = 0; k < yrs; k++) sum += year(k).zve;
  const avg = sum / yrs;
  return { gross, sharePct, freeStart, kvRatePct, kv, start: year(0), end: year(yrs - 1), avg, suggestion: Math.round(avg / 100) * 100 };
}
