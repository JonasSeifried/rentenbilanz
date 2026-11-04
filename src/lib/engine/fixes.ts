// Korrekturen gegenüber dem Original (legacy/index.html), einzeln schaltbar.
// Standard überall: ALL_FIXES. Mit NO_FIXES rechnet die Engine bitgleich zum Original (tests/golden.test.ts).
// Herleitung, Rechtsquellen und Wirkung je Korrektur: docs/abweichungen-vom-original.md.

export type FixId = 'rankReal' | 'heirTax' | 'bonusOutsideSA' | 'kvInvestBase' | 'kvSharedRoom' | 'kvLumpSpread' | 'avdUnsubsidized' | 'kvDeductible' | 'avdSmallContribution' | 'taxRounding' | 'vpTaxSale';

export type FindingId = 'E1' | 'E2' | 'E3' | 'E6' | 'E7' | 'E8' | 'E10' | 'R1' | 'R6' | 'R8' | 'R2';

export const FIXES: Readonly<Record<FixId, { finding: FindingId; title: string }>> = Object.freeze({
  vpTaxSale: { finding: 'R2', title: 'Vorabpauschalensteuer aus dem Depot: Verkauf einschließlich eigener Gewinnsteuer und KV' },
  kvDeductible: { finding: 'R1', title: 'Zusätzliche KV/PV im Alter als Sonderausgaben abziehen' },
  avdSmallContribution: { finding: 'R6', title: 'AVD: Sonderausgabenabzug auch unter 120 € Jahresbeitrag, ohne Zulagen' },
  taxRounding: { finding: 'R8', title: 'Einkommen und Einkommensteuer im nominalen Steuerjahr auf volle Euro abrunden' },
  rankReal: { finding: 'E1', title: 'Rangfolge und fairer Vergleich immer in heutiger Kaufkraft, unabhängig von der Anzeige' },
  heirTax: { finding: 'E2', title: 'AVD-Erbfall: Erben versteuern die Erträge mit ihrem eigenen Einkommen; hälftig nur, wenn der Erbe mindestens 62 ist' },
  bonusOutsideSA: { finding: 'E3', title: 'Berufseinsteigerbonus zählt nicht in der Günstigerprüfung' },
  kvInvestBase: { finding: 'E6', title: 'KV auf Fondserträge: 70 % (Teilfreistellung) von Entnahmegewinn und Vorabpauschale' },
  kvSharedRoom: { finding: 'E7', title: 'KV: Beitragsbemessungsgrenze gilt für alle laufenden Einnahmen eines Produkts zusammen' },
  kvLumpSpread: { finding: 'E8', title: 'KV auf die Kapitalauszahlung der Versicherung über 10 Jahre aus den Entnahmen statt sofort' },
  avdUnsubsidized: { finding: 'E10', title: 'AVD: Eigenbeiträge über 1.800 €/Jahr bleiben bis 6.840 €/Jahr ungefördert im Vertrag (AVD-Kosten, kein Steuerabzug in der Ansparphase, bei Auszahlung nur der Gewinnanteil steuerpflichtig, nach 12 Jahren zur Hälfte) statt im ETF-Nebendepot' },
});

export const FIX_IDS: readonly FixId[] = Object.freeze(Object.keys(FIXES) as FixId[]);

/** Alle Korrekturen: Standard in der App und überall, wo keine Optionen übergeben werden. */
export const ALL_FIXES: ReadonlySet<FixId> = new Set(FIX_IDS);
/** Keine Korrektur: exakt das Original (Golden-Test). */
export const NO_FIXES: ReadonlySet<FixId> = new Set();

export interface EngineOptions {
  /** Aktive Korrekturen; undefined ⇒ ALL_FIXES. */
  fixes?: ReadonlySet<FixId>;
}

export function fixesOf(opts?: EngineOptions): ReadonlySet<FixId> {
  return opts?.fixes ?? ALL_FIXES;
}
