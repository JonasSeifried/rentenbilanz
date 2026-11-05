<script lang="ts">
  // Hilfsrechnung „Einkommen im Alter“ aus der Bruttorente der Renteninformation (pensionTax.ts). Nur Oberfläche:
  // Die Werte hier werden nicht gespeichert; „Übernehmen“ schreibt das Ergebnis in das Feld incRet.
  import { app, setInput, showToast } from '../state.svelte';
  import { readParams } from '../engine/core';
  import { eur } from '../format';
  import { pensionTax, ZUSATZ_AVG } from '../pensionTax';
  import NumberField from './NumberField.svelte';
  import Switch from './Switch.svelte';
  import Info from './Info.svelte';
  import { kvShown } from './KvQuestion.svelte';

  const p = $derived(readParams(app.inputs));
  const thisYear = new Date().getFullYear();
  /** Rentenbeginn als Kalenderjahr: heute plus Jahre bis zum Rentenalter (Geburtstag im Jahr nicht bekannt). */
  const defaultYear = $derived(thisYear + (p.R - p.a0));

  let open = $state(false);
  let monthly = $state(0);
  let year = $state<number | null>(null);
  // Ändern sich Alter oder Rentenbeginn, gilt wieder die Schätzung (kein veralteter Besteuerungsanteil).
  $effect(() => { void defaultYear; year = null; });
  let zusatz = $state(ZUSATZ_AVG);
  let childless = $state(true);
  let privateKv = $state(0);
  let other = $state(0);
  const isPrivate = $derived(kvShown(app.inputs.kvOn, app.inputs.kvKind) === 2);
  const voluntary = $derived(app.inputs.kvOn);

  const r = $derived(pensionTax({
    monthly, startYear: year ?? defaultYear, statutory: !isPrivate, zusatz, childless, privateKv, other,
    yearsToStart: p.R - p.a0, payYears: p.H - p.R, infl: p.infl,
  }));
  /** KV-Bruttobasis für freiwillig Versicherte: Bruttorente plus weitere Einkünfte (Untergrenze ihres Bruttos). */
  const kvGrossSuggestion = $derived(Math.round((r.gross + Math.max(0, other)) / 100) * 100);
  const pc = (x: number) => x.toLocaleString('de-DE', { maximumFractionDigits: 2 });

  function take() {
    setInput('incRet', r.suggestion);
    showToast('Einkommen im Alter auf ' + eur(r.suggestion) + ' gesetzt.');
  }
  function takeKv() {
    setInput('kvGrossRet', kvGrossSuggestion);
    showToast('KV-Bruttoeinnahmen im Alter auf ' + eur(kvGrossSuggestion) + ' gesetzt.');
  }
</script>

