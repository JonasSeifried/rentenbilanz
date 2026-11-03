<script lang="ts">
  import { app, setInput, resetToDefaults, forgetSaved } from '../state.svelte';
  import { SITE } from '../site';
  import NumberField from '../components/NumberField.svelte';
  import Switch from '../components/Switch.svelte';
  import Icon from '../components/Icon.svelte';

  const i = $derived(app.inputs);
  const inStudy = $derived(i.studyEnd > i.a0);
  const pctClamp = (lo: number, hi: number) => (v: number) => v < lo || v > hi ? 'Gerechnet wird mit ' + Math.min(hi, Math.max(lo, v)).toLocaleString('de-DE') + ' %.' : null;
</script>

<h2 class="print-only print-h">Weitere Einstellungen &amp; Annahmen</h2>
<div class="grid">
  <section class="card" aria-labelledby="s-study">
    <h2 id="s-study">Ausbildung &amp; Krankenversicherung</h2>
    <Switch checked={inStudy} testid="inStudy"
      onchange={v => setInput('studyEnd', v ? Math.max(i.studyEnd, i.a0 + 2) : 16)}
      label="Noch in Ausbildung oder Studium" />
    {#if inStudy}
      <NumberField layout="row" label="Ausbildung / Studium bis Alter" value={i.studyEnd} onchange={v => setInput('studyEnd', v)} min={i.a0} max={i.R} unit="J."
        hint="In ganzen Jahren ab heute: Jahre, in denen man jünger ist als dieser Wert, zählen als Ausbildungszeit." />
      <NumberField layout="row" label="Zu versteuerndes Einkommen bis dahin" value={i.incStudy} onchange={v => setInput('incStudy', v)} min={0} step={1000} unit="€/J." info="zve" />
      <Switch checked={i.eligStudy} onchange={v => setInput('eligStudy', v)} label="Bis dahin förderberechtigt" info="foerderberechtigt" />
    {/if}
    <NumberField layout="row" label="Beitragssatz KV + PV bei freiwilliger Versicherung" value={i.kvRate} onchange={v => setInput('kvRate', v)} step={0.1} min={0} max={40} unit="%" info="kvRate"
      hint={i.kvOn ? undefined : 'Wirkt nur, wenn oben „freiwillig gesetzlich krankenversichert“ eingeschaltet ist.'} clampNote={pctClamp(0, 40)} />
  </section>

  <section class="card" aria-labelledby="s-market">
    <h2 id="s-market">Markt</h2>
    <NumberField layout="row" label="Inflation" value={i.infl} onchange={v => setInput('infl', v)} step={0.5} unit="% p. a." info="kaufkraft" clampNote={pctClamp(-5, 20)} />
    <NumberField layout="row" label="Beiträge steigen jährlich um" value={i.dyn} onchange={v => setInput('dyn', v)} step={1} unit="%" info="dynamik" clampNote={pctClamp(-10, 20)} />
    <NumberField layout="row" label="Basiszins für Vorabpauschale" value={i.basis} onchange={v => setInput('basis', v)} step={0.1} min={0} max={10} unit="%" info="basiszins" clampNote={pctClamp(0, 10)} />
    <p class="hint">2026: 3,2 % (BMF, 13.01.2026). Für spätere Jahre eine Annahme.</p>
  </section>

  <section class="card" aria-labelledby="s-etf">
    <h2 id="s-etf"><span class="key" style:background="var(--s1)"></span>ETF-Depot</h2>
    <NumberField layout="row" label="Beitrag" value={i.etfM} onchange={v => setInput('etfM', v)} step={10} min={0} unit="€/Mon." testid="etfM" />
    <NumberField layout="row" label="Laufende Kosten (TER)" value={i.etfTer} onchange={v => setInput('etfTer', v)} step={0.05} min={0} unit="% p. a." info="ter" />
    <p class="hint">Beiträge werden normalerweise oben für alle Produkte gemeinsam gesetzt. Hier nur, um sie einzeln zu ändern.</p>
  </section>

  <section class="card" aria-labelledby="s-avd">
    <h2 id="s-avd"><span class="key" style:background="var(--s2)"></span>Altersvorsorgedepot</h2>
    <NumberField layout="row" label="Beitrag (max. 150 gefördert)" value={i.avdM} onchange={v => setInput('avdM', v)} step={10} min={0} unit="€/Mon." info="nebendepot" />
    <NumberField layout="row" label="Kosten" value={i.avdCost} onchange={v => setInput('avdCost', v)} step={0.1} min={0} unit="% p. a." info="avdKosten" />
    <NumberField layout="row" label="Kinder mit Kindergeld" value={i.kids} onchange={v => setInput('kids', v)} min={0} max={6} info="zulagen" />
    {#if i.kids > 0}
      <NumberField layout="row" label="… ab Alter" value={i.kidsFrom} onchange={v => setInput('kidsFrom', v)} unit="J." />
      <NumberField layout="row" label="… für wie viele Jahre" value={i.kidsYears} onchange={v => setInput('kidsYears', v)} min={0} unit="J." />
    {/if}
    <Switch checked={i.bonus} onchange={v => setInput('bonus', v)} label="Berufseinsteigerbonus 200 € (unter 25)" info="bonus" />
    <Switch checked={i.reinvest} onchange={v => setInput('reinvest', v)} label="Zusätzliche Steuererstattung in ETF anlegen" info="reinvest" testid="reinvest" />
  </section>

  <section class="card" aria-labelledby="s-ins">
    <h2 id="s-ins"><span class="key" style:background="var(--s3)"></span>Fondsgebundene Rentenversicherung</h2>
    <NumberField layout="row" label="Beitrag" value={i.insM} onchange={v => setInput('insM', v)} step={10} min={0} unit="€/Mon." />
    <NumberField layout="row" label="Effektivkosten" value={i.insEff} onchange={v => setInput('insEff', v)} step={0.1} min={0} unit="% p. a." info="effektivkosten" />
    <p class="hint">Kapitalauszahlung oder Rente, Rentenfaktor und Garantiezeit: unter „Rente im Detail“.</p>
  </section>

  <section class="card" aria-labelledby="s-fond">
    <h2 id="s-fond"><span class="key" style:background="var(--s4)"></span>Aktiver Fonds</h2>
    <NumberField layout="row" label="Beitrag" value={i.fondM} onchange={v => setInput('fondM', v)} step={10} min={0} unit="€/Mon." />
    <NumberField layout="row" label="Ausgabeaufschlag" value={i.fondAA} onchange={v => setInput('fondAA', v)} step={0.5} min={0} unit="%" info="ausgabeaufschlag" />
    <NumberField layout="row" label="Laufende Kosten" value={i.fondTer} onchange={v => setInput('fondTer', v)} step={0.1} min={0} unit="% p. a." info="ter" />
  </section>
</div>

<section class="card assume" id="annahmen" aria-labelledby="s-assume">
  <h2 id="s-assume">Annahmen &amp; Grenzen</h2>
  <p class="hint">Rechtsstand: {SITE.lawState}. Zuletzt geprüft am {SITE.updated}.</p>
  <ul>
    <li>Einkommensteuer nach Tarif 2026 (§ 32a EStG, Grundtarif, ledig) inkl. Solidaritätszuschlag; die Tarifgrenzen wachsen mit der Inflation mit, der Sparerpauschbetrag bleibt bei 1.000 €. Keine Kirchensteuer, kein Ehegattensplitting. Die Steuerreform 2027 ist noch nicht beschlossen.</li>
    <li>ETF/Fonds: Abgeltungsteuer 26,375 %, 30 % Teilfreistellung (Aktienfonds), Sparerpauschbetrag 1.000 € pro Jahr (je Produkt gerechnet), Vorabpauschale jährlich. Entnahmen jährlich am Jahresanfang (für ETF/AVD leicht konservativ).</li>
    <li>Altersvorsorgedepot (Gesetz vom 26.05.2026, BGBl. 2026 I Nr. 156, gilt ab 2027): 50 % Zulage auf die ersten 360 €, 25 % bis 1.800 € (max. 540 €), min. 120 € Eigenbeitrag; Kinderzulage 1:1 bis 300 € je Kind; Berufseinsteigerbonus 200 € unter 25; Sonderausgabenabzug (Beitrag + Zulagen) mit Günstigerprüfung; Auszahlung voll steuerpflichtig, ohne Fünftelregelung; Auszahlplan bis mind. 85 als Restkapital ÷ Restlaufzeit; Rentenbeginn 65–70. Beiträge über 150 € im Monat und Beiträge ohne Förderberechtigung gehen in ein ETF-Nebendepot (gleiche TER wie das ETF-Depot). Ins AVD dürften bis 6.840 € im Jahr ungefördert fließen; diese Variante ist nicht gerechnet. Vereinfacht wird ab heute statt ab 01.01.2027 gerechnet, und Zulagen werden sofort zum Jahresende gutgeschrieben (in echt 1–2 Jahre später).</li>
    <li>„Heutige Kaufkraft“: Einzahlungen und Förderung werden Jahr für Jahr in heutige Kaufkraft umgerechnet, Kapitalwerte zum jeweiligen Zeitpunkt. Die Ø-Monatsrente wird für alle Produkte über denselben Zeitraum (Rentenbeginn bis Auszahlplan-Ende) gemittelt.</li>
    <li>Erbfall AVD: Ehepartner können das Guthaben förderunschädlich auf einen eigenen Vertrag übertragen; die spätere Einkommensteuer darauf ist grob abgezogen (verteilt auf den Auszahlplan). Alle anderen Erben: Zulagen und Steuervorteile werden zurückgefordert (§ 93 EStG), die Erträge mit dem Steuersatz der verstorbenen Person im Todesjahr versteuert (§ 22 Nr. 5 S. 3 EStG). Nach Rentenbeginn anteilig zum Restguthaben.</li>
    <li>Versicherung: Effektivkosten als konstante Renditeminderung (Abschlusskosten sind darin über die Laufzeit verteilt; bei früher Kündigung deutlich schlechter). Kapitalauszahlung: 15 % des Gewinns steuerfrei, davon die Hälfte mit persönlichem Steuersatz (§ 20 Abs. 1 Nr. 6 EStG, nach 12 Jahren und ab 62). Leibrente: Ertragsanteil-Besteuerung (§ 22 EStG), keine Überschüsse in der Rentenphase. Tod vor Rentenbeginn: einkommensteuerfrei. Restrenten aus der Garantiezeit: mit Ertragsanteil versteuert.</li>
    <li>Krankenversicherung (nur wenn eingeschaltet): voller Beitragssatz auf AVD-Auszahlungen, Versicherungsleistungen (Leibrente voll, Kapitalauszahlung voll und auf 120 Monate verteilt, BSG B 12 KR 28/08 R) und ETF-Gewinne, bis zur Beitragsbemessungsgrenze 2026, die mit der Inflation mitwächst. Ob das AVD bei freiwillig Versicherten genauso behandelt wird, ist noch nicht ganz geklärt.</li>
    <li>Szenarien im Überblick: Jede Zeile ändert genau eine Annahme gegenüber den Eingaben, alles andere bleibt gleich.</li>
    <li>Nicht berücksichtigt: Erbschaftsteuer, Pfändungsschutz (AVD geschützt, ETF nicht), Betriebsrente mit Arbeitgeberzuschuss, Ordergebühren.</li>
    <li>Die Rendite ist konstant angenommen, in Wirklichkeit schwankt sie stark. Modellrechnung, keine Anlage-, Steuer- oder Rechtsberatung.</li>
  </ul>
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
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; align-items: start; }
  .grid :global(.card + .card) { margin-top: 0; }
  .grid h2 { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
  .grid .hint { margin: 6px 0 0; }
  .assume, .grid + .card { margin-top: 16px; }
  .assume ul { margin: 8px 0 0; padding-left: 18px; color: var(--text-2); font-size: .86rem; }
  .assume li { margin: 6px 0; }
  .acts { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
  .print-h { margin: 0 0 10px; }
  @media (max-width: 400px) { .grid { grid-template-columns: 1fr; } }
</style>
