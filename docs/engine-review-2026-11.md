# Engine-Review November 2026

Stand: `main` nach Commit a05faf3, geprüft am 04.11.2026. Nur Prüfung, an der Rechnung ist nichts geändert.

**Fälle** wie in `docs/abweichungen-vom-original.md`, aber mit dem aktuellen Standard `kvRate` 21,1 %:

- **Default:** Standardwerte
- **DK:** Default mit `kvOn`
- **High:** a0 30, zvE 110.000 €, Rente 45.000 €, 500 €/Monat, `kvOn`

Alle Beträge sind cumH (Summe netto bis H) in heutiger Kaufkraft.

**Ausgangswerte:**

| Fall | ETF | AVD | Versicherung | vorne |
|---|---|---|---|---|
| Default | 153.730 € | 174.891 € | 127.324 € | AVD (+21.161 €) |
| DK | 137.576 € | 128.027 € | 97.162 € | ETF (+9.549 €) |
| High | 323.094 € | 281.639 € | 245.025 € | ETF (+41.455 €) |

**Messung:** Für jede Messung lief eine Kopie von `combo.ts` mit Schaltern. Ausgeschaltet war sie mit `analyze()` auf den Euro gleich. Die Probedateien sind wieder gelöscht, `npx vitest run` ist grün (221 Tests).

## Befunde nach Schweregrad

| # | Befund | Schwere | Richtung | Wirkung Default / DK / High | Sieger ändert sich? |
|---|---|---|---|---|---|
| R1 | KV/PV-Beiträge im Alter mindern die Einkommensteuer nicht (Sonderausgaben fehlen) | **falsch** | benachteiligt alle Produkte mit KV, am stärksten AVD und Versicherung | 0 / ETF +3.976, AVD +12.947, Vers. +7.714 / ETF +11.817, AVD +34.748, Vers. +19.836 | nein, aber DK: ETF-Vorsprung 9.549 € → 578 € (0,4 %); High: 41.455 € → 18.524 € |
| R2 | Auszahlprofil: ETF-Entnahme nominal gleichbleibend, AVD steigend; cumH zinst real mit 0 % ab | Verzerrung ≥ 0,5 % | begünstigt das AVD | ETF −3.465 (−2,3 %), Vers. −2.389 / ETF −2.392, Vers. −1.313 / ETF −5.413, Vers. −3.695 | nein |
| R3 | Zulage und Steuererstattung zum Jahresende gutgeschrieben, in Wirklichkeit später | Verzerrung ≥ 0,5 % | begünstigt das AVD | AVD −2.695 (−1,5 %) / −2.060 / −2.338 bei 1 Jahr Verzug | nein |
| R4 | Sparer-Pauschbetrag nominal fest, Tarif mit Inflation fortgeschrieben | Annahme, Verzerrung ≥ 0,5 % möglich | begünstigt AVD und Versicherung, falls der Pauschbetrag künftig steigt | wäre er indexiert: ETF +8.041 (+5,2 %) / +7.596 / +7.199 | nein |
| R5 | KV-Satz für 40 Jahre auf dem Stand 2026 | Annahme | begünstigt die Produkte mit viel KV | +3 Pp. (24,1 %): DK ETF −2.297, AVD −6.663; High ETF −5.076, AVD −13.472 | nein |
| R6 | `latentTax` unterschätzt die spätere AVD-Steuer | klein (kein Einfluss auf cumH) | begünstigt das AVD bei `capNet` und `heirMarried` | Default: 47.397 € geschätzt, 56.472 € tatsächlich (−16 %) | – |
| R7 | Kapitalauszahlung der Versicherung immer in einem Jahr | klein, Gestaltungsfrage | benachteiligt die Versicherung | Default: Steuer 12.218 € auf einmal, 10.108 € über 5 Jahre verteilt | nein |
| R8 | Vorabpauschale am Jahresende statt am ersten Werktag des Folgejahres | klein | uneinheitlich | DK, ETF: Vorabpauschale des letzten Ansparjahres fehlt im KV-Buch des Jahres n, ≈ 454 € einmalig | nein |
| – | E4, E9, E11, E12, E13, FIFO, Verluste, Erbfall der Kombi | dokumentiert | | siehe `docs/abweichungen-vom-original.md` | |

**Alle Befunde zusammen.** R1 und R3 zusammen, mit einem Jahr Verzug:

