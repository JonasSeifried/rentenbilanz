import { describe, expect, it, vi } from 'vitest';
import { combo, emptySplit, SPLIT_KEYS } from '../src/lib/engine/combo';
import { readParams } from '../src/lib/engine/core';
import { ALL_FIXES, type FixId } from '../src/lib/engine/fixes';
import { DEFAULTS, type Inputs } from '../src/lib/engine/inputs';
// Rechnet mit den Beträgen von 2026, auch wenn neuere Rechtsstand-Tabellen dazukommen (tests/helpers/law-2026.ts).
vi.mock('../src/lib/engine/law', async orig => (await import('./helpers/law-2026')).pin2026(await orig()));

const P = (patch: Partial<Inputs> = {}) => readParams({ ...DEFAULTS, ...patch });
const without = (...ids: FixId[]) => ({ fixes: new Set([...ALL_FIXES].filter(f => !ids.includes(f))) });

// Eigene Jahresveranlagung aus § 32a, § 10a / § 2 Abs. 6 EStG und §§ 3/4 SolZG.
// Keine Steuerfunktion der Engine; kein persönlicher Kinderfreibetrags-/§-35a-Fall.
function assessment(income: number, deduction: number, zulage: number, index = 1, round = true) {
  const est = (v: number) => {
    const x = round ? Math.floor(Math.max(0, v)) / index : Math.floor(Math.max(0, v) / index);
    const y = (x - 12348) / 10000, z = (x - 17799) / 10000;
    const raw = x <= 12348 ? 0 : x <= 17799 ? 1400 * y + 914.51 * y ** 2
      : x <= 69878 ? 1034.87 + 2397 * z + 173.10 * z ** 2
      : x <= 277825 ? .42 * x - 11135.63 : .45 * x - 19470.38;
    return round ? Math.floor(raw * index) : raw * index;
  };
  const soli = (e: number) => Math.max(0, Math.min(e * .055, (e - 20350 * index) * .119));
  const before = est(income), after = est(income - deduction);
  const useSA = before - after > zulage;
  const assessed = useSA ? after + zulage : before;
  return { useSA, est: assessed, soli: soli(assessed), total: assessed + soli(assessed),
    refund: before + soli(before) - assessed - soli(assessed) };
}

const constantContributionCase = (incWork: number, avd = 150, patch: Partial<Inputs> = {}, off: FixId[] = []) => {
  const p = P({ a0: 60, R: 65, H: 85, infl: 0, dyn: 0, reinvest: false, incWork, ...patch });
  return combo(p, { ...emptySplit(), avd }, without(...off));
};

