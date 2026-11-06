// Rechtsstand-Tabellen (src/lib/engine/law.ts):
//  1. Konsistenz der Tabellen (abgeleitete Werte, Tarifstetigkeit, Standardwerte der Eingaben).
//  2. Jeder Tabellenwert ist verdrahtet: Wird genau ein Wert verfälscht, ändert sich die Ausgabe von combo.ts
//     (analyze, Szenarien) und, wo der Wert dort vorkommt, von engine.ts – sonst stünde irgendwo noch ein Literal.
//     Werte, die nicht in die Rechnung gehen, dürfen sie auch nicht ändern. Jeder Wert der Tabelle ist einer der
//     beiden Gruppen zugeordnet (neue Felder lassen sich nicht vergessen).
//  3. Gezielte Verfälschungen (Grundfreibetrag 0, andere KV-BBG) wirken an den erwarteten Stellen und nur dort.
//  4. Keine Jahres-Literale mehr in den Engine-Dateien (außer law.ts).
//  5. Texte der Oberfläche kommen aus der Tabelle (lawText.ts): Formatierung für 2026 festgehalten, kein Jahreswert
//     als fertiger Text oder eindeutige Zahl in src/ außerhalb von law.ts und lawText.ts.
// Dass die Option `law` überall ankommt, prüft tests/law-propagation.test.ts.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CURRENT_LAW, LAW_2026, LAWS, defineLaw, type Law, type LawTable } from '../src/lib/engine/law';
import { readParams, type Params } from '../src/lib/engine/core';
import { model } from '../src/lib/engine/engine';
import { analyze, scenarioList } from '../src/lib/engine/analyze';
import { DEFAULTS, LIMITS, type Inputs } from '../src/lib/engine/inputs';
import { canon } from './live/cases';
import { LT, lawText } from '../src/lib/lawText';

const src = (rel: string) => readFileSync(fileURLToPath(new URL('../' + rel, import.meta.url)), 'utf8');

/** Alle Blätter einer Tabelle als Pfad → Wert (ohne die gebundenen Funktionen). */
function leaves(o: unknown, prefix = ''): [string, unknown][] {
  if (o === null || typeof o !== 'object') return [[prefix, o]];
  return Object.entries(o as Record<string, unknown>).filter(([k]) => k !== 'fn').flatMap(([k, v]) => leaves(v, prefix ? prefix + '.' + k : k));
}
function tableOf(l: Law): LawTable { const { fn: _fn, ...t } = l; return structuredClone(t) as LawTable; }
function withValue(path: string, v: unknown): Law {
  const t = tableOf(LAW_2026) as unknown as Record<string, unknown>;
  const ks = path.split('.');
  let o = t;
  for (const k of ks.slice(0, -1)) o = o[k] as Record<string, unknown>;
  o[ks[ks.length - 1]] = v;
  return defineLaw({ ...(t as unknown as LawTable), id: 'verfälscht ' + path });
}

