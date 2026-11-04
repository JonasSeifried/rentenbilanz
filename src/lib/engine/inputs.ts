// Alle Eingaben des Rechners. Die Schlüssel entsprechen den Feld-IDs im Original (legacy/index.html),
// damit die Golden-Tests dieselben Werte in beide Engines geben können.

export interface Inputs {
  // Eckdaten
  a0: number; incWork: number; incRet: number; setAll: number; g: number; R: number; kvOn: boolean;
  etfOn: boolean; avdOn: boolean; insOn: boolean; fondOn: boolean;
  // Rente im Detail
  H: number; gPay: number; einmal: boolean; insLump: boolean; rf: number; gz: number;
  // Erbfall
  deathAge: number; heirHalf: boolean; incHeir: number;
  // Weitere Einstellungen
  studyEnd: number; incStudy: number; eligStudy: boolean; kvRate: number;
  infl: number; dyn: number; basis: number;
  etfM: number; etfTer: number;
  avdM: number; avdCost: number; kids: number; kidsFrom: number; kidsYears: number; bonus: boolean; reinvest: boolean;
  avdStd: boolean; avdSafe: number;
  insM: number; insEff: number;
  fondM: number; fondAA: number; fondTer: number;
  // KV-Frage (nur Oberfläche, die Rechnung nutzt kvOn)
  kvKind: number;
  // Anzeige
  real: boolean;
  // Kombi: der Monatsbeitrag (setAll), auf mehrere Produkte aufgeteilt, als weiterer Teilnehmer im Vergleich
  combo: boolean; cEtf: number; cAvd: number; cIns: number; cFond: number;
}

export type InputKey = keyof Inputs;

/**
 * Neutrale Standardwerte: Berufseinsteiger mit 22 ohne Studium, ca. 45.000 € brutto
 * (≈ 38.000 € zu versteuern), 150 € im Monat je Produkt, Versicherung mit Kapitalauszahlung.
 * Anmerkungen:
 * - kvRate 21,1 % = 14,0 % ermäßigter allgemeiner Satz (Rente, § 243 SGB V) + durchschnittlicher Zusatzbeitrag
 *   + Pflegeversicherung (Befund E5). Link-Basis bleibt 21,7 (siehe link.ts).
 * - heirHalf: Mit der Korrektur E2 (Fix `heirTax`) bedeutet es „Erbe ist bei der Auszahlung mindestens 62“
 *   (AVD-Erträge dann zur Hälfte versteuert). incHeir = zu versteuerndes Einkommen der Erben (€/Jahr).
 * - kvKind: 0 = KVdR/Pflichtversicherung, 1 = freiwillig gesetzlich, 2 = privat, 3 = weiß nicht.
 *   Wirkt nur in der Oberfläche; gerechnet wird ausschließlich mit kvOn.
 * - combo = Kombi im Vergleich; c* = ihre Aufteilung in €. Sie gehört nicht zu CONTRIB_KEYS; gerechnet wird sie
 *   immer proportional auf setAll gebracht (readKombi in combo.ts), damit gleich viel eigenes Geld hineinfließt.
 * - avdStd = Standarddepot mit gesetzlicher Umschichtung vor Rentenbeginn (§ 1 Abs. 1c Nr. 5 AltZertG), avdSafe = Rendite
 *   des sicheren Fonds in % p. a. Standard aus: Die 0,5 % Kosten unterstellen ein selbst gewähltes Depot ohne Umschichtung.
 * studyEnd = 16 heißt „keine Ausbildungsphase“ (die Engine klemmt auf das Alter heute).
 */
export const DEFAULTS: Readonly<Inputs> = Object.freeze({
  a0: 22, incWork: 38000, incRet: 20000, setAll: 150, g: 6, R: 67, kvOn: false,
  etfOn: true, avdOn: true, insOn: true, fondOn: false,
  H: 90, gPay: 4, einmal: false, insLump: true, rf: 30, gz: 10,
  deathAge: 50, heirHalf: false, incHeir: 38000,
  studyEnd: 16, incStudy: 12000, eligStudy: true, kvRate: 21.1,
  infl: 2, dyn: 0, basis: 3.2,
  etfM: 150, etfTer: 0.2,
  avdM: 150, avdCost: 0.5, kids: 0, kidsFrom: 32, kidsYears: 25, bonus: true, reinvest: true,
  avdStd: false, avdSafe: 2,
  insM: 150, insEff: 0.9,
  fondM: 150, fondAA: 5, fondTer: 1.6,
  kvKind: 0,
  real: true,
  combo: false, cEtf: 0, cAvd: 0, cIns: 0, cFond: 0,
});

export const INPUT_KEYS = Object.keys(DEFAULTS) as InputKey[];
export const BOOL_KEYS = new Set(INPUT_KEYS.filter(k => typeof DEFAULTS[k] === 'boolean'));
export const CONTRIB_KEYS = ['etfM', 'avdM', 'insM', 'fondM'] as const;

export const COMBO_KEYS = ['combo', 'cEtf', 'cAvd', 'cIns', 'cFond'] as const;
/** Schlüssel, die es im Original (legacy/index.html) als Eingabefeld gibt; nur diese gehen in den Golden-Test. */
const NEW_KEYS: ReadonlySet<string> = new Set(['incHeir', 'kvKind', 'avdStd', 'avdSafe', ...COMBO_KEYS]);
export const LEGACY_KEYS: readonly InputKey[] = INPUT_KEYS.filter(k => !NEW_KEYS.has(k));

export type NumericKey = { [K in InputKey]: Inputs[K] extends number ? K : never }[InputKey];
export const NUMERIC_KEYS = INPUT_KEYS.filter(k => typeof DEFAULTS[k] === 'number') as NumericKey[];

/**
 * Plausibilitätsgrenzen je numerischem Schlüssel [von, bis], beide inklusive. Keine Engine-Klemmen
 * (die liegen in readParams), sondern Schutz vor Unsinn aus Link, Speicher und Eingabefeldern.
 */
export const LIMITS: Readonly<Record<NumericKey, readonly [number, number]>> = Object.freeze({
  a0: [0, 150], R: [0, 150], H: [0, 150], deathAge: [0, 150], studyEnd: [0, 150], kidsFrom: [0, 150],
  incWork: [0, 1e8], incRet: [0, 1e8], incStudy: [0, 1e8], incHeir: [0, 1e8],
  setAll: [0, 1e6], etfM: [0, 1e6], avdM: [0, 1e6], insM: [0, 1e6], fondM: [0, 1e6],
  cEtf: [0, 1e6], cAvd: [0, 1e6], cIns: [0, 1e6], cFond: [0, 1e6],
  g: [-100, 100], gPay: [-100, 100], infl: [-100, 100], dyn: [-100, 100],
  etfTer: [0, 100], avdCost: [0, 100], insEff: [0, 100], fondTer: [0, 100],
  kvRate: [0, 100], basis: [0, 100], fondAA: [0, 100], avdSafe: [-100, 100],
  kids: [0, 20], kidsYears: [0, 100], gz: [0, 100], rf: [0, 10000], kvKind: [0, 3],
} satisfies Record<NumericKey, readonly [number, number]>);

export function inLimits(key: InputKey, v: number): boolean {
  const l = (LIMITS as Record<string, readonly [number, number]>)[key];
  return !l || (isFinite(v) && v >= l[0] && v <= l[1]);
}
