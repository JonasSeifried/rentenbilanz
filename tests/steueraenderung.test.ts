// Was-wäre-wenn Steueränderung (abgRate, estAdd, taxFrom; neu, nicht im Original): Standard = heutiges Recht bitgleich,
// Abgeltungsteuer und Einkommensteuer je nur auf ihre Produkte, Stichtag, Kirchensteuer-Formel, Link, Speicher, Rechenweg.
// Herleitung: docs/steueraenderung.md.
import { describe, expect, it } from 'vitest';
import { combo, emptySplit, type Split } from '../src/lib/engine/combo';
import { readParams } from '../src/lib/engine/core';
import { analyze, scenarioList } from '../src/lib/engine/analyze';
import { DEFAULTS, type Inputs } from '../src/lib/engine/inputs';
import { decodeState, encodeState } from '../src/lib/link';
import { sanitize } from '../src/lib/storage';
import { rechenweg } from '../src/lib/rechenweg';
import { changedSettings } from '../src/lib/settingsChanged';
import { faqs } from '../src/lib/prosCons';

const P = (patch: Partial<Inputs> = {}) => readParams({ ...DEFAULTS, ...patch });
const S = (patch: Partial<Split>): Split => ({ ...emptySplit(), ...patch });
const DK: Partial<Inputs> = { kvOn: true, kvRate: 21.7 };
const HIGH: Partial<Inputs> = { a0: 30, incWork: 110000, incRet: 45000, setAll: 500, etfM: 500, avdM: 500, insM: 500, fondM: 500, kvOn: true, kvRate: 21.7, kvGrossRet: 45000 };
const CASES: Partial<Inputs>[] = [{}, DK, HIGH, { insLump: false }, { shift: true, kvOn: true }, { kist: 9, married: true, avdSpouse: 50 }, { a0: 60 }];
const SPLITS: Split[] = [S({ etf: 150 }), S({ avd: 150 }), S({ ins: 150 }), S({ fond: 150 }), S({ etf: 100, avd: 200, ins: 100 })];

const books = (p: ReturnType<typeof P>, s: Split) => {
  const c = combo(p, s, { cost: true });
  return { net: c.net, incTax: c.incTax, abgTax: c.abgTax, kv: c.kv, capR: c.capR, capNet: c.capNet, foerder: c.foerder, lumpNet: c.lumpNet,
    heir: [1, 10, c.n, c.n + 5].map(i => c.heir(i).val) };
};

describe('Steueränderung – Standard bitgleich', () => {
  it('fehlt ⇒ 25 %, 0, ab Rentenbeginn; Grenzen', () => {
    const { abgRate: _a, estAdd: _e, taxFrom: _t, ...legacy } = DEFAULTS;
    const p = readParams(legacy as Inputs);
    expect([p.abgRate, p.estAdd, p.taxFrom]).toEqual([.25, 0, -1]);
    expect(P({ abgRate: 99, estAdd: -50, taxFrom: 5 })).toMatchObject({ abgRate: .6, estAdd: -.14, taxFrom: 16 });
    expect(P({ taxFrom: -7 }).taxFrom).toBe(-1);
  });
  it('heutiges Recht mit beliebigem Stichtag = ohne die neuen Schlüssel', () => {
    const { abgRate: _a, estAdd: _e, taxFrom: _t, ...legacy } = DEFAULTS;
    for (const c of CASES) for (const s of SPLITS) {
      const base = readParams({ ...legacy, ...c } as Inputs);
      expect(books(P({ ...c, taxFrom: 30 }), s)).toEqual(books(base, s));
    }
  });
});

