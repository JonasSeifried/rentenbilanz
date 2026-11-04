// Korrekturen gegenüber dem Original (src/lib/engine/fixes.ts, docs/abweichungen-vom-original.md).
// 1. Wirkung je Fix: NO_FIXES ∪ {f} gegen NO_FIXES, mit den Zahlen aus der Wave-1-Prüfung (Skripte /tmp/engine-review,
//    engine_var.ts mit OPT-Schaltern). Fälle mit kvOn wie dort mit kvRate 21,7 (damaliger Standard).
// 2. Eigenschaften über 200 Zufallsszenarien (mulberry32 wie im Golden-Test).
// 3. Snapshots der Standardwerte mit ALL_FIXES.
// 4. Jede Teilmenge der Fixes läuft; Laufzeit.
import { describe, expect, it } from 'vitest';
import { readParams, tax, model, type Params, type ProductKey } from '../src/lib/engine/engine';
import { analyze, scenarios, scenarioList, PRODUCTS, type Analysis } from '../src/lib/engine/analyze';
import { ALL_FIXES, FIX_IDS, FIXES, NO_FIXES, type FixId } from '../src/lib/engine/fixes';
import { DEFAULTS, type Inputs } from '../src/lib/engine/inputs';

const P = (patch: Partial<Inputs> = {}) => readParams({ ...DEFAULTS, ...patch });
const only = (...f: FixId[]) => ({ fixes: new Set<FixId>(f) as ReadonlySet<FixId> });
const without = (...f: FixId[]) => ({ fixes: new Set(FIX_IDS.filter(x => !f.includes(x))) as ReadonlySet<FixId> });
const NONE = { fixes: NO_FIXES };
const ALL = { fixes: ALL_FIXES };

// Beispielfälle aus Wave 1
const DK: Partial<Inputs> = { kvOn: true, kvRate: 21.7 };
const HIGH: Partial<Inputs> = { a0: 30, incWork: 110000, incRet: 45000, setAll: 500, etfM: 500, avdM: 500, insM: 500, fondM: 500, kvOn: true, kvRate: 21.7 };

const cumH = (a: Analysis, k: ProductKey) => a.stats[k]!.cumH;
/** Wirkung eines Fixes allein auf cumH je Produkt (in der Anzeige-Einheit, hier real). */
function effect(p: Params, f: FixId) {
  const a = analyze(p, NONE), b = analyze(p, only(f));
  const d: Partial<Record<ProductKey, number>> = {};
  for (const pr of PRODUCTS) if (a.stats[pr.key]) d[pr.key] = cumH(b, pr.key) - cumH(a, pr.key);
  return { a, b, d };
}

/** Alles, was die Oberfläche aus einem Ergebnis liest, als vergleichbare Daten (ohne Funktionen). */
function fingerprint(a: Analysis) {
  const out: Record<string, unknown> = { lead: a.lead?.key ?? null, fairOwn: a.fairOwn, canRank: a.canRank, refundSpent: a.refundSpent };
  for (const pr of a.active) {
    const r = a.res[pr.key]!;
    const heirs = [], married = [];
    for (let i = 0; i <= a.T; i++) {
      heirs.push(r.heir(i));
      if (r.heirMarried) married.push(r.heirMarried(i));
    }
    const scalars: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(r)) if (typeof v !== 'function') scalars[k] = v;
    out[pr.key] = { stats: a.stats[pr.key], own: a.ownOf(pr), scalars, heirs, married };
  }
  return out;
}

