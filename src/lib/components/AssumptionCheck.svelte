<script lang="ts" module>
  export { SETTINGS_KEYS, changedSettings } from '../settingsChanged';
</script>

<script lang="ts">
  // „Passen diese Annahmen zu dir?“ (Variante B aus dem UX-Review, Teil C): die Annahmen mit der größten Wirkung,
  // mit dem aktuellen Wert und einem Direktlink ins passende Feld. Keine Props, liest `app.inputs`
  // (wird auch im Kombi-Modus verwendet). Im Druck als „Unterstellte Annahmen“ ohne Links.
  import { tick } from 'svelte';
  import { DEFAULTS } from '../engine/inputs';
  import { incomePathKind, incomeStartText, readParams } from '../engine/core';
  import { app, focusField, setTab } from '../state.svelte';
  import type { Tab } from '../link';
  import { KV_KINDS, kvShown } from './KvQuestion.svelte';

  const i = $derived(app.inputs);
  const de = (x: number) => x.toLocaleString('de-DE', { maximumFractionDigits: 2 });

  /** Gehaltsentwicklung mit den Werten, mit denen die Engine rechnet (nach Grenzen, mit Randfällen). */
  function pathValue(): string {
    const p = readParams(i), kind = incomePathKind(p);
    if (kind === 'off') return 'keine (real gleich)';
    if (kind === 'noWork') return 'ohne Wirkung (keine Berufsphase vor der Rente)';
    if (kind === 'now') return de(p.incPeak) + ' € ' + incomeStartText(p);
    return 'auf ' + de(p.incPeak) + ' € mit ' + de(p.incPeakAge) + ' Jahren' + (kind === 'late' ? ' (nach Rentenbeginn, nicht erreicht)' : '');
  }

  interface Row { key: string; label: string; value: string; changed: boolean; tab: Tab; id: string }
  const rows = $derived.by<Row[]>(() => {
    const inStudy = i.studyEnd > i.a0;
    const kv = kvShown(i.kvOn, i.kvKind);
    const out: Row[] = [];
    if (i.avdOn) out.push({
      key: 'kids', label: 'Kinder mit Kindergeld', tab: 'settings', id: 'f-kids',
      value: i.kids > 0 ? de(i.kids) + ' (ab Alter ' + de(i.kidsFrom) + ', ' + de(i.kidsYears) + ' Jahre)' : 'keine',
      changed: i.kids !== DEFAULTS.kids || (i.kids > 0 && (i.kidsFrom !== DEFAULTS.kidsFrom || i.kidsYears !== DEFAULTS.kidsYears)),
    });
    out.push({
      key: 'study', label: 'Ausbildung / Studium', tab: 'settings', id: 'f-study',
      value: inStudy ? 'bis Alter ' + de(i.studyEnd) : 'nein', changed: inStudy,
    });
    out.push({
      key: 'incPath', label: 'Gehaltsentwicklung', tab: 'settings', id: 'f-path',
      value: pathValue(), changed: i.incPeak >= 0,
    });
    out.push({
      key: 'tax', label: 'Steuer', tab: 'settings', id: 'f-married',
      value: (i.married ? 'verheiratet, Partner ' + de(i.incSpouse) + ' / ' + de(i.incSpouseRet) + ' € (vor / ab Rentenbeginn)' + (i.avdSpouse > 0 ? ', zahlt ' + de(i.avdSpouse) + ' €/Monat in einen eigenen geförderten Vertrag' : '') : 'ledig') + ', ' + (i.kist > 0 ? 'Kirchensteuer ' + de(i.kist) + ' %' : 'keine Kirchensteuer'),
      changed: i.married !== DEFAULTS.married || i.kist !== DEFAULTS.kist || (i.married && i.avdSpouse !== DEFAULTS.avdSpouse),
    });
    out.push({
      key: 'allowance', label: 'Sparer-Pauschbetrag schon genutzt', tab: 'settings', id: 'f-allowanceUsed',
      value: i.allowanceUsed > 0 ? de(i.allowanceUsed) + ' €/Jahr' : 'nein', changed: i.allowanceUsed !== DEFAULTS.allowanceUsed,
    });
    out.push({
      key: 'kv', label: 'Krankenversicherung im Alter', tab: app.tab, id: 'f-kv',
      value: KV_KINDS[kv].long + (kv === 1 ? ', ' + de(i.kvRate) + ' %' : ''),
      changed: kv !== 0,
    });
    if (i.insOn) out.push({
      key: 'insEff', label: 'Kosten Versicherung', tab: 'settings', id: 'f-insEff',
      value: de(i.insEff) + ' % p. a.', changed: i.insEff !== DEFAULTS.insEff,
    });
    if (i.avdOn) out.push({
      key: 'avdCost', label: 'Kosten Altersvorsorgedepot', tab: 'settings', id: 'f-avdCost',
      value: de(i.avdCost) + ' % p. a.', changed: i.avdCost !== DEFAULTS.avdCost,
    });
    out.push({
      key: 'infl', label: 'Inflation / Beitragssteigerung', tab: 'settings', id: 'f-infl',
      value: de(i.infl) + ' % / ' + de(i.dyn) + ' %', changed: i.infl !== DEFAULTS.infl || i.dyn !== DEFAULTS.dyn,
    });
    return out;
  });
  const anyChanged = $derived(rows.some(r => r.changed));

  async function all() {
    setTab('settings');
    await tick();
    const panel = document.getElementById('panel-settings');
    if (!panel) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    panel.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
    panel.focus({ preventScroll: true });
  }
