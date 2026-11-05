# Korrekturen an der ersten Fassung

Der Rechner ist aus einer ersten Fassung in einer einzigen HTML-Datei entstanden (`legacy/index.html`, im Text auch „Original“). Sie bleibt unverändert als Referenz für die Golden-Tests. Diese Datei beschreibt jede Stelle, an der die heutige Rechnung bewusst davon abweicht, mit Rechtsquelle und Wirkung.

`src/lib/engine/engine.ts` (`model()`) ist ein 1:1-Port von `legacy/index.html`. Die sieben historischen Korrekturen E1–E10 sind dort ebenfalls enthalten.
Jede hängt an einem eigenen Schalter (`src/lib/engine/fixes.ts`). Die App rechnet seit dem Umbau „eine Engine“ mit
`combo.ts`: Ein Einzelprodukt ist eine Kombi mit nur diesem Teil (`single()` in `analyze.ts`). `combo.ts` enthält jede
Korrektur schaltbar. Mit ausschließlich den historischen E-Fixes ist sie mit einem Teil bitgenau gleich `model()`, inklusive
Erbfall und Hinweistexten (I1, `tests/combo.test.ts`). `engine.ts` bleibt als Referenz; die Abschnitte „Code“ unten
nennen die Stelle in `engine.ts`, in `combo.ts` steht sie im gleichnamigen Block.

Die neuen R-Fixes werden nur in `combo.ts` umgesetzt; `engine.ts` bleibt unverändert. Zahlen in den historischen
E-Abschnitten gelten vor den R-Korrekturen; aktuelle Werte stehen im neuen Abschnitt am Ende.

```ts
model(p, { fixes })    analyze(p, { fixes })    scenarios(p, { fixes })
// fixes weggelassen ⇒ ALL_FIXES (Standard in der App); NO_FIXES ⇒ exakt das Original
```

- **Golden-Test** (`tests/golden.test.ts`): Die Engine läuft mit `NO_FIXES` und muss auf den Cent mit der
  unveränderten `legacy/index.html` übereinstimmen (29 benannte und 300 Zufallsszenarien). Neu sind nur die
  Schlüssel `params.incHeir` und `stats.*.cumHReal`. Andere neue Schlüssel lässt der Test nicht zu.
- **Fix-Tests** (`tests/fixes.test.ts`): Jeder Fix wird für sich gegen das Original gemessen
  (`NO_FIXES ∪ {f}` gegen `NO_FIXES`), mit den Zahlen aus der Engine-Prüfung (Wave 1). Dazu kommen Eigenschaften
  über 200 Zufallsszenarien, alle 64 Teilmengen der Fixes und Snapshots der Standardwerte.
- Die Fälle in diesem Dokument:
  - **Default**: Standardwerte, d. h. 22 Jahre, zvE 38.000 €, Rente 20.000 €, 150 €/Monat, Kaufkraft.
  - **DK**: Default mit „freiwillig gesetzlich versichert“ (`kvOn`).
  - **High**: 30 Jahre, zvE 110.000 €, Rente 45.000 €, 500 €/Monat, `kvOn`.
  - In den Wirkungstests wird mit `kvRate` 21,7 gerechnet, dem Standard zur Zeit der Prüfung. „cumH“ ist die
    Summe der Netto-Auszahlungen bis zum Alter H, in heutiger Kaufkraft.

**Wichtig:** Neue Rechnung nur noch in `combo.ts`. Ist sie abgeschaltet (Referenzpfad), muss `combo.ts` bitgleich zu
`model()` bleiben (I1, Golden-Test über `analyze()`).

---

## E1 – `rankReal`: Rangfolge immer in heutiger Kaufkraft

**Problem.** Das Original bestimmt den Sieger (`lead`) und den fairen Vergleich (`fairOwn`) in der
Anzeige-Einheit. Eine Summe nominaler Beträge zinst mit 0 % ab, eine reale Summe mit der Inflation. Der
AVD-Auszahlplan steigt nominal an, die ETF-Entnahme bleibt nominal gleich. Deshalb hat der Anzeige-Schalter
„Heutige Kaufkraft“ in 148 von 4.096 Rasterfällen den Sieger gewechselt, und in 214 von 5.119 Szenario-Zeilen
ebenfalls. Das Muster war immer gleich: real liegt der ETF vorne, nominal das AVD.

**Quelle.** Das ist ein Logikfehler und keine Rechtsfrage. Ökonomisch ist eine Abzinsung mit 0 % nicht
vertretbar.

**Formel.**

| | Original | mit Fix |
|---|---|---|
| Rangfolge | `stats[k].cumH` (Anzeige-Einheit) | `stats[k].cumHReal = Σ_{t=n}^{tH−1} net[t] / I(t)` |
| Fairness | `ownOf(pr)` (`own` oder `ownReal`, je nach Anzeige) | immer `ownReal` |

Die Anzeige (`cumH`, `avgMonthly`, `cum100`, `R`, `ownOf`) bleibt unverändert. `cumHReal` wird immer berechnet.
Bei `p.real` ist es identisch mit `cumH`.

**Code.** `analyze.ts`, Funktion `analyze` (`rankBy`, `owns`).

**Wirkung.** Beispiel: a0 22, zvE 25.000, Rente 35.000, Rendite 6 %, nominal. Im Original liegt das AVD vorne
(473.827 € gegen 460.552 € nominal). Mit Fix liegt der ETF vorne (real 153.730 € gegen 153.275 €). Default, DK
und High ändern sich nicht.

**Hinweis für die Oberfläche.** Im Nominalmodus kann das vorne liegende Produkt die kleinere nominale Summe
zeigen. Den Abstand (Δ) und den Zweitplatzierten daher immer über `cumHReal` bestimmen (`verdict.ts`).

**Tests.**
- `rankReal (E1): a0 22, zvE 25.000, …`
- `mit ALL_FIXES: Rangfolge und Fairness unabhängig von der Anzeige real/nominal (auch je Szenario)`
- `cumHReal = cumH in heutiger Kaufkraft …`

---

## E2 – `heirTax`: AVD-Erbfall wird von den Erben versteuert

**Problem.** Das Original versteuert die Erträge bei schädlicher Verwendung im Todesfall mit dem Einkommen der
**verstorbenen** Person. Die Hälfte nimmt es an, wenn die **verstorbene** Person mindestens 62 war.

**Quelle.**
- BMF-Schreiben vom 05.10.2023 „Steuerliche Förderung der privaten Altersvorsorge“:
  - Rn. 229: Die Erträge sind „von den Erben zu versteuern“.
  - Rn. 230, Beispiel: 62-jähriger Erblasser, 42-jährige Tochter, die Erträge sind bei der Tochter voll
    steuerpflichtig.
  - Rn. 148: Die Halbierung setzt die Vollendung des 62. Lebensjahres **des Leistungsempfängers** und eine
    Laufzeit von 12 Jahren voraus.
- § 22 Nr. 5 S. 2 Buchst. c und S. 3 EStG, https://www.gesetze-im-internet.de/estg/__22.html
- Für das AVD gibt es noch kein eigenes BMF-Schreiben. Die Normstruktur (§ 22 Nr. 5, § 93 EStG) ist aber
  identisch.

**Formel.**

| | Original | mit Fix |
|---|---|---|
| Halbierung | `heirHalf && Alter der verstorbenen Person ≥ 62 && idx ≥ 12` | `heirHalf && idx ≥ 12`; `heirHalf` bedeutet jetzt „Erbe ist bei der Auszahlung mindestens 62“ |
| Steuer AVD | `taxAdd(idx < n ? incAt(idx) : incRet, gain, idx)` | `taxAdd(p.incHeir, gain, idx)` |
| Hinweis AVD | „Förderung X zurück, Steuer auf Erträge Y“ | „Förderung X zurück, Steuer der Erben auf Erträge Y“ |
| Restrenten der Versicherung (Garantiezeit) | `annual − taxAdd(incRet, annual·ea, t)` | `annual − taxAdd(p.incHeir, annual·ea, t)`; Hinweis „…, nach Steuer der Erben“ |

- Neu ist der Parameter `Params.incHeir = max(0, incHeir)`: das zu versteuernde Einkommen der Erben in heutigem
  Geld. Standard ist 38.000 €, wie beim Gehalt.
