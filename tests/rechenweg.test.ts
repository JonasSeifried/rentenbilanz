import { describe, expect, it } from 'vitest';
import { DEFAULTS, INPUT_KEYS } from '../src/lib/engine/inputs';
import { readParams } from '../src/lib/engine/core';
import { analyze } from '../src/lib/engine/analyze';
import { rechenweg } from '../src/lib/rechenweg';

const row = (md: string, section: string, year: number) => {
  const part = md.split('### ' + section)[1];
  return part.split('\n').find(l => l.startsWith(`| ${year} |`))!.split('|').map(c => c.trim()).filter(Boolean);
};

describe('Rechenweg', () => {
  it('nennt jede Eingabe mit Wert', () => {
    const md = rechenweg(DEFAULTS, analyze(readParams(DEFAULTS)), 'https://x/#s', new Date(2026, 10, 5));
    for (const k of INPUT_KEYS) expect(md).toContain(`| ${k} |`);
    expect(md).toContain('Szenario-Link: https://x/#s');
    expect(md).toContain('| a0 | Alter heute | 22 |  | Jahre |');
  });

  it('Jahreswerte passen zur Engine (ohne Rendite und Kosten: Vermögen = Summe der Beiträge)', () => {
    const inp = { ...DEFAULTS, g: 0, gPay: 0, etfTer: 0, insEff: 0, infl: 0, avdOn: false };
    const A = analyze(readParams(inp));
    const md = rechenweg(inp, A, '', new Date(2026, 10, 5));
    expect(row(md, 'ETF-Depot', 0)).toEqual(['0', '22', '1.800', '1.800', '0', '0', '0', '0', '1,0000']);
    expect(row(md, 'ETF-Depot', A.n - 1)[3]).toBe((1800 * A.n).toLocaleString('de-DE'));
    expect(row(md, 'ETF-Depot', A.n)[2]).toBe('0');
    expect(row(md, 'ETF-Depot', A.n)[4]).toBe(Math.round(A.res.etf!.net[A.n]).toLocaleString('de-DE'));
  });

  it('enthält die Kombi, wenn sie im Vergleich ist', () => {
    const inp = { ...DEFAULTS, combo: true, cEtf: 75, cAvd: 75 };
    const p = readParams(inp);
    const A = analyze(p, undefined, { etf: 75, avd: 75, ins: 0, fond: 0 });
    const md = rechenweg(inp, A, '');
    expect(md).toContain('### Deine Kombi');
    expect(row(md, 'Deine Kombi', 0)[2]).toBe('1.800');
  });
});

describe('Rechenweg nach Review', () => {
  it('zeigt den gerechneten Wert, wenn die Engine eine Eingabe begrenzt', () => {
    const inp = { ...DEFAULTS, R: 72, H: 80 };
    const md = rechenweg(inp, analyze(readParams(inp)), '');
    expect(md).toContain('| R | Rentenbeginn | 72 | 70 | Alter |');
    expect(md).toContain('| H | Auszahlplan bis | 80 | 85 | Alter |');
    expect(md).toContain('| g | Rendite vor Kosten, Ansparphase | 6 |  | % p. a. |');  });

  it('negative Prozentwerte sind keine Platzhalter (nur die Auszahlkosten kennen −1)', () => {
    const inp = { ...DEFAULTS, infl: -1, g: -2, avdPayCost: -1 };
    const md = rechenweg(inp, analyze(readParams(inp)), '');
    expect(md).toMatch(/\| infl \| [^|]+ \| -1 \|  \|/);
    expect(md).toMatch(/\| g \| [^|]+ \| -2 \|  \|/);
    expect(md).toMatch(/\| avdPayCost \| [^|]+ \| -1 \|  \|/);
  });

  it('Kombi: letzte Zeile hat ein Vermögen, Aufteilung wird genannt', () => {
    const inp = { ...DEFAULTS, combo: true, cEtf: 100, cAvd: 100 };
    const A = analyze(readParams(inp), undefined, { etf: 75, avd: 75, ins: 0, fond: 0 });
    const md = rechenweg(inp, A, '');
    expect(row(md, 'Deine Kombi', A.T - 1)[3]).not.toBe('–');
    expect(md).toContain('ETF 75 €, AVD 75 €');
  });

  it('Modellgrenzen folgen den Schaltern, keine „-0“', () => {
    const inp = { ...DEFAULTS, indexAllowance: true };
    const md = rechenweg(inp, analyze(readParams(inp)), '');
    expect(md).toContain('wächst mit der Inflation (hypothetisch');
    expect(md).not.toMatch(/\| -0 \|/);
  });
});
