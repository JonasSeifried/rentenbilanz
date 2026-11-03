<script lang="ts" module>
  let seq = 0;

  /** Deutsche Zahleneingabe: „38.000“, „38000“, „0,2“ und „0.2“ sind erlaubt. Ungültig → null. */
  export function parseDe(raw: string): number | null {
    let s = raw.trim().replace(/[\s €%]/g, '').replace(/[−–]/g, '-');
    if (!s) return null;
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    if (!/^-?(\d+\.?\d*|\.\d+)$/.test(s)) return null;
    const x = Number(s);
    return isFinite(x) ? x : null;
  }

  export function formatDe(x: number, maxDigits = 2): string {
    return x.toLocaleString('de-DE', { maximumFractionDigits: maxDigits, useGrouping: Math.abs(x) >= 10000 });
  }
</script>

<script lang="ts">
  import type { GlossaryKey } from '../glossary';
  import Info from './Info.svelte';

  interface Props {
    label: string;
    value: number;
    onchange: (v: number) => void;
    unit?: string;
    step?: number;
    min?: number;
    max?: number;
    /** Hinweis, wenn die Rechnung den Wert begrenzt (z. B. „Gerechnet wird mit 65.“) */
    clampNote?: (v: number) => string | null;
    info?: GlossaryKey;
    hint?: string;
    layout?: 'stack' | 'row';
    testid?: string;
  }
  let { label, value, onchange, unit = '', step = 1, min, max, clampNote, info, hint, layout = 'stack', testid }: Props = $props();

  const id = `nf-${++seq}`;
  let text = $state('');
  let focused = $state(false);
  let invalid = $state(false);

  // Externe Änderungen (Zurücksetzen, Link, gemeinsamer Beitrag) übernehmen, solange nicht getippt wird.
  $effect(() => {
    const v = value;
    if (!focused) { text = formatDe(v); invalid = false; }
  });

  const allowNegative = $derived(min === undefined || min < 0);
  const note = $derived(clampNote ? clampNote(value) : null);
  const describedBy = $derived([hint ? id + '-h' : '', note || invalid ? id + '-n' : ''].filter(Boolean).join(' ') || undefined);

  function commit(raw: string) {
    const x = parseDe(raw);
    invalid = x === null;
    if (x !== null && x !== value) onchange(x);
  }
  function onkeydown(e: KeyboardEvent) {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    const cur = parseDe(text) ?? value;
    let next = cur + (e.key === 'ArrowUp' ? step : -step) * (e.shiftKey ? 10 : 1);
    next = Math.round(next * 1000) / 1000;
    if (min !== undefined) next = Math.max(min, next);
    if (max !== undefined) next = Math.min(max, next);
    text = formatDe(next);
    commit(text);
  }
</script>

<div class="field {layout}">
  <div class="lab">
    <label for={id}>{label}</label>
    {#if info}<Info k={info} />{/if}
  </div>
  <div class="ctl" class:invalid>
    <input
      {id}
      type="text"
      inputmode={allowNegative ? 'text' : 'decimal'}
      autocomplete="off"
      spellcheck="false"
      value={text}
      aria-invalid={invalid}
      aria-describedby={describedBy}
      data-testid={testid}
      oninput={(e) => { text = e.currentTarget.value; commit(text); }}
      onfocus={() => { focused = true; }}
      onblur={() => { focused = false; if (!invalid) text = formatDe(value); }}
      {onkeydown}
    />
    {#if unit}<span class="unit" aria-hidden="true">{unit}</span>{/if}
  </div>
  {#if invalid}
    <p class="msg err" id={id + '-n'}>Bitte eine Zahl eingeben.</p>
  {:else if note}
    <p class="msg" id={id + '-n'}>{note}</p>
  {/if}
  {#if hint}<p class="msg hint-text" id={id + '-h'}>{hint}</p>{/if}
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

  .row { display: grid; grid-template-columns: 1fr minmax(96px, 120px); gap: 2px 12px; align-items: center; padding: 6px 0; }
  .row .lab { margin: 0; }
  .row .msg { grid-column: 1 / -1; }

  @media (max-width: 640px) {
    input { font-size: 16px; padding: 9px 10px; } /* 16px verhindert Zoom auf iOS */
  }
  @media print {
    .ctl { border-color: transparent; }
    input { padding: 2px 0; }
  }
</style>
