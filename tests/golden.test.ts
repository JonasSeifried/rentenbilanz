// Golden-Tests: Original-Engine (legacy/index.html) gegen portierte Engine (src/lib/engine) ohne Korrekturen (NO_FIXES).
// Beide bekommen exakt dieselben Eingaben; jede Zahl muss auf den Cent übereinstimmen.
// Die Korrekturen selbst prüft tests/fixes.test.ts (siehe docs/abweichungen-vom-original.md).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { describe, expect, it, beforeAll } from 'vitest';
import { readParams, model, type ProductKey } from '../src/lib/engine/engine';
import { analyze, scenarios } from '../src/lib/engine/analyze';
import { NO_FIXES } from '../src/lib/engine/fixes';
import { DEFAULTS, LEGACY_KEYS, type Inputs } from '../src/lib/engine/inputs';

const CENT = 0.005;
const OPTS = { fixes: NO_FIXES };
// Einzige erlaubte neue Schlüssel (fehlen im Original): params.incHeir und stats.*.cumHReal. Alles andere muss strukturell gleich sein.
const ALLOW_NEW = [/^(params|scen\[\d+\]\.p)\.incHeir$/, /^(scen\[\d+\]\.)?stats\.\w+\.cumHReal$/];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
let legacy: { readParams: () => Any; model: (p: Any) => Any; analyze: (p: Any) => Any; scenarios: (p: Any) => Any };
let doc: Document;

beforeAll(() => {
  const html = readFileSync(fileURLToPath(new URL('../legacy/index.html', import.meta.url)), 'utf8');
  const hook = 'window.__legacy = { readParams, model, analyze, scenarios };';
  // Nur im Test: statt des ersten Renderns die internen Funktionen herausreichen. Die Datei selbst bleibt unverändert.
  const patched = html.replace('showTab(loadState());', hook);
  if (patched === html) throw new Error('Legacy-Hook nicht gefunden – hat sich legacy/index.html geändert?');
  const dom = new JSDOM(patched, { runScripts: 'dangerously', url: 'https://example.test/' });
  legacy = (dom.window as Any).__legacy;
  doc = dom.window.document;
  if (!legacy) throw new Error('Legacy-Engine nicht geladen');
});

function setLegacyInputs(v: Inputs) {
  for (const k of LEGACY_KEYS) {
    const el = doc.getElementById(k) as HTMLInputElement | null;
    if (!el) throw new Error('Feld fehlt im Original: ' + k);
    if (el.type === 'checkbox') el.checked = v[k] as boolean;
    else el.value = String(v[k]);
  }
}

let maxDiff = 0, compared = 0;
function cmp(a: unknown, b: unknown, path: string) {
  if (typeof a === 'number' && typeof b === 'number') {
    compared++;
    if (Number.isNaN(a) && Number.isNaN(b)) return;
    if (!isFinite(a) || !isFinite(b)) { expect(b, path).toBe(a); return; }
    const d = Math.abs(a - b);
    if (d > maxDiff) maxDiff = d;
    if (d > CENT) expect.fail(`${path}: Original ${a}, Port ${b} (Δ ${d})`);
    return;
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    expect(Array.isArray(a) && Array.isArray(b), path + ' ist Array').toBe(true);
    const aa = a as unknown[], bb = b as unknown[];
    expect(bb.length, path + '.length').toBe(aa.length);
    aa.forEach((x, i) => cmp(x, bb[i], `${path}[${i}]`));
    return;
  }
  if (a && typeof a === 'object') {
    const keys = new Set([...Object.keys(a as object), ...Object.keys(b as object)]);
    for (const k of keys) {
      const x = (a as Any)[k], y = (b as Any)[k];
      if (x === undefined && ALLOW_NEW.some(re => re.test(`${path}.${k}`))) continue;
      if (typeof x === 'function' || typeof y === 'function') {
        expect(typeof y, `${path}.${k} ist Funktion`).toBe(typeof x);
        continue; // Funktionen werden gezielt unten ausgewertet
      }
      cmp(x, y, `${path}.${k}`);
    }
    return;
  }
  expect(b, path).toStrictEqual(a);
}

