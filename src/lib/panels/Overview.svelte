<script lang="ts">
  import { scrollRegion } from '../attach';
  import { PRODUCTS, type Analysis, type Product, type Scenario, type ScenarioId } from '../engine/analyze';
  import { DEFAULTS, INPUT_KEYS, type Inputs } from '../engine/inputs';
  import { eur, eurRound } from '../format';
  import { SITE } from '../site';
  import { rechenweg } from '../rechenweg';
  import { breakEvenText, isFlip, legendName, robustText, tileName, tileSub, verdict } from '../verdict';
  import { costBreakEvens } from '../engine/breakEven';
  import { app, focusField, openKombi, setInputs, setTab, shareUrl, showToast } from '../state.svelte';
  import Icon from '../components/Icon.svelte';
  import Info from '../components/Info.svelte';
  import AssumptionCheck from '../components/AssumptionCheck.svelte';
  import NotInNumbers from '../components/NotInNumbers.svelte';
  import { SPLIT_KEYS } from '../engine/combo';
  import type { ProductKey } from '../engine/core';
  import LineChart, { type Series } from '../components/LineChart.svelte';

  let { A, scen }: { A: Analysis; scen: Scenario[] } = $props();

  const V = $derived(verdict(A, scen));
  // Kosten-Gleichstand mit dem ETF-Depot (je Produkt etwa 10–15 Einzelrechnungen), nur bei fairem Vergleich.
  const breakEvens = $derived(V.kind === 'ok' ? costBreakEvens(A) : []);
  const p = $derived(A.p);
  const res = $derived(A.res);
  const i = $derived(app.inputs);
  /** Noch die Beispielperson? (Die Anzeige-Einheit zählt nicht.) */
  const isExample = $derived(INPUT_KEYS.every(k => k === 'real' || i[k] === DEFAULTS[k]));
  const avdSoon = new Date() < new Date(SITE.avdStartISO + 'T00:00:00');
  const anyLifelong = $derived(A.active.some(pr => res[pr.key]!.lifelong));
  /** Produkte für „Was die Zahlen nicht zeigen“: alle im Vergleich, auch die Teile der Kombi. */
  const ninKeys = $derived(SPLIT_KEYS.filter(k => !!res[k] || (res.kombi?.split[k] ?? 0) > 0) as ProductKey[]);

  // Hinweise wie im Original, neutral formuliert
  const notes = $derived.by(() => {
    const out: string[] = [];
    if (i.R < 65) out.push('Rentenbeginn auf 65 angehoben: Das Altersvorsorgedepot zahlt frühestens mit 65 aus.');
    const refOf = res.avd ?? res.kombi;
    if (A.refundSpent && refOf && (refOf.ref ?? 0) < 0) out.push('Ohne Wiederanlage: Mit dem Partner-Vertrag kostet der eigene Vertrag hier in der gemeinsamen Günstigerprüfung Steuer statt einer Erstattung; ohne Wiederanlage zahlt der Haushalt sie aus eigenem Geld, beim AVD fließt dann netto mehr eigenes Geld hinein als bei den anderen Produkten. Mehrsteuer ' + eur(-((p.real ? refOf.refReal : refOf.ref) ?? 0)) + ' (siehe „Netto-Eigenaufwand“ unter „Rente im Detail“).');
    else if (A.refundSpent && refOf) out.push('Ohne Wiederanlage werden ' + eur((p.real ? refOf.refReal : refOf.ref) ?? 0) + ' Steuererstattung ausgegeben. Beim AVD fließt netto also weniger eigenes Geld hinein als bei den anderen Produkten (siehe „Netto-Eigenaufwand“ unter „Rente im Detail“).');
    if (res.avd && res.avd.noElig! > 0) out.push('Altersvorsorgedepot: In ' + res.avd.noElig + (res.avd.noElig === 1 ? ' Jahr' : ' Jahren') + ' ohne Förderberechtigung fließt der Beitrag ins ETF-Nebendepot statt ins AVD.');
    if (res.avd && (res.avd.unsubOwn ?? 0) > 0) out.push('Altersvorsorgedepot: ' + eur((p.real ? res.avd.unsubOwnReal : res.avd.unsubOwn) ?? 0) + ' der Beiträge liegen über dem Förderhöchstbetrag von 1.800 € im Jahr. Sie bleiben ungefördert im Vertrag: keine Zulage und keine Steuer in der Ansparphase, bei der Auszahlung ist nur der Gewinnanteil steuerpflichtig, nach 12 Jahren Laufzeit zur Hälfte.' + (p.kvOn ? ' Für die Krankenversicherung zählt die ganze Auszahlung.' : ''));
    if (res.avd && res.avd.sideOwn! > 0) out.push('Altersvorsorgedepot: ' + eur(p.real ? res.avd.sideOwnReal! : res.avd.sideOwn!) + ' der Beiträge liegen über dem Höchstbetrag von 6.840 € im Jahr oder fallen in Jahre ohne Förderberechtigung und gehen ins ETF-Nebendepot. Sie sind im AVD-Wert enthalten.');
    return out;
  });

  const cumSeries = $derived<Series[]>(A.active.map(pr => {
    const r = res[pr.key]!; let c = 0; const vals: number[] = [];
    for (let t = A.n; t <= A.T; t++) { vals.push(c); if (t < A.T) c += A.R(r.net[t], t); }
    return { name: legendName(A, pr), short: pr.short, color: pr.color, dash: pr.key === 'kombi', values: vals };
  }));

  const breakEven = $derived.by(() => {
    if (!res.ins || !res.ins.lifelong) return '';
    const ii = A.active.findIndex(a => a.key === 'ins');
    const ins = cumSeries[ii].values as number[];
    const others = cumSeries.filter((_, k) => A.active[k].key !== 'ins');
    if (!others.length || !(ins[ins.length - 1] > 0)) return '';
    const maxOther = ins.map((_, k) => Math.max(...others.map(o => o.values[k] as number)));
    const idx = ins.findIndex((v, k) => k > 0 && v >= maxOther[k]);
    const all = others.length > 1 ? 'jedes andere Produkt im Vergleich' : 'das andere Produkt';
    return idx > 0
      ? 'Die lebenslange Rente der Versicherung hat in Summe erst ab einem Alter von etwa ' + (p.R + idx) + ' Jahren so viel ausgezahlt wie ' + all + '.'
      : 'Bis Alter 100 hat die lebenslange Rente der Versicherung in Summe weniger ausgezahlt als ' + (others.length > 1 ? 'mindestens ein anderes Produkt im Vergleich' : 'das andere Produkt') + '.';
  });

  function equalize() {
    setInputs({ etfM: i.setAll, avdM: i.setAll, insM: i.setAll, fondM: i.setAll });
  }
  const inactive = $derived(PRODUCTS.filter(pr => !i[(pr.key + 'On') as 'etfOn']));
  const contribOf = (pr: Product) => pr.key === 'kombi' ? i.setAll : i[(pr.key + 'M') as 'etfM'];
  const withAvd = $derived(!!res.avd || (res.kombi?.split.avd ?? 0) > 0);

  // --- Szenarien ---
  const ADJUST: Partial<Record<ScenarioId, string>> = { avdCost: 'f-avdCost', insCost: 'f-insEff' };
  const SHORT: Record<string, string> = { etf: 'ETF', avd: 'AVD', ins: 'Vers.', fond: 'Fonds', kombi: 'Kombi' };
  interface Row { id: ScenarioId | 'base'; label: string; a: Analysis; base: boolean; can: boolean; flip: boolean; unfair: boolean }
  const scenRows = $derived.by<Row[]>(() => {
    const base: Row = { id: 'base', label: 'Eingaben wie oben', a: A, base: true, can: A.canRank, flip: false, unfair: false };
    return [base, ...scen.map(s => {
      const can = A.canRank && s.a.canRank;
      return {
        id: s.id, label: s.label, a: s.a, base: false, can,
        flip: can && isFlip(A, s.a),
        unfair: !s.a.canRank && s.a.refundSpent,
      };
    })];
  });
  // Mobil: Eingaben + gekippte Zeilen zuerst, der Rest aufklappbar
  const mTop = $derived(scenRows.filter(r => r.base || r.flip));
  const mRest = $derived(scenRows.filter(r => !r.base && !r.flip));

  function jumpScen() {
    const el = document.getElementById('scen-h');
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
    el.focus({ preventScroll: true });
  }
  function jumpCheck() {
    const el = document.getElementById('ac-h');
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
    el.setAttribute('tabindex', '-1');
    el.focus({ preventScroll: true });
  }
  async function copyRechenweg() {
    const text = rechenweg($state.snapshot(app.inputs) as Inputs, A, shareUrl());
    try {
      await navigator.clipboard.writeText(text);
      showToast('Rechenweg kopiert: Eingaben, Annahmen und Jahreswerte als Text, zum Nachrechnen oder Einfügen in eine KI.');
    } catch {
      // Ohne Zwischenablage (z. B. verweigert oder unsicherer Kontext): als Datei speichern.
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }));
      a.download = 'rechenweg.md';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      showToast('Kopieren ging nicht, der Rechenweg wurde als Datei rechenweg.md gespeichert.');
    }
  }
  async function share() {
    const url = shareUrl();
    try {
      await navigator.clipboard.writeText(url);
      showToast('Link kopiert. Wer ihn öffnet, sieht dieses Szenario – eigene gespeicherte Eingaben werden dabei nicht überschrieben.');
    } catch {
      window.prompt('Link zum Kopieren:', url);
    }
  }