describe('Tabellen: Konsistenz', () => {
  it('Tabellen eingefroren, Kennungen eindeutig, CURRENT_LAW = neueste', () => {
    expect(Object.isFrozen(LAW_2026)).toBe(true);
    expect(Object.isFrozen(LAW_2026.tariff)).toBe(true);
    expect(Object.isFrozen(LAW_2026.ertrag)).toBe(true);
    expect(new Set(LAWS.map(l => l.id)).size).toBe(LAWS.length);
    for (let i = 1; i < LAWS.length; i++) expect(LAWS[i].year).toBeGreaterThan(LAWS[i - 1].year);
    expect(CURRENT_LAW).toBe(LAWS[LAWS.length - 1]);
    expect(LAW_2026.id).toBe('2026');
  });
  for (const L of LAWS) {
    it(`${L.id}: abgeleitete Werte passen zu den Grundwerten`, () => {
      expect(L.abg.withSoli).toBe(L.abg.rate * L.abg.soliFactor);
      expect(L.abg.divisor).toBe(1 / L.abg.rate);
      expect(L.abg.soliFactor).toBe(1 + L.soli.rate);
      expect(L.avd.grundTop1).toBeLessThan(L.avd.grundTop2);
      expect(L.avd.subMax).toBeLessThanOrEqual(L.avd.max);
    });
    it(`${L.id}: Tarif stetig an den Zonengrenzen (Tippfehler in Koeffizienten)`, () => {
      const t = L.fn.tariff, { gfb, z2End, z3End, z4End } = L.tariff;
      for (const x of [gfb, z2End, z3End, z4End]) expect(Math.abs(t(x + 1) - t(x)), `Grenze ${x}`).toBeLessThan(1);
      expect(t(gfb)).toBe(0);
      expect(t(gfb + 1)).toBeGreaterThan(0);
      // Soli: Milderungszone schließt stetig an den vollen Satz an
      const { fg, rate, cap } = L.soli, end = cap * fg / (cap - rate);
      expect(Math.abs(L.fn.soli(end + 1) - L.fn.soli(end))).toBeLessThan(1);
    });
  }
  it('Standardwerte und Grenzen der Eingaben folgen der neuesten Tabelle', () => {
    const L = CURRENT_LAW;
    expect(DEFAULTS.abgRate / 100).toBe(L.abg.rate);
    expect(DEFAULTS.basis).toBeCloseTo(L.basiszins * 100, 9);
    expect(DEFAULTS.kvRate).toBeCloseTo(L.kv.reduced + L.kv.zusatzAvg + L.kv.pv + L.kv.pvChildless, 9);
    expect(LIMITS.allowanceUsed[1]).toBe(2 * L.spb);
    expect(readParams({ ...DEFAULTS, allowanceUsed: 1e6 }).allowanceUsed).toBe(2 * L.spb);
    const { abgRate: _a, ...noAbg } = DEFAULTS;
    expect(readParams(noAbg as Inputs).abgRate).toBe(L.abg.rate);
  });
});

// ---------- Jeder Wert verdrahtet ----------

const ALL4 = { etfOn: true, avdOn: true, insOn: true, fondOn: true };
// Eingaben, in denen jeder Tabellenwert wirkt (je Wert mindestens eine).
const PROBES: Partial<Inputs>[] = [
  { ...ALL4 },                                                                     // Standard: Tarifzone 3, Zulagen, Bonus, Depotsteuer, Pauschbetrag
  { ...ALL4, incWork: 15000, incRet: 15000, insLump: false, R: 67 },               // Tarifzone 2, Ertragsanteil
  { ...ALL4, incWork: 150000, incRet: 100000 },                                    // Zone 4, Soli voll
  { ...ALL4, incWork: 400000, incRet: 300000 },                                    // Zone 5
  { ...ALL4, incWork: 90000, incRet: 80000 },                                      // Soli-Milderungszone
  { ...ALL4, incRet: 50000, kvOn: true },                                          // KV-BBG
  { ...ALL4, incWork: 60000, incRet: 40000, kist: 9, married: true, incSpouse: 0, incSpouseRet: 0, avdSpouse: 12, kids: 2, kidsFrom: 22, kidsYears: 25 }, // KiSt, Partner mittelbar, Kinder
  { ...ALL4, setAll: 700, etfM: 700, avdM: 700, insM: 700, fondM: 700 },           // AVD-Höchstbeträge
  { ...ALL4, avdM: 12 },                                                           // Mindesteigenbeitrag
  { ...ALL4, married: true, incSpouse: 40000, avdSpouse: 100 },                    // Partner mit eigenem Einkommen und Vertrag (grundOf)
];
const PROBE_P: Params[] = PROBES.map(x => readParams({ ...DEFAULTS, ...x }));

function outCombo(law: Law): string {
  return PROBE_P.map(p => {
    const A = analyze(p, { law });
    return canon(A, A.T) + '|' + scenarioList(p, null, { law }).map(s => s.id + ':' + s.label + ':' + canon(s.p, A.T)).join(';');
  }).join('\n');
}
function outEngine(law: Law): string {
  return PROBE_P.map(p => { const m = model(p, { law }); return canon(m, m.T); }).join('\n');
}

