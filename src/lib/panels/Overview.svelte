<script lang="ts">
  import { scrollRegion } from '../attach';
  import type { Analysis, Scenario } from '../engine/analyze';
  import { eur } from '../format';
  import { verdict } from '../verdict';
  import { app, setInputs, setTab } from '../state.svelte';
  import Icon from '../components/Icon.svelte';
  import Info from '../components/Info.svelte';
  import LineChart, { type Series } from '../components/LineChart.svelte';

  let { A, scen }: { A: Analysis; scen: Scenario[] } = $props();

  const V = $derived(verdict(A, scen));
  const p = $derived(A.p);
  const res = $derived(A.res);

  // Hinweise wie im Original, neutral formuliert
  const notes = $derived.by(() => {
    const out: string[] = [];
    if (app.inputs.R < 65) out.push('Rentenbeginn auf 65 angehoben: Das Altersvorsorgedepot zahlt frühestens mit 65 aus.');
    if (A.refundSpent) out.push('Ohne Wiederanlage werden ' + eur(p.real ? res.avd!.refReal! : res.avd!.ref!) + ' Steuererstattung ausgegeben. Beim AVD fließt netto also weniger eigenes Geld hinein als bei den anderen Produkten (siehe „Netto-Eigenaufwand“ unter „Rente im Detail“).');
    if (res.avd && res.avd.noElig! > 0) out.push('Altersvorsorgedepot: In ' + res.avd.noElig + (res.avd.noElig === 1 ? ' Jahr' : ' Jahren') + ' ohne Förderberechtigung fließt der Beitrag ins ETF-Nebendepot statt ins AVD.');
    if (res.avd && res.avd.sideOwn! > 0) out.push('Altersvorsorgedepot: ' + eur(p.real ? res.avd.sideOwnReal! : res.avd.sideOwn!) + ' der Beiträge sind nicht förderfähig (über 150 € im Monat oder ohne Förderberechtigung) und gehen ins ETF-Nebendepot. Sie sind im AVD-Wert enthalten.');
    return out;
  });

  const cumSeries = $derived<Series[]>(A.active.map(pr => {
    const r = res[pr.key]!; let c = 0; const vals: number[] = [];
    for (let t = A.n; t <= A.T; t++) { vals.push(c); if (t < A.T) c += A.R(r.net[t], t); }
    return { name: pr.name, short: pr.short, color: pr.color, values: vals };
  }));

  const breakEven = $derived.by(() => {
    if (!res.ins || !res.ins.lifelong) return '';
    const ii = A.active.findIndex(a => a.key === 'ins');
    const ins = cumSeries[ii].values as number[];
    const others = cumSeries.filter((_, i) => A.active[i].key !== 'ins');
    if (!others.length || !(ins[ins.length - 1] > 0)) return '';
    const bestOther = ins.map((_, i) => Math.max(...others.map(o => o.values[i] as number)));
    const idx = ins.findIndex((v, i) => i > 0 && v >= bestOther[i]);
    return idx > 0
      ? 'Die lebenslange Rente der Versicherung holt die beste Alternative erst ein, wenn man etwa ' + (p.R + idx) + ' Jahre alt wird.'
      : 'Die lebenslange Rente der Versicherung holt die beste Alternative bis Alter 100 nicht ein.';
  });

  function equalize() {
    setInputs({ etfM: app.inputs.setAll, avdM: app.inputs.setAll, insM: app.inputs.setAll, fondM: app.inputs.setAll });
  }
</script>

