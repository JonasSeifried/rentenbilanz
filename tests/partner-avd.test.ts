// Eigener geförderter Vertrag des Partners (avdSpouse, nur verheiratet). Erwartete Werte aus einer eigenen, von der
// Engine unabhängigen Veranlagung: Splitting § 32a Abs. 5, Günstigerprüfung § 10a Abs. 2 und 3 EStG (BMF 05.10.2023
// Rn. 109/110), Zulagen § 84 n. F. (AVRG, BGBl. 2026 I Nr. 156), Zurechnung § 10a Abs. 4 S. 3–4 (Rn. 116/118).
// Herleitung und Quellen: docs/kirchensteuer-splitting.md, Abschnitt „Partner mit eigenem gefördertem Vertrag“.
import { describe, expect, it } from 'vitest';
import { analyze } from '../src/lib/engine/analyze';
import { combo, emptySplit, type Split } from '../src/lib/engine/combo';
import { readParams } from '../src/lib/engine/core';
import { DEFAULTS, type Inputs } from '../src/lib/engine/inputs';
import { decodeState, encodeState, LINK_BASE_V1 } from '../src/lib/link';
import { sanitize } from '../src/lib/storage';
import { rechenweg } from '../src/lib/rechenweg';
import { changedSettings } from '../src/lib/settingsChanged';

const P = (patch: Partial<Inputs> = {}) => readParams({ ...DEFAULTS, ...patch });
const only = (k: keyof Split, v: number): Split => ({ ...emptySplit(), [k]: v });

/** Tarif 2026 (§ 32a Abs. 1), zvE und Steuer auf volle Euro abgerundet; Inflation 0. */
function est(v: number): number {
  const x = Math.floor(Math.max(0, v)), y = (x - 12348) / 1e4, z = (x - 17799) / 1e4;
  const raw = x <= 12348 ? 0 : x <= 17799 ? (914.51 * y + 1400) * y
    : x <= 69878 ? (173.10 * z + 2397) * z + 1034.87
    : x <= 277825 ? .42 * x - 11135.63 : .45 * x - 19470.38;
  return Math.floor(Math.max(0, raw));
}
/** Splitting ohne Kirchensteuer: ESt 2 × Tarif(zvE/2), Zulage hinzugerechnet, Soli mit Freigrenze 40.700 €. */
function total(x: number, ded = 0, z = 0) {
  const e = 2 * est((x - ded) / 2), a = e + z;
  return { est: e, total: a + Math.max(0, Math.min(.055 * a, .119 * (a - 40700))) };
}
/** Gemeinsame Belastung nach Günstigerprüfung: Abzug nur, wenn die ESt-Ersparnis die Zulagen übersteigt. */
function liability(x: number, ded: number, z: number) {
  const b = total(x), a = total(x, ded, z);
  return ded > 0 && b.est - a.est > z ? a.total : b.total;
}
const grund = (e: number) => 0.5 * Math.min(e, 360) + 0.25 * Math.max(0, Math.min(e, 1800) - 360);

// Fünf Ansparjahre, Inflation und Dynamik 0: jedes Jahr gleich.
const base = { a0: 60, R: 65, H: 85, infl: 0, dyn: 0, reinvest: false, married: true, setAll: 150, avdM: 150 } as const;

describe('Partner-Vertrag: 0 ⇒ bitgleich', () => {
  it('avdSpouse wirkt nur verheiratet; 0 und ledig unverändert', () => {
    for (const patch of [{}, { kvOn: true, kist: 9 }, { married: true, incSpouse: 0, incSpouseRet: 0 }]) {
      const a = analyze(P(patch)), b = analyze(P({ ...patch, avdSpouse: 0 }));
      expect(b.stats).toStrictEqual(a.stats);
    }
    const ledig = analyze(P()), mit = analyze(P({ avdSpouse: 150 }));
    expect(mit.stats).toStrictEqual(ledig.stats);
    for (const k of ['etf', 'avd', 'ins'] as const) {
      expect(mit.res[k]!.net).toStrictEqual(ledig.res[k]!.net);
      expect(mit.res[k]!.heir(28)).toStrictEqual(ledig.res[k]!.heir(28));
    }
  });
  it('Eingaben ohne den neuen Schlüssel: kein Partner-Vertrag', () => {
    const { avdSpouse: _x, ...legacy } = DEFAULTS;
    expect(readParams(legacy as Inputs).avdSpouse).toBe(0);
  });
});

