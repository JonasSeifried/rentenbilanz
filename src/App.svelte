<script lang="ts">
  import { readParams } from './lib/engine/core';
  import { analyze, scenarios, PRODUCTS, KOMBI } from './lib/engine/analyze';
  import { readKombi } from './lib/engine/combo';
  import { splitText } from './lib/comboVerdict';
  import { CONTRIB_KEYS } from './lib/engine/inputs';
  import { TABS, type Tab } from './lib/link';
  import { SITE } from './lib/site';
  import { THEME_KEY } from './lib/storage';
  import { eur } from './lib/format';
  import { app, setInput, setTab, adoptShared, leaveShared, resetToDefaults, shareUrl, showToast, openKombi } from './lib/state.svelte';
  import NumberField from './lib/components/NumberField.svelte';
  import Switch from './lib/components/Switch.svelte';
  import Icon from './lib/components/Icon.svelte';
  import Toast from './lib/components/Toast.svelte';
  import Overview from './lib/panels/Overview.svelte';
  import Detail from './lib/panels/Detail.svelte';
  import Heirs from './lib/panels/Heirs.svelte';
  import Settings from './lib/panels/Settings.svelte';
  import KvQuestion from './lib/components/KvQuestion.svelte';
  import ResultPeek from './lib/components/ResultPeek.svelte';
  import { changedSettings } from './lib/components/AssumptionCheck.svelte';
  import { verdict } from './lib/verdict';
  import KombiDialog from './lib/components/KombiDialog.svelte';
  import { DEFAULTS, INPUT_KEYS } from './lib/engine/inputs';

  const p = $derived(readParams(app.inputs));
  const kombi = $derived(readKombi(app.inputs));
  const A = $derived(analyze(p, undefined, kombi));
  const scen = $derived(scenarios(p, undefined, kombi));
  const i = $derived(app.inputs);

  const TAB_LABELS: Record<Tab, string> = {
    overview: 'Überblick', detail: 'Rente im Detail', heirs: 'Erbfall', settings: 'Weitere Einstellungen & Annahmen',
  };
  const TAB_SHORT: Record<Tab, string> = { overview: 'Überblick', detail: 'Rente', heirs: 'Erbfall', settings: 'Annahmen' };
  const V = $derived(verdict(A, scen));
  const changedN = $derived(changedSettings(i).length);
  const isExample = $derived(INPUT_KEYS.every(k => k === 'real' || i[k] === DEFAULTS[k]));
  const peekText = $derived(V.kind === 'ok' ? V.headline : 'Ergebnis siehe Überblick');

  const contribDiffer = $derived(CONTRIB_KEYS.some(k => i[k] !== i.setAll));
  const today = new Date().toLocaleDateString('de-DE');

  // --- Farbschema: Auto (System) → Hell → Dunkel ---
  type Theme = 'auto' | 'light' | 'dark';
  let theme = $state<Theme>((() => { try { const t = localStorage.getItem(THEME_KEY); return t === 'light' || t === 'dark' ? t : 'auto'; } catch { return 'auto'; } })());
  $effect(() => {
    const root = document.documentElement;
    if (theme === 'auto') delete root.dataset.theme; else root.dataset.theme = theme;
    try { if (theme === 'auto') localStorage.removeItem(THEME_KEY); else localStorage.setItem(THEME_KEY, theme); } catch { /* egal */ }
  });
  const THEME_NEXT: Record<Theme, Theme> = { auto: 'light', light: 'dark', dark: 'auto' };
  const THEME_LABEL: Record<Theme, string> = { auto: 'Farbschema: automatisch', light: 'Farbschema: hell', dark: 'Farbschema: dunkel' };

  // --- Tabs (ARIA-Tabs mit Pfeiltasten) ---
  let tabEls: HTMLButtonElement[] = [];
  function onTabKey(e: KeyboardEvent, idx: number) {
    let next = -1;
    if (e.key === 'ArrowRight') next = (idx + 1) % TABS.length;
    else if (e.key === 'ArrowLeft') next = (idx - 1 + TABS.length) % TABS.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = TABS.length - 1;
    if (next < 0) return;
    e.preventDefault();
    setTab(TABS[next]);
    tabEls[next]?.focus();
  }

  async function copyLink() {
    const url = shareUrl();
    try {
      await navigator.clipboard.writeText(url);
      showToast(app.mode === 'shared' ? 'Link zu diesem Szenario kopiert.' : 'Link kopiert. Wer ihn öffnet, sieht dieses Szenario; dessen eigene gespeicherte Eingaben bleiben erhalten.');
    } catch {
      window.prompt('Link zum Kopieren:', url);
    }
  }
