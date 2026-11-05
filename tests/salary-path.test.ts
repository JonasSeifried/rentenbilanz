// Gehaltsentwicklung (incPeak/incPeakAge, neu, nicht im Original): Verlauf, Abschaltbarkeit, Wirkung je Jahr,
// Szenariozeilen, Link und Speicher. Herleitung: docs/gehaltsentwicklung.md.
import { describe, expect, it } from 'vitest';
import { combo, emptySplit, type Split } from '../src/lib/engine/combo';
import { incomeAt, incomeGrowth, incomePathKind, readParams } from '../src/lib/engine/core';
import { analyze } from '../src/lib/engine/analyze';
import { rechenweg } from '../src/lib/rechenweg';
import { changedSettings } from '../src/lib/settingsChanged';
import { scenarioList } from '../src/lib/engine/analyze';
import { NO_FIXES } from '../src/lib/engine/fixes';
import { DEFAULTS, type Inputs } from '../src/lib/engine/inputs';
import { decodeState, encodeState } from '../src/lib/link';
import { sanitize } from '../src/lib/storage';

const P = (patch: Partial<Inputs> = {}) => readParams({ ...DEFAULTS, ...patch });
const S = (patch: Partial<Split>): Split => ({ ...emptySplit(), ...patch });
const DK: Partial<Inputs> = { kvOn: true, kvRate: 21.7 };
const HIGH: Partial<Inputs> = { a0: 30, incWork: 110000, incRet: 45000, setAll: 500, etfM: 500, avdM: 500, insM: 500, fondM: 500, kvOn: true, kvRate: 21.7, kvGrossRet: 45000 };
const STUDY: Partial<Inputs> = { a0: 20, studyEnd: 25, incStudy: 9000 };
const CASES: [string, Partial<Inputs>][] = [['Standard', {}], ['DK', DK], ['High', HIGH], ['Studium', STUDY]];
const SPLITS: Split[] = [S({ etf: 150 }), S({ avd: 150 }), S({ ins: 150 }), S({ fond: 150 }), S({ etf: 100, avd: 200, ins: 100 })];

/** Vergleichbare Zahlen eines Laufs (ohne Funktionen). */
const books = (p: ReturnType<typeof P>, s: Split) => {
  const c = combo(p, s, { cost: true });
  return { net: c.net, incTax: c.incTax, abgTax: c.abgTax, kv: c.kv, capR: c.capR, capNet: c.capNet, foerder: c.foerder, lumpNet: c.lumpNet,
    heir: [1, 10, c.n, c.n + 5].map(i => c.heir(i).val) };
};

describe('Gehaltsentwicklung – Verlauf', () => {
  it('aus (−1 oder fehlend): exakt incWork bzw. incStudy wie im Original', () => {
    const p = P(STUDY);
    for (let age = p.a0; age < p.R; age++) expect(incomeAt(p, age)).toBe(age < p.studyEnd ? p.incStudy : p.incWork);
    const { incPeak: _a, incPeakAge: _b, ...legacy } = DEFAULTS;
    expect(readParams(legacy as Inputs).incPeak).toBe(-1);
    expect(incomeGrowth(P())).toBeNull();
  });
  it('geometrisch vom Berufsbeginn bis zum Zielalter, danach konstant', () => {
    const p = P({ ...STUDY, incWork: 40000, incPeak: 60000, incPeakAge: 45 });
    const g = Math.pow(1.5, 1 / 20) - 1;
    expect(incomeGrowth(p)).toBeCloseTo(g, 12);
    for (let age = 20; age < 25; age++) expect(incomeAt(p, age)).toBe(9000);
    for (let age = 25; age < 45; age++) expect(incomeAt(p, age)).toBeCloseTo(40000 * Math.pow(1 + g, age - 25), 6);
    for (let age = 45; age < 67; age++) expect(incomeAt(p, age)).toBe(60000);
  });
  it('Randfälle: Zielalter nicht nach Berufsbeginn, sinkender Verlauf, Zielalter nach Rentenbeginn, Endpunkt 0', () => {
    const early = P({ a0: 40, incPeak: 55000, incPeakAge: 30 });
    for (let age = 40; age < 67; age++) expect(incomeAt(early, age)).toBe(55000);
    expect(incomeGrowth(early)).toBeNull();
    const down = P({ incWork: 50000, incPeak: 30000, incPeakAge: 50 });
    for (let age = 23; age < 50; age++) expect(incomeAt(down, age)).toBeLessThan(incomeAt(down, age - 1));
    expect(incomeGrowth(down)!).toBeLessThan(0);
    const late = P({ incPeak: 80000, incPeakAge: 80 });
    expect(incomeAt(late, 66)).toBeLessThan(80000);
    expect(incomeAt(late, 66)).toBeGreaterThan(38000);
    const zero = P({ incWork: 0, incPeak: 40000, incPeakAge: 42 });
    expect(incomeAt(zero, 32)).toBeCloseTo(20000, 9); // linear, da geometrisch von 0 nicht möglich
  });
});