// Verfälschter Wert je Blatt; true in der dritten Spalte: kommt auch in engine.ts (Referenz) vor.
const ENGINE_VALUES: [string, unknown, boolean][] = [
  ['tariff.gfb', 12000, true], ['tariff.z2End', 17000, true], ['tariff.z3End', 66000, true], ['tariff.z4End', 250000, true],
  ['tariff.a2', 900, true], ['tariff.b2', 1450, true], ['tariff.a3', 180, true], ['tariff.b3', 2350, true], ['tariff.c3', 1000, true],
  ['tariff.r4', 0.43, true], ['tariff.c4', 11500, true], ['tariff.r5', 0.46, true], ['tariff.c5', 20000, true],
  ['soli.fg', 18000, true], ['soli.rate', 0.06, true], ['soli.cap', 0.12, true],
  ['abg.rate', 0.26, false], ['abg.withSoli', 0.28, true], ['abg.soliFactor', 1.06, false], ['abg.divisor', 4.2, false],
  ['spb', 801, true], ['saPausch', 50, false], ['kvBbg', 60000, true],
  ['avd.subMax', 1500, true], ['avd.max', 6000, true], ['avd.minOwn', 200, true],
  ['avd.grundRate1', 0.4, true], ['avd.grundTop1', 300, true], ['avd.grundRate2', 0.2, true], ['avd.grundTop2', 1500, true],
  ['avd.kid', 250, true], ['avd.bonus', 150, true],
  ['avd.spouseMinOwn', 200, false], ['avd.spouseRaise', 150, false], ['avd.spouseGrundMax', 150, false],
  ['ertrag', { ...LAW_2026.ertrag, 67: 20 }, true],
];
// Werte ohne Wirkung auf die Rechnung (Oberfläche, Hilfsrechnung pensionTax.ts, Standardwerte der Eingaben, Kennung).
const OTHER_VALUES: [string, unknown][] = [
  ['year', 2099], ['basiszinsSource', 'BMF, 01.01.2099'], ['wkPauschRente', 150], ['kvJaeg', 80000], ['basiszins', 0.05],
  ['kv.general', 15], ['kv.reduced', 14.5], ['kv.zusatzAvg', 3.5], ['kv.pv', 4], ['kv.pvChildless', 1],
];

describe('Jeder Tabellenwert ist verdrahtet (verfälschter Wert ⇒ andere Ausgabe)', () => {
  const refCombo = outCombo(LAW_2026), refEngine = outEngine(LAW_2026);
  it('jedes Blatt der Tabelle ist genau einer Gruppe zugeordnet', () => {
    const paths = leaves(tableOf(LAW_2026)).map(([k]) => k.startsWith('ertrag.') ? 'ertrag' : k);
    const listed = [...ENGINE_VALUES.map(x => x[0]), ...OTHER_VALUES.map(x => x[0]), 'id'];
    expect([...new Set(paths)].sort()).toEqual([...listed].sort());
  });
  it('Referenz: dieselbe Tabelle zweimal ⇒ gleiche Ausgabe; Kennung allein ändert nichts', () => {
    expect(outCombo(withValue('id', 'andere Kennung'))).toBe(refCombo);
  });
  for (const [path, v, inEngine] of ENGINE_VALUES) {
    it(`${path} → combo.ts${inEngine ? ' und engine.ts' : ' (engine.ts unverändert)'}`, () => {
      const L = withValue(path, v);
      expect(outCombo(L) === refCombo, `combo.ts reagiert nicht auf ${path}`).toBe(false);
      expect(outEngine(L) === refEngine, `engine.ts ${inEngine ? 'reagiert nicht auf' : 'darf nicht reagieren auf'} ${path}`).toBe(!inEngine);
    });
  }
  for (const [path, v] of OTHER_VALUES) {
    it(`${path} wirkt nicht auf die Rechnung`, () => {
      const L = withValue(path, v);
      expect(outCombo(L)).toBe(refCombo);
      expect(outEngine(L)).toBe(refEngine);
    });
  }
});