- Die Übertragung auf den Ehepartner (`heirMarried`) ist unverändert. Dort zahlt später die überlebende Person.

**Code.** `engine.ts`: `r.heir` im AVD-Block und `heirNet` im Leibrenten-Block.

**Wirkung (Default, AVD-Erbwert real).**

| Fall | Original | mit Fix |
|---|---|---|
| Tod mit 50, Erbe ohne eigenes Einkommen | 62.220 € | 71.523 € (+9.303 €) |
| Tod mit 50, Erbe mit 38.000 € | 62.220 € | 62.220 € (unverändert) |
| Tod mit 80, `heirHalf` an, Erbe 50 Jahre mit 38.000 € | 82.563 € | 63.275 € (`heirHalf` aus) |

Im Original stand `heirHalf` im letzten Fall an, weil die verstorbene Person über 62 war. Mit Fix ist `heirHalf`
aus, weil die 50-jährige Erbin jünger als 62 ist.

**Tests.**
- `heirTax (E2): Default Tod mit 50 → …`
- `… Restrenten der Versicherung …`
- `… Ehepartner-Übertragung bleibt unverändert`
- `heirTax ändert nur Erbwerte, nie die Rentenphase`

---

## E3 – `bonusOutsideSA`: Berufseinsteigerbonus nicht in der Günstigerprüfung

**Problem.** Das Original rechnet den Bonus von 200 € beim Sonderausgabenabzug mit und zieht ihn auch bei der
Gegenrechnung ab.

**Quelle.**
- § 2 Abs. 6 S. 2 Hs. 2 EStG: „bei der Ermittlung der dem Steuerpflichtigen zustehenden Zulage bleibt die
  Erhöhung der Grundzulage nach § 84 Satz 2 außer Betracht“, https://www.gesetze-im-internet.de/estg/__2.html
- BMF 05.10.2023, Rn. 92, 103 und 106.
- Der Bonus steht auch nach dem AVRG in § 84 S. 2 EStG n. F. (BGBl. 2026 I Nr. 156, Art. 2 Nr. 7).

**Formel.**

| | Original | mit Fix |
|---|---|---|
| Abzug | `taxSave(incAt(t), E + z, t)`, mit `z = grund + kind + bon` | `taxSave(incAt(t), E + zSA, t)`, mit `zSA = grund + kind` |
| Zusätzliche Erstattung | `max(0, save − z)` | `max(0, save − zSA)` |

Gutgeschrieben wird in beiden Fällen die volle Zulage `z` einschließlich Bonus.

**Code.** `engine.ts`, AVD-Funktion `run` (`zSA`).

**Wirkung.**
- Erstattung im Bonusjahr bei zvE 38.000 €: 35 € → 175 €.
- Default: AVD-cumH 174.149 € → 174.891 € (+742 €).
- Ohne Bonus oder ab einem Alter von 25 hat der Fix keine Wirkung.

**Tests.**
- `bonusOutsideSA (E3): …`
- `bonus = false oder a0 ≥ 25 ⇒ bonusOutsideSA ändert nichts`
- `bonusOutsideSA erhöht die Erstattung, nie die Zulage`

---

## E6 – `kvInvestBase`: KV auf Fondserträge mit Teilfreistellung und Vorabpauschale

**Problem.** Das Original verbeitragt 100 % des Gewinnanteils einer Entnahme. Die Vorabpauschale in der
Rentenphase verbeitragt es gar nicht.

**Quelle.**
- GKV-Spitzenverband, Katalog von Einnahmen nach § 240 SGB V (Stand 26.05.2026), Zeile „Investmenterträge,
  § 16 InvStG: ja, unter Berücksichtigung der §§ 20 und 56 Abs. 6 InvStG“.
- § 16 InvStG umfasst Ausschüttungen, Vorabpauschalen und Veräußerungsgewinne.
- § 20 InvStG ist die Teilfreistellung von 30 % für Aktienfonds.

**Formel.** Je Rentenjahr t < tEnd eines Fonds:

| | Original | mit Fix |
|---|---|---|
| KV-Basis | `gain` | `0,7 · gain + 0,7 · vp` |

`vp` ist die Vorabpauschale des Jahres. Sie zählt nur in der Rentenphase, denn vorher ist die Person
pflichtversichert.

Der Fix betrifft alle Fonds: den ETF, den aktiven Fonds, das AVD-Nebendepot und den ETF aus der
Kapitalauszahlung der Versicherung. Die Werbungskostenpauschale von 51 € wird nicht abgezogen (vernachlässigbar).

**Code.** `engine.ts`, `runFund` (`kvBase`).

**Wirkung (cumH real).**

| Fall | ETF | AVD | Versicherung |
|---|---|---|---|
| DK | −132 € | −13 € | −2.239 € |
| High | −1.184 € | −946 € | −5.675 € |

Der ETF aus der Kapitalauszahlung hat hohe Anschaffungskosten. Sein Ertrag besteht deshalb fast nur aus der
Vorabpauschale, und er war bisher fast beitragsfrei.

**Tests.**
- `kvInvestBase (E6): …`
- `kvOn = false ⇒ die KV-Fixes ändern nichts`

---

## E7 – `kvSharedRoom`: eine Beitragsbemessungsgrenze für alle laufenden Einnahmen eines Produkts

**Problem.** Das Original begrenzt jeden Zahlungsstrom für sich auf den Spielraum bis zur BBG
(`kvRoom(t) = (69.750 € − incRet) · I(t)`). Beim AVD sind das der Auszahlplan und das Nebendepot, bei der
Versicherung die Kapitalauszahlung und der Folge-ETF. Die BBG gilt aber für die Summe aller Einnahmen.

**Quelle.** § 240 SGB V mit § 223 Abs. 3 SGB V: eine Beitragsbemessungsgrenze je Mitglied. Ein Logikfehler,
keine Auslegungsfrage.

Im Einzelvergleich rechnet jedes Produkt so, als wäre es das einzige. Die Grenze gilt deshalb je Produkt. Über
mehrere Produkte zusammen gilt sie erst in einer Kombi.

**Formel.** Je Produkt führt die Engine ein Jahresbuch `book[t]` mit nominalen Beträgen. Am Ende gilt
`net[t] −= kvRate · min(book[t], kvRoom(t))`.

| Produkt | Was ins Buch kommt |
|---|---|
| ETF und aktiver Fonds | KV-Basis des Fonds |
| AVD | Auszahlplan-Rate W und KV-Basis des Nebendepots |
| Versicherung mit Leibrente | Jahresrente |
| Versicherung mit Kapitalauszahlung | KV-Basis des Folge-ETF, mit E8 dazu C/10 in den Jahren n … n+9 |

- `runFund` bekommt dazu das optionale Argument `kvSink`. Ist es gesetzt, trägt `runFund` die Basis dort ein,
  statt sie selbst abzuziehen.
- Die AVD-30-%-Auszahlung bleibt **immer** im eigenen Topf `kvLump(L, n)` (`10 · room(n)`), wie im Original
  (siehe E9).
- Ohne E8 bleibt auch die KV auf die Kapitalauszahlung der Versicherung im Topf `kvLump(C, n)`.

**Code.** `engine.ts`: `kvBook`, `applyKv`, das Argument `book` in `run`/`runFund` und die Blöcke der Produkte.

**Wirkung.**
- Default, DK und High: |Δ| < 1 €, weil die Rente weit unter der BBG liegt.
- High mit Rente 60.000 € (Spielraum 9.750 €): Die KV des AVD sinkt um 13.045 € real. **Der Sieger wechselt
  dabei vom ETF zum AVD.**
- High mit Rente 60.000 € und 30-%-Auszahlung: +3.012 €. In Wave 1 waren es 11.521 €, weil dort auch die
  30-%-Auszahlung über 10 Jahre ins Buch gerechnet wurde. Das bleibt hier wegen E9 bewusst draußen.

**Tests.**
- `kvSharedRoom (E7): …`
- `kvSharedRoom erhöht die KV nie (Netto je Jahr nie kleiner)`

---

## E8 – `kvLumpSpread`: KV auf die Kapitalauszahlung der Versicherung über 10 Jahre