</script>

<section class="verdict card" id="verdict" class:neutral={V.kind !== 'ok'} aria-labelledby="verdict-h" data-testid="verdict">
  <p class="eyebrow">{isExample ? 'Ergebnis für die Beispielwerte' : 'Ergebnis unter diesen Annahmen'}</p>
  <h2 id="verdict-h" tabindex="-1">
    {V.headline}
  </h2>
  {#each V.lines as l}<p>{l}</p>{/each}
  {#if breakEvens.length}
    <ul class="be" data-testid="break-even">
      {#each breakEvens as b (b.key)}<li>{breakEvenText(A, b)}</li>{/each}
    </ul>
  {/if}
  {#if V.robust}
    {@const r = robustText(V.robust)}
    <p data-testid="robust">{r.before}<button type="button" class="linkish" onclick={jumpScen}>{r.link}</button>{r.after}</p>
  {/if}
  {#if V.kind === 'unequal'}
    <div class="acts"><button class="btn primary small" type="button" onclick={equalize}>Alle auf {eur(i.setAll)} im Monat setzen</button></div>
  {:else if V.kind === 'refundSpent'}
    <div class="acts"><button class="btn primary small" type="button" onclick={() => setInputs({ reinvest: true })}>Steuererstattung anlegen</button></div>
  {:else if V.kind === 'needTwo'}
    <div class="acts" data-testid="add-products">
      {#each inactive as pr (pr.key)}
        <button class="btn small" type="button" onclick={() => setInputs({ [pr.key + 'On']: true } as Partial<Inputs>)}><Icon name="plus" />{pr.name}</button>
      {/each}
      {#if !res.kombi}<button class="btn small" type="button" onclick={openKombi} aria-haspopup="dialog"><Icon name="plus" />Kombi</button>{/if}
    </div>
  {/if}
  {#if avdSoon && V.kind === 'ok' && withAvd}
    <p class="fine">Das Altersvorsorgedepot startet am {SITE.avdStart}; gerechnet wird vereinfacht ab heute.</p>
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
    {@const sub = tileSub(A, pr)}
    {@const m = contribOf(pr)}
    <article class="tile" data-testid="tile-{pr.key}">
      <div class="name">
        <div class="nm"><span class="key" style:background={pr.color}></span><span>{tileName(pr)}</span></div>
        {#if sub}<div class="sub">{sub}</div>{/if}
      </div>
      <div class="big">{eur(s.avgMonthly)}</div>
      <div class="unit">netto pro Monat, Ø {p.R}–{p.H}{r.lifelong ? ', danach lebenslang weiter' : ''}</div>
      {#if s.lump > 0}<div class="unit">zzgl. ca. {eurRound(s.lump)} Einmalauszahlung netto</div>{:else}<div></div>{/if}
      <div class="contrib" class:warn={m !== i.setAll} data-testid="contrib-{pr.key}">aus {eur(m)} im Monat{#if m !== i.setAll}<span class="sr-only"> (weicht vom gemeinsamen Beitrag ab)</span>{/if}</div>
      <div class="small">Kapital bei Rentenbeginn ca. {eurRound(A.R(r.capR, A.n))}<br />nach Steuern ca. {eurRound(A.R(r.capNet, A.n))}</div>
      {#if pr.key === 'kombi'}<div class="start noprint"><button type="button" class="linkish" onclick={openKombi} aria-haspopup="dialog" data-testid="kombi-edit">Kombi bearbeiten</button></div>
      {:else if pr.key === 'avd' && avdSoon}<div class="start">Abschluss voraussichtlich ab {SITE.avdStart} <Info k="avd" /></div>{:else}<div></div>{/if}
    </article>
  {/each}
</div>

<AssumptionCheck />

{#snippet scenTable()}
  <p class="hint">Jede Zeile ändert genau eine Annahme. Gezeigt wird Ø netto pro Monat bis zum Ende des Auszahlplans. {#if A.canRank}<span class="flipkey">Gelb</span>: Dann kehrt sich mindestens ein Abstand um, ein anderes Produkt zahlt mehr aus als oben.{/if}</p>
  {#if !A.canRank}<p class="hint">Solange der Vergleich oben nicht fair ist, wird hier nichts markiert.</p>{/if}
  <div class="table-scroll scen-desk" {@attach scrollRegion('Tabelle: Wann sich die Abstände umkehren')}>
    <table class="scen" data-testid="scenarios">
      <thead>
        <tr><th>Szenario</th>
          {#each A.active as pr}<th><span class="th-key"><span class="key" style:background={pr.color}></span>{pr.short}</span></th>{/each}</tr>
      </thead>
      <tbody>
        {#each scenRows as s (s.id)}
          <tr class:flip={s.flip} class:base={s.base} data-sid={s.id}>
            <td>{#if s.base}<strong>{s.label}</strong>{:else}{s.label}{/if}{#if s.id === 'refund'}&nbsp;<Info k="reinvest" />{/if}{#if s.flip}<span class="sr-only"> (ein Abstand kehrt sich um)</span>{/if}{#if s.unfair}<span class="muted small"> · nicht fair vergleichbar</span>{/if}
              {#if s.id !== 'base' && ADJUST[s.id]}<button type="button" class="linkish adj noprint" onclick={() => focusField('settings', ADJUST[s.id as ScenarioId]!)} aria-label="Kosten anpassen: {s.label}">anpassen</button>{/if}</td>
            {#each A.active as pr}
              {@const v = s.a.stats[pr.key]}
              <td data-label={pr.short}>{v ? eur(v.avgMonthly) : '–'}</td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  <!-- Mobil: kompakte Liste, gekippte Zeilen zuerst -->
  {#snippet mRow(s: Row)}
    <li class:flip={s.flip} class:base={s.base}>
      <div class="m-top">
        <span class="m-label">{#if s.base}<strong>{s.label}</strong>{:else}{s.label}{/if}{#if s.flip}<span class="sr-only"> (ein Abstand kehrt sich um)</span>{/if}</span>
        {#if s.unfair}<span class="m-chip muted">nicht fair vergleichbar</span>{/if}
      </div>
      <div class="m-vals">{A.active.map(pr => SHORT[pr.key] + ' ' + (s.a.stats[pr.key] ? eur(s.a.stats[pr.key]!.avgMonthly) : '–')).join(' · ')}
        {#if s.id !== 'base' && ADJUST[s.id]}<button type="button" class="linkish adj" onclick={() => focusField('settings', ADJUST[s.id as ScenarioId]!)} aria-label="Kosten anpassen: {s.label}">anpassen</button>{/if}</div>
    </li>
  {/snippet}
  <div class="scen-mob" data-testid="scenarios-mobile">
    <ul>{#each mTop as s (s.id)}{@render mRow(s)}{/each}</ul>
    {#if mRest.length}
      <details class="m-more">
        <summary>{mTop.length > 1 ? 'Weitere ' + mRest.length + ' Szenarien anzeigen' : 'Alle ' + mRest.length + ' Szenarien anzeigen (in keinem kehrt sich ein Abstand um)'}</summary>
        <ul>{#each mRest as s (s.id)}{@render mRow(s)}{/each}</ul>
      </details>
    {/if}
  </div>
{/snippet}

{#if V.kind !== 'needTwo'}
  <section class="card" aria-labelledby="scen-h">
    <div class="card-head">
      <h2 id="scen-h" tabindex="-1">Wann sich die Abstände umkehren</h2>
    </div>
    {#if V.kind === 'unequal'}
      <details class="collapsed">
        <summary>Szenarien erst bei gleichen Beiträgen aussagekräftig</summary>
        {@render scenTable()}
      </details>
    {:else}
      {@render scenTable()}
    {/if}
  </section>
{/if}

{#if ninKeys.length}<NotInNumbers {p} keys={ninKeys} />{/if}

<section class="card" aria-labelledby="cum-h">
  <div class="card-head"><h2 id="cum-h">Summe aller Netto-Auszahlungen ab Rentenbeginn</h2></div>
  <LineChart title="Summe aller Netto-Auszahlungen ab Rentenbeginn nach Alter" x0={p.R} series={cumSeries}
    marker={{ x: p.H, label: 'Auszahlplan-Ende' }} tipTitle={x => 'Bis Alter ' + x + ' ausgezahlt (netto)'}
    xMax={anyLifelong ? undefined : Math.min(100, p.H + 3)} />
  {#if breakEven}<p class="hint below">{breakEven}</p>{/if}
  {#if !anyLifelong}<p class="hint below">Danach zahlt kein Produkt mehr aus.</p>{/if}
  <p class="hint below noprint">Mehr Details zu Kapital, Förderung und Kosten unter <button type="button" class="linkish" onclick={() => setTab('detail')}>Rente im Detail</button>. Begriffe wie <Info k="vorabpauschale">Vorabpauschale</Info> oder <Info k="guenstiger">Günstigerprüfung</Info> lassen sich per Klick erklären.</p>
</section>

<section class="card next" aria-labelledby="next-h" data-testid="next-steps">
  <h2 id="next-h">So geht's weiter</h2>
  <ol>
    <li><span>Prüfe die Annahmen, die das Ergebnis am stärksten verändern.</span>
      <button type="button" class="linkish noprint" onclick={jumpCheck}>Zum Annahmen-Check</button></li>
    <li><span>Speichere das Ergebnis als PDF, teile den Link oder kopiere den Rechenweg zum Nachprüfen.</span>
      <span class="noprint btns"><button type="button" class="linkish" onclick={() => window.print()}>Drucken / PDF</button>
        <button type="button" class="linkish" onclick={share}>Link kopieren</button>
        <button type="button" class="linkish" onclick={copyRechenweg} data-testid="copy-rechenweg">Rechenweg kopieren</button></span></li>
    <li><span>Vor einem Abschluss: die Kosten im Produktinformationsblatt vergleichen (<Info k="effektivkosten">Effektivkosten</Info>).</span></li>
    <li><span>Bei Fragen zur eigenen Situation helfen unabhängige Stellen, zum Beispiel die Verbraucherzentralen.</span></li>
  </ol>
  <p class="hint">Modellrechnung unter den angegebenen Annahmen, keine Anlage-, Steuer- oder Rechtsberatung.</p>
</section>

<style>
  .verdict { border-left: 4px solid var(--accent); padding-top: 16px; scroll-margin-top: 64px; }
  .verdict.neutral { border-left-color: var(--warn-border); }
  .eyebrow { font-size: .75rem; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); margin-bottom: 6px; }
  .verdict h2 { font-size: clamp(1.1rem, 1rem + .6vw, 1.4rem); font-weight: 650; margin-bottom: 8px; line-height: 1.35; }
  .verdict h2:focus { outline: none; }
  .verdict p { color: var(--text-2); max-width: 75ch; }
  .verdict .fine { font-size: .78rem; color: var(--muted); margin: 10px 0 0; }
  .verdict .fine + .fine { margin-top: 2px; }
  .be { margin: 6px 0 8px; padding-left: 20px; color: var(--text-2); max-width: 75ch; }
  .be li { margin: 3px 0; }
  .acts { margin: 8px 0 4px; display: flex; flex-wrap: wrap; gap: 8px; }
  .notes { margin-top: 12px; }
  .tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 0 12px; margin: 16px 0 4px; }
  /* Subgrid: Name, Betrag und Kapital stehen in allen Kacheln auf gleicher Höhe */
  .tile {
    display: grid; grid-row: span 7; grid-template-rows: subgrid; row-gap: 0; margin-bottom: 12px;
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
    padding: 14px 16px; box-shadow: var(--shadow);
  }
  .tile .nm { display: flex; align-items: center; gap: 8px; color: var(--text-2); font-size: .85rem; font-weight: 550; }
  .tile .sub { font-size: .75rem; color: var(--muted); margin: 1px 0 0 22px; }
  .tile .big { font-size: 1.85rem; font-weight: 700; letter-spacing: -0.02em; margin: 6px 0 0; line-height: 1.15; }
  .tile .unit { font-size: .78rem; color: var(--muted); }
  .tile .contrib { font-size: .8rem; color: var(--text-2); padding-top: 10px; align-self: end; }
  .tile .contrib.warn { color: var(--warn-text); font-weight: 600; }
  .tile .small { font-size: .8rem; color: var(--text-2); padding-top: 2px; line-height: 1.45; }
  .tile .start { font-size: .75rem; color: var(--muted); padding-top: 6px; display: flex; align-items: center; gap: 2px; }
  #scen-h:focus { outline: none; }
  #scen-h { scroll-margin-top: 64px; }
  .scen tr.flip td { background: var(--flip-bg); }
  .scen tr.base td { background: var(--surface-2); }
  .scen th:first-child, .scen td:first-child { padding-left: 8px; }
  .adj { margin-left: 8px; font-size: .8rem; }
  .small { font-size: .8rem; }
  .collapsed summary { cursor: pointer; color: var(--text-2); font-size: .9rem; padding: 2px 0 6px; }
  .scen-mob { display: none; }
  /* Mobil: kompakte Liste statt Tabelle (U13) */
  @media (max-width: 640px) {
    .scen-desk { display: none; }
    .scen-mob { display: block; }
    .scen-mob ul { list-style: none; margin: 0; padding: 0; }
    .scen-mob li { padding: 9px 8px; border-bottom: 1px solid var(--grid); border-radius: 8px; }
    .scen-mob li.flip { background: var(--flip-bg); }
    .scen-mob li.base { background: var(--surface-2); }
    .m-top { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
    .m-label { font-size: .88rem; min-width: 0; }
    .m-chip { flex: none; display: inline-flex; align-items: center; gap: 6px; font-size: .8rem; font-weight: 650; }
    .m-chip.muted { font-weight: 400; font-size: .75rem; }
    .m-vals { font-size: .78rem; color: var(--muted); margin-top: 2px; font-variant-numeric: tabular-nums; }
    .m-more summary { cursor: pointer; color: var(--accent-text); font-size: .88rem; font-weight: 550; padding: 10px 8px 4px; }
  }
  .flipkey { background: var(--flip-bg); padding: 0 4px; border-radius: 3px; color: var(--text); }
  .below { margin: 10px 0 0; }
  .linkish { font: inherit; color: var(--accent-text); background: none; border: 0; padding: 0; text-decoration: underline; text-underline-offset: 2px; cursor: pointer; }
  .adj.linkish { font-size: .8rem; }
  .next ol { margin: 8px 0 10px; padding-left: 20px; color: var(--text-2); font-size: .9rem; }
  .next li { margin: 6px 0; }
  .next li > span:first-child { margin-right: 8px; }
  .next .btns { display: inline-flex; gap: 12px; }
  .next .hint { margin: 0; font-size: .8rem; }
  @media print {
    .acts { display: none; }
    .tiles { grid-template-columns: none; grid-auto-flow: column; grid-auto-columns: 1fr; }
    .verdict, .tile, .next { break-inside: avoid; }
    .scen-desk { display: block !important; }
    .scen-mob { display: none !important; }
  }
</style>