describe('Gezielte Verfälschungen wirken an den erwarteten Stellen', () => {
  const P = (x: Partial<Inputs>) => readParams({ ...DEFAULTS, ...ALL4, ...x });
  // Der Grundfreibetrag verschiebt nur Zone 2 (die Formeln ab Zone 3 hängen nicht von ihm ab): niedrige Einkommen.
  it('Grundfreibetrag 0: Versicherung weniger netto, AVD anders, Depots ohne Günstigerprüfungs-Vorteil; Referenz-ETF ohne R3 unverändert', () => {
    const p = P({ insLump: false, incWork: 15000, incRet: 8000 }), L = withValue('tariff.gfb', 0);
    const a = analyze(p, { law: LAW_2026 }).stats, b = analyze(p, { law: L }).stats;
    expect(b.ins!.cumHReal).toBeLessThan(a.ins!.cumHReal);
    expect(b.avd!.cumHReal).not.toBe(a.avd!.cumHReal); // höhere Steuer im Alter, aber auch höhere Erstattung beim Ansparen
    // Depots: mit der Kapitalertrags-Günstigerprüfung (R3) entfällt bei diesem niedrigen Einkommen der persönliche Satz 0 %.
    expect(b.etf!.cumHReal).toBeLessThan(a.etf!.cumHReal);
    expect(b.fond!.cumHReal).toBeLessThan(a.fond!.cumHReal);
    // Ohne R3 (engine.ts kennt nur die E-Fixes) bleibt die Abgeltungsteuer der Depots unberührt.
    const m0 = model(p, { law: LAW_2026 }), m1 = model(p, { law: L });
    expect(m1.res.ins!.net).not.toEqual(m0.res.ins!.net);
    expect(m1.res.etf!.net).toEqual(m0.res.etf!.net);
  });
  it('KV-BBG niedriger: weniger KV/PV auf Zusatzeinnahmen (mehr netto), ohne KV-Pflicht keine Wirkung', () => {
    const L = withValue('kvBbg', 50000);
    const p = P({ kvOn: true, incRet: 49000 }); // Spielraum bis zur BBG 1.000 € statt 20.750 €
    const a = analyze(p, { law: LAW_2026 }), b = analyze(p, { law: L });
    for (const k of ['etf', 'avd', 'ins', 'fond'] as const) expect(b.stats[k]!.cumHReal, k).toBeGreaterThan(a.stats[k]!.cumHReal);
    const q = P({ kvOn: false, incRet: 49000 });
    expect(analyze(q, { law: L }).stats).toEqual(analyze(q, { law: LAW_2026 }).stats);
  });
  it('Sparer-Pauschbetrag höher: Depots mehr netto, Versicherung mit Leibrente unverändert', () => {
    const L = withValue('spb', 3000), p = P({ insLump: false });
    const a = analyze(p, { law: LAW_2026 }).stats, b = analyze(p, { law: L }).stats;
    expect(b.etf!.cumHReal).toBeGreaterThan(a.etf!.cumHReal);
    expect(b.fond!.cumHReal).toBeGreaterThan(a.fond!.cumHReal);
    expect(b.ins).toEqual(a.ins);
  });
});

// ---------- Keine Jahres-Literale in der Engine ----------

