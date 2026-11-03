<script lang="ts" module>
  let seq = 0;
</script>

<script lang="ts">
  import { untrack } from 'svelte';
  import type { GlossaryKey } from '../glossary';
  import Info from './Info.svelte';
  import Icon from './Icon.svelte';
  import { formatDe, parseDe } from '../number';

  interface Props {
    label: string;
    value: number;
    onchange: (v: number) => void;
    unit?: string;
    step?: number;
    min?: number;
    max?: number;
    /** Hinweis, wenn die Rechnung den Wert begrenzt (z. B. „Gerechnet wird mit 65.“). Neu: lieber `effective`. */
    clampNote?: (v: number) => string | null;
    /** Wert, mit dem tatsächlich gerechnet wird; weicht er vom Feldwert ab, steht „Gerechnet wird mit X.“ da. */
    effective?: number;
    info?: GlossaryKey;
    hint?: string;
    layout?: 'stack' | 'row';
    testid?: string;
    /** Stabile ID des Eingabefelds (z. B. `f-kids`) für Direktlinks (`focusField`). */
    id?: string;
    disabled?: boolean;
    /**
     * Punkt mit genau drei Ziffern als Tausendertrenner lesen. Standard: ja, wenn `step >= 1000` oder die
     * obere Grenze (`max`/`limits`) über 100 liegt und der Schritt ≥ 1 ist. Prozentfelder („0.125“) lesen
     * einen einzelnen Punkt als Dezimaltrenner.
     */
    allowThousands?: boolean;
    /** Plausibilitätsgrenzen: getippte Werte außerhalb werden nicht übernommen und erklärt. */
    limits?: readonly [number, number];
    /** Blur/Enter ruft `onchange` auch bei unverändertem Wert auf, aber nur nach einer Eingabe im Feld. */
    alwaysCommit?: boolean;
    /** 44-px-Buttons − und + neben dem Feld (Schritt = `step`, langer Druck = 5·step). */
    stepper?: boolean;
    placeholder?: string;
  }
  let {
    label, value, onchange, unit = '', step = 1, min, max, clampNote, effective, info, hint, layout = 'stack', testid,
    id: idProp, disabled = false, allowThousands, limits, alwaysCommit = false, stepper = false, placeholder,
  }: Props = $props();

  const uid = `nf-${++seq}`;
  const id = $derived(idProp ?? uid);
  let text = $state('');
  let focused = $state(false);
  let input = $state<HTMLInputElement>();
  /** '' = alles gut; sonst die Fehlermeldung (bleibt stehen, bis der Text korrigiert oder mit Esc verworfen ist) */
  let error = $state('');
  let edited = false; // seit dem Fokus getippt?

  const hi = $derived(Math.min(max ?? Infinity, limits ? limits[1] : Infinity));
  const thousands = $derived(allowThousands ?? (step >= 1000 || (step >= 1 && !(hi <= 100))));
  const parse = (raw: string) => parseDe(raw, { allowThousands: thousands });
  const allowNegative = $derived((min === undefined || min < 0) && (limits === undefined || limits[0] < 0));

  // Externe Änderungen (Zurücksetzen, Link, anderer Tab, gemeinsamer Beitrag) übernehmen, solange nicht getippt wird.
  $effect(() => {
    const v = value;
    untrack(() => { if (!focused) { text = formatDe(v); error = ''; } });
  });

  const fmtLimit = (v: number) => v.toLocaleString('de-DE', { maximumFractionDigits: 6 });
  const note = $derived.by(() => {
    if (clampNote) { const n = clampNote(value); if (n) return n; }
    if (effective !== undefined && isFinite(effective) && effective !== value) return 'Gerechnet wird mit ' + formatDe(effective) + '.';
    return null;
  });
  const describedBy = $derived([
    hint ? id + '-h' : '', unit ? id + '-u' : '', !error && note ? id + '-n' : '', error ? id + '-e' : '',
  ].filter(Boolean).join(' ') || undefined);

  function errorFor(raw: string): string {
    const x = parse(raw);
    if (x === null) return 'Bitte eine Zahl eingeben.';
    if (limits && (x < limits[0] || x > limits[1])) return `Bitte einen Wert zwischen ${fmtLimit(limits[0])} und ${fmtLimit(limits[1])} eingeben.`;
    return '';
  }

  /** Versucht, den Text zu übernehmen. Gibt true zurück, wenn er gültig ist. */
  function commit(raw: string, force = false): boolean {
    const x = parse(raw);
    const e = errorFor(raw);
    if (e) { error = e; return false; }
    error = '';
    if (x !== null && (x !== value || force)) onchange(x);
    return true;
  }

  function oninput(e: Event & { currentTarget: HTMLInputElement }) {
    text = e.currentTarget.value;
    edited = true;
    // Leer = „ausstehend“: erst beim Verlassen des Feldes ein Fehler, damit beim Ersetzen nichts aufblitzt.
    if (!text.trim()) { error = ''; return; }
    commit(text);
  }
  function onblur() {
    focused = false;
    if (!text.trim()) { error = 'Bitte eine Zahl eingeben.'; edited = false; return; } // Text bleibt leer stehen
    if (!error) {
      if (edited && alwaysCommit) commit(text, true);
      text = formatDe(value);
    }
    edited = false;
  }
  function cancel() { text = formatDe(value); error = ''; edited = false; }

  function stepBy(dir: 1 | -1, times = 1) {
    const raw = text.trim() ? parse(text) : null;
    const cur = raw ?? value;
    let next = cur + dir * step * times;
    next = Math.round(next * 1000) / 1000;
    if (min !== undefined) next = Math.max(min, next);
    if (max !== undefined) next = Math.min(max, next);
    if (limits) next = Math.min(limits[1], Math.max(limits[0], next));
    text = formatDe(next);
    error = '';
    edited = true;
    if (next !== value || alwaysCommit) onchange(next);
  }
  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      stepBy(e.key === 'ArrowUp' ? 1 : -1, e.shiftKey ? 10 : 1);
    } else if (e.key === 'Enter') {
      if (!error && text.trim() && edited && alwaysCommit) { commit(text, true); text = formatDe(value); edited = false; }
    } else if (e.key === 'Escape' && (error || edited) && text !== formatDe(value)) {
      e.preventDefault(); e.stopPropagation(); cancel();
    }
  }

  // ±-Button (iOS-Dezimaltastatur hat kein Minus): kehrt das Vorzeichen des Textes um.
  function flipSign() {
    const t = text.trim();
    if (!t) return;
    text = t.startsWith('-') || t.startsWith('−') ? t.slice(1) : '-' + t;
    edited = true;
    commit(text);
    input?.focus();
  }

  // Stepper: Antippen = ein Schritt, gehaltener Druck = wiederholt 5·step.
  let holdTimer: ReturnType<typeof setTimeout> | undefined;
  let holdRepeat: ReturnType<typeof setInterval> | undefined;
  let held = false;
  function holdStart(dir: 1 | -1) {
    held = false;
    clearTimeout(holdTimer);
    holdTimer = setTimeout(() => {
      held = true;
      stepBy(dir, 5);
      holdRepeat = setInterval(() => stepBy(dir, 5), 220);
    }, 450);
  }
  function holdEnd(dir: 1 | -1, fire: boolean) {
    clearTimeout(holdTimer); clearInterval(holdRepeat);
    if (fire && !held) stepBy(dir);
  }
  // Tastatur/Screenreader (click ohne Zeiger) bekommt genau einen Schritt.
  function stepClick(e: MouseEvent, dir: 1 | -1) { if (e.detail === 0) stepBy(dir); }
  $effect(() => () => { clearTimeout(holdTimer); clearInterval(holdRepeat); });
