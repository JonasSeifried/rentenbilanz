// Neutrale Darstellung (Entscheidung des Betreibers, November 2026): kein Sieger, feste Produktreihenfolge,
// Abstände in € und %, Kosten-Gleichstand mit dem ETF-Depot (engine/breakEven.ts).
import { describe, expect, it } from 'vitest';
import { readParams } from '../src/lib/engine/core';
import { DEFAULTS, type Inputs } from '../src/lib/engine/inputs';
import { analyze, scenarios, single, PRODUCTS } from '../src/lib/engine/analyze';
import { emptySplit } from '../src/lib/engine/combo';
import { costBreakEven, costBreakEvens, COST_TOL, MAX_COST } from '../src/lib/engine/breakEven';
import { breakEvenText, robustText, verdict } from '../src/lib/verdict';
import { rechenweg } from '../src/lib/rechenweg';
import { faqs } from '../src/lib/prosCons';
import { GLOSSARY } from '../src/lib/glossary';

const inp = (patch: Partial<Inputs> = {}): Inputs => ({ ...DEFAULTS, ...patch });
const P = (patch: Partial<Inputs> = {}) => readParams(inp(patch));
const WINNER = /sieger|gewinner|vorne|favorit|lohnt|empfehl|beste[nrs]?\b|am meisten|rechnerisch|optimal|solltest/i;

const sumHReal = (p: ReturnType<typeof P>, k: 'avd' | 'ins' | 'fond' | 'etf') => {
  const r = single(p, k); let s = 0;
  for (let t = p.R - p.a0; t < p.H - p.a0; t++) s += r.net[t] / Math.pow(1 + p.infl, t);
  return s;
};

describe('Ergebnissatz ohne Sieger', () => {
  const variants: Partial<Inputs>[] = [{}, { kvOn: true }, { fondOn: true }, { real: false }, { kids: 2 }, { incWork: 70000 },
    { insLump: false }, { avdM: 100 }, { reinvest: false }, { avdOn: false, insOn: false }, { combo: true, cEtf: 100, cAvd: 50 }];
  it('keine Sieger- oder Empfehlungswörter in Kopfzeile, Sätzen, Robustheit, Kosten-Gleichstand und Rechenweg', () => {
    for (const patch of variants) {
      const i = inp(patch), p = readParams(i);
      const kombi = i.combo ? { ...emptySplit(), etf: i.cEtf, avd: i.cAvd } : null;
      const A = analyze(p, undefined, kombi), V = verdict(A, scenarios(p, undefined, kombi));
      const parts = [V.headline, ...V.lines, V.peek ?? ''];
      if (V.robust) { const r = robustText(V.robust); parts.push(r.before + r.link + r.after); }
      parts.push(...costBreakEvens(A).map(b => breakEvenText(A, b)));
      expect(parts.join(' '), JSON.stringify(patch)).not.toMatch(WINNER);
      expect(rechenweg(i, A, 'https://example.org/#v=1', new Date(2026, 10, 5)), JSON.stringify(patch)).not.toMatch(WINNER);
    }
  });
  it('Glossar und häufige Fragen ohne Sieger- oder Empfehlungswörter', () => {
    for (const e of Object.values(GLOSSARY)) expect([e.title, ...e.text].join(' '), e.title).not.toMatch(/sieger|gewinner|vorne|favorit|lohnt|empfehl/i);
    for (const f of faqs(P(), PRODUCTS.map(pr => pr.key))) expect([f.q, ...f.a].join(' '), f.id).not.toMatch(/sieger|gewinner|vorne|favorit|lohnt|empfehl/i);
  });
  it('feste Reihenfolge (ETF, AVD, Versicherung, Fonds), nicht nach Ergebnis sortiert; Abstände zum ersten Produkt', () => {
    const A = analyze(P({ fondOn: true }));
    const V = verdict(A, []);
    expect(V.headline).toMatch(/^Ø netto im Monat \(67–90\): ETF-Depot [\d.]+ €, Altersvorsorgedepot [\d.]+ €, Rentenversicherung [\d.]+ €, Aktiver Fonds [\d.]+ €\.$/);
    expect(V.peek).toMatch(/^Ø netto\/Monat: ETF [\d.]+ € · AVD [\d.]+ € · Vers\. [\d.]+ € · Akt\. Fonds [\d.]+ €$/);
    // Bei Standardwerten zahlt das AVD mehr als das ETF-Depot, steht aber trotzdem an zweiter Stelle.
    expect(A.stats.avd!.cumHReal).toBeGreaterThan(A.stats.etf!.cumHReal);
    expect(V.lines[0]).toMatch(/^Das Altersvorsorgedepot zahlt bis zum Alter von 90 zusammen rund [\d.]+ € \(\d+ %\) mehr aus als das ETF-Depot\.$/);
    expect(V.lines[1]).toMatch(/^Die Rentenversicherung zahlt bis zum Alter von 90 zusammen rund [\d.]+ € \(\d+ %\) weniger aus als das ETF-Depot\.$/);
    expect(V.lines[2]).toMatch(/^Der aktive Fonds zahlt .* weniger aus als das ETF-Depot\.$/);
    // Abstand und Prozent stimmen mit den Summen überein
    const d = A.stats.avd!.cumHReal - A.stats.etf!.cumHReal;
    expect(V.lines[0]).toContain('rund ' + (Math.round(d / 100) * 100).toLocaleString('de-DE') + ' € (' + Math.round(d / A.stats.etf!.cumHReal * 100) + ' %)');
  });
  it('Robustheit zählt Szenarien, in denen sich ein Abstand umkehrt (unabhängig von der Reihenfolge)', () => {
    const p = P(), A = analyze(p), sc = scenarios(p), V = verdict(A, sc);
    // Standardwerte: nur „AVD-Kosten 1,0 %“ dreht AVD ↔ ETF (Gleichstand bei rund 0,87 %).
    expect(V.robust).toMatchObject({ flips: 1, total: 16, example: 'AVD-Kosten 1,0 % in Anspar- und Auszahlphase (Szenario)' });
    const r = robustText(V.robust!);
    expect(r.before + r.link + r.after).toBe('In 1 von 16 Szenarien unten kehrt sich mindestens ein Abstand zwischen zwei Produkten um, z. B. bei „AVD-Kosten 1,0 % in Anspar- und Auszahlphase (Szenario)“.');
  });
});

