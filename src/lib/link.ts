// Szenario im Link (#…): kompakt kodiert als Abweichung von einer eingefrorenen Basis.
// Die Basis ist bewusst NICHT an DEFAULTS gekoppelt: Ändern sich die Standardwerte später,
// bleiben alte Links trotzdem gültig. Bei einer neuen Basis LINK_VERSION erhöhen und die alte hier behalten.
// Regel: Neue Schlüssel dürfen an eine bestehende Basis angehängt werden, wenn ihr Basiswert das bisherige
// Verhalten ergibt; bestehende Werte nie ändern, sonst neue Version.
// Ausnahme Rechtsstand (LAW_KEYS): Der Standard dieser Schlüssel bedeutet „geltendes Recht“, nicht eine Annahme des
// Nutzers. Ihr Basiswert ist deshalb in jeder Version der Wert der neuesten Rechtsstand-Tabelle (DEFAULTS): Ein Link
// ohne den Schlüssel heißt immer „geltendes Recht beim Öffnen“, und ein Link speichert ihn nur, wenn er davon abweicht.
// Für alle bisherigen v1-Links gleich (Satz bei Erstellung = 25 % = Basiswert), daher keine neue Version nötig.
// Ausdrücklich gespeicherte Werte werden immer so gelesen, wie sie dastehen (z. B. abgRate=27 bleibt 27 %; ist 27 %
// beim Öffnen geltendes Recht, ist das dann keine hypothetische Änderung mehr). docs/jaehrliche-pflege.md Regel 5.
import { BOOL_KEYS, DEFAULTS, INPUT_KEYS, inLimits, RETIRED_KEYS, type InputKey, type Inputs } from './engine/inputs';

export const TABS = ['overview', 'detail', 'heirs', 'settings'] as const;
export type Tab = (typeof TABS)[number];

export const LINK_VERSION = '1';
/** Schlüssel, deren Standard „geltendes Recht“ bedeutet: Basiswert = DEFAULTS (neueste Tabelle), nicht eingefroren. */
export const LAW_KEYS = ['abgRate'] as const satisfies readonly InputKey[];
// Basis = alle Eingaben plus nicht mehr verwendete Schlüssel (RETIRED_KEYS), die in der Basis stehen bleiben.
const BASES: Record<string, Inputs & { avdStd: boolean; avdSafe: number }> = {
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
    // Später angehängt: Standarddepot-Umschichtung aus (bisheriges Verhalten). Nicht mehr verwendet, ersetzt durch shift/safeRate.
    avdStd: false, avdSafe: 2,
    // Später angehängt: Umschichtung vor Rentenbeginn in allen Produkten aus (bisheriges Verhalten).
    shift: false, safeRate: 2,
    // R5: −1 = wie incRet (bisheriges Verhalten), bis ein eigener Bruttowert eingegeben wird.
    kvGrossRet: -1, payResidual: false, fundingDelay: false, indexAllowance: false,
    avdPayCost: -1, etfPayTer: -1, fondPayTer: -1,
    // Später angehängt: Gehaltsentwicklung aus (bisheriges Verhalten: Gehalt bleibt konstant).
    incPeak: -1, incPeakAge: 45,
    // Später angehängt: keine Kirchensteuer, ledig (bisheriges Verhalten: Grundtarif ohne Kirchensteuer).
    kist: 0, married: false, incSpouse: 38000, incSpouseRet: 20000,
    // Später angehängt: ganzer Sparer-Pauschbetrag frei (bisheriges Verhalten).
    allowanceUsed: 0,
    // Später angehängt: Partner ohne eigenen geförderten Vertrag (bisheriges Verhalten).
    avdSpouse: 0,
    // Später angehängt: heutiges Steuerrecht (bisheriges Verhalten), Änderung ab Rentenbeginn.
    // abgRate ist ein LAW_KEY: Für Links gilt statt der 25 (Satz 2026) der Satz der neuesten Tabelle (baseOf).
    abgRate: 25, estAdd: 0, taxFrom: -1,
  },
};
/** Die eingefrorene Basis von Version 1 wie oben (Tests und Speicher-Migration), abgRate also 25. Links benutzen baseOf. */
export const LINK_BASE_V1: Readonly<Inputs> = withoutRetired(BASES['1']);

/** Basis einer Link-Version, wie sie Kodieren und Dekodieren benutzen: eingefroren, nur LAW_KEYS = geltendes Recht. */
function baseOf(v: string): Inputs | null {
  const b = BASES[v];
  if (!b) return null;
  const out = withoutRetired(b);
  for (const k of LAW_KEYS) out[k] = DEFAULTS[k];
  return out;
}

function withoutRetired(x: Inputs): Inputs {
  const out = { ...x } as Record<string, unknown>;
  for (const k of Object.keys(RETIRED_KEYS)) delete out[k];
  return out as unknown as Inputs;
}

export function encodeState(inputs: Inputs, tab: Tab): string {
  const base = baseOf(LINK_VERSION)!;
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
  const base = baseOf(v);
  if (!base) return { inputs: null, tab, unsupported: true };
  const inputs: Inputs = base;
  for (const [k0, raw] of q) {
    // Alter Schlüssel: auf den Nachfolger übertragen, sofern der Link diesen nicht selbst enthält.
    const k = k0 in RETIRED_KEYS && !q.has(RETIRED_KEYS[k0]) ? RETIRED_KEYS[k0] : k0;
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
