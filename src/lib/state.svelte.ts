// App-Zustand: Eingaben, aktiver Tab, Ansichtsmodus für geteilte Links, Hinweise.
//
// Ablauf Speichern ↔ Link:
// - Normal („own“): Jede Änderung wird im Browser gespeichert. Die Adresszeile bleibt sauber;
//   ein Link entsteht erst über „Link teilen“.
// - Link mit Szenario öffnen:
//   · nichts gespeichert oder identisch → Szenario direkt übernehmen und speichern;
//   · sonst Ansichtsmodus („shared“): Szenario wird angezeigt, Gespeichertes bleibt unangetastet,
//     Änderungen werden nicht gespeichert. Banner: „Übernehmen“ oder „Zurück zu meinen Eingaben“.
// - Zurücksetzen: sofort auf Standardwerte, mit „Rückgängig“ im Hinweis.
//
// Mehrere Tabs: Gespeichert werden nur die Schlüssel, die dieser Tab geändert hat (`changed`), eingemischt
// in den aktuellen Speicherstand. Vor jedem Vergleich wird neu gelesen; das `storage`-Ereignis holt
// Änderungen anderer Tabs auch in die Anzeige.
//
// „Rückgängig“-Aktionen (Zurücksetzen, Übernehmen, Löschen) gelten nur, solange nichts Neues passiert ist:
// Die nächste Eingabe, ein Moduswechsel oder ein neuer Link macht sie ungültig und blendet sie aus.
import { tick } from 'svelte';
import { CONTRIB_KEYS, DEFAULTS, INPUT_KEYS, type InputKey, type Inputs } from './engine/inputs';
import { decodeState, encodeState, sameInputs, type Tab } from './link';
import { clearSaved, loadSaved, saveInputs, STORAGE_KEY, storageAvailable } from './storage';

export interface ToastAction { label: string; run: () => void }
export interface Toast { id: number; message: string; action?: ToastAction; focus: boolean }
export interface ToastOptions {
  /** Anzeigedauer in ms. Ohne Aktion 8000; mit Aktion kein automatisches Ausblenden (außer `ms` ist gesetzt). */
  ms?: number;
  /** Fokus auf die Aktion setzen. Standard: ja, wenn der Hinweis durch eine Tastaturbedienung entstand. */
  focus?: boolean;
}

export const app = $state({
  inputs: { ...DEFAULTS } as Inputs,
  tab: 'overview' as Tab,
  mode: 'own' as 'own' | 'shared',
  storageOk: true,
  toast: null as Toast | null,
  /** Dialog „Kombi zusammenstellen“ offen (nur Oberfläche, nicht gespeichert). */
  kombiOpen: false,
});

export function openKombi() { app.kombiOpen = true; }
export function closeKombi() { app.kombiOpen = false; }

let saved: Inputs | null = null; // Stand des Speichers (zuletzt gelesen)
let dirty = false; // ungespeicherte Änderungen vorhanden
const changed = new Set<InputKey>(); // in diesem Tab seit dem letzten Speichern geänderte Schlüssel
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let toastId = 0;
let undoRev = 0; // zählt hoch, wenn offene „Rückgängig“-Aktionen ungültig werden

// ---------------------------------------------------------------- Hinweise (Toasts)

let toastTimer: ReturnType<typeof setTimeout> | undefined;
let toastMs: number | null = null; // verbleibende Anzeigedauer; null = bleibt stehen
let toastSince = 0;

// Zuletzt per Tastatur bedient? Dann bekommt die Aktion eines neuen Hinweises den Fokus (WCAG 2.1.1/2.2.1).
let keyboardUsed = false;
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => { if (e.key !== 'Escape') keyboardUsed = true; }, true);
  window.addEventListener('pointerdown', () => { keyboardUsed = false; }, true);
}

function armToast() {
  clearTimeout(toastTimer);
  if (toastMs === null) return;
  toastSince = Date.now();
  toastTimer = setTimeout(() => { app.toast = null; }, toastMs);
}