<section class="verdict card" class:neutral={V.kind !== 'ok'} aria-labelledby="verdict-h" data-testid="verdict">
  <p class="eyebrow">Ergebnis unter diesen Annahmen</p>
  <h2 id="verdict-h">
    {#if V.kind === 'ok' && A.lead}<span class="key big" style:background={A.lead.color}></span>{/if}
    {V.headline}
  </h2>
  {#each V.lines as l}<p>{l}</p>{/each}
  {#if V.kind === 'unequal'}
    <div class="acts"><button class="btn primary small" type="button" onclick={equalize}>Alle auf {eur(app.inputs.setAll)} im Monat setzen</button></div>
  {:else if V.kind === 'refundSpent'}
    <div class="acts"><button class="btn primary small" type="button" onclick={() => setInputs({ reinvest: true })}>Steuererstattung anlegen</button></div>
  {/if}
  <p class="fine">{p.real ? 'Beträge in heutiger Kaufkraft.' : 'Nominale Beträge (Euro der Zukunft).'} Modellrechnung mit konstanter Rendite, keine Anlageberatung.</p>
</section>

{#if notes.length}
  <div class="notes" role="status">
    {#each notes as n}<div class="note"><Icon name="alert" />{n}</div>{/each}
  </div>
{/if}

<div class="tiles">
  {#each A.active as pr (pr.key)}
    {@const r = res[pr.key]!}
    {@const s = A.stats[pr.key]!}
    {@const isLead = A.canRank && A.lead?.key === pr.key}
    <article class="tile" class:lead={isLead} data-testid="tile-{pr.key}">
      <div class="name"><span class="key" style:background={pr.color}></span><span>{pr.name}</span>
        {#if isLead}<span class="badge"><Icon name="check" size={12} />vorne</span>{/if}</div>
      <div class="big">{eur(s.avgMonthly)}</div>
      <div class="unit">netto pro Monat, Ø {p.R}–{p.H}{r.lifelong ? ', danach lebenslang weiter' : ''}</div>
      {#if s.lump > 0}<div class="unit">zzgl. {eur(s.lump)} Einmalauszahlung netto</div>{/if}
      {#if !(s.lump > 0)}<div></div>{/if}
      <div class="small">Kapital bei Rentenbeginn {eur(A.R(r.capR, A.n))}<br />nach Steuern ca. {eur(A.R(r.capNet, A.n))}</div>
    </article>
  {/each}
</div>

<section class="card" aria-labelledby="scen-h">
  <div class="card-head">
    <h2 id="scen-h">Was das Ergebnis kippen würde</h2>
  </div>
  <p class="hint">Ø netto pro Monat von Rentenbeginn bis Auszahlplan-Ende, jeweils mit nur <em>einer</em> geänderten Annahme. „Vorne“ = meistes Netto-Geld bis Auszahlplan-Ende. <span class="flipkey">Markiert</span>: Ein anderes Produkt liegt vorne als mit den Eingaben oben.</p>
  <div class="table-scroll" {@attach scrollRegion('Tabelle: Was das Ergebnis kippen würde')}>
    <table class="scen" data-testid="scenarios">
      <thead>
        <tr><th>Szenario</th>
          {#each A.active as pr}<th><span class="th-key"><span class="key" style:background={pr.color}></span>{pr.short}</span></th>{/each}
          <th>Vorne</th></tr>
      </thead>
      <tbody>
        {#each [{ label: 'Eingaben wie oben', a: A, base: true }, ...scen.map(s => ({ ...s, base: false }))] as s}
          {@const lead = s.a.lead}
          {@const flip = !s.base && lead && A.lead && lead.key !== A.lead.key}
          <tr class:flip class:base={s.base}>
            <td>{#if s.base}<strong>{s.label}</strong>{:else}{s.label}{/if}{#if flip}<span class="sr-only"> (anderes Produkt vorne)</span>{/if}</td>
            {#each A.active as pr}
              {@const v = s.a.stats[pr.key]}
              <td class:best={lead && lead.key === pr.key} data-label={pr.short}>{v ? eur(v.avgMonthly) : '–'}</td>
            {/each}
            <td data-label="Vorne">{lead ? lead.short : '–'}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</section>

<section class="card" aria-labelledby="cum-h">
  <div class="card-head"><h2 id="cum-h">Summe aller Netto-Auszahlungen ab Rentenbeginn</h2></div>
  <LineChart title="Summe aller Netto-Auszahlungen ab Rentenbeginn nach Alter" x0={p.R} series={cumSeries} marker={{ x: p.H, label: 'Auszahlplan-Ende' }} />
  {#if breakEven}<p class="hint below">{breakEven}</p>{/if}
  <p class="hint below">Mehr Details zu Kapital, Förderung und Kosten unter <button type="button" class="linkish" onclick={() => setTab('detail')}>Rente im Detail</button>. Begriffe wie <Info k="vorabpauschale">Vorabpauschale</Info> oder <Info k="guenstiger">Günstigerprüfung</Info> lassen sich per Klick erklären.</p>
</section>

<style>
  .verdict { border-left: 4px solid var(--accent); padding-top: 16px; }
  .verdict.neutral { border-left-color: var(--warn-border); }
  .eyebrow { font-size: .75rem; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); margin-bottom: 6px; }
  .verdict h2 { font-size: clamp(1.1rem, 1rem + .6vw, 1.4rem); font-weight: 650; margin-bottom: 8px; line-height: 1.35; }
  .verdict h2 .key.big { width: 18px; height: 4px; vertical-align: middle; margin-right: 6px; position: relative; top: -2px; }
  .verdict p { color: var(--text-2); max-width: 75ch; }
  .verdict .fine { font-size: .78rem; color: var(--muted); margin: 10px 0 0; }
  .acts { margin: 8px 0 4px; }
  .notes { margin-top: 12px; }
  .tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 0 12px; margin: 16px 0 4px; }
  /* Subgrid: Name, Betrag und Kapital stehen in allen Kacheln auf gleicher Höhe */
  .tile {
    display: grid; grid-row: span 5; grid-template-rows: subgrid; row-gap: 0; margin-bottom: 12px;
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
    padding: 14px 16px; box-shadow: var(--shadow);
  }
  .tile.lead { border-color: color-mix(in srgb, var(--good) 45%, transparent); }
  .tile .name { display: flex; align-items: center; gap: 8px; color: var(--text-2); font-size: .85rem; font-weight: 550; }
  .tile .big { font-size: 1.85rem; font-weight: 700; letter-spacing: -0.02em; margin: 6px 0 0; line-height: 1.15; }
  .tile .unit { font-size: .78rem; color: var(--muted); }
  .tile .small { font-size: .8rem; color: var(--text-2); padding-top: 10px; line-height: 1.45; align-self: end; }
  .badge {
    margin-left: auto; display: inline-flex; align-items: center; gap: 3px;
    font-size: .72rem; font-weight: 650; padding: 1px 8px 1px 6px; border-radius: 999px;
    color: var(--good); background: var(--good-soft);
  }
  .scen tr.flip td { background: var(--flip-bg); }
  .scen tr.base td { background: var(--surface-2); }
  .scen th:first-child, .scen td:first-child { padding-left: 8px; }
  /* Mobil: jede Szenario-Zeile als kompakte Karte statt breiter Tabelle */
  @media (max-width: 640px) {
    .scen thead { display: none; }
    .scen, .scen tbody { display: block; }
    .scen tr { display: flex; flex-wrap: wrap; gap: 2px 14px; padding: 10px 8px; border-bottom: 1px solid var(--grid); border-radius: 8px; }
    .scen td { display: block; border: 0; padding: 0; text-align: left; }
    .scen td:first-child { flex-basis: 100%; padding: 0 0 4px; }
    .scen td[data-label]::before { content: attr(data-label) ' '; color: var(--muted); font-weight: 400; font-size: .78rem; margin-right: 2px; }
    .scen tr.flip td, .scen tr.base td { background: none; }
    .scen tr.flip { background: var(--flip-bg); }
    .scen tr.base { background: var(--surface-2); }
    .scen tbody tr:last-child { border-bottom: 0; }
  }
  .flipkey { background: var(--flip-bg); padding: 0 4px; border-radius: 3px; color: var(--text); }
  .below { margin: 10px 0 0; }
  .linkish { font: inherit; color: var(--accent-text); background: none; border: 0; padding: 0; text-decoration: underline; text-underline-offset: 2px; cursor: pointer; }
  @media print { .acts { display: none; } .tiles { grid-template-columns: repeat(4, 1fr); } }
</style>
