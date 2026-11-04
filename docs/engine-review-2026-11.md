# Engine-Review November 2026

Geprüft am 04.11.2026, Rechnung von `main` nach `a05faf3`. Der beim Prüfstart vorhandene Folgecommit
`8cc847c` enthielt nur die Vorfassung dieses Berichts. Keine Änderung der Rechnung.

**Umsetzungsstand:** R1, R6 und R8 sind inzwischen umgesetzt; siehe [Abweichungen](abweichungen-vom-original.md#korrekturen-aus-dem-review-november-2026). Die folgenden Messungen beschreiben weiterhin den geprüften Stand vor diesen Änderungen.

## Befunde nach Schweregrad

**Lesart:** Änderung gegenüber der heutigen Engine bei isolierter Korrektur bzw. ausdrücklich genannter
Sensitivität, in **€ cumH heutiger Kaufkraft**, gerundet. Tripel immer **ETF / AVD / Versicherung**.
Plus bedeutet mehr Auszahlung. Der aktive Fonds steht ergänzend im Text. Einzelsieger:
Default AVD, DK und High ETF. **Kein isolierter Eingriff dieser Tabelle wechselt diese Sieger; gemeinsam kann es kippen.**

| ID | Befund | Schwere / heutige Begünstigung | Default | DK | High |
|---|---|---|---|---|---|
| R1 | Zusätzliche KV/PV nicht als Sonderausgaben abgezogen | **falsch**, benachteiligt besonders AVD | 0 / 0 / 0 | +3.976 / +12.947 / +7.714 | +11.817 / +34.748 / +19.836 |
| R2 | Verkauf zur Zahlung der Vorabpauschalensteuer ohne eigene Gewinnsteuer | **falsch**, begünstigt vor allem ETF | −1.224 / −18 / −103 | −1.589 / −31 / −180 | −3.597 / −208 / −357 |
| R3 | Günstigerprüfung für Kapitalerträge fehlt | **falsch**, benachteiligt offene Depots | +736 / 0 / +295 | +736 / 0 / +295 | 0 / 0 / 0 |
| R4 | Vorabpauschale im falschen Steuer- und KV-Jahr | **falsch**, überwiegend zugunsten offener Depots | −139 / −12 / −64 | −666 / −67 / −58 | −1.183 / −332 / −553 |
| R5 | Dasselbe Alterseinkommen für Tarif und belegte KV-BBG | **falsches Eingabemodell**, bei Brutto > zvE zu viel KV | 0 / 0 / 0 | 0 / 0 / 0 | 0 / +18.319 / +18.990¹ |
| R6 | Unter 120 € Jahresbeitrag auch Sonderausgabenabzug abgeschaltet | **falsch**, benachteiligt AVD-Kleinbeiträge | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0² |
| R7 | Hälftig besteuerte Versicherung nutzt keinen gemeinsamen Pauschbetrag | **falsch, klein**, benachteiligt Versicherung | 0 / 0 / +57 | 0 / 0 / +55 | 0 / 0 / +98 |
| R8 | Steuerbetrag nicht auf volle Euro abgerundet | **falsch, klein**, Richtung wechselnd | 0 / +3 / −1 | 0 / +2 / −1 | 0 / +9 / 0 |
| V1 | Unterschiedliche Entnahmeprofile beeinflussen die Rangfolge | **Verzerrung ≥ 0,5 %**, zugunsten AVD | +3.465 / +484 / +2.389 | +2.392 / +363 / +1.313 | +5.413 / +519 / +3.695 |
| V2 | Zulage und Erstattung ohne Bearbeitungsverzug | **Verzerrung ≥ 0,5 %**, zugunsten AVD | 0 / −2.702 / 0 | 0 / −2.065 / 0 | 0 / −2.349 / 0 |
| V3 | Pauschbetrag nominal fest bei indexiertem Tarif | **Annahme, ≥ 0,5 %**, relativ zugunsten Verträgen | +8.041 / +203 / +3.903 | +7.596 / +184 / +3.775 | +7.199 / +1.881 / +3.727 |
| H1/H2 | Erbfall: latente Steuer, Restbeiträge und Förderrückzahlung grob | **offen / Verzerrung im Erbwert**, Richtung fallabhängig | cumH 0 | cumH 0 | cumH 0 |

¹ **Sensitivität**, keine aus `incRet` ableitbare Korrektur: beitragspflichtige sonstige Bruttoeinnahmen =
1,2 × `incRet`, Steuerbasis unverändert. ² Bei stattdessen **9 €/Monat AVD**: +3.282 / +2.964 / +3.213 €
für Default / DK / High. Kein Effekt auf ETF/Versicherung; Zusatzfälle mit geändertem AVD-Beitrag.

## Fälle und Messung

Default = `readParams({...DEFAULTS})`: Alter 22, R 67, H 90, zvE Arbeit 38.000 €, Alter 20.000 €,
je 150 €/Monat, Rendite 6 % / 4 %, Inflation 2 %, keine Dynamik, keine Umschichtung/Teilauszahlung,
Versicherung mit Kapitalauszahlung. DK zusätzlich `kvOn:true`. High zusätzlich Alter 30, Arbeit 110.000 €,
Alterseinkommen 45.000 €, **alle** Monatsbeiträge und `setAll` 500 €.

Haupttabellen mit **aktuellem Standard 21,1 % KV/PV**. Die früheren Wirkungstests in
[Abweichungen](abweichungen-vom-original.md) verwenden teils 21,7 %; separate Nachrechnung unten.
Der aktive Fonds wurde zusätzlich eingeschaltet, ohne die anderen Einzelbeiträge zu verändern.

| Ausgangslage | ETF | AVD | Versicherung | aktiver Fonds | Vorsprung Erster vor Zweitem |
|---|---:|---:|---:|---:|---:|
| Default | 153.730 | 174.891 | 127.324 | 90.829 | AVD +21.161 |
| DK | 137.576 | 128.027 | 97.162 | 84.133 | ETF +9.549 |
| High | 323.094 | 281.639 | 245.025 | 212.525 | ETF +41.455 |

Gemessen mit temporären Kopien von `combo.ts` und zwei Vitest-Probedateien. Unveränderte Kopie für alle vier
Produkte und drei Fälle **bitgleich in cumHReal** mit `analyze()`. Je Variante nur den bezeichneten Block geändert;
Messgröße `comboStats(p, combo(p, split)).cumHReal`. Probe-Code anschließend gelöscht. Die Beträge sind
Modellvergleiche, keine Prognosen auf den Euro. Isolierte Wirkungen sind nicht einfach addierbar.

## Rechen- und Steuerfehler

### R1 – KV/PV als Sonderausgaben

`src/lib/engine/combo.ts:285`, `:520`: Erst Tarifsteuer, danach KV-Abzug ohne steuerliche Entlastung.
Zusätzlich selbst getragene Basis-KV/PV-Beiträge sind abziehbar; ohne Krankengeldanspruch keine 4-%-Kürzung.
Auch KV auf ETF-Erträge kann die Tarifsteuer auf die übrige Rente senken. [§ 10 Abs. 1 Nr. 3, Abs. 4 EStG][sa]

**Messformel je Rentenjahr:** `relief = [tax(incRet + X/I) − tax(max(0, incRet + (X−KV)/I))] × I`,
`X = Σ taxBase[t]`, `KV = gemeinsames KV-Buch`. Entlastung als zusätzliche verfügbare Zahlung desselben Steuerjahres,
ohne Wiederanlage. Voraussetzung: `incRet` ist das sonstige zvE **vor den zusätzlichen** produktbedingten Beiträgen;
allgemeine Beiträge auf die bestehende Rente sind darin bereits berücksichtigt.

DK: ETF-Vorsprung sinkt auf **578 €**, High auf **18.524 €**. Aktiver Fonds: +1.654 / +5.209 € in DK / High.
**Vorschlag:** Gemeinsamen Abzug nach Ermittlung der tatsächlichen Beiträge rechnen; Erstattungszeitpunkt und
Wiederanlage ausdrücklich festlegen.

### R2 – Steuerzahlung aus dem Depot ist ein Verkauf

`combo.ts:393`: Steuer vom Vermögen abgezogen, Basis anteilig vermindert. Der dabei realisierte Gewinn wird weder
versteuert noch verbeitragt. Ohne externes Geld muss ein thesaurierender Fonds dafür Anteile verkaufen.
[§ 19 Abs. 1 InvStG][verkauf], [§ 20 Abs. 4 EStG][kapital]

**Messung:** Durchschnittsverfahren beibehalten; zuerst angesetzte VP zur Basis addiert, dann
`q = max(0, (V−B)/V)`, Bruttoverkauf `S = VP-Steuer / (1−0,26375×tf×q)`.
Basis danach `B×(1−S/V)`, Vermögen `V−S`; im Alter zusätzlich `tf×q×S` ins KV-Buch.
Bei positiver VP-Steuer ist der Pauschbetrag bereits ausgeschöpft. FIFO bleibt unverändert.
ETF-Überzeichnung **0,8 % / 1,2 % / 1,1 %**. Aktiver Fonds: −382 / −538 / −1.315 €.
**Vorschlag:** Steuerverkäufe mit gemeinsamer Freibetrags-, Verlust- und KV-Abrechnung explizit erfassen.

### R3 – Günstigerprüfung für Kapitalerträge

`combo.ts:366`, `:374`, `:393`, `:417`: stets 26,375 %. Auf Antrag gilt jedoch der günstigere Tarif für
**sämtliche** Kapitalerträge. Das ist eine andere Prüfung als die vorhandene AVD-Günstigerprüfung. [§ 32d Abs. 6][gp]

**Messung:** Im Rentenjahr gesamte modellierte Abgeltungsteuer mit `taxAdd(incRet + X/I, steuerpflichtige
Kapitalerträge, t)` verglichen, Differenz als verfügbare Erstattung ohne Wiederanlage. Default/DK:
ETF +736 €, aktiver Fonds +342 €, Folge-ETF der Versicherung +295 €. Bei **5.000 € Alterseinkommen** stattdessen
ETF +18.174 € (Default/DK) bzw. +39.226 € (High). In Ausbildungsjahren kann zusätzlich die Ansparphase betroffen sein.
**Vorschlag:** Gemeinsame jährliche Prüfung nach Sonderausgaben und Pauschbetrag, auch beim Ansparen und im Erbfall.

### R4 – Vorabpauschale: Zufluss im Folgejahr

`combo.ts:385` bis `:396`: Berechnung, Steuer, Basisanrechnung und KV im Entstehungsjahr.
Gesetzlich erst am ersten Werktag des Folgejahres; betrifft gemeinsamen Pauschbetrag und KV-Übergang. [§ 18 Abs. 3][vp]
**Messung:** Vorjahres-VP vor der Entnahme zu Beginn des Folgejahres abrechnen, dort Pauschbetrag, Basis und KV
berücksichtigen; Entnahme nach Steuerabzug neu bestimmen. Sonst unverändert, noch ohne R2.
Aktiver Fonds: −192 / −527 / −922 €. **Vorschlag:** Offenen VP-Posten über den Jahreswechsel führen.
Eine überschlägige KV-Zahl des ersten Rentenjahres ersetzt keine Messung über den ganzen Lebenslauf.

### R5 – Tarifbasis ist keine KV-Basis

`combo.ts:189`: `KV_BBG − incRet`. Steuer benötigt sonstiges zvE, KV beitragspflichtige Bruttoeinnahmen;
Rentenfreibetrag und Sonderausgaben unterscheiden beide Größen. [§ 240 Abs. 1–2][kv], [BVSz § 3 Abs. 1][bvsz]
Bei Bruttoeinnahmen 20 % über dem zvE ist die BBG früher erreicht: High-AVD +18.319 €, Versicherung +18.990 €;
Default/DK ohne Effekt, deren BBG bindet nicht. **Keine Schätzung des tatsächlichen Bruttoeinkommens.**
**Vorschlag:** Eigenes Feld für bereits beitragspflichtige Alterseinnahmen. Bei korrektem zvE wird sonst KV
überschätzt, bei Bruttoeingabe gegebenenfalls Steuer. Der Glossarhinweis „Renteninformation × 12“ löst das nicht.

### R6–R8 – Weitere abgrenzbare Fehler

| ID / Fundstelle | Quelle und Vorschlag | Wirkung / Richtung |
|---|---|---|
| R6 `combo.ts:248` | 120-€-Mindestbeitrag nach § 86 n. F. betrifft Zulagen, nicht generell § 10a. Prüfungen trennen; [Art. 2 Nr. 1 und 9][avrg2]. | Hauptfälle 0. Bei 9 €/Monat fehlt die oben bezifferte Erstattung; benachteiligt kleine AVD-Beiträge. |
| R7 `combo.ts:282`, `:361` | Hälftiger Versicherungsgewinn fällt auch unter § 20 Abs. 9; [§ 32d Abs. 2 Nr. 2][gp] schließt § 20 Abs. 6 aus, nicht Abs. 9. Pauschbetrag mit Fonds teilen. | Messung: erst tarifbesteuerte Versicherung, dann Fonds. Kleiner Vorteil, weil zugleich Fondsfreibetrag entfällt. E11 vor 12 Jahren schon dokumentiert. |
| R8 `core.ts:17` | [§ 32a Abs. 1 S. 6][tarif]: Steuerbetrag abrunden. | Wenige Euro cumH; Richtung wechselnd, kein Siegerwechsel. |

## Systematische Modellannahmen

**V1 – Entnahmeprofil.** `combo.ts:349` zahlt aus Fonds nominal konstante vorschüssige Annuität,
`:224` aus AVD Restkapital / Restjahre. Annuitätenformel korrekt. Summe realer Zahlungen (`analyze.ts:106`,
`combo.ts:626`) zählt spätere reale Euro gleich hoch: zulässige Zielgröße, aber kein neutraler Vergleich
unterschiedlicher Entnahmeentscheidungen. [AltZertG n. F. § 1 Abs. 1 Nr. 4 b][avrg6] erlaubt mindestens 80 % des
Quotienten, Neufestlegung spätestens alle drei Jahre; gerechnet jährlich 100 %.
**Messung:** Alle offenen Depots ebenfalls Rest / Restlaufzeit. Default-AVD-Vorsprung sinkt um 2.981 €,
ETF-Vorsprung wächst DK um 2.029 €, High um 4.894 €.
**Vorschlag:** Profile vereinheitlichen oder deren Einfluss auf die Rangfolge ausdrücklich ausweisen.

**V2 – Förderverzug.** `combo.ts:255`, `:337`, `:402`: Zulage und Erstattung schon am Beitragsjahresende.
Antragsübermittlung quartalsweise nach [§ 89 n. F., Art. 2 Nr. 10][avrg2]; Gutschrift/Steuerbescheid liegen später.
**Messung:** Beide Zahlungen exakt ein Jahr verschoben, letzte Zahlung am Ende des ersten Rentenjahres berücksichtigt.
AVD verliert **1,5 % / 1,6 % / 0,8 %**. **Vorschlag:** Verzögerung modellieren. Ein Jahr ist ein Szenario,
kein gesetzlicher Auszahlungstermin; AVD-Verwaltungspraxis und individueller Steuerbescheid bleiben offen.

**V3 – Nominaler Pauschbetrag.** `combo.ts:361`, `:389`, `:417`: 1.000 € fest, Tarif/BBG dagegen indexiert
(`:187`, `:189`). [§ 20 Abs. 9][kapital] bestimmt einen nominalen Betrag: **kein Rechtsfehler**.
Messung indexiert nur den jährlichen Pauschbetrag in der Fondsrechnung mit `I(t)`, sonst gleicher Tarif.
Aktiver Fonds +6.000 / +5.750 / +6.426 €. **Vorschlag:** Asymmetrische Fortschreibung als Sensitivität offenlegen,
zukünftige Gesetzesänderungen nicht vorwegnehmen.

**Kosten, Beitragssätze, Renditerisiko.** `combo.ts:241`, `:271`, `:346`, `:190`: konstante Kosten und Sätze.
Standarddepot-Kostendeckel nach [§ 2a Abs. 1–2 n. F.][avrg6] bezieht sich auf Effektivkosten bis Rentenbeginn,
garantiert nicht dieselben Kosten im Alter. Folgendes sind **Annahmesensitivitäten**, keine nachgewiesenen fehlenden Kosten:

| Änderung | Default | DK | High | Siegerwechsel |
|---|---|---|---|---|
| AVD-Kosten 1,0 statt 0,5 % | A −28.128 | A −19.917 | A −36.353 | **Default: ETF statt AVD** |
| Versicherung 1,5 statt 0,9 % | V −18.450 | V −13.769 | V −34.385 | nein |
| KV/PV +3 Prozentpunkte | 0 | E −2.297 / A −6.663 / V −4.288 | E −5.076 / A −13.472 / V −8.386 | nein |
| Beide Renditen −2 Prozentpunkte | E −75.632 / A −93.664 / V −62.275 | E −64.139 / A −67.954 / V −47.707 | E −132.392 / A −127.845 / V −113.093 | nein |

Ohne Verlustpfade bleibt das Risiko unzureichenden Ruhestandseinkommens unbeziffert; daraus folgt keine verlässliche
Richtung für den Produktvergleich. Gleichmäßige Abschlusskosten können frühe Rückkaufs-/Todesfallwerte überzeichnen.
Rentenfaktor/Überschüsse sind vertragsspezifisch. **Vorschlag:** Anspar-/Auszahlkosten trennen, Bandbreiten zeigen.

**Klein, Bezugsgröße des Ausgabeaufschlags:** `combo.ts:382` verwendet `c×(1−aa)`. Falls die eingegebenen 5 %
stattdessen ein Aufschlag auf den Nettoanteilswert sind, wäre `c/(1+aa)` richtig: aktiver Fonds
**+202 / +176 / +445 €**, kein Siegerwechsel. Kein allgemeiner Rechtsfehler: Bezugsgröße am konkreten Fondsprospekt
prüfen und Eingabe entsprechend beschriften. Ein konkreter Prospekt liegt dieser Rechnung nicht zugrunde.

## Zusammenwirken und Sieger

**R1 + R2 + R3 + R4 gemeinsam**, unveränderte Profile; keine hypothetische Indexierung und kein R5-Bruttoaufschlag.
Erstattungen als gleichjährige verfügbare Zahlungen. Die kleine Versicherungs-Pauschbetragskorrektur R7 bleibt
hier außen vor. Günstigerprüfung nach KV-Sonderausgaben, Steuerverkäufe im VP-Zuflussjahr:

| Fall | ETF | AVD | Versicherung | Erster vor Zweitem |
|---|---:|---:|---:|---|
| Default | 153.293 | 174.879 | 127.522 | AVD +21.585 |
| DK | 140.716 | 140.923 | 105.129 | **AVD +207; Sieger gewechselt** |
| High | 330.966 | 316.131 | 264.219 | ETF +14.835 |
| Default, zusätzlich V2 | 153.293 | 172.181 | 127.522 | AVD +18.888 |
| DK, zusätzlich V2 | 140.716 | 138.678 | 105.129 | **ETF +2.038** |
| High, zusätzlich V2 | 330.966 | 313.553 | 264.219 | ETF +17.413 |

**DK liegt nahe am Gleichstand.** Der heutige Abstand ist keine belastbare Produktüberlegenheit.
Diese Prüfrechnung ist keine freigegebene Ersatzengine.

### Frühere Wirkungstests mit 21,7 % KV/PV

Default bleibt ohne KV identisch. Wieder Tripel E / A / V, sonst unveränderte Fälle:

| Lauf / isolierte Wirkung | DK | High |
|---|---|---|
| Ausgangs-cumH | 137.117 / 126.695 / 96.304 | 322.079 / 278.945 / 243.348 |
| R1 | +4.089 / +13.311 / +7.923 | +12.151 / +35.716 / +20.385 |
| R2 | −1.599 / −31 / −182 | −3.619 / −210 / −360 |
| R3 | +736 / 0 / +295 | 0 / 0 / 0 |
| R4 | −681 / −68 / −58 | −1.212 / −337 / −567 |
| R5, Brutto +20 % | 0 / 0 / 0 | 0 / +18.840 / +19.530 |
| V1 | +2.361 / +359 / +1.283 | +5.340 / +512 / +3.637 |
| V2 | 0 / −2.047 / 0 | 0 / −2.332 / 0 |
| V3 | +7.583 / +183 / +3.771 | +7.187 / +1.877 / +3.727 |
| R1–R4 gemeinsam: Ergebnis | 140.357 / 139.952 / 104.490 | 330.249 / 314.400 / 263.082 |

Bei 21,7 % bleibt in den isolierten und im kombinierten Lauf der ETF vorne (kombiniert DK +405 €).

## Erbfall und schon dokumentierte Punkte

**H1 – `latentTax`** (`combo.ts:445`, `:461`, `:565`, `:577`): bekannt grob, **cumH-Wirkung überall 0 €**.
Nutzt `incRet` der verstorbenen Person. Nur durch Austausch gegen `incHeir`, sonst gleiche Schätzung, ändert sich der
AVD-Ehepartner-Erbwert bei Tod mit 50 um **−5.446 / −5.446 / +1.361 €**, mit 80 um **−5.949 / −5.949 / +1.665 €**.
Heutige Kaufkraft. Sensitivität: künftiges Einkommen, Alter und Auszahlprofil des Ehepartners fehlen. Die spätere
Steuer trifft diesen; [BMF Rn. 155, 232 ff.][bmf]. **Vorschlag:** Separater Hinterbliebenen-Auszahlplan.
Keine einseitige Behauptung, `latentTax` sei immer zu niedrig: künftige Steuern auf weiterwachsendes Vermögen sind
nicht direkt mit einer heutigen Kapitalsteuer vergleichbar.

**H2 – Restbasis/Förderkonto** (`combo.ts:470`, `:581`): `V/C0` skaliert Beiträge, Zulagen und Erstattungen mit der
späteren Rendite. Verbrauchte Beitragsbasis wächst dadurch wieder an. Mit separatem, nur durch Entnahmen sinkendem
Basis-/Förderkonto (hier Restjahre / Gesamtjahre) ändert sich der AVD-Erbwert bei Tod mit 80 um
**−1.264 / −1.264 / +213 €**; cumH jeweils **0 €**. Beitragszuordnung: [§ 22 Nr. 5 S. 2 c/S. 3][rente],
Förderrückzahlung: [§ 93 Abs. 1][tod]. **Offen:** Zuordnung verbleibender Förderung nach bereits unschädlich ausgezahlten
AVD-Raten mit ZfA/BMF klären. Prüfalternative ist keine behauptete Verwaltungsformel.
**Vorschlag:** Basis-/Förderkonto getrennt vom Marktwert fortschreiben und Zuordnung bestätigen lassen.

Weitere Punkte kurz zu [Abweichungen](abweichungen-vom-original.md) und [Kombi § 6–7](kombi-modus.md):

- **E4:** offener Soli-Punkt. Dortige Formel mit aktuellem ALL_FIXES: **0 / 0 / −3.552 € AVD**;
  High mit 21,7 % −3.541 €. Kein Siegerwechsel mehr, High bereits ETF; alte Wechsel-Angabe gilt nicht mit E10.
  [§ 3 Abs. 2 SolZG][soli3]
- **E9:** AVD-KV weiter offen. Nur ungeförderten Gewinn statt ganzer ungeförderter Rate verbeitragen:
  **0 / 0 / +12.784 € AVD**, kein Siegerwechsel. 30-%-Auszahlung mit 1/120 gemeinsam deckeln/verteilen statt separat
  sofort belasten, bei eingeschaltetem `einmal`: **0 / +963 / +1.946 € AVD**; Hauptfälle ohne `einmal` 0.
  Separater Topf kann zu viel Beitrag verlangen, ist nicht unter jeder offenen Auslegung konservativ: 1/12 kann früher
  stärker belasten. [BVSz § 5 Abs. 3–4][bvsz] klärt Depotverträge nicht ausdrücklich.
- **E12/E13:** offen lassen. BMF Rn. 149 kennt ungeförderte Weiterzahlungen ohne Förderberechtigung bei bestehenden
  Verträgen, klärt nicht alle Zugangsfragen neuer AVD. Rn. 148 nennt für Fondssparpläne 62/12, keine zusätzliche
  fünfjährige Beitragsdauer. Keine abweichende AVD-Verwaltungsregel belegt; zusätzliche Bedingung nicht erfinden. [BMF][bmf]
- **FIFO/Verluste:** schon dokumentiert. FIFO-Zahl dort **ohne Vorabpauschale** ist keine vollständige App-Messung.
  Hauptfälle ohne Verlustverkäufe: Verlustkorrektur 0 €. FIFO-Näherung begünstigt offene Depots; Stärke hängt auch
  am gemeinsamen Freibetrag. Ordergebühren/Spreads weiterhin nicht gerechnet.
- **Erbfallgrenzen:** eine Person, Verkauf im Todesjahr, kein Splitting, keine eigene KV der Erben/Erbschaftsteuer.
  Restrente ist Summe künftiger Zahlungen, kein sofort liquides Kapital; cumH-Wirkung 0 €. Genauere Beträge benötigen
  Erbeneinkünfte, verbrauchte Freibeträge und Vertragsbedingungen. Dokumentierte Fünftelregelungsfrage nicht neu entschieden.

## Rechtsstand und Zeitachse ohne weiteren wesentlichen Befund

| Prüfung / Fundstelle | Ergebnis und Primärquelle |
|---|---|
| Tarif `core.ts:9`, Soli `:19` | Grenzen 12.348 / 17.799 / 69.878 / 277.825 € und Koeffizienten richtig; Rundung R8. Soli-Freigrenze 20.350 €, Milderung 11,9 %, Maximum 5,5 % richtig. [§ 32a][tarif], [§ 3][soli3], [§ 4 SolZG][soli4]. |
| KV-BBG `core.ts:22` | 69.750 € richtig: [§ 2 Abs. 2 SVBezGrV 2026][bbg] i. V. m. § 223 Abs. 3 SGB V. |
| KV/PV `inputs.ts:59` | 21,1 % für kinderlose Mitglieder ohne Krankengeld auf private Zusatzeinnahmen: [§ 243][erm] 14,0 % + [BMG/BAS 2026][zusatz] 2,9 % + [PBAV § 1][pflege]/[§ 55 SGB XI][kinder] 4,2 %. Kassenindividuellen Beitrag/Elternstatus eingeben; kein Universalsatz für jede Einnahmenart. |
| Basiszins `inputs.ts:60` | 3,20 % richtig; [BMF 13.01.2026][basis]. 2026-VP fließt am 04.01.2027 zu. |
| AVD `combo.ts:237`, `:248` | 1.800 € gefördert, 6.840 € Eigenbeiträge insgesamt; Grundzulage 50 % bis 360 €, dann 25 %, max. 540 €; Kinderzulage max. 300 €/Kind; Bonus 200 € unter 25; Mindestbeitrag 120 €. [AVRG Art. 2][avrg2], [Art. 6][avrg6], BGBl. 2026 I Nr. 156. Start 2027; Günstigerprüfung grundsätzlich richtig, R6/E4 beachten. |
| Versicherung `combo.ts:276`, `:282`; `core.ts:21` | 12 Jahre; Alter 62 durch R≥65 erfüllt. 15 % nur soweit Gewinn aus Investmenterträgen stammt. [§ 20 Abs. 1 Nr. 6 S. 2/9][kapital], 62 aus [§ 52 Abs. 28 S. 7][alter]. Ertragsanteile 65/66 = 18 %, 67 = 17 %, 68 = 16 %, 69/70 = 15 % richtig. [§ 22][rente] |
| Fonds `combo.ts:382`, `:385` | 70 % Basiszins, Erwerbsmonat zählt mit (`13−m`), Wertzuwachsdeckel grundsätzlich richtig für Thesaurierer. Einzahlungsbetrag statt Anteilswert zu Jahresbeginn ist zusätzlich approximativ; anteilsbezogene Rückrechnung des Basisertrags hier <1 € je Produkt, High-ETF rund +1 €. [§ 18 InvStG][vp] |
| Teilfreistellung/KV `combo.ts:318`, `:374`, `:396`, `:488` | 30 % Aktienfonds, sicherer Teil 0 %: [§ 20 InvStG][tf]. [GKV-Katalog S. 15–16][katalog] berücksichtigt Teilfreistellung bei Investmenterträgen; private Rentenversicherung mit Kapitalwahlrecht dagegen ganzer Zahlbetrag. Verweis dort auf BSG 27.01.2010, B 12 KR 28/08 R. [BVSz § 5 Abs. 4][bvsz]: 1/120 ab Folgemonat. Jahresnäherung und fehlende 51-€-Werbungskostenpauschale klein; E9 gesondert offen. |

- `combo.ts:183`, `:222`, `:349`: Beginn bei **t = n**, Entnahmen vorschüssig, Monatsbeiträge vor Monatsrendite.
  Letzte Auszahlung t = H−a0−1, mit Alter H kein Depotrest. Kein zusätzlicher Jahresversatz gefunden.
- `core.ts:31`, `:46`: Stufen n−5/n−2 richtig. Standarddepot meint Risikoklassen, nicht zwingend Aktien-/Anleihequote.
  Engine nähert über zwei Renditen an; Rückkehr zu `gPay` im Alter ist eigene Annahme. [Art. 6][avrg6]
- `combo.ts:361`, `:389`, `:520`, `:597`: gemeinsamer Fonds-Pauschbetrag, ein Tarif der Erben, gemeinsames laufendes
  KV-Buch grundsätzlich richtig; Ausnahmen R2–R4/R7/E9. Basisreduktion normaler Entnahmen und volle VP-Anrechnung
  im Durchschnittsmodell konsistent. Einzelprodukte tatsächlich über `single()` (`analyze.ts:80`).
- Nominal-/Realumrechnung und Ranking mit `cumHReal` konsistent. Jahresauszahlungen statt monatlicher Zahlungen
  sind eine offengelegte Zeitnäherung, keine exakt monatlich modellierte Rente.

**Prüfgrenzen:** Start heute statt 01.01.2027 ist in `Settings.svelte:187` offengelegt; die Engine hat keine
Kalenderdatums-/Teiljahrsrechnung. Hauptfälle sind volle Modelljahre, keine taggenaue Planung ab November 2026.
AVD-Auslegung durch Krankenkassen nicht ersetzt. BSG-Altfall über amtlichen GKV-Katalog/BVSz,
nicht über einen abrufbaren Urteilsvolltext auf bsg.bund.de verifiziert. Keine e2e-Läufe/Screenshots.

**Abschlussprüfung:** Probedateien entfernt; `npx vitest run`: **11 Dateien, 221 Tests grün** (04.11.2026).
Nur dieser Bericht wird committed.

[sa]: https://www.gesetze-im-internet.de/estg/__10.html
[verkauf]: https://www.gesetze-im-internet.de/invstg_2018/__19.html
[kapital]: https://www.gesetze-im-internet.de/estg/__20.html
[gp]: https://www.gesetze-im-internet.juris.de/estg/__32d.html
[vp]: https://www.gesetze-im-internet.de/invstg_2018/__18.html
[kv]: https://www.gesetze-im-internet.de/sgb_5/__240.html
[bvsz]: https://www.gkv-spitzenverband.de/media/dokumente/krankenversicherung_1/grundprinzipien_1/finanzierung/beitragsbemessung/2025-01-01_Einheitliche_Grundsaetze_zur_Beitragsbemessung_freiwilliger_Mitglieder_Stand_01_01_2025.pdf
[avrg2]: https://www.buzer.de/gesetz/17547/a339399.htm
[avrg6]: https://www.buzer.de/gesetz/17547/a339403.htm
[tarif]: https://www.gesetze-im-internet.de/estg/__32a.html
[rente]: https://www.gesetze-im-internet.de/estg/__22.html
[tod]: https://www.gesetze-im-internet.de/estg/__93.html
[bmf]: https://www.bundesfinanzministerium.de/Content/DE/Standardartikel/Themen/Steuern/Steuerliche_Themengebiete/Rentenbesteuerung/2023-10-05-stl-foerderung-private-altersvorsorge.pdf?__blob=publicationFile&v=3
[soli3]: https://www.gesetze-im-internet.de/solzg_1995/__3.html
[soli4]: https://www.gesetze-im-internet.de/solzg_1995/__4.html
[bbg]: https://www.gesetze-im-internet.de/svbezgrv_2026/__2.html
[erm]: https://www.gesetze-im-internet.de/sgb_5/__243.html
[zusatz]: https://www.bundesamtsozialesicherung.de/de/service/newsroom/detail/gkv-schaetzerkreis-schaetzt-die-finanziellen-rahmenbedingungen-der-gesetzlichen-krankenversicherung-fuer-die-jahre-2025-und-2026/
[pflege]: https://www.gesetze-im-internet.de/pbav_2025/__1.html
[kinder]: https://www.gesetze-im-internet.de/sgb_11/__55.html
[basis]: https://www.bundesfinanzministerium.de/Content/DE/Downloads/BMF_Schreiben/Steuerarten/Investmentsteuer/2026-01-13-basiszins-berechnung-vorabpauschale.pdf?__blob=publicationFile&v=4
[alter]: https://www.gesetze-im-internet.de/estg/__52.html
[tf]: https://www.gesetze-im-internet.de/invstg_2018/__20.html
[katalog]: https://www.gkv-spitzenverband.de/media/dokumente/krankenversicherung_1/grundprinzipien_1/finanzierung/beitragsbemessung/2026-05-26_Katalog_Einnahmen_beitragsrechtliche_Bewertung_240_SGB_V_BF.pdf
