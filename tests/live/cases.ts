// Eingaben und kanonische Serialisierung für das Regressions-Fixture der Live-Rechnung (tests/live-regression.test.ts).
// Live-Rechnung = genau die Aufrufe der App (App.svelte, Overview, KombiDialog): readParams → analyze/scenarios ohne
// Optionen (alle Korrekturen, neueste Rechtsstand-Tabelle), Kombi aus readKombi; bei gezielten Fällen zusätzlich
// costBreakEvens, bestSplit, analyzeCombo und robustRows.
import { createHash } from 'node:crypto';
import { readParams } from '../../src/lib/engine/core';
import { DEFAULTS, type Inputs } from '../../src/lib/engine/inputs';
import { analyze, scenarios, type Analysis } from '../../src/lib/engine/analyze';
import { readCombo, readKombi } from '../../src/lib/engine/combo';
import { costBreakEvens } from '../../src/lib/engine/breakEven';
import { bestSplit } from '../../src/lib/engine/search';
import { analyzeCombo, robustRows } from '../../src/lib/engine/comboAnalyze';
import type { EngineOptions } from '../../src/lib/engine/fixes';

export interface LiveCase { id: string; inputs: Inputs; deep: boolean; robust: boolean }

// Die 29 benannten Fälle aus tests/golden.test.ts (gleiche Reihenfolge, gleiche Eingaben).
const GOLDEN_NAMED: [string, Partial<Inputs>][] = [
  ['Standardwerte', {}],
  ['Bisherige persönliche Werte (Original-Defaults)', { a0: 23, incWork: 85000, incRet: 40000, studyEnd: 24, incStudy: 35000 }],
  ['Leibrente', { insLump: false }],
  ['Leibrente, lange Garantiezeit, Rente mit 70', { insLump: false, gz: 25, R: 70, H: 95 }],
  ['Krankenversicherung an', { kvOn: true }],
  ['Krankenversicherung an, Leibrente, hohe Rente', { kvOn: true, insLump: false, incRet: 60000 }],
  ['AVD-Einmalauszahlung 30 %', { einmal: true }],
  ['Einmalauszahlung mit KV', { einmal: true, kvOn: true }],
  ['Dynamik 3 %', { dyn: 3 }],
  ['Dynamik 5 %, hoher Beitrag (Überlauf ins Nebendepot)', { dyn: 5, setAll: 250, etfM: 250, avdM: 250, insM: 250, fondM: 250 }],
  ['Erbfall vor Rentenbeginn (50)', { deathAge: 50 }],
  ['Erbfall nach Rentenbeginn (80)', { deathAge: 80 }],
  ['Erbfall hälftig ab 62', { deathAge: 75, heirHalf: true }],
  ['Nicht förderberechtigt im Studium', { a0: 20, studyEnd: 25, incStudy: 8000, eligStudy: false }],
  ['Förderberechtigt im Studium', { a0: 20, studyEnd: 25, incStudy: 8000, eligStudy: true }],
  ['Nominal statt Kaufkraft', { real: false }],
  ['Steuererstattung ausgegeben', { reinvest: false }],
  ['Kinder', { kids: 2, kidsFrom: 25, kidsYears: 20 }],
  ['Aktiver Fonds dazu', { fondOn: true }],
  ['Ungleiche Beiträge', { etfM: 200 }],
  ['Nur ein Produkt', { avdOn: false, insOn: false }],
  ['Spät einsteigen (60, kurze Laufzeit)', { a0: 60, R: 65, H: 85, bonus: true }],
  ['Rendite negativ', { g: -2, gPay: -1 }],
  ['Rendite 0, Basiszins 0, Inflation 0', { g: 0, gPay: 0, basis: 0, infl: 0 }],
  ['Kosten 0', { avdCost: 0, etfTer: 0, insEff: 0 }],
  ['Hohes Gehalt, Spitzensteuersatz', { incWork: 300000, incRet: 120000 }],
  ['Kein Einkommen im Alter', { incRet: 0, kvOn: true }],
  ['Bonus aus', { bonus: false }],
  ['Grenzwerte außerhalb (werden geklemmt)', { a0: 10, R: 80, H: 200, deathAge: 5, kvRate: 99, g: 99, infl: -30 }],
];