describe('E4 – vollständige AVD-ESt-/Soli-Veranlagung im modellierten Grundtarif', () => {
  it('Reviewprobe: 110.000 € Einkommen, 1.800 € Beitrag, 540 € reguläre Zulage', () => {
    const current = constantContributionCase(110000), old = constantContributionCase(110000, 150, {}, ['soliOnZulage']);
    const expected = assessment(110000, 2340, 540);
    expect(expected.est).toBe(34621);
    expect(expected.soli).toBeCloseTo(1698.249, 9);
    expect(current.parts.avd!.ref! / current.n).toBeCloseTo(495.717, 8);
    expect(old.parts.avd!.ref! / old.n).toBeCloseTo(559.977, 8);
    expect((old.parts.avd!.ref! - current.parts.avd!.ref!) / current.n).toBeCloseTo(64.26, 8);
    expect(current.parts.avd!.ref! / current.n).toBeCloseTo(expected.refund, 8);
    expect(current.net[0]).toBe(0); // Bisherige ausgegebene Erstattung bleibt außerhalb der Zahlungsreihe.
  });

  it('SA scheidet bei Gleichstand aus; Soli allein begründet keinen SA-Abzug', () => {
    // 1.800 + 1.440 = 3.240 € Abzug, 1.361 € ESt-Entlastung < 1.440 € Zulage.
    // Kinder hier nur als Zulagenanspruch, ohne persönliche Kinderfreibetragsrechnung.
    const patch = { kids: 3, kidsFrom: 0, kidsYears: 100 };
    const current = constantContributionCase(80000, 150, patch), old = constantContributionCase(80000, 150, patch, ['soliOnZulage']);
    expect(assessment(80000, 3240, 1440).useSA).toBe(false);
    expect(current.parts.avd!.ref).toBe(0);
    expect(old.parts.avd!.ref).toBeGreaterThan(0);
    // ESt-Differenz genau 540 €: 1.218 − 678 = 540, kein SA-Vorteil.
    expect(assessment(18559, 2340, 540).useSA).toBe(false);
    expect(constantContributionCase(18559).parts.avd!.ref).toBe(0);
  });

  it('Freigrenze, Milderungszone, Übergänge und voller Soli, mit/ohne nominales R8', () => {
    for (const round of [false, true]) for (const income of [0, 12348.99, 17799.99, 20000, 38000, 70000,
      74966, 74967, 74968, 76000, 110000, 116605, 116606, 116607, 117660, 117661, 117662, 118000, 120000, 300000]) {
      const c = constantContributionCase(income, 150, {}, round ? [] : ['taxRounding']);
      expect(c.parts.avd!.ref! / c.n, `${income}, R8=${round}`).toBeCloseTo(assessment(income, 2340, 540, 1, round).refund, 7);
    }
    expect(assessment(70000, 2340, 540).soli).toBe(0);
    expect(assessment(110000, 2340, 540).soli).toBeLessThan(assessment(110000, 2340, 540).est * .055);
    expect(assessment(120000, 2340, 540).soli).toBe(assessment(120000, 2340, 540).est * .055);
  });

  it('nominale Rundung und Indexierung über alle Beitragsjahre, auch kleine Beiträge und Bonus', () => {
    for (const round of [false, true]) for (const bonusFix of [false, true]) for (const avd of [0, 9, 10, 25, 150, 570]) {
      const p = P({ incWork: 110000.37, a0: 22, R: 67, infl: 3.7, dyn: 0, reinvest: false });
      const c = combo(p, { ...emptySplit(), avd }, { ...without(...(!round ? ['taxRounding' as const] : []),
        ...(!bonusFix ? ['bonusOutsideSA' as const] : [])), parts: ['avd'] });
      const E = Math.min(avd * 12, 1800), Z = E < 120 ? 0 : .5 * Math.min(E, 360) + .25 * Math.max(0, E - 360);
      let total = 0;
      for (let t = 0; t < c.n; t++) {
        const z = Z + (!bonusFix && t === 0 && E >= 120 ? 200 : 0);
        const expected = assessment(p.incWork * c.I(t), E + z, z, c.I(t), round).refund;
        expect(c.net[t]).toBe(0); total += expected;
      }
      expect(c.parts.avd!.ref).toBeCloseTo(total, 6);
    }
  });

  it('Bonus bleibt bei eingeschaltetem E3 außerhalb der Steuerprüfung, fließt aber ins Vertragskapital', () => {
    const a = constantContributionCase(110000, 150, { a0: 22, R: 65, bonus: true });
    const b = constantContributionCase(110000, 150, { a0: 22, R: 65, bonus: false });
    expect(a.parts.avd!.ref).toBe(b.parts.avd!.ref);
    expect(a.parts.avd!.zul! - b.parts.avd!.zul!).toBe(200);
    expect(a.parts.avd!.vals[1]! - b.parts.avd!.vals[1]!).toBeCloseTo(200, 8);
  });

  it('Erstattung/Wiederanlage/Verzug genau einmal, ohne Änderung der Zulagen oder Eigenbeiträge', () => {
    for (const reinvest of [false, true]) for (const fundingDelay of [false, true]) {
      const c = constantContributionCase(110000, 150, { reinvest, fundingDelay, g: 0, gPay: 0, incRet: 0, avdCost: 0, etfTer: 0, basis: 0 });
      const a = c.parts.avd!, refund = assessment(110000, 2340, 540).refund;
      expect(a.own).toBeCloseTo(1800 * c.n, 8); expect(a.zul).toBe(540 * c.n);
      expect(a.ref).toBeCloseTo(refund * c.n, 8); expect(a.foerder).toBeCloseTo((540 + refund) * c.n, 8);
      expect(a.sideR).toBeCloseTo(reinvest ? refund * (c.n - (fundingDelay ? 1 : 0)) : 0, 8);
      expect(c.net.slice(0, c.n).every(x => x === 0)).toBe(true);
      // Im ersten Rentenjahr bleibt auch die letzte verzögerte Erstattung erhalten.
      expect(c.net.slice(c.n, c.tH).reduce((s, x) => s + x, 0) + c.net[0]).toBeCloseTo(2340 * c.n + (reinvest ? refund * c.n : 0), 7);
    }
  });

  it('R3: jährliche Gesamtbilanz nach AVD-SA, mit beiden Entscheidungen und ohne doppelte Erstattung', () => {
    let decisionChanges = 0, cashRefunds = 0;
    for (const reinvest of [false, true]) for (const round of [false, true]) for (const incWork of [12000, 21000, 38000, 76000, 110000, 120000]) {
      const p = P({ a0: 22, R: 67, incWork, incStudy: 6000, studyEnd: 24, reinvest, infl: 2.7, shift: true });
      const split = { etf: 10000, avd: 150, ins: 500, fond: 5000 };
      const off: FixId[] = round ? [] : ['taxRounding'];
      const a = combo(p, split, without(...off)), b = combo(p, split, without(...off, 'capitalGuenstiger'));
      for (let t = 0; t < a.n; t++) {
        const paid = b.abgTax[t], K = paid / .26375, income = (t < 2 ? 6000 : incWork) * a.I(t);
        const baseline = assessment(income, 2340, 540, a.I(t), round);
        const withCapital = assessment(income + K, 2340, 540, a.I(t), round);
        const final = Math.min(paid, withCapital.total - baseline.total);
        if (baseline.useSA !== withCapital.useSA) decisionChanges++;
        if (paid > final) cashRefunds++;
        expect(a.abgTax[t]).toBeCloseTo(final, 6);
        expect(b.net[t]).toBe(0);
        expect(a.net[t]).toBeCloseTo(paid - final, 6);
        for (const k of SPLIT_KEYS) expect(a.parts[k]!.vals[t]).toBe(b.parts[k]!.vals[t]);
        expect(SPLIT_KEYS.reduce((s, k) => s + a.parts[k]!.net[t], 0)).toBeCloseTo(a.net[t], 6);
      }
      expect(a.parts.avd!.ref).toBe(b.parts.avd!.ref);
      expect(a.kv).toEqual(b.kv);
    }
    expect(decisionChanges).toBeGreaterThan(0);
    expect(cashRefunds).toBeGreaterThan(0);
  });
});