</script>

<div class="field {layout}" class:disabled>
  <div class="lab">
    <label for={id}>{label}</label>
    {#if info}<Info k={info} />{/if}
  </div>
  <div class="ctl" class:invalid={!!error} class:withstep={stepper}>
    {#if stepper}
      <button type="button" class="st" tabindex="-1" {disabled} aria-label="{label} verringern"
        onpointerdown={() => holdStart(-1)} onpointerup={() => holdEnd(-1, true)}
        onpointerleave={() => holdEnd(-1, false)} onpointercancel={() => holdEnd(-1, false)}
        onclick={(e) => stepClick(e, -1)} oncontextmenu={(e) => e.preventDefault()}><Icon name="minus" size={18} /></button>
    {/if}
    {#if allowNegative && !stepper}
      <button type="button" class="pm" tabindex="-1" {disabled} aria-label="{label}: Vorzeichen wechseln"
        onpointerdown={(e) => e.preventDefault()} onclick={flipSign}>±</button>
    {/if}
    <input
      bind:this={input}
      {id}
      type="text"
      inputmode="decimal"
      autocomplete="off"
      spellcheck="false"
      {disabled}
      {placeholder}
      value={text}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy}
      data-testid={testid}
      {oninput}
      onfocus={() => { focused = true; }}
      {onblur}
      {onkeydown}
    />
    {#if unit}<span class="unit" id={id + '-u'}>{unit}</span>{/if}
    {#if stepper}
      <button type="button" class="st" tabindex="-1" {disabled} aria-label="{label} erhöhen"
        onpointerdown={() => holdStart(1)} onpointerup={() => holdEnd(1, true)}
        onpointerleave={() => holdEnd(1, false)} onpointercancel={() => holdEnd(1, false)}
        onclick={(e) => stepClick(e, 1)} oncontextmenu={(e) => e.preventDefault()}><Icon name="plus" size={18} /></button>
    {/if}
  </div>
  <!-- Die Live-Region ist immer da, damit Screenreader den Fehlertext beim Auftauchen ansagen (C19) -->
  <div class="live" aria-live="polite" aria-atomic="true">
    {#if error}<p class="msg err" id={id + '-e'}>{error}</p>{/if}
  </div>
  {#if !error && note}<p class="msg" id={id + '-n'}>{note}</p>{/if}
  {#if hint}<p class="msg" id={id + '-h'}>{hint}</p>{/if}
</div>

<style>
  .field { min-width: 0; }
  .lab { display: flex; align-items: center; gap: 4px; margin-bottom: 5px; min-height: 18px; }
  label { font-size: .82rem; color: var(--text-2); line-height: 1.3; }
  .ctl {
    position: relative; display: flex; align-items: center;
    background: var(--surface); border: 1px solid var(--border-strong); border-radius: var(--radius-sm);
    transition: border-color .12s, box-shadow .12s;
  }
  .ctl:hover { border-color: var(--text-2); }
  .ctl:focus-within { border-color: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 22%, transparent); }
  .ctl.invalid { border-color: #d03b3b; }
  input {
    flex: 1; min-width: 0; width: 100%; border: 0; background: transparent; color: var(--text);
    font: inherit; font-size: .95rem; font-variant-numeric: tabular-nums; text-align: right;
    padding: 7px 10px; outline: none; border-radius: var(--radius-sm);
  }
  .unit { padding-right: 10px; color: var(--muted); font-size: .85rem; white-space: nowrap; pointer-events: none; }
  .msg { margin: 4px 0 0; font-size: .78rem; color: var(--muted); line-height: 1.4; }
  .msg.err { color: #d03b3b; }
  .live:empty { display: none; }
  .field.disabled .ctl { opacity: .55; background: var(--surface-2); }
  .field.disabled .ctl:hover { border-color: var(--border-strong); }
  input:disabled { cursor: not-allowed; }

  /* ± nur auf Touch-Geräten (dort fehlt das Minus auf der Dezimaltastatur) */
  .pm {
    display: none; flex: none; align-items: center; justify-content: center; align-self: stretch;
    min-width: 44px; padding: 0; margin: 0; border: 0; border-right: 1px solid var(--border);
    border-radius: var(--radius-sm) 0 0 var(--radius-sm); background: var(--surface-2); color: var(--text-2);
    font: 600 1.05rem/1 var(--font); cursor: pointer;
  }
  @media (pointer: coarse) { .pm { display: inline-flex; } }
  .st {
    display: inline-grid; place-items: center; flex: none; align-self: stretch;
    width: 44px; min-height: 44px; padding: 0; margin: 0; border: 0; background: var(--surface-2); color: var(--text);
    cursor: pointer; touch-action: manipulation; user-select: none; -webkit-user-select: none;
  }
  .st:first-child { border-right: 1px solid var(--border); border-radius: var(--radius-sm) 0 0 var(--radius-sm); }
  .st:last-child { border-left: 1px solid var(--border); border-radius: 0 var(--radius-sm) var(--radius-sm) 0; }
  .st:hover:not(:disabled) { background: var(--surface-3); }
  .st:active:not(:disabled) { background: var(--accent-soft); }
  .st:disabled { cursor: not-allowed; }
  .withstep input { text-align: center; }

  .row { display: grid; grid-template-columns: 1fr minmax(96px, 120px); gap: 2px 12px; align-items: center; padding: 6px 0; }
  .row .lab { margin: 0; }
  .row .msg, .row .live { grid-column: 1 / -1; }

  @media (max-width: 640px) {
    input { font-size: 16px; padding: 9px 10px; } /* 16px verhindert Zoom auf iOS */
  }
  @media (forced-colors: active) {
    .ctl { border: 1px solid CanvasText; }
    .ctl.invalid { border-width: 2px; }
    .st, .pm { border-color: CanvasText; }
  }
  @media print {
    .ctl { border-color: transparent; }
    .st, .pm { display: none; }
    input { padding: 2px 0; }
    .unit { padding-left: 4px; }
  }
</style>