| Fall | ETF | AVD | vorne |
|---|---|---|---|
| Default | 153.730 € | 172.196 € | AVD +18.466 € |
| DK | 141.553 € | 138.724 € | ETF +2.829 € |
| High | 334.911 € | 313.803 € | ETF +21.108 € |

Mit R2 dazu (ETF wie das AVD entnommen):

| Fall | ETF | AVD | Versicherung | vorne |
|---|---|---|---|---|
| Default | 157.195 € | 172.700 € | 129.713 € | AVD +15.505 € |
| DK | 144.208 € | 139.143 € | 106.451 € | ETF +5.065 € |
| High | 341.179 € | 314.377 € | 269.232 € | ETF +26.802 € |

In keinem der drei Fälle wechselt der Sieger. In DK schrumpft der Abstand aber auf wenige Tausend Euro, also unter 4 %. Damit kann bei leicht anderen Annahmen das AVD vorne liegen.

## Rechtsstand und Parameter: geprüft, ohne Befund

| Wert | Code | Quelle | Ergebnis |
|---|---|---|---|
| Tarif 2026 | `core.ts:9-18` | [§ 32a EStG](https://www.gesetze-im-internet.de/estg/__32a.html) | Grenzen und Formeln stimmen. Den Steuerbetrag rundet das Gesetz auf volle Euro ab, der Code nicht (< 1 €/Jahr). |
| Soli-Freigrenze 20.350 € | `core.ts:19` | [§ 3 Abs. 3 SolZG](https://www.gesetze-im-internet.de/solzg_1995/__3.html) | stimmt. Auf die Abgeltungsteuer fällt der Soli auch unterhalb der Freigrenze an (Abs. 3 S. 2). Die 26,375 % sind also richtig. |
| KV-BBG 69.750 € | `core.ts:22` | SV-Rechengrößen 2026 | stimmt |
| `kvRate` 21,1 % | `inputs.ts:59` | § 243 SGB V 14,0 % + Ø-Zusatzbeitrag 2,9 % + PV 4,2 % (kinderlos) | stimmt. Mit Kindern wäre die PV 3,6 % (Satz 20,5 %). |
| Basiszins 3,20 % | `inputs.ts:60` | BMF-Schreiben vom 13.01.2026 ([Otto Schmidt](https://www.otto-schmidt.de/news/steuerrecht/basiszins-zur-berechnung-der-vorabpauschale-gem-18-absatz-4-invstg-basiszins-zum-2-1-2026-2026-01-15.html)) | stimmt |
| Grundzulage 50 % bis 360 €, 25 % bis 1.800 €, Bonus 200 € unter 25 | `combo.ts:249-252` | [BGBl. 2026 I Nr. 156](https://www.recht.bund.de/bgbl/1/2026/156/regelungstext.pdf), Art. 2 Nr. 7 (§ 84 EStG n. F.) | stimmt |
| Kinderzulage 100 % bis 300 € je Kind | `combo.ts:251` | ebd. Nr. 8 (§ 85 Abs. 1 n. F.) | stimmt |
| Mindesteigenbeitrag 120 € | `combo.ts:248` | ebd. Nr. 9 (§ 86 n. F.) | stimmt |
| Günstigerprüfung „1.800 € zuzüglich Zulage“ | `combo.ts:256` | ebd. Nr. 1 (§ 10a Abs. 1 S. 1 n. F.) | stimmt: Abzug `E + zSA` mit E ≤ 1.800 € |
| 6.840 € ohne Zulage und Erträge | `core.ts:24`, `combo.ts:239` | ebd. Art. 6, § 1 Abs. 1 S. 1 Nr. 5 AltZertG n. F. | stimmt |
| Auszahlplan bis mindestens 85, 30 % außerhalb der Monatsleistungen | `combo.ts:222-225` | § 1 Abs. 1 S. 1 Nr. 4 b AltZertG n. F. | stimmt. Gerechnet sind 100 % von Rest ÷ Restlaufzeit, erlaubt sind ≥ 80 %. Das ist in Settings dokumentiert. |
| Standarddepot 50 %/30 % | `core.ts:31-39` | § 1 Abs. 1c Nr. 5 AltZertG n. F. | stimmt. Die Stufen liegen bei t = n−5 und t = n−2. |
| Halbeinkünfte 62/12, Teilfreistellung 15 % (0,85 · 0,5) | `combo.ts:282` | § 20 Abs. 1 Nr. 6 S. 2 und 9 EStG | stimmt |
| Ertragsanteile 60–70 | `core.ts:21` | § 22 Nr. 1 S. 3 a bb EStG | stimmt |
| Vorabpauschale: 70 % Basiszins, Zwölftel-Kürzung, Deckel | `combo.ts:382-385` | § 18 InvStG | stimmt. Zum Zuflusszeitpunkt siehe R8. |
| Teilfreistellung 30 %, KV 70 % | `combo.ts:318, 374, 396` | § 20 InvStG; GKV-Katalog „Investmenterträge“ | stimmt |
| KV auf die Kapitalauszahlung einer privaten Rentenversicherung: ganzer Zahlbetrag, 1/120 | `combo.ts:488-491` | [GKV-Katalog § 240 SGB V, Stand 26.05.2026](https://www.gkv-spitzenverband.de/media/dokumente/krankenversicherung_1/grundprinzipien_1/finanzierung/beitragsbemessung/2026-05-26_Katalog_Einnahmen_beitragsrechtliche_Bewertung_240_SGB_V_BF.pdf), Zeile „Kapitalleistung aus einer privaten Rentenversicherung“ (BSG B 12 KR 28/08 R; § 5 Abs. 4 BVSz) | stimmt. Nur bei der Kapitallebensversicherung zählt der Kapitalertrag; die gibt es hier nicht. |

**Zeitachse und Formeln ohne Befund:**

- Annuität vorschüssig mit dem Zins `gPay − ter`, passend zur monatlichen Verzinsung.
- Ende des Auszahlplans bei t = tEnd − 1 mit Restlaufzeit 1.
- Anschaffungskosten fortgeschrieben: anteilig bei Entnahme und Steuerabzug, Vorabpauschale hinzugerechnet (§ 19 Abs. 1 S. 3 InvStG).
- Gemeinsamer Pauschbetrag (Phase 1 Entnahmen und Umschichtung, Phase 2 Vorabpauschale) und KV-Buch der Kombi.
- `heir`/`heirMarried` gegen § 93 Abs. 1 n. F.: Rückzahlung der Zulagen und der „nach § 10a Abs. 4 gesondert festgestellten Beträge“, also wie `foer`.

## Einzelbefunde

### R1 – KV/PV-Beiträge sind Sonderausgaben (falsch)

- **Was:** Freiwillig Versicherte zahlen im Alter KV/PV auf AVD-Raten, Leibrente, Kapitalauszahlung (1/120) und Fondserträge. Diese Beiträge sind als Basis-Kranken- und Pflegeversicherung voll als Sonderausgaben abziehbar, auch über die Höchstbeträge hinaus. Ohne Krankengeldanspruch entfällt die 4-%-Kürzung, Rentner haben keinen. Die Engine zieht die KV vom Netto ab, mindert aber die Einkommensteuer nicht. Das gilt auch beim ETF: Dessen Erträge fallen unter die Abgeltungsteuer, die KV darauf mindert aber die Tarifsteuer auf die übrige Rente.
- **Fundstelle:** `combo.ts:285-293` (Steuer ohne KV-Abzug), `combo.ts:520-537` (KV-Buch)
- **Quelle:** [§ 10 Abs. 1 Nr. 3 S. 1 a und b, S. 4, Abs. 4 S. 4 EStG](https://www.gesetze-im-internet.de/estg/__10.html)
- **Richtung:** Die KV kostet netto rund (1 − Grenzsteuersatz) so viel wie gerechnet. Das AVD hat die meiste KV und gewinnt am meisten.
- **Wirkung:** siehe Tabelle. DK: ETF +2,9 %, AVD +10,1 %, Versicherung +7,9 %. High: ETF +3,7 %, AVD +12,3 %, Versicherung +8,1 %.
- **Vorschlag:** Neuer Fix, etwa `kvDeductible`:
  - je Rentenjahr eine Entlastung `(tax(incRet + X/I) − tax(max(0, incRet + X/I − kv[t]/I))) · I`, mit `X` der
    einkommensteuerpflichtigen Summe und `kv[t]` aus dem gemeinsamen KV-Buch
  - die Entlastung anteilig nach KV auf die Teile verteilen
  - Einen Zyklus gibt es nicht: Die KV hängt nicht an der Einkommensteuer. Die Entlastung lässt sich deshalb nach dem
    KV-Buch (Abschnitt 6) rechnen.
  - Gemessen ist R1 genau mit dieser Formel.

### R2 – Auszahlprofil und Kennzahl (Verzerrung)

- **Was:** Die Zielgröße cumHReal summiert reale Beträge ohne Abzinsung. Bei positiver Realrendite zählt ein später ausgezahlter Euro deshalb gleich viel, obwohl er länger verzinst wurde.
  - Das AVD zahlt Rest ÷ Restlaufzeit, die Raten steigen nominal mit `gPay − avdCost`. Das Gesetz schreibt dieses Profil vor (≥ 80 %, Nr. 4 b bb).
  - ETF, aktiver Fonds, Nebendepot und das ETF aus der Kapitalauszahlung zahlen eine nominal gleichbleibende Annuität. Real fallen ihre Raten also.
  - Das ETF-Profil ist eine Modellwahl. Ein ETF-Anleger kann genauso entnehmen wie das AVD.
- **Fundstelle:** `combo.ts:349` (`annuityDue`) gegen `combo.ts:224` (`V / (tEnd − t)`). Kennzahl: `combo.ts:626`, `analyze.ts:106`.
- **Richtung:** begünstigt das AVD
- **Wirkung**, wenn die Fondsdepots mit demselben Profil wie das AVD entnehmen:
  - Default: ETF +3.465 € (+2,3 %), Versicherung +2.389 € (+1,9 %), AVD +484 € (über das Nebendepot)
  - DK: ETF +2.392 €
  - High: ETF +5.413 €
- **Vorschlag:** eine der beiden Möglichkeiten:
  - Alle Depots entnehmen wie das AVD (Rest ÷ Restlaufzeit). Das ist am einfachsten und fair, weil dann das Profil gleich ist.
  - Oder der Barwert zur Realrendite wird als zweite Kennzahl gezeigt. Dann hängt die Rangfolge nicht mehr am Profil.

  Hinweis: Damit ändert sich die Ø-Monatsrente des ETF (erst niedriger, dann höher).

### R3 – Zeitpunkt von Zulage und Erstattung (Verzerrung)

- **Was:** Die Engine schreibt die Zulage am Ende des Beitragsjahres gut. Die Erstattung aus der Günstigerprüfung landet zum selben Zeitpunkt im Nebendepot. In Wirklichkeit:
  - Die Zulage wird erst nach Ablauf des Beitragsjahres beantragt. Der Anbieter übermittelt die Anträge quartalsweise, die zentrale Stelle zahlt danach aus (§ 89 Abs. 2 S. 2 n. F., § 90 EStG).
  - Die Erstattung kommt mit dem Steuerbescheid, also im Folgejahr oder später.

  Die Oberfläche nennt das („in echt 1–2 Jahre später“, `Settings.svelte:186`), beziffert ist es bisher nicht.
- **Fundstelle:** `combo.ts:255` (`V += z`), `combo.ts:337` (`refunds` als `lumpEnd[t]`)
- **Wirkung** bei 1 Jahr Verzug für beides:
  - AVD −2.695 € (−1,5 %) Default, −2.060 € DK, −2.338 € High
  - Bei realistisch 0,5 bis 1,5 Jahren etwa −1.300 € bis −4.000 €.
- **Vorschlag:** Als Fix umsetzen: Zulage und Erstattung ein Jahr später gutschreiben. Das letzte Ansparjahr landet dann zu Beginn der Auszahlphase im Vertrag bzw. im Nebendepot. Rechtlich unklar ist nur die genaue Dauer: Für das AVD gibt es noch keine Verwaltungspraxis. 1 Jahr ist eine plausible, eher vorsichtige Annahme.

### R4 – Pauschbetrag nominal, Tarif indexiert (Annahme)

- **Was:** Die Tarifgrenzen wachsen mit der Inflation (`taxAdd` rechnet mit dem realen Einkommen), der Pauschbetrag bleibt bei 1.000 €. Real sinkt er bis 67 auf etwa 410 €. Bisher dokumentiert als „bewusst übernommen“, die Wirkung war nicht beziffert.
- **Fundstelle:** `combo.ts:361, 389, 417, 420`
- **Quelle:** [§ 20 Abs. 9 EStG](https://www.gesetze-im-internet.de/estg/__20.html). Der Betrag ist gesetzlich nominal; seit 1993 wurde er meist gesenkt, nur 2023 erhöht.
- **Wirkung**, wäre er mit der Inflation indexiert: ETF +8.041 € (+5,2 %), Versicherung +3.903 € (über das Folge-ETF), AVD +203 € (Default). DK und High ähnlich.
- **Bewertung:** Nominal fest ist die gesetzeskonforme und historisch eher großzügige Annahme. Keine Korrektur nötig. Die Spanne gehört aber in die Doku (bei den „bewusst übernommenen Vereinfachungen“), denn sie ist größer als jeder andere Steuerparameter des ETF.

### R5 – KV-Satz konstant (Annahme)

- **Was:** `kvRate` gilt für 40 bis 70 Jahre auf dem Stand 2026. Zusatzbeitrag und PV-Satz sind zuletzt stark gestiegen.
- **Wirkung** bei +3 Prozentpunkten:
  - DK: ETF −2.297 €, AVD −6.663 €, Versicherung −4.288 €
  - High: ETF −5.076 €, AVD −13.472 €

  Das wirkt etwa halb so stark wie R1, in die Gegenrichtung.
- **Vorschlag:** Eine Szenario-Zeile „KV-Satz +3 Prozentpunkte“ bei `kvOn`. Keine Änderung des Standardwerts.

### R6 – `latentTax` (klein, ohne Einfluss auf die Rangfolge)

- **Was:** Die Schätzung verteilt das Kapital gleichmäßig auf die Restjahre, ohne Wachstum, mit dem Tarif des Bewertungsjahres. Die echten Raten steigen aber, die Progression wird also unterschätzt.
- **Fundstelle:** `combo.ts:445, 565`
- **Wirkung (Default):** latentTax(n) = 47.397 € real, die gerechnete Steuer der Rentenphase beträgt 56.472 € real (Summe ohne Abzinsung). Betroffen sind nur `capNet` des AVD (Anzeige) und `heirMarried`, nicht cumH.
- **Vorschlag:** `latentTax` aus dem Auszahlplan selbst rechnen: dieselbe Schleife wie in Abschnitt 1 ab idx, mit `taxAdd` je Jahr.

### R7 – Kapitalauszahlung in einem Jahr (klein)

- **Was:** Die halbe Kapitalauszahlung der Versicherung kommt vollständig in den Tarif des Jahres n. Manche Tarife erlauben Teilauszahlungen über mehrere Jahre. Die hälftige Besteuerung bleibt dabei.
- **Wirkung (Default):** Steuer 12.218 € real auf einmal, 10.108 € über 5 Jahre verteilt. Das sind etwa +2.100 € (+1,7 %) für die Versicherung, High etwa +6.300 €.
- **Bewertung:** eine Frage des Vertrags, kein Rechenfehler. Allenfalls im Glossar nennen.

### R8 – Zuflusszeitpunkt der Vorabpauschale (klein)

- **Was:** Die Vorabpauschale gilt am ersten Werktag des Folgejahres als zugeflossen (§ 18 Abs. 3 InvStG). Die Engine versteuert sie im selben Jahr und mit dessen Pauschbetrag. Die des letzten Ansparjahres fehlt deshalb im KV-Buch des ersten Rentenjahres.
- **Fundstelle:** `combo.ts:385-396`
- **Wirkung:** DK, ETF ≈ 454 € einmalig. Die Verschiebung beim Pauschbetrag ist vernachlässigbar.
- **Vorschlag:** keine Änderung, höchstens ein Satz in der Doku.

## Offene Punkte (rechtlich unklar)

- **Dauer bis zur Zulagengutschrift beim AVD (R3):** Für das AVD gibt es noch keine Verwaltungspraxis.
- **E9:** KV auf AVD-Auszahlungen: 1/120 oder 1/12, ganze Rate oder nur der Ertrag. Der GKV-Katalog nennt nur die „Riester-Rentenversicherung“ (1/120), keinen Depotvertrag. Zählte nur der Gewinnanteil, gewänne das AVD im High-Fall gut 40.000 € (dokumentiert). Mit R1 würde das ETF in DK das AVD wahrscheinlich nicht mehr schlagen.
- **E4, E12, E13:** weiter offen, siehe `docs/abweichungen-vom-original.md`.
- Nicht gerechnet und in Settings offengelegt: Kirchensteuer, Ehegattensplitting, Altersentlastungsbetrag. Letzterer wirkt nur bei einem Rentenbeginn vor 2058, also bei heute über 33-Jährigen.

## Empfehlung zur Reihenfolge

1. **R1** als Fix umsetzen. Das ist ein echter Rechtsfehler und die größte Wirkung (bis 12 % beim AVD).
2. **R3** als Fix, R2 entscheiden (gleiches Profil oder Barwert).
3. R4 und R5 als Sensitivität dokumentieren bzw. als Szenario-Zeile.
4. R6 bei Gelegenheit.
