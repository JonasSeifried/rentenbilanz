// Deutsche Zahleneingabe und -anzeige für die Eingabefelder.
/** Deutsche Zahleneingabe: „38.000“, „38000“, „0,2“ und „0.2“ sind erlaubt. Ungültig → null. */
export function parseDe(raw: string): number | null {
  let s = raw.trim().replace(/[\s €%]/g, '').replace(/[−–]/g, '-');
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(s)) return null;
  const x = Number(s);
  return isFinite(x) ? x : null;
}

export function formatDe(x: number, maxDigits = 2): string {
  return x.toLocaleString('de-DE', { maximumFractionDigits: maxDigits, useGrouping: Math.abs(x) >= 10000 });
}