export function showToast(message: string, action?: ToastAction, opts: ToastOptions = {}) {
  clearTimeout(toastTimer);
  toastMs = opts.ms ?? (action ? null : 8000);
  app.toast = { id: ++toastId, message, action, focus: !!action && (opts.focus ?? keyboardUsed) };
  armToast();
}
export function hideToast() { clearTimeout(toastTimer); toastMs = null; app.toast = null; }
/** Während Maus oder Fokus auf dem Hinweis liegen, läuft die Zeit nicht weiter. */
export function pauseToast() {
  if (toastMs === null) return;
  clearTimeout(toastTimer);
  toastMs = Math.max(2000, toastMs - (Date.now() - toastSince));
}
export function resumeToast() { if (app.toast) armToast(); }

/** Offene „Rückgängig“-Aktionen verfallen (nächste Eingabe, Moduswechsel, neuer Link). */
function invalidateUndo() {
  undoRev++;
  if (app.toast?.action) hideToast();
}
function undoAction(label: string, run: () => void): ToastAction {
  const rev = undoRev;
  return { label, run: () => { if (rev !== undoRev) { hideToast(); return; } run(); hideToast(); } };
}

// ---------------------------------------------------------------- Speichern

function persistSoon() {
  if (app.mode !== 'own') return;
  dirty = true;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persistNow, 250);
}
function persistNow() {
  clearTimeout(saveTimer);
  if (app.mode !== 'own') return;
  dirty = false;
  const keys = [...changed];
  changed.clear();
  const snap = $state.snapshot(app.inputs) as Inputs;
  const ok = saveInputs(snap, keys);
  app.storageOk = ok;
  if (ok) saved = loadSaved();
}

/** Setzt die Eingaben und merkt sich, welche Schlüssel sich dadurch ändern (nur diese werden gespeichert). */
function replaceInputs(next: Inputs) {
  for (const k of INPUT_KEYS) if (app.inputs[k] !== next[k]) changed.add(k);
  app.inputs = { ...next };
}
function markAllChanged() { for (const k of INPUT_KEYS) changed.add(k); }

function cleanHash() {
  if (!location.hash) return;
  const url = location.pathname + location.search;
  try { history.replaceState(history.state, '', url); }
  catch { try { location.replace('#'); } catch { /* z. B. Sandbox */ } }
}

/** Liest Speicher und Link. Beim Start und bei `hashchange` aufgerufen. */
export function applyLocation(initial: boolean) {
  if (!initial) {
    if (dirty) persistNow(); // eine noch ausstehende Eingabe nicht verlieren (C21)
    invalidateUndo();
  }
  saved = loadSaved(); // frisch lesen: ein anderer Tab kann etwas geändert haben
  const d = decodeState(location.hash);
  if (d.tab) app.tab = d.tab;
  if (d.unsupported) {
    showToast('Dieser Link stammt aus einer neueren Version des Rechners und kann nicht geladen werden.');
    cleanHash();
  }
  if (!d.inputs) {
    if (initial) app.inputs = saved ? { ...saved } : { ...DEFAULTS };
    if (d.tab) cleanHash(); // reiner Tab-Link: Tab übernehmen, Adresszeile aufräumen
    return;
  }
  if (!saved || sameInputs(saved, d.inputs)) {
    app.mode = 'own';
    app.inputs = { ...d.inputs };
    markAllChanged();
    persistNow();
    cleanHash();
    if (!initial) showToast('Geteiltes Szenario geladen.');
    return;
  }
  app.mode = 'shared';
  app.inputs = { ...d.inputs };
}

/** Ein anderer Tab hat gespeichert: Stand neu lesen und, im eigenen Modus, in die Anzeige übernehmen. */
function onStorage(e: StorageEvent) {
  if (e.key !== null && e.key !== STORAGE_KEY) return;
  saved = loadSaved();
  if (app.mode !== 'own') return;
  const target = saved ?? DEFAULTS;
  const patch: Partial<Inputs> = {};
  for (const k of INPUT_KEYS) {
    if (changed.has(k) || app.inputs[k] === target[k]) continue; // eigene, noch nicht gespeicherte Änderung gewinnt
    (patch[k] as unknown) = target[k];
  }
  if (Object.keys(patch).length) Object.assign(app.inputs, patch);
}

export function init() {
  app.storageOk = storageAvailable();
  saved = loadSaved();
  applyLocation(true);
  window.addEventListener('hashchange', () => applyLocation(false));
  window.addEventListener('storage', onStorage);
  // Beim Verlassen sicher speichern (falls der Debounce noch läuft)
  window.addEventListener('pagehide', () => { if (dirty) persistNow(); });
}

// ---------------------------------------------------------------- Eingaben