const ALL4 = { etfOn: true, avdOn: true, insOn: true, fondOn: true };
// Gezielte Fälle für Rechnung, die Golden (NO_FIXES) und I1 nicht abdecken.
const TARGETED: [string, Partial<Inputs>, { robust?: boolean }?][] = [
  ['verheiratet, Splitting, Partner verdient weniger', { married: true, incSpouse: 15000, incSpouseRet: 12000 }],
  ['verheiratet, Partner ohne Einkommen', { married: true, incSpouse: 0, incSpouseRet: 0, kvOn: true }],
  ['verheiratet, Erbfall nach Rentenbeginn', { married: true, incSpouse: 30000, deathAge: 80, heirHalf: true }],
  ['Kirchensteuer 9 %', { kist: 9 }],
  ['Kirchensteuer 8 %, hohes Gehalt, KV', { kist: 8, incWork: 120000, incRet: 50000, kvOn: true }],
  ['Kirchensteuer 9 % und verheiratet', { kist: 9, married: true, incSpouse: 60000, incSpouseRet: 25000 }],
  ['Gehaltsverlauf steigend', { incPeak: 60000, incPeakAge: 45 }],
  ['Gehaltsverlauf ab Ausbildung, Ziel spät', { a0: 20, studyEnd: 25, incStudy: 9000, incWork: 30000, incPeak: 90000, incPeakAge: 66 }],
  ['Gehaltsverlauf sinkend, Ziel sofort', { incPeak: 25000, incPeakAge: 20 }],
  ['Umschichtung vor Rentenbeginn', { shift: true, safeRate: 2 }],
  ['Umschichtung, alle Produkte, KV', { ...ALL4, shift: true, safeRate: 1.5, kvOn: true }],
  ['Partner-Vertrag, Partner mit Einkommen', { married: true, incSpouse: 40000, avdSpouse: 100 }],
  ['Partner-Vertrag, Partner ohne Einkommen (mittelbar)', { married: true, incSpouse: 0, incSpouseRet: 0, avdSpouse: 20 }],
  ['Partner-Vertrag, kleiner Eigenbeitrag', { married: true, incSpouse: 0, avdSpouse: 5, avdM: 8, setAll: 8, etfM: 8, insM: 8, fondM: 8 }],
  ['Kombi ETF + AVD', { combo: true, cEtf: 75, cAvd: 75 }, { robust: true }],
  ['Kombi alle vier, KV, hoher Beitrag', { ...ALL4, setAll: 600, etfM: 600, avdM: 600, insM: 600, fondM: 600, combo: true, cEtf: 200, cAvd: 200, cIns: 100, cFond: 100, kvOn: true }],
  ['Kombi mit Leibrente, verheiratet, Erbfall', { combo: true, cEtf: 50, cAvd: 50, cIns: 50, insLump: false, married: true, incSpouse: 20000, deathAge: 78 }],
  ['Steueränderung Abgeltungsteuer 30 %', { abgRate: 30 }],
  ['Steueränderung ESt +5 Punkte ab 50', { estAdd: 5, taxFrom: 50 }],
  ['Steueränderung beides, Kirchensteuer, nominal', { abgRate: 35, estAdd: 3, kist: 9, real: false }],
  ['Steuersenkung ESt −2 Punkte ab heute', { estAdd: -2, taxFrom: 22, combo: true, cEtf: 100, cIns: 50 }],
  ['Sparer-Pauschbetrag teils genutzt, indexiert', { allowanceUsed: 600, indexAllowance: true }],
  ['Sparer-Pauschbetrag verheiratet genutzt', { married: true, allowanceUsed: 1500 }],
  ['KV-Brutto getrennt, Restkapital, Förderverzug', { kvOn: true, kvGrossRet: 30000, payResidual: true, fundingDelay: true }],
  ['Eigene Auszahlkosten', { fondOn: true, avdPayCost: 0.3, etfPayTer: 0.1, fondPayTer: 1.0 }],
  ['AVD über Höchstbetrag (ungefördert), Kinder', { setAll: 700, etfM: 700, avdM: 700, insM: 700, kids: 2, kidsFrom: 24, kidsYears: 22, dyn: 2 }],
  ['Kleiner AVD-Beitrag unter 120 €/Jahr', { avdM: 8 }],
  ['Versicherung: Tod vor Rentenbeginn, Kapitalauszahlung vor 12 Jahren', { a0: 58, R: 67, deathAge: 62 }],
  ['Alles zusammen', { ...ALL4, a0: 30, incWork: 70000, incPeak: 95000, incPeakAge: 50, incRet: 30000, kist: 9, married: true, incSpouse: 25000, incSpouseRet: 15000, avdSpouse: 50, shift: true, abgRate: 28, estAdd: 2, kvOn: true, allowanceUsed: 300, combo: true, cEtf: 60, cAvd: 50, cIns: 20, cFond: 20, deathAge: 85, heirHalf: true, dyn: 1, kids: 1 }],
];

