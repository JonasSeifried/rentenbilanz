// Die Kombi als weiterer Teilnehmer im Vergleich (analyze mit `kombi`), Eingaben und Ergebnissatz.
import { describe, expect, it } from 'vitest';
import { analyze, scenarioList, scenarios, KOMBI } from '../src/lib/engine/analyze';
import { readParams } from '../src/lib/engine/engine';
import { combo, comboStats, emptySplit, readKombi, scaleSplit, splitSum, type Split } from '../src/lib/engine/combo';
import { DEFAULTS, type Inputs } from '../src/lib/engine/inputs';
import { verdict } from '../src/lib/verdict';

const S = (s: Partial<Split>): Split => ({ ...emptySplit(), ...s });
const inp = (patch: Partial<Inputs> = {}): Inputs => ({ ...DEFAULTS, ...patch });
const at = (b: number): Partial<Inputs> => ({ setAll: b, etfM: b, avdM: b, insM: b, fondM: b });

describe('analyze mit Kombi', () => {
  it('ohne Kombi: kein Teilnehmer „kombi“, Ergebnis wie bisher', () => {
    const p = readParams(inp());
    const a = analyze(p), b = analyze(p, undefined, null);
    expect(a.active.map(x => x.key)).toEqual(['etf', 'avd', 'ins']);
    expect(a.res.kombi).toBeUndefined();
    expect(b.stats).toEqual(a.stats);
    expect(b.lead?.key).toBe(a.lead?.key);
  });

  it('Kombi aus einem Produkt rechnet bitgleich wie das Einzelprodukt (Spiegel I1)', () => {
    const p = readParams(inp());
    for (const k of ['etf', 'avd', 'ins'] as const) {
      const a = analyze(p, undefined, S({ [k]: 150 }));
      expect(Object.is(a.stats.kombi!.cumHReal, a.stats[k]!.cumHReal)).toBe(true);
      expect(Object.is(a.stats.kombi!.avgMonthly, a.stats[k]!.avgMonthly)).toBe(true);
      expect(Object.is(a.res.kombi!.capNet, a.res[k]!.capNet)).toBe(true);
      expect(Object.is(a.res.kombi!.own, a.res[k]!.own)).toBe(true);
    }
  });

  it('Kombi steht zuletzt, gleich viel eigenes Geld ⇒ fairer Vergleich; Kennzahlen = comboStats', () => {
    const p = readParams(inp(at(450)));
    const split = S({ etf: 300, avd: 150 });
    const a = analyze(p, undefined, split);
    expect(a.active.map(x => x.key)).toEqual(['etf', 'avd', 'ins', 'kombi']);
    expect(a.active.at(-1)).toBe(KOMBI);
    expect(a.fairOwn).toBe(true);
    expect(a.canRank).toBe(true);
    expect(a.stats.kombi).toEqual(comboStats(p, combo(p, split, { cost: true })));
    // Vermögensverlauf = Summe der Teile
    const c = a.res.kombi!.combo, t = p.R - p.a0 - 1;
    expect(a.res.kombi!.vals[t]).toBeCloseTo((c.parts.etf!.vals[t] as number) + (c.parts.avd!.vals[t] as number), 6);
  });

  it('Kombi kann vorne liegen; der Ergebnissatz nennt sie', () => {
    // nur ETF einzeln, Kombi 300 ETF + 150 AVD: Das geförderte AVD zieht die Kombi nach vorne.
    const i = inp({ ...at(450), avdOn: false, insOn: false });
    const p = readParams(i), k = S({ etf: 300, avd: 150 });
    const a = analyze(p, undefined, k);
    expect(a.lead?.key).toBe('kombi');
    const v = verdict(a, scenarios(p, undefined, k));
    expect(v.kind).toBe('ok');
    expect(v.headline).toMatch(/Deine Kombi mit Ø [\d.]+ € netto im Monat \(67–90\)\.$/);
    expect(v.lines[0]).toContain('mehr netto als beim ETF-Depot');
    expect(v.lines[1]).toBe('Die Kombi (300 € ETF + 150 € AVD) wird gemeinsam versteuert: ein Steuertarif, ein Sparer-Pauschbetrag für alle Depots.');
  });

  it('AVD 450 € ist nicht dasselbe wie die Kombi 150 € AVD + 300 € ETF (E10: ungeförderter Teil im Vertrag)', () => {
    const p = readParams(inp(at(450))), k = S({ etf: 300, avd: 150 });
    const a = analyze(p, undefined, k);
    expect(Math.abs(a.stats.avd!.cumHReal - a.stats.kombi!.cumHReal)).toBeGreaterThan(1000);
    expect(verdict(a, scenarios(p, undefined, k)).headline).not.toMatch(/^Gleichauf/);
  });

  it('Gleichstand (≤ 1 €): „Gleichauf“ statt „Knapp vorne … rund 0 €“, kein Kippen durch Cent-Abstände', () => {
    // Über dem Höchstbetrag (570 €/Monat) liegt das AVD im ETF-Nebendepot: AVD 700 € ≈ Kombi 570 € AVD + 130 € ETF.
    const p = readParams(inp({ ...at(700), insOn: false })), k = S({ etf: 130, avd: 570 });
    const a = analyze(p, undefined, k);
    expect(Math.abs(a.stats.avd!.cumHReal - a.stats.kombi!.cumHReal)).toBeLessThanOrEqual(1);
    const sc = scenarios(p, undefined, k);
    const v = verdict(a, sc);
    // „Gleichauf“, außer die Szenarien sind uneinig: dann hat „Kein klarer Favorit“ Vorrang
    if (v.robust!.level < 2) expect(v.headline).toMatch(/^Gleichauf: (Das Altersvorsorgedepot und deine Kombi|Deine Kombi und das Altersvorsorgedepot), je Ø [\d.]+ € netto im Monat \(67–90\)\.$/);
    else expect(v.headline).toMatch(/^Kein klarer Favorit/);
    expect(v.lines[0]).toBe('Bis zum Alter von 90 liegen beide weniger als 1 € auseinander.');
    expect(v.lines[1]).toContain('über 570 € im Monat');
    // Gezählt werden nur echte Wechsel, nicht AVD ↔ Kombi
    expect(v.robust!.flips).toBe(sc.filter(s => s.a.canRank && s.a.lead && !['avd', 'kombi'].includes(s.a.lead.key)).length);
  });

  it('ausgegebene Steuererstattung in der Kombi ⇒ kein fairer Vergleich, auch ohne AVD als Einzelprodukt', () => {
    const p = readParams(inp({ avdOn: false, reinvest: false }));
    const a = analyze(p, undefined, S({ etf: 100, avd: 50 }));
    expect(a.res.avd).toBeUndefined();
    expect(a.refundSpent).toBe(true);
    expect(a.canRank).toBe(false);
    expect(verdict(a, []).kind).toBe('refundSpent');
  });

  it('Szenarien: AVD- und Versicherungszeilen auch dann, wenn nur die Kombi sie enthält', () => {
    const p = readParams(inp({ avdOn: false, insOn: false }));
    expect(scenarioList(p).map(s => s.id)).not.toContain('refund');
    const ids = scenarioList(p, S({ etf: 50, avd: 50, ins: 50 })).map(s => s.id);
    expect(ids).toEqual(expect.arrayContaining(['avdCost', 'refund', 'insMode', 'insCost']));
    const sc = scenarios(p, undefined, S({ etf: 100, avd: 50 }));
    expect(sc.every(s => !!s.a.stats.kombi)).toBe(true);
  });
});