describe('Gehaltsentwicklung – Abschaltbarkeit', () => {
  for (const [name, patch] of CASES) it(`${name}: Zielgehalt = Startgehalt rechnet bitgleich wie ohne Gehaltsentwicklung`, () => {
    const off = P(patch), same = P({ ...patch, incPeak: off.incWork, incPeakAge: 50 });
    for (const s of SPLITS) expect(books(same, s)).toEqual(books(off, s));
  });
  it('Zielalter vor Berufsbeginn rechnet bitgleich wie ein konstantes Zielgehalt', () => {
    const a = P({ incPeak: 61000, incPeakAge: 16 }), b = P({ incWork: 61000 });
    for (const s of SPLITS) expect(books(a, s)).toEqual(books(b, s));
  });
});

describe('Gehaltsentwicklung – Wirkung je Jahr (unabhängig nachgerechnet)', () => {
  // Ohne Inflation und Dynamik ist jedes Ansparjahr gleich; die AVD-Erstattung eines Jahres hängt nur vom Einkommen dieses
  // Jahres ab. Summe der Erstattungen mit Verlauf = Σ_t (Erstattung bei konstantem Einkommen incomeAt(t)) / n.
  for (const extra of [{}, STUDY, { incWork: 60000, incPeak: 140000, incPeakAge: 50 }] as Partial<Inputs>[]) {
    it(`Erstattung = Summe der Jahreserstattungen ${JSON.stringify(extra)}`, () => {
      const base: Partial<Inputs> = { infl: 0, dyn: 0, incWork: 30000, incPeak: 72000, incPeakAge: 48, kids: 0, ...extra };
      const p = P(base), s = S({ avd: 150 });
      const c = combo(p, s);
      let expected = 0;
      for (let t = 0; t < c.n; t++) {
        const y = incomeAt(p, p.a0 + t);
        const q = P({ ...base, incPeak: -1, incWork: y, studyEnd: 16, eligStudy: true });
        expected += combo(q, s).parts.avd!.ref! / c.n;
      }
      expect(c.parts.avd!.ref).toBeCloseTo(expected, 6);
    });
  }
  it('steigendes Gehalt erhöht die AVD-Erstattung, ändert ETF und Versicherung nicht', () => {
    const off = P(), on = P({ incPeak: 60000, incPeakAge: 35 });
    expect(combo(on, S({ avd: 150 })).parts.avd!.ref).toBeGreaterThan(combo(off, S({ avd: 150 })).parts.avd!.ref!);
    for (const s of [S({ etf: 150 }), S({ ins: 150 })]) expect(books(on, s)).toEqual(books(off, s));
  });
});

describe('Gehaltsentwicklung – Szenarien', () => {
  it('Zeile incPath nur außerhalb des Originalpfads; aus ⇒ steigt um 30 % bis 45, an ⇒ bleibt konstant', () => {
    expect(scenarioList(P(), null, { fixes: NO_FIXES }).some(s => s.id === 'incPath')).toBe(false);
    const up = scenarioList(P()).find(s => s.id === 'incPath')!;
    expect(up.label).toBe('Gehalt steigt bis 45 real um 30 % (auf 49.400 €)');
    expect([up.p.incPeak, up.p.incPeakAge]).toEqual([49400, 45]);
    const flat = scenarioList(P({ incPeak: 52000, incPeakAge: 40 })).find(s => s.id === 'incPath')!;
    expect(flat.label).toBe('Gehalt bleibt konstant bei 38.000 €');
    expect(flat.p.incPeak).toBe(-1);
    const older = scenarioList(P({ a0: 50 })).find(s => s.id === 'incPath')!; // mindestens 10 Jahre Verlauf
    expect([older.label, older.p.incPeakAge]).toEqual(['Gehalt steigt bis 60 real um 30 % (auf 49.400 €)', 60]);
    expect(scenarioList(P({ a0: 58 })).some(s => s.id === 'incPath')).toBe(false); // vor der Rente nicht erreichbar
  });
  it('„Gehalt 30 % niedriger“ senkt mit Gehaltsentwicklung den ganzen Verlauf, ohne sie wie im Original', () => {
    const w = scenarioList(P({ incPeak: 52000 })).find(s => s.id === 'incWork')!;
    expect([w.p.incWork, w.p.incPeak]).toEqual([38000 * 0.7, 52000 * 0.7]);
    const o = scenarioList(P()).find(s => s.id === 'incWork')!;
    expect([o.p.incWork, o.p.incPeak, o.label]).toEqual([38000 * 0.7, -1, 'Gehalt 30 % niedriger (26.600 €)']);
  });
});

