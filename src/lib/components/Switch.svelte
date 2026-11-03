<script lang="ts" module>
  let seq = 0;
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { GlossaryKey } from '../glossary';
  import Info from './Info.svelte';

  interface Props {
    checked: boolean;
    onchange: (v: boolean) => void;
    label?: string;
    children?: Snippet;
    info?: GlossaryKey;
    hint?: string;
    testid?: string;
    /** Stabile ID des Schalters (z. B. `f-study`) für Direktlinks (`focusField`). */
    id?: string;
    disabled?: boolean;
  }
  let { checked, onchange, label, children, info, hint, testid, id: idProp, disabled = false }: Props = $props();
  const uid = `sw-${++seq}`;
  const id = $derived(idProp ?? uid);
</script>

<div class="sw">
  <input {id} type="checkbox" role="switch" {checked} {disabled} data-testid={testid}
    aria-describedby={hint ? id + '-h' : undefined}
    onchange={(e) => onchange(e.currentTarget.checked)} />
  <label for={id}>{#if children}{@render children()}{:else}{label}{/if}</label>
  {#if info}<Info k={info} />{/if}
  {#if hint}<p class="msg" id={id + '-h'}>{hint}</p>{/if}
</div>

<style>
  .sw { display: flex; align-items: center; gap: 4px 10px; flex-wrap: wrap; padding: 6px 0; }
  label { flex: 1; min-width: 0; font-size: .9rem; color: var(--text); cursor: pointer; line-height: 1.35; }
  input {
    appearance: none; -webkit-appearance: none; flex: none; margin: 0; cursor: pointer;
    width: 36px; height: 22px; border-radius: 999px; position: relative;
    background: var(--surface-3); border: 1px solid var(--border-strong);
    transition: background-color .15s, border-color .15s;
  }
  input::before {
    content: ''; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%;
    background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,.25); transition: transform .15s;
  }
  input:checked { background: var(--accent); border-color: var(--accent); }
  input:checked::before { transform: translateX(14px); }
  input:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  input:disabled { opacity: .5; cursor: not-allowed; }
  .sw:has(input:disabled) label { color: var(--muted); cursor: not-allowed; }
  .msg { flex-basis: 100%; margin: 0 0 0 46px; font-size: .78rem; color: var(--muted); line-height: 1.4; }
  /* Windows-Kontrastmodus: Hintergründe werden ersetzt. Zustand über Systemfarben, Daumen über Position */
  @media (forced-colors: active) {
    input { forced-color-adjust: none; background: Canvas; border: 2px solid ButtonText; }
    input::before { background: ButtonText; box-shadow: none; top: 1px; left: 1px; }
    input:checked { background: Highlight; border-color: Highlight; }
    input:checked::before { background: HighlightText; }
    input:disabled { border-color: GrayText; }
    input:disabled::before { background: GrayText; }
    input:focus-visible { outline-color: Highlight; }
  }
  @media print { input { width: 28px; height: 16px; } input::before { width: 10px; height: 10px; } input:checked::before { transform: translateX(12px); } }
</style>