export function setInput<K extends InputKey>(key: K, value: Inputs[K]) {
  invalidateUndo();
  app.inputs[key] = value;
  changed.add(key);
  // Der gemeinsame Monatsbeitrag setzt alle Produktbeiträge (wie im Original).
  if (key === 'setAll') for (const k of CONTRIB_KEYS) { app.inputs[k] = value as number; changed.add(k); }
  persistSoon();
}

export function setInputs(patch: Partial<Inputs>) {
  invalidateUndo();
  Object.assign(app.inputs, patch);
  for (const k of Object.keys(patch) as InputKey[]) changed.add(k);
  persistSoon();
}

export function adoptShared() {
  invalidateUndo();
  const previous = loadSaved();
  app.mode = 'own';
  markAllChanged();
  persistNow();
  cleanHash();
  showToast('Szenario übernommen und gespeichert.', previous ? undoAction('Rückgängig', () => {
    replaceInputs(previous);
    persistNow();
  }) : undefined);
}

export function leaveShared() {
  invalidateUndo();
  saved = loadSaved();
  app.mode = 'own';
  app.inputs = saved ? { ...saved } : { ...DEFAULTS };
  changed.clear();
  cleanHash();
  showToast('Zurück bei deinen gespeicherten Eingaben.');
}

export function resetToDefaults() {
  invalidateUndo();
  const before = $state.snapshot(app.inputs) as Inputs;
  if (sameInputs(before, DEFAULTS)) { showToast('Es sind bereits die Standardwerte eingestellt.', undefined, { ms: 4000 }); return; }
  replaceInputs(DEFAULTS);
  persistNow();
  showToast(app.mode === 'shared' ? 'Ansicht auf Standardwerte zurückgesetzt (nicht gespeichert).' : 'Auf Standardwerte zurückgesetzt.',
    undoAction('Rückgängig', () => { replaceInputs(before); persistNow(); }));
}

export function forgetSaved() {
  invalidateUndo();
  clearTimeout(saveTimer);
  dirty = false;
  changed.clear();
  if (!storageAvailable()) {
    // Es gibt nichts zu löschen und nichts zu verlieren: Anzeige unverändert lassen.
    app.storageOk = false;
    showToast('In diesem Browser ist kein Speicher verfügbar, daher ist auch nichts gespeichert. Deine Eingaben bleiben auf dem Bildschirm.', undefined, { ms: 8000 });
    return;
  }
  const had = loadSaved();
  const before = $state.snapshot(app.inputs) as Inputs;
  const wasOwn = app.mode === 'own';
  clearSaved();
  saved = null;
  if (wasOwn) app.inputs = { ...DEFAULTS };
  // Ohne erneute Änderung wird nichts gespeichert; persistSoon greift erst bei der nächsten Eingabe.
  if (!had) { showToast('Es war nichts gespeichert.', undefined, { ms: 5000 }); return; }
  showToast('Gespeicherte Eingaben aus diesem Browser gelöscht.', undoAction('Rückgängig', () => {
    if (saveInputs(had)) saved = loadSaved();
    else app.storageOk = false;
    if (wasOwn) app.inputs = before;
  }));
}

export function shareUrl(): string {
  const base = location.href.split('#')[0];
  return base + '#' + encodeState($state.snapshot(app.inputs) as Inputs, app.tab);
}

// ---------------------------------------------------------------- Navigation

export function setTab(t: Tab) { app.tab = t; }

/**
 * Wechselt den Tab und setzt den Fokus auf das Feld mit der ID `id` (z. B. `f-kids`): erst nach dem
 * Rendern, scrollt es in die Mitte (ohne Animation bei „weniger Bewegung“) und fokussiert es.
 * Ist es kein Eingabeelement, geht der Fokus an das erste Bedienelement darin.
 */
export async function focusField(tab: Tab, id: string) {
  app.tab = tab;
  await tick();
  let el: HTMLElement | null = null;
  for (let n = 0; n < 12 && !(el && el.offsetParent !== null); n++) {
    el = document.getElementById(id);
    if (!el || el.offsetParent === null) await new Promise<void>(r => requestAnimationFrame(() => r()));
  }
  if (!el) return;
  const target = el.matches('input, select, textarea, button, [tabindex]') ? el : el.querySelector<HTMLElement>('input, select, textarea, button, [tabindex]') ?? el;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  target.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
  target.focus({ preventScroll: true });
}