describe('Kosten-Gleichstand mit dem ETF-Depot', () => {
  // Sensitivitätscheck des Betreibers (22 J., zvE 38.000, Rente-zvE 20.000, 150 €/Monat, 6 %), mit der Engine bestätigt.
  it.each([
    ['Standardwerte', {}, 0.0087],
    ['freiwillig gesetzlich versichert', { kvOn: true }, 0.0050],
    ['zwei Kinder', { kids: 2 }, 0.0102],
    ['zvE 70.000 €', { incWork: 70000 }, 0.0133],
  ] as const)('AVD: %s ⇒ Gleichstand bei rund %s', (_n, patch, expected) => {
    const A = analyze(P(patch));
    const b = costBreakEven(A, 'avd')!;
    expect(b.kind).toBe('cross');
    expect(b.at!).toBeCloseTo(expected, 3);
    expect(b.payToo).toBe(true);
    expect(b.evals).toBeLessThanOrEqual(12);
    // Probe mit derselben Rechnung: knapp darunter mehr, knapp darüber weniger als das ETF-Depot
    const etf = A.stats.etf!.cumHReal;
    expect(sumHReal({ ...A.p, avdCost: b.at! - COST_TOL }, 'avd')).toBeGreaterThan(etf);
    expect(sumHReal({ ...A.p, avdCost: b.at! + COST_TOL }, 'avd')).toBeLessThan(etf);
  });
  it('mit Steuerprofil und genutztem Pauschbetrag: dieselbe Einzelrechnung, alle Eingaben gehen mit', () => {
    for (const patch of [{ kist: 9 }, { married: true, incSpouse: 0, incSpouseRet: 0 }, { allowanceUsed: 600 }, { kist: 8, married: true, allowanceUsed: 1500, kvOn: true }]) {
      const A = analyze(P(patch));
      const etf = A.stats.etf!.cumHReal;
      // Abstand bei den angenommenen Kosten = Neurechnung mit denselben Params (sonst würde der Gleichstand springen)
      expect(sumHReal(A.p, 'avd')).toBeCloseTo(A.stats.avd!.cumHReal, 6);
      const b = costBreakEven(A, 'avd')!;
      expect(b.gap).toBeCloseTo(A.stats.avd!.cumHReal - etf, 6);
      if (b.kind === 'cross') {
        expect(sumHReal({ ...A.p, avdCost: b.at! - COST_TOL }, 'avd')).toBeGreaterThan(etf);
        expect(sumHReal({ ...A.p, avdCost: b.at! + COST_TOL }, 'avd')).toBeLessThan(etf);
      }
      // Die Eingaben wirken auch im Gleichstand (nicht auf Standardwerte zurückgefallen)
      expect(b.at).not.toBe(costBreakEven(analyze(P()), 'avd')!.at);
    }
  });
  it('Text: Schwelle, Annahme, unveränderte ETF-Kosten, keine Bewertung', () => {
    const A = analyze(P());
    expect(breakEvenText(A, costBreakEven(A, 'avd')!)).toBe('Gleichstand mit dem ETF-Depot bis zum Alter von 90 bei 0,87 % AVD-Kosten in Anspar- und Auszahlphase (angenommen 0,5 %; ETF-Kosten 0,2 % unverändert). Mit niedrigeren Kosten zahlt das Altersvorsorgedepot mehr aus als das ETF-Depot, mit höheren weniger.');
    const B = analyze(P({ fondOn: true }));
    expect(breakEvenText(B, costBreakEven(B, 'fond')!)).toMatch(/^Gleichstand mit dem ETF-Depot bis zum Alter von 90 bei 0,0\d % laufenden Kosten des aktiven Fonds \(angenommen 1,6 %; Ausgabeaufschlag 5 %; ETF-Kosten 0,2 % unverändert\)\./);
    expect(breakEvenText(B, costBreakEven(B, 'ins')!)).toMatch(/^Gleichstand mit dem ETF-Depot bis zum Alter von 90 bei 0,2\d % Effektivkosten der Versicherung \(angenommen 0,9 %/);
  });
  it('eigene AVD-Auszahlkosten: nur die Ansparkosten werden variiert', () => {
    const A = analyze(P({ avdPayCost: 0.5 }));
    const b = costBreakEven(A, 'avd')!;
    expect(b.payToo).toBe(false);
    expect(breakEvenText(A, b)).toContain('AVD-Kosten in der Ansparphase');
  });
  it('kein Gleichstand zwischen 0 und 3 %: ehrlich benannt', () => {
    // Leibrente bis 90 und KV auf die Rente: auch ohne Kosten weniger als das ETF-Depot.
    const A = analyze(P({ kvOn: true, insLump: false }));
    const b = costBreakEven(A, 'ins')!;
    expect(b).toMatchObject({ kind: 'below', at: null, cap: MAX_COST });
    expect(breakEvenText(A, b)).toBe('Die Rentenversicherung zahlt bis zum Alter von 90 (die lebenslange Rente zahlt danach weiter) auch mit 0 % Effektivkosten der Versicherung weniger aus als das ETF-Depot: zwischen 0 und 3 % kein Gleichstand (angenommen 0,9 %; ETF-Kosten 0,2 % unverändert).');
    // Kleiner Beitrag mit drei Kindern ab 40: Die Zulagen überwiegen auch bei 3 % Kosten.
    const m = 20, C = analyze(P({ a0: 40, kidsFrom: 40, kids: 3, incWork: 15000, setAll: m, etfM: m, avdM: m, insM: m }));
    const c = costBreakEven(C, 'avd')!;
    expect(c).toMatchObject({ kind: 'above', at: null });
    expect(sumHReal({ ...C.p, avdCost: MAX_COST }, 'avd')).toBeGreaterThan(C.stats.etf!.cumHReal);
    expect(breakEvenText(C, c)).toMatch(/^Das Altersvorsorgedepot zahlt bis zum Alter von 90 auch mit 3 % AVD-Kosten in Anspar- und Auszahlphase mehr aus als das ETF-Depot: zwischen 0 und 3 % kein Gleichstand \(angenommen 0,5 %/);
  });
  it('nur bei fairem Vergleich und mit ETF-Depot; feste Reihenfolge AVD, Versicherung, Fonds', () => {
    expect(costBreakEvens(analyze(P({ fondOn: true }))).map(b => b.key)).toEqual(['avd', 'ins', 'fond']);
    expect(costBreakEvens(analyze(P({ etfOn: false })))).toEqual([]);
    expect(costBreakEvens(analyze(P({ avdM: 100 })))).toEqual([]); // ungleiche Beiträge
    expect(costBreakEvens(analyze(P({ reinvest: false })))).toEqual([]); // Erstattung ausgegeben
  });
  it('Rechenweg enthält Abstände und Kosten-Gleichstand', () => {
    const A = analyze(P());
    const md = rechenweg(DEFAULTS, A, 'https://example.org/#v=1', new Date(2026, 10, 5));
    expect(md).toContain('### Abstände');
    expect(md).toContain('### Kosten-Gleichstand mit dem ETF-Depot');
    expect(md).toContain('- Gleichstand mit dem ETF-Depot bis zum Alter von 90 bei 0,87 % AVD-Kosten in Anspar- und Auszahlphase');
    expect(md).toContain('Der Rechner bewertet die Produkte nicht.');
    expect(rechenweg({ ...DEFAULTS, avdM: 100 }, analyze(P({ avdM: 100 })), 'x')).toContain('Kein fairer Vergleich');
    const one = { ...DEFAULTS, avdOn: false, insOn: false };
    expect(rechenweg(one, analyze(P(one)), 'x')).toContain('Nur ein Produkt im Vergleich');
  });
});

describe('Kosten-Gleichstand des aktiven Fonds mit Umschichtung', () => {
  it('nennt, dass nur der Aktienteil variiert wird', () => {
    const A = analyze(P({ fondOn: true, shift: true }));
    const b = costBreakEven(A, 'fond');
    expect(b).not.toBeNull();
    expect(breakEvenText(A, b!)).toContain('Aktienteil; der sichere Teil nach der Umschichtung mit ETF-Kosten');
    const B = analyze(P({ fondOn: true }));
    expect(breakEvenText(B, costBreakEven(B, 'fond')!)).not.toContain('Aktienteil');
  });
});
