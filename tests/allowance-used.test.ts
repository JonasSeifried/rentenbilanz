// Sparer-Pauschbetrag schon anderweitig genutzt (allowanceUsed, neu, nicht im Original): 0 = bitgleich,
// Wirkung in Anspar- und Auszahlphase und beim eigenen Verkauf, Erben mit eigenem vollen Pauschbetrag,
// Link, Speicher und Rechenweg. Herleitung: docs/korrekturen.md, Abschnitt „Sparer-Pauschbetrag schon genutzt“.
import { describe, expect, it } from 'vitest';
import { combo, emptySplit, type Split } from '../src/lib/engine/combo';
import { readParams } from '../src/lib/engine/core';
import { analyze } from '../src/lib/engine/analyze';
import { NO_FIXES } from '../src/lib/engine/fixes';
import { DEFAULTS, type Inputs } from '../src/lib/engine/inputs';
import { decodeState, encodeState } from '../src/lib/link';
import { sanitize } from '../src/lib/storage';
import { rechenweg } from '../src/lib/rechenweg';

const P = (patch: Partial<Inputs> = {}) => readParams({ ...DEFAULTS, ...patch });
const S = (patch: Partial<Split>): Split => ({ ...emptySplit(), ...patch });
const DK: Partial<Inputs> = { kvOn: true, kvRate: 21.7 };
const HIGH: Partial<Inputs> = { a0: 30, incWork: 110000, incRet: 45000, setAll: 500, etfM: 500, avdM: 500, insM: 500, fondM: 500, kvOn: true, kvRate: 21.7, kvGrossRet: 45000 };
const CASES: Partial<Inputs>[] = [{}, DK, HIGH, { insLump: false }, { shift: true, kvOn: true }, { indexAllowance: true }, { a0: 60 }];
const SPLITS: Split[] = [S({ etf: 150 }), S({ avd: 150 }), S({ ins: 150 }), S({ fond: 150 }), S({ etf: 100, avd: 200, ins: 100 })];

const books = (p: ReturnType<typeof P>, s: Split, opts = {}) => {
  const c = combo(p, s, { cost: true, ...opts });
  return { net: c.net, incTax: c.incTax, abgTax: c.abgTax, kv: c.kv, capR: c.capR, capNet: c.capNet, foerder: c.foerder, lumpNet: c.lumpNet,
    heir: [1, 10, c.n, c.n + 5].map(i => c.heir(i).val) };
};

describe('Sparer-Pauschbetrag schon genutzt – abschaltbar', () => {
  it('fehlt ⇒ 0; Werte werden auf 0 … 1.000 geklemmt', () => {
    const { allowanceUsed: _, ...legacy } = DEFAULTS;
    expect(readParams(legacy as Inputs).allowanceUsed).toBe(0);
    expect(P({ allowanceUsed: -5 }).allowanceUsed).toBe(0);
    expect(P({ allowanceUsed: 5000 }).allowanceUsed).toBe(1000);
  });
  it('0 rechnet bitgleich wie ohne den Schlüssel (alle Korrekturen und Originalpfad)', () => {
    const { allowanceUsed: _, ...legacy } = DEFAULTS;
    for (const c of CASES) for (const s of SPLITS) for (const opts of [{}, { fixes: NO_FIXES }]) {
      const a = books(readParams({ ...legacy, ...c } as Inputs), s, opts), b = books(P({ ...c, allowanceUsed: 0 }), s, opts);
      expect(b).toEqual(a);
    }
  });
});