function rng(seed: number) {
  let s = seed;
  const rnd = () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return { rnd, int: (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1)), r1: (lo: number, hi: number) => Math.round((lo + rnd() * (hi - lo)) * 10) / 10, b: () => rnd() < 0.5 };
}

/** Die 300 Zufallsszenarien aus tests/golden.test.ts (gleicher Seed, gleiche Reihenfolge der Zufallszahlen). */
function goldenRandom(): Inputs[] {
  const { rnd, int, r1, b } = rng(20260526);
  const out: Inputs[] = [];
  for (let i = 0; i < 300; i++) {
    const a0 = int(16, 60), m = int(0, 40) * 10;
    out.push({
      ...DEFAULTS,
      a0, incWork: int(0, 200) * 1000, incRet: int(0, 90) * 1000, setAll: m, g: r1(-3, 10), R: int(65, 70), kvOn: b(),
      etfOn: b(), avdOn: b(), insOn: b(), fondOn: b(),
      H: int(80, 100), gPay: r1(-2, 7), einmal: b(), insLump: b(), rf: int(15, 45), gz: int(0, 30),
      deathAge: int(a0 + 1, 100), heirHalf: b(),
      studyEnd: int(16, 35), incStudy: int(0, 40) * 1000, eligStudy: b(), kvRate: r1(14, 25),
      infl: r1(0, 5), dyn: int(0, 5), basis: r1(0, 5),
      etfM: rnd() < 0.8 ? m : int(0, 40) * 10, etfTer: r1(0, 1),
      avdM: rnd() < 0.8 ? m : int(0, 40) * 10, avdCost: r1(0, 1.5), kids: int(0, 3), kidsFrom: int(20, 45), kidsYears: int(0, 25), bonus: b(), reinvest: b(),
      insM: rnd() < 0.8 ? m : int(0, 40) * 10, insEff: r1(0, 2.5),
      fondM: m, fondAA: r1(0, 6), fondTer: r1(0, 2.5),
      real: b(),
    });
  }
  return out;
}

/** Weitere Zufallsszenarien mit den Eingaben, die es im Original nicht gibt (Steuerprofil, Verlauf, Kombi …). */
function extendedRandom(count: number): Inputs[] {
  const { rnd, int, r1, b } = rng(20261106);
  const base = goldenRandom();
  const out: Inputs[] = [];
  for (let i = 0; i < count; i++) {
    const v = { ...base[i] };
    const m = v.setAll;
    const married = b();
    Object.assign(v, {
      kist: rnd() < 0.3 ? (b() ? 8 : 9) : 0,
      married, incSpouse: int(0, 80) * 1000, incSpouseRet: int(0, 40) * 1000, avdSpouse: married && rnd() < 0.4 ? int(0, 20) * 10 : 0,
      incPeak: rnd() < 0.4 ? int(0, 200) * 1000 : -1, incPeakAge: int(20, 70),
      shift: rnd() < 0.3, safeRate: r1(0, 3),
      abgRate: rnd() < 0.25 ? int(15, 40) : 25, estAdd: rnd() < 0.25 ? int(-5, 8) : 0, taxFrom: rnd() < 0.5 ? -1 : int(16, 90),
      allowanceUsed: rnd() < 0.3 ? int(0, 20) * 100 : 0, indexAllowance: rnd() < 0.2,
      kvGrossRet: rnd() < 0.2 ? int(0, 80) * 1000 : -1, payResidual: rnd() < 0.3, fundingDelay: rnd() < 0.2,
      avdPayCost: rnd() < 0.2 ? r1(0, 1.5) : -1, etfPayTer: rnd() < 0.2 ? r1(0, 1) : -1, fondPayTer: rnd() < 0.2 ? r1(0, 2) : -1,
      incHeir: int(0, 120) * 1000,
    });
    if (rnd() < 0.4) {
      const a = int(0, 4), c = int(0, 4), d = int(0, 4), e = int(0, 4), s = a + c + d + e || 1;
      Object.assign(v, { combo: true, cEtf: Math.round(m * a / s), cAvd: Math.round(m * c / s), cIns: Math.round(m * d / s), cFond: Math.round(m * e / s) });
    }
    out.push(v);
  }
  return out;
}