describe('Kombi-Eingaben', () => {
  it('readKombi: aus, leer oder nur ein Produkt ⇒ keine Kombi', () => {
    expect(readKombi(inp({ cEtf: 100, cAvd: 50 }))).toBeNull();
    expect(readKombi(inp({ combo: true }))).toBeNull();
    expect(readKombi(inp({ combo: true, cAvd: 150 }))).toBeNull();
    expect(readKombi(inp({ combo: true, cEtf: 100, cAvd: 50 }))).toEqual(S({ etf: 100, avd: 50 }));
  });
  it('readKombi bringt die Aufteilung immer auf den Monatsbeitrag (setAll), unabhängig von den Chips', () => {
    expect(readKombi(inp({ combo: true, setAll: 300, cEtf: 100, cAvd: 50 }))).toEqual(S({ etf: 200, avd: 100 }));
    expect(readKombi(inp({ combo: true, fondOn: false, cEtf: 100, cFond: 50 }))).toEqual(S({ etf: 100, fond: 50 }));
    expect(readKombi(inp({ combo: true, setAll: 0, cEtf: 100, cAvd: 50 }))).toBeNull();
    expect(readKombi(inp({ combo: true, cEtf: -5, cAvd: 50, cIns: 'x' as unknown as number }))).toBeNull();
  });
  it('scaleSplit: Summe exakt das Budget, Rundungsrest beim größten Teil', () => {
    const s = scaleSplit(S({ etf: 100, avd: 100, ins: 100 }), 200);
    expect(splitSum(s)).toBe(200);
    expect(s).toEqual(S({ etf: 66, avd: 67, ins: 67 }));
    for (const b of [1, 7, 33, 149.5, 1000]) expect(splitSum(scaleSplit(S({ etf: 3, avd: 5, ins: 7, fond: 11 }), b))).toBeCloseTo(b, 9);
    expect(scaleSplit(S({}), 100)).toEqual(S({}));
    expect(scaleSplit(S({ etf: 50 }), 0)).toEqual(S({}));
  });
});
