<script lang="ts">
  import { scrollRegion } from '../attach';
  import type { Analysis } from '../engine/analyze';
  import type { HeirValue, ProductKey } from '../engine/core';
  import { eur } from '../format';
  import { app, setInput } from '../state.svelte';
  import NumberField from '../components/NumberField.svelte';
  import Switch from '../components/Switch.svelte';
  import Info from '../components/Info.svelte';
  import LineChart, { type Series } from '../components/LineChart.svelte';

  let { A }: { A: Analysis } = $props();
  const p = $derived(A.p);
  const res = $derived(A.res);
  const i = $derived(app.inputs);

  interface HeirRow { name: string; short: string; color: string; dash?: boolean; f: (idx: number) => HeirValue }
  const heirRows = $derived.by<HeirRow[]>(() => {
    const out: HeirRow[] = [];
    A.active.forEach(pr => {
      if (pr.key === 'kombi') {
        // Alle Teile gemeinsam versteuert (combo.ts, Abschnitt 8); mit AVD-Teil wie beim AVD zwei Zeilen.
        const k = res.kombi!;
        if (k.heirMarried) {
          out.push({ name: 'Kombi – Ehepartner erbt', short: 'Kombi verh.', color: pr.color, f: x => k.heirMarried!(x) });
          out.push({ name: 'Kombi – Kinder / Partner ohne Trauschein', short: 'Kombi ledig', color: pr.color, dash: true, f: x => k.heir(x) });
        } else out.push({ name: pr.name, short: pr.short, color: pr.color, dash: true, f: x => k.heir(x) });
      } else if (pr.key === 'avd') {
        out.push({ name: 'AVD – Ehepartner erbt', short: 'AVD verh.', color: pr.color, f: k => res.avd!.heirMarried!(k) });
        out.push({ name: 'AVD – Kinder / Partner ohne Trauschein', short: 'AVD ledig', color: pr.color, dash: true, f: k => res.avd!.heir(k) });
      } else out.push({ name: pr.name, short: pr.short, color: pr.color, f: k => res[pr.key as ProductKey]!.heir(k) });
    });
    return out;
  });

  const tD = $derived(p.deathAge - p.a0);
  const heirVals = $derived(heirRows.map(h => h.f(tD)));
  const maxH = $derived(Math.max(...heirVals.map(h => h.val)));
  const markHeir = $derived(maxH > 0 && heirRows.length > 1 && new Set(heirVals.map(h => Math.round(h.val))).size > 1);

  const series = $derived.by<Series[]>(() => {
    const ages = Array.from({ length: A.T }, (_, k) => k + 1);
    return heirRows.map(row => ({ name: row.name, short: row.short, color: row.color, dash: row.dash, values: ages.map(k => A.R(row.f(k).val, k)) }));
  });
</script>

<div class="layout">
  <section class="card side" aria-labelledby="heir-in-h">
    <h2 id="heir-in-h">Annahmen Erbfall</h2>
    <NumberField layout="row" label="Angenommenes Todesalter" value={i.deathAge} onchange={v => setInput('deathAge', v)} min={p.a0 + 1} max={100} unit="J." testid="deathAge"
      clampNote={v => { const c = Math.min(100, Math.max(p.a0 + 1, Math.round(v))); return c !== v ? 'Gerechnet wird mit ' + c + '.' : null; }} />
    <Switch checked={i.heirHalf} onchange={v => setInput('heirHalf', v)} label="Erbe ist bei der Auszahlung mindestens 62 (AVD-Erträge nur zur Hälfte steuerpflichtig, wenn der Vertrag mindestens 12 Jahre lief)" info="heirHalf" />
    <NumberField layout="row" label="Zu versteuerndes Einkommen der Erben" value={i.incHeir} onchange={v => setInput('incHeir', v)} min={0} step={1000} unit="€/Jahr" info="incHeir" testid="incHeir" />
    <p class="hint">Die Erben versteuern die AVD-Erträge mit ihrem eigenen Steuersatz, nicht mit deinem. Wie das Altersvorsorgedepot im Erbfall behandelt wird: <Info k="erbfallAvd">Erbfall beim AVD</Info>. <Info k="erbschaftsteuer">Erbschaftsteuer</Info> ist nicht gerechnet.</p>
  </section>

  <div class="main">
    <section class="card" aria-labelledby="heir-h">
      <div class="card-head">
        <h2 id="heir-h">Was die Erben bekommen</h2>
        <p class="hint">Bei Tod mit {p.deathAge}, {p.deathAge < p.R ? 'vor' : 'nach'} Rentenbeginn. Ohne Erbschaftsteuer.{#if res.kombi} Deine Kombi ist gemeinsam versteuert: <Info k="erbfallKombi">Erbfall bei einer Kombi</Info>.{/if}</p>
      </div>
      <div class="table-scroll" {@attach scrollRegion('Tabelle: Was die Erben bekommen')}>
        <table class="heirs" data-testid="heirs-table">
          <thead><tr><th>Wer erbt was</th><th>Erben bekommen (ca.)</th><th class="l">Hinweis</th></tr></thead>
          <tbody>
            {#each heirRows as row, k}
              {@const h = heirVals[k]}
              <tr>
                <td><span class="th-key"><span class="key" class:dash={row.dash} style:background={row.dash ? undefined : row.color} style:color={row.color}></span>{row.name}</span></td>
                <td class:best={markHeir && Math.round(h.val) === Math.round(maxH)}>{eur(A.R(h.val, tD))}</td>
                <td class="l note-cell">{h.note}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <p class="hint">Restrenten sind künftige Zahlungen, kein sofort verfügbares Kapital. Die spätere AVD-Steuer beim Ehepartner ist nur mit deinem Einkommen und Restzeitraum geschätzt; ein eigener Hinterbliebenen-Auszahlplan fehlt. Restbeiträge und verbleibende Förderung nach Rentenbeginn sind näherungsweise am Restguthaben bemessen, die genaue Zuordnung ist offen.</p>
    </section>

    <section class="card" aria-labelledby="heir-c-h">
      <div class="card-head"><h2 id="heir-c-h">Je nach Todesalter</h2></div>
      <LineChart title="Was die Erben bekommen, je nach Todesalter" x0={p.a0 + 1} xTitle="Todesalter" {series} marker={{ x: p.R, label: 'Rentenbeginn' }} />
    </section>
  </div>
</div>

<style>
  .layout { display: grid; grid-template-columns: minmax(280px, 340px) 1fr; gap: 16px; align-items: start; }
  .main { min-width: 0; }
  @media (max-width: 920px) { .layout { grid-template-columns: 1fr; } }
  .side h2 { margin-bottom: 6px; }
  .side .hint { margin: 10px 0 0; }
  .heirs th.l, .heirs td.l { text-align: left; white-space: normal; }
  .note-cell { color: var(--text-2); font-size: .82rem; min-width: 220px; }
  /* Mobil: Name und Betrag nebeneinander, Hinweis darunter */
  @media (max-width: 640px) {
    .heirs thead { display: none; }
    .heirs, .heirs tbody { display: block; }
    .heirs tr { display: grid; grid-template-columns: 1fr auto; gap: 2px 12px; padding: 10px 0; border-bottom: 1px solid var(--grid); }
    .heirs tbody tr:last-child { border-bottom: 0; }
    .heirs td { border: 0; padding: 0; }
    .heirs td.l { grid-column: 1 / -1; min-width: 0; }
  }
</style>
