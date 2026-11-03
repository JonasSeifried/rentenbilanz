<script lang="ts" module>
  let seq = 0;
</script>

<script lang="ts">
  // Erklärung zu einem Fachbegriff als Popover (Popover-API: Tastatur, Esc und Klick daneben schließen).
  // Ohne children: kleines „?“-Symbol. Mit children: unterstrichener Begriff im Fließtext.
  import type { Snippet } from 'svelte';
  import { GLOSSARY, type GlossaryKey } from '../glossary';

  let { k, children }: { k: GlossaryKey; children?: Snippet } = $props();
  const id = `info-${++seq}`;
  const entry = $derived(GLOSSARY[k]);
  let btn = $state<HTMLButtonElement>();
  let pop = $state<HTMLDivElement>();
  let open = $state(false);

  function place() {
    if (!btn || !pop) return;
    const r = btn.getBoundingClientRect();
    const vw = document.documentElement.clientWidth, vh = window.innerHeight;
    const w = Math.min(340, vw - 16);
    pop.style.width = w + 'px';
    const left = Math.min(Math.max(8, r.left + r.width / 2 - 40), vw - w - 8);
    pop.style.left = left + 'px';
    const h = pop.offsetHeight;
    const below = r.bottom + 8;
    pop.style.top = (below + h > vh - 8 && r.top - h - 8 > 8 ? r.top - h - 8 : below) + 'px';
  }

  function onToggle(e: Event) {
    open = (e as ToggleEvent).newState === 'open';
    if (open) {
      place();
      const close = () => { try { pop?.hidePopover(); } catch { /* schon zu */ } };
      window.addEventListener('scroll', close, { once: true, passive: true });
      window.addEventListener('resize', close, { once: true });
    }
  }
</script>

{#if children}
  <button bind:this={btn} type="button" class="term" popovertarget={id} aria-expanded={open} aria-controls={id}
    >{@render children()}</button
  >
{:else}
  <button bind:this={btn} type="button" class="q" popovertarget={id} aria-expanded={open} aria-controls={id}
    aria-label={'Erklärung: ' + entry.title}>?</button>
{/if}
<div bind:this={pop} {id} popover="auto" class="pop" role="note" ontoggle={onToggle}>
  <strong>{entry.title}</strong>
  {#each entry.text as t}<p>{t}</p>{/each}
</div>

<style>
  .q {
    display: inline-grid; place-items: center; flex: none;
    width: 18px; height: 18px; padding: 0; margin: 0 0 0 2px; vertical-align: -3px;
    border-radius: 50%; border: 1px solid var(--border-strong); background: transparent;
    color: var(--text-2); font: 600 11px/1 var(--font); cursor: pointer; position: relative;
  }
  .q::after { content: ''; position: absolute; inset: -12px; } /* größere Trefferfläche */
  .q:hover, .q[aria-expanded='true'] { background: var(--accent); border-color: var(--accent); color: var(--on-accent); }
  .term {
    font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: help;
    text-decoration: underline dotted var(--text-2); text-underline-offset: 3px; text-decoration-thickness: 1.5px;
  }
  .term:hover { text-decoration-color: var(--accent); }
  .pop {
    position: fixed; inset: auto; margin: 0; padding: 12px 14px;
    background: var(--surface); color: var(--text); border: 1px solid var(--border-strong);
    border-radius: 12px; box-shadow: var(--shadow-pop); font-size: .875rem; line-height: 1.5;
    text-align: left; white-space: normal; font-weight: 400; text-transform: none; letter-spacing: 0;
  }
  .pop strong { display: block; margin-bottom: 4px; font-size: .9rem; }
  .pop p { margin: 0 0 6px; color: var(--text-2); }
  .pop p:last-child { margin-bottom: 0; }
  @media print { .q { display: none; } .term { text-decoration: none; } }
</style>
