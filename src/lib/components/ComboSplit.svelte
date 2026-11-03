<script lang="ts">
  import { PRODUCTS } from '../engine/analyze';
  import { SPLIT_KEYS } from '../engine/combo';
  import { SPLIT_EPS, restTarget } from '../engine/comboAnalyze';
  import { eurAmount } from '../comboVerdict';
  import { app, setInput } from '../state.svelte';
  import NumberField from './NumberField.svelte';

  const i = $derived(app.inputs);
  const FIELD = { etf: 'cEtf', avd: 'cAvd', ins: 'cIns', fond: 'cFond' } as const;
  const active = $derived(PRODUCTS.filter(pr => i[(pr.key + 'On') as 'etfOn']));
  const keys = $derived(SPLIT_KEYS.filter(k => i[(k + 'On') as 'etfOn']));
  const budget = $derived(Math.max(0, i.cBudget));
  const sum = $derived(keys.reduce((s, k) => s + Math.max(0, i[FIELD[k]]), 0));
  const gap = $derived(budget - sum);
  const ok = $derived(Math.abs(gap) < SPLIT_EPS);
  const target = $derived(restTarget(keys));
  const targetPr = $derived(PRODUCTS.find(pr => pr.key === target));
  const scale = $derived(Math.max(budget, sum, 1));

  function giveRest() {
    if (!target) return;
    const f = FIELD[target];
    setInput(f, Math.max(0, Math.round((i[f] + gap) * 100) / 100));
  }
</script>

<div class="split" data-testid="combo-split">
  <div class="fields">
    {#each active as pr (pr.key)}
      <NumberField label={pr.short === 'Versicherung' ? 'Versicherung' : pr.short} value={i[FIELD[pr.key]]} onchange={v => setInput(FIELD[pr.key], v)}
        min={0} step={10} unit="€" testid="split-{pr.key}" hint={pr.key === 'avd' ? 'gefördert bis 150 €' : undefined} />
    {/each}
  </div>
  {#if active.length < 2}
    <p class="status">Wähle mindestens zwei Produkte zum Aufteilen.</p>
  {:else}
    <div class="bar" role="img" aria-label="Aufteilung des Budgets">
      {#each active as pr (pr.key)}
        {@const w = Math.max(0, i[FIELD[pr.key]]) / scale * 100}
        {#if w > 0}<span class="seg" style:width="{w}%" style:background={pr.color} title="{pr.short}: {eurAmount(i[FIELD[pr.key]])}"></span>{/if}
      {/each}
    </div>
    <div class="row">
      <span class="status" class:warn={!ok} role="status" data-testid="split-status">
        Verteilt {eurAmount(sum)} von {eurAmount(budget)}{#if !ok && gap > 0} · noch {eurAmount(gap)} offen{:else if !ok} · {eurAmount(-gap)} zu viel{/if}
      </span>
      {#if !ok && targetPr}
        <button class="btn small" type="button" onclick={giveRest} data-testid="split-rest">{gap > 0 ? 'Rest' : 'Überschuss'} {target === 'etf' ? 'dem ETF-Depot' : 'bei ' + targetPr.short} {gap > 0 ? 'geben' : 'abziehen'}</button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .split { margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--grid); }
  .fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px 14px; align-items: start; }
  .bar { display: flex; height: 8px; border-radius: 4px; overflow: hidden; background: var(--surface-2); margin: 12px 0 6px; }
  .seg { display: block; height: 100%; }
  .row { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px; }
  .status { font-size: .88rem; color: var(--text-2); margin: 0; }
  .status.warn { color: var(--text); font-weight: 550; }
</style>
