// Formatierung wie im Original (eur).
export const eur = (x: number): string => (isFinite(x) ? Math.round(x).toLocaleString('de-DE') : '–') + ' €';

export const pctFmt = (x: number, digits = 1): string =>
  (x * 100).toLocaleString('de-DE', { maximumFractionDigits: digits }) + ' %';

export const numFmt = (x: number, digits = 2): string => x.toLocaleString('de-DE', { maximumFractionDigits: digits });
