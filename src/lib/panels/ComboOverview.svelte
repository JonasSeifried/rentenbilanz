<script lang="ts">
  import { scrollRegion } from '../attach';
  import { PRODUCTS } from '../engine/analyze';
  import { SPLIT_KEYS, type Split } from '../engine/combo';
  import type { ComboStats } from '../engine/combo';
  import { eur, eurRound } from '../format';
  import { splitText } from '../comboVerdict';
  import type { ComboRun } from '../comboRun.svelte';
  import { setInputs, setTab } from '../state.svelte';

  let { run }: { run: ComboRun } = $props();
  const C = $derived(run.C);
  const V = $derived(run.V);
  const p = $derived(run.p);

  interface Entry { id: string; label: string; split: Split; stats: ComboStats; best?: boolean; mine?: boolean; busy?: boolean }
  const entries = $derived.by<Entry[]>(() => {
    if (!C || V?.kind === 'needTwo' || !C.complete || !C.user) return [];
    const out: Entry[] = [{ id: 'mine', label: 'Deine Aufteilung', split: C.split, stats: C.user.stats, mine: true }];
    const B = C.best === 'pending' ? run.lastView : C.best;
    if (B && C.canRank && !B.userIsBest) out.push({ id: 'best', label: 'Rechnerisch beste Aufteilung', split: B.split, stats: B.stats, best: true, busy: C.best === 'pending' });
    for (const s of C.pure) out.push({ id: 'pure-' + s.key, label: s.label, split: s.split, stats: s.stats });
    return out;
  });
  const keyOf = (s: Split) => SPLIT_KEYS.filter(k => s[k] > 0);
  function adopt(s: Split) {
    if (!C) return;
    const patch: Record<string, number> = {};
    const F = { etf: 'cEtf', avd: 'cAvd', ins: 'cIns', fond: 'cFond' } as const;
    for (const k of C.keys) patch[F[k]] = s[k];
    setInputs(patch);
  }
</script>

{#if C && V}
  <section class="card verdict" class:neutral={V.kind !== 'ok'} id="verdict" aria-labelledby="verdict-h" aria-busy={V.pending} data-testid="combo-verdict">
    <p class="eyebrow">Ergebnis der Aufteilung unter diesen Annahmen</p>
    <h2 id="verdict-h" tabindex="-1">{V.headline}</h2>
    {#each V.lines as l}<p>{l}</p>{/each}
    {#if V.kind === 'ok' && !run.robustDone && !V.pending}<p class="fine" data-testid="combo-robust-wait">Robustheit gegen die Szenarien wird geprüft …</p>{/if}
    <p class="fine">{p.real ? 'Beträge in heutiger Kaufkraft.' : 'Nominale Beträge (Euro der Zukunft).'} {V.note}</p>
  </section>

  {#if entries.length}
    <section class="card" aria-labelledby="cmp-h" aria-busy={V.pending} data-testid="combo-compare">
      <div class="card-head"><h2 id="cmp-h">Aufteilungen im Vergleich</h2></div>
      <div class="table-scroll" {@attach scrollRegion('Tabelle: Aufteilungen im Vergleich')}>
        <table class="cmp">
          <thead><tr><th>Aufteilung</th><th>Ø netto pro Monat</th><th>Summe bis Alter {p.H}</th></tr></thead>
          <tbody>
            {#each entries as e (e.id)}
              <tr class:mine={e.mine} class:busy={e.busy} data-testid="combo-row-{e.id}">
                <td>
                  <strong>{e.label}</strong>
                  <div class="split-txt">
                    {#each keyOf(e.split) as k}{@const pr = PRODUCTS.find(x => x.key === k)!}<span class="chipk"><span class="key" style:background={pr.color}></span>{eur(e.split[k])} {pr.short}</span>{/each}
                  </div>
                  {#if e.best && !e.busy}<div class="adopt"><button type="button" class="btn small" onclick={() => adopt(e.split)} aria-label="Rechnerisch beste Aufteilung übernehmen: {splitText(e.split, 'short')}" data-testid="combo-adopt">übernehmen</button></div>{/if}
                </td>
                <td data-label="Ø netto pro Monat">{eur(e.stats.avgMonthly)}</td>
                <td data-label="Summe bis Alter {p.H}">{eurRound(e.stats.cumH)}</td>
                              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      {#if V.pending}<p class="hint">Die rechnerisch beste Aufteilung wird berechnet …</p>{/if}
      <p class="hint">Ø netto pro Monat gilt für {p.R}–{p.H}; die Summe zählt alle Auszahlungen bis Alter {p.H} {p.real ? '(heutige Kaufkraft)' : '(nominal)'}. Deine Aufteilung wird gemeinsam versteuert (ein Pauschbetrag, ein Steuertarif). Erbfall: nur im Einzelvergleich.</p>
    </section>
  {/if}
{/if}

<style>
  .cmp { width: 100%; border-collapse: collapse; font-size: .92rem; }
  .cmp th { text-align: left; font-weight: 550; color: var(--text-2); font-size: .8rem; padding: 6px 8px; border-bottom: 1px solid var(--grid); }
  .cmp td { padding: 8px; border-bottom: 1px solid var(--grid); vertical-align: top; font-variant-numeric: tabular-nums; }
  .cmp tr.mine td { background: var(--surface-2); }
  .cmp tr.busy { opacity: .6; }
  .split-txt { display: flex; flex-wrap: wrap; gap: 2px 10px; margin-top: 2px; font-size: .8rem; color: var(--text-2); }
  .chipk { display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; }
  .adopt { margin-top: 6px; }
  .verdict { border-left: 4px solid var(--accent); padding-top: 16px; scroll-margin-top: 64px; margin-bottom: 16px; }
  .verdict.neutral { border-left-color: var(--warn-border); }
  .eyebrow { font-size: .75rem; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); margin-bottom: 6px; }
  .verdict h2 { font-size: clamp(1.1rem, 1rem + .6vw, 1.4rem); font-weight: 650; margin-bottom: 8px; line-height: 1.35; }
  .verdict h2:focus { outline: none; }
  .verdict p { color: var(--text-2); max-width: 75ch; }
  .verdict .fine { font-size: .78rem; color: var(--muted); margin: 10px 0 0; }
  @media (max-width: 640px) {
    .cmp th:nth-child(3), .cmp td:nth-child(3) { display: none; }
  }
</style>
