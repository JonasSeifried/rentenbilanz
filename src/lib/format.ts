// Formatierung wie im Original (eur) plus kompakte Achsenbeschriftung.
export const eur = (x: number): string => (isFinite(x) ? Math.round(x).toLocaleString('de-DE') : '–') + ' €';

export const kfmt = (v: number): string =>
  v >= 1e6 ? (v / 1e6).toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' Mio.'
  : v >= 1e3 ? Math.round(v / 1e3).toLocaleString('de-DE') + ' Tsd.'
  : String(Math.round(v));

export const pctFmt = (x: number, digits = 1): string =>
  (x * 100).toLocaleString('de-DE', { maximumFractionDigits: digits }) + ' %';

export const numFmt = (x: number, digits = 2): string => x.toLocaleString('de-DE', { maximumFractionDigits: digits });
