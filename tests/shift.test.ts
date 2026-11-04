// Umschichtung vor Rentenbeginn für alle Produkte (shift, Anteile wie das Standarddepot, § 1 Abs. 1c Nr. 5 AltZertG):
// ab 5 Jahre vor Rentenbeginn 50 %, ab 2 Jahren 30 % im chancenreichen Fonds. Standard aus; dann bitgleich.
// AVD und Versicherung schichten steuerfrei im Vertrag um, Fondsdepots verkaufen (Abgeltungsteuer, Teilfreistellung,
// ein Sparer-Pauschbetrag) in ein sicheres Teil-Depot ohne Teilfreistellung.
import { describe, expect, it } from 'vitest';
import { contractGrowth, readParams, riskyShare, type Params, type ProductKey } from '../src/lib/engine/engine';
import { analyze, scenarioList, single } from '../src/lib/engine/analyze';
import { combo, emptySplit, type Split } from '../src/lib/engine/combo';
import { NO_FIXES } from '../src/lib/engine/fixes';
import { DEFAULTS, type Inputs } from '../src/lib/engine/inputs';
import { decodeState, encodeState } from '../src/lib/link';
import { sanitize } from '../src/lib/storage';

const at = (x: Partial<Inputs> = {}): Params => readParams({ ...DEFAULTS, ...x });
const ALL_ON = { etf: true, avd: true, ins: true, fond: true };
const S = (x: Partial<Split>): Split => ({ ...emptySplit(), ...x });
const KEYS: ProductKey[] = ['etf', 'avd', 'ins', 'fond'];

