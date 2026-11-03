// Deutsche Zahleneingabe und -anzeige für die Eingabefelder.

export interface ParseOptions {
  /**
   * Ob ein Punkt mit genau drei Ziffern dahinter als Tausendertrenner gilt („1.234“ = 1234).
   * Bei Feldern, die nie ≥ 1000 werden (Prozentsätze, Alter), auf false setzen:
   * dort ist ein einzelner Punkt ein Dezimaltrenner („1.234“ = 1,234). Standard: true.
   */
  allowThousands?: boolean;
}

/**
 * Deutsche Zahleneingabe: „38.000“, „38000“, „0,2“ und „0.2“ sind erlaubt. Ungültig → null.
 * Eine Tausendergruppe beginnt nie mit 0: „0.125“ ist 0,125 (nicht 125).
 */
export function parseDe(raw: string, { allowThousands = true }: ParseOptions = {}): number | null {
  let s = raw.trim().replace(/[\s €%]/g, '').replace(/[−–]/g, '-');
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (allowThousands && /^-?[1-9]\d{0,2}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(s)) return null;
  const x = Number(s);
  return isFinite(x) ? x : null;
}

export function formatDe(x: number, maxDigits = 2): string {
  return x.toLocaleString('de-DE', { maximumFractionDigits: maxDigits, useGrouping: Math.abs(x) >= 10000 });
}