export function liveCases(): LiveCase[] {
  const out: LiveCase[] = [];
  GOLDEN_NAMED.forEach(([name, patch]) => out.push({ id: 'golden: ' + name, inputs: { ...DEFAULTS, ...patch }, deep: false, robust: false }));
  goldenRandom().forEach((v, i) => out.push({ id: 'golden-zufall #' + i, inputs: v, deep: false, robust: false }));
  TARGETED.forEach(([name, patch, o]) => out.push({ id: 'gezielt: ' + name, inputs: { ...DEFAULTS, ...patch }, deep: true, robust: !!o?.robust }));
  extendedRandom(150).forEach((v, i) => out.push({ id: 'erweitert-zufall #' + i, inputs: v, deep: false, robust: false }));
  return out;
}

// ---------- kanonische, bitgenaue Serialisierung ----------

const num = (x: number) => Object.is(x, -0) ? '-0' : String(x); // String(double) ist die kürzeste exakt umkehrbare Darstellung
const EVAL_IDX = new Set(['heir', 'heirMarried', 'sellNet']);
const SKIP_FN = new Set(['R', 'ownOf']); // R = Anzeige-Umrechnung aus I; ownOf wird je Teilnehmer ausgewertet
// sig = Cache-Schlüssel der Suche (comboSig), kein Rechenergebnis; enthält die Kennung des Rechtsstands.
const SKIP_KEY = new Set(['sig']);

/** Jede Zahl exakt, jede Funktion des Erbfalls für jedes Todesjahr 0 … T ausgewertet; Schlüssel sortiert. */
export function canon(x: unknown, T: number, key = '', only?: number): string {
  if (typeof x === 'number') return num(x);
  if (typeof x === 'string') return JSON.stringify(x);
  if (typeof x === 'boolean' || x === null) return String(x);
  if (x === undefined) return 'u';
  if (typeof x === 'function') {
    if (EVAL_IDX.has(key) || key === 'I') {
      const out: string[] = [];
      if (only !== undefined && key !== 'I') out.push(canon((x as (i: number) => unknown)(only), T));
      else for (let i = 0; i <= T; i++) out.push(canon((x as (i: number) => unknown)(i), T));
      return 'f[' + out.join(',') + ']';
    }
    if (SKIP_FN.has(key)) return 'skip';
    throw new Error('Unbekannte Funktion im Ergebnis: ' + key);
  }
  if (Array.isArray(x)) return '[' + x.map(v => canon(v, T, '', only)).join(',') + ']';
  const o = x as Record<string, unknown>;
  return '{' + Object.keys(o).filter(k => !SKIP_KEY.has(k)).sort().map(k => JSON.stringify(k) + ':' + canon(o[k], T, k, only)).join(',') + '}';
}

/** only: Erbfall nur für dieses Todesjahr (Szenario-Zeilen; der Hauptlauf wertet jedes Jahr aus). */
function analysisCanon(A: Analysis, only?: number): string {
  const own = A.active.map(pr => pr.key + '=' + num(A.ownOf(pr))).join(',');
  return canon(A, A.T, '', only) + '|own:' + own;
}

export interface LiveRecord { id: string; stats: Analysis['stats']; lead: string | null; canRank: boolean; scen: number; hash: string }

/** Rechnet einen Fall wie die App; opts nur für Tests mit explizitem Rechtsstand (undefined = App). */
export function computeLive(c: LiveCase, opts?: EngineOptions): { record: LiveRecord; full: string } {
  const p = readParams(c.inputs), kombi = readKombi(c.inputs);
  const A = analyze(p, opts, kombi);
  const S = scenarios(p, opts, kombi);
  const parts = ['analyze:' + analysisCanon(A)];
  S.forEach((s, i) => parts.push('scen' + i + ':' + s.id + ':' + JSON.stringify(s.label) + ':' + canon(s.p, A.T) + ':' + analysisCanon(s.a, Math.max(0, s.p.deathAge - s.p.a0))));
  if (c.deep) {
    parts.push('breakEven:' + canon(costBreakEvens(A, opts), A.T));
    const setup = readCombo(c.inputs, p);
    const best = setup.keys.length >= 2 && setup.budget > 0 ? bestSplit(p, setup.budget, setup.keys, opts) : null;
    parts.push('best:' + canon(best, A.T));
    parts.push('analyzeCombo:' + canon(analyzeCombo(p, setup, best, opts), A.T));
    if (c.robust) parts.push('robust:' + canon([...robustRows(p, setup, best?.split ?? null, opts)], A.T));
  }
  const full = parts.join('\n');
  return {
    record: { id: c.id, stats: A.stats, lead: A.lead?.key ?? null, canRank: A.canRank, scen: S.length, hash: createHash('sha256').update(full).digest('hex') },
    full,
  };
}
