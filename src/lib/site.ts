// Zentrale Angaben zur Seite. Name und Domain hier ändern, alles andere zieht nach
// (index.html, impressum.html und datenschutz.html lesen SITE_NAME beim Build über vite.config.ts).
export const SITE = {
  /** Arbeitstitel, finaler Name steht noch aus. */
  name: 'Vorsorge-Rechner',
  tagline: 'ETF-Depot, Altersvorsorgedepot und Rentenversicherung im Vergleich',
  /** Rechtsstand der Berechnung (sichtbar im Kopf und im Druck). */
  lawState: 'Altersvorsorgereformgesetz vom 26.05.2026 (BGBl. 2026 I Nr. 156), Steuerwerte 2026',
  lawStateShort: 'Rechtsstand 26.05.2026 · Steuerwerte 2026',
  /** Datum der letzten inhaltlichen Prüfung. */
  updated: '02.11.2026',
} as const;