describe('Partner unmittelbar förderberechtigt (eigenes Einkommen)', () => {
  it('Erstattung = gemeinsame Belastung nur mit Partner-Vertrag − mit beiden Verträgen', () => {
    // [Einkommen, Partner-Einkommen, Partner-Beitrag €/Monat]
    for (const [inc, sp, m] of [[38000, 38000, 150], [38000, 38000, 10], [38000, 38000, 50], [60000, 20000, 100], [110000, 30000, 150]] as const) {
      const c = combo(P({ ...base, incWork: inc, incSpouse: sp, avdSpouse: m }), only('avd', 150));
      const x = inc + sp, eP = Math.min(m * 12, 1800), zP = eP >= 120 ? grund(eP) : 0;
      const exp = liability(x, eP + zP, zP) - liability(x, 1800 + 540 + eP + zP, 540 + zP);
      expect(c.parts.avd!.ref! / c.n).toBeCloseTo(exp, 8);
      expect(c.parts.avd!.zul! / c.n).toBe(540); // eigene Zulage unverändert (§ 84 S. 1)
      expect(c.parts.avd!.zulSpouse).toBeUndefined();
    }
  });
  it('Handrechnung: beide 38.000 €, Partner 10 €/Monat – die gemeinsame Prüfung kostet 6 € im Jahr', () => {
    // Partner allein: 120 € + 60 € Zulage = 180 € Abzug, Ersparnis 2·(est(38.000) − est(37.910)) = 56 € < 60 € ⇒ kein Abzug.
    expect(2 * est(38000) - 2 * est((76000 - 180) / 2)).toBe(56);
    // Gemeinsam: 2.520 € Abzug, Ersparnis 774 € > 600 € ⇒ Erstattung 174 €; ohne Partner-Vertrag 2.340 € ⇒ 720 − 540 = 180 €.
    expect(2 * est(38000) - 2 * est((76000 - 2520) / 2)).toBe(774);
    expect(2 * est(38000) - 2 * est((76000 - 2340) / 2)).toBe(720);
    const mit = combo(P({ ...base, incWork: 38000, incSpouse: 38000, avdSpouse: 10 }), only('avd', 150));
    const ohne = combo(P({ ...base, incWork: 38000, incSpouse: 38000 }), only('avd', 150));
    expect(mit.parts.avd!.ref! / mit.n).toBeCloseTo(174, 9);
    expect(ohne.parts.avd!.ref! / ohne.n).toBeCloseTo(180, 9);
  });
  it('Unter 120 € im Jahr: keine Partner-Zulage, nur Abzug (R6)', () => {
    const c = combo(P({ ...base, incWork: 38000, incSpouse: 38000, avdSpouse: 5 }), only('avd', 150));
    const exp = liability(76000, 60, 0) - liability(76000, 2340 + 60, 540);
    expect(c.parts.avd!.ref! / c.n).toBeCloseTo(exp, 8);
  });
});

