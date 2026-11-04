// Szenario im Link (#…): kompakt kodiert als Abweichung von einer eingefrorenen Basis.
// Die Basis ist bewusst NICHT an DEFAULTS gekoppelt: Ändern sich die Standardwerte später,
// bleiben alte Links trotzdem gültig. Bei einer neuen Basis LINK_VERSION erhöhen und die alte hier behalten.
// Regel: Neue Schlüssel dürfen an eine bestehende Basis angehängt werden, wenn ihr Basiswert das bisherige
// Verhalten ergibt; bestehende Werte nie ändern, sonst neue Version.
import { BOOL_KEYS, INPUT_KEYS, inLimits, type InputKey, type Inputs } from './engine/inputs';

export const TABS = ['overview', 'detail', 'heirs', 'settings'] as const;
export type Tab = (typeof TABS)[number];

export const LINK_VERSION = '1';
const BASES: Record<string, Inputs> = {
  '1': {
    a0: 22, incWork: 38000, incRet: 20000, setAll: 150, g: 6, R: 67, kvOn: false,
    etfOn: true, avdOn: true, insOn: true, fondOn: false,
    H: 90, gPay: 4, einmal: false, insLump: true, rf: 30, gz: 10,
    deathAge: 50, heirHalf: false,
    studyEnd: 16, incStudy: 12000, eligStudy: true, kvRate: 21.7,
    infl: 2, dyn: 0, basis: 3.2,
    etfM: 150, etfTer: 0.2,
    avdM: 150, avdCost: 0.5, kids: 0, kidsFrom: 32, kidsYears: 25, bonus: true, reinvest: true,
    insM: 150, insEff: 0.9,
    fondM: 150, fondAA: 5, fondTer: 1.6,
    real: true,
    // Später angehängt (Wave 2); Basiswerte = bisheriges Verhalten (keine Kombi, Erben wie bisher).
    incHeir: 38000, kvKind: 0,
    combo: false, cEtf: 0, cAvd: 0, cIns: 0, cFond: 0,
    // Später angehängt: Standarddepot-Umschichtung aus (bisheriges Verhalten).
    avdStd: false, avdSafe: 2,
  },
};
/** Die eingefrorene Basis von Version 1 (Tests und Speicher-Migration). */
export const LINK_BASE_V1: Readonly<Inputs> = BASES['1'];

export function encodeState(inputs: Inputs, tab: Tab): string {
  const base = BASES[LINK_VERSION];
  const q = new URLSearchParams();
  q.set('v', LINK_VERSION);
  for (const k of INPUT_KEYS) {
    const v = inputs[k];
    if (v === base[k]) continue;
    q.set(k, typeof v === 'boolean' ? (v ? '1' : '0') : String(v));
  }
  if (tab !== 'overview') q.set('t', tab);
  return q.toString();
}

export interface Decoded {
  /** Vollständige Eingaben, falls der Link ein Szenario enthält, sonst null. */
  inputs: Inputs | null;
  tab: Tab | null;
  /** Link aus einer unbekannten (neueren) Version: Szenario ignoriert. */
  unsupported: boolean;
}

export function decodeState(hash: string): Decoded {
  const q = new URLSearchParams(hash.replace(/^#/, ''));
  const t = q.get('t');
  const tab = (TABS as readonly string[]).includes(t ?? '') ? (t as Tab) : null;
  const v = q.get('v') ?? LINK_VERSION;
  const hasInputs = q.has('v') || INPUT_KEYS.some(k => q.has(k));
  if (!hasInputs) return { inputs: null, tab, unsupported: false };
  const base = BASES[v];
  if (!base) return { inputs: null, tab, unsupported: true };
  const inputs: Inputs = { ...base };
  for (const [k, raw] of q) {
    if (!(INPUT_KEYS as string[]).includes(k)) continue; // Unbekanntes ignorieren
    const key = k as InputKey;
    if (BOOL_KEYS.has(key)) {
      if (raw === '1' || raw === 'true') (inputs[key] as boolean) = true;
      else if (raw === '0' || raw === 'false') (inputs[key] as boolean) = false;
    } else {
      const x = Number(raw);
      if (raw.trim() !== '' && isFinite(x) && inLimits(key, x)) (inputs[key] as number) = x; // Müll und Unsinn im Link ignorieren
    }
  }
  return { inputs, tab, unsupported: false };
}

export function sameInputs(a: Inputs, b: Inputs): boolean {
  return INPUT_KEYS.every(k => a[k] === b[k]);
}
