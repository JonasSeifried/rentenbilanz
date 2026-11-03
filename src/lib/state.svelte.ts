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
import { CONTRIB_KEYS, DEFAULTS, type InputKey, type Inputs } from './engine/inputs';
import { decodeState, encodeState, sameInputs, type Tab } from './link';
import { clearSaved, loadSaved, saveInputs, storageAvailable } from './storage';

export interface Toast { id: number; message: string; action?: { label: string; run: () => void } }

export const app = $state({
  inputs: { ...DEFAULTS } as Inputs,
  tab: 'overview' as Tab,
  mode: 'own' as 'own' | 'shared',
  storageOk: true,
  toast: null as Toast | null,
});

let saved: Inputs | null = null;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let toastTimer: ReturnType<typeof setTimeout> | undefined;
let toastId = 0;

export function showToast(message: string, action?: Toast['action'], ms = 8000) {
  clearTimeout(toastTimer);
  app.toast = { id: ++toastId, message, action };
  toastTimer = setTimeout(() => { app.toast = null; }, ms);
}
export function hideToast() { clearTimeout(toastTimer); app.toast = null; }

function persistSoon() {
  if (app.mode !== 'own') return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persistNow, 250);
}
function persistNow() {
  clearTimeout(saveTimer);
  if (app.mode !== 'own') return;
  const snap = $state.snapshot(app.inputs) as Inputs;
  if (saveInputs(snap)) saved = snap;
}

function cleanHash() {
  if (!location.hash) return;
  const url = location.pathname + location.search;
  try { history.replaceState(history.state, '', url); }
  catch { try { location.replace('#'); } catch { /* z. B. Sandbox */ } }
}

/** Liest Speicher und Link. Beim Start und bei `hashchange` aufgerufen. */
export function applyLocation(initial: boolean) {
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
    persistNow();
    cleanHash();
    if (!initial) showToast('Geteiltes Szenario geladen.');
    return;
  }
  app.mode = 'shared';
  app.inputs = { ...d.inputs };
}

export function init() {
  app.storageOk = storageAvailable();
  saved = loadSaved();
  applyLocation(true);
  window.addEventListener('hashchange', () => applyLocation(false));
  // Beim Verlassen sicher speichern (falls der Debounce noch läuft)
  window.addEventListener('pagehide', persistNow);
}

export function setInput<K extends InputKey>(key: K, value: Inputs[K]) {
  app.inputs[key] = value;
  // Der gemeinsame Monatsbeitrag setzt alle Produktbeiträge (wie im Original).
  if (key === 'setAll') for (const k of CONTRIB_KEYS) app.inputs[k] = value as number;
  persistSoon();
}

export function setInputs(patch: Partial<Inputs>) {
  Object.assign(app.inputs, patch);
  persistSoon();
}

export function adoptShared() {
  const previous = saved ? { ...saved } : null;
  app.mode = 'own';
  persistNow();
  cleanHash();
  showToast('Szenario übernommen und gespeichert.', previous ? {
    label: 'Rückgängig',
    run: () => { app.inputs = previous; persistNow(); hideToast(); },
  } : undefined);
}

export function leaveShared() {
  app.mode = 'own';
  app.inputs = saved ? { ...saved } : { ...DEFAULTS };
  cleanHash();
  showToast('Zurück bei deinen gespeicherten Eingaben.');
}

export function resetToDefaults() {
  const before = $state.snapshot(app.inputs) as Inputs;
  if (sameInputs(before, DEFAULTS)) { showToast('Es sind bereits die Standardwerte eingestellt.', undefined, 4000); return; }
  app.inputs = { ...DEFAULTS };
  persistNow();
  showToast(app.mode === 'shared' ? 'Ansicht auf Standardwerte zurückgesetzt (nicht gespeichert).' : 'Auf Standardwerte zurückgesetzt.', {
    label: 'Rückgängig',
    run: () => { app.inputs = before; persistNow(); hideToast(); },
  });
}

export function forgetSaved() {
  clearSaved();
  saved = null;
  if (app.mode === 'own') { app.inputs = { ...DEFAULTS }; }
  showToast('Gespeicherte Eingaben aus diesem Browser gelöscht.', undefined, 5000);
  // Ohne erneute Änderung wird nichts gespeichert; persistSoon greift erst bei der nächsten Eingabe.
}

export function shareUrl(): string {
  const base = location.href.split('#')[0];
  return base + '#' + encodeState($state.snapshot(app.inputs) as Inputs, app.tab);
}

export function setTab(t: Tab) { app.tab = t; }
