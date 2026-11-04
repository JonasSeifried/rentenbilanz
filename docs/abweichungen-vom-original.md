# Abweichungen vom Original

`src/lib/engine/engine.ts` (`model()`) ist ein 1:1-Port von `legacy/index.html`. Darauf liegen sieben Korrekturen.
Jede hängt an einem eigenen Schalter (`src/lib/engine/fixes.ts`). Die App rechnet seit dem Umbau „eine Engine“ mit
`combo.ts`: Ein Einzelprodukt ist eine Kombi mit nur diesem Teil (`single()` in `analyze.ts`). `combo.ts` enthält jede
Korrektur ebenfalls schaltbar und ist mit einem Teil bitgenau gleich `model()`, für jede Teilmenge der Fixes, inklusive
Erbfall und Hinweistexten (I1, `tests/combo.test.ts`). `engine.ts` bleibt als Referenz; die Abschnitte „Code“ unten
nennen die Stelle in `engine.ts`, in `combo.ts` steht sie im gleichnamigen Block.

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

**Wichtig:** Neue Rechnung nur noch in `combo.ts`. Ist sie abgeschaltet (Standard), muss `combo.ts` bitgleich zu
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
  `incRetLow`, `incRetHigh`, `insMode`, `insCost`.
- `scenarios(p, opts)` gibt die Optionen an `analyze` weiter.
- Das Label des Szenarios `refund` heißt jetzt „Steuererstattung ausgegeben statt angelegt“, ohne Klammerzusatz.
- Der neue Standardwert `kvRate` 21,1 % statt 21,7 % (Befund E5, ermäßigter Satz nach § 243 SGB V) ist keine
  Engine-Korrektur. Er steht in `inputs.ts`. Beide Engines bekommen im Golden-Test dieselben Eingaben.

## Erweiterung: Standarddepot-Umschichtung (`avdStd`, kein Fix)

Neue Eingabe, kein Befund am Original; Standard **aus**, dann bitgleich (Golden-Test erlaubt nur die neuen Schlüssel
`params.avdStd`/`avdSafe`).

**Quelle.** § 1 Abs. 1c Nr. 5 AltZertG in der Fassung ab 01.01.2027 (Art. 6 AltVRefG, BGBl. 2026 I Nr. 156): Das
Standarddepot muss ein Verfahren vorsehen, nach dem „fünf Jahre vor der Auszahlungsphase höchstens 50 Prozent des
gebildeten Kapitals sowie zwei Jahre vor der Auszahlungsphase und am Beginn der Auszahlungsphase höchstens 30 Prozent“
im OGAW der Risikoklasse 3–5 liegen; der Vertragspartner kann andere Prozentsätze verlangen (Buchst. b). Kostendeckel
des Standarddepots 1,0 % (§ 2a Abs. 2 AltZertG n. F.).

**Formel.** `avdGrowth(p, t, n)` in `core.ts` (von `engine.ts` und `combo.ts` benutzt): Ansparjahre mit `n − t ≤ 5` rechnen mit
`0,5 · g + 0,5 · avdSafe`, mit `n − t ≤ 2` mit `0,3 · g + 0,7 · avdSafe`, gestuft zu Jahresbeginn; sonst `g`. Gilt für
den geförderten und den ungeförderten Teil (ein Vertrag), nicht für das ETF-Nebendepot. Auszahlphase: `gPay` wie bei
allen Produkten. Wirkung Standardwerte, 450 €/Monat, `avdSafe` 2 %: AVD-Kapital bei Rentenbeginn rund 10 % niedriger (150 €: Ø 634 € → 575 € im Monat, ETF 557 €).

**Vereinfachungen / offen.**
- Gerechnet werden die gesetzlichen Höchstanteile, Stufen statt eines gleitenden Verfahrens; Anbieter dürfen weniger
  Aktien halten und die Beitragsaufteilung schon vorher anpassen (Buchst. c).
- Die Aufteilung in der Auszahlphase regelt das Gesetz nicht. Gerechnet wird wie bei allen Produkten mit `gPay`.
- Ein ETF-Depot, das vor der Rente ebenfalls umschichtet, ist nicht gerechnet (Verkauf mit Abgeltungsteuer). Die
  Oberfläche nennt das unter „Was die Zahlen nicht zeigen“.

