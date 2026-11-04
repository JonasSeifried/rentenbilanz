// Standarddepot-Umschichtung (avdStd, § 1 Abs. 1c Nr. 5 AltZertG ab 01.01.2027): fünf Jahre vor Rentenbeginn höchstens 50 %,
// zwei Jahre vorher und zu Beginn höchstens 30 % im chancenreichen Fonds. Standard aus; dann bitgleich zum bisherigen Pfad.
import { describe, expect, it } from 'vitest';
import { avdGrowth, model, readParams, type Params } from '../src/lib/engine/engine';
import { combo } from '../src/lib/engine/combo';
import { DEFAULTS, type Inputs } from '../src/lib/engine/inputs';

const at = (x: Partial<Inputs> = {}): Params => readParams({ ...DEFAULTS, ...x });

describe('Standarddepot-Umschichtung vor Rentenbeginn', () => {
  it('aus: avdSafe ändert nichts (bitgleich)', () => {
    for (const x of [{}, { avdM: 450 }, { kvOn: true }, { a0: 64 }] as Partial<Inputs>[]) {
      const a = model(at(x)).res.avd!, b = model(at({ ...x, avdSafe: -3 })).res.avd!;
      expect(b.vals).toEqual(a.vals); expect(b.net).toEqual(a.net); expect(b.capNet).toBe(a.capNet);
    }
  });

  it('Rendite je Jahr: 100 % bis 6 Jahre vorher, 50 % ab 5, 30 % ab 2 Jahren vorher, Auszahlphase gPay', () => {
    const p = at({ avdStd: true, avdSafe: 2 }), n = p.R - p.a0;
    expect(avdGrowth(p, n - 6, n)).toBe(p.g);
    for (const t of [n - 5, n - 4, n - 3]) expect(avdGrowth(p, t, n)).toBeCloseTo(0.5 * 0.06 + 0.5 * 0.02, 12);
    for (const t of [n - 2, n - 1]) expect(avdGrowth(p, t, n)).toBeCloseTo(0.3 * 0.06 + 0.7 * 0.02, 12);
    expect(avdGrowth(p, n, n)).toBe(p.gPay);
    expect(avdGrowth(at(), n - 1, n)).toBe(p.g); // aus
  });

  it('weniger Kapital bei sicherer Rendite unter der Aktienrendite; nur das AVD betroffen', () => {
    const off = model(at({ avdM: 450 })).res, on = model(at({ avdM: 450, avdStd: true, avdSafe: 2 })).res;
    expect(on.avd!.capAVD!).toBeLessThan(off.avd!.capAVD!);
    expect(on.avd!.sideR).toBe(off.avd!.sideR); // Nebendepot (Steuererstattung) schichtet nicht um
    expect(on.etf!.capR).toBe(off.etf!.capR);
    expect(on.ins!.capR).toBe(off.ins!.capR);
    // Grob: Die letzten fünf Jahre wachsen um rund 12 % weniger (≈ 3 × 2 % + 2 × 2,8 %).
    const ratio = on.avd!.capAVD! / off.avd!.capAVD!;
    expect(ratio).toBeGreaterThan(0.86); expect(ratio).toBeLessThan(0.92);
  });

  it('sichere Rendite = Aktienrendite: praktisch gleiches Ergebnis', () => {
    const off = model(at()).res.avd!, on = model(at({ avdStd: true, avdSafe: 6 })).res.avd!;
    expect(on.capR).toBeCloseTo(off.capR, 6);
  });

  it('Kombi-Engine rechnet die Umschichtung gleich (auch mit ungefördertem Teil)', () => {
    for (const avd of [150, 450]) {
      const p = at({ avdStd: true, avdSafe: 1.5, avdM: avd, setAll: avd });
      const single = model(p).res.avd!, part = combo(p, { etf: 0, avd, ins: 0, fond: 0 }).parts.avd!;
      expect(part.capR).toBe(single.capR);
      expect(part.net).toEqual(single.net);
    }
  });
});
