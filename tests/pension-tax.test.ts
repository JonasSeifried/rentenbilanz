// Hilfsrechnung Bruttorente → zu versteuerndes Einkommen im Alter (src/lib/pensionTax.ts), mit Handrechnung.
import { describe, expect, it } from 'vitest';
import { pensionTax, retireeKvRatePct, taxSharePct, type PensionInput } from '../src/lib/pensionTax';

const X = (patch: Partial<PensionInput> = {}): PensionInput => ({
  monthly: 1500, startYear: 2040, statutory: true, zusatz: 2.9, childless: true, privateKv: 0, other: 0,
  yearsToStart: 14, payYears: 23, infl: 0, ...patch,
});

describe('Besteuerungsanteil (§ 22 Nr. 1 S. 3 a aa EStG)', () => {
  it('Tabelle einschließlich Wachstumschancengesetz', () => {
    const t: [number, number][] = [[2000, 50], [2005, 50], [2006, 52], [2010, 60], [2020, 80], [2021, 81], [2022, 82], [2023, 82.5],
      [2024, 83], [2026, 84], [2027, 84.5], [2040, 91], [2057, 99.5], [2058, 100], [2075, 100]];
    for (const [y, pct] of t) expect(taxSharePct(y)).toBe(pct);
  });
});

describe('Beitragssatz des Rentners', () => {
  it('halbe KV (14,6 % + Zusatzbeitrag), volle PV', () => {
    expect(retireeKvRatePct(2.9, true)).toBe(12.95);  // 8,75 + 3,6 + 0,6
    expect(retireeKvRatePct(2.9, false)).toBe(12.35);
    expect(retireeKvRatePct(0, false)).toBe(10.9);
  });
});

describe('Zu versteuerndes Einkommen aus der Bruttorente', () => {
  it('ohne Inflation: 18.000 − 1.620 Freibetrag − 102 − 2.331 KV/PV − 36 = 13.911 €', () => {
    const r = pensionTax(X());
    expect(r.gross).toBe(18000);
    expect(r.sharePct).toBe(91);
    expect(r.freeStart).toBeCloseTo(1620, 9);
    expect(r.kv).toBeCloseTo(2331, 9);
    expect(r.start.zve).toBeCloseTo(13911, 9);
    expect(r.end.zve).toBeCloseTo(13911, 9);
    expect(r.avg).toBeCloseTo(13911, 9);
    expect(r.suggestion).toBe(13900);
  });
  it('weitere Einkünfte kommen hinzu; privat versichert mit eigenem Beitrag', () => {
    expect(pensionTax(X({ other: 2000 })).start.zve).toBeCloseTo(15911, 9);
    const p = pensionTax(X({ statutory: false, privateKv: 3000 }));
    expect(p.kvRatePct).toBeNull();
    expect(p.start.zve).toBeCloseTo(18000 - 1620 - 102 - 3000 - 36, 9);
  });
  it('2 % Inflation: feste Euro-Beträge verlieren real an Wert (Handrechnung)', () => {
    const r = pensionTax(X({ infl: 0.02 }));
    // Beginn (14 Jahre ab heute): 102/1,02^14 = 77,30; 36/1,02^14 = 27,28; Freibetrag 1.620 → 13.944,41
    expect(r.start.zve).toBeCloseTo(13944.413, 2);
    // Letztes Jahr (k = 22, 36 Jahre ab heute): Freibetrag 1.620/1,02^22 = 1.047,88 → 14.553,47
    expect(r.end.zve).toBeCloseTo(14553.470, 2);
    expect(r.avg).toBeCloseTo(14269.982, 2);
    expect(r.suggestion).toBe(14300);
  });
  it('ab Rentenbeginn 2058 kein Freibetrag; nie negativ; Werbungskosten höchstens bis zur Rente', () => {
    expect(pensionTax(X({ startYear: 2060 })).start.free).toBe(0);
    expect(pensionTax(X({ monthly: 5 })).start.zve).toBe(0);
    expect(pensionTax(X({ monthly: 5 })).start.wk).toBe(60);
    expect(pensionTax(X({ monthly: 0, other: 5000 })).start.zve).toBeCloseTo(5000 - 36, 9);
  });
});