describe('Gehaltsentwicklung – Link und Speicher', () => {
  it('Rundweg; alte Links und Speicherstände ohne die Schlüssel ⇒ aus', () => {
    const v: Inputs = { ...DEFAULTS, incPeak: 52000, incPeakAge: 40 };
    expect(decodeState(encodeState(v, 'overview')).inputs).toEqual(v);
    expect(encodeState(DEFAULTS, 'overview')).not.toMatch(/incPeak/);
    const old = decodeState('#v=1&incWork=45000').inputs!;
    expect([old.incPeak, old.incPeakAge]).toEqual([-1, 45]);
    expect(sanitize({ incWork: 45000 })!.incPeak).toBe(-1);
    expect(sanitize({ incWork: 45000, incPeak: -7 })!.incPeak).toBe(-1); // außerhalb der Grenzen ⇒ Standard
  });
});

describe('Gehaltsentwicklung – Randfälle in Texten und Eingaben (Review)', () => {
  it('fehlendes incPeakAge bei gesetztem incPeak ⇒ 45 wie der Standard', () => {
    const { incPeakAge: _a, ...rest } = { ...DEFAULTS, incPeak: 60000 };
    expect(readParams(rest as Inputs).incPeakAge).toBe(45);
  });
  it('Zielgehalt sofort: keine Zeile „bleibt konstant“, „30 % niedriger“ nennt das Zielgehalt', () => {
    const p = P({ a0: 40, incPeak: 60000, incPeakAge: 30 });
    expect(incomePathKind(p)).toBe('now');
    const list = scenarioList(p);
    expect(list.some(s => s.id === 'incPath')).toBe(false);
    const w = list.find(s => s.id === 'incWork')!;
    expect(w.label).toBe('Gehalt 30 % niedriger (42.000 €)');
    expect(w.p.incPeak).toBe(42000);
  });
  it('kein Gehalt: keine Zeile „steigt um 30 %“', () => {
    expect(scenarioList(P({ incWork: 0 })).some(s => s.id === 'incPath')).toBe(false);
  });
  it('Rechenweg beschreibt Verlauf, sofortiges Zielgehalt und Zielalter nach Rentenbeginn so, wie gerechnet wird', () => {
    const md = (patch: Partial<Inputs>) => { const inp = { ...DEFAULTS, ...patch }; return rechenweg(inp, analyze(readParams(inp)), 'u', new Date(2026, 10, 5)); };
    expect(md({ incPeak: 60000, incPeakAge: 40 })).toMatch(/ab heute \(Alter 22\) 38\.000 €, bis Alter 40 mit konstantem realem Wachstum \(2,57\d* % p\. a\.\) auf 60\.000 €, danach konstant/);
    const now = md({ a0: 40, incPeak: 55000, incPeakAge: 30 });
    expect(now).toContain('gerechnet wird ab heute (Alter 40) durchgehend mit dem Zielgehalt 55.000 €, das Gehalt 38.000 € wirkt nicht');
    expect(md({ ...STUDY, incPeak: 50000 })).toContain('ab Berufsbeginn (Alter 25) 38.000 €');
    expect(now).toContain('| 0 | 40 | 55.000 |');
    const late = md({ incPeak: 80000, incPeakAge: 80 });
    expect(late).toContain('das Zielalter liegt nach Rentenbeginn, zuletzt (Alter 66) ' + Math.round(incomeAt(P({ incPeak: 80000, incPeakAge: 80 }), 66)).toLocaleString('de-DE') + ' €');
    expect(md({})).toContain('Das Einkommen im Beruf bleibt real gleich');
  });
  it('Einstellungs-Badge zählt die Gehaltsentwicklung, das Alter nur, wenn sie an ist', () => {
    expect(changedSettings({ ...DEFAULTS, incPeakAge: 40 })).toEqual([]);
    expect(changedSettings({ ...DEFAULTS, incPeak: 60000 })).toEqual(['incPeak']);
    expect(changedSettings({ ...DEFAULTS, incPeak: 60000, incPeakAge: 40 })).toEqual(['incPeak']); // eine Angabe
  });
  it('Zielalter nach Rentenbeginn: „30 % niedriger“ sagt „steigend Richtung“; ohne Berufsphase vor der Rente: ohne Wirkung', () => {
    const late = scenarioList(P({ incWork: 40000, incPeak: 100000, incPeakAge: 70 })).find(s => s.id === 'incWork')!;
    expect(late.label).toBe('Gehalt 30 % niedriger (28.000 €, steigend Richtung 70.000 €)');
    const noWork = P({ studyEnd: 70, incPeak: 60000, incPeakAge: 68 });
    expect(incomePathKind(noWork)).toBe('noWork');
    for (let age = noWork.a0; age < noWork.R; age++) expect(incomeAt(noWork, age)).toBe(noWork.incStudy);
    const inp = { ...DEFAULTS, studyEnd: 70, incPeak: 60000, incPeakAge: 68 };
    expect(rechenweg(inp, analyze(readParams(inp)), 'u')).toContain('Gehaltsentwicklung eingetragen, aber ohne Wirkung: Die Ausbildung dauert bis zum Rentenbeginn (Alter 67)');
    expect(scenarioList(noWork).some(s => s.id === 'incPath')).toBe(false);
  });
});