function compareAll(inputs: Inputs) {
  setLegacyInputs(inputs);
  const pL = legacy.readParams();
  const pN = readParams(inputs);
  cmp(pL, pN, 'params');

  const mL = legacy.model(pL), mN = model(pN, OPTS);
  cmp({ T: mL.T, n: mL.n, tH: mL.tH }, { T: mN.T, n: mN.n, tH: mN.tH }, 'model');
  for (let t = 0; t <= mL.T; t++) cmp(mL.I(t), mN.I(t), `I(${t})`);
  const keys = Object.keys(mL.res) as ProductKey[];
  expect(Object.keys(mN.res).sort()).toStrictEqual([...keys].sort());
  for (const k of keys) {
    const rL = mL.res[k], rN = mN.res[k] as Any;
    cmp(rL, rN, `res.${k}`);
    // Erbfall für jedes mögliche Todesjahr (inkl. Hinweistexte)
    for (let i = 0; i <= mL.T; i++) {
      for (const f of ['heir', 'heirMarried', 'sellNet'] as const) {
        if (typeof rL[f] !== 'function') continue;
        const a = rL[f](i), b = rN[f](i);
        cmp(a, b, `res.${k}.${f}(${i})`);
        if (a && typeof a === 'object') expect(b.note, `res.${k}.${f}(${i}).note`).toBe(a.note);
      }
    }
  }

  const aL = legacy.analyze(pL), aN = analyze(pN, OPTS);
  cmp(aL.stats, aN.stats, 'stats');
  expect(aN.fairOwn).toBe(aL.fairOwn);
  expect(aN.refundSpent).toBe(aL.refundSpent);
  expect(aN.canRank).toBe(aL.canRank);
  expect(aN.lead?.key ?? null).toBe(aL.lead?.key ?? null);
  expect(aN.active.map(x => x.name)).toEqual([...aL.active].map((x: Any) => x.name));
  for (const pr of aL.active) cmp(aL.ownOf(pr), aN.ownOf(pr), `ownOf(${pr.key})`);

  const sL = legacy.scenarios(pL), sN = scenarios(pN, OPTS);
  expect(sN.length, 'Anzahl Szenarien').toBe(sL.length);
  sL.forEach((s: Any, i: number) => {
    cmp(s.p, sN[i].p, `scen[${i}].p`);
    cmp(s.a.stats, sN[i].a.stats, `scen[${i}].stats`);
    expect(sN[i].a.lead?.key ?? null, `scen[${i}].lead`).toBe(s.a.lead?.key ?? null);
  });
}

const base = { ...DEFAULTS };
const named: [string, Partial<Inputs>][] = [
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

describe('Golden: Original-Engine = portierte Engine', () => {
  for (const [name, patch] of named) {
    it(name, () => compareAll({ ...base, ...patch }));
  }

  it('300 Zufallsszenarien', () => {
    // Deterministischer Zufall (mulberry32), damit Fehler reproduzierbar sind
    let s = 20260526;
    const rnd = () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const int = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));
    const r1 = (lo: number, hi: number) => Math.round((lo + rnd() * (hi - lo)) * 10) / 10;
    const b = () => rnd() < 0.5;
    for (let i = 0; i < 300; i++) {
      const a0 = int(16, 60), m = int(0, 40) * 10;
      const v: Inputs = {
        ...base,
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
      };
      try { compareAll(v); }
      catch (e) { throw new Error(`Zufallsszenario #${i} weicht ab: ${JSON.stringify(v)}\n${(e as Error).message}`); }
    }
  }, 120_000);

  it('Abweichung über alle Vergleiche', () => {
    // Zusammenfassung: Wie groß ist die größte gemessene Abweichung?
    console.log(`Golden: ${compared.toLocaleString('de-DE')} Zahlen verglichen, größte Abweichung ${maxDiff} €`);
    expect(maxDiff).toBeLessThanOrEqual(CENT);
  });
});