**Problem.** Das Original zieht die Beiträge für 120 Monate sofort von der Kapitalauszahlung ab
(`kapNet = C − kapTax − kvLump(C, n)`). Dadurch wird weniger im Folge-ETF angelegt, und etwa 10 Jahre Rendite
gehen verloren. Außerdem bleibt der Spielraum auf das Jahr n fixiert.

**Quelle.**
- § 5 Abs. 4 der Beitragsverfahrensgrundsätze Selbstzahler: Leistungen von Versicherungsunternehmen zur
  Altersversorgung sind ab dem Folgemonat „mit einem 1/120 des Zahlbetrags der Leistung für 120 Monate
  zuzuordnen“.
- BSG, Urteil vom 27.01.2010, B 12 KR 28/08 R.

**Formel.**

| | Original | mit Fix |
|---|---|---|
| Kapital nach Abzügen | `kapNet = C − kapTax − kvLump(C, n)` | `kapNet = C − kapTax` (= `capNet`), angelegt im Folge-ETF |
| KV | sofort abgezogen | in den Jahren n … n+9: mit E7 C/10 ins Buch, sonst `net[n+j] −= kvRate · min(C/10, kvRoom(n+j))` |

Erbwerte nach Rentenbeginn: Der Folge-ETF ist größer, offene KV-Beiträge werden nicht abgezogen. Mit dem Tod
endet die Mitgliedschaft.

`kapNet` ist auch bei Leibrente ein Anzeigewert („Alternativ Kapitalauszahlung … netto“). Mit dem Fix ist das
der Betrag nach Steuer.

**Code.** `engine.ts`, Versicherungsblock (`kapNet` und die Schleife über n … n+9).

**Wirkung (real).**
- DK: Versicherung cumH +4.572 €; Kapitalauszahlung netto 85.361 € → 112.404 €.
- High: +4.582 €.
- Ohne `kvOn`, bei Leibrente oder ohne Versicherung hat der Fix keine Wirkung auf die Rechnung.

**Tests.**
- `kvLumpSpread (E8): …`
- `kvLumpSpread wirkt nur bei Kapitalauszahlung der Versicherung mit kvOn`

---

## E10 – `avdUnsubsidized`: Beiträge über 1.800 €/Jahr bleiben ungefördert im AVD-Vertrag

**Problem.** Das Original rechnet jeden AVD-Beitrag über 150 €/Monat in einem ETF-Nebendepot: ETF-Kosten,
Abgeltungsteuer mit eigenem Sparer-Pauschbetrag, Vorabpauschale. „AVD mit 450 €“ war damit dasselbe wie
„150 € AVD + 300 € ETF“, bis auf Cent. Nach dem AVRG darf man aber bis 6.840 € im Jahr in den Vertrag einzahlen.
Der Teil über 1.800 € ist ungefördert und wird anders behandelt als ein ETF-Depot.