describe('Partner mittelbar zulageberechtigt (kein eigenes Einkommen)', () => {
  it('Handrechnung 110.000 € + 0 €, Partner 50 €/Monat: beide Beiträge bis 1.920 €, beide Zulagen', () => {
    const c = combo(P({ ...base, incWork: 110000, incSpouse: 0, avdSpouse: 50 }), only('avd', 150));
    // Partner-Grundzulage aus den eigenen 1.800 €: 540 €, höchstens 175 €; vom Partner-Beitrag zählen 1.920 − 1.800 = 120 €.
    const ded = 1800 + 120 + 540 + 175, z = 540 + 175;
    expect(ded).toBe(2635);
    const save = 2 * est(55000) - 2 * est((110000 - ded) / 2);
    expect(save).toBe(966);
    expect(c.parts.avd!.ref! / c.n).toBeCloseTo(save - z, 9); // 251 € statt ohne Partner-Vertrag 858 − 540 = 318 €
    expect(2 * est(55000) - 2 * est((110000 - 2340) / 2)).toBe(858);
    const ohne = combo(P({ ...base, incWork: 110000, incSpouse: 0 }), only('avd', 150));
    expect(ohne.parts.avd!.ref! / ohne.n).toBeCloseTo(2 * est(55000) - 2 * est((110000 - 2340) / 2) - 540, 9);
    expect(c.parts.avd!.zulSpouse).toBe(175 * 5);
    expect(c.parts.avd!.zul).toBe(ohne.parts.avd!.zul);
  });
  it('Erbfall: Rückzahlung nur des diesem Vertrag zugerechneten Teils (1.800 / 1.920)', () => {
    const p = { ...base, incWork: 110000, incSpouse: 0, deathAge: 65 };
    const c = combo(P({ ...p, avdSpouse: 50 }), only('avd', 150)), o = combo(P(p), only('avd', 150));
    const back1 = c.parts.avd!.ref! * 1800 / 1920, back0 = o.parts.avd!.ref!;
    // Gleiches Vertragsvermögen und gleiche Erträge; der Erbwert unterscheidet sich nur um die Rückzahlung.
    expect(c.parts.avd!.vals[c.n]).toBe(o.parts.avd!.vals[o.n]);
    expect(c.parts.avd!.heir(c.n).val - o.parts.avd!.heir(o.n).val).toBeCloseTo(back0 - back1, 6);
  });
  it('Partner unter 120 € im Jahr oder eigener Beitrag unter 120 €: keine Wirkung', () => {
    const p = { ...base, incWork: 110000, incSpouse: 0 };
    const o = combo(P(p), only('avd', 150));
    const low = combo(P({ ...p, avdSpouse: 9.99 }), only('avd', 150));
    expect(low.parts.avd!.ref).toBe(o.parts.avd!.ref);
    expect(low.parts.avd!.zulSpouse).toBeUndefined();
    const small = { ...p, setAll: 5, avdM: 5 };
    expect(combo(P({ ...small, avdSpouse: 50 }), only('avd', 5)).parts.avd!.ref).toBe(combo(P(small), only('avd', 5)).parts.avd!.ref);
  });
  it('Andere Produkte unverändert (ohne eigenen Vertrag keine mittelbare Berechtigung, BMF Rn. 27)', () => {
    const a = analyze(P({ married: true, incSpouse: 0, incSpouseRet: 0 })), b = analyze(P({ married: true, incSpouse: 0, incSpouseRet: 0, avdSpouse: 50 }));
    for (const k of ['etf', 'ins'] as const) expect(b.res[k]!.net).toStrictEqual(a.res[k]!.net);
  });
});

describe('Eingabe, Link, Speicher, Oberfläche', () => {
  it('Link-Basis 0, Link und Speicher übernehmen den Wert', () => {
    expect(LINK_BASE_V1.avdSpouse).toBe(0);
    const i = { ...DEFAULTS, married: true, avdSpouse: 75 };
    expect(decodeState(encodeState(i, 'overview')).inputs!.avdSpouse).toBe(75);
    expect(sanitize({ avdSpouse: 75 })!.avdSpouse).toBe(75);
    expect(sanitize({ avdSpouse: -5 })).toBeNull();
  });
  it('Einstellungs-Badge nur verheiratet', () => {
    expect(changedSettings({ ...DEFAULTS, avdSpouse: 50 })).not.toContain('avdSpouse');
    expect(changedSettings({ ...DEFAULTS, married: true, avdSpouse: 50 })).toContain('avdSpouse');
  });
  it('Rechenweg nennt Fall und Partner-Zulage', () => {
    const i = { ...DEFAULTS, married: true, incSpouse: 0, incSpouseRet: 0, avdSpouse: 50 };
    const md = rechenweg(i, analyze(readParams(i)), 'x');
    expect(md).toContain('| avdSpouse |');
    expect(md).toContain('mittelbar zulageberechtigt');
    expect(md).toMatch(/nicht im Ergebnis enthalten: zusammen [\d.]+ € nominal/);
    const j = { ...i, incSpouse: 38000 };
    expect(rechenweg(j, analyze(readParams(j)), 'x')).toContain('unmittelbar förderberechtigt');
  });
});