describe('Steueränderung – Wirkung', () => {
  it('Abgeltungsteuer 30 % ab Rentenbeginn: Ansparphase gleich, Verkaufssteuer bei Rentenbeginn × 1,2', () => {
    // Hohes Einkommen im Alter: Günstigerprüfung wählt den Abgeltungssatz; Verkauf bei Rentenbeginn mit vollem Pauschbetrag.
    const base = P({ incRet: 60000 }), up = P({ incRet: 60000, abgRate: 30 });
    const a = combo(base, S({ etf: 150 })), b = combo(up, S({ etf: 150 }));
    const n = a.n, ea = a.parts.etf!, eb = b.parts.etf!;
    expect(eb.vals.slice(0, n + 1)).toEqual(ea.vals.slice(0, n + 1));
    expect(b.abgTax.slice(0, n)).toEqual(a.abgTax.slice(0, n));
    const V = ea.vals[n] as number;
    expect((V - eb.capNet) / (V - ea.capNet)).toBeCloseTo(1.2, 10);
    expect(b.abgTax[n + 1]).toBeGreaterThan(a.abgTax[n + 1] * 1.19);
  });
  it('Abgeltungsteuer ändert die Steuer des Altersvorsorgedepots nicht (ohne angelegte Erstattung)', () => {
    const c = { reinvest: false };
    const a = combo(P(c), S({ avd: 150 })), b = combo(P({ ...c, abgRate: 35 }), S({ avd: 150 }));
    expect(b.incTax).toEqual(a.incTax);
    expect(b.parts.avd!.capR).toBe(a.parts.avd!.capR);
  });
  it('Einkommensteuer +5 Punkte: AVD-Steuer im Rentenjahr um 5 % der Auszahlung höher (± Rundung), ETF mit Abgeltungssatz unverändert', () => {
    const c = { incRet: 60000, reinvest: false }; // ESt unter der Soli-Freigrenze, Grenzsatz über 26,375 %
    const a = combo(P(c), S({ avd: 150 })), b = combo(P({ ...c, estAdd: 5 }), S({ avd: 150 }));
    const t = a.n + 3, X = a.parts.avd!.taxBase[t];
    expect(X).toBeGreaterThan(0);
    expect(Math.abs(b.incTax[t] - a.incTax[t] - 0.05 * X)).toBeLessThan(2 * a.I(t));
    const e1 = combo(P({ incRet: 60000 }), S({ etf: 150 })), e2 = combo(P({ incRet: 60000, estAdd: 5 }), S({ etf: 150 }));
    expect(e2.net).toEqual(e1.net);
  });
  it('Versicherung nach 12 Jahren ab 62: Kapitalauszahlung hängt an der Einkommensteuer, nicht an der Abgeltungsteuer', () => {
    const a = combo(P(), S({ ins: 150 })), b = combo(P({ abgRate: 40 }), S({ ins: 150 })), c = combo(P({ estAdd: 5 }), S({ ins: 150 }));
    expect(b.parts.ins!.kapNet).toBe(a.parts.ins!.kapNet);
    expect(c.parts.ins!.kapNet!).toBeLessThan(a.parts.ins!.kapNet!);
  });
  it('Stichtag: ab Alter 40 trifft die Vorabpauschale ab dann, davor nicht', () => {
    const a = combo(P({ incWork: 90000 }), S({ etf: 1000 })), b = combo(P({ incWork: 90000, abgRate: 30, taxFrom: 40 }), S({ etf: 1000 }));
    const t40 = 40 - 22;
    expect(a.abgTax[t40 - 1]).toBeGreaterThan(0);
    expect(b.abgTax.slice(0, t40)).toEqual(a.abgTax.slice(0, t40));
    expect(b.abgTax[t40 + 1]).toBeGreaterThan(a.abgTax[t40 + 1]);
  });
  it('Kirchensteuer: Satz s(1,055 + k)/(1 + s·k), bei 25 % wie § 32d Abs. 1 S. 4', () => {
    const p = P({ incRet: 90000, kist: 9 }), q = P({ incRet: 90000, kist: 9, abgRate: 30 });
    const a = combo(p, S({ etf: 150 })), b = combo(q, S({ etf: 150 }));
    const V = a.parts.etf!.vals[a.n] as number;
    const r25 = (1.055 + .09) / (4 + .09), r30 = .3 * (1.055 + .09) / (1 + .3 * .09);
    expect((V - b.parts.etf!.capNet) / (V - a.parts.etf!.capNet)).toBeCloseTo(r30 / r25, 10);
  });
  it('Senkung (negativ) zieht nie unter 0 Steuer', () => {
    const r = combo(P({ incRet: 0, estAdd: -14 }), S({ avd: 150 }));
    for (const x of r.incTax) expect(x).toBeGreaterThanOrEqual(-1e-9);
  });
});

describe('Steueränderung – Oberfläche und Texte', () => {
  it('Szenarien: zwei Zeilen bei heutigem Recht, sonst eine Rückkehr-Zeile', () => {
    const ids = scenarioList(P()).map(s => s.id);
    expect(ids).toContain('taxAbg'); expect(ids).toContain('taxEst'); expect(ids).not.toContain('taxNow');
    const s = scenarioList(P({ abgRate: 30, taxFrom: 50 }));
    expect(s.map(x => x.id)).toContain('taxNow');
    expect(s.find(x => x.id === 'taxNow')!.p).toMatchObject({ abgRate: .25, estAdd: 0, taxFrom: 50 });
    expect(scenarioList(P({ taxFrom: 50 })).find(x => x.id === 'taxAbg')!.label).toBe('Abgeltungsteuer 30 % statt 25 % ab 50 (hypothetisch)');
  });
  it('Link und Speicher', () => {
    expect(decodeState('#v=1&a0=40').inputs!).toMatchObject({ abgRate: 25, estAdd: 0, taxFrom: -1 });
    const inp = { ...DEFAULTS, abgRate: 30, estAdd: 5, taxFrom: 50 };
    expect(decodeState('#' + encodeState(inp, 'overview')).inputs!).toMatchObject({ abgRate: 30, estAdd: 5, taxFrom: 50 });
    expect(sanitize({ abgRate: 30 })!.abgRate).toBe(30);
  });
  it('Badge zählt den Stichtag nur mit einer Änderung', () => {
    expect(changedSettings({ ...DEFAULTS, taxFrom: 50 })).toEqual([]);
    expect(changedSettings({ ...DEFAULTS, abgRate: 30, taxFrom: 50 })).toEqual(['abgRate']);
  });
  it('Rechenweg nennt heutiges Recht bzw. die Annahme', () => {
    expect(rechenweg(DEFAULTS, analyze(readParams(DEFAULTS)), '')).toContain('heute geltendes Recht (Stand 2026)');
    const inp = { ...DEFAULTS, abgRate: 30, estAdd: 5 };
    const md = rechenweg(inp, analyze(readParams(inp)), '');
    expect(md).toContain('Was-wäre-wenn Steueränderung (hypothetisch');
    expect(md).toContain('ab Rentenbeginn (Alter 67)');
    expect(md).toContain('Abgeltungsteuersatz 30 % statt 25 %');
    expect(md).toContain('um 5 Prozentpunkte höher');
  });
  it('FAQ nennt je Produkt die Steuer, ohne Empfehlung', () => {
    const f = faqs(P(), ['etf', 'avd', 'ins']).find(x => x.id === 'taxChange')!.a.join(' ');
    expect(f).toContain('§ 22 Nr. 5 EStG');
    expect(f).not.toMatch(/empfehl|lohnt sich|solltest|besser|sicherer/i);
  });
});
