<script lang="ts" module>
  /** Antworten auf die KV-Frage (Schlüssel `kvKind`). Gerechnet wird nur mit `kvOn` (nur „freiwillig“ ⇒ an). */
  export const KV_KINDS = [
    { k: 0, label: 'Pflicht (KVdR)', long: 'Pflichtversichert (KVdR)' },
    { k: 1, label: 'Freiwillig gesetzlich', long: 'Freiwillig gesetzlich' },
    { k: 2, label: 'Privat', long: 'Privat' },
    { k: 3, label: 'Weiß ich nicht', long: 'Weiß ich nicht (gerechnet wie KVdR)' },
  ] as const;

  /** Angezeigte Antwort: kvOn ⇒ freiwillig; sonst kvKind 0/2/3 (1 ohne kvOn, etwa aus einem alten Link ⇒ 0). */
  export function kvShown(kvOn: boolean, kvKind: number): number {
    if (kvOn) return 1;
    return kvKind === 2 || kvKind === 3 ? kvKind : 0;
  }
</script>

<script lang="ts">
  // Frage „Krankenversicherung als Rentner“ als Auswahl statt Fachbegriff-Schalter (U4).
  // Die gewählte Antwort trägt die ID `f-kv` (Ziel für „ändern“ im Annahmen-Check).
  import { app, setInputs } from '../state.svelte';
  import Info from './Info.svelte';

  const shown = $derived(kvShown(app.inputs.kvOn, app.inputs.kvKind));
  function pick(k: number) { setInputs({ kvKind: k, kvOn: k === 1 }); }
</script>

<fieldset class="kvq" data-testid="kv-question" aria-describedby={shown === 3 ? 'kvq-hint' : 'kvq-sub'}>
  <legend>Krankenversicherung als Rentner <Info k="kvFreiwillig" /></legend>
  <div class="opts">
    {#each KV_KINDS as o (o.k)}
      <label class="chip" class:on={shown === o.k}>
        <input type="radio" name="kvKind" value={o.k} checked={shown === o.k} id={shown === o.k ? 'f-kv' : undefined}
          onchange={() => pick(o.k)} data-testid="kv-{o.k}" />{o.label}
      </label>
    {/each}
  </div>
  {#if shown === 3}
    <p class="hint warn" id="kvq-hint">Gerechnet wie KVdR. Wer zeitweise privat versichert war, sollte „Freiwillig gesetzlich“ prüfen – das kann das Ergebnis drehen.</p>
  {:else}
    <p class="hint" id="kvq-sub">{#if shown === 1}Dann fallen auch auf die Auszahlungen Beiträge an, gerechnet mit {app.inputs.kvRate.toLocaleString('de-DE')} % (änderbar unter „Annahmen“).{:else}Pflicht (KVdR) ist üblich bei Angestellten. <Info k="kvdr">Was ist die KVdR?</Info>{/if}</p>
  {/if}
</fieldset>

<style>
  .kvq { border: 0; margin: 0; padding: 0; min-width: 0; }
  legend { padding: 0; margin-bottom: 6px; font-size: .82rem; color: var(--text-2); display: flex; align-items: center; gap: 4px; }
  .opts { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip {
    display: inline-flex; align-items: center; gap: 7px; cursor: pointer; user-select: none;
    padding: 5px 12px 5px 8px; border-radius: 999px; font-size: .85rem;
    border: 1px solid var(--border-strong); color: var(--text-2); background: var(--surface);
    transition: background-color .12s, border-color .12s;
  }
  .chip input { width: 16px; height: 16px; margin: 0; accent-color: var(--accent); }
  .chip.on { color: var(--text); background: var(--surface-2); border-color: var(--text-2); }
  .chip:hover { border-color: var(--text-2); }
  .chip:focus-within { outline: 2px solid var(--accent); outline-offset: 2px; }
  @media (pointer: coarse) { .chip { padding: 8px 14px 8px 10px; } }
  .hint { margin: 6px 0 0; font-size: .78rem; }
  .hint.warn { color: var(--warn-text); }
  @media print {
    .chip:not(.on) { display: none; }
    .chip { border: 0; padding: 0; }
    .chip input { display: none; }
    .hint:not(.warn) { display: none; }
  }
</style>
