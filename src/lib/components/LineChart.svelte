<script lang="ts" module>
  export interface Series { name: string; short?: string; color: string; dash?: boolean; values: (number | null)[] }

  export function niceStep(raw: number): number {
    const p = Math.pow(10, Math.floor(Math.log10(raw))); const f = raw / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
  }
  let seq = 0;
</script>

<script lang="ts">
  // Liniendiagramm in SVG: 2px-Linien, Haarlinien-Raster, Endpunkte mit Flächenring, direkte Endlabels
  // (mit Führungslinie, wenn sie ausweichen müssen), Fadenkreuz-Tooltip für Maus, Touch und Tastatur
  // sowie eine Tabellenansicht als Alternative.
  import { eur } from '../format';
  import { scrollRegion } from '../attach';

  interface Props {
    series: Series[];
    x0: number;
    xTitle?: string;
    title: string;
    /** Senkrechte Markierung (z. B. Rentenbeginn), als x-Wert */
    marker?: { x: number; label: string } | null;
    height?: number;
    tableStep?: number;
    /** Überschrift im Tooltip (und im vorgelesenen Wert) für den x-Wert; Standard: „{xTitle} {x}“. */
    tipTitle?: (x: number) => string;
    /** Letzter angezeigter x-Wert; Werte danach werden weggelassen (Achse, Skala, Tabelle). */
    xMax?: number;
  }
  let { series: allSeries, x0, xTitle = 'Alter', title, marker = null, height = 300, tableStep = 5, tipTitle, xMax }: Props = $props();

  const uid = `ch-${++seq}`;
  /** Letzte gemessene Breite > 0 (verborgene Tabs melden 0 und werden ignoriert). */
  let width = $state(0);
  let printing = $state(false);
  let hover = $state<number | null>(null);
  let svgEl: SVGSVGElement | undefined = $state();

  // Breite messen. Anfangswert synchron (kein Frame mit falscher Breite), Updates im nächsten Frame
  // (vermeidet „ResizeObserver loop“, weil die Höhe von der Breite abhängt). Breite 0 (Tab verborgen)
  // wird ignoriert: Die letzte Breite bleibt, beim Einblenden gibt es keinen gestauchten Frame.
  function observeWidth(node: HTMLElement) {
    let raf = 0;
    const w0 = Math.round(node.clientWidth);
    if (w0 > 0) width = w0;
    const ro = new ResizeObserver(entries => {
      const w = Math.round(entries[0].contentRect.width);
      if (w <= 0) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => { if (w !== width) width = w; });
    });
    ro.observe(node);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }

  // Druck: feste Breite, damit das Diagramm nicht im Bildschirmlayout gemessen (und gestaucht) wird.
  const PRINT_WIDTH = 680;
  $effect(() => {
    const mq = window.matchMedia('print');
    const on = () => { printing = true; };
    const off = () => { printing = false; };
    const sync = (e: MediaQueryListEvent) => (e.matches ? on() : off());
    window.addEventListener('beforeprint', on);
    window.addEventListener('afterprint', off);
    mq.addEventListener('change', sync);
    return () => {
      window.removeEventListener('beforeprint', on);
      window.removeEventListener('afterprint', off);
      mq.removeEventListener('change', sync);
    };
  });

  // Auf xMax begrenzte Sicht auf die Reihen
  const len = $derived.by(() => {
    const raw = Math.max(1, ...allSeries.map(s => s.values.length));
    return xMax === undefined ? raw : Math.max(1, Math.min(raw, Math.floor(xMax) - x0 + 1));
  });
  const series = $derived(allSeries.map(s => ({ ...s, values: s.values.slice(0, len) })));

  const W = $derived(Math.max(300, printing ? PRINT_WIDTH : width || 760));
  const narrow = $derived(W < 560);
  const H = $derived(narrow ? Math.min(height, 250) : height);
  const m = $derived({ l: narrow ? 36 : 48, r: narrow ? 14 : 104, t: 24, b: 30 });
  const iw = $derived(W - m.l - m.r);
  const ih = $derived(H - m.t - m.b);

  const yScale = $derived.by(() => {
    let ymax = 0;
    for (const s of series) for (const v of s.values) if (v != null && v > ymax) ymax = v;
    if (ymax <= 0) ymax = 1;
    const step = niceStep(ymax / 4);
    const max = Math.ceil(ymax / step) * step;
    // Einheit einmal als Achsentitel, Ticks nur als Zahl (spart Platz, v. a. mobil)
    const unit = max >= 2e6 ? { div: 1e6, label: 'Mio. €' } : max >= 2e3 ? { div: 1e3, label: 'Tsd. €' } : { div: 1, label: '€' };
    return { max, step, unit };
  });
  const tickFmt = (v: number) => (v / yScale.unit.div).toLocaleString('de-DE', { maximumFractionDigits: 1 });
  const x = (i: number) => m.l + (len <= 1 ? 0 : (i / (len - 1)) * iw);
  const y = (v: number) => m.t + ih - (v / yScale.max) * ih;

  const yTicks = $derived.by(() => {
    const out: number[] = [];
    for (let v = 0; v <= yScale.max + 1e-6; v += yScale.step) out.push(v);
    return out;
  });
  const xTicks = $derived.by(() => {
    const every = narrow && len > 60 ? 20 : 10;
    const out: number[] = [];
    for (let i = 0; i < len; i++) { const age = x0 + i; if (age % every === 0) out.push(i); }
    return out;
  });

  const paths = $derived(series.map(s => {
    let d = '', pen = false;
    s.values.forEach((v, i) => {
      if (v == null) { pen = false; return; }
      d += (pen ? 'L' : 'M') + x(i).toFixed(1) + ',' + y(v).toFixed(1); pen = true;
    });
    return d;
  }));

  // Endpunkte: letzter Wert > 0 (sonst stapeln sich alle bei 0 auf der x-Achse)
  const ends = $derived.by(() => {
    const out: { k: number; i: number; yy: number; ly: number }[] = [];
    series.forEach((s, k) => {
      let last: number | null = null, lastPos: number | null = null;
      s.values.forEach((v, i) => { if (v == null) return; last = i; if (v > 0) lastPos = i; });
      const li = lastPos ?? last;
      if (li != null) out.push({ k, i: li, yy: y(s.values[li]!), ly: y(s.values[li]!) });
    });
    // Labels kollisionsfrei setzen; verschobene Labels bekommen eine Führungslinie
    const sorted = [...out].sort((a, b) => a.yy - b.yy);
    for (let j = 1; j < sorted.length; j++) if (sorted[j].ly - sorted[j - 1].ly < 15) sorted[j].ly = sorted[j - 1].ly + 15;
    for (let j = sorted.length - 1; j >= 0; j--) {
      const lim = j === sorted.length - 1 ? m.t + ih - 2 : sorted[j + 1].ly - 15;
      if (sorted[j].ly > lim) sorted[j].ly = lim;
    }
    return out;
  });
  // Würden Endlabels weit von ihrer Linie wegrutschen, lieber ganz weglassen (Legende + Tooltip tragen die Zuordnung)
  const showEndLabels = $derived(!narrow && ends.every(e => Math.abs(e.ly - e.yy) <= 12));

  const markerI = $derived(marker ? marker.x - x0 : null);

  function pick(clientX: number) {
    if (!svgEl) return;
    const rect = svgEl.getBoundingClientRect();
    const sc = rect.width / W || 1;
    const px = (clientX - rect.left) / sc;
    hover = Math.max(0, Math.min(len - 1, Math.round(((px - m.l) / iw) * (len - 1))));
  }
  function onkey(e: KeyboardEvent) {
    const cur = hover ?? (markerI ?? 0);
    let next: number | null = null;
    if (e.key === 'ArrowRight') next = cur + (e.shiftKey ? 10 : 1);
    else if (e.key === 'ArrowLeft') next = cur - (e.shiftKey ? 10 : 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = len - 1;
    else if (e.key === 'Escape') { hover = null; return; }
    if (next === null) return;
    e.preventDefault();
    hover = Math.max(0, Math.min(len - 1, next));
  }

  const tipLeft = $derived.by(() => {
    if (hover == null) return 0;
    const sc = width ? width / W : 1;
    const xs = x(hover) * sc, tipW = 220;
    return xs + 14 + tipW > (width || W) ? Math.max(0, xs - 14 - tipW) : xs + 14;
  });

  const xLabel = (i: number) => (tipTitle ? tipTitle(x0 + i) : xTitle + ' ' + (x0 + i));
  function valueText(i: number): string {
    return xLabel(i) + ': ' + series.filter(s => s.values[i] != null).map(s => (s.short || s.name) + ' ' + eur(s.values[i]!)).join(', ');
  }

  const tableRows = $derived.by(() => {
    const rows: number[] = [];
    for (let i = 0; i < len; i++) if ((x0 + i) % tableStep === 0 || i === 0 || i === len - 1) rows.push(i);
    return rows;
  });
</script>

<div class="lc">
  <ul class="legend" aria-label="Legende">
    {#each series as s}
      <li><span class="key" class:dash={s.dash} style:background={s.dash ? undefined : s.color} style:color={s.color}></span>{s.name}</li>
    {/each}
  </ul>

  <div class="plot" {@attach observeWidth}>
    <!-- Tastatur/Screenreader: das Diagramm ist ein Schieberegler über die x-Achse, der Wert wird vorgelesen -->
    <div class="focus" tabindex="0" role="slider" aria-roledescription="Diagramm"
      aria-label={title + '. Pfeiltasten links und rechts wählen das ' + xTitle + '.'}
      aria-valuemin={x0} aria-valuemax={x0 + len - 1} aria-valuenow={x0 + (hover ?? markerI ?? 0)}
      aria-valuetext={valueText(hover ?? markerI ?? 0)}
      onkeydown={onkey} onblur={() => (hover = null)}>
      <svg bind:this={svgEl} class:unmeasured={width === 0 && !printing} viewBox="0 0 {W} {H}" aria-hidden="true"
        onpointermove={(e) => pick(e.clientX)} onpointerdown={(e) => pick(e.clientX)}
        onpointerleave={(e) => { if (e.pointerType === 'mouse') hover = null; }}>
        {#each yTicks as v}
          <line x1={m.l} x2={m.l + iw} y1={y(v)} y2={y(v)} stroke={v === 0 ? 'var(--axis)' : 'var(--grid)'} stroke-width="1" />
          <text class="tick" x={m.l - 8} y={y(v) + 4} text-anchor="end">{tickFmt(v)}</text>
        {/each}
        {#each xTicks as i}
          <text class="tick" x={x(i)} y={H - 10} text-anchor="middle">{x0 + i}</text>
        {/each}
        <text class="tick" x={0} y={10}>{yScale.unit.label}</text>
        {#if !narrow}<text class="tick" x={m.l + iw + 18} y={H - 10}>{xTitle}</text>{/if}

        {#if markerI != null && markerI >= 0 && markerI < len}
          <line x1={x(markerI)} x2={x(markerI)} y1={m.t - 6} y2={m.t + ih} stroke="var(--axis)" stroke-width="1" />
          <text class="mlabel" x={x(markerI) + (markerI > len * 0.75 ? -4 : 4)} y={m.t - 9} text-anchor={markerI > len * 0.75 ? 'end' : 'start'}>{marker!.label}</text>
        {/if}

        {#each series as s, k}
          <path d={paths[k]} fill="none" stroke={s.color} stroke-width="2" stroke-linejoin="round" stroke-linecap="round"
            stroke-dasharray={s.dash ? '6 5' : undefined} />
        {/each}
        {#each ends as e}
          {@const s = series[e.k]}
          <circle cx={x(e.i)} cy={e.yy} r="4" fill={s.color} stroke="var(--surface)" stroke-width="2" />
          {#if showEndLabels}
            {#if Math.abs(e.ly - e.yy) > 2}
              <path d="M{x(e.i) + 5},{e.yy} L{x(e.i) + 10},{e.ly}" stroke="var(--axis)" stroke-width="1" fill="none" />
            {/if}
            <text class="endlabel" x={x(e.i) + 12} y={e.ly + 4}>{s.short || s.name}</text>
          {/if}
        {/each}

        {#if hover != null}
          <line x1={x(hover)} x2={x(hover)} y1={m.t} y2={m.t + ih} stroke="var(--text-2)" stroke-width="1" opacity=".5" />
          {#each series as s}
            {@const v = s.values[hover]}
            {#if v != null}<circle cx={x(hover)} cy={y(v)} r="4.5" fill={s.color} stroke="var(--surface)" stroke-width="2" />{/if}
          {/each}
        {/if}
      </svg>
    </div>
    {#if hover != null}
      <div class="tip" class:fixed={narrow} style:left={narrow ? undefined : tipLeft + 'px'} aria-hidden="true">
        <div class="t">{xLabel(hover)}</div>
        {#each series as s}
          {@const v = s.values[hover]}
          {#if v != null}
            <div class="r"><span class="key" class:dash={s.dash} style:background={s.dash ? undefined : s.color} style:color={s.color}></span><span class="n">{s.short || s.name}</span><b>{eur(v)}</b></div>
          {/if}
        {/each}
      </div>
    {/if}
  </div>

  <details class="tbl noprint-toggle">
    <summary>Werte als Tabelle</summary>
    <div class="table-scroll" {@attach scrollRegion('Werte als Tabelle: ' + title)}>
      <table aria-describedby={uid}>
        <caption id={uid} class="sr-only">{title}</caption>
        <thead><tr><th>{xTitle}</th>{#each series as s}<th>{s.short || s.name}</th>{/each}</tr></thead>
        <tbody>
          {#each tableRows as i}
            <tr><td>{x0 + i}</td>{#each series as s}<td>{s.values[i] == null ? '–' : eur(s.values[i]!)}</td>{/each}</tr>
          {/each}
        </tbody>
      </table>
    </div>
  </details>
</div>

<style>
  .legend { display: flex; flex-wrap: wrap; gap: 4px 16px; margin: 0 0 8px; padding: 0; list-style: none; font-size: .82rem; color: var(--text-2); }
  .legend li { display: inline-flex; align-items: center; gap: 6px; }
  .plot { position: relative; width: 100%; }
  .focus { border-radius: 8px; }
  .focus:focus-visible { outline: 2px solid var(--accent); outline-offset: 4px; }
  svg { display: block; width: 100%; height: auto; touch-action: pan-y; user-select: none; -webkit-user-select: none; }
  svg.unmeasured { visibility: hidden; } /* noch nie sichtbar gewesen: erst zeigen, wenn die Breite bekannt ist */
  svg :global(text) { font-family: var(--font); }
  .tick { font-size: 11px; fill: var(--axis-text); font-variant-numeric: tabular-nums; }
  .endlabel { font-size: 12px; fill: var(--text-2); font-weight: 500; }
  .mlabel { font-size: 11px; fill: var(--muted); }
  .tip {
    position: absolute; top: 8px; z-index: 5; width: 220px; pointer-events: none;
    background: var(--surface); border: 1px solid var(--border-strong); border-radius: 10px;
    padding: 8px 10px; font-size: .8rem; box-shadow: var(--shadow-pop);
  }
  /* Schmal (Handy): fester Streifen oben über der Fläche statt eines Tooltips, den der Finger verdeckt */
  .tip.fixed {
    left: 0; right: 0; top: 0; width: auto; display: flex; flex-wrap: wrap; align-items: center; gap: 0 14px;
    padding: 5px 10px; border-radius: 8px; font-size: .78rem; background: color-mix(in srgb, var(--surface) 96%, transparent);
  }
  .tip.fixed .t { margin: 0; font-weight: 600; color: var(--text-2); }
  .tip.fixed .r { gap: 5px; line-height: 1.5; }
  .tip.fixed .r b { margin-left: 2px; }
  .tip .t { color: var(--muted); margin-bottom: 4px; }
  .tip .r { display: flex; align-items: center; gap: 8px; line-height: 1.6; }
  .tip .n { color: var(--text-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .tip b { margin-left: auto; font-variant-numeric: tabular-nums; font-weight: 650; color: var(--text); }
  .tbl { margin-top: 8px; font-size: .85rem; }
  .tbl summary { cursor: pointer; color: var(--accent-text); width: max-content; padding: 4px 0; }
  .tbl table { margin-top: 6px; font-size: .82rem; }
  .tbl th, .tbl td { padding: 4px 8px; }
  @media print {
    .tbl, .tip { display: none; }
    .lc { break-inside: avoid; }
  }
</style>