describe('Engine-Dateien ohne Jahres-Literale (nur law.ts)', () => {
  const FILES = ['core', 'combo', 'engine', 'analyze', 'search', 'comboAnalyze', 'breakEven', 'fixes'].map(f => `src/lib/engine/${f}.ts`);
  // Zahlen, die in der Rechtsstand-Tabelle stehen (2026) – als Literal im Code wären sie vom Jahr abgekoppelt.
  // Ohne den Ertragsanteil (kleine Zahlen, eigene Prüfung unten) und ohne Werte, die nicht in die Rechnung gehen.
  const values = new Set<string>();
  const notEngine = new Set(OTHER_VALUES.map(x => x[0]));
  for (const [k, v] of leaves(tableOf(LAW_2026))) if (typeof v === 'number' && v !== 0.5 && !k.startsWith('ertrag.') && !notEngine.has(k)) values.add(String(v));
  // Zusätzlich abgeleitete Beträge, die früher im Code standen.
  for (const v of ['2000', '72', '540', '1920', '570', '150', '25']) values.add(v);
  // Erlaubte Vorkommen (Struktur, kein Jahreswert): Zeilenausschnitt → Grund.
  const ALLOW: [RegExp, string][] = [
    [/it < 1000; it\+\+/, 'Iterationsgrenze der Tauschsuche'],
    [/age < 25/, 'Altersgrenze des Berufseinsteigerbonus (§ 84 S. 2, Struktur)'],
  ];
  it('keine Tabellenwerte als Literal', () => {
    const hits: string[] = [];
    for (const f of FILES) {
      const code = src(f).replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ''));
      code.split('\n').forEach((line, i) => {
        const l = line.replace(/\/\/.*$/, '').replace(/'[^']*'/g, "''");
        for (const m of l.matchAll(/(?<![\w.])\d+(?:\.\d+)?(?![\w.])|(?<![\w\d])\.\d+(?![\w.])/g)) {
          const n = String(Number(m[0]));
          if (!values.has(n)) continue;
          if (ALLOW.some(([re]) => re.test(l))) continue;
          hits.push(`${f}:${i + 1}: ${m[0]} :: ${l.trim()}`);
        }
      });
    }
    expect(hits, hits.join('\n')).toEqual([]);
  });
  it('keine Ertragsanteil-Tabelle außerhalb von law.ts', () => {
    for (const f of FILES) expect(src(f), f).not.toMatch(/\b6[0-9]\s*:\s*\d+\s*,\s*6[0-9]\s*:/);
  });
  it('keine an ein Jahr gebundenen Steuerfunktionen außerhalb von law.ts (Tests nehmen LAW_2026.fn)', () => {
    for (const f of FILES) {
      expect(src(f), f).not.toMatch(/import \{[^}]*\bLAW_20\d\d\b/);
      expect(src(f), f).not.toMatch(/export (const|function) (est|soli|tax|tax20\d\d)\b/);
    }
  });
});

// ---------- Texte der Oberfläche ----------