<details class="ph noprint" bind:open data-testid="pension-helper">
  <summary>Einkommen im Alter aus der Bruttorente berechnen</summary>
  {#if open}
    <p class="hint">Die Renteninformation nennt eine Bruttorente. Gesucht ist das zu versteuernde Einkommen: nur der steuerpflichtige Teil, nach Kranken- und Pflegeversicherung. Alles in heutigem Geld. <Info k="renteZve">So wird gerechnet</Info></p>
    <div class="fields">
      <NumberField layout="row" label="Gesetzliche Rente laut Renteninformation, brutto im Monat" value={monthly} onchange={v => (monthly = v)} min={0} step={50} unit="€" limits={[0, 1e6]} testid="ph-monthly"
        hint="„Höhe Ihrer künftigen Regelaltersrente“ (zur Regelaltersgrenze, für ab 1964 Geborene 67). Je Monat früher 0,3 % Abschlag, je Monat später 0,5 % Zuschlag." />
      <NumberField layout="row" label="Rentenbeginn im Jahr" value={year ?? defaultYear} onchange={v => (year = v)} min={2000} max={2100} unit="" allowThousands={false} limits={[1900, 2200]} testid="ph-year"
        hint={'Besteuerungsanteil ' + pc(r.sharePct) + ' %' + (year == null ? ' (aus Alter heute und Rentenbeginn geschätzt)' : '') + '.'} />
      {#if isPrivate}
        <NumberField layout="row" label="Private KV/PV: abziehbarer Beitrag" value={privateKv} onchange={v => (privateKv = v)} min={0} step={100} unit="€/Jahr" limits={[0, 1e6]} testid="ph-private"
          hint="Basisabsicherung laut Bescheinigung der Versicherung, abzüglich Zuschuss der Rentenversicherung." />
      {:else}
        <NumberField layout="row" label="Zusatzbeitrag der Krankenkasse" value={zusatz} onchange={v => (zusatz = v)} min={0} max={10} step={0.1} unit="%" limits={[0, 10]} testid="ph-zusatz"
          hint={'Durchschnitt 2026: ' + pc(ZUSATZ_AVG) + ' %. Du trägst ' + pc(r.kvRatePct ?? 0) + ' % der Rente (halbe KV, volle PV).'} />
        <Switch checked={childless} onchange={v => (childless = v)} label="Kinderlos (Pflege +0,6 %)" />
      {/if}
      <NumberField layout="row" label="Weitere zu versteuernde Einkünfte im Alter" value={other} onchange={v => (other = v)} min={0} step={1000} unit="€/Jahr" limits={[0, 1e8]} testid="ph-other"
        hint="Z. B. Betriebsrente oder Miete, schon nach deren Freibeträgen, Kosten und Beiträgen, aber ohne weiteren Werbungskosten-Pauschbetrag (die 102 € gelten für alle Renten zusammen). Ohne die verglichenen Produkte." />
    </div>
    {#if monthly > 0 || other > 0}
      <table class="calc" data-testid="ph-table">
        <tbody>
          <tr><td>Bruttorente im Jahr</td><td>{eur(r.gross)}</td></tr>
          <tr><td>− Rentenfreibetrag ({pc(100 - r.sharePct)} %, in Euro fest)</td><td>{eur(r.start.free)}</td></tr>
          <tr><td>− Werbungskosten-Pauschbetrag (102 € fest)</td><td>{eur(r.start.wk)}</td></tr>
          <tr><td>− {isPrivate ? 'Private KV/PV' : 'KV/PV des Rentners (' + pc(r.kvRatePct ?? 0) + ' %)'}</td><td>{eur(r.kv)}</td></tr>
          <tr><td>− Sonderausgaben-Pauschbetrag (36 € fest)</td><td>{eur(r.start.sa)}</td></tr>
          {#if other > 0}<tr><td>+ Weitere Einkünfte</td><td>{eur(other)}</td></tr>{/if}
          <tr class="sum"><td>Zu versteuern im ersten Rentenjahr</td><td>{eur(r.start.zve)}</td></tr>
          <tr><td>… im letzten Jahr bis Alter {p.H}</td><td>{eur(r.end.zve)}</td></tr>
          <tr class="sum"><td>Durchschnitt (Vorschlag)</td><td>{eur(r.avg)}</td></tr>
        </tbody>
      </table>
      <p class="hint">Feste Euro-Beträge{r.start.free > 0 ? ' (Rentenfreibetrag, Pauschbeträge)' : ' (Pauschbeträge)'} werden in heutigem Geld mit der Inflation kleiner{r.start.free > 0 ? ', daher steigt der steuerpflichtige Teil über die Jahre' : ''}. Der Vorschlag ist der Durchschnitt über die Auszahljahre bis {p.H}.</p>
      <button type="button" class="btn small" onclick={take} data-testid="ph-take">„Einkommen im Alter“ auf {eur(r.suggestion)} setzen</button>
      {#if voluntary}
        <p class="hint">Freiwillig gesetzlich versichert: Für die Beitragsbemessungsgrenze zählt das Brutto, nicht das zu versteuernde Einkommen. Bruttorente plus weitere Einkünfte: mindestens {eur(kvGrossSuggestion)}.</p>
        <button type="button" class="btn small" onclick={takeKv} data-testid="ph-take-kv">KV-Bruttoeinnahmen auf {eur(kvGrossSuggestion)} setzen</button>
      {/if}
    {/if}
  {/if}
</details>

<style>
  .ph { margin-top: 10px; font-size: .88rem; }
  .ph summary { cursor: pointer; color: var(--accent-text); font-weight: 600; display: inline-flex; align-items: center; gap: 4px; }
  .fields { max-width: 640px; }
  .calc { width: auto; max-width: 560px; border-collapse: collapse; margin: 8px 0; font-variant-numeric: tabular-nums; }
  .calc td { padding: 2px 12px 2px 0; }
  .calc td:last-child { text-align: right; }
  .calc tr.sum td { font-weight: 600; border-top: 1px solid var(--grid); }
  .hint { max-width: 80ch; }
</style>
