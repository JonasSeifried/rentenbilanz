<script lang="ts">
  import { untrack } from 'svelte';
  import { app, setInput, setInputs, resetToDefaults, forgetSaved } from '../state.svelte';
  import { incomeGrowth, incomePathKind, incomeStartText, kvGross, readParams, suggestedPath } from '../engine/core';
  import { DEFAULTS, LIMITS } from '../engine/inputs';
  import { SITE } from '../site';
  import NumberField from '../components/NumberField.svelte';
  import Switch from '../components/Switch.svelte';
  import Icon from '../components/Icon.svelte';
  import Info from '../components/Info.svelte';

  const i = $derived(app.inputs);
  const p = $derived(readParams(app.inputs));
  /** Anteil (0,06) → Prozent (6), ohne Rundungsrest; für „Gerechnet wird mit …“ */
  const pc = (x: number) => Math.round(x * 1e8) / 1e6;

  // Ausbildung (C1): eigener Zustand statt aus dem gerade bearbeiteten Wert abgeleitet. Das Feld bleibt stehen,
  // solange darin der Fokus liegt; Änderungen von außen (Zurücksetzen, Link, anderer Tab) gleichen den Schalter an.
  const inStudy = $derived(p.studyEnd > p.a0);
  let studyOn = $state(untrack(() => readParams(app.inputs).studyEnd > readParams(app.inputs).a0));
  let studyFocus = $state(false);
  $effect(() => {
    const on = inStudy;
    untrack(() => { if (!studyFocus) studyOn = on; });
  });
  function toggleStudy(v: boolean) {
    studyOn = v;
    setInput('studyEnd', v ? Math.max(i.studyEnd, i.a0 + 2) : 16);
  }

  // Druck: alle Annahmen aufklappen, danach den vorherigen Zustand wiederherstellen
  let assume = $state<HTMLElement>();
  $effect(() => {
    let closed: HTMLDetailsElement[] = [];
    const open = () => {
      if (!assume || closed.length) return;
      closed = [...assume.querySelectorAll('details')].filter(d => !d.open);
      closed.forEach(d => { d.open = true; });
    };
    const restore = () => { closed.forEach(d => { d.open = false; }); closed = []; };
    const mq = window.matchMedia('print');
    const sync = (e: MediaQueryListEvent) => (e.matches ? open() : restore());
    window.addEventListener('beforeprint', open);
    window.addEventListener('afterprint', restore);
    mq.addEventListener('change', sync);
    return () => {
      window.removeEventListener('beforeprint', open);
      window.removeEventListener('afterprint', restore);
      mq.removeEventListener('change', sync);
    };
  });

  // Gehaltsentwicklung: Einschalten startet mit dem Vorschlag der Szenariozeile (suggestedPath: +30 %, frühestens mit 45,
  // mindestens 10 Jahre nach Berufsbeginn; bei 0 € Startgehalt ist auch das Ziel 0 € und muss eingetragen werden).
  // Ausschalten stellt beide Werte auf Standard.
  const pathOn = $derived(i.incPeak >= 0);
  const growth = $derived(incomeGrowth(p));
  const pathKind = $derived(incomePathKind(p));
  function togglePath(v: boolean) {
    if (!v) { setInputs({ incPeak: DEFAULTS.incPeak, incPeakAge: DEFAULTS.incPeakAge }); return; }
    setInputs(suggestedPath(p));
  }

  type OnKey = 'etfOn' | 'avdOn' | 'insOn' | 'fondOn';

  // Steuerprofil: Kirchensteuersatz als Auswahl (8 % Bayern/Baden-Württemberg, 9 % übrige Länder); ein anderer Wert
  // (z. B. aus einem Link) bleibt gültig und wird genannt.
  const KIST = [{ v: 0, label: 'Keine' }, { v: 8, label: '8 % (Bayern, Baden-Württemberg)' }, { v: 9, label: '9 % (übrige Länder)' }] as const;
  const kistOther = $derived(!KIST.some(o => o.v === i.kist));
</script>