describe('Oberflächentexte kommen aus der Tabelle (src/lib/lawText.ts)', () => {
  it('Formatierung für 2026 genau wie vorher im Text', () => {
    expect(lawText(LAW_2026)).toEqual({
      year: '2026', spb: '1.000 €', spb2: '2.000 €', saPausch: '36 €', saPausch2: '72 €', wkRente: '102 €', gfb: '12.348 €',
      kvBbg: '69.750 €', kvJaeg: '77.400 €', kvGeneral: '14,6 %', kvReduced: '14,0 %', zusatz: '2,9 %', pv: '3,6 %',
      pvChildless: '0,6 %', pvNoKids: '4,2 %', kvVolNoKids: '21,1 %', kvVolKids: '20,5 %', basiszins: '3,2 %',
      basiszinsSource: 'BMF, 13.01.2026', abg: '25 %', abgSoli: '26,375 %', abgKist9: '27,995 %', abgKist8: '27,819 %',
      avdSubMax: '1.800 €', avdMax: '6.840 €', avdSubMaxM: '150 €', avdMaxM: '570 €', avdSubMaxMNum: '150', avdMinOwn: '120 €',
      grundRate1: '50 %', grundTop1: '360 €', grundRate2: '25 %', grundMax: '540 €', kid: '300 €', bonus: '200 €',
      spouseMinOwn: '120 €', spouseGrundMax: '175 €', avdSubMaxSpouse: '1.920 €',
    });
  });
  it('LT ist die neueste Tabelle', () => {
    expect(LT).toEqual(lawText(CURRENT_LAW));
  });

  // Alle Quelldateien der Oberfläche (ohne law.ts und lawText.ts), Kommentare und <style> entfernt.
  const walk = (d: string): string[] => readdirSync(d).flatMap(f => {
    const p = join(d, f);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|svelte)$/.test(f) ? [p] : [];
  });
  const ROOT = fileURLToPath(new URL('../', import.meta.url));
  const UI = walk(join(ROOT, 'src')).filter(f => !/engine[\\/]law\.ts$|lawText\.ts$/.test(f));
  const code = (f: string) => readFileSync(f, 'utf8')
    .replace(/<style[\s\S]*?<\/style>/g, m => m.replace(/[^\n]/g, ''))
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ''))
    .replace(/<!--[\s\S]*?-->/g, m => m.replace(/[^\n]/g, ''))
    .split('\n').map(l => l.replace(/(^|[^:'"\\])\/\/.*$/, '$1'));
  const rel = (f: string) => f.slice(ROOT.length);

  it('kein Jahreswert als fertiger Text (z. B. „1.800 €“, „26,375 %“) außerhalb von lawText.ts', () => {
    // Zu allgemein für eine Suche (Teilfreistellung, Umschichtungsanteile …): die Prozentsätze 25 % und 50 %.
    const GENERIC = new Set(['abg', 'grundRate1', 'grundRate2', 'year', 'basiszinsSource', 'avdSubMaxMNum']);
    const ALLOW: RegExp[] = [/1\.000 € in 40 Jahren/]; // Inflationsbeispiel im Glossar, kein Rechtswert
    const hits: string[] = [];
    for (const L of LAWS) {
      const vals = Object.entries(lawText(L)).filter(([k]) => !GENERIC.has(k));
      for (const f of UI) code(f).forEach((l, i) => {
        if (ALLOW.some(re => re.test(l))) return;
        for (const [k, v] of vals) {
          const re = new RegExp('(?<![\\d.,])' + v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(' ', '\\s?'));
          if (re.test(l)) hits.push(`${rel(f)}:${i + 1} ${L.id}.${k} „${v}“ :: ${l.trim().slice(0, 120)}`);
        }
      });
    }
    expect(hits, hits.join('\n')).toEqual([]);
  });
  it('keine eindeutigen Jahresbeträge als Zahl in der Logik der Oberfläche (Schwellen, Grenzen, Formeln)', () => {
    // Beträge, die außerhalb des Rechtsstands nicht vorkommen (1.000/150 wären zu allgemein: Schrittweiten, Beispiele).
    const hits: string[] = [];
    for (const L of LAWS) {
      const nums = new Set([L.avd.subMax, L.avd.max, L.avd.max / 12, L.kvBbg, L.kvJaeg, L.tariff.gfb, L.abg.withSoli, L.abg.soliFactor, L.avd.subMax + L.avd.spouseRaise].map(String));
      for (const f of UI) code(f).forEach((l, i) => {
        const c = l.replace(/'[^']*'|"[^"]*"|`[^`]*`/g, "''");
        for (const m of c.matchAll(/(?<![\w.])\d+(?:\.\d+)?(?![\w.])|(?<![\w\d])\.\d+(?![\w.])/g)) {
          if (nums.has(String(Number(m[0])))) hits.push(`${rel(f)}:${i + 1} ${m[0]} :: ${l.trim().slice(0, 120)}`);
        }
        // Vergleiche mit dem Pauschbetrag oder dem AVD-Betrag gegen eine feste Zahl
        if (/(allowanceUsed|split\.avd|avdM)\s*[<>]=?\s*[1-9]/.test(c)) hits.push(`${rel(f)}:${i + 1} Vergleich mit Literal :: ${l.trim().slice(0, 120)}`);
      });
    }
    expect(hits, hits.join('\n')).toEqual([]);
  });
});
