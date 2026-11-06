// Probe-Rechtsstand für den Zukunftstest (vitest.lawprobe.config.ts): eine erfundene, in sich stimmige Tabelle mit
// anderen Werten in jedem Feld, das sich jährlich ändern kann. Sie simuliert „neue Tabelle angelegt, CURRENT_LAW zeigt
// darauf“. Keine echten Werte, nie in der App verwenden.
import { LAW_2026, defineLaw, type Law } from '../../src/lib/engine/law';

const s = 1.02; // Tarif um 2 % indexiert: Grenzen und Absolutglieder ×s, quadratische Koeffizienten ÷s (stetig)
const { fn: _fn, ...BASE } = LAW_2026;
const T = BASE.tariff;
export const LAW_PROBE: Law = defineLaw({
  ...BASE,
  id: 'probe',
  year: 2099,
  tariff: {
    gfb: T.gfb * s, z2End: T.z2End * s, z3End: T.z3End * s, z4End: T.z4End * s,
    a2: T.a2 / s, b2: T.b2, a3: T.a3 / s, b3: T.b3, c3: T.c3 * s,
    r4: T.r4, c4: T.c4 * s, r5: T.r5, c5: T.c5 * s,
  },
  soli: { ...LAW_2026.soli, fg: LAW_2026.soli.fg * s },
  spb: 1100,
  saPausch: 40,
  wkPauschRente: 110,
  kvBbg: 72000,
  kvJaeg: 79000,
  kv: { general: 14.6, reduced: 14.0, zusatzAvg: 3.1, pv: 3.8, pvChildless: 0.6 },
  basiszins: 0.025,
  avd: { ...LAW_2026.avd, subMax: 2100, max: 7200, minOwn: 140, grundTop1: 420, grundTop2: 2100, kid: 330, bonus: 220, spouseMinOwn: 140, spouseRaise: 140, spouseGrundMax: 190 },
  ertrag: { ...LAW_2026.ertrag, 67: 18 },
});
