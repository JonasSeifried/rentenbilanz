// Eingaben lokal im Browser speichern (localStorage). Nichts verlässt das Gerät.
import { DEFAULTS, INPUT_KEYS, type Inputs } from './engine/inputs';

export const STORAGE_KEY = 'vorsorge-rechner:eingaben';
export const THEME_KEY = 'vorsorge-rechner:theme';

function store(): Storage | null {
  try {
    const s = window.localStorage;
    const probe = '__vr_probe__';
    s.setItem(probe, '1'); s.removeItem(probe);
    return s;
  } catch { return null; } // z. B. Speicher blockiert oder voll
}

export const storageAvailable = (): boolean => store() !== null;

/** Übernimmt nur bekannte Felder mit passendem Typ; alles andere bleibt Standard. */
export function sanitize(raw: unknown): Inputs | null {
  if (!raw || typeof raw !== 'object') return null;
  const out: Inputs = { ...DEFAULTS };
  let any = false;
  for (const k of INPUT_KEYS) {
    const v = (raw as Record<string, unknown>)[k];
    if (typeof v === typeof DEFAULTS[k] && (typeof v !== 'number' || isFinite(v))) {
      (out[k] as unknown) = v; any = true;
    }
  }
  return any ? out : null;
}

export function loadSaved(): Inputs | null {
  const s = store(); if (!s) return null;
  try {
    const raw = s.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return sanitize(data?.inputs);
  } catch { return null; }
}

export function saveInputs(inputs: Inputs): boolean {
  const s = store(); if (!s) return false;
  try { s.setItem(STORAGE_KEY, JSON.stringify({ v: 1, savedAt: new Date().toISOString(), inputs })); return true; }
  catch { return false; }
}

export function clearSaved(): void {
  const s = store(); if (!s) return;
  try { s.removeItem(STORAGE_KEY); } catch { /* egal */ }
}
