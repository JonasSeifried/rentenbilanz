// Alle Eingaben des Rechners. Die Schlüssel entsprechen den Feld-IDs im Original (legacy/index.html),
// damit die Golden-Tests dieselben Werte in beide Engines geben können.

export interface Inputs {
  // Eckdaten
  a0: number; incWork: number; incRet: number; setAll: number; g: number; R: number; kvOn: boolean;
  etfOn: boolean; avdOn: boolean; insOn: boolean; fondOn: boolean;
  // Rente im Detail
  H: number; gPay: number; einmal: boolean; insLump: boolean; rf: number; gz: number;
  // Erbfall
  deathAge: number; heirHalf: boolean;
  // Weitere Einstellungen
  studyEnd: number; incStudy: number; eligStudy: boolean; kvRate: number;
  infl: number; dyn: number; basis: number;
  etfM: number; etfTer: number;
  avdM: number; avdCost: number; kids: number; kidsFrom: number; kidsYears: number; bonus: boolean; reinvest: boolean;
  insM: number; insEff: number;
  fondM: number; fondAA: number; fondTer: number;
  // Anzeige
  real: boolean;
}

export type InputKey = keyof Inputs;

/**
 * Neutrale Standardwerte: Berufseinsteiger mit 22 ohne Studium, ca. 45.000 € brutto
 * (≈ 38.000 € zu versteuern), 150 € im Monat je Produkt, Versicherung mit Kapitalauszahlung.
 * studyEnd = 16 heißt „keine Ausbildungsphase“ (die Engine klemmt auf das Alter heute).
 */
export const DEFAULTS: Readonly<Inputs> = Object.freeze({
  a0: 22, incWork: 38000, incRet: 20000, setAll: 150, g: 6, R: 67, kvOn: false,
  etfOn: true, avdOn: true, insOn: true, fondOn: false,
  H: 90, gPay: 4, einmal: false, insLump: true, rf: 30, gz: 10,
  deathAge: 50, heirHalf: false,
  studyEnd: 16, incStudy: 12000, eligStudy: true, kvRate: 21.7,
  infl: 2, dyn: 0, basis: 3.2,
  etfM: 150, etfTer: 0.2,
  avdM: 150, avdCost: 0.5, kids: 0, kidsFrom: 32, kidsYears: 25, bonus: true, reinvest: true,
  insM: 150, insEff: 0.9,
  fondM: 150, fondAA: 5, fondTer: 1.6,
  real: true,
});

export const INPUT_KEYS = Object.keys(DEFAULTS) as InputKey[];
export const BOOL_KEYS = new Set(INPUT_KEYS.filter(k => typeof DEFAULTS[k] === 'boolean'));
export const CONTRIB_KEYS = ['etfM', 'avdM', 'insM', 'fondM'] as const;
