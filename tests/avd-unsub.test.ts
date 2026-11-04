// Fix avdUnsubsidized (E10): Eigenbeiträge über 1.800 €/Jahr bleiben bis 6.840 €/Jahr ungefördert im AVD-Vertrag.
// Unabhängige Eigenschaften (die Spiegelung in der Kombi-Engine prüft I1 in combo.test.ts).
import { describe, expect, it } from 'vitest';
import { analyze } from '../src/lib/engine/analyze';
import { model, readParams, type Params } from '../src/lib/engine/engine';
import { ALL_FIXES, type FixId } from '../src/lib/engine/fixes';
import { DEFAULTS, type Inputs } from '../src/lib/engine/inputs';

const WITHOUT = { fixes: new Set<FixId>([...ALL_FIXES].filter(f => f !== 'avdUnsubsidized')) };
const at = (b: number, x: Partial<Inputs> = {}): Params => readParams({ ...DEFAULTS, setAll: b, etfM: b, avdM: b, insM: b, fondM: b, ...x });
const sum = (xs: number[], from = 0) => xs.slice(from).reduce((a, b) => a + b, 0);

describe('E10 – ungeförderte AVD-Beiträge im Vertrag', () => {
  it('bis 150 €/Monat: Ergebnis wie ohne den Fix (bitgleich)', () => {
    for (const x of [{}, { kvOn: true }, { einmal: true }, { kids: 2 }, { a0: 55 }, { reinvest: false }] as Partial<Inputs>[]) {
      const p = at(150, x), a = model(p).res.avd!, b = model(p, WITHOUT).res.avd!;
      expect(a.net).toEqual(b.net); expect(a.vals).toEqual(b.vals);
      expect(a.capNet).toBe(b.capNet); expect(a.own).toBe(b.own); expect(a.cost).toBe(b.cost);
      expect(a.unsubOwn).toBe(0); expect(a.sideOwn).toBe(0);
      for (const k of [5, 30, 60]) expect(a.heir(k)).toEqual(b.heir(k));
    }
  });

  it('Aufteilung der Beiträge: 150 € gefördert, bis 570 € ungefördert im Vertrag, der Rest im ETF-Nebendepot', () => {
    const p = at(700), r = model(p).res.avd!, n = p.R - p.a0;
    expect(r.unsubOwn).toBeCloseTo(420 * 12 * n, 6);
    expect(r.sideOwn).toBeCloseTo(130 * 12 * n, 6);
    expect(r.own).toBeCloseTo(700 * 12 * n, 6);
    const q = at(450), s = model(q).res.avd!;
    expect(s.unsubOwn).toBeCloseTo(300 * 12 * n, 6);
    expect(s.sideOwn).toBe(0);
    // ohne Fix wie im Original: alles über 150 € im Nebendepot
    expect(model(q, WITHOUT).res.avd!.sideOwn).toBeCloseTo(300 * 12 * n, 6);
  });

  it('ohne Förderberechtigung (Studium) bleibt es beim Nebendepot wie im Original (Rechtslage offen)', () => {
    const p = at(150, { studyEnd: 25, eligStudy: false }), r = model(p).res.avd!;
    expect(r.noElig).toBe(3);
    expect(r.sideOwn).toBeCloseTo(150 * 12 * 3, 6);
    expect(r.unsubOwn).toBe(0);
    expect(r.net).toEqual(model(p, WITHOUT).res.avd!.net);
  });

  it('gleich viel eigenes Geld wie ETF und Versicherung ⇒ fairer Vergleich', () => {
    const a = analyze(at(450));
    expect(a.fairOwn).toBe(true);
    expect(a.res.avd!.own).toBeCloseTo(a.res.etf!.own, 6);
  });

  it('ohne Rendite, Kosten und Inflation: der ungeförderte Teil kommt genau als Beiträge zurück, ohne Steuer', () => {
    const z: Partial<Inputs> = { g: 0, gPay: 0, infl: 0, dyn: 0, avdCost: 0, basis: 0, kvOn: false };
    const p450 = at(450, z), p150 = at(150, z), n = p450.R - p450.a0;
    const a = model(p450).res.avd!, b = model(p150).res.avd!;
    // gleiche Zulagen und Erstattungen, der Unterschied ist nur der ungeförderte Teil
    expect(a.zul).toBe(b.zul); expect(a.ref).toBe(b.ref);
    expect(sum(a.net, n) - sum(b.net, n)).toBeCloseTo(300 * 12 * n, 4);
  });

  it('mit Rendite: Steuer nur auf den Gewinnanteil, nach 12 Jahren zur Hälfte (Netto zwischen „steuerfrei“ und „voll versteuert“)', () => {
    const p = at(450, { incRet: 30000 }), n = p.R - p.a0;
    const a = model(p).res.avd!, b = model(at(150, { incRet: 30000 })).res.avd!;
    const extra = sum(a.net, n) - sum(b.net, n);
    // Brutto-Auszahlungen des ungeförderten Teils: ohne Steuer wäre extra größer, mit voller Steuer auf die ganze Auszahlung kleiner
    const gross = a.capAVD! - b.capAVD!;
    expect(extra).toBeGreaterThan(gross); // Rendite in der Auszahlphase kommt dazu
    expect(a.capNet - b.capNet).toBeLessThan(a.capAVD! - b.capAVD!);
    expect(a.capNet - b.capNet).toBeGreaterThan(0.75 * (a.capAVD! - b.capAVD!));
  });

  it('Erbfall: der ungeförderte Teil geht ohne Förderrückzahlung an die Erben, nur dessen Gewinn wird versteuert', () => {
    const p = at(450), a = model(p).res.avd!, b = model(at(150)).res.avd!;
    const k = 25; // Tod mit 47, vor Rentenbeginn
    const d = a.heir(k).val - b.heir(k).val;
    expect(d).toBeGreaterThan(0);
    expect(d).toBeLessThan(a.vals[k]! - b.vals[k]!);
    expect(a.heir(k).note).toContain('ungeförderte Teil');
  });
});
