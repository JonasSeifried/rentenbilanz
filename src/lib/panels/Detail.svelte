<script lang="ts">
  import { scrollRegion } from '../attach';
  import type { Analysis, Product } from '../engine/analyze';
  import { ERTRAG } from '../engine/core';
  import { eur } from '../format';
  import { splitText } from '../comboVerdict';
  import { app, setInput } from '../state.svelte';
  import NumberField from '../components/NumberField.svelte';
  import Switch from '../components/Switch.svelte';
  import Info from '../components/Info.svelte';
  import LineChart, { type Series } from '../components/LineChart.svelte';

  let { A }: { A: Analysis } = $props();
  const p = $derived(A.p);
  const res = $derived(A.res);
  const i = $derived(app.inputs);

  type Row = { label: string; f: (pr: Product) => number; info?: 'guenstiger' };
  const rows = $derived.by<Row[]>(() => [
    { label: 'Eigene Einzahlungen', f: A.ownOf },
    ...(A.refundSpent ? [{ label: 'Netto-Eigenaufwand (Einzahlungen − ausgegebene Steuererstattung)', f: (pr: Product) => A.ownOf(pr) - (pr.key === 'avd' || pr.key === 'kombi' ? ((p.real ? res[pr.key]!.refReal : res[pr.key]!.ref) ?? 0) : 0) } as Row] : []),
    { label: 'Staatliche Förderung (Zulagen + Steuervorteil)', f: pr => p.real ? res[pr.key]!.foerderReal : res[pr.key]!.foerder, info: 'guenstiger' },
    { label: 'Kosten bis Rentenbeginn (entgangener Ertrag)', f: pr => A.R(res[pr.key]!.cost, A.n) },
    { label: 'Kapital bei Rentenbeginn (vor Steuern)', f: pr => A.R(res[pr.key]!.capR, A.n) },
    { label: 'Kapital bei Rentenbeginn nach Einkommensteuer (geschätzt)', f: pr => A.R(res[pr.key]!.capNet, A.n) },
    { label: 'Netto pro Monat, Ø ' + p.R + '–' + p.H + ' (ohne Einmalauszahlung)', f: pr => A.stats[pr.key]!.avgMonthly },
    { label: 'Summe netto bis Alter ' + p.H, f: pr => A.stats[pr.key]!.cumH },
    { label: 'Summe netto bis Alter 100', f: pr => A.stats[pr.key]!.cum100 },
  ]);

  // Keine Hervorhebung des größten oder kleinsten Werts: Der Rechner zeigt Zahlen, keinen Sieger.
  const cells = (row: Row) => A.active.map(row.f);

  const notes = $derived.by(() => {
    const out: string[] = ['„Nach Einkommensteuer“: ETF/Fonds bei komplettem Verkauf, AVD bei Entnahme über den Auszahlplan (grob), Versicherung bei Kapitalauszahlung. Ohne Krankenversicherung.'];
    if (res.avd) out.push('AVD: Zulagen ' + eur(p.real ? res.avd.zulReal! : res.avd.zul!) + (res.avd.ref! < 0
      ? ', Mehrsteuer durch die gemeinsame Günstigerprüfung mit dem Partner-Vertrag ' + eur(-(p.real ? res.avd.refReal! : res.avd.ref!)) + (p.reinvest ? ' (aus dem ETF-Nebendepot bezahlt, ein ungedeckter Rest bei Rentenbeginn abgezogen)' : ' (aus eigenem Geld bezahlt)') + '.'
      : ', zusätzliche Steuererstattungen ' + eur(p.real ? res.avd.refReal! : res.avd.ref!) + (p.reinvest ? ' (im ETF-Nebendepot angelegt)' : ' (ausgegeben)') + '. Die Erstattungen sind zum Teil nur Steuerstundung, weil die Auszahlungen später voll steuerpflichtig sind.') + ' Kapital bei Rentenbeginn: AVD-Vertrag ' + eur(A.R(res.avd.capAVD!, A.n)) + ((res.avd.unsubOwn ?? 0) > 0 ? ' (darin ungeförderte Beiträge ' + eur((p.real ? res.avd.unsubOwnReal : res.avd.unsubOwn) ?? 0) + ' mit ihren Erträgen)' : '') + ', ETF-Nebendepot ' + eur(A.R(res.avd.sideR!, A.n)) + '.' + (Number(res.avd.zulSpouse ?? 0) > 0 ? ' Zulage auf den Vertrag des Partners (mittelbar, nicht im Ergebnis enthalten): ' + eur(Number(res.avd.zulSpouse)) + ' nominal.' : ''));
    if (res.ins) out.push(res.ins.lump
      ? 'Versicherung: Kapitalauszahlung ' + eur(A.R(res.ins.kapNet!, A.n)) + ' nach Steuern' + (p.kvOn ? ' (die Krankenversicherungsbeiträge darauf fallen über 10 Jahre verteilt an und sind hier noch nicht abgezogen)' : '') + ', angelegt im ETF und bis ' + p.H + ' entnommen. Alternativ lebenslange Rente: ' + eur(A.R(res.ins.annual! / 12, A.n)) + ' brutto im Monat (Ertragsanteil ' + ERTRAG[p.R] + ' %).'
      : 'Versicherung: Bruttorente ' + eur(A.R(res.ins.annual! / 12, A.n)) + ' im Monat, besteuert mit Ertragsanteil ' + ERTRAG[p.R] + ' %. Alternativ Kapitalauszahlung: ' + eur(A.R(res.ins.kapNet!, A.n)) + ' nach Steuern.');
    if (res.kombi) out.push('Kombi (' + splitText(res.kombi.split, 'short') + '): alle Teile gemeinsam gerechnet, mit einem Steuertarif, einem Sparer-Pauschbetrag für alle Depots und einer gemeinsamen Beitragsbemessungsgrenze der Krankenversicherung. „Nach Einkommensteuer“: alle Depots mit einem Pauschbetrag verkauft.' + (Number(res.kombi.combo.parts.avd?.zulSpouse ?? 0) > 0 ? ' Zulage auf den Vertrag des Partners (mittelbar, nicht im Ergebnis enthalten): ' + eur(Number(res.kombi.combo.parts.avd!.zulSpouse)) + ' nominal.' : ''));
    return out;
  });

  const wealth = $derived<Series[]>(A.active.map(pr => ({
    name: pr.name, short: pr.short, color: pr.color, dash: pr.key === 'kombi',
    values: res[pr.key]!.vals.map((v, t) => v == null ? null : A.R(v, t)),
  })));
  const wealthHint = $derived(!res.ins ? '' : res.ins.lump
    ? 'Versicherung: Bei Rentenbeginn wird das Guthaben ausgezahlt, versteuert und in einen ETF-Auszahlplan gesteckt, daher der Knick.'
    : 'Versicherung: Bei Rentenbeginn wird das Guthaben in die lebenslange Rente umgewandelt und ist danach nicht mehr sichtbar.');