**Quelle.**
- Höchstbetrag: geförderte Eigenbeiträge bis 1.800 €/Jahr, Eigenbeiträge insgesamt bis 6.840 €/Jahr
  (Altersvorsorgereformgesetz vom 26.05.2026, BGBl. 2026 I Nr. 156; u. a. https://www.vorsorgedepot-lotse.de/wissen/wie-viel-kann-ich-maximal-ins-altersvorsorgedepot-einzahlen).
- Besteuerung: § 22 Nr. 5 S. 2 EStG, für Leistungen, die nicht auf geförderten Beiträgen beruhen. Buchst. c (andere
  Leistungen als Leibrenten und Versicherungen): „der Unterschiedsbetrag zwischen der Leistung und der Summe der
  auf sie entrichteten Beiträge“; § 20 Abs. 1 Nr. 6 S. 2 EStG gilt entsprechend, also zur Hälfte, wenn die Leistung
  nach dem 62. Lebensjahr und nach 12 Jahren Vertragslaufzeit fließt. Das AVRG ändert in Satz 2 nur einen Verweis
  (https://www.buzer.de/22_EStG.htm). In der Ansparphase gibt es keine Steuer (keine Vorabpauschale).
- KV für freiwillig Versicherte: ganze Auszahlung, wie bei privaten Renten (BSG, 27.01.2010, B 12 KR 28/08 R:
  Zahlbetrag, unabhängig davon, ob die Beiträge aus versteuertem Einkommen stammen). Für das AVD gibt es noch keine
  Entscheidung (siehe offene Punkte).

**Formel (je Jahr, nominal).**

| | Original | mit Fix |
|---|---|---|
| Beitrag | `E = min(want, 1.800)` ins AVD, `want − E` ins Nebendepot | `E` gefördert; `U = min(want, 6.840) − E` ungefördert im Vertrag (`Vu`, Anschaffungskosten `Bu`); nur `want − E − U` ins Nebendepot |
| Kosten | Nebendepot mit `etfTer` | `U` mit `avdCost` wie der geförderte Teil |
| Ansparphase | Vorabpauschale und Pauschbetrag im Nebendepot | keine Steuer |
| Auszahlung | — | gleicher Auszahlplan und gleiche 30-%-Quote: `Wu = Vu / Restlaufzeit`; Gewinnanteil `q = (Vu − Bu)/Vu · (t ≥ 12 ? ½ : 1)`; `Bu` sinkt anteilig |
| Einkommensteuer | `taxAdd(incRet, W + L)` | `taxAdd(incRet, W + L + q·(Wu + Lu))`, ein Tarif mit dem geförderten Teil |
| KV (kvOn) | — | `W + Wu` laufend, `L + Lu` im Topf der 30-%-Auszahlung (E9) |
| `capNet` | `V − latentTax(V)` | `V + Vu − latentTax(V + q·(Vu − Bu))` |
| Erbfall | — | `Vu` geht ohne Förderrückzahlung an alle Erben (§ 93 betrifft nur gefördertes Vermögen); Steuer der Erben auf `Vu − Bu`, hälftig wie beim geförderten Teil. Beim Ehepartner ebenso |

Jahre ohne Förderberechtigung bleiben wie im Original im Nebendepot (offener Punkt E12). Mit dem Fix aus sind alle
Zusatzterme `+ 0`; der Golden-Test bleibt bitgleich. Die Kombi-Engine rechnet den Fix gleich (I1 über alle
Teilmengen der Fixes). Die Kombi-Suche probiert AVD-Beträge bis 570 €/Monat (`avdRasterMax`).

**Code.** `engine.ts`, AVD-Block (`run`, `r`, `heir`, `heirMarried`); `combo.ts`, Abschnitt 1 und `parts.avd`;
`search.ts`, `avdRasterMax`, `searchSpace`, `pureLabel`.

**Wirkung (cumH real).** Bis 150 €/Monat keine Wirkung (Default, DK unverändert).

| Fall | ohne Fix | mit Fix |
|---|---|---|
| Default mit 450 €/Monat | AVD 469.616 € | 464.970 € (−4.646 €) |
| DK mit 450 €/Monat | AVD 391.480 € | 348.428 € (−43.053 €) |
| High (500 €/Monat, kvOn) | AVD 325.856 €, vorne | 281.639 € (−44.217 €), ETF vorne |
| High ohne kvOn | AVD 386.777 € | 376.393 € (−10.385 €) |

Das AVD allein wird schlechter: Der ungeförderte Teil zahlt AVD-Kosten statt ETF-Kosten und nutzt keinen
Sparer-Pauschbetrag; die hälftige Besteuerung gleicht das bei diesen Annahmen nicht aus. Mit KV zählt die ganze
Auszahlung statt 70 % des Gewinns. Die beste Kombi bei 450 € (Default) ist 280 € AVD + 170 € ETF (470.886 €):
ETF so weit, wie der Pauschbetrag dessen Gewinne freistellt, der Rest im Vertrag.

**Tests.** `tests/avd-unsub.test.ts` (bitgleich bis 150 €, Aufteilung der Beiträge, Studium, Fairness,
Nullrendite: ungeförderter Teil kommt exakt steuerfrei zurück, Steuer nur auf den Gewinn, Erbfall);
`combo.test.ts` I1 und I7; Snapshots in `fixes.test.ts` und `combo-search.test.ts`.

---

## Gesamtwirkung bei den Standardwerten (ALL_FIXES)

cumH real, mit dem aktuellen Standardwert `kvRate` 21,1 %.

| Fall | ETF | AVD | Versicherung | vorne |
|---|---|---|---|---|
| Default, Original | 153.730 € | 174.149 € | 127.324 € | AVD |
| Default, mit Fixes | 153.730 € | 174.891 € | 127.324 € | AVD |
| DK, Original | 137.705 € | 127.377 € | 95.558 € | ETF |
| DK, mit Fixes | 137.576 € | 128.027 € | 97.162 € | ETF |
| High, Original | 324.245 € | 326.776 € | 239.587 € | AVD |
| High, mit Fixes | 323.094 € | 281.639 € | 245.025 € | ETF |

Im High-Fall wirkt E10 (500 €/Monat, davon 350 € ungefördert im Vertrag, mit KV auf die ganze Auszahlung); ohne
E10 lägen die Fixes bei AVD 325.856 € und das AVD vorne.

Beim Default wirkt nur E3, aus diesen Gründen:
- `kvOn` ist aus, deshalb wirken E6 bis E8 nicht.
- Die Anzeige ist real, deshalb wirkt E1 nicht.
- Der Tod mit 50 liegt vor Rentenbeginn, und die Erben haben dasselbe Einkommen. Deshalb wirkt E2 nicht.

Laufzeit: `analyze` und `scenarios` mit allen Fixes etwa ×1,03 gegenüber `NO_FIXES` (Test „Laufzeit“) und etwa
×1,04 gegenüber der unveränderten Original-Engine. Gemessen am 03.11.2026 mit Node 26: rund 0,8 ms je Fall.

## Weitere Änderungen ohne Rechenwirkung

- `scenarioList(p)` liefert je Szenario eine stabile `id`: `kv`, `avdCost`, `refund`, `g`, `incWork`,
  `incRetLow`, `incRetHigh`, `insMode`, `insCost`, außerhalb des Originalpfads zusätzlich `shift` (Umschichtung, siehe
  unten).
- `scenarios(p, opts)` gibt die Optionen an `analyze` weiter.
- Das Label des Szenarios `refund` heißt jetzt „Steuererstattung ausgegeben statt angelegt“, ohne Klammerzusatz.
- Der neue Standardwert `kvRate` 21,1 % statt 21,7 % (Befund E5, ermäßigter Satz nach § 243 SGB V) ist keine
  Engine-Korrektur. Er steht in `inputs.ts`. Beide Engines bekommen im Golden-Test dieselben Eingaben.

- Darstellung ohne Sieger und Kosten-Gleichstand (November 2026): nur Oberfläche und eine Sensitivitätsrechnung mit
  `single()`, keine Änderung an `combo.ts`; siehe `docs/neutrale-darstellung.md`.

## Erweiterung: Umschichtung vor Rentenbeginn (`shift`, kein Fix)

Neue Eingabe, kein Befund am Original; Standard **aus**, dann bitgleich (Golden-Test erlaubt nur die neuen Schlüssel
`params.shift`/`safeRate`). Gerechnet nur in `combo.ts`; `engine.ts` (Referenz) kennt sie nicht. Ersetzt den früheren
Schalter `avdStd`/`avdSafe` (nur AVD): Alte Links und Speicherstände werden auf `shift`/`safeRate` übertragen
(`RETIRED_KEYS` in `inputs.ts`; die Link-Basis v1 behält die alten Schlüssel, die neuen sind angehängt). Damit schichtet
ein alter Link mit `avdStd=1` jetzt alle Produkte um.

**Quelle der Anteile.** § 1 Abs. 1c Nr. 5 AltZertG in der Fassung ab 01.01.2027 (Art. 6 AltVRefG, BGBl. 2026 I
Nr. 156): Das Standarddepot muss ein Verfahren vorsehen, nach dem „fünf Jahre vor der Auszahlungsphase höchstens
50 Prozent des gebildeten Kapitals sowie zwei Jahre vor der Auszahlungsphase und am Beginn der Auszahlungsphase
höchstens 30 Prozent“ im OGAW der Risikoklasse 3–5 liegen; der Vertragspartner kann andere Prozentsätze verlangen
(Buchst. b). Kostendeckel des Standarddepots 1,0 % (§ 2a Abs. 2 AltZertG n. F.). Dieselben Anteile gelten mit dem
Schalter für **alle** Produkte, damit der Vergleich fair bleibt.

**Formel.** `riskyShare(p, t, n)` in `core.ts`: Anteil Aktien zu Beginn von Ansparjahr t: 0,5 für `n − t ≤ 5`, 0,3 für
`n − t ≤ 2`, sonst 1.

| Produkt | Umschichtung | Quelle |
|---|---|---|
| AVD (gefördert und ungefördert) | im Vertrag, steuerfrei: Rendite `w · g + (1 − w) · safeRate` (`contractGrowth`) | Besteuerung erst bei Leistung, § 22 Nr. 5 EStG |
| Versicherung | ebenso, Ansparphase | Fondswechsel im Vertrag ohne Zufluss; Besteuerung bei Leistung, § 20 Abs. 1 Nr. 6, § 22 Nr. 1 EStG |
| ETF, aktiver Fonds, AVD-Nebendepot, ETF aus der Kapitalauszahlung | zweites Teil-Depot „sicher“ (Anleihe-/Geldmarkt-ETF, `etfTer`, kein Ausgabeaufschlag, Rendite `safeRate`, Teilfreistellung 0); Beiträge und Einmalbeträge nach `w` aufgeteilt; zu Beginn jedes Ansparjahres Verkauf aus dem übergewichteten Teil auf den Zielanteil | § 19 Abs. 1 InvStG, § 20 Abs. 4 EStG (Veräußerungsgewinn), § 20 Abs. 1 InvStG (Teilfreistellung 30 % nur Aktienfonds), § 20 Abs. 9 EStG (Pauschbetrag) |

- **Verkaufssteuer:** Gewinn = Verkaufsbetrag · (V − B)/V (Durchschnitt), steuerpflichtig zu 70 % (Aktienteil) bzw.
  100 % (sicherer Teil). Er zählt in Phase 1 des Jahres zusammen mit den Entnahmen in den **einen** Sparer-Pauschbetrag
  (in der Kombi für alle Depots), der Rest danach für die Vorabpauschalen. Die Steuer wird aus dem Verkaufserlös
  bezahlt, der Rest umgeschichtet (Anschaffungskosten = umgeschichteter Betrag).
- **Sicherer Teil:** eigene Vorabpauschale (Basisertrag wie beim ETF), ohne Teilfreistellung voll steuerpflichtig.
- **KV (E6):** In der Rentenphase zählen beim sicheren Teil 100 % von Entnahmegewinn und Vorabpauschale, beim
  Aktienteil 70 % (GKV-Katalog: § 16 InvStG „unter Berücksichtigung der §§ 20 und 56 Abs. 6 InvStG“). Vor
  Rentenbeginn keine KV (pflichtversichert), wie bisher.
- **Auszahlphase:** `gPay` für alle Produkte und beide Teil-Depots (Annahme des Nutzers). Die Aufteilung 30/70 bleibt;
  entnommen wird aus beiden Teilen nach Auszahlplan.
- **Kapital nach Steuern, Erbfall:** beide Teil-Depots zusammen verkauft, ein Pauschbetrag, Gewinne je Teilfreistellung.

**Szenario-Zeile** `shift`: „Alle schichten vor der Rente um (wie das Standarddepot)“ bzw. „Niemand schichtet vor der
Rente um“, am Ende der Liste. Sie gibt es nur außerhalb des Originalpfads (`scenarioList(p, kombi, opts)` mit
`NO_FIXES` ohne diese Zeile), damit der Golden-Test die Zeilen des Originals 1:1 vergleicht; die App rechnet immer mit
allen Korrekturen.

**Wirkung (Standardwerte, `safeRate` 2 %, cumH in heutiger Kaufkraft).**

| Fall | ETF | AVD | Versicherung | aktiver Fonds |
|---|---|---|---|---|
| Default, aus | 153.730 € | 174.891 € | 127.324 € | 90.829 € |
| Default, an | 133.142 € | 156.530 € | 113.080 € | 89.459 € |
| DK, aus | 137.576 € | 128.027 € | 97.162 € | 84.133 € |
| DK, an | 122.571 € | 114.885 € | 84.465 € | 83.232 € |

Das ETF-Depot verliert mehr als das AVD (−13,4 % gegen −10,5 %), weil es beim Umschichten Steuern zahlt und der sichere
Teil keine Teilfreistellung hat. Der aktive Fonds verliert kaum: Der sichere Teil liegt im günstigen Anleihe-ETF statt im
teuren Fonds. Beste Aufteilung bei 450 € (Default): ohne Umschichtung 170 € ETF + 280 € AVD, mit 50 € ETF + 400 € AVD.

**Vereinfachungen / offen.**
- Gesetzliche Höchstanteile, Stufen zu Jahresbeginn statt eines gleitenden Verfahrens; Anbieter dürfen weniger Aktien
  halten und die Beitragsaufteilung schon vorher anpassen (Buchst. c). Wer selbst umschichtet, kann anders vorgehen.
- **FIFO (bewusst nicht umgesetzt):** Tatsächlich gelten die zuerst angeschafften Anteile als zuerst verkauft (§ 20
  Abs. 4 S. 7 EStG über § 19 Abs. 1 InvStG); gerechnet ist der Durchschnitt, bei Umschichtung und Entnahmen (Letzteres
  wie im Original). Bei steigenden Kursen fällt die Steuer mit FIFO früher an; der Gesamtgewinn bleibt gleich, es
  kostet nur den Zins auf die vorgezogene Steuer und eine andere Verteilung des Pauschbetrags. Beispiel erster
  Umschichtungsverkauf mit 62 (Standardwerte): Steuer 18.310 € gerechnet, 21.458 € mit FIFO. Über die ganze Laufzeit
  (Summe 67–90, heutige Kaufkraft, Prüfrechnung `scripts/fifo-check.mjs`, ohne Vorabpauschale):

  | ETF 150 €/Monat | Durchschnitt | FIFO | Unterschied |
  |---|---|---|---|
  | ohne Umschichtung | 154.959 € | 154.515 € | −444 € (−0,3 %) |
  | mit Umschichtung | 132.561 € | 131.780 € | −781 € (−0,6 %) |

  Das ändert keinen Vergleich (AVD bei Standardwerten rund 21.000 € vorne) und kaum die Kosten der Umschichtung. Den
  Aufwand (Kaufposten je Monat in jedem Depot) lohnt das nicht.
- **Verluste (bewusst nicht umgesetzt):** Ein Verkauf unter den Anschaffungskosten ergibt Gewinn 0, der Verlust wird
  nicht verrechnet oder vorgetragen (wie bei Entnahmen im Original). Die Steuer ist dadurch höchstens zu hoch, nie zu
  niedrig. Bei Standardwerten ist beim Umschichten kein Depot im Minus (Wirkung 0); vorkommen kann es bei Rendite unter
  den Kosten, sehr kurzer Laufzeit oder beim aktiven Fonds kurz nach dem Kauf (Ausgabeaufschlag).
- Ordergebühren und Spreads fehlen.
- Die Aufteilung in der Auszahlphase regelt das Gesetz nicht; gerechnet wird mit `gPay` für alle.

**Tests.** `tests/shift.test.ts` (aus = bitgleich, Anteile, steuerfreie Verträge, Nullrendite, Steuer im ersten
Umschichtungsjahr nachgerechnet, KV-Faktor 0,91/0,7, ein Pauschbetrag in der Kombi, Nebendepot und Folge-ETF,
Erbfall, Szenario-Zeile, Migration der alten Schlüssel); e2e „Umschichtung vor Rentenbeginn“.

## Bewusst übernommene Vereinfachungen des Originals

- **Sparer-Pauschbetrag:** nominal 1.000 € je Person/Jahr, innerhalb einer Kombi gemeinsam einschließlich Versicherung (R7). Hypothetische Indexierung ist jetzt eine wählbare Sensitivität.
- **Kapitalauszahlung der Versicherung bei weniger als 12 Jahren Laufzeit** (nur bei a0 ≥ R − 11):
  Historisch ohne Sparer-Pauschbetrag (E11). Mit R7 inzwischen ebenfalls gemeinsamer Pauschbetrag, mit R3 Günstigerprüfung.
- **AVD-30-%-Auszahlung:** KV mit dem eigenen Topf `kvLump(L, n)` (`10 · room(n)`, entspricht 120 Monaten),
  außerhalb des Jahresbuchs aus E7 (siehe E9).
- **`latentTax`:** Die spätere Einkommensteuer auf AVD-Kapital ist grob geschätzt, gleichmäßig über den
  restlichen Auszahlplan verteilt. Verwendet wird sie für `capNet` und `heirMarried`.
- **Tarif 2026 fortgeschrieben:** Einkommensteuer-Tarif, Soli-Freigrenze und BBG wachsen mit der angenommenen
  Inflation. Gerechnet wird mit dem Grundtarif; seit R8 werden Einkommen und Steuer nominal auf volle Euro abgerundet.

## Offene Punkte (nicht umgesetzt)

E4 ist inzwischen als `soliOnZulage` umgesetzt: gesetzliche SA-Entscheidung nach ESt,
reguläre Zulage auch in der Soli-Basis, gemeinsame Veranlagung mit R3. Herleitung, Grenzen der persönlichen
Kinderfreibetragsrechnung, nominale Rundung und Wirkung stehen im
[Nachtrag E4/D1](zulagen-veranlagung-2026-11.md). Die folgenden Punkte bleiben offen.

- **E9 – KV auf AVD-Auszahlungen bei freiwillig Versicherten (Rechnung unverändert).**
  - Offen ist, ob für die 30-%-Auszahlung 1/120 gilt (§ 5 Abs. 4 BVSz nennt nur Versicherungsunternehmen) oder
    1/12 wie bei einer einmaligen Einnahme.
  - Ebenfalls offen ist, ob die ganze Rate oder nur der Ertragsanteil beitragspflichtig ist.
  - Die Rechnung ist eine offene Annahme; der separate Topf kann zu viel Beitrag verlangen. Keine pauschale konservative Richtung gegenüber jeder offenen Auslegung.
  - Mit E10 gilt das auch für den ungeförderten Teil: gerechnet wird die ganze Auszahlung (wie BSG B 12 KR 28/08 R
    bei privaten Renten). Zählte nur der Gewinnanteil (wie bei ETF-Entnahmen), wäre das AVD bei kvOn deutlich
    besser; im High-Fall geht es um gut 40.000 €. Sobald es dazu eine Aussage der Krankenkassen gibt, anpassen.
- **E12 – Ungeförderte Beiträge ohne Förderberechtigung (Rechnung wie im Original).**
  - Offen ist, ob man in Jahren ohne Förderberechtigung (z. B. im Studium) ungefördert ins AVD einzahlen darf.
  - Bis das geklärt ist, gehen diese Beiträge wie im Original ins ETF-Nebendepot.
- **E13 – Hälftige Besteuerung des ungeförderten Teils: Mindestbeitragsdauer.** Finanztip nennt neben 12 Jahren
  Laufzeit „mind. 5 Jahre eingezahlt“ und sonst Abgeltungsteuer. Gerechnet wird nach § 22 Nr. 5 S. 2 Buchst. c i. V. m.
  § 20 Abs. 1 Nr. 6 S. 2 EStG (12 Jahre Laufzeit, Leistung nach 62), sonst voller persönlicher Steuersatz. Betrifft nur
  Starts nach etwa 55. Am Gesetzestext bzw. einem BMF-Schreiben zum AVD prüfen.
- **Erbfall der Kombi (gemeinsam versteuert, `docs/kombi-modus.md` Abschnitt 6).** Gerechnet nach § 93 Abs. 1,
  § 22 Nr. 5 S. 2 und 3, § 20 Abs. 1 Nr. 6, Abs. 4 S. 6, Abs. 9 EStG und § 19 Abs. 1 InvStG (geprüft am 04.11.2026,
  gesetze-im-internet.de). Offen bzw. vereinfacht:
  - **Fünftelregelung (§ 34 EStG)** für die AVD-Auszahlung an die Erben: nicht gerechnet. § 22 Nr. 5 EStG ordnet
    § 34 Abs. 1 ausdrücklich nur für die Abfindung einer Kleinbetragsrente an (§ 93 Abs. 3); eine Aussage für die
    schädliche Verwendung im Todesfall habe ich nicht gefunden. Gilt auch für das AVD allein.
  - **Eine Person als Erbe.** Mehrere Erben hätten je einen Tarif und einen Sparer-Pauschbetrag; das senkt die
    Steuer. Ebenso nicht gerechnet: eigene Kapitalerträge der Erben, die den Pauschbetrag schon nutzen.
  - **Ehepartner:** Im Todesjahr ist meist noch Zusammenveranlagung möglich (Pauschbetrag 2.000 €, § 20 Abs. 9 S. 2
    EStG, Splittingtarif). Gerechnet sind 1.000 € und `incHeir` im Grundtarif, wie im Einzelfall, auch mit der
    Eingabe „verheiratet“ für andere Erben. Erbt mit dieser Eingabe der Partner (`heirMarried`), ist das Todesjahr
    gemeinsam veranlagt (Splitting mit dem Partner-Einkommen, 2.000 €), siehe `kirchensteuer-splitting.md`.
  - **Verkauf im Todesjahr.** Behalten die Erben die Depots, zahlen sie die Steuer erst später; der Erbwert ist dann
    eher zu niedrig. Die Auszahlung des AVD wird im Todesjahr angenommen.
  - **Letzte Steuererklärung der verstorbenen Person** (Einkünfte bis zum Tod) ist nicht gerechnet, wie im Einzelfall.
- **Steuerprofil (Kirchensteuer, Zusammenveranlagung), Details in `kirchensteuer-splitting.md`:**
  - Partner mit eigenem gefördertem Vertrag: seit `avdSpouse` gerechnet (unten). Offen: Wert der mittelbaren
    Partner-Zulage im Vergleich, Partner-Wirkung bei eigenem Beitrag unter 120 €, Kinderzulage/Bonus des Partners,
    Bestandsverträge (§ 52 Abs. 50a, § 90 Abs. 2 n. F.).
  - Partner mit eigenen Kapitalerträgen (geteilter Pauschbetrag, § 20 Abs. 9 S. 3; § 32d Abs. 6 S. 4) nicht gerechnet.
  - Kirchensteuer-Kappung, Kinderfreibeträge in der Bemessung (§ 51a Abs. 2 S. 1), glaubensverschiedene Ehe/Kirchgeld,
    eigene Konfession der Erben, zeitlicher Versatz des Sonderausgabenabzugs.
  - Witwensplitting im Folgejahr (§ 32a Abs. 6 S. 1 Nr. 1; das Todesjahr ist gemeinsam veranlagt gerechnet), abweichender Rentenbeginn des Partners, KV-Anrechnung des
    Partner-Einkommens (§ 240 Abs. 5 SGB V).
- **E2 und E6 für das AVD:** Ein AVD-spezifisches BMF-Schreiben gibt es noch nicht. Übertragen sind die Aussagen
  zur Riester-Rente, weil die Normen dieselben sind. Ob Kassen die Vorabpauschale bei Rentnern tatsächlich
  erheben, ist in der Praxis uneinheitlich.


## Korrekturen aus dem Review November 2026

### R1 – `kvDeductible`: zusätzliche KV/PV als Sonderausgaben

Nach dem gemeinsamen KV-Buch wird die Tarifsteuer auf das gesamte Alterseinkommen einschließlich der Produkte um
die tatsächlich selbst gezahlten zusätzlichen Basis-KV/PV-Beiträge vermindert (§ 10 Abs. 1 Nr. 3 EStG,
https://www.gesetze-im-internet.de/estg/__10.html). `incRet` ist das sonstige zvE **vor diesen zusätzlichen Beiträgen**;
die Beiträge auf das bereits bestehende Einkommen müssen darin schon abgezogen sein.

Die Entlastung zählt als verfügbare Zahlung im selben Steuerjahr, ohne Wiederanlage. Sie wird nach den tatsächlichen
KV-Anteilen auf die Teile verteilt; `incTax` kann negativ sein, weil auch Steuer auf die sonstige Rente entfällt.
Summe der Teil-Steuern und -Nettozahlungen bleibt exakt das gemeinsame Ergebnis. Die 30-%-Teilauszahlung wird mit
ihrer marginalen Steuer nach dem Abzug ausgewiesen. `capNet`/`kapNet` der Versicherung sind weiterhin die anfängliche
Kapitalauszahlung nach Steuer vor späterer KV/PV-Entlastung; die Entlastung wird nicht nochmals im Folge-ETF angelegt.
Keine Annahme über den rechtlich offenen AVD-Beitragsumfang E9 geändert.

### R6 – `avdSmallContribution`: Sonderausgabenabzug auch unter 120 €

Die Zulagenschwelle (§ 86 n. F.) wird vom Sonderausgabenabzug (§ 10a) getrennt.
Unter 120 € im Jahr: keine Grund-/Kinderzulage und kein Bonus, aber gegebenenfalls eine Steuererstattung.
Ab 120 € ist dieser Fix wirkungslos. Quelle: Art. 2 Nr. 1 und 9 AVRG,
https://www.buzer.de/gesetz/17547/a339399.htm. Bei null Beitrag weiterhin null Förderung.

### R8 – `taxRounding`: nominale Rundung nach indexiertem Tarif

`core.ts` enthält zusätzlich `tax2026(incomeNom, index)`: nominales Einkommen auf volle Euro abrunden,
indexierten Tarif anwenden, nominale ESt auf volle Euro abrunden, danach Soli berechnen (§ 32a Abs. 1,
https://www.gesetze-im-internet.de/estg/__32a.html). `est()`/`tax()` bleiben für den Referenzpfad unverändert.
Die Review-Probe hatte den Steuerbetrag noch in heutigen Euro gerundet; deshalb stimmen deren isolierte
R8-Eurobeträge nicht mit dieser genaueren Umsetzung überein. Rundungsstufen können die strikte Konvexität des
Tarifs um wenige nominale Euro verletzen; die Invariantentests berücksichtigen nur diesen begrenzten Effekt.

**Erstes Paket R1/R6/R8, cumH heutige Kaufkraft, KV/PV 21,1 %:**

| Fall | ETF | AVD | Versicherung | vorne |
|---|---:|---:|---:|---|
| Default | 153.730 € | 174.868 € | 127.324 € | AVD |
| DK | 141.550 € | 140.953 € | 104.873 € | ETF, rund 597 € Vorsprung |
| High | 334.909 € | 316.366 € | 264.856 € | ETF |

Gezielte Tests: nominale Rundung und Indexierung, Beiträge 0/108/120 €, verspäteter Bonus nach Dynamik,
gemeinsamer KV-Abzug mit ETF/AVD/Versicherung, BBG, kein Einkommen und Teilauszahlung; außerdem Golden-Test
und historischer I1-Abgleich ohne neue R-Fixes. Die Suche gegen erschöpfende Suche bleibt geprüft.


### R2 – `vpTaxSale`: Vorabpauschalensteuer durch vollständigen Steuerverkauf finanzieren

Stand dieses ersten R2-Pakets: VP-Steuer noch im Entstehungsjahr. Inzwischen korrigiert R4 den Jahreswechsel (siehe Folgebericht). Dazu werden Anteile verkauft;
der Verkauf realisiert selbst Gewinn und Steuer (§ 19 Abs. 1 InvStG, § 20 Abs. 4 EStG):
https://www.gesetze-im-internet.de/invstg_2018/__19.html.
Nach Anrechnung der vollen angesetzten VP auf die Steuerbasis gilt im Durchschnittsmodell
`q = max(0, (V−B)/V)`, Bruttoverkauf `S = VP-Steuer / (1−q×tf×0,26375)`.
`S` deckt beide Steuerzahlungen, mindert das Vermögen und anteilig die Basis. Die gesamten Steuern stehen im
Abgeltungsteuerbuch; der Verkaufsgewinn zählt im Alter nach Teilfreistellung ins gemeinsame KV-Buch.
Durch R1 mindert auch diese zusätzliche KV die Einkommensteuer. Bei nicht ausgeschöpftem Pauschbetrag ist keine
VP-Steuer fällig und kein Steuerverkauf nötig. FIFO und Verlustverrechnung bleiben die dokumentierten Näherungen.

**Alle vier umgesetzten R-Fixes, cumH heutige Kaufkraft, KV/PV 21,1 %:**

| Fall | ETF | AVD | Versicherung | vorne |
|---|---:|---:|---:|---|
| Default | 152.506 € | 174.850 € | 127.222 € | AVD |
| DK | 140.049 € | 140.926 € | 104.712 € | **AVD, rund 877 € Vorsprung** |
| High | 331.567 € | 316.189 € | 264.532 € | ETF |

R2 allein zusätzlich zum ersten Paket verändert E / A / V um:
Default −1.224 / −18 / −103 €, DK −1.501 / −26 / −161 €, High −3.342 / −177 / −324 €.
Der Nettoeffekt bei KV weicht von der isolierten Review-Probe ab, weil R1 jetzt bereits mitgerechnet wird.
Bei 21,7 % liegt DK ebenfalls knapp beim AVD (139.957 gegen 139.695 €).
Die weiterhin fehlende Kapitalertrags-Günstigerprüfung R3, der VP-Jahreswechsel R4, Förderverzug und E9 können
knappe Rangfolgen verändern. Das ist keine robuste Produktüberlegenheit.

Die beste Kombi bei 450 € ohne KV ist nun 120 € ETF + 330 € AVD, cumH 469.572 €.
Bei 300 € wird weiterhin 150/150 als gleichwertig genannt; das Maximum 110 € ETF + 190 € AVD liegt nur 285 € vorne.
Bei 1.000 € bleibt 430 € ETF + 570 € AVD mit 994.159 €; Abstand zu 850 € ETF + 150 € AVD jetzt 12.412 € (1,2 %).
Frühere Beispielzahlen im Dokument sind historische Stände.

**Invarianten:** Der gemeinsame Pauschbetrag kann zusätzliche Steuerverkäufe auslösen und somit die realisierten
KV-Basen verändern. „KV gemeinsam nie größer als Summe der Einzelrechnungen“ gilt deshalb nicht allgemein;
unverändert gilt genau eine laufende BBG (AVD-Teilauszahlung E9 separat). Der alte Vergleich bleibt ohne R2 getestet.
Gezielte R2-Tests prüfen die vollständige Finanzierung an unabhängigen Monats-Cashflows, Restbasis/Erbwert,
ausbleibenden Verkauf ohne Steuer, beide Teilfreistellungen sowie gemeinsame KV-/Steuerbilanz.

**Validierung:** `npx vitest run`: 12 Dateien, **236 Tests grün**, einschließlich Golden-Tests,
Referenzpfad und Suche gegen erschöpfende Suche. `npm run check`: **0 Fehler, 0 Warnungen**.
Keine e2e-Läufe oder Screenshots.


### Abschluss R3/R4/R5/R7 und Annahmen V1–V3

Auch die restlichen vier R-Befunde sind jetzt schaltbar umgesetzt. Vollständige Herleitung, Primärquellen,
Bilanzprüfungen, Default/DK/High-Messungen und Prüfung der offenen H1/H2/E4/E9/E12/E13 stehen im
[Umsetzungsbericht](engine-rest-2026-11.md). Dieser Bericht ersetzt die früheren Zahlen nicht rückwirkend.

Aktuell cumH in heutiger Kaufkraft, 21,1 % KV/PV: Default **153.289 / 174.856 / 127.694 €**,
DK **140.713 / 140.903 / 105.292 €** (ETF / AVD / Versicherung). DK ist mit 190 € Abstand kein robuster Sieger.
High mit KV-Brutto wie `incRet` (Standard `kvGrossRet = −1`): **330.961 / 316.109 / 264.449 €**;
mit fest 20.000 € KV-Brutto wäre die Versicherung 254.574 €. Ein eigener Bruttowert ist unter Weitere Einstellungen
eintragbar; ohne Eingabe gilt `incRet` als Untergrenze. Alle früheren Eingabewerte bleiben lesbar.

Wählbar sind Restprofil für offene Depots, einjähriger Förderverzug als Sensitivität, hypothetische
Pauschbetragsindexierung und getrennte Auszahlkosten. Standardpauschbetrag bleibt nominal fest.
H1 und H2 im geförderten Vertragsteil bleiben ausdrücklich ungenaue Erbwertmodelle; keine neue gesetzliche
Förderkonto-Zuordnung behauptet. Im ungeförderten Vertragsteil bleibt die getrennte Restbasis erhalten.

### E4 und D1 nach Freigabe von c43a261

`soliOnZulage` berücksichtigt die reguläre Zulage in der festzusetzenden ESt und deren Soli-Basis.
Die Entscheidung über den Sonderausgabenabzug nutzt die tarifliche ESt-Differenz; R3 prüft dieselbe
Veranlagung erneut mit sämtlichen Kapitalerträgen. Bonusausnahme, Wiederanlage und zusätzliche Cash-Erstattung
bleiben getrennt bilanziert. Die neue Rechnung steht nur in `combo.ts`, historische Referenzen sind unverändert.

Die bisherige Zurückstellung von E4 wird durch die gesetzliche Herleitung einschließlich BFH X R 11/21
ersetzt, nicht durch eine behauptete neue AVD-Verwaltungsanweisung. Persönliche Kinderfreibeträge und weitere
Steuerermäßigungen fehlen weiterhin im Eingabemodell. Default/DK unverändert, High-AVD jetzt **312.445 €**
statt 316.109 € real; ETF/Versicherung unverändert. DK bleibt mit 190 € Abstand nicht robust.
D1 ist durch präzisierte I4-Dokumentation und den gezielten +13,201749-€-Gegenfall behoben.
Alle Belege und die abschließende Validierung stehen im [Nachtrag](zulagen-veranlagung-2026-11.md).

### R9 – `insDeathMinimum`: Mindest-Todesfallleistung der Versicherung

Fondsgebundene Rentenversicherungen leisten bei Tod vor Rentenbeginn üblicherweise das Vertragsguthaben,
**mindestens die Summe der eingezahlten Beiträge** (Beitragsrückgewähr; z. B. Bayerische „Hallo Zukunft“,
Tarif FRVGZB/2601, AVB § 2 Abs. 8). Bisher zahlte der Erbfall vor Rentenbeginn nur das Fondsguthaben.
Mit R9 gilt bei Tod vor Rentenbeginn (nicht bei Tod genau mit Rentenbeginn) `max(Guthaben, Beitragssumme)` im Einzelprodukt und im gemeinsamen Kombi-Erbfall; der Hinweistext
nennt die Mindestleistung, wenn sie greift. Ansparphase, Kapital, Rente und Rangfolge bleiben unverändert.
Wirkung nur bei Nettorendite nahe oder unter null (Standardwerte: keine Änderung). Test: `tests/ins-death-min.test.ts`.

Bewusst nicht umgesetzt (Hinweis im Glossar `effektivkosten` und `erbfallVersicherung`): Effektivkosten wirken
als fester Abzug von der Rendite. Das genannte Angebot (120 €/Monat, 5 % Dynamik, 43 J. 7 Mon.) nennt 0,88 %
Effektivkosten; sein Endkapital trifft der feste Abzug mit 0,89 % (6–7 % brutto) bis 0,96 % (1 % brutto),
mit dem Standard 0,9 % also auf etwa 1 % genau, überschätzt aber das Guthaben zwischendurch (bei 6 % brutto
Jahr 5 +12 %, Jahr 10 +26 %, Jahr 20 +14 %, Jahr 27 +9 %), weil die Kosten dort überwiegend am Beitrag hängen.
Ein Modell „Kosten am Beitrag“ ist erst sinnvoll, wenn es an weiteren Tarifen (Nettotarif, kurze Laufzeit,
ohne Dynamik) geprüft ist.

### Erweiterung: Kirchensteuer und Zusammenveranlagung (`kist`, `married`, kein Fix)

Neue Eingaben im Steuerprofil, Standard aus (keine Kirchensteuer, ledig) und dann bitgleich zur bisherigen Rechnung.
Kirchensteuer nach § 51a Abs. 2 EStG auf die festzusetzende ESt einschließlich hinzugerechneter AVD-Zulage, auf
Kapitalerträge mit dem ermäßigten Satz nach § 32d Abs. 1 S. 3–5 (9 %: 27,9951 %, 8 %: 27,8186 % statt 26,375 %),
gezahlte KiSt über 36/72 € als Sonderausgabe (§ 10 Abs. 1 Nr. 4, § 10c). Verheiratet: Splitting (§ 32a Abs. 5) mit
dem Partner-zvE, Soli-Freigrenze 40.700 € (§ 3 Abs. 3 SolZG), Sparer-Pauschbetrag 2.000 € (§ 20 Abs. 9); Erben weiter
Grundtarif und 1.000 €; AVD-Übertrag auf den Partner mit dessen Einkommen im Alter. Partner ohne eigenen geförderten
Vertrag und ohne Kapitalerträge; mittelbare Zulage (§ 79 S. 2, AVRG: ≥ 120 €, bis 175 €) und § 10a Abs. 3 S. 2–5
blieben offen (inzwischen als Eingabe `avdSpouse` gerechnet, Abschnitt am Ende).

Wirkung cumH real (ETF / AVD / Versicherung): Default 153.289 / 174.856 / 127.694 € → KiSt 9 %
151.597 / 171.907 / 126.624 €; verheiratet mit Partner 38.000/20.000 € 159.807 / 177.174 / 131.201 €; Partner 0/0 €
176.707 / 199.696 / 138.223 € (AVD-Erstattung 8.017 → 1.246 €). DK mit KiSt 9 %: 139.342 / 138.680 / 104.734 €
(der knappe Abstand ETF − AVD wechselt das Vorzeichen: +662 €). Herleitung, Quellen, alle Messungen und offene Punkte:
[kirchensteuer-splitting.md](kirchensteuer-splitting.md). Tests: `tests/kirchensteuer-splitting.test.ts`.
### Eingabe „Sparer-Pauschbetrag schon genutzt“ (`allowanceUsed`)

Keine Korrektur des Originals, sondern eine neue Eingabe (Standard 0 ⇒ bitgleich, Test `tests/allowance-used.test.ts`).
Der Sparer-Pauschbetrag von 1.000 € gilt je Person einmal für alle Kapitalerträge (§ 20 Abs. 9 EStG,
https://www.gesetze-im-internet.de/estg/__20.html). Bisher stand er voll den verglichenen Produkten zu. Wer schon
Tagesgeldzinsen oder Erträge aus anderen Depots hat, trägt den dafür verbrauchten Betrag ein (€/Jahr, 0 … 1.000).

- Rechnung (nur `combo.ts`): eigener Pauschbetrag je Jahr `max(0, 1.000 € [× I(t) bei indexAllowance] − allowanceUsed × I(t))`.
  Der Betrag ist wie alle Eingaben in heutigem Geld und wächst mit der Inflation, der Pauschbetrag bleibt nominal fest.
  Bei 2 % Inflation sind 500 € heute nach 35 Jahren rund 1.000 € nominal, der Pauschbetrag ist dann ganz verbraucht.
- Gilt überall, wo die Person selbst Kapitalerträge hat: Vorabpauschale und Umschichtung in der Ansparphase,
  Entnahmen, Versicherungsleistung (R7), Kapital nach Steuer bei Rentenbeginn. In der Günstigerprüfung (R3) ist das
  exakt, solange `allowanceUsed × I(t) ≤ 1.000 €` (bzw. ≤ indexierter Pauschbetrag): Die anderen Erträge liegen dann
  ganz im Pauschbetrag, also gilt `andere + eigene − 1.000 = eigene − (1.000 − andere)` auch im Tarif (§ 32d Abs. 6 EStG).
  Wächst der Betrag nominal darüber (600 € bei 2 % Inflation nach etwa 26 Jahren), stünde der Überschuss der anderen
  Erträge in der Günstigerprüfung mit im Tarif; das ist nicht modelliert.
- **Erbfall nicht betroffen:** Verkaufen die Erben, nutzen sie ihren eigenen Pauschbetrag; ihre sonstigen
  Kapitalerträge sind unbekannt. Gerechnet wird dort wie bisher mit vollen 1.000 €. Ohne „verheiratet“
  (`married`) gilt das auch für einen erbenden Ehepartner; erbt dieser ein gemeinsames Tagesgeld mit, ist sein
  Pauschbetrag in Wirklichkeit ebenfalls teilweise verbraucht, der Erbwert der Depots ist dann leicht zu hoch.
- **Zusammen mit `married`** (Merge mit dem Steuerprofil): `allowanceUsed` wird vom gemeinsamen Pauschbetrag
  2.000 € abgezogen (Eingabe bis 2.000 €; ledig wirkt höchstens 1.000 €), überall, wo der eigene Haushalt verkauft
  oder versteuert, einschließlich des Todesjahrs, wenn der Partner erbt (gemeinsame Veranlagung, die anderen
  Kapitalerträge laufen im Haushalt weiter). Die R3-Grenze oben liegt dann bei 2.000 € statt 1.000 €. Test:
  `tests/allowance-used.test.ts` (verheiratet).
- Nicht modelliert: andere Kapitalerträge über 1.000 € (sie würden in der Günstigerprüfung mit im Tarif stehen),
  Verluste aus anderen Depots.

Wirkung cumH (heutige Kaufkraft), ETF / AVD / Versicherung, bei 0 / 250 / 500 / 1.000 € genutzt:

Hier mit KV/PV 21,7 % in DK und High (High zusätzlich `kvGrossRet` 45.000 €); andere Abschnitte nutzen 21,1 % und High ohne
`kvGrossRet`, die Zahlen sind daher nicht direkt vergleichbar.

| Fall | 0 € | 250 € | 500 € | 1.000 € |
|---|---|---|---|---|
| Default | 153.289 / 174.856 / 127.694 | 148.561 / 173.397 / 126.121 | 144.153 / 172.030 / 125.576 | 140.356 / 171.141 / 125.576 |
| DK (KV 21,7 %) | 140.356 / 139.932 / 104.650 | 135.946 / 138.479 / 103.137 | 131.895 / 137.194 / 102.623 | 128.445 / 136.384 / 102.623 |
| High | 330.246 / 310.722 / 263.311 | 325.475 / 308.985 / 261.680 | 321.046 / 307.100 / 260.741 | 317.295 / 305.755 / 260.741 |

Das ETF-Depot verliert bis 8 % (Default −12.933 €), das AVD nur über sein Nebendepot (−2 %). Im DK-Fall wechselt der
knappe Abstand ETF − AVD schon bei 250 € das Vorzeichen (von +424 € auf −2.533 €). Die Versicherung ist ab 500 € gleich,
weil der Betrag bis zum Auszahljahr über 1.000 € nominal gewachsen ist.

### Eingabe „Partner zahlt selbst ins Altersvorsorgedepot“ (`avdSpouse`)

Keine Korrektur des Originals, sondern eine neue Eingabe (Standard 0 ⇒ bitgleich, nur mit `married` wirksam; Test
`tests/partner-avd.test.ts`). Bisher war bei Verheirateten angenommen, dass der Partner keinen eigenen geförderten Vertrag
hat. Jetzt: gemeinsame Günstigerprüfung nach § 10a Abs. 3 EStG (BMF 05.10.2023 Rn. 109/110). Partner-zvE > 0 ⇒ unmittelbar
förderberechtigt (eigene Grundzulage, eigener Höchstbetrag), = 0 ⇒ mittelbar (§ 79 S. 2; nur mit eigenem Vertrag der
Person, Rn. 27; Grundzulage aus den eigenen geförderten Beiträgen, höchstens 175 €, § 84 S. 3–4 n. F.; Höchstbetrag + 120 €).
Die eigene Erstattung ist die Änderung der gemeinsamen Steuer durch den eigenen Vertrag; die Förderrückzahlung im Erbfall
nutzt die nach § 10a Abs. 4 S. 3–4 zugerechnete Steuerermäßigung. Die mittelbare Partner-Zulage liegt im Partner-Vertrag
und ist nicht im Ergebnis enthalten (Summe wird gezeigt). Wirkung bei beiden 38.000 €: AVD 177.174 € → 176.696 / 176.908 /
176.456 € (Partner 10 / 50 / 150 €/Monat); Partner ohne Einkommen: 199.696 → 197.055 € (Erstattung 1.246 → 0 €, Partner-Zulage
7.875 € nominal). Quellen, Rechnung, alle Messungen und offene Punkte:
[kirchensteuer-splitting.md](kirchensteuer-splitting.md#partner-mit-eigenem-gefördertem-vertrag-avdspouse-05112026).
