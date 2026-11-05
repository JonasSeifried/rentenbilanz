// Zentrale Angaben zur Seite. Name und Domain hier ändern, alles andere zieht nach
// (index.html, impressum.html und datenschutz.html lesen SITE_NAME beim Build über vite.config.ts).
export const SITE = {
  name: 'Rentenbilanz',
  tagline: 'ETF-Depot, Altersvorsorgedepot und Rentenversicherung im Vergleich',
  /** Rechtsstand der Berechnung (sichtbar im Kopf und im Druck). */
  lawState: 'Altersvorsorgereformgesetz vom 26.05.2026 (BGBl. 2026 I Nr. 156), Steuerwerte 2026',
  lawStateShort: 'Rechtsstand 26.05.2026 · Steuerwerte 2026',
  /** Datum der letzten inhaltlichen Prüfung. */
  updated: '04.11.2026',
  /** Kontakt für „Fehler melden“ (steht auch im Impressum und in der Datenschutzerklärung). */
  contact: 'legal@jonasseifried.com',
  /** Öffentliche Adresse der Seite (ohne Schrägstrich am Ende). Leer = keine canonical-/og:url-Angaben. */
  url: 'https://rente.jonasseifried.co',
  /** Start des Altersvorsorgedepots; der Hinweis in der Oberfläche schaltet sich ab diesem Datum selbst ab. */
  avdStart: '01.01.2027',
  avdStartISO: '2027-01-01',
} as const;
