<script lang="ts" module>
  let seq = 0;
</script>

<script lang="ts">
  // Erklärung zu einem Fachbegriff als Popover (Popover-API: Tastatur, Esc und Klick daneben schließen).
  // Ohne children: kleines „?“-Symbol. Mit children: unterstrichener Begriff im Fließtext.
  // Fallback ohne Popover-API (Safari < 17, Chrome < 114, Firefox < 125): Klick schaltet die Klasse
  // `fb-open` um; Esc, Klick daneben, Scrollen und Drehen schließen wie beim echten Popover.
  import type { Snippet } from 'svelte';
  import { GLOSSARY, type GlossaryKey } from '../glossary';

  let { k, children }: { k: GlossaryKey; children?: Snippet } = $props();
  const id = `info-${++seq}`;
  const entry = $derived(GLOSSARY[k]);
  let btn = $state<HTMLButtonElement>();
  let pop = $state<HTMLDivElement>();
  let open = $state(false);
  let fallback = false; // aktuell per Klassen-Toggle geöffnet
  let closeListeners: AbortController | undefined;

  // Ohne Popover-API oder ohne `popover`-Attribut ist die Schaltfläche allein zuständig.
  const native = () => !!pop && pop.hasAttribute('popover') && typeof pop.showPopover === 'function';

  function place() {
    if (!btn || !pop) return;
    const r = btn.getBoundingClientRect();
    const vw = document.documentElement.clientWidth, vh = window.innerHeight;
    const w = Math.min(340, vw - 16);
    pop.style.width = w + 'px';
    pop.style.maxHeight = Math.max(80, vh - 16) + 'px';
    const left = Math.min(Math.max(8, r.left + r.width / 2 - 40), vw - w - 8);
    pop.style.left = left + 'px';
    const h = pop.offsetHeight;
    const below = r.bottom + 8;
    pop.style.top = (below + h > vh - 8 && r.top - h - 8 > 8 ? r.top - h - 8 : Math.max(8, Math.min(below, vh - 8 - h))) + 'px';
    pop.classList.add('placed'); // erst jetzt sichtbar (Chromium malt sonst einen Frame an 0,0)
  }

  function closeFallback() {
    if (!fallback) return;
    fallback = false;
    pop?.classList.remove('fb-open');
    onClosed();
  }
  function onClosed() {
    open = false;
    closeListeners?.abort(); closeListeners = undefined;
    pop?.classList.remove('placed');
  }
  function onOpened() {
    open = true;
    place();
    closeListeners?.abort();
    const ac = closeListeners = new AbortController();
    const { signal } = ac;
    const close = () => { if (fallback) closeFallback(); else { try { pop?.hidePopover(); } catch { /* schon zu */ } } };
    // Schließen nur bei echter Bewegung: Die Bildschirmtastatur oder die einklappende Adressleiste
    // ändern nur die Höhe; ein Fingerwackeln scrollt ein paar Pixel.
    const w0 = window.innerWidth, y0 = window.scrollY;
    window.addEventListener('scroll', () => { if (Math.abs(window.scrollY - y0) > 10) close(); }, { passive: true, signal });
    window.addEventListener('resize', () => { if (window.innerWidth !== w0) close(); }, { signal });
    if (fallback) {
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { close(); btn?.focus(); } }, { signal });
      document.addEventListener('pointerdown', (e) => {
        const t = e.target as Node;
        if (!pop?.contains(t) && !btn?.contains(t)) close();
      }, { signal });
    }
  }

  function onToggle(e: Event) {
    if ((e as ToggleEvent).newState === 'open') onOpened(); else onClosed();
  }
  function onBtnClick() {
    if (native()) return; // das popovertarget-Attribut erledigt das
    if (fallback) { closeFallback(); return; }
    fallback = true;
    pop?.classList.add('fb-open');
    onOpened();
  }
  $effect(() => () => closeListeners?.abort());
</script>

{#if children}
  <button bind:this={btn} type="button" class="term" popovertarget={id} aria-expanded={open} aria-controls={id} onclick={onBtnClick}
    >{@render children()}</button
  >
{:else}
  <button bind:this={btn} type="button" class="q" popovertarget={id} aria-expanded={open} aria-controls={id}
    aria-label={'Erklärung: ' + entry.title} onclick={onBtnClick}>?</button>
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
    visibility: hidden; max-height: calc(100vh - 16px); max-height: calc(100dvh - 16px); overflow-y: auto; overscroll-behavior: contain;
    background: var(--surface); color: var(--text); border: 1px solid var(--border-strong);
    border-radius: 12px; box-shadow: var(--shadow-pop); font-size: .875rem; line-height: 1.5;
    text-align: left; white-space: normal; font-weight: 400; text-transform: none; letter-spacing: 0;
  }
  .pop:global(.placed) { visibility: visible; }
  /* Ohne Popover-API (oder ohne Attribut) ist das Feld standardmäßig zu und öffnet per Klassen-Toggle */
  .pop:not([popover]) { display: none; }
  @supports not selector(:popover-open) { .pop { display: none; } }
  .pop:global(.fb-open) { display: block; }
  .pop strong { display: block; margin-bottom: 4px; font-size: .9rem; }
  .pop p { margin: 0 0 6px; color: var(--text-2); }
  .pop p:last-child { margin-bottom: 0; }
  @media print { .q { display: none; } .term { text-decoration: none; } }
</style>
