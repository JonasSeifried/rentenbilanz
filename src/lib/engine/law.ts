// Rechtsstand-Tabellen: alle gesetzlichen Jahreswerte und Beträge, mit denen gerechnet wird, an genau einer Stelle.
// Jede Tabelle ist eingefroren und wird nie geändert. Ein neues Jahr bekommt eine neue Tabelle (LAW_2027 …) mit
// Primärquelle je Wert; CURRENT_LAW zeigt auf die neueste. Die App rechnet ohne Optionen, also mit CURRENT_LAW.
// Golden (tests/golden.test.ts) und I1 (tests/combo.test.ts) übergeben immer LAW_2026: Original und Referenz-Engine
// rechnen mit den Werten von 2026, egal wie viele Tabellen später dazukommen (Verfahren: docs/jaehrliche-pflege.md).
//
// Bitgleichheit: Die Werte stehen so, wie sie vorher als Literale im Code standen (auch abgeleitete wie 0,26375),
// und die Formeln verwenden sie in derselben Reihenfolge der Gleitkomma-Operationen. tests/law.test.ts prüft, dass
// die abgeleiteten Werte zu den Grundwerten passen.
//
// Nicht in der Tabelle (Struktur des Gesetzes, ändert sich nur mit einer Reform und dann mit Code-Änderung):
// die Form des Tarifs (fünf Zonen, Divisor 10.000), Splitting (Faktor 2, § 32a Abs. 5), Teilfreistellung 30 % bzw.
// 15 % (§ 20 InvStG), hälftige Besteuerung nach 12 Jahren und ab 62 (§ 20 Abs. 1 Nr. 6 S. 2 EStG), 85 % der
// Versicherungserträge, Teilkapitalauszahlung 30 % (AltZertG), Altersgrenze 25 des Bonus, Verteilung der KV auf eine
// Kapitalleistung über 120 Monate, Umschichtungsanteile des Standarddepots (AVD_STD_GLIDE in core.ts) und der
// Besteuerungsanteil der gesetzlichen Rente (mehrjähriger gesetzlicher Fahrplan, taxSharePct in pensionTax.ts).

export interface LawTable {
  /** Kennung, auch im Cache-Schlüssel der Suche und im Fixture der Live-Rechnung. */
  id: string;
  /** Steuer- und Beitragsjahr, für das die Werte gelten (Basisjahr „heutiges Geld“). */
  year: number;
  /** § 32a Abs. 1 EStG: Grundtarif. Zonengrenzen in €, Koeffizienten der Zonen 2–5. */
  tariff: {
    gfb: number; z2End: number; z3End: number; z4End: number;
    a2: number; b2: number;
    a3: number; b3: number; c3: number;
    r4: number; c4: number;
    r5: number; c5: number;
  };
  /** § 3 Abs. 3, § 4 SolZG: Freigrenze (Einzelveranlagung), Satz, Milderungszone. */
  soli: { fg: number; rate: number; cap: number };
  /**
   * § 32d Abs. 1 EStG: Abgeltungsteuersatz. withSoli = rate · (1 + Soli), soliFactor = 1 + Soli, divisor = 1 / rate
   * (Formel mit Kirchensteuer (soliFactor + k)/(divisor + k)); als Literale gespeichert, Konsistenz in tests/law.test.ts.
   */
  abg: { rate: number; withSoli: number; soliFactor: number; divisor: number };
  /** § 20 Abs. 9 EStG: Sparer-Pauschbetrag je Person (zusammen veranlagt das Doppelte). */
  spb: number;
  /** § 10c EStG: Sonderausgaben-Pauschbetrag je Person (Kirchensteuer als Sonderausgabe darüber). */
  saPausch: number;
  /** § 9a S. 1 Nr. 3 EStG: Werbungskosten-Pauschbetrag für Renten (nur Hilfsrechnung pensionTax.ts). */
  wkPauschRente: number;
  /** Beitragsbemessungsgrenze KV/PV, €/Jahr. */
  kvBbg: number;
  /** Jahresarbeitsentgeltgrenze (Versicherungspflichtgrenze) KV, €/Jahr (nur Text im Glossar). */
  kvJaeg: number;
  /** KV/PV-Sätze in Prozent: allgemein (§ 241 SGB V), ermäßigt (§ 243), Ø-Zusatzbeitrag, PV (§ 55 SGB XI), Kinderlosenzuschlag. */
  kv: { general: number; reduced: number; zusatzAvg: number; pv: number; pvChildless: number };
  /** Basiszins für die Vorabpauschale (§ 18 Abs. 4 InvStG), Anteil (Vorschlag für die Eingabe basis). */
  basiszins: number;
  /** Altersvorsorgedepot (AVRG vom 26.05.2026): Höchstbeträge, Mindesteigenbeitrag, Zulagen (§§ 10a, 84–86 EStG n. F.). */
  avd: {
    subMax: number; max: number; minOwn: number;
    grundRate1: number; grundTop1: number; grundRate2: number; grundTop2: number;
    kid: number; bonus: number;
    /** Mittelbar zulageberechtigter Partner (§ 79 S. 2): Mindesteigenbeitrag, Erhöhung des Höchstbetrags der Person (§ 10a Abs. 3), höchste Grundzulage (§ 84 S. 3–4). */
    spouseMinOwn: number; spouseRaise: number; spouseGrundMax: number;
  };
  /** § 22 Nr. 1 S. 3 Buchst. a Doppelbuchst. bb EStG: Ertragsanteil der Leibrente in % nach Alter bei Rentenbeginn. */
  ertrag: Readonly<Record<number, number>>;
}