describe('Sparer-Pauschbetrag schon genutzt – Wirkung', () => {
  // Ohne Basiszins keine Vorabpauschale: Bis Rentenbeginn entsteht keine Steuer, das Depot ist in beiden Läufen gleich.
  // Entnahmen senken das Depot unabhängig von der Steuer (die geht vom Auszahlbetrag ab). Hohes Alterseinkommen:
  // Günstigerprüfung erstattet nichts, KV aus. Dann kostet jeder verbrauchte Euro Pauschbetrag genau 26,375 Cent.
  const base: Partial<Inputs> = { basis: 0, incRet: 100000, kvOn: false, avdOn: false, insOn: false };

  it('Auszahlphase: Mehrsteuer = 26,375 % des verbrauchten Teils, in heutigem Geld mit der Inflation wachsend', () => {
    for (const infl of [0, 2]) {
      const p0 = P({ ...base, infl }), p5 = P({ ...base, infl, allowanceUsed: 500 });
      const a = combo(p0, S({ etf: 150 })), b = combo(p5, S({ etf: 150 }));
      for (let t = 0; t < a.n; t++) expect(b.parts.etf!.vals[t]).toBe(a.parts.etf!.vals[t]);
      for (let t = a.n; t < a.tH; t++) {
        const used = Math.min(1000, 500 * Math.pow(1 + infl / 100, t));
        expect(a.net[t] - b.net[t]).toBeCloseTo(used * 0.26375, 6);
      }
    }
  });

  it('eigener Verkauf bei Rentenbeginn: Kapital nach Steuer sinkt um 26,375 % des verbrauchten Teils', () => {
    const a = combo(P({ ...base, infl: 0 }), S({ etf: 150 })), b = combo(P({ ...base, infl: 0, allowanceUsed: 400 }), S({ etf: 150 }));
    expect(a.capNet - b.capNet).toBeCloseTo(400 * 0.26375, 6);
    expect(a.parts.etf!.capNet - b.parts.etf!.capNet).toBeCloseTo(400 * 0.26375, 6);
  });

  it('Erben haben ihren eigenen vollen Pauschbetrag', () => {
    for (const opts of [{}, { fixes: NO_FIXES }]) {
      const a = combo(P({ ...base, infl: 0 }), S({ etf: 150 }), opts), b = combo(P({ ...base, infl: 0, allowanceUsed: 1000 }), S({ etf: 150 }), opts);
      for (const idx of [1, 10, a.n - 1]) expect(b.heir(idx).val).toBe(a.heir(idx).val);
      expect(b.parts.etf!.heir(5).val).toBe(a.parts.etf!.heir(5).val);
    }
  });

  it('Ansparphase: Vorabpauschale wird früher besteuert; alle Produkte mit Depot oder Kapitalauszahlung verlieren', () => {
    for (const c of [{}, DK, HIGH]) {
      const st = (u: number) => analyze(P({ ...c, allowanceUsed: u })).stats;
      const s0 = st(0), s5 = st(500), s10 = st(1000);
      for (const k of ['etf', 'avd', 'ins'] as const) {
        expect(s5[k]!.cumH).toBeLessThanOrEqual(s0[k]!.cumH);
        expect(s10[k]!.cumH).toBeLessThanOrEqual(s5[k]!.cumH);
      }
      expect(s10.etf!.cumH).toBeLessThan(s0.etf!.cumH);
      // Das ETF-Depot verliert deutlich mehr als das AVD (nur dessen Nebendepot nutzt den Pauschbetrag).
      expect(s0.etf!.cumH - s10.etf!.cumH).toBeGreaterThan(s0.avd!.cumH - s10.avd!.cumH);
    }
    const a = analyze(P({ allowanceUsed: 0 })), b = analyze(P({ allowanceUsed: 1000 }));
    expect(b.res.etf!.abgTax.slice(0, a.n).reduce((x, y) => x + y, 0)).toBeGreaterThan(a.res.etf!.abgTax.slice(0, a.n).reduce((x, y) => x + y, 0));
  });

  it('Versicherung (Kapitalauszahlung): Pauschbetrag im Auszahljahr entsprechend kleiner', () => {
    const p = { avdOn: false, etfOn: false, infl: 0 } as Partial<Inputs>;
    const a = combo(P(p), S({ ins: 150 })), b = combo(P({ ...p, allowanceUsed: 600 }), S({ ins: 150 }));
    expect(b.parts.ins!.capNet).toBeLessThan(a.parts.ins!.capNet);
  });
});

describe('Sparer-Pauschbetrag schon genutzt – Link, Speicher, Rechenweg', () => {
  it('Link: alter Link ohne Schlüssel ⇒ 0, eigener Wert bleibt erhalten', () => {
    expect(decodeState('#v=1&a0=40').inputs!.allowanceUsed).toBe(0);
    const inp = { ...DEFAULTS, allowanceUsed: 300 };
    expect(decodeState('#' + encodeState(inp, 'overview')).inputs!.allowanceUsed).toBe(300);
    expect(encodeState(DEFAULTS, 'overview')).not.toContain('allowanceUsed');
  });
  it('Speicher: außerhalb 0 … 1.000 wird verworfen', () => {
    expect(sanitize({ allowanceUsed: 300 })!.allowanceUsed).toBe(300);
    expect(sanitize({ allowanceUsed: 1500, a0: 30 })!.allowanceUsed).toBe(0);
  });
  it('Rechenweg nennt den genutzten Betrag und die Erbenregel', () => {
    const inp = { ...DEFAULTS, allowanceUsed: 300 };
    const md = rechenweg(inp, analyze(readParams(inp)), '');
    expect(md).toContain('davon 300 €/Jahr');
    expect(md).toContain('Die Erben haben ihren eigenen vollen Pauschbetrag');
    expect(rechenweg(DEFAULTS, analyze(readParams(DEFAULTS)), '')).toContain('Sparer-Pauschbetrag voll frei angenommen');
  });
});
