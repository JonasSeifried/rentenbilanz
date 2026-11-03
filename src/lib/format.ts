// Formatierung wie im Original (eur).
export const eur = (x: number): string => (isFinite(x) ? Math.round(x).toLocaleString('de-DE') : '–') + ' €';

/**
 * Gerundete Euro-Anzeige für große Kapitalwerte (keine Scheingenauigkeit): ab 10.000 auf 100 €,
 * ab 1.000 auf 10 €, darunter auf 1 €. Tooltips und Datentabellen bleiben bei `eur` (exakt).
 */
export function eurRound(x: number): string {
  if (!isFinite(x)) return '–';
  const a = Math.abs(x);
  const step = a >= 10000 ? 100 : a >= 1000 ? 10 : 1;
  return eur(Math.round(x / step) * step);
}