{#snippet offNote(key: OnKey)}
  {#if !i[key]}
    <p class="offnote">Nicht im Vergleich – <button type="button" class="btn small" onclick={() => setInput(key, true)} data-testid="add-{key}"><Icon name="plus" />Hinzufügen</button></p>
  {/if}
{/snippet}

<h2 class="print-only print-h">Weitere Einstellungen &amp; Annahmen</h2>

<section class="card situation" aria-labelledby="s-sit">
  <div class="card-head">
    <h2 id="s-sit">Deine Situation</h2>
    <p class="hint">Diese Angaben verändern das Ergebnis oft stark.</p>
  </div>
  <div class="cols">
    <div class="grp" role="group" aria-labelledby="s-study" onfocusin={(e) => { if ((e.target as HTMLElement).closest('.study-fields')) studyFocus = true; }}
      onfocusout={(e) => { if ((e.target as HTMLElement).closest('.study-fields')) studyFocus = false; }}>
      <h3 id="s-study">Ausbildung</h3>
      <Switch id="f-study" checked={studyOn} testid="inStudy" onchange={toggleStudy} label="Noch in Ausbildung oder Studium" />
      {#if studyOn || studyFocus}
        <div class="study-fields">
          <NumberField id="f-studyEnd" layout="row" label="Ausbildung / Studium bis Alter" value={i.studyEnd} onchange={v => setInput('studyEnd', v)} min={i.a0} max={i.R} unit="Jahre" testid="studyEnd"
            limits={LIMITS.studyEnd} effective={p.studyEnd}
            hint="In ganzen Jahren ab heute: Jahre, in denen man jünger ist als dieser Wert, zählen als Ausbildungszeit." />
          <NumberField layout="row" label="Zu versteuerndes Einkommen bis dahin" value={i.incStudy} onchange={v => setInput('incStudy', v)} min={0} step={1000} unit="€/Jahr" info="zve"
            limits={LIMITS.incStudy} effective={p.incStudy} />
          <Switch checked={i.eligStudy} onchange={v => setInput('eligStudy', v)} label="Bis dahin förderberechtigt" info="foerderberechtigt" />
        </div>
      {/if}
    </div>
    <div class="grp" role="group" aria-labelledby="s-path">
      <h3 id="s-path">Gehaltsentwicklung</h3>
      <Switch id="f-path" checked={pathOn} testid="incPath" onchange={togglePath} label="Gehalt ändert sich bis zu einem Alter" info="gehaltsentwicklung" />
      {#if pathOn}
        <NumberField id="f-incPeak" layout="row" label="Zielgehalt, zu versteuern" value={i.incPeak} onchange={v => setInput('incPeak', v)} min={0} step={1000} unit="€/Jahr" info="zve" testid="incPeak"
          limits={LIMITS.incPeak} effective={p.incPeak} hint="Heutiges Geld. Gilt ab dem Zielalter bis Rentenbeginn." />
        <NumberField layout="row" label="… erreicht mit" value={i.incPeakAge} onchange={v => setInput('incPeakAge', v)} min={16} max={100} unit="Jahren" testid="incPeakAge"
          limits={LIMITS.incPeakAge} effective={p.incPeakAge}
          hint={pathKind === 'noWork' ? 'Ohne Wirkung: Die Ausbildung dauert bis zur Rente, es gibt keine Berufsphase.'
            : pathKind === 'now' ? 'Das Zielalter liegt nicht nach dem Berufsbeginn: Das Zielgehalt gilt sofort.'
            : growth != null
            ? incomeStartText(p).replace(/^a/, 'A') + ' real ' + (growth >= 0 ? '+' : '') + (Math.round(growth * 1000) / 10).toLocaleString('de-DE') + ' % pro Jahr, danach konstant.'
            : 'Linearer Übergang (Start- oder Zielgehalt 0).'} />
        {#if pathKind === 'late'}<p class="hint">Das Zielalter liegt nach Rentenbeginn; bis zur Rente wird das Zielgehalt nicht erreicht.</p>{/if}
      {/if}
    </div>
    <div class="grp" role="group" aria-labelledby="s-kids">
      <h3 id="s-kids">Kinder und Bonus <span class="h3-sub">(Altersvorsorgedepot)</span></h3>
      <NumberField id="f-kids" layout="row" label="Kinder mit Kindergeld" value={i.kids} onchange={v => setInput('kids', v)} min={0} max={10} info="zulagen" testid="kids"
        stepper limits={LIMITS.kids} effective={p.kids} />
      {#if i.kids > 0}
        <NumberField layout="row" label="… ab Alter" value={i.kidsFrom} onchange={v => setInput('kidsFrom', v)} unit="Jahre" limits={LIMITS.kidsFrom} />
        <NumberField layout="row" label="… für wie viele Jahre" value={i.kidsYears} onchange={v => setInput('kidsYears', v)} min={0} unit="Jahre" limits={LIMITS.kidsYears} effective={p.kidsYears} />
      {/if}
      <Switch checked={i.bonus} onchange={v => setInput('bonus', v)} label="Berufseinsteigerbonus 200 € (unter 25)" info="bonus" />
    </div>
    <div class="grp" role="group" aria-labelledby="s-tax">
      <h3 id="s-tax">Steuer</h3>
      <fieldset class="chips" data-testid="kist">
        <legend>Kirchensteuer <Info k="kirchensteuer" /></legend>
        <div class="opts">
          {#each KIST as o (o.v)}
            <label class="chip" class:on={i.kist === o.v}>
              <input type="radio" name="kist" value={o.v} checked={i.kist === o.v} id={o.v === 0 ? 'f-kist' : undefined}
                onchange={() => setInput('kist', o.v)} data-testid="kist-{o.v}" />{o.label}
            </label>
          {/each}
        </div>
        {#if kistOther}<p class="hint">Gerechnet wird mit {pc(p.kist).toLocaleString('de-DE')} %.</p>{/if}
      </fieldset>
      <Switch id="f-married" checked={i.married} testid="married" onchange={v => setInput('married', v)} label="Verheiratet, zusammen veranlagt" info="splitting" />
      {#if i.married}
        <NumberField layout="row" label="Partner: zu versteuerndes Einkommen bis zu deinem Rentenbeginn" value={i.incSpouse} onchange={v => setInput('incSpouse', v)} min={0} step={1000} unit="€/Jahr" info="zve" testid="incSpouse"
          limits={LIMITS.incSpouse} effective={p.incSpouse} />
        <NumberField layout="row" label="… ab deinem Rentenbeginn" value={i.incSpouseRet} onchange={v => setInput('incSpouseRet', v)} min={0} step={1000} unit="€/Jahr" testid="incSpouseRet"
          limits={LIMITS.incSpouseRet} effective={p.incSpouseRet} hint="Heutiges Geld, ohne die verglichenen Produkte. Gerechnet wird angenommen, dass der Partner keinen eigenen geförderten Vertrag und keine eigenen Kapitalerträge außer dem unter „Andere Kapitalerträge“ eingetragenen Verbrauch hat." />
      {/if}
    </div>
    <div class="grp" role="group" aria-labelledby="s-cap">
      <h3 id="s-cap">Andere Kapitalerträge</h3>
      <NumberField id="f-allowanceUsed" layout="row" label="Sparer-Pauschbetrag schon genutzt" value={i.allowanceUsed} onchange={v => setInput('allowanceUsed', v)} min={0} max={i.married ? 2000 : 1000} step={100} unit="€/Jahr" info="sparerGenutzt" testid="allowanceUsed"
        limits={LIMITS.allowanceUsed} effective={p.allowanceUsed}
        hint={'Zinsen und Erträge außerhalb der verglichenen Produkte, z. B. Tagesgeld. Heutiges Geld; 0 = ganzer Pauschbetrag frei (1.000 €, zusammen veranlagt 2.000 €).' + (!i.married && p.allowanceUsed > 1000 ? ' Mehr als 1.000 € ledig: Pauschbetrag ganz verbraucht.' : '')} />
    </div>
    <div class="grp" role="group" aria-labelledby="s-kv">
      <h3 id="s-kv">Krankenversicherung</h3>
      <NumberField id="f-kvGrossRet" layout="row" label="Sonstige KV-beitragspflichtige Bruttoeinnahmen im Alter" value={i.kvGrossRet} onchange={v => setInput('kvGrossRet', v)} min={-1} step={1000} unit="€/Jahr" limits={LIMITS.kvGrossRet} effective={kvGross(p)}
        hint="Heutiges Geld, ohne die verglichenen Produkte. −1 übernimmt das sonstige zu versteuernde Einkommen als Untergrenze; das Brutto (volle Rente vor Abzügen) ist meist höher und lässt sich hier eintragen." />
      <NumberField id="f-kvRate" layout="row" label="Beitragssatz KV + PV bei freiwilliger Versicherung" value={i.kvRate} onchange={v => setInput('kvRate', v)} step={0.1} min={0} max={40} unit="%" info="kvRate"
        limits={LIMITS.kvRate} effective={pc(p.kvRate)}
        hint={i.kvOn ? 'Gilt, weil oben „Freiwillig gesetzlich“ gewählt ist.' : 'Wirkt nur, wenn oben bei „Krankenversicherung als Rentner“ „Freiwillig gesetzlich“ gewählt ist.'} />
    </div>
  </div>
</section>

<section class="card" aria-labelledby="s-model">
  <h2 id="s-model">Modellannahmen und Sensitivitäten</h2>
  <Switch checked={i.payResidual} onchange={v => setInput('payResidual', v)} label="Offene Depots wie das AVD: jährlich Restkapital ÷ Restlaufzeit" />
  <p class="hint">Sonst nominal konstante vorschüssige Annuität für Depots. Das Entnahmeprofil beeinflusst die Summe der realen Zahlungen und die Rangfolge.</p>
  <Switch checked={i.fundingDelay} onchange={v => setInput('fundingDelay', v)} label="AVD-Zulagen und Erstattungen ein Jahr später (Sensitivität)" />
  <p class="hint">Standard: Ende des Beitragsjahres. Ein Jahr Verzug ist ein Szenario, keine gesetzliche Bearbeitungsfrist. Die letzte Gutschrift kommt am Ende des ersten Rentenjahres.</p>
  <Switch checked={i.indexAllowance} onchange={v => setInput('indexAllowance', v)} label="Sparer-Pauschbetrag wächst mit Inflation (hypothetische Sensitivität)" />
  <p class="hint">Gesetzlicher Ausgangswert: nominal 1.000 € jährlich (zusammen veranlagt 2.000 €). Tarif, Soli-Grenze und KV-BBG wachsen im Modell mit Inflation; diese Fortschreibung ist keine zugesicherte Rechtsentwicklung.</p>
  <NumberField layout="row" label="AVD-Kosten in der Auszahlung" value={i.avdPayCost} onchange={v => setInput('avdPayCost', v)} min={-1} step={0.1} unit="% p. a." limits={LIMITS.avdPayCost} effective={pc(p.avdPayCost < 0 ? p.avdCost : p.avdPayCost)} hint="−1 übernimmt die Ansparkosten. Der Standarddepot-Kostendeckel betrifft die Ansparphase." />
  <NumberField layout="row" label="ETF-Kosten in der Auszahlung (auch Neben-/Folgedepot)" value={i.etfPayTer} onchange={v => setInput('etfPayTer', v)} min={-1} step={0.1} unit="% p. a." limits={LIMITS.etfPayTer} effective={pc(p.etfPayTer < 0 ? p.etfTer : p.etfPayTer)} hint="−1 übernimmt die jeweilige TER; sonst eigener Kostensatz." />
  <NumberField layout="row" label="Aktiver Fonds: Kosten in der Auszahlung" value={i.fondPayTer} onchange={v => setInput('fondPayTer', v)} min={-1} step={0.1} unit="% p. a." limits={LIMITS.fondPayTer} effective={pc(p.fondPayTer < 0 ? p.fondTer : p.fondPayTer)} hint="−1 übernimmt die TER. Ein sicherer ETF-Teil nutzt die ETF-Auszahlkosten." />
</section>

<section class="products" aria-labelledby="s-prod">
  <div class="sec-head">
    <h2 id="s-prod">Kosten &amp; Beiträge je Produkt</h2>
    <p class="hint">Beiträge werden normalerweise oben für alle Produkte gemeinsam gesetzt. Hier nur, um sie einzeln zu ändern.</p>
  </div>
  <div class="grid">
    <section class="card" aria-labelledby="s-etf" data-testid="card-etf">
      <h3 id="s-etf"><span class="key" style:background="var(--s1)"></span>ETF-Depot</h3>
      {@render offNote('etfOn')}
      <NumberField layout="row" label="Beitrag" value={i.etfM} onchange={v => setInput('etfM', v)} step={10} min={0} unit="€/Monat" testid="etfM" limits={LIMITS.etfM} />
      <NumberField layout="row" label="Laufende Kosten (TER)" value={i.etfTer} onchange={v => setInput('etfTer', v)} step={0.05} min={0} unit="% p. a." info="ter" limits={LIMITS.etfTer} effective={pc(p.etfTer)} />
    </section>

    <section class="card" aria-labelledby="s-avd" data-testid="card-avd">
      <h3 id="s-avd"><span class="key" style:background="var(--s2)"></span>Altersvorsorgedepot</h3>
      {@render offNote('avdOn')}
      <NumberField layout="row" label="Beitrag (max. 150 gefördert)" value={i.avdM} onchange={v => setInput('avdM', v)} step={10} min={0} unit="€/Monat" info="nebendepot" limits={LIMITS.avdM} />
      <NumberField id="f-avdCost" layout="row" label="Ansparkosten" value={i.avdCost} onchange={v => setInput('avdCost', v)} step={0.1} min={0} unit="% p. a." info="avdKosten" testid="avdCost"
        limits={LIMITS.avdCost} effective={pc(p.avdCost)} />
      <p class="hint">Umschichtung vor Rentenbeginn wie im Standarddepot: unter „Markt“ (für alle Produkte).</p>
      <Switch checked={i.reinvest} onchange={v => setInput('reinvest', v)} label="Zusätzliche Steuererstattung in ETF anlegen" info="reinvest" testid="reinvest" />
      <p class="hint">Kinder und Berufseinsteigerbonus: oben unter „Deine Situation“.</p>
    </section>

    <section class="card" aria-labelledby="s-ins" data-testid="card-ins">
      <h3 id="s-ins"><span class="key" style:background="var(--s3)"></span>Fondsgebundene Rentenversicherung</h3>
      {@render offNote('insOn')}
      <NumberField layout="row" label="Beitrag" value={i.insM} onchange={v => setInput('insM', v)} step={10} min={0} unit="€/Monat" limits={LIMITS.insM} />
      <NumberField id="f-insEff" layout="row" label="Effektivkosten" value={i.insEff} onchange={v => setInput('insEff', v)} step={0.1} min={0} unit="% p. a." info="effektivkosten" testid="insEff"
        limits={LIMITS.insEff} effective={pc(p.insEff)} />
      <p class="hint">Kapitalauszahlung oder Rente, Rentenfaktor und Garantiezeit: unter „Rente im Detail“.</p>
    </section>

    <section class="card" aria-labelledby="s-fond" data-testid="card-fond">
      <h3 id="s-fond"><span class="key" style:background="var(--s4)"></span>Aktiver Fonds</h3>
      {@render offNote('fondOn')}
      <NumberField layout="row" label="Beitrag" value={i.fondM} onchange={v => setInput('fondM', v)} step={10} min={0} unit="€/Monat" limits={LIMITS.fondM} />
      <NumberField id="f-fondAA" layout="row" label="Kaufkosten (Anteil am Bruttobeitrag)" value={i.fondAA} onchange={v => setInput('fondAA', v)} step={0.5} min={0} unit="%" info="ausgabeaufschlag" limits={LIMITS.fondAA} effective={pc(p.fondAA)} />
      <NumberField layout="row" label="Laufende Kosten" value={i.fondTer} onchange={v => setInput('fondTer', v)} step={0.1} min={0} unit="% p. a." info="ter" limits={LIMITS.fondTer} effective={pc(p.fondTer)} />
    </section>
  </div>
</section>

<section class="card market" aria-labelledby="s-market">
  <h2 id="s-market">Markt</h2>
  <div class="cols">
    <div>
      <NumberField id="f-infl" layout="row" label="Inflation" value={i.infl} onchange={v => setInput('infl', v)} step={0.5} unit="% p. a." info="kaufkraft" testid="infl"
        limits={LIMITS.infl} effective={pc(p.infl)} />
      <NumberField id="f-dyn" layout="row" label="Beiträge steigen jährlich um" value={i.dyn} onchange={v => setInput('dyn', v)} step={1} unit="%" info="dynamik" testid="dyn"
        limits={LIMITS.dyn} effective={pc(p.dyn)} />
    </div>
    <div>
      <NumberField layout="row" label="Basiszins für Vorabpauschale" value={i.basis} onchange={v => setInput('basis', v)} step={0.1} min={0} max={10} unit="%" info="basiszins"
        limits={LIMITS.basis} effective={pc(p.basis)} hint="2026: 3,2 % (BMF, 13.01.2026). Für spätere Jahre eine Annahme." />
      <Switch checked={i.shift} onchange={v => setInput('shift', v)} label="Vor Rentenbeginn in sichere Anlagen umschichten (alle Produkte, wie im Standarddepot)" info="umschichtung" testid="shift" id="f-shift" />
      {#if i.shift}
        <NumberField id="f-safeRate" layout="row" label="Rendite sichere Anlage" value={i.safeRate} onchange={v => setInput('safeRate', v)} step={0.5} unit="% p. a." info="umschichtung" testid="safeRate"
          limits={LIMITS.safeRate} effective={pc(p.safeRate)} />
      {/if}
    </div>
  </div>
</section>

<section class="card assume" id="annahmen" aria-labelledby="s-assume" bind:this={assume} tabindex="-1">
  <div class="card-head">
    <h2 id="s-assume">Annahmen &amp; Grenzen</h2>
    <p class="hint">Rechtsstand: {SITE.lawState}. Zuletzt geprüft am {SITE.updated}.</p>
  </div>
  <details open>
    <summary>Nicht berücksichtigt – und die Rendite schwankt</summary>
    <p>Die Rendite ist konstant angenommen, in Wirklichkeit schwankt sie stark, auch über Jahre. Nicht berücksichtigt: Erbschaftsteuer, Pfändungsschutz (AVD geschützt, ETF nicht), Betriebsrente mit Arbeitgeberzuschuss, Ordergebühren. Modellrechnung, keine Anlage-, Steuer- oder Rechtsberatung.</p>
  </details>
  <details>
    <summary>Einkommensteuer</summary>
    <p>Einkommensteuer nach Tarif 2026 (§ 32a EStG) inkl. Solidaritätszuschlag; die Tarifgrenzen wachsen mit der Inflation mit, der Sparerpauschbetrag bleibt bei 1.000 € (zusammen veranlagt 2.000 €). Ledig: Grundtarif. Verheiratet: Splittingtarif auf das gemeinsame zu versteuernde Einkommen (§ 32a Abs. 5), Soli-Freigrenze verdoppelt; der Partner hat dabei keinen eigenen geförderten Vertrag und keine eigenen Kapitalerträge, seine mögliche Zulage (§ 79 Satz 2) ist nicht gerechnet. Kirchensteuer (8 oder 9 %) auf die Einkommensteuer einschließlich der Zulage, die bei der Günstigerprüfung hinzugerechnet wird (§ 51a EStG); gezahlte Kirchensteuer mindert als Sonderausgabe das Einkommen (§ 10 Abs. 1 Nr. 4). Nicht gerechnet: Kinderfreibeträge in der Bemessung, Kappung der Kirchensteuer, Kirchgeld; bei Verheirateten sind beide Kirchenmitglied. Erben versteuern im Grundtarif mit demselben Kirchensteuersatz; erbt der zusammen veranlagte Partner, gilt im Todesjahr noch das Splitting. Die Steuerreform 2027 ist noch nicht beschlossen. Das Gehalt bleibt bis zur Rente real gleich, außer unter „Gehaltsentwicklung“ ist ein Zielgehalt eingetragen.</p>
  </details>
  <details>
    <summary>ETF und Fonds</summary>
    <p>Abgeltungsteuer 26,375 % (mit Kirchensteuer 9 %: 27,995 %, 8 %: 27,819 %; § 32d Abs. 1 EStG), 30 % Teilfreistellung (Aktienfonds), Sparer-Pauschbetrag 1.000 € nominal pro Jahr (zusammen veranlagt 2.000 €; in der Kombi gemeinsam einschließlich Versicherungsleistung), Vorabpauschale mit Zufluss im Folgejahr. Die Steuer wird aus dem Depot bezahlt; die beim dafür nötigen Anteilsverkauf entstehende Steuer ist mitgerechnet. Entnahmen jährlich am Jahresanfang als Zeitnäherung statt monatlicher Zahlung.</p>
  </details>
  <details>
    <summary>Altersvorsorgedepot</summary>
    <p>Gesetz vom 26.05.2026 (BGBl. 2026 I Nr. 156), gilt ab 2027: 50 % Zulage auf die ersten 360 €, 25 % bis 1.800 € (max. 540 €), min. 120 € Eigenbeitrag; Kinderzulage 1:1 bis 300 € je Kind; Berufseinsteigerbonus 200 € unter 25 (zählt nicht in der Günstigerprüfung); Sonderausgabenabzug (Beitrag + Zulagen) mit Günstigerprüfung; Auszahlung aus dem geförderten Teil voll steuerpflichtig, ohne Fünftelregelung; der Sonderausgabenabzug ist auch unter 120 € Eigenbeitrag möglich, dann ohne Zulagen; Auszahlplan bis mind. 85, gerechnet als jährlich Restkapital ÷ Restlaufzeit (gesetzlich reicht es, mindestens 80 % davon zu zahlen und die Rate spätestens alle 3 Jahre neu festzulegen); Rentenbeginn 65–70 (früher nur zusammen mit einer früheren gesetzlichen Altersrente, nicht gerechnet).</p>
    <p>Beiträge über 1.800 € im Jahr bleiben bis zum Höchstbetrag von 6.840 € im Jahr ungefördert im AVD (AVD-Kosten, keine Steuer in der Ansparphase; bei Auszahlung ist nur der Gewinnanteil steuerpflichtig, nach 12 Jahren Laufzeit zur Hälfte). Für freiwillig gesetzlich Versicherte zählt die ganze Auszahlung zur Krankenversicherung (wie bei privaten Renten, BSG B 12 KR 28/08 R; für das AVD noch nicht entschieden). Was über 6.840 € hinausgeht, und Beiträge aus Jahren ohne Förderberechtigung (ob sie ungefördert ins AVD dürfen, ist offen) liegen in einem ETF-Nebendepot (gleiche TER wie das ETF-Depot). Vereinfacht wird ab heute statt ab 01.01.2027 gerechnet, und Zulagen/Erstattungen werden standardmäßig zum Beitragsjahresende gutgeschrieben (Verzögerung als Sensitivität wählbar; tatsächliche Bearbeitungsdauer offen).</p>
  </details>
  <details>
    <summary>Heutige Kaufkraft</summary>
    <p>Einzahlungen und Förderung werden Jahr für Jahr in heutige Kaufkraft umgerechnet, Kapitalwerte zum jeweiligen Zeitpunkt. Die Ø-Monatsrente wird für alle Produkte über denselben Zeitraum (Rentenbeginn bis Auszahlplan-Ende) gemittelt. Welches Produkt vorne liegt, wird immer in heutiger Kaufkraft verglichen, auch wenn nominale Beträge angezeigt werden.</p>
  </details>
  <details>
    <summary>Erbfall</summary>
    <p>Altersvorsorgedepot: Ehepartner können das Guthaben förderunschädlich auf einen eigenen Vertrag übertragen; die spätere Einkommensteuer darauf ist grob abgezogen. Alle anderen Erben: Zulagen und Steuervorteile werden zurückgefordert (§ 93 EStG). Die Erträge versteuern die Erben mit ihrem eigenen Steuersatz (§ 22 Nr. 5 S. 3 EStG; BMF-Schreiben vom 05.10.2023, Rn. 229 f.), nur zur Hälfte, wenn der Erbe mindestens 62 ist und der Vertrag mindestens 12 Jahre lief. Nach Rentenbeginn werden Restbeiträge und verbleibende Förderung noch grob am Restguthaben bemessen; deren genaue Zuordnung ist offen. Die latente Ehepartnersteuer nutzt den Restzeitraum der verstorbenen Person und deren Einkommen im Alter, bei „Verheiratet“ stattdessen das Einkommen des Partners im Alter (Grundtarif); das Todesjahr selbst ist dann gemeinsam veranlagt (Splitting mit dem Einkommen des Partners, 2.000 € Pauschbetrag, § 26 EStG). Das ist kein eigener Hinterbliebenen-Auszahlplan. Bei verzögerter Förderung wird nur bereits gutgeschriebene Förderung zurückgefordert; noch offene Ansprüche sind im Erbwert weder angesetzt noch abgezogen. Der ungeförderte Teil (Beiträge über 1.800 € im Jahr) geht ohne Rückforderung an alle Erben; sie versteuern nur dessen Gewinn (§ 22 Nr. 5 S. 2 Buchst. c EStG), beim Ehepartner ebenso. Restrenten aus der Garantiezeit der Versicherung versteuern die Erben ebenfalls selbst.</p>
  </details>
  <details>
    <summary>Kapitalerträge</summary>
    <p>Ein gemeinsamer Sparer-Pauschbetrag für Versicherungsleistung und alle Fondsdepots: zunächst Versicherung, dann zugeflossene Vorabpauschalen, danach Entnahmen/Umschichtungen. Vorabpauschalen gelten am ersten Werktag des Folgejahres als zugeflossen. Die jährliche Kapitalertrags-Günstigerprüfung vergleicht die gesamte Abgeltungsteuer mit dem persönlichen Tarif nach Sonderausgaben. Erstattungen zählen im selben Steuerjahr als verfügbares Geld ohne Wiederanlage, auch beim Ansparen. Diese Zahlungen vor Rentenbeginn gehen nicht in die Summe der Rentenauszahlungen ein. Andere Kapitalerträge (z. B. Tagesgeld) gehen nur so weit ein, wie sie den Sparer-Pauschbetrag verbrauchen (unter „Andere Kapitalerträge“); der Betrag wächst mit der Inflation, der Pauschbetrag nicht. Die Erben haben ihren eigenen vollen Pauschbetrag.</p>
  </details>
  <details>
    <summary>Versicherung</summary>
    <p>Effektivkosten als konstante Renditeminderung (Abschlusskosten sind darin über die Laufzeit verteilt; bei früher Kündigung deutlich schlechter). Kapitalauszahlung: 15 % des Gewinns steuerfrei, davon die Hälfte mit persönlichem Steuersatz (§ 20 Abs. 1 Nr. 6 EStG, nach 12 Jahren und ab 62). Leibrente: Ertragsanteil-Besteuerung (§ 22 EStG), keine Überschüsse in der Rentenphase. Tod vor Rentenbeginn: einkommensteuerfrei. Restrenten aus der Garantiezeit: mit Ertragsanteil, versteuert von den Erben.</p>
  </details>
  <details>
    <summary>Krankenversicherung</summary>
    <p>Nur wenn „freiwillig gesetzlich“ gewählt ist: Beitragssatz für Mitglieder ohne Krankengeld (14,0 % + Ø-Zusatzbeitrag 2,9 % + Pflege 4,2 % kinderlos = 21,1 %) auf AVD-Auszahlungen, Versicherungsleistungen (Leibrente voll; Kapitalauszahlung voll und auf 120 Monate verteilt, BSG B 12 KR 28/08 R, § 5 Abs. 4 Beitragsverfahrensgrundsätze Selbstzahler) und Fondserträge (Gewinnanteil der Entnahmen und Vorabpauschale, nach 30 % Teilfreistellung). Alle Einnahmen eines Produkts zusammen nur bis zur Beitragsbemessungsgrenze 2026 (69.750 €), die mit der Inflation mitwächst. Die zusätzliche KV/PV mindert als Sonderausgabe die Einkommensteuer. Die Entlastung zählt im selben Jahr zum verfügbaren Netto und wird nicht wiederangelegt. Das übrige Alterseinkommen ist als zu versteuerndes Einkommen vor diesen zusätzlichen Beiträgen einzugeben. Ob das AVD bei freiwillig Versicherten genauso behandelt wird (Auszahlplan und 30-%-Auszahlung, gerechnet ebenfalls mit 120 Monaten), ist noch nicht geklärt.</p>
  </details>
  <details>
    <summary>Szenarien im Überblick</summary>
    <p>Jede Zeile ändert genau eine Annahme gegenüber den Eingaben, alles andere bleibt gleich. Das Szenario „Steuererstattung ausgegeben“ zählt nicht als Kippen, weil dann kein fairer Vergleich möglich ist.</p>
  </details>
</section>

<section class="card noprint" aria-labelledby="s-data">
  <h2 id="s-data">Deine Daten</h2>
  <p class="hint">Alle Berechnungen laufen in diesem Browser. Eingaben werden nur hier gespeichert (localStorage) und nicht übertragen. Ein geteilter Link enthält die Eingaben im Teil nach dem #, der nicht an den Server geschickt wird.</p>
  <div class="acts">
    <button class="btn" type="button" onclick={resetToDefaults}><Icon name="reset" />Auf Standardwerte zurücksetzen</button>
    <button class="btn" type="button" onclick={forgetSaved} data-testid="forget"><Icon name="trash" />Gespeicherte Eingaben löschen</button>
  </div>
</section>

<style>
  .cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 4px 32px; align-items: start; }
  .grp h3 { margin: 6px 0 2px; }
  .h3-sub { text-transform: none; letter-spacing: 0; font-weight: 500; color: var(--muted); }
  .situation { border-left: 4px solid var(--accent); }
  .products { margin-top: 24px; }
  .sec-head { margin: 0 2px 10px; }
  .sec-head h2 { margin-bottom: 2px; }
  .sec-head .hint { margin: 0; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; align-items: start; }
  .grid :global(.card + .card) { margin-top: 0; }
  .grid h3 {
    display: flex; align-items: center; gap: 8px; margin-bottom: 6px;
    font-size: 1rem; font-weight: 650; text-transform: none; letter-spacing: -0.01em; color: var(--text);
  }
  .grid .hint { margin: 6px 0 0; }
  .offnote { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin: 0 0 4px; font-size: .85rem; color: var(--muted); }
  .products + .card, .card + .card { margin-top: 16px; }
  .market h2 { margin-bottom: 4px; }
  .assume details { border-top: 1px solid var(--grid); }
  .assume details:first-of-type { border-top: 0; }
  .assume summary { cursor: pointer; padding: 9px 0; font-weight: 600; font-size: .92rem; }
  .assume summary:hover { color: var(--accent-text); }
  .assume details p { margin: 0 0 10px; color: var(--text-2); font-size: .86rem; max-width: 95ch; }
  .assume:focus { outline: none; }
  .acts { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
  .print-h { margin: 0 0 10px; }
  .chips { border: 0; margin: 0; padding: 6px 0; min-width: 0; }
  .chips legend { padding: 0; margin-bottom: 6px; font-size: .82rem; color: var(--text-2); display: flex; align-items: center; gap: 4px; }
  .chips .opts { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip {
    display: inline-flex; align-items: center; gap: 7px; cursor: pointer; user-select: none;
    padding: 5px 12px 5px 8px; border-radius: 999px; font-size: .85rem;
    border: 1px solid var(--border-strong); color: var(--text-2); background: var(--surface);
  }
  .chip input { width: 16px; height: 16px; margin: 0; accent-color: var(--accent); }
  .chip.on { color: var(--text); background: var(--surface-2); border-color: var(--text-2); }
  .chip:hover { border-color: var(--text-2); }
  .chip:focus-within { outline: 2px solid var(--accent); outline-offset: 2px; }
  @media (pointer: coarse) { .chip { padding: 8px 14px 8px 10px; } }
  @media (max-width: 400px) { .grid { grid-template-columns: 1fr; } }
  @media print {
    .assume summary { padding: 4px 0 2px; }
    .assume details { border: 0; }
    .assume details p { margin-bottom: 4px; }
    .offnote { display: none; }
    .products { margin-top: 12px; }
  }
</style>