**Tests.** `tests/avd-std.test.ts` (aus = bitgleich, Rendite je Jahr, nur AVD betroffen, Kombi-Engine gleich).

## Bewusst übernommene Vereinfachungen des Originals

- **Sparer-Pauschbetrag:** 1.000 € je Produkt und Jahr, nominal fest. Der Betrag wird nicht über alle Depots
  geteilt und nicht an die Inflation angepasst. Das ist offengelegt.
- **Kapitalauszahlung der Versicherung bei weniger als 12 Jahren Laufzeit** (nur bei a0 ≥ R − 11):
  Abgeltungsteuer ohne Sparer-Pauschbetrag. Höchstens etwa 264 € zu viel Steuer (E11, abgelehnt).
- **AVD-30-%-Auszahlung:** KV mit dem eigenen Topf `kvLump(L, n)` (`10 · room(n)`, entspricht 120 Monaten),
  außerhalb des Jahresbuchs aus E7 (siehe E9).
- **`latentTax`:** Die spätere Einkommensteuer auf AVD-Kapital ist grob geschätzt, gleichmäßig über den
  restlichen Auszahlplan verteilt. Verwendet wird sie für `capNet` und `heirMarried`.
- **Tarif 2026 fortgeschrieben:** Einkommensteuer-Tarif, Soli-Freigrenze und BBG wachsen mit der angenommenen
  Inflation. Gerechnet wird mit dem Grundtarif, ohne Abrundung auf volle Euro.

## Offene Punkte (nicht umgesetzt)

- **E4 – Soli auf die hinzugerechnete Zulage (zurückgestellt).**
  - § 3 Abs. 2 SolZG weicht nur bei den Kinderfreibeträgen von § 2 Abs. 6 EStG ab. Nach dem Wortlaut gehört die
    Hinzurechnung der Zulage deshalb zur Soli-Basis.
  - Eine ausdrückliche Verwaltungs- oder Gerichtsaussage fehlt.
  - Wirkung nur bei zvE über etwa 75.000 €. Im High-Fall verliert das AVD bis zu 3.274 € cumH, und der Sieger
    wechselt zum ETF.
  - Die Formel liegt einsatzbereit vor:
    `save = (tax(x) − est(xd) − soli(est(xd) + zSA/I)) · I`, mit `xd = x − (E + zSA)/I`.
  - Sie kann als weiterer FixId (`soliOnZulage`) ergänzt werden, sobald die Rechtslage geklärt ist.
- **E9 – KV auf AVD-Auszahlungen bei freiwillig Versicherten (Rechnung unverändert).**
  - Offen ist, ob für die 30-%-Auszahlung 1/120 gilt (§ 5 Abs. 4 BVSz nennt nur Versicherungsunternehmen) oder
    1/12 wie bei einer einmaligen Einnahme.
  - Ebenfalls offen ist, ob die ganze Rate oder nur der Ertragsanteil beitragspflichtig ist.
  - Die Rechnung bleibt vorsichtig: eher zu viel KV. Die Texte weisen darauf hin.
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
    EStG, Splittingtarif). Gerechnet sind 1.000 € und `incHeir` im Grundtarif, wie im Einzelfall.
  - **Verkauf im Todesjahr.** Behalten die Erben die Depots, zahlen sie die Steuer erst später; der Erbwert ist dann
    eher zu niedrig. Die Auszahlung des AVD wird im Todesjahr angenommen.
  - **Letzte Steuererklärung der verstorbenen Person** (Einkünfte bis zum Tod) ist nicht gerechnet, wie im Einzelfall.
- **E2 und E6 für das AVD:** Ein AVD-spezifisches BMF-Schreiben gibt es noch nicht. Übertragen sind die Aussagen
  zur Riester-Rente, weil die Normen dieselben sind. Ob Kassen die Vorabpauschale bei Rentnern tatsächlich
  erheben, ist in der Praxis uneinheitlich.