describe('Umschichtung vor Rentenbeginn (shift)', () => {
  it('aus: safeRate ändert nichts, alle Produkte bitgleich', () => {
    for (const x of [{}, { avdM: 450 }, { kvOn: true }, { a0: 64 }, { fondOn: true, insLump: false }] as Partial<Inputs>[]) {
      const a = analyze(at({ ...x, fondOn: true })), b = analyze(at({ ...x, fondOn: true, safeRate: -3 }));
      for (const k of KEYS) {
        expect(b.res[k]!.vals).toEqual(a.res[k]!.vals); expect(b.res[k]!.net).toEqual(a.res[k]!.net);
        expect(b.res[k]!.capNet).toBe(a.res[k]!.capNet); expect(b.stats[k]).toEqual(a.stats[k]);
      }
    }
  });

  it('Anteile und Vertragsrendite je Jahr: 100 % bis 6 Jahre vorher, 50 % ab 5, 30 % ab 2 Jahren vorher, Auszahlphase gPay', () => {
    const p = at({ shift: true, safeRate: 2 }), n = p.R - p.a0;
    expect(riskyShare(p, n - 6, n)).toBe(1);
    for (const t of [n - 5, n - 4, n - 3]) expect(riskyShare(p, t, n)).toBe(0.5);
    for (const t of [n - 2, n - 1]) expect(riskyShare(p, t, n)).toBe(0.3);
    expect(contractGrowth(p, n - 6, n)).toBe(p.g);
    expect(contractGrowth(p, n - 4, n)).toBeCloseTo(0.5 * 0.06 + 0.5 * 0.02, 12);
    expect(contractGrowth(p, n - 1, n)).toBeCloseTo(0.3 * 0.06 + 0.7 * 0.02, 12);
    expect(contractGrowth(p, n, n)).toBe(p.gPay);
    expect(contractGrowth(at(), n - 1, n)).toBe(p.g); // aus
    expect(riskyShare(at(), n - 1, n)).toBe(1);
  });

  it('AVD und Versicherung: weniger Kapital, aber keine Steuer beim Umschichten', () => {
    const off = at({ avdM: 450, setAll: 450, reinvest: false }), on = { ...off, shift: true }; // ohne Nebendepot (das schichtet wie ein ETF)
    const ratio = single(on, 'avd').capAVD! / single(off, 'avd').capAVD!;
    expect(ratio).toBeGreaterThan(0.86); expect(ratio).toBeLessThan(0.92); // rund 12 % weniger Wachstum in 5 Jahren
    const insOff = single(at({ insLump: false }), 'ins'), insOn = single(at({ insLump: false, shift: true }), 'ins');
    expect(insOn.capR / insOff.capR).toBeCloseTo(ratio, 1);
    for (const r of [single(on, 'avd'), insOn]) for (let t = 0; t < on.R - on.a0; t++) expect(r.abgTax[t]).toBe(0);
  });

  it('ETF: Nullrendite ohne Basiszins = keine Steuer, gleiches Ergebnis wie ohne Umschichtung', () => {
    const x = { g: 0, gPay: 0, safeRate: 0, basis: 0, etfTer: 0, infl: 0 };
    const a = single(at(x), 'etf'), b = single(at({ ...x, shift: true }), 'etf');
    expect(b.capR).toBeCloseTo(a.capR, 6);
    for (let t = 0; t < a.net.length; t++) expect(b.net[t]).toBeCloseTo(a.net[t], 6);
  });

  it('ETF: Verkauf im ersten Umschichtungsjahr mit Teilfreistellung und Sparer-Pauschbetrag versteuert', () => {
    // Ohne Basiszins ist die Anschaffungskostenbasis die Summe der Beiträge; vor dem Zeitfenster ist das Aktien-Depot
    // identisch mit dem Depot ohne Umschichtung. Zu Beginn von Jahr n−5 wird die Hälfte verkauft.
    const x = { basis: 0, setAll: 300, etfM: 300 }, p0 = at(x), p1 = at({ ...x, shift: true }), n = p0.R - p0.a0;
    const off = single(p0, 'etf'), on = single(p1, 'etf');
    const V = off.vals[n - 5] as number, B = 300 * 12 * (n - 5);
    expect(on.vals[n - 5]).toBe(V);
    const expected = Math.max(0, 0.5 * (V - B) * 0.7 - 1000) * 0.26375;
    expect(expected).toBeGreaterThan(1000);
    expect(on.abgTax[n - 5]).toBeCloseTo(expected, 6);
    for (let t = 0; t < n - 5; t++) expect(on.abgTax[t]).toBe(0);
    expect(on.abgTax[n - 2]).toBeGreaterThan(0); // zweite Stufe auf 30 %
    expect(on.capR).toBeLessThan(off.capR);
  });

  it('ETF mit sicherer Rendite = Aktienrendite: nur die vorgezogene Steuer kostet (Kapital kleiner, nach Steuer fast gleich)', () => {
    const x = { safeRate: 6, basis: 0 }, off = single(at(x), 'etf'), on = single(at({ ...x, shift: true }), 'etf');
    expect(on.capR).toBeLessThan(off.capR); // ein Teil der Steuer ist schon bezahlt
    expect(on.capR / off.capR).toBeGreaterThan(0.85);
    expect(on.capNet / off.capNet).toBeGreaterThan(0.97); // nach Steuer: Zinsverlust auf die vorgezogene Steuer
    expect(on.capNet).toBeLessThan(off.capNet);
  });

  it('KV (E6) und Steuer: im sicheren Teil zählen Gewinn und Vorabpauschale voll, im Aktienteil zu 70 %', () => {
    // Ohne Rendite vor der Rente gibt es beim Umschichten keinen Gewinn; danach wachsen beide Teile mit gPay. Mit 70 % im
    // Anleihe-ETF ist die Basis je Euro Ertrag 0,3 · 0,7 + 0,7 · 1 = 0,91 statt 0,7, also rund 1,3-mal so hoch.
    const x = { g: 0, safeRate: 0, etfTer: 0, kvOn: true }, n = at().R - at().a0;
    const off = single(at(x), 'etf'), on = single(at({ ...x, shift: true }), 'etf');
    expect(on.capR).toBeCloseTo(off.capR, 6);
    for (let t = 0; t < n; t++) { expect(on.kv[t]).toBe(0); expect(on.abgTax[t]).toBeCloseTo(0, 9); } // vor der Rente: nichts
    for (const t of [n, n + 1]) {
      expect(on.kv[t] / off.kv[t]).toBeCloseTo(0.91 / 0.7, 2);
      expect(on.abgTax[t]).toBeGreaterThan(off.abgTax[t]);
    }
  });

  it('Kombi: ein Sparer-Pauschbetrag für die Umschichtung aller Depots im selben Jahr', () => {
    const p = { ...at({ shift: true, basis: 0 }), on: ALL_ON }, n = p.R - p.a0;
    const both = combo(p, S({ etf: 150, fond: 150 })), e = combo(p, S({ etf: 150 })), f = combo(p, S({ fond: 150 }));
    expect(both.abgTax[n - 5]).toBeGreaterThan(e.abgTax[n - 5] + f.abgTax[n - 5] + 100);
  });

  it('AVD-Nebendepot und ETF aus der Kapitalauszahlung schichten wie ein ETF', () => {
    const p = at({ shift: true, avdM: 800, setAll: 800 }), n = p.R - p.a0;
    expect(single(p, 'avd').abgTax[n - 5]).toBeGreaterThan(single(at({ avdM: 800, setAll: 800 }), 'avd').abgTax[n - 5]);
    // Folge-ETF: zu 70 % im sicheren Teil gekauft, Vorabpauschale dort ohne Teilfreistellung → mehr Abgeltungsteuer
    const lumpOn = single(at({ shift: true, safeRate: 4 }), 'ins'), lumpOff = single(at({ safeRate: 4 }), 'ins');
    let aOn = 0, aOff = 0; for (let t = n; t < lumpOn.abgTax.length; t++) { aOn += lumpOn.abgTax[t]; aOff += lumpOff.abgTax[t]; }
    expect(aOn).toBeGreaterThan(0);
    expect(Number.isFinite(aOff)).toBe(true);
  });

  it('Erbfall und Kapital nach Steuern zählen den sicheren Teil mit (ohne Teilfreistellung)', () => {
    const p = at({ shift: true, deathAge: 66 }), idx = p.deathAge - p.a0, r = single(p, 'etf');
    expect(r.heir(idx).val).toBeLessThanOrEqual(r.vals[idx] as number);
    expect(r.heir(idx).val).toBeGreaterThan(0.9 * (r.vals[idx] as number));
    expect(r.capNet).toBeLessThan(r.capR);
  });

  it('Szenario „Alle schichten vor der Rente um“: nur außerhalb des Originalpfads, schaltet um', () => {
    const p = at();
    const row = scenarioList(p).find(s => s.id === 'shift')!;
    expect(row.label).toBe('Alle schichten vor der Rente um (wie das Standarddepot)');
    expect(row.p.shift).toBe(true);
    expect(scenarioList(p, null, { fixes: NO_FIXES }).map(s => s.id)).not.toContain('shift');
    expect(scenarioList(at({ shift: true })).find(s => s.id === 'shift')!.label).toBe('Niemand schichtet vor der Rente um');
    expect(scenarioList(p).at(-1)!.id).toBe('shift'); // am Ende, die Reihenfolge des Originals bleibt
  });
});

describe('Alte Schlüssel avdStd/avdSafe', () => {
  it('Link: werden auf shift/safeRate übertragen; der neue Schlüssel gewinnt', () => {
    const a = decodeState('#v=1&avdStd=1&avdSafe=3').inputs!;
    expect(a.shift).toBe(true); expect(a.safeRate).toBe(3);
    expect('avdStd' in a).toBe(false);
    const b = decodeState('#v=1&avdStd=1&shift=0&avdSafe=3&safeRate=1').inputs!;
    expect(b.shift).toBe(false); expect(b.safeRate).toBe(1);
    expect(encodeState({ ...DEFAULTS, shift: true, safeRate: 1.5 }, 'overview')).toMatch(/shift=1&safeRate=1\.5/);
    expect(encodeState({ ...DEFAULTS, shift: true }, 'overview')).not.toContain('avd');
  });
  it('Speicher: wird übernommen, wenn der neue Schlüssel fehlt', () => {
    expect(sanitize({ avdStd: true, avdSafe: 2.5 })).toMatchObject({ shift: true, safeRate: 2.5 });
    expect(sanitize({ avdStd: true, shift: false })!.shift).toBe(false);
  });
});
