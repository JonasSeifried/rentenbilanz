<script lang="ts">
  // Dialog „Kombi zusammenstellen“: der Monatsbeitrag, auf mehrere Produkte aufgeteilt. Gearbeitet wird an einem
  // Entwurf; erst „Übernehmen“ schreibt ihn in die Eingaben. Die Kombi läuft dann im Vergleich als eigener
  // Teilnehmer mit (analyze(), gemeinsam versteuert). Auf Wunsch (Knopf, opt-in) sucht der Rechner die Aufteilung mit
  // der höchsten Summe unter diesen Annahmen; ungefragt nennt er keine andere Aufteilung (keine Empfehlung).
  import { untrack } from 'svelte';
  import { PRODUCTS } from '../engine/analyze';
  import { readParams, type ProductKey } from '../engine/core';
  import { emptySplit, INPUT_OF, scaleSplit, SPLIT_KEYS, splitSum, storedSplit, type Split } from '../engine/combo';
  import { analyzeCombo, restTarget, SPLIT_EPS } from '../engine/comboAnalyze';
  import { bestSplit } from '../engine/search';
  import { CONTRIB_KEYS, type Inputs } from '../engine/inputs';
  import { comboVerdict, eurAmount } from '../comboVerdict';
  import { app, closeKombi, setInputs } from '../state.svelte';
  import { LT } from '../lawText';
  import NumberField from './NumberField.svelte';
  import Icon from './Icon.svelte';

  let dlg: HTMLDialogElement;
  const i = $derived(app.inputs);
  const p = $derived(readParams(app.inputs));

  let budget = $state(0);
  let draft = $state<Split>(emptySplit());
  /** Suche angefordert? Gilt, bis der Dialog geschlossen wird. */
  let searched = $state(false);

  /** Gleichmäßig auf die verglichenen Produkte (mindestens ETF und AVD), in 10-€-Schritten; der Rest ans erste. */
  function evenSplit(b: number, on: Record<ProductKey, boolean>): Split {
    let ks = SPLIT_KEYS.filter(k => on[k]);
    if (ks.length < 2) ks = ['etf', 'avd'];
    const s = emptySplit(), each = Math.floor(b / ks.length / 10) * 10;
    for (const k of ks) s[k] = each;
    s[ks[0]] = Math.round((s[ks[0]] + b - each * ks.length) * 100) / 100;
    return s;
  }

  function init() {
    budget = Math.max(0, i.setAll);
    searched = false;
    const stored = storedSplit(i);
    draft = splitSum(stored) > 0 ? scaleSplit(stored, budget) : evenSplit(budget, p.on);
  }

  $effect(() => {
    if (app.kombiOpen) { if (!dlg.open) { untrack(init); dlg.showModal(); } }
    else if (dlg.open) dlg.close();
  });

  const parts = $derived(SPLIT_KEYS.filter(k => draft[k] > 0));
  // Gesucht wird unter den verglichenen Produkten und denen, die in der Kombi stecken.
  const keyStr = $derived(SPLIT_KEYS.filter(k => p.on[k] || draft[k] > 0).join(','));
  const keys = $derived(keyStr ? (keyStr.split(',') as ProductKey[]) : []);
  const best = $derived(app.kombiOpen && searched && keys.length >= 2 && budget > 0 ? bestSplit(p, budget, keys) : null);
  const C = $derived(app.kombiOpen ? analyzeCombo(p, { budget, split: draft, keys }, best) : null);
  const V = $derived(C ? comboVerdict(C, null, searched) : null);
  const B = $derived(C?.best && C.best !== 'pending' ? C.best : null);

  const sum = $derived(splitSum(draft));
  const gap = $derived(budget - sum);
  const ok = $derived(Math.abs(gap) < SPLIT_EPS);
  const canApply = $derived(ok && budget > 0 && parts.length >= 2);
  const target = $derived(restTarget(parts.length ? parts : keys));
  const scale = $derived(Math.max(budget, sum, 1));
  const DAT: Record<ProductKey, string> = { etf: 'dem ETF-Depot', avd: 'dem Altersvorsorgedepot', ins: 'der Rentenversicherung', fond: 'dem aktiven Fonds' };
  const LABEL: Record<ProductKey, string> = { etf: 'ETF-Depot', avd: 'Altersvorsorgedepot', ins: 'Rentenversicherung', fond: 'Aktiver Fonds' };
  const round2 = (x: number) => Math.round(x * 100) / 100;

  function setPart(k: ProductKey, v: number) { draft = { ...draft, [k]: Math.max(0, v) }; }
  function setBudget(v: number) {
    const b = Math.max(0, v);
    if (splitSum(draft) > 0 && b > 0) draft = scaleSplit(draft, b);
    budget = b;
  }
  /** Offenen Rest einem Produkt geben; Überschuss von den größten Anteilen abziehen. */
  function fixGap() {
    const d = { ...draft };
    if (gap > 0) { if (!target) return; d[target] = round2(d[target] + gap); }
    else {
      let over = -gap;
      for (const k of SPLIT_KEYS.filter(k => d[k] > 0).sort((a, b) => d[b] - d[a])) {
        const take = Math.min(d[k], over);
        d[k] = round2(d[k] - take); over = round2(over - take);
        if (over < SPLIT_EPS) break;
      }
    }
    draft = d;
  }

  function apply() {
    if (!canApply) return;
    const patch: Partial<Inputs> = { combo: true };
    for (const k of SPLIT_KEYS) patch[INPUT_OF[k]] = draft[k];
    if (budget !== i.setAll) { patch.setAll = budget; for (const k of CONTRIB_KEYS) patch[k] = budget; }
    setInputs(patch);
    closeKombi();
  }
  function remove() { setInputs({ combo: false }); closeKombi(); }