/** An die Tabelle gebundene Steuerfunktionen (einmal je Tabelle erzeugt). */
export interface TaxFns {
  /** Tarif auf ein zvE (ungerundet, ohne Abrundung des Einkommens). */
  tariff: (x: number) => number;
  /** Referenz des Originals: Einkommen abgerundet, Steuerbetrag noch ungerundet. */
  est: (x: number) => number;
  soli: (t: number) => number;
  tax: (x: number) => number;
  /** Indexierter Tarif; Einkommen und ESt im nominalen Steuerjahr auf volle Euro abgerundet (§ 32a). */
  taxIndexed: (incomeNom: number, index?: number) => number;
}

export interface Law extends LawTable { fn: TaxFns }

function makeTaxFns(L: LawTable): TaxFns {
  const { gfb, z2End, z3End, z4End, a2, b2, a3, b3, c3, r4, c4, r5, c5 } = L.tariff;
  const { fg, rate, cap } = L.soli;
  function tariff(x: number): number {
    let t: number;
    if (x <= gfb) t = 0;
    else if (x <= z2End) { const y = (x - gfb) / 1e4; t = (a2 * y + b2) * y; }
    else if (x <= z3End) { const z = (x - z2End) / 1e4; t = (a3 * z + b3) * z + c3; }
    else if (x <= z4End) t = r4 * x - c4;
    else t = r5 * x - c5;
    return Math.max(0, t);
  }
  const est = (x: number) => tariff(Math.floor(Math.max(0, x)));
  const soli = (t: number) => t <= fg ? 0 : Math.min(rate * t, cap * (t - fg));
  const tax = (x: number) => { const t = est(x); return t + soli(t); };
  const taxIndexed = (incomeNom: number, index = 1) => {
    const income = Math.floor(Math.max(0, incomeNom));
    const t = Math.floor(tariff(income / index) * index);
    return t + soli(t / index) * index;
  };
  return Object.freeze({ tariff, est, soli, tax, taxIndexed });
}

function deepFreeze<T>(o: T): T {
  for (const v of Object.values(o as object)) if (v && typeof v === 'object' && !Object.isFrozen(v)) deepFreeze(v);
  return Object.freeze(o);
}

export function defineLaw(t: LawTable): Law {
  const table = deepFreeze(structuredClone(t));
  return Object.freeze({ ...table, fn: makeTaxFns(table) });
}

/**
 * Rechtsstand 2026 (eingefroren; Golden und I1 rechnen immer damit).
 * Quellen: Tarif und Soli-Freigrenze 2026: Steuerfortentwicklungsgesetz vom 23.12.2024 (BGBl. 2024 I Nr. 449), § 32a
 * Abs. 1 EStG, § 3 Abs. 3 SolZG. KV-BBG und Versicherungspflichtgrenze 2026: Sozialversicherungsrechengrößen-Verordnung
 * 2026. Ø-Zusatzbeitrag 2026: Bekanntmachung des BMG. Basiszins 2026: BMF-Schreiben vom 13.01.2026. AVD: AVRG vom
 * 26.05.2026 (BGBl. 2026 I Nr. 156), §§ 10a, 84–86 EStG n. F. Übrige: EStG, SolZG, SGB V/XI in der 2026 geltenden Fassung.
 */
export const LAW_2026: Law = defineLaw({
  id: '2026',
  year: 2026,
  tariff: {
    gfb: 12348, z2End: 17799, z3End: 69878, z4End: 277825,
    a2: 914.51, b2: 1400,
    a3: 173.10, b3: 2397, c3: 1034.87,
    r4: 0.42, c4: 11135.63,
    r5: 0.45, c5: 19470.38,
  },
  soli: { fg: 20350, rate: 0.055, cap: 0.119 },
  abg: { rate: .25, withSoli: .26375, soliFactor: 1.055, divisor: 4 },
  spb: 1000,
  saPausch: 36,
  wkPauschRente: 102,
  kvBbg: 69750,
  kvJaeg: 77400,
  kv: { general: 14.6, reduced: 14.0, zusatzAvg: 2.9, pv: 3.6, pvChildless: 0.6 },
  basiszins: 0.032,
  avd: {
    subMax: 1800, max: 6840, minOwn: 120,
    grundRate1: 0.5, grundTop1: 360, grundRate2: 0.25, grundTop2: 1800,
    kid: 300, bonus: 200,
    spouseMinOwn: 120, spouseRaise: 120, spouseGrundMax: 175,
  },
  ertrag: { 60: 22, 61: 22, 62: 21, 63: 20, 64: 19, 65: 18, 66: 18, 67: 17, 68: 16, 69: 15, 70: 15 },
});

/** Alle Tabellen, älteste zuerst. */
export const LAWS: readonly Law[] = Object.freeze([LAW_2026]);

/** Neueste Tabelle: Standard der App und überall, wo kein Rechtsstand übergeben wird. */
export const CURRENT_LAW: Law = LAWS[LAWS.length - 1];
