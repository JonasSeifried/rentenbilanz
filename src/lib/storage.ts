// Eingaben lokal im Browser speichern (localStorage). Nichts verlässt das Gerät.
//
// Format v2: { v: 2, savedAt, inputs: Partial<Inputs> } – nur Schlüssel, die von DEFAULTS abweichen.
// Beim Laden gilt DEFAULTS ⊕ Abweichungen. So erreichen geänderte Standardwerte (z. B. Beitragssatz,
// Basiszins) auch Nutzer, die schon etwas eingegeben haben.
// Format v1 (altes Format, volles Objekt): Werte, die der eingefrorenen Link-Basis v1 entsprechen, waren
// nie bewusst gesetzt und werden verworfen; der Rest bleibt erhalten.
import { DEFAULTS, INPUT_KEYS, inLimits, type InputKey, type Inputs } from './engine/inputs';
import { LINK_BASE_V1 } from './link';

export const STORAGE_KEY = 'vorsorge-rechner:eingaben';
// Der Schlüssel steht bewusst auch in public/theme.js (klassisches Skript vor dem Laden, kann nichts importieren):
// bei Änderung beide Stellen anpassen.
export const THEME_KEY = 'vorsorge-rechner:theme';
const STORAGE_VERSION = 2;

// Die Speicher-Probe (schreiben + löschen) läuft nur einmal je Storage-Objekt.
let probedFor: Storage | undefined;
let probeResult: Storage | null = null;

function store(): Storage | null {
  let s: Storage;
  try { s = window.localStorage; } catch { return null; } // z. B. Speicher blockiert
  if (!s) return null;
  if (s === probedFor) return probeResult;
  probedFor = s;
  try {
    const probe = '__vr_probe__';
    s.setItem(probe, '1'); s.removeItem(probe);
    probeResult = s;
  } catch { probeResult = null; } // z. B. Speicher voll
  return probeResult;
}

export const storageAvailable = (): boolean => store() !== null;

/** Bekannte Schlüssel mit passendem Typ und Wert innerhalb von LIMITS; alles andere fällt weg. */
function pick(raw: unknown): Partial<Inputs> {
  const out: Partial<Inputs> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const k of INPUT_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(raw, k)) continue;
    const v = (raw as Record<string, unknown>)[k];
    if (typeof v !== typeof DEFAULTS[k]) continue;
    if (typeof v === 'number' && !inLimits(k, v)) continue;
    (out[k] as unknown) = v;
  }
  return out;
}

/** Übernimmt nur bekannte Felder mit passendem Typ im erlaubten Bereich; alles andere bleibt Standard. */
export function sanitize(raw: unknown): Inputs | null {
  const part = pick(raw);
  return Object.keys(part).length ? { ...DEFAULTS, ...part } : null;
}

/** Nur die Abweichungen von den Standardwerten (das Speicherformat v2). */
function diffToDefaults(inputs: Partial<Inputs>): Partial<Inputs> {
  const out: Partial<Inputs> = {};
  for (const k of INPUT_KEYS) {
    const v = inputs[k];
    if (v !== undefined && v !== DEFAULTS[k]) (out[k] as unknown) = v;
  }
  return out;
}

/** Gespeicherte Abweichungen lesen (v2) bzw. aus v1 migrieren. null = nichts Gespeichertes oder unbrauchbar. */
function readDiff(s: Storage): Partial<Inputs> | null {
  let data: unknown;
  try {
    const raw = s.getItem(STORAGE_KEY);
    if (!raw) return null;
    data = JSON.parse(raw);
  } catch { return null; }
  if (!data || typeof data !== 'object') return null;
  const { v, inputs } = data as { v?: unknown; inputs?: unknown };
  if (!inputs || typeof inputs !== 'object') return null;
  const part = pick(inputs);
  if (v === 1) {
    // Migration: Werte gleich der Link-Basis v1 waren nicht bewusst gewählt (z. B. kvRate 21,7 → neuer Standard).
    for (const k of INPUT_KEYS) if (k in part && part[k] === LINK_BASE_V1[k]) delete part[k];
    return diffToDefaults(part);
  }
  if (v === STORAGE_VERSION) return diffToDefaults(part);
  return null; // unbekannte (neuere) Version: ignorieren
}

export function loadSaved(): Inputs | null {
  const s = store(); if (!s) return null;
  const diff = readDiff(s);
  return diff ? { ...DEFAULTS, ...diff } : null;
}

/**
 * Speichert die Abweichungen von DEFAULTS. Mit `onlyKeys` werden nur diese Schlüssel in den bereits
 * gespeicherten Stand geschrieben (andere Tabs behalten ihre Änderungen); ohne ersetzt es alles.
 */
export function saveInputs(inputs: Inputs, onlyKeys?: readonly InputKey[]): boolean {
  const s = store(); if (!s) return false;
  try {
    let diff: Partial<Inputs>;
    if (onlyKeys) {
      diff = readDiff(s) ?? {};
      for (const k of onlyKeys) {
        if (inputs[k] === DEFAULTS[k]) delete diff[k];
        else (diff[k] as unknown) = inputs[k];
      }
    } else diff = diffToDefaults(inputs);
    s.setItem(STORAGE_KEY, JSON.stringify({ v: STORAGE_VERSION, savedAt: new Date().toISOString(), inputs: diff }));
    return true;
  } catch { return false; }
}

export function clearSaved(): void {
  const s = store(); if (!s) return;
  try { s.removeItem(STORAGE_KEY); } catch { /* egal */ }
}
