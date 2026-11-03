<script lang="ts">
  import { scrollRegion } from '../attach';
  import { PRODUCTS } from '../engine/analyze';
  import { SPLIT_KEYS } from '../engine/combo';
  import { eur, eurRound } from '../format';
  import type { ComboRun } from '../comboRun.svelte';

  let { run }: { run: ComboRun } = $props();
  const C = $derived(run.C);
  const p = $derived(run.p);
  const U = $derived(C?.user ?? null);
  const R = (x: number) => (p.real && U ? x / U.res.I(U.res.n) : x);
  const parts = $derived(U ? SPLIT_KEYS.filter(k => U.res.parts[k] && U.partStats[k]) : []);
  const pr = (k: string) => PRODUCTS.find(x => x.key === k)!;
</script>

<section class="card" aria-labelledby="cd-h" data-testid="combo-detail">
  <div class="card-head"><h2 id="cd-h">Deine Aufteilung im Detail</h2></div>
  {#if U && C?.complete}
    <div class="table-scroll" {@attach scrollRegion('Tabelle: Deine Aufteilung im Detail')}>
      <table class="dt">
        <thead><tr><th>Anteil</th><th>Eigenes Geld</th><th>Kapital bei Rentenbeginn</th><th>Ø netto pro Monat</th><th>Summe bis Alter {p.H}</th></tr></thead>
        <tbody>
          {#each parts as k (k)}
            {@const part = U.res.parts[k]!}
            {@const st = U.partStats[k]!}
            <tr>
              <td><span class="key" style:background={pr(k).color}></span> {pr(k).short} <span class="muted">({eur(C.split[k])}/Monat)</span></td>
              <td>{eurRound(p.real ? part.ownReal : part.own)}</td>
              <td>{eurRound(R(part.capR))}</td>
              <td>{eur(st.avgMonthly)}</td>
              <td>{eurRound(st.cumH)}</td>
            </tr>
          {/each}
          <tr class="tot">
            <td><strong>Gesamt</strong></td>
            <td>{eurRound(p.real ? U.res.ownReal : U.res.own)}</td>
            <td>{eurRound(R(U.res.capR))}</td>
            <td>{eur(U.stats.avgMonthly)}</td>
            <td>{eurRound(U.stats.cumH)}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="hint">Gemeinsame Steuern und Abgaben sind anteilig auf die Produkte verteilt; nur die Summe ist eindeutig. {p.real ? 'Beträge in heutiger Kaufkraft.' : 'Nominale Beträge.'}</p>
  {:else}
    <p class="hint">Verteile das ganze Monatsbudget auf mindestens zwei Produkte, dann erscheint hier die Aufteilung im Detail.</p>
  {/if}
</section>

<style>
  .dt { width: 100%; border-collapse: collapse; font-size: .92rem; }
  .dt th { text-align: right; font-weight: 550; color: var(--text-2); font-size: .8rem; padding: 6px 8px; border-bottom: 1px solid var(--grid); }
  .dt th:first-child, .dt td:first-child { text-align: left; }
  .dt td { padding: 8px; border-bottom: 1px solid var(--grid); text-align: right; font-variant-numeric: tabular-nums; }
  .dt tr.tot td { background: var(--surface-2); }
  .muted { color: var(--muted); }
</style>