</script>

<a class="skip" href="#main">Zum Ergebnis springen</a>

<header class="site-head">
  <div class="wrap head-row">
    <div class="brand">
      <svg class="logo" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="var(--accent)" /><path d="M8 22l5-6 4 3 7-9" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" /></svg>
      <div>
        <h1>{SITE.name}</h1>
        <p class="tagline">{SITE.tagline}</p>
      </div>
    </div>
    <div class="actions noprint">
      <button class="btn ghost" type="button" onclick={() => (theme = THEME_NEXT[theme])} aria-label={THEME_LABEL[theme] + ' (umschalten)'} title={THEME_LABEL[theme]}>
        <Icon name={theme === 'auto' ? 'auto' : theme === 'light' ? 'sun' : 'moon'} />
      </button>
      <button class="btn ghost" type="button" onclick={() => window.print()} aria-label="Drucken oder als PDF speichern" title="Drucken / PDF">
        <Icon name="print" /><span class="lbl">Drucken</span>
      </button>
      <button class="btn" type="button" onclick={copyLink} data-testid="share"><Icon name="link" /><span class="lbl-long">Link teilen</span><span class="lbl-short">Teilen</span></button>
    </div>
  </div>
</header>

<div class="wrap">
  <p class="disclaimer" data-testid="disclaimer">
    <Icon name="info" />
    <span><strong>Modellrechnung, keine Anlageberatung.</strong> Vereinfachte Annahmen, konstante Rendite. {SITE.lawStateShort}. <a href="#annahmen" onclick={(e) => { e.preventDefault(); setTab('settings'); requestAnimationFrame(() => document.getElementById('annahmen')?.scrollIntoView({ behavior: 'smooth' })); }}>Annahmen &amp; Grenzen</a></span>
  </p>
  <p class="print-only print-meta">Stand {today} · {SITE.lawStateShort} · {p.real ? 'Beträge in heutiger Kaufkraft (Inflation ' + (p.infl * 100).toLocaleString('de-DE') + ' %)' : 'Nominale Beträge'} · Modellrechnung, keine Beratung.</p>

  {#if app.mode === 'shared'}
    <div class="shared noprint" role="region" aria-label="Geteiltes Szenario" data-testid="shared-banner">
      <Icon name="eye" size={20} />
      <div class="txt">
        <strong>Du siehst ein geteiltes Szenario.</strong>
        <span>Deine gespeicherten Eingaben bleiben unverändert; Änderungen hier werden nicht gespeichert.</span>
      </div>
      <div class="btns">
        <button class="btn primary small" type="button" onclick={adoptShared} data-testid="adopt">Als meine Eingaben übernehmen</button>
        <button class="btn small" type="button" onclick={leaveShared} data-testid="leave">Zurück zu meinen Eingaben</button>
      </div>
    </div>
  {/if}

  <section class="card eck" id="eck" aria-labelledby="eck-h">
    <div class="eck-head">
      <h2 id="eck-h">Eckdaten <span class="sub">gelten für alle Ansichten</span></h2>
      <div class="eck-actions noprint">
        <span class="saved" data-testid="save-state">
          {#if app.mode === 'shared'}Ansichtsmodus – nicht gespeichert
          {:else if app.storageOk}<Icon name="check" size={14} />Wird in diesem Browser gespeichert
          {:else}Speichern im Browser nicht möglich{/if}
        </span>
        <button class="btn small" type="button" onclick={resetToDefaults} data-testid="reset"><Icon name="reset" />Auf Standardwerte zurücksetzen</button>
      </div>
    </div>
    {#if isExample && app.mode !== 'shared'}<p class="example-hint noprint" data-testid="example-hint">Diese Werte sind ein Beispiel. Trage deine eigenen Zahlen ein.</p>{/if}
    <div class="eck-grid">
      <NumberField label="Alter heute" value={i.a0} onchange={v => setInput('a0', v)} min={16} max={60} unit="Jahre" testid="a0"
        clampNote={v => (v < 16 || v > 60 ? 'Gerechnet wird mit ' + Math.min(60, Math.max(16, Math.round(v))) + '.' : null)} />
      <NumberField label="Gehalt, zu versteuern" value={i.incWork} onchange={v => setInput('incWork', v)} min={0} step={1000} unit="€/Jahr" info="zve" testid="incWork" />
      <NumberField label="Einkommen im Alter" value={i.incRet} onchange={v => setInput('incRet', v)} min={0} step={1000} unit="€/Jahr" info="incRet" testid="incRet" />
      <NumberField label="Monatsbeitrag je Produkt" value={i.setAll} onchange={v => setInput('setAll', v)} min={0} step={10} unit="€" testid="setAll"
        clampNote={() => (contribDiffer ? 'Einzelbeiträge weichen ab (siehe Einstellungen).' : null)} />
      <NumberField label="Rendite vor Kosten" value={i.g} onchange={v => setInput('g', v)} step={0.5} unit="% p. a." info="rendite" testid="g" />
      <NumberField label="Rentenbeginn mit" value={i.R} onchange={v => setInput('R', v)} min={65} max={70} unit="Jahren" info="rentenbeginn" testid="R"
        clampNote={v => (v < 65 || v > 70 ? 'Gerechnet wird mit ' + Math.min(70, Math.max(65, Math.round(v))) + '.' : null)} />
    </div>
    <div class="eck-foot">
      <div class="kv">
        <KvQuestion />
      </div>
      <fieldset class="compare">
        <legend>Vergleichen</legend>
        {#each PRODUCTS as pr}
          {@const key = (pr.key + 'On') as 'etfOn' | 'avdOn' | 'insOn' | 'fondOn'}
          <label class="chip" class:on={i[key]}>
            <input type="checkbox" checked={i[key]} onchange={(e) => setInput(key, e.currentTarget.checked)} data-testid={key} />
            <span class="key" style:background={pr.color}></span>{pr.name}
          </label>
        {/each}
        {#if kombi}
          <button type="button" class="chip on kombi" onclick={openKombi} aria-haspopup="dialog" data-testid="kombi-chip"
            title="Kombi bearbeiten: {splitText(kombi, 'short')}">
            <span class="key" style:background={KOMBI.color}></span>Kombi<span class="ksplit">{splitText(kombi, 'short')}</span><Icon name="edit" size={14} />
          </button>
        {:else}
          <button type="button" class="chip add noprint" onclick={openKombi} aria-haspopup="dialog" data-testid="kombi-add"><Icon name="plus" size={14} />Kombi</button>
        {/if}
      </fieldset>
    </div>
  </section>

  <div class="tabbar noprint">
    <div class="tabs" role="tablist" aria-label="Ansichten">
      {#each TABS as t, idx}
        <button bind:this={tabEls[idx]} class="tab" type="button" role="tab" id="tab-{t}" aria-controls="panel-{t}"
          aria-selected={app.tab === t} tabindex={app.tab === t ? 0 : -1}
          onclick={() => setTab(t)} onkeydown={(e) => onTabKey(e, idx)}>
          <span class="long">{TAB_LABELS[t]}</span><span class="short">{TAB_SHORT[t]}</span>{#if t === 'settings' && changedN > 0}<span class="badge" data-testid="settings-badge"><span class="sr-only">{changedN} Annahmen geändert</span><span aria-hidden="true">{changedN}</span></span>{/if}
        </button>
      {/each}
    </div>
    <div class="real">
      <Switch checked={i.real} onchange={v => setInput('real', v)} info="kaufkraft" testid="real" label="Heutige Kaufkraft" />
    </div>
  </div>

  <main id="main">
    {#each TABS as t}
      <div class="panel" id="panel-{t}" role="tabpanel" aria-labelledby="tab-{t}" hidden={app.tab !== t}
        class:print={t !== 'heirs'} tabindex="-1">
        {#if t === 'overview'}<Overview {A} {scen} />
        {:else if t === 'detail'}<Detail {A} />
        {:else if t === 'heirs'}<Heirs {A} />
        {:else}<Settings />{/if}
      </div>
    {/each}
  </main>
</div>

<footer class="site-foot">
  <div class="wrap foot-row">
    <div>
      <strong>{SITE.name}</strong> · Modellrechnung, keine Anlage-, Steuer- oder Rechtsberatung.<br />
      <span class="muted">Rechtsstand: {SITE.lawState}. Zuletzt geprüft am {SITE.updated}.</span><br />
      <span class="muted">Keine Cookies, kein Tracking, keine externen Anfragen. Eingaben bleiben in diesem Browser.</span>
    </div>
    <nav aria-label="Weitere Seiten" class="noprint">
      <a href="./impressum.html">Impressum</a>
      <a href="./datenschutz.html">Datenschutz</a>
      <a href={'mailto:' + SITE.contact + '?subject=' + encodeURIComponent(SITE.name + ': Fehler oder Hinweis')}>Fehler melden</a>
      <a href={SITE.repo} rel="noopener noreferrer">Quellcode auf GitHub</a>
    </nav>
  </div>
</footer>

<ResultPeek text={peekText} color={V.kind === 'ok' ? A.lead?.color : ''} targetId="verdict" watchId="eck" />
<Toast />
<KombiDialog />

<style>
  .skip { position: absolute; left: -9999px; top: 8px; z-index: 50; background: var(--surface); padding: 8px 12px; border-radius: 8px; }
  .skip:focus { left: 8px; }

  .site-head { padding: 18px 0 10px; }
  .head-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .brand { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .logo { width: 36px; height: 36px; flex: none; }
  .tagline { margin: 2px 0 0; color: var(--text-2); font-size: .88rem; }
  .actions { display: flex; align-items: center; gap: 4px; flex: none; }
  .lbl-short { display: none; }
  @media (max-width: 480px) { .lbl-long { display: none; } .lbl-short { display: inline; } }
  @media (max-width: 640px) {
    .actions .lbl { display: none; }
    .tagline { font-size: .8rem; }
    h1 { font-size: 1.15rem; }
    .logo { width: 30px; height: 30px; }
  }
  @media (max-width: 420px) { .tagline { display: none; } }

  .disclaimer {
    display: flex; gap: 8px; align-items: flex-start; margin: 4px 0 14px;
    font-size: .82rem; color: var(--text-2);
  }
  .disclaimer :global(svg) { flex: none; margin-top: 2px; color: var(--accent-text); }
  .print-meta { font-size: .8rem; color: var(--muted); margin: 0 0 8px; }

  .shared {
    display: flex; align-items: center; gap: 12px 14px; flex-wrap: wrap;
    background: var(--accent-soft); border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
    border-radius: var(--radius); padding: 12px 16px; margin-bottom: 14px;
  }
  .shared > :global(svg) { color: var(--accent-text); flex: none; }
  .shared .txt { flex: 1 1 280px; display: flex; flex-direction: column; font-size: .9rem; }
  .shared .txt span { color: var(--text-2); }
  .shared .btns { display: flex; gap: 8px; flex-wrap: wrap; }

  .eck-head { display: flex; align-items: center; justify-content: space-between; gap: 8px 16px; flex-wrap: wrap; margin-bottom: 12px; }
  .eck-head h2 .sub { font-weight: 400; font-size: .82rem; color: var(--muted); margin-left: 6px; }
  .eck-actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .saved { display: inline-flex; align-items: center; gap: 4px; font-size: .78rem; color: var(--muted); }
  .eck-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 12px 14px; align-items: start; }
  @media (max-width: 1080px) { .eck-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
  @media (max-width: 640px) { .eck-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 10px; } }
  .eck-foot { display: flex; flex-wrap: wrap; gap: 8px 24px; align-items: center; margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--grid); }
  .kv { flex: 0 1 auto; min-width: 260px; }
  .compare { border: 0; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
  .compare legend { float: left; margin-right: 6px; font-size: .82rem; color: var(--text-2); padding: 0; }
  .chip {
    display: inline-flex; align-items: center; gap: 7px; cursor: pointer; user-select: none;
    padding: 5px 12px 5px 8px; border-radius: 999px; font-size: .85rem;
    border: 1px solid var(--border-strong); color: var(--text-2); background: var(--surface);
    transition: background-color .12s, border-color .12s;
  }
  .chip input { width: 16px; height: 16px; margin: 0; accent-color: var(--accent); }
  .chip.on { color: var(--text); background: var(--surface-2); }
  .chip:hover { border-color: var(--text-2); }
  .chip:focus-within { outline: 2px solid var(--accent); outline-offset: 2px; }
  button.chip { font: inherit; font-size: .85rem; }
  button.chip:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .chip.add { border-style: dashed; padding-left: 10px; gap: 4px; color: var(--accent-text); }
  .chip.kombi .ksplit { color: var(--muted); font-size: .8rem; }
  @media (max-width: 480px) { .chip.kombi .ksplit { display: none; } }
  @media (pointer: coarse) { .chip { padding: 8px 14px 8px 10px; } }

  .tabbar {
    display: flex; align-items: flex-end; justify-content: space-between; gap: 4px 16px; flex-wrap: wrap-reverse;
    margin: 20px 0 16px; border-bottom: 1px solid var(--grid);
    position: sticky; top: 0; z-index: 10; background: var(--page);
  }
  .tabs { display: flex; gap: 2px; overflow-x: auto; scrollbar-width: none; max-width: 100%; }
  .tabs::-webkit-scrollbar { display: none; }
  .tab {
    font: inherit; font-size: .92rem; font-weight: 550; padding: 12px 14px 10px; white-space: nowrap;
    border: 0; border-bottom: 2px solid transparent; margin-bottom: -1px; background: none;
    color: var(--text-2); cursor: pointer; border-radius: 6px 6px 0 0;
  }
  .tab:hover { color: var(--text); background: var(--surface-2); }
  .tab[aria-selected='true'] { color: var(--text); border-bottom-color: var(--accent); }
  .tab .short { display: none; }
  .tab .badge { margin-left: 6px; min-width: 18px; padding: 0 5px; border-radius: 9px; background: var(--accent); color: var(--on-accent, #fff); font-size: .72rem; line-height: 18px; display: inline-block; text-align: center; }
  .example-hint { margin: 0 0 10px; font-size: .85rem; color: var(--text-2); }
  @media (max-width: 760px) { .tab .long { display: none; } .tab .short { display: inline; } .tab { padding: 12px 10px 10px; } }
  .real { padding-bottom: 4px; }
  .real :global(.sw) { padding: 4px 0; }
  .panel:focus { outline: none; }

  .site-foot { margin-top: 48px; padding: 24px 0 40px; border-top: 1px solid var(--grid); font-size: .82rem; color: var(--text-2); }
  .foot-row { display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; line-height: 1.7; }
  .foot-row nav { display: flex; gap: 16px; }


  @media print {
    .site-head { padding: 0 0 4px; }
    .disclaimer { display: none; }
    .eck { break-inside: avoid; }
    .eck-foot .compare .chip:not(.on) { display: none; }
    .chip { border: 0; padding: 0 8px 0 0; }
    .chip input { display: none; }
    .panel.print { display: block !important; }
    .panel:not(.print) { display: none !important; }
    .panel + .panel { break-before: page; margin-top: 0; }
    .site-foot { margin-top: 16px; padding: 8px 0 0; }
  }
</style>