</script>

<h2 class="print-only print-h">Rente im Detail</h2>
<div class="layout">
  <section class="card side" aria-labelledby="pay-h">
    <h2 id="pay-h">Auszahlphase</h2>
    <NumberField layout="row" label="Auszahlplan bis Alter" value={i.H} onchange={v => setInput('H', v)} min={85} max={100} unit="J." info="auszahlplan"
      clampNote={v => { const c = Math.min(100, Math.max(Math.max(85, p.R + 1), Math.round(v))); return c !== v ? 'Gerechnet wird mit ' + c + '.' : null; }} />
    <NumberField layout="row" label="Rendite in der Rente (vor Kosten)" value={i.gPay} onchange={v => setInput('gPay', v)} step={0.5} unit="%" info="rendite"
      hint="In der Rente meist vorsichtiger angelegt, daher niedriger als in der Ansparphase." />

    <h3><span class="key" style:background="var(--s2)"></span>Altersvorsorgedepot</h3>
    <Switch checked={i.einmal} onchange={v => setInput('einmal', v)} label="30 % Einmalauszahlung bei Rentenbeginn" info="einmal" />

    <h3><span class="key" style:background="var(--s3)"></span>Rentenversicherung</h3>
    <Switch id="f-insLump" checked={i.insLump} onchange={v => setInput('insLump', v)} label="Kapitalauszahlung statt lebenslanger Rente" info="kapitalauszahlung" testid="insLump"
      hint={i.insLump ? 'Guthaben wird bei Rentenbeginn ausgezahlt, versteuert und bis zum Ende des Auszahlplans aus einem ETF entnommen.' : 'Lebenslange Rente nach Rentenfaktor, versteuert mit Ertragsanteil.'} />
    <NumberField layout="row" label="Rentenfaktor je 10.000 €" value={i.rf} onchange={v => setInput('rf', v)} min={0} unit="€/Mon." info="rentenfaktor" />
    <NumberField layout="row" label="Rentengarantiezeit" value={i.gz} onchange={v => setInput('gz', v)} min={0} max={30} unit="J." info="garantiezeit" />
    <p class="hint">Rentenfaktor und Garantiezeit stehen im Angebot und zählen nur bei lebenslanger Rente.</p>
  </section>

  <div class="main">
    <section class="card" aria-labelledby="cmp-h">
      <div class="card-head"><h2 id="cmp-h">Vergleich</h2></div>
      <div class="table-scroll" {@attach scrollRegion('Tabelle: Vergleich')}>
        <table data-testid="detail-table">
          <thead><tr><th><span class="sr-only">Kennzahl</span></th>
            {#each A.active as pr}<th><span class="th-key"><span class="key" style:background={pr.color}></span>{pr.short}</span></th>{/each}</tr></thead>
          <tbody>
            {#each rows as row}
              <tr><td>{row.label}{#if row.info}&nbsp;<Info k={row.info} />{/if}</td>
                {#each cells(row) as v}<td>{eur(v)}</td>{/each}</tr>
            {/each}
          </tbody>
        </table>
      </div>
      <ul class="dnotes">{#each notes as n}<li>{n}</li>{/each}</ul>
    </section>

    <section class="card" aria-labelledby="wealth-h">
      <div class="card-head"><h2 id="wealth-h">Vermögen im Zeitverlauf</h2></div>
      <LineChart title="Vermögen im Zeitverlauf nach Alter" x0={p.a0} series={wealth} marker={{ x: p.R, label: 'Rentenbeginn' }} />
      {#if wealthHint}<p class="hint below">{wealthHint}</p>{/if}
    </section>
  </div>
</div>

<style>
  .layout { display: grid; grid-template-columns: minmax(280px, 340px) 1fr; gap: 16px; align-items: start; }
  .main { min-width: 0; }
  @media (max-width: 920px) { .layout { grid-template-columns: 1fr; } }
  .side h2 { margin-bottom: 6px; }
  .side h3 { display: flex; align-items: center; gap: 8px; margin: 18px 0 2px; padding-top: 14px; border-top: 1px solid var(--grid); }
  .dnotes { margin: 12px 0 0; padding-left: 18px; color: var(--text-2); font-size: .82rem; }
  .dnotes li { margin: 4px 0; }
  .below { margin: 10px 0 0; }
  .print-h { margin: 0 0 10px; }
  @media print {
    .layout { grid-template-columns: 1fr; }
  }
</style>