</script>

<dialog bind:this={dlg} class="kd" aria-labelledby="kd-h" onclose={closeKombi}
  onclick={(e) => { if (e.target === dlg) closeKombi(); }} data-testid="kombi-dialog">
  <div class="body">
    <div class="head">
      <h2 id="kd-h">Kombi zusammenstellen</h2>
      <button class="btn ghost small" type="button" onclick={closeKombi} aria-label="Schließen"><Icon name="close" /></button>
    </div>
    <p class="intro">Verteile deinen Monatsbeitrag auf mehrere Produkte. Die Kombi erscheint im Vergleich neben den einzelnen Produkten und wird gemeinsam versteuert, mit einem Steuertarif und einem Sparer-Pauschbetrag für alle Depots.</p>

    <NumberField label="Monatsbeitrag gesamt" value={budget} onchange={setBudget} min={0} step={10} unit="€" testid="kombi-budget"
      hint="Gilt auch für jedes einzelne Produkt im Vergleich, damit überall gleich viel eigenes Geld hineinfließt." />

    <div class="fields">
      {#each PRODUCTS as pr (pr.key)}
        <NumberField label={LABEL[pr.key]} value={draft[pr.key]} onchange={v => setPart(pr.key, v)} min={0} step={10} unit="€"
          testid="kombi-{pr.key}" hint={pr.key === 'avd' ? 'gefördert bis ' + LT.avdSubMaxM : undefined} />
      {/each}
    </div>

    <div class="bar" role="img" aria-label="Aufteilung: {parts.map(k => eurAmount(draft[k]) + ' ' + LABEL[k]).join(', ') || 'nichts verteilt'}">
      {#each PRODUCTS as pr (pr.key)}
        {@const w = draft[pr.key] / scale * 100}
        {#if w > 0}<span class="seg" style:width="{w}%" style:background={pr.color}></span>{/if}
      {/each}
    </div>
    <div class="row">
      <span class="status" class:warn={!ok} role="status" data-testid="kombi-status">
        Verteilt {eurAmount(sum)} von {eurAmount(budget)}{#if !ok && gap > 0}{' · noch ' + eurAmount(gap) + ' offen'}{:else if !ok}{' · ' + eurAmount(-gap) + ' zu viel'}{/if}
      </span>
      {#if !ok && (gap < 0 || target)}
        <button class="btn small" type="button" onclick={fixGap} data-testid="kombi-fix">
          {gap > 0 ? 'Rest ' + DAT[target!] + ' geben' : 'Überschuss abziehen'}
        </button>
      {/if}
    </div>
    {#if ok && budget > 0 && parts.length < 2}<p class="status warn">Verteile auf mindestens zwei Produkte, sonst ist es keine Kombi.</p>{/if}

    {#if V && ok && budget > 0 && V.kind !== 'needTwo' && V.kind !== 'unallocated'}
      <div class="result" aria-live="polite" data-testid="kombi-result">
        <p class="hl">{V.headline}</p>
        {#each V.lines as l}<p>{l}</p>{/each}
        {#if !searched && C?.canRank}
          <button class="btn small" type="button" onclick={() => (searched = true)} data-testid="kombi-search">Aufteilung mit der höchsten Summe berechnen</button>
          <p class="fine">Optional. Sucht in 10-€-Schritten die Aufteilung mit der höchsten Summe netto bis {p.H} unter diesen Annahmen. Das ist keine Empfehlung: Verfügbarkeit, Bindung und Absicherung stecken nicht in der Summe.</p>
        {:else if B && !B.userIsBest && C?.canRank}
          <button class="btn small" type="button" onclick={() => (draft = { ...B.split })} data-testid="kombi-use-best">Diese Aufteilung verwenden</button>
        {/if}
      </div>
    {/if}
  </div>

  <div class="foot">
    {#if i.combo}<button class="btn" type="button" onclick={remove} data-testid="kombi-remove"><Icon name="trash" />Kombi entfernen</button>{/if}
    <span class="sp"></span>
    <button class="btn" type="button" onclick={closeKombi}>Abbrechen</button>
    <button class="btn primary" type="button" onclick={apply} disabled={!canApply} data-testid="kombi-apply">{i.combo ? 'Übernehmen' : 'Zum Vergleich hinzufügen'}</button>
  </div>
</dialog>

<style>
  .kd {
    width: min(640px, calc(100vw - 24px)); max-height: calc(100dvh - 24px); padding: 0;
    border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); color: var(--text);
    box-shadow: var(--shadow-pop); overflow: hidden;
  }
  .kd[open] { display: flex; flex-direction: column; }
  .kd::backdrop { background: rgba(0, 0, 0, .4); }
  .body { padding: 16px 20px 12px; overflow-y: auto; }
  .head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 4px; }
  .head h2 { margin: 0; }
  .intro { font-size: .88rem; color: var(--text-2); margin: 0 0 14px; }
  .fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 14px; align-items: start; margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--grid); }
  @media (max-width: 480px) { .fields { grid-template-columns: 1fr; } }
  .bar { display: flex; height: 8px; border-radius: 4px; overflow: hidden; background: var(--surface-2); margin: 14px 0 6px; }
  .seg { display: block; height: 100%; }
  .row { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px; }
  .status { font-size: .88rem; color: var(--text-2); margin: 0; }
  .status.warn { color: var(--text); font-weight: 550; }
  p.status { margin-top: 6px; }
  .result { margin-top: 14px; padding: 12px 14px; border-radius: var(--radius-sm); background: var(--surface-2); font-size: .88rem; color: var(--text-2); }
  .result p { margin: 0 0 6px; }
  .result .hl { color: var(--text); font-weight: 600; }
  .result .btn { margin-top: 2px; }
  .result .fine { font-size: .78rem; color: var(--muted); margin: 6px 0 0; }
  .foot { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; padding: 12px 20px; border-top: 1px solid var(--grid); background: var(--surface); }
  .foot .sp { flex: 1; }
  .foot .btn[disabled] { opacity: .5; cursor: not-allowed; }
</style>
