import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { formatDe, parseDe } from '../src/lib/number';
import { eur, eurRound } from '../src/lib/format';

const nbsp = (s: string) => s.replace(/ /g, ' ');

describe('parseDe', () => {
  it('Tausendergruppe beginnt nie mit 0: „0.125“ ist 0,125', () => {
    expect(parseDe('0.125')).toBe(0.125);
    expect(parseDe('0.500')).toBe(0.5);
    expect(parseDe('-0.075')).toBe(-0.075);
    expect(parseDe('00.123')).toBe(0.123);
  });
  it('echte Tausenderpunkte bleiben Tausender', () => {
    expect(parseDe('1.234')).toBe(1234);
    expect(parseDe('38.000')).toBe(38000);
    expect(parseDe('1.234.567')).toBe(1234567);
    expect(parseDe('-12.345')).toBe(-12345);
    expect(parseDe('12.345,6')).toBe(12345.6);
  });
  it('Komma ist immer der Dezimaltrenner', () => {
    expect(parseDe('0,125')).toBe(0.125);
    expect(parseDe('5,5')).toBe(5.5);
    expect(parseDe('3.2')).toBe(3.2); // keine Dreiergruppe → Dezimalpunkt
  });
  it('allowThousands: false liest einen einzelnen Punkt immer als Dezimaltrenner', () => {
    expect(parseDe('1.5', { allowThousands: false })).toBe(1.5);
    expect(parseDe('1.234', { allowThousands: false })).toBe(1.234);
    expect(parseDe('4.500', { allowThousands: false })).toBe(4.5);
    expect(parseDe('1.234,5', { allowThousands: false })).toBe(1234.5); // Komma bleibt maßgeblich
  });
  it('Einheiten und Leerraum werden ignoriert, Unsinn ist ungültig', () => {
    expect(parseDe(' 5 % ')).toBe(5);
    expect(parseDe('1 500 €')).toBe(1500);
    expect(parseDe('−3')).toBe(-3);
    for (const bad of ['', '  ', 'abc', '1,2,3', '--1', '1e5x', '.', '-']) expect(parseDe(bad), bad).toBeNull();
    expect(parseDe('9'.repeat(400))).toBeNull(); // nicht endlich
  });
});

describe('formatDe', () => {
  it('Gruppierung erst ab 10.000, höchstens 2 Nachkommastellen', () => {
    expect(formatDe(38000)).toBe('38.000');
    expect(formatDe(1234)).toBe('1234');
    expect(formatDe(0.125)).toBe('0,13');
    expect(formatDe(5.5)).toBe('5,5');
  });
});

describe('eurRound', () => {
  it('ab 10.000 auf 100 €, ab 1.000 auf 10 €, sonst auf 1 €', () => {
    expect(nbsp(eurRound(174891))).toBe('174.900 €');
    expect(nbsp(eurRound(10049))).toBe('10.000 €');
    expect(nbsp(eurRound(10050))).toBe('10.100 €');
    expect(nbsp(eurRound(9994))).toBe('9.990 €');
    expect(nbsp(eurRound(1234))).toBe('1.230 €');
    expect(nbsp(eurRound(999.6))).toBe('1.000 €');
    expect(nbsp(eurRound(123.4))).toBe('123 €');
    expect(nbsp(eurRound(0))).toBe('0 €');
  });
  it('negative Beträge symmetrisch, nicht endliche als Strich', () => {
    expect(nbsp(eurRound(-174891))).toBe('-174.900 €');
    expect(eurRound(NaN)).toBe('–');
    expect(eurRound(Infinity)).toBe('–');
  });
  it('eur bleibt exakt (Tooltips, Datentabellen)', () => {
    expect(nbsp(eur(174891.4))).toBe('174.891 €');
  });
});

describe('Design-Tokens', () => {
  // Plain CSS kann die dunklen Tokens nicht für „System dunkel“ und „manuell dunkel“ gemeinsam
  // definieren (Media-Query vs. Attribut). Damit die beiden Blöcke nicht auseinanderlaufen, prüft
  // dieser Test, dass sie Wert für Wert identisch sind.
  const css = readFileSync(new URL('../src/app.css', import.meta.url), 'utf8');
  const block = (re: RegExp) => {
    const m = css.match(re);
    expect(m, String(re)).not.toBeNull();
    return m![1].split(';').map(s => s.trim().replace(/\s+/g, ' ')).filter(Boolean);
  };
  const dark = (re: RegExp) => block(re).sort();
  it('dunkle Tokens: Media-Query und data-theme="dark" sind identisch', () => {
    const viaMedia = dark(/prefers-color-scheme: dark\)\s*\{\s*:root:where\(:not\(\[data-theme="light"\]\)\)\s*\{([^}]*)\}/);
    const viaAttr = dark(/\n:root\[data-theme="dark"\]\s*\{([^}]*)\}/);
    expect(viaMedia.length).toBeGreaterThan(15);
    expect(viaMedia).toEqual(viaAttr);
  });
  it('--axis-text hell ist ausreichend dunkel (U24)', () => {
    expect(css).toMatch(/--axis-text:\s*#6f6e69/);
  });
});