</script>

<section class="card ac" id="annahmen-check" aria-labelledby="ac-h" data-testid="assumption-check">
  <div class="card-head">
    <h2 id="ac-h"><span class="noprint">Passen diese Annahmen zu dir?</span><span class="print-only">Unterstellte Annahmen</span></h2>
    <p class="hint noprint">Sie verändern das Ergebnis oft stark.</p>
  </div>
  <dl>
    {#each rows as r (r.key)}
      <div class="row" class:changed={r.changed} data-testid="ac-{r.key}">
        <dt>{r.label}</dt>
        <dd>
          <span class="val">{#if r.changed}<span class="dot" aria-hidden="true"></span><span class="sr-only">geändert: </span>{/if}{r.value}</span>
          <button type="button" class="linkish noprint" onclick={() => focusField(r.tab, r.id)}
            aria-label="{r.label} ändern" data-testid="ac-edit-{r.key}">ändern</button>
        </dd>
      </div>
    {/each}
  </dl>
  <div class="foot">
    {#if anyChanged}<p class="hint legend"><span class="dot" aria-hidden="true"></span> von den Standardwerten geändert</p>{:else}<span></span>{/if}
    <button type="button" class="linkish all noprint" onclick={all} data-testid="ac-all">Alle Einstellungen &amp; Annahmen <span aria-hidden="true">→</span></button>
  </div>
</section>

<style>
  .ac .card-head { margin-bottom: 6px; }
  dl { margin: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); column-gap: 32px; }
  .row { display: flex; align-items: baseline; justify-content: space-between; gap: 4px 12px; padding: 8px 0; border-bottom: 1px solid var(--grid); min-width: 0; }
  dt { color: var(--text-2); font-size: .88rem; }
  dd { margin: 0; display: flex; align-items: baseline; gap: 12px; text-align: right; font-size: .9rem; font-variant-numeric: tabular-nums; }
  .val { display: inline-flex; align-items: baseline; gap: 6px; }
  .changed .val { font-weight: 600; }
  .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--accent); flex: none; position: relative; top: -1px; }
  .linkish { font: inherit; font-size: .85rem; color: var(--accent-text); background: none; border: 0; padding: 4px 0; text-decoration: underline; text-underline-offset: 2px; cursor: pointer; white-space: nowrap; }
  @media (pointer: coarse) { .linkish { padding: 10px 0; margin: -6px 0; } }
  .foot { display: flex; justify-content: space-between; align-items: center; gap: 8px 16px; flex-wrap: wrap; margin-top: 10px; }
  .foot .hint { margin: 0; display: inline-flex; align-items: center; gap: 6px; font-size: .8rem; }
  .all { font-weight: 550; }
  @media (max-width: 640px) {
    dl { grid-template-columns: 1fr; }
    .row { flex-wrap: wrap; }
    dt { flex: 1 1 auto; }
  }
  @media (forced-colors: active) { .dot { forced-color-adjust: none; background: Highlight; } }
  @media print {
    .ac { break-inside: avoid; }
    .row { padding: 4px 0; }
  }
</style>
