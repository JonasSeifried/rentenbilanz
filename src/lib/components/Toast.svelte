<script lang="ts">
  // Hinweis unten im Bild (Live-Region). Hinweise mit Aktion („Rückgängig“) blenden sich nicht von selbst
  // aus; Hinweise ohne Aktion pausieren, solange Maus oder Fokus darauf liegen. Esc schließt.
  // Entstand der Hinweis per Tastatur, bekommt die Aktion den Fokus; nach dem Schließen geht er zurück.
  // Abstand von unten lässt sich über die CSS-Variable `--toast-lift` anheben (z. B. über einer Ergebnisleiste).
  import { tick } from 'svelte';
  import { app, hideToast, pauseToast, resumeToast } from '../state.svelte';
  import Icon from './Icon.svelte';

  let actionBtn = $state<HTMLButtonElement>();
  let returnTo: HTMLElement | null = null;

  // Fokus auf die Aktion, sobald ein Hinweis mit `focus` erscheint
  $effect(() => {
    const t = app.toast;
    if (!t?.focus || !t.action) return;
    tick().then(() => {
      if (app.toast?.id !== t.id || !actionBtn) return;
      const prev = document.activeElement;
      returnTo = prev instanceof HTMLElement && prev !== document.body ? prev : null;
      actionBtn.focus();
    });
  });

  function close() {
    const hadFocus = !!document.activeElement?.closest('.toast');
    const back = returnTo;
    returnTo = null;
    hideToast();
    if (hadFocus && back?.isConnected) back.focus();
  }
  function onAction() {
    const hadFocus = !!document.activeElement?.closest('.toast');
    const back = returnTo;
    returnTo = null;
    app.toast?.action?.run();
    if (hadFocus && back?.isConnected) back.focus();
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key !== 'Escape' || !app.toast || e.defaultPrevented) return;
    // Ein offenes Glossar-Popover schließt zuerst
    try { if (document.querySelector(':popover-open')) return; } catch { /* alter Browser */ }
    close();
  }
</script>

<svelte:window {onkeydown} />

<div class="toast-region noprint" aria-live="polite" aria-atomic="true">
  {#if app.toast}
    {#key app.toast.id}
      <div class="toast" data-testid="toast" role="group" aria-label="Hinweis"
        onmouseenter={pauseToast} onmouseleave={resumeToast} onfocusin={pauseToast} onfocusout={resumeToast}>
        <span>{app.toast.message}</span>
        {#if app.toast.action}
          <button bind:this={actionBtn} class="btn small" type="button" onclick={onAction} data-testid="toast-action">{app.toast.action.label}</button>
        {/if}
        <button class="x" type="button" onclick={close} aria-label="Hinweis schließen"><Icon name="close" size={14} /></button>
      </div>
    {/key}
  {/if}
</div>

<style>
  .toast-region {
    position: fixed; left: 0; right: 0; z-index: 40; padding: 0 12px; display: flex; justify-content: center; pointer-events: none;
    bottom: calc(16px + env(safe-area-inset-bottom, 0px) + var(--toast-lift, 0px));
  }
  .toast {
    pointer-events: auto; display: flex; align-items: center; gap: 12px; max-width: 560px;
    background: var(--text); color: var(--page); border-radius: 12px; padding: 10px 10px 10px 16px;
    box-shadow: var(--shadow-pop); font-size: .88rem; animation: up .18s ease-out;
  }
  .toast .btn { background: transparent; color: var(--page); border-color: color-mix(in srgb, var(--page) 40%, transparent); }
  .toast .btn:hover { background: color-mix(in srgb, var(--page) 15%, transparent); }
  .toast :global(:focus-visible) { outline-color: var(--page); }
  .x { background: none; border: 0; color: inherit; cursor: pointer; padding: 6px; display: grid; place-items: center; border-radius: 6px; opacity: .8; min-width: 32px; min-height: 32px; }
  .x:hover { opacity: 1; }
  @keyframes up { from { transform: translateY(8px); opacity: 0; } }
  @media (forced-colors: active) { .toast { border: 1px solid CanvasText; } }
</style>
