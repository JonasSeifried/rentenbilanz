<script lang="ts">
  // Testseite: Komponenten einzeln mit allen Props, damit e2e/components.spec.ts sie ohne die App prüfen kann.
  import NumberField from '../../src/lib/components/NumberField.svelte';
  import Switch from '../../src/lib/components/Switch.svelte';
  import LineChart from '../../src/lib/components/LineChart.svelte';
  import Info from '../../src/lib/components/Info.svelte';

  let pct = $state(6);
  let money = $state(38000);
  let age = $state(70);
  let contrib = $state(150);
  let commits = $state(0);
  let step = $state(150);
  let neg = $state(0);
  let sw = $state(false);

  const years = Array.from({ length: 51 }, (_, i) => i); // Alter 50…100
  const series = [
    { name: 'ETF', color: 'var(--s1)', values: years.map(i => 1000 * i) },
    { name: 'Versicherung', color: 'var(--s2)', values: years.map(i => 800 * i) },
  ];
</script>

<main class="wrap h">
  <h1>Komponenten</h1>
  <div class="grid">
    <NumberField id="t-pct" testid="t-pct" label="Rendite" value={pct} onchange={v => (pct = v)} step={0.5} unit="% p. a." limits={[-100, 100]} />
    <output data-testid="o-pct">{pct}</output>

    <NumberField id="t-money" testid="t-money" label="Gehalt" value={money} onchange={v => (money = v)} step={1000} min={0} unit="€/Jahr" limits={[0, 1e8]} />
    <output data-testid="o-money">{money}</output>

    <NumberField id="t-age" testid="t-age" label="Alter" value={age} onchange={v => (age = v)} min={16} max={60} unit="Jahre" effective={Math.min(60, age)} />
    <output data-testid="o-age">{age}</output>

    <NumberField id="t-contrib" testid="t-contrib" label="Beitrag" value={contrib} onchange={v => { contrib = v; commits++; }} step={10} min={0} unit="€" alwaysCommit />
    <output data-testid="o-commits">{commits}</output>

    <NumberField id="t-step" testid="t-step" label="Betrag" value={step} onchange={v => (step = v)} step={10} min={0} max={1000} unit="€" stepper />
    <output data-testid="o-step">{step}</output>

    <NumberField id="t-neg" testid="t-neg" label="Differenz" value={neg} onchange={v => (neg = v)} unit="€" />
    <output data-testid="o-neg">{neg}</output>

    <NumberField id="t-off" testid="t-off" label="Gesperrt" value={5} onchange={() => {}} disabled unit="Jahre" />
    <Switch id="t-sw" testid="t-sw" label="Schalter" checked={sw} onchange={v => (sw = v)} />
    <Switch id="t-sw-off" testid="t-sw-off" label="Schalter gesperrt" checked={true} onchange={() => {}} disabled />
    <p>Begriff <Info k="basiszins">Basiszins</Info> im Text.</p>
  </div>

  <div class="wide" data-testid="wide-chart">
    <LineChart {series} x0={50} title="Wide" marker={{ x: 67, label: 'Rentenbeginn' }} xMax={80} tipTitle={(x) => 'Mit ' + x + ' Jahren'} />
  </div>
  <div class="narrow" data-testid="narrow-chart">
    <LineChart {series} x0={50} title="Narrow" marker={{ x: 67, label: 'Rentenbeginn' }} tipTitle={(x) => 'Mit ' + x + ' Jahren'} />
  </div>
</main>

<style>
  .h { padding-top: 16px; padding-bottom: 80px; }
  .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 16px; align-items: start; margin-bottom: 24px; }
  .narrow { width: 360px; max-width: 100%; margin-top: 24px; }
  output { font-size: .75rem; color: var(--muted); }
</style>
