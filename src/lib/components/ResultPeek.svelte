<script lang="ts">
  // Mobile Ergebnisleiste (U1): Unter 640 px erscheint unten eine kurze Zeile mit dem Ergebnis, solange die
  // Eingaben (`watchId`) im Bild sind, das Ergebnis (`targetId`) aber nicht. „Zum Ergebnis“ scrollt dorthin
  // und setzt den Fokus auf die Überschrift. Hinweise (Toast) rücken über die Leiste (--toast-lift).
  import { onMount } from 'svelte';

  interface Props {
    text: string;
    /** Farbmarke vor dem Text (Produktfarbe), leer = keine */
    color?: string;
    /** Element mit dem Ergebnis (wird angesprungen) */
    targetId: string;
    /** Bereich, in dem eingegeben wird; nur solange er sichtbar ist, erscheint die Leiste */
    watchId?: string;
    label?: string;
  }
  let { text, color, targetId, watchId = 'eck', label = 'Zum Ergebnis' }: Props = $props();

  let narrow = $state(false);
  let watchVisible = $state(false);
  let targetVisible = $state(true);
  let bar = $state<HTMLDivElement>();
  const show = $derived(narrow && watchVisible && !targetVisible);

  onMount(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const sync = () => { narrow = mq.matches; };
    sync();
    mq.addEventListener('change', sync);
    const io = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (e.target.id === watchId) watchVisible = e.isIntersecting;
        else if (e.target.id === targetId) targetVisible = e.isIntersecting;
      }
    }, { rootMargin: '0px 0px -56px 0px' }); // die Leiste selbst verdeckt unten etwa 56 px
    const w = document.getElementById(watchId), t = document.getElementById(targetId);
    if (w) io.observe(w);
    if (t) io.observe(t); else targetVisible = false;
    return () => { mq.removeEventListener('change', sync); io.disconnect(); };
  });

  // Hinweise über die Leiste heben, solange sie zu sehen ist
  $effect(() => {
    const root = document.documentElement;
    if (!show || !bar) { root.style.removeProperty('--toast-lift'); return; }
    root.style.setProperty('--toast-lift', Math.ceil(bar.offsetHeight + 4) + 'px');
    return () => root.style.removeProperty('--toast-lift');
  });

  function go() {
    const el = document.getElementById(targetId);
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
    const h = el.querySelector<HTMLElement>('h2') ?? el;
    if (!h.hasAttribute('tabindex')) h.setAttribute('tabindex', '-1');
    h.focus({ preventScroll: true });
  }
</script>

{#if show}
  <div class="peek noprint" bind:this={bar} role="region" aria-label="Ergebnis in Kürze" data-testid="result-peek">
    <p class="txt">{#if color}<span class="key" style:background={color}></span>{/if}<span>{text}</span></p>
    <button class="btn small primary" type="button" onclick={go}>{label}<span aria-hidden="true">&nbsp;↓</span></button>
  </div>
{/if}

<style>
  .peek {
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 30;
    display: flex; align-items: center; gap: 10px; min-height: 52px;
    padding: 8px 14px calc(8px + env(safe-area-inset-bottom, 0px));
    background: var(--surface); border-top: 1px solid var(--border-strong); box-shadow: var(--shadow-pop);
    animation: up .16s ease-out;
  }
  .txt { flex: 1; min-width: 0; margin: 0; display: flex; align-items: center; gap: 8px; font-size: .9rem; font-weight: 600; line-height: 1.3; }
  .txt span:last-child { overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; }
  .key { width: 14px; height: 4px; }
  .btn { flex: none; }
  @keyframes up { from { transform: translateY(100%); } }
  @media (min-width: 641px) { .peek { display: none; } }
  @media (forced-colors: active) { .peek { border-top: 2px solid CanvasText; } }
</style>
