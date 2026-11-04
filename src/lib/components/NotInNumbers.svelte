<script lang="ts">
  // „Was die Zahlen nicht zeigen“: Vor- und Nachteile je Produkt und häufige Fragen, jeweils aufklappbar.
  // Inhalte aus prosCons.ts; Links führen zum passenden Einstellungsfeld.
  import type { Params, ProductKey } from '../engine/engine';
  import { PRODUCTS } from '../engine/analyze';
  import { faqs, prosCons } from '../prosCons';
  import { focusField } from '../state.svelte';
  import Icon from './Icon.svelte';

  let { p, keys }: { p: Params; keys: ProductKey[] } = $props();
  const items = $derived(prosCons(p, keys));
  const questions = $derived(faqs(p, keys));
  const colorOf = (k: ProductKey) => PRODUCTS.find(x => x.key === k)!.color;

  // Druck: alles aufklappen, danach den vorherigen Zustand wiederherstellen (wie in den Einstellungen)
  let root = $state<HTMLElement>();
  $effect(() => {
    let closed: HTMLDetailsElement[] = [];
    const open = () => {
      if (!root || closed.length) return;
      closed = [...root.querySelectorAll('details')].filter(d => !d.open);
      closed.forEach(d => { d.open = true; });
    };
    const restore = () => { closed.forEach(d => { d.open = false; }); closed = []; };
    window.addEventListener('beforeprint', open);
    window.addEventListener('afterprint', restore);
    return () => { window.removeEventListener('beforeprint', open); window.removeEventListener('afterprint', restore); };
  });
</script>

{#snippet point(pt: { text: string; field?: string; fieldLabel?: string; tab?: 'overview' | 'detail' | 'heirs' | 'settings' })}
  {pt.text}{#if pt.field}{' '}<button type="button" class="linkish noprint" onclick={() => focusField(pt.tab ?? 'settings', pt.field!)}>{pt.fieldLabel}</button>{/if}
{/snippet}

<section class="card nin" aria-labelledby="nin-h" data-testid="not-in-numbers" bind:this={root}>
  <div class="card-head"><h2 id="nin-h">Was die Zahlen nicht zeigen</h2></div>
  <p class="hint">Verfügbarkeit, Bindung, Schutz und Kostenrisiken stecken nicht im Kapital. Zum Aufklappen.</p>

  <div class="list">
    {#each items as it (it.key)}
      <details data-testid="pc-{it.key}">
        <summary><span class="key" style:background={colorOf(it.key)}></span>{it.title}: Vor- und Nachteile</summary>
        <div class="cols">
          <div>
            <h3 class="pro">Spricht dafür</h3>
            <ul>{#each it.pros as pt}<li class="pro"><Icon name="plus" size={14} /><span>{@render point(pt)}</span></li>{/each}</ul>
          </div>
          <div>
            <h3 class="con">Spricht dagegen</h3>
            <ul>{#each it.cons as pt}<li class="con"><Icon name="minus" size={14} /><span>{@render point(pt)}</span></li>{/each}</ul>
          </div>
        </div>
      </details>
    {/each}
  </div>

  {#if questions.length}
    <h3 class="faq-h">Häufige Fragen</h3>
    <div class="list">
      {#each questions as f (f.id)}
        <details data-testid="faq-{f.id}">
          <summary>{f.q}</summary>
          {#each f.a as para}<p>{para}</p>{/each}
        </details>
      {/each}
    </div>
  {/if}
</section>

<style>
  .nin .hint { margin: -4px 0 12px; }
  .list { border-top: 1px solid var(--border); }
  details { border-bottom: 1px solid var(--border); }
  summary { cursor: pointer; padding: 10px 2px; font-weight: 550; display: flex; align-items: center; gap: 8px; list-style: none; }
  summary::-webkit-details-marker { display: none; }
  summary::after { content: ''; margin-left: auto; width: 8px; height: 8px; border-right: 1.75px solid currentColor; border-bottom: 1.75px solid currentColor; transform: rotate(45deg); transition: transform .15s; flex: none; position: relative; top: -2px; }
  details[open] > summary::after { transform: rotate(-135deg); top: 2px; }
  summary:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 4px; }
  .key { width: 10px; height: 10px; border-radius: 3px; flex: none; }
  .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; padding: 0 2px 12px; }
  @media (max-width: 720px) { .cols { grid-template-columns: 1fr; } }
  h3 { font-size: .82rem; font-weight: 650; text-transform: uppercase; letter-spacing: .03em; margin: 4px 0 6px; color: var(--text-2); }
  ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
  li { display: grid; grid-template-columns: 16px 1fr; gap: 6px; color: var(--text-2); font-size: .92rem; line-height: 1.45; }
  li :global(svg) { margin-top: 3px; }
  li.pro :global(svg) { color: var(--good); }
  li.con :global(svg) { color: var(--warn-text); }
  details > p { color: var(--text-2); max-width: 75ch; margin: 0 2px 10px; font-size: .92rem; }
  .faq-h { margin-top: 18px; }
  .linkish { font: inherit; color: var(--accent-text); background: none; border: 0; padding: 0; text-decoration: underline; text-underline-offset: 2px; cursor: pointer; white-space: nowrap; }
  @media (pointer: coarse) { .linkish { padding: 8px 0; margin: -8px 0; } }
  @media (prefers-reduced-motion: reduce) { summary::after { transition: none; } }
  @media print { summary::after { display: none; } }
</style>