// Deterministischer Zufall wie in tests/golden.test.ts
function randomInputs(count: number, seed = 20260526): Inputs[] {
  let s = seed;
  const rnd = () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const int = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));
  const r1 = (lo: number, hi: number) => Math.round((lo + rnd() * (hi - lo)) * 10) / 10;
  const b = () => rnd() < 0.5;
  const out: Inputs[] = [];
  for (let i = 0; i < count; i++) {
    const a0 = int(16, 60), m = int(0, 40) * 10;
    out.push({
      ...DEFAULTS,
      a0, incWork: int(0, 200) * 1000, incRet: int(0, 90) * 1000, setAll: m, g: r1(-3, 10), R: int(65, 70), kvOn: b(),
      etfOn: b(), avdOn: b(), insOn: b(), fondOn: b(),
      H: int(80, 100), gPay: r1(-2, 7), einmal: b(), insLump: b(), rf: int(15, 45), gz: int(0, 30),
      deathAge: int(a0 + 1, 100), heirHalf: b(), incHeir: int(0, 120) * 1000,
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
const RANDOM = randomInputs(200);
const forRandom = (fn: (p: Params, i: number) => void) => RANDOM.forEach((v, i) => {
  try { fn(readParams(v), i); } catch (e) { throw new Error(`Zufallsszenario #${i}: ${JSON.stringify(v)}\n${(e as Error).message}`); }
});

describe('Fix-Katalog', () => {
  it('sieben Fixes, Befund-IDs eindeutig, ALL/NO vollständig', () => {
    expect(FIX_IDS).toEqual(['rankReal', 'heirTax', 'bonusOutsideSA', 'kvInvestBase', 'kvSharedRoom', 'kvLumpSpread', 'avdUnsubsidized']);
    expect(new Set(FIX_IDS.map(f => FIXES[f].finding)).size).toBe(7);
    expect([...ALL_FIXES]).toEqual(FIX_IDS);
    expect(NO_FIXES.size).toBe(0);
  });
  it('ohne Optionen gilt ALL_FIXES', () => {
    const p = P(HIGH);
    expect(fingerprint(analyze(p))).toEqual(fingerprint(analyze(p, ALL)));
    expect(scenarios(p).map(s => s.a.stats)).toEqual(scenarios(p, ALL).map(s => s.a.stats));
  });
});

describe('Wirkung je Fix (gegen das Original, Zahlen aus Wave 1)', () => {
  it('bonusOutsideSA (E3): Default AVD 174.149 → 174.891; Erstattung im Bonusjahr 35 → 175 €', () => {
    const { a, b, d } = effect(P(), 'bonusOutsideSA');
    expect(cumH(a, 'avd')).toBeCloseTo(174149, -0.3); // ± 1 €
    expect(cumH(b, 'avd')).toBeCloseTo(174891, -0.3);
    expect(Math.round(d.avd!)).toBe(742);
    expect(d.etf).toBe(0); expect(d.ins).toBe(0);
    // Erstattung im ersten Jahr (t = 0, I = 1): 1.800 € Eigenbeitrag, Grundzulage 540 €, Bonus 200 €, zvE 38.000 €.
    const orig = tax(38000) - tax(38000 - (1800 + 540 + 200)) - (540 + 200);
    const fixed = tax(38000) - tax(38000 - (1800 + 540)) - 540;
    expect(Math.round(orig)).toBe(35);
    expect(Math.round(fixed)).toBe(175);
    // Nur das Bonusjahr ändert sich: Die Summe der Erstattungen wächst genau um diese Differenz.
    expect(b.res.avd!.ref! - a.res.avd!.ref!).toBeCloseTo(fixed - orig, 6);
    // Gutgeschrieben wird weiter die volle Zulage inkl. Bonus.
    expect(b.res.avd!.zul).toBe(a.res.avd!.zul);
  });

  it('kvInvestBase (E6): DK ETF −132, AVD −13, Vers. −2.239; High ETF −1.184, AVD −946, Vers. −5.675', () => {
    const dk = effect(P(DK), 'kvInvestBase').d, hi = effect(P(HIGH), 'kvInvestBase').d;
    expect([dk.etf, dk.avd, dk.ins].map(x => Math.round(x!))).toEqual([-132, -13, -2239]);
    expect([hi.etf, hi.avd, hi.ins].map(x => Math.round(x!))).toEqual([-1184, -946, -5675]);
  });

  it('kvLumpSpread (E8): DK Vers. +4.572, kapNet real 85.361 → 112.404; High Vers. +4.582', () => {
    const dk = effect(P(DK), 'kvLumpSpread'), hi = effect(P(HIGH), 'kvLumpSpread');
    expect(Math.round(dk.d.ins!)).toBe(4572);
    expect(Math.round(hi.d.ins!)).toBe(4582);
    expect(dk.d.etf).toBe(0); expect(dk.d.avd).toBe(0);
    const kap = (a: Analysis) => Math.round(a.res.ins!.kapNet! / a.I(a.n));
    expect(kap(dk.a)).toBe(85361);
    expect(kap(dk.b)).toBe(112404);
    // KV läuft 10 Jahre aus den Entnahmen: Rentenjahre n … n+9 sinken, alle späteren sind höher (mehr Kapital im ETF).
    const n = dk.a.n, nb = dk.b.res.ins!.net, na = dk.a.res.ins!.net;
    expect(nb[n + 10]).toBeGreaterThan(na[n + 10]);
  });

  it('kvSharedRoom (E7): High mit Rente 60.000 → AVD-KV ≈ 13.045 € real weniger; bei Default und High ohne Wirkung', () => {
    const hi60 = effect(P({ ...HIGH, incRet: 60000 }), 'kvSharedRoom');
    // Wave 1 (run.ts) hat das gemeinsame Buch separat gerechnet, nicht als OPT-Schalter: Toleranz 3 %.
    // cum100: die KV-Ersparnis über alle Jahre (das AVD zahlt nur bis H aus, deshalb = Wirkung auf cumH).
    const dAvd = hi60.b.stats.avd!.cum100 - hi60.a.stats.avd!.cum100;
    expect(Math.abs(dAvd - 13045) / 13045).toBeLessThan(0.03);
    expect(Math.round(dAvd)).toBe(13045); // gemessen 2026-11-03, stimmt sogar auf den Euro
    expect(hi60.d.etf).toBeCloseTo(0, 6); // ein Strom: nur Rundung durch die andere Reihenfolge
    for (const v of [effect(P(DK), 'kvSharedRoom').d, effect(P(HIGH), 'kvSharedRoom').d, effect(P({ kvOn: true }), 'kvSharedRoom').d]) {
      for (const x of Object.values(v)) expect(Math.abs(x!)).toBeLessThan(1);
    }
  });

  it('heirTax (E2): Default Tod mit 50 → 71.523 (Erbe ohne Einkommen) bzw. 62.220 (38.000 €); Tod mit 80 → 63.275', () => {
    const heirReal = (patch: Partial<Inputs>, opts: { fixes: ReadonlySet<FixId> }) => {
      const p = P(patch), a = analyze(p, opts), idx = p.deathAge - p.a0;
      const h = a.res.avd!.heir(idx);
      return { val: Math.round(h.val / a.I(idx)), note: h.note };
    };
    expect(heirReal({ deathAge: 50 }, NONE).val).toBe(62220);
    expect(heirReal({ deathAge: 50, incHeir: 0 }, only('heirTax')).val).toBe(71523);
    expect(heirReal({ deathAge: 50, incHeir: 38000 }, only('heirTax')).val).toBe(62220);
    // Tod mit 80: Original halbiert wegen des Alters der verstorbenen Person (82.563); richtig ist das Alter der Erben.
    expect(heirReal({ deathAge: 80, heirHalf: true }, NONE).val).toBe(82563);
    expect(heirReal({ deathAge: 80, heirHalf: false, incHeir: 38000 }, only('heirTax')).val).toBe(63275);
    // heirHalf = „Erbe ist mindestens 62“: hälftig auch bei Tod vor 62, sofern der Vertrag ≥ 12 Jahre lief.
    const young = heirReal({ deathAge: 50, heirHalf: true }, only('heirTax'));
    expect(young.note).toMatch(/^Förderung .* zurück, Steuer der Erben auf Erträge .* \(hälftig\)$/);
    expect(heirReal({ deathAge: 50, heirHalf: true }, NONE).note).not.toContain('hälftig');
    expect(heirReal({ deathAge: 30, heirHalf: true }, only('heirTax')).note).not.toContain('hälftig'); // erst 8 Jahre Laufzeit
    expect(heirReal({ deathAge: 50 }, NONE).note).toMatch(/, Steuer auf Erträge /);
  });

  it('heirTax (E2): Restrenten der Versicherung versteuern die Erben', () => {
    const p = P({ insLump: false, gz: 20, deathAge: 70, incRet: 20000 }), idx = p.deathAge - p.a0;
    const rich = analyze({ ...p, incHeir: 150000 }, only('heirTax')).res.ins!.heir(idx);
    const poor = analyze({ ...p, incHeir: 0 }, only('heirTax')).res.ins!.heir(idx);
    const orig = analyze(p, NONE).res.ins!.heir(idx);
    expect(poor.val).toBeGreaterThan(orig.val);
    expect(rich.val).toBeLessThan(orig.val);
    expect(rich.note).toBe('Restliche Garantiezeit: 17 Jahre, nach Steuer der Erben');
    expect(orig.note).toBe('Restliche Garantiezeit: 17 Jahre, nach Steuer');
    // Mit incHeir = incRet ist es exakt die bisherige Rechnung.
    expect(analyze({ ...p, incHeir: p.incRet }, only('heirTax')).res.ins!.heir(idx).val).toBe(orig.val);
  });

  it('heirTax (E2): Ehepartner-Übertragung bleibt unverändert', () => {
    const p = P({ deathAge: 75, incHeir: 0 }), idx = p.deathAge - p.a0;
    expect(analyze(p, only('heirTax')).res.avd!.heirMarried!(idx)).toEqual(analyze(p, NONE).res.avd!.heirMarried!(idx));
  });

  it('rankReal (E1): a0 22, zvE 25.000, Rente 35.000, 6 %, nominal → ETF vorne (Original: AVD)', () => {
    const p = P({ a0: 22, incWork: 25000, incRet: 35000, g: 6, real: false });
    const a = analyze(p, NONE), b = analyze(p, only('rankReal'));
    expect(a.lead?.key).toBe('avd');
    expect(b.lead?.key).toBe('etf');
    expect(analyze({ ...p, real: true }, NONE).lead?.key).toBe('etf');
    // Zahlen aus Wave 1: real ETF 153.730 gegen AVD 153.275, nominal ETF 460.552 gegen AVD 473.827.
    expect(Math.round(b.stats.etf!.cumHReal)).toBe(153730);
    expect(Math.round(b.stats.avd!.cumHReal)).toBe(153275);
    expect(Math.round(b.stats.etf!.cumH)).toBe(460552);
    expect(Math.round(b.stats.avd!.cumH)).toBe(473827);
    // Die Anzeige (cumH, avgMonthly) bleibt unverändert.
    expect(b.stats).toEqual(a.stats);
  });
});

describe('Eigenschaften über 200 Zufallsszenarien', () => {
  const KV: FixId[] = ['kvInvestBase', 'kvSharedRoom', 'kvLumpSpread'];

  it('kvOn = false ⇒ die KV-Fixes ändern nichts', () => {
    let hits = 0;
    forRandom(p => {
      if (p.kvOn) return; hits++;
      const base = fingerprint(analyze(p, NONE));
      for (const f of KV) expect(fingerprint(analyze(p, only(f))), f).toEqual(base);
      expect(fingerprint(analyze(p, only(...KV)))).toEqual(base);
      expect(fingerprint(analyze(p, ALL))).toEqual(fingerprint(analyze(p, without(...KV))));
    });
    expect(hits).toBeGreaterThan(50);
  }, 60_000);

  it('bonus = false oder a0 ≥ 25 ⇒ bonusOutsideSA ändert nichts', () => {
    let hits = 0;
    forRandom(p => {
      if (p.bonus && p.a0 < 25) return; hits++;
      expect(fingerprint(analyze(p, only('bonusOutsideSA')))).toEqual(fingerprint(analyze(p, NONE)));
      expect(fingerprint(analyze(p, ALL))).toEqual(fingerprint(analyze(p, without('bonusOutsideSA'))));
    });
    expect(hits).toBeGreaterThan(100);
  }, 60_000);

  it('bonusOutsideSA erhöht die Erstattung, nie die Zulage', () => {
    forRandom(p => {
      const a = model(p, NONE).res.avd, b = model(p, only('bonusOutsideSA')).res.avd;
      if (!a || !b) return;
      expect(b.ref!).toBeGreaterThanOrEqual(a.ref! - 1e-9);
      expect(b.zul).toBe(a.zul);
    });
  }, 60_000);

  it('mit ALL_FIXES: Rangfolge und Fairness unabhängig von der Anzeige real/nominal (auch je Szenario)', () => {
    let leads = 0;
    forRandom(p => {
      const r = analyze({ ...p, real: true }), nm = analyze({ ...p, real: false });
      expect(nm.lead?.key ?? null).toBe(r.lead?.key ?? null);
      expect(nm.fairOwn).toBe(r.fairOwn);
      expect(nm.canRank).toBe(r.canRank);
      if (r.lead) leads++;
      const sr = scenarios({ ...p, real: true }), sn = scenarios({ ...p, real: false });
      sr.forEach((s, i) => expect(sn[i].a.lead?.key ?? null, s.id).toBe(s.a.lead?.key ?? null));
    });
    expect(leads).toBeGreaterThan(30);
  }, 60_000);

  it('cumHReal = cumH in heutiger Kaufkraft (bei real identisch, bei nominal gleich der realen Rechnung)', () => {
    forRandom(p => {
      const r = analyze({ ...p, real: true }), nm = analyze({ ...p, real: false });
      for (const pr of r.active) {
        expect(r.stats[pr.key]!.cumHReal).toBe(r.stats[pr.key]!.cumH);
        expect(nm.stats[pr.key]!.cumHReal).toBe(r.stats[pr.key]!.cumH);
      }
    });
  }, 60_000);

  it('kvSharedRoom erhöht die KV nie (Netto je Jahr nie kleiner)', () => {
    let lower = 0;
    forRandom(p => {
      for (const [base, plus] of [[only(), only('kvSharedRoom')], [without('kvSharedRoom'), ALL]] as const) {
        const a = model(p, base), b = model(p, plus);
        for (const k of Object.keys(a.res) as ProductKey[]) {
          const na = a.res[k]!.net, nb = b.res[k]!.net;
          na.forEach((x, t) => {
            expect(nb[t], `${k} net[${t}]`).toBeGreaterThanOrEqual(x - 1e-6 * Math.max(1, Math.abs(x)));
            if (nb[t] > x + 1) lower++;
          });
        }
      }
    });
    expect(lower).toBeGreaterThan(0); // die Zufallsfälle enthalten Fälle nahe der BBG
  }, 60_000);

  it('kvLumpSpread wirkt nur bei Kapitalauszahlung der Versicherung mit kvOn', () => {
    let hits = 0, changed = 0;
    // kapNet ist auch bei Leibrente ein Anzeigewert („Alternativ Kapitalauszahlung … netto“) und ist mit dem Fix
    // immer der Betrag nach Steuer (die KV folgt über 10 Jahre). Er wird deshalb getrennt geprüft.
    const noKap = (x: ReturnType<typeof fingerprint>) => { const ins = x.ins as { scalars: Record<string, unknown> } | undefined; if (ins) delete ins.scalars.kapNet; return x; };
    forRandom(p => {
      const same = !(p.on.ins && p.insLump && p.kvOn);
      const a = fingerprint(analyze(p, NONE)), b = fingerprint(analyze(p, only('kvLumpSpread')));
      const ins = model(p, only('kvLumpSpread')).res.ins;
      if (ins) expect(ins.kapNet).toBe(ins.capNet);
      if (same) { hits++; expect(noKap(b)).toEqual(noKap(a)); }
      else if (JSON.stringify(a) !== JSON.stringify(b)) changed++;
      // Andere Produkte bleiben immer unberührt
      const x = model(p, NONE).res, y = model(p, only('kvLumpSpread')).res;
      for (const k of ['etf', 'avd', 'fond'] as const) if (x[k]) expect(y[k]!.net).toEqual(x[k]!.net);
    });
    expect(hits).toBeGreaterThan(100);
    expect(changed).toBeGreaterThan(5);
  }, 60_000);

  it('heirTax ändert nur Erbwerte, nie die Rentenphase', () => {
    forRandom(p => {
      const a = analyze(p, NONE), b = analyze(p, only('heirTax'));
      expect(b.stats).toEqual(a.stats);
      for (const pr of a.active) expect(b.res[pr.key]!.net).toEqual(a.res[pr.key]!.net);
    });
  }, 60_000);

  it('jeder Fix allein und alle zusammen: endlich, keine negativen Guthaben', () => {
    const sets = [NONE, ALL, ...FIX_IDS.map(f => only(f))];
    forRandom(p => {
      for (const o of sets) {
        const a = analyze(p, o);
        for (const pr of a.active) {
          const r = a.res[pr.key]!, s = a.stats[pr.key]!;
          for (const v of Object.values(s)) expect(Number.isFinite(v)).toBe(true);
          r.net.forEach(v => expect(Number.isFinite(v)).toBe(true));
          r.vals.forEach(v => { if (v !== null) expect(v).toBeGreaterThan(-1e-6); });
          const idx = p.deathAge - p.a0;
          expect(Number.isFinite(r.heir(idx).val)).toBe(true);
        }
      }
    });
  }, 120_000);
});

describe('jede Teilmenge der Fixes', () => {
  it('alle 128 Teilmengen laufen auf Default, DK und High (inkl. Szenarien)', () => {
    const cases = [P(), P(DK), P(HIGH), P({ ...HIGH, incRet: 60000, einmal: true, real: false, deathAge: 75, heirHalf: true })];
    for (let mask = 0; mask < 1 << FIX_IDS.length; mask++) {
      const fixes = new Set(FIX_IDS.filter((_, i) => mask & (1 << i)));
      for (const p of cases) {
        const a = analyze(p, { fixes });
        for (const pr of a.active) expect(Number.isFinite(a.stats[pr.key]!.cumH)).toBe(true);
        expect(scenarios(p, { fixes }).length).toBe(scenarioList(p).length);
      }
    }
  });
});

describe('Szenarien', () => {
  it('stabile IDs, Reihenfolge wie im Original, Label ohne Klammerzusatz', () => {
    expect(scenarioList(P()).map(s => s.id)).toEqual(['kv', 'avdCost', 'refund', 'g', 'incWork', 'incRetLow', 'incRetHigh', 'insMode', 'insCost']);
    expect(scenarioList(P({ avdCost: 1, insEff: 2, incRet: 10000, reinvest: false })).map(s => s.id)).toEqual(['kv', 'g', 'incWork', 'incRetHigh', 'insMode']);
    expect(scenarioList(P({ avdOn: false, insOn: false })).map(s => s.id)).toEqual(['kv', 'g', 'incWork', 'incRetLow', 'incRetHigh']);
    expect(scenarioList(P()).find(s => s.id === 'refund')!.label).toBe('Steuererstattung ausgegeben statt angelegt');
  });
  it('Szenarien rechnen mit denselben Fixes wie die Basis', () => {
    const p = P(HIGH);
    scenarios(p, NONE).forEach(s => expect(s.a.stats).toEqual(analyze(s.p, NONE).stats));
    scenarios(p).forEach(s => expect(s.a.stats).toEqual(analyze(s.p, ALL).stats));
  });
});

describe('Snapshots mit ALL_FIXES (aktuelle Standardwerte)', () => {
  const snap = (patch: Partial<Inputs>) => {
    const a = analyze(P(patch));
    return { lead: a.lead?.key, ...Object.fromEntries(a.active.map(pr => [pr.key, Math.round(a.stats[pr.key]!.cumH)])) };
  };
  it('Default: ETF 153.730, AVD 174.891, Vers. 127.324 (nur E3 wirkt)', () => {
    // kvOn aus (E6–E8 ohne Wirkung), real an (E1 ohne Wirkung), Tod mit 50 vor Rentenbeginn mit gleichem Einkommen (E2 ohne Wirkung).
    expect(snap({})).toEqual({ lead: 'avd', etf: 153730, avd: 174891, ins: 127324 });
  });
  it('DK (Default + kvOn, kvRate 21,1)', () => {
    // Herkunft: diese Implementierung, 2026-11-03. Original mit kvRate 21,1: ETF 137.705, AVD 127.377, Vers. 95.558.
    // Unterschied = E3 (AVD) + E6 (alle) + E8 (Versicherung); E7 ohne Wirkung (Rente weit unter der BBG), E1/E2 ohne Wirkung.
    expect(snap({ kvOn: true })).toEqual({ lead: 'etf', etf: 137576, avd: 128027, ins: 97162 });
  });
  it('High (a0 30, zvE 110.000, Rente 45.000, 500 €/Monat, kvOn, kvRate 21,1)', () => {
    // Herkunft: diese Implementierung, 2026-11-03. Original mit kvRate 21,1: ETF 324.245, AVD 326.776, Vers. 239.587.
    // a0 30 ⇒ kein Bonus (E3 ohne Wirkung); E6 und E8 wirken, E7 ohne Wirkung (Rente weit unter der BBG).
    // E10 (2026-11-04): 350 € ungefördert im AVD-Vertrag statt im Nebendepot. Mit kvOn zählt die ganze Auszahlung
    // für die KV (nicht nur der Gewinn wie beim ETF), daher AVD 325.856 → 281.639 und der ETF vorne.
    expect(snap({ ...HIGH, kvRate: 21.1 })).toEqual({ lead: 'etf', etf: 323094, avd: 281639, ins: 245025 });
  });
});

describe('Laufzeit', () => {
  it('analyze + scenarios mit ALL_FIXES höchstens 1,5 × so lang wie ohne Fixes', () => {
    // Messung (MacBook, Node 26, 2026-11-03): siehe Konsole; ohne Fixes entspricht der Pfad dem Original.
    const cases = [P(), P(DK), P(HIGH), P({ insLump: false, fondOn: true, kvOn: true })];
    const run = (o: { fixes: ReadonlySet<FixId> }) => { for (const p of cases) { analyze(p, o); scenarios(p, o); } };
    const time = (o: { fixes: ReadonlySet<FixId> }) => { const t0 = performance.now(); for (let i = 0; i < 20; i++) run(o); return performance.now() - t0; };
    for (let i = 0; i < 3; i++) { time(NONE); time(ALL); } // Aufwärmen
    let tn = Infinity, ta = Infinity;
    for (let i = 0; i < 7; i++) { tn = Math.min(tn, time(NONE)); ta = Math.min(ta, time(ALL)); }
    console.log(`Laufzeit analyze+scenarios: ohne Fixes ${(tn / 80).toFixed(2)} ms, mit allen ${(ta / 80).toFixed(2)} ms je Fall (× ${(ta / tn).toFixed(2)})`);
    expect(ta / tn).toBeLessThan(1.5);
  }, 60_000);
});
