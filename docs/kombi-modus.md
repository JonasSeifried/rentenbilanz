# Kombi

**Aktueller Stand:** R1/R2/R6/R8 sind umgesetzt. Frühere Zahlenbeispiele unten sind historische Stände; aktuelle Vergleichswerte und Aufteilungen stehen in [Abweichungen, Review-Korrekturen](abweichungen-vom-original.md#korrekturen-aus-dem-review-november-2026).

Eine Kombi verteilt den Monatsbeitrag auf mehrere Produkte. Der Rechner versteuert die Teile gemeinsam, wie es bei
einer Person auch tatsächlich geschieht. Die Kombi läuft im Vergleich als **eigener Teilnehmer** neben den
Einzelprodukten mit: Kachel, Ergebnissatz, Szenarien, Diagramme und „Rente im Detail“. Zusammengestellt wird sie im
Dialog hinter „+ Kombi“ in der Zeile „Vergleichen“. Dort zeigt der Rechner auch die rechnerisch beste Aufteilung.

| Datei | Inhalt |
|---|---|
| `src/lib/engine/combo.ts` | Rechenkern `combo()`, Kennzahlen `comboStats()`, Eingaben `readKombi()`, `scaleSplit()`, `readCombo()`, `shareAllowance()` |
| `src/lib/engine/analyze.ts` | `analyze(p, opts, kombi)`: die Kombi als Teilnehmer `kombi` (`kombiResult()`), Szenarien mit Kombi |
| `src/lib/components/KombiDialog.svelte` | Dialog „Kombi zusammenstellen“ (Entwurf, beste Aufteilung, Übernehmen) |
| `src/lib/engine/search.ts` | Suchraum, beste Aufteilung `bestSplit()`, reine Strategien, erschöpfende Suche (Tests) |
| `src/lib/engine/comboAnalyze.ts` | `analyzeCombo()` (deine Aufteilung, reine Strategien, beste, Wechselwirkung), `robustRows()` |
| `src/lib/comboVerdict.ts` | Ergebnissätze `comboVerdict()`, `splitText()` |
| `tests/combo.test.ts` | Invarianten I1–I8 |
| `tests/combo-search.test.ts` | Suche (S1–S3), Auswertung, Robustheit, Ergebnissätze, Laufzeit |

---

## 1. Rechenmodell

`combo(p, split)` rechnet alle Teile Jahr für Jahr. `split` enthält die Monatsbeiträge je Produkt in € (heutiges
Geld). Sie wachsen mit der Beitragsdynamik wie im Einzelvergleich. `combo.ts` ist die **einzige** Rechen-Engine der
App: Auch jedes Einzelprodukt im Vergleich ist eine Kombi mit nur diesem Teil (`single()` in `analyze.ts`, mit
`parts: [k]` auch bei 0 €). Die Formeln stammen aus `engine.ts` (Port des Originals, jetzt nur Referenz), und zwar in
der Fassung **mit allen Korrekturen** (`docs/abweichungen-vom-original.md`). Gemeinsam gerechnet werden drei Dinge:

1. **Einkommensteuer im Alter.** Steuerpflichtig sind der AVD-Auszahlplan einschließlich der 30-%-Auszahlung, der
   Ertragsanteil der Leibrente und die hälftig steuerpflichtige Kapitalauszahlung der Versicherung (nach 12 Jahren).
   Pro Jahr gibt es **eine** Tarifsteuer auf die Summe. Nach dem KV-Buch werden die zusätzlichen selbst gezahlten KV/PV-Beiträge als Sonderausgaben abgezogen (R1).
   - Die 30-%-Auszahlung des AVD bekommt netto die Grenzsteuer über allen anderen Einkünften des Jahres.
   - Die Kapitalauszahlung vor 12 Jahren bleibt pauschal mit Abgeltungsteuer und ohne Pauschbetrag belastet
     (Vereinfachung des Originals).
2. **Ein Sparer-Pauschbetrag** von 1.000 € im Jahr gilt für alle Depots zusammen: ETF, aktiver Fonds,
   AVD-Nebendepot und das ETF aus der Kapitalauszahlung. Zuerst deckt er die Entnahmegewinne aller Depots, der Rest
   dann die Vorabpauschalen. Mit der Umschichtung vor Rentenbeginn (`shift`) zählen die Gewinne der Umschichtungs-Verkäufe
   wie Entnahmegewinne zuerst; jedes Fondsdepot hat dann ein sicheres Teil-Depot ohne Teilfreistellung
   (`docs/abweichungen-vom-original.md`, „Erweiterung: Umschichtung vor Rentenbeginn“).
3. **Ein KV/PV-Jahresbuch** bis zur Beitragsbemessungsgrenze, gemeinsam für alle Produkte (Fix E7). Darin stehen
   der AVD-Auszahlplan, die Leibrente, die Kapitalauszahlung als C/10 über 10 Jahre (E8) und die Fondsbasis aller
   Depots (70 % des Gewinns plus 70 % der Vorabpauschale in der Rentenphase, E6). Die AVD-30-%-Auszahlung bleibt
   wie im Original in einem eigenen Topf `10 · Spielraum(n)` (Befund E9 offen).

Die Reihenfolge hat keine Zyklen. Das vorläufige Steuerbuch hängt noch nicht an den Fonds. Die abschließende KV/PV-Steuerentlastung berücksichtigt dagegen auch deren Beiträge. Deshalb laufen erst der AVD-Vertrag und die Ansparphase der Versicherung, dann das
vorläufige Steuerbuch, dann alle Depots im Gleichschritt, das KV-Buch und abschließend die KV/PV-Steuerentlastung. Diese wird als Zahlung desselben Jahres gezählt und nicht wiederangelegt.

Unverändert aus der Einzelrechnung übernommen sind die Günstigerprüfung und die Zulagen. Sie hängen nur am AVD-Teil
(I3). Auch der Sparer-Pauschbetrag bleibt nominal fest, und `latentTax` bleibt eine grobe Schätzung.

### Aufteilung gemeinsamer Abzüge (Konvention)

Gemeinsame Steuern, Freibeträge und KV werden **anteilig nach der Bemessungsgrundlage** auf die Teile verteilt:

- Einkommensteuer vor KV-Abzug: `tot · x_i/Σx`; die KV/PV-Steuerentlastung danach anteilig nach tatsächlich gezahlter KV. Negative Steuer bedeutet Entlastung auf die übrige Rente.
- Pauschbetrag: `x_i − f · x_i/Σx`
- KV: `kv · c_i/Σc`

Die Summe ist von dieser Wahl unabhängig. Nur die Zuordnung zu den Teilen ändert sich, also die Spalten in
„Rente im Detail“. Darum weichen die Teilwerte vom Einzelvergleich ab, bei Standardwerten um wenige €/Monat je
Produkt. Die Oberfläche sagt das: „Gemeinsame Steuern und Abgaben sind anteilig auf die Produkte verteilt.“

Mit nur einem Teil fällt jede Formel exakt auf den Ausdruck der Einzelrechnung zurück, denn `x·(c/c) = x`.
Darauf beruht I1.

### Spiegel der Einzelrechnung (I1)

`combo(p, {k: Betrag})` ergibt **bitgenau** (`Object.is`) dasselbe wie `model(p).res[k]` und `analyze(p).stats[k]`.
Geprüft werden alle Skalare, `net[]`, `vals[]`, die Summen und die Kennzahlen, über 32 benannte und 300
Zufallsszenarien mal 4 Produkte. Der historische Vergleich mit `engine.ts` läuft mit E1–E10, `NO_FIXES`, mit
jedem Fix allein und mit allen Fixes außer einem. Die Option `fixes` von `combo()` gibt es nur dafür. Die App ruft
`combo()` immer ohne Optionen auf, also mit allen Fixes.

I1 vergleicht außerdem `heir(idx)` und `heirMarried(idx)` für jedes Todesjahr (Wert bitgenau, Hinweistext gleich)
und `analyze()` selbst gegen `model()`. Neue R-Fixes werden unabhängig in `tests/review-fixes.test.ts` geprüft. Neue Rechnung kommt nur noch in `combo.ts`; abgeschaltet muss sie bitgleich
bleiben.

### Ausgaben

Diese Felder gibt es je Teil und für die Summe:

- `net[t]`, `vals[t]`, `own`, `ownReal`, `capR`, `capNet`, `cost` (nur mit `{cost: true}`), `foerder`
- nur AVD: `capAVD`, `sideR`, `zul`, `ref`, `lumpNet`
- nur Versicherung: `kapNet`, `annual`
- `heir(idx)` (Erbwert dieses Teils, für sich versteuert wie im Einzelvergleich), beim AVD auch `heirMarried(idx)`

Je Teil gibt es außerdem die Anteile `incTax[]`, `abgTax[]` und `kv[]` sowie `taxBase[]`, den
einkommensteuerpflichtigen Betrag. Die Summe enthält die gemeinsamen Bücher `incTax[]`, `abgTax[]` und `kv[]` und das
Flag `kvClipped`: Die BBG hat mehrere Produkte gemeinsam gedeckelt.

`capNet` der Summe verkauft ETF, aktiven Fonds und Nebendepot mit einem einzigen Pauschbetrag.

Kennzahlen (`comboStats`, wie `analyze`): `avgMonthly`, `cumH`, `cum100`, `lump` in der Anzeige-Einheit und
`cumHReal` immer in heutiger Kaufkraft.

## 2. Fairness

Bei jeder **vollständigen** Aufteilung (Σ = Budget) fließt gleich viel eigenes Geld hinein:
Budget × 12 × Σ Dynamikfaktor (I2). Beim AVD zählen dazu der geförderte Teil und das Nebendepot. Einen Vergleich
gibt es deshalb nur bei vollständiger Aufteilung. Im Vergleich liegt die Kombi immer auf dem gemeinsamen
Monatsbeitrag. Der Hinweis „Monatsbeiträge sind nicht gleich“ (`unequal`) kann deshalb nur von abweichenden
Einzelbeiträgen kommen.

Wird die Steuererstattung ausgegeben (`reinvest = false`), fließt beim AVD netto weniger eigenes Geld hinein. Dann
nennt der Rechner keine beste Aufteilung (`refundSpent`).

## 3. Suche nach der besten Aufteilung

**Zielgröße** ist `cumHReal`: die Summe netto von Rentenbeginn bis zum Ende des Auszahlplans, in heutiger Kaufkraft
und unabhängig vom Anzeige-Schalter (E1). Die 30-%-Auszahlung zählt mit.

**Suchraum** (`searchSpace`):

- Σ = Budget, nur gewählte Produkte, Schritt 10 €.
- AVD ∈ {0, 10, …, 570} (`avdRasterMax`: bis 6.840 €/Jahr rechnet das AVD anders als ein ETF, Fix E10; ohne E10 bis
  150). Sind Kinder angegeben, kommt 25 € dazu, denn dort ist die Kinderzulage voll.
- Ist kein ETF gewählt, darf das AVD bis zum ganzen Budget gehen, mit Überlauf ins Nebendepot.
- Ein Rest, der kein Vielfaches von 10 ist, geht ans ETF, ohne ETF ans erste andere Produkt.

**Verfahren „AVD-Raster“:** Die AVD-Kurve hat zwei Buckel, bei 30 € (Ende der 50-%-Grundzulage) und bei 150 €
(Förderhöchstbetrag). Eine einfache Tauschsuche bleibt dazwischen hängen. Deshalb wird jeder AVD-Betrag einzeln
gerechnet. Für jeden verteilt eine Tauschsuche (50 €, dann 10 € zwischen je zwei Produkten) den Rest. Sie startet
warm vom Optimum des vorigen AVD-Betrags; am ersten und letzten AVD-Betrag zusätzlich von allen reinen
Rest-Strategien. Ein Speicher verhindert doppelte Auswertungen. Danach werden die reinen Strategien außerhalb des
Rasters geprüft, etwa AVD 500 € bei gewähltem ETF. Sie werden nur übernommen, wenn sie mehr als 1 € besser sind.

**Gleichstand** (≤ 1 € bis H) wird so entschieden: weniger Produkte, dann mehr ETF, dann weniger Versicherung. Das
ist deterministisch.

**Gleichwertig für die Empfehlung** (`TIE_REL` = 0,1 % der Zielgröße, mindestens 1 €, `tieTol`): Die Suche selbst
bleibt exakt. Danach wird geprüft, ob eine einfachere Alternative höchstens 0,1 % schlechter ist als das Maximum:
jede reine Strategie (außer „alles ins AVD“ über 570 €, das ist nur AVD-Höchstbetrag + Nebendepot) und „150 € AVD,
Rest bestmöglich“ (der Kurvenpunkt beim Förderhöchstbetrag). Unter diesen gilt dieselbe Gleichstandsregel (`simpler`).
Bewusst keine beliebigen Rasterpunkte, sonst landete die Wahl irgendwo am Rand der Toleranz. Das Maximum steht dann
in `top`, der Ergebnissatz nennt es mit Abstand („Auf den Euro gerechnet liegt …“).

Grund: 0,1 % liegt weit unter der Unsicherheit jeder Annahme. Bei 300 € (Standardwerte) lag 160 € AVD + 140 € ETF
nur 6 € über 25 Jahre vor 150 € + 150 €; genannt wird jetzt 150 € + 150 €. `userIsBest` und `flip` (Robustheit)
nutzen dieselbe Toleranz, `fromUser` greift erst, wenn deine Aufteilung das Maximum um mehr als die Toleranz
übertrifft.

**Genauigkeit:** In 50 Zufallsszenarien ist die Suche identisch mit der erschöpfenden Suche (0,00 € Verlust). Die
Szenarien mischen 3 und 4 Produkte, Budgets von 30 bis 600 €, KV, Leibrente, Kinder, Studium und Dynamik. Dafür
braucht die Suche im Schnitt 98 Auswertungen, die erschöpfende 1.075 (mit dem AVD-Raster bis 570 €). Auch auf dem Originalpfad und im Nominalmodus
stimmt sie (S1).

**Nebenprodukt:** `curve` enthält das beste Ergebnis je AVD-Betrag, mit dem Rest bestmöglich verteilt.

### AVD über 150 €

Mit E10 bleibt der Teil über 150 € bis 570 €/Monat ungefördert im Vertrag (AVD-Kosten, keine Steuer in der
Ansparphase, bei Auszahlung nur der Gewinnanteil, nach 12 Jahren zur Hälfte; `docs/abweichungen-vom-original.md`).
AVD 450 € ist deshalb **nicht** dasselbe wie AVD 150 € + 300 € ETF. Bei Standardwerten mit 450 € liegt das Optimum bei
280 € AVD + 170 € ETF: so viel ETF, wie der Sparer-Pauschbetrag dessen Gewinne freistellt, der Rest im Vertrag.

Der Vorteil ist klein und hängt an den Annahmen (Standardwerte, Summe bis 90 in heutiger Kaufkraft):

| Budget | beste Aufteilung | 150 € AVD + Rest ETF | Abstand |
|---|---|---|---|
| 300 € | 150 € + 150 € (160/140 nur 6 € vorne) | 325.453 € | – |
| 450 € | 280 € AVD + 170 € ETF, 470.886 € | 469.616 € | 1.270 € (0,3 %) |
| 1.000 € | 570 € AVD + 430 € ETF, 998.697 € | 991.076 € | 7.622 € (0,8 %) |

Bei 1.000 € kippt es zu 150 € + Rest bei AVD-Kosten 0,8 % oder Basiszins 2 %, zu 30 € AVD bei KV-Pflicht auf die
Auszahlung; bei 35.000 € Renteneinkommen sind 150 € und 220 € praktisch gleich. Finanztip kommt zum selben Schluss
(„Bei 0,5 % ist der Vorteil nur minimal“). Deshalb nennt der Ergebnissatz bei mehr als 150 € AVD immer den Abstand zu
„150 € AVD + Rest“ in Euro und Prozent, die angenommenen AVD-Kosten und die Bindung bis zur Rente.

Erst über 570 € liegt der Rest im ETF-Nebendepot. AVD 800 € entspricht deshalb AVD 570 € plus 230 € im ETF:
Nebendepot und ETF teilen Pauschbetrag, KV-Buch und Kosten. Ganz linear ist die Summe zweier Depots nicht, weil die
Vorabpauschale je Depot auf den tatsächlichen Wertzuwachs gedeckelt ist und Verluste je Depot bei 0 abgeschnitten
werden. Gemessen sind das höchstens 0,1 %, meist weit darunter (I7).

## 4. Auswertung und Ergebnissätze

`analyzeCombo(p, setup, best?)` liefert:

- `user`: deine Aufteilung mit Kosten-Lauf und Teil-Kennzahlen. Sie wird auch bei unvollständiger Aufteilung
  gerechnet.
- `pure`: die reinen Strategien („Alles ins ETF-Depot“, „Alles ins Altersvorsorgedepot (150 € gefördert + X €
  Nebendepot)“, …) und `bestPure`.
- `best`: die beste Aufteilung mit `userIsBest`, `deltaUser` (real), `deltaUserMonthly`, `mixGain` (beste minus
  beste reine) und `isMix`. Liegt deine Aufteilung abseits des Rasters und ist sie besser, wird sie selbst als beste
  gezeigt (`fromUser`). `best` ist `'pending'`, solange kein passendes Suchergebnis vorliegt; die Signatur
  `comboSig` muss zu Params, Budget, Produkten und Fixes passen. `best` ist `null` bei weniger als zwei Produkten.
- `separate` und `interaction`: Die **Wechselwirkung** ist das Ergebnis gemeinsam minus jeder Teil allein, in
  heutiger Kaufkraft. Ohne KV ist sie bis auf kleine gesetzliche Rundungseffekte nicht positiv (I4), wegen des progressiven Tarifs und des einen Pauschbetrags.
  Mit KV kann sie positiv sein, weil eine BBG die Summe deckelt.
- `gap`, `complete`, `restTarget` (ETF, sonst das erste Nicht-AVD-Produkt, sonst AVD), `refundSpent`, `canRank`.

**Robustheit:** `robustRows(p, setup, bestSplit)` ist ein Generator mit **einer Zeile je `next()`**. Er geht die
Szenarien des Einzelvergleichs durch (`scenarioList`), ohne „Steuererstattung ausgegeben“, denn diese Zeile ist von
vornherein unfair. Je Zeile liefert er:

- deine Aufteilung,
- die beste Aufteilung,
- das beste Einzelprodukt,
- die beste Aufteilung der Ausgangslage, im Szenario gerechnet.

`flip` heißt: Eine andere Aufteilung ist im Szenario mehr als `tieTol` (0,1 %, mindestens 1 €) besser. `robustSummary` bildet die Stufen wie
im Einzelvergleich (U5): keine Abweichung, weniger als ein Drittel, ab einem Drittel.

**Ergebnissätze** (`comboVerdict`), Fälle:

- `needTwo`: „Wähle mindestens zwei Produkte zum Aufteilen.“
- `unallocated`: „Noch 50 € offen.“ / „50 € mehr verteilt als das Budget von 400 €.“ /
  „Gib ein Monatsbudget größer als 0 € ein.“
- `refundSpent`
- `ok`, dazu passend:
  - die Überschrift: „Deine Aufteilung ist unter diesen Annahmen rechnerisch die beste …“ oder
    „Deine Aufteilung: Ø …“ mit dem Satz „Rechnerisch am meisten bringt hier …“
  - der Satz zum Mischen
  - der Satz zur Wechselwirkung (ab 1 €)
  - der Robustheitssatz, sobald die Zeilen gerechnet sind

Bei laufender Suche ist `pending = true`.

Abstände werden immer real gerechnet und gerundet (ab 10.000 € auf 100 €, ab 1.000 € auf 10 €). Im Nominalmodus
steht „(in heutiger Kaufkraft)“ dabei. Die Wortwahl ist neutral: nie „optimal“ oder „empfehlen“.

## 5. Laufzeit und Einbindung

Gemessen in Node auf einem Apple-M-Rechner. Die Tests prüfen Obergrenzen.

| | Zeit |
|---|---|
| eine Auswertung ohne Kosten-Lauf | ≈ 55 µs (Test: < 0,5 ms) |
| `analyzeCombo` (deine Aufteilung mit Kosten-Lauf, reine Strategien, Wechselwirkung) | ≈ 0,4 ms (Test: < 5 ms) |
| beste Aufteilung, 3 Produkte, 500 € | ≈ 9 ms (156 Auswertungen) |
| beste Aufteilung, 4 Produkte, 500 € | ≈ 17 ms (278 Auswertungen; Test: < 30 ms) |
| Robustheit je Zeile, 4 Produkte | Median ≈ 19 ms, max ≈ 27 ms (Test: Median < 30 ms) |

Laut Prototyp-Messung (Kombi-Design §3) ist Chromium mit 4-facher CPU-Drosselung etwa 4- bis 5-mal langsamer.

**Einbindung:**

1. **Eingaben.** `combo` schaltet die Kombi ein, `cEtf`, `cAvd`, `cIns`, `cFond` sind ihre Aufteilung in €. Das
   Budget ist immer der gemeinsame Monatsbeitrag `setAll`. Nur so fließt in die Kombi gleich viel eigenes Geld wie in
   jedes Einzelprodukt. `readKombi()` bringt die gespeicherte Aufteilung proportional auf `setAll` (`scaleSplit`,
   ganze Euro, Rest beim größten Teil). Ändert sich der Monatsbeitrag, wandert die Kombi also mit. Mit weniger als
   zwei Produkten gibt es keine Kombi.
2. **Vergleich.** `analyze(p, undefined, kombi)` hängt die Kombi als Teilnehmer `kombi` an (`KOMBI`, Farbe `--s5`,
   in Diagrammen gestrichelt). `res.kombi` hat das Format der Einzelprodukte: Summe der Teile, `vals` summiert. Die
   Rangfolge, die Fairness (`fairOwn`), `refundSpent` (auch für ein AVD, das nur in der Kombi steckt) und die Szenarien
   behandeln sie wie jedes Produkt. Ohne Kombi ist `analyze()` unverändert (Golden-Test). Gleichstand bis 1 € heißt im
   Ergebnissatz „Gleichauf“. Ein Szenario kippt erst, wenn ein anderer Teilnehmer mehr als 1 € vorne liegt
   (`isFlip`). Typischer Gleichstand: AVD mit mehr als 570 € gegen die Kombi aus 570 € AVD und dem Rest im ETF.
3. **Dialog.** Gearbeitet wird an einem Entwurf. Vorbelegt ist die gespeicherte Kombi, sonst eine gleichmäßige
   Aufteilung auf die verglichenen Produkte. Synchron laufen `bestSplit()` (gesucht unter den verglichenen Produkten
   und denen in der Kombi) und `analyzeCombo()` mit `comboVerdict()` ohne Robustheit, denn die Szenarien stehen im
   Überblick. „Übernehmen“ geht nur bei vollständiger Aufteilung auf mindestens zwei Produkte. Ein geänderter
   Monatsbeitrag setzt dann auch `setAll` und alle Einzelbeiträge.

`robustRows()` und `robustSummary()` bleiben als Engine-Funktionen mit Tests erhalten. Die Oberfläche nutzt sie
derzeit nicht.

## 6. Erbfall

`combo()` liefert `heir(idx)` und, mit AVD-Teil, `heirMarried(idx)` für alle Teile zusammen (Tod zu Beginn von Jahr
idx, nominal). Der Tab „Erbfall“ zeigt die Kombi wie das AVD in zwei Zeilen („Ehepartner erbt“, „Kinder / Partner
ohne Trauschein“), ohne AVD-Teil in einer.

| Bestandteil | Behandlung | Quelle |
|---|---|---|
| AVD, gefördert (Erben ≠ Ehepartner) | Zulagen und Steuervorteil zurück; Erträge = Guthaben − Beiträge − Zulagen, bei den Erben einkommensteuerpflichtig, hälftig mit `heirHalf` und 12 Jahren Laufzeit | § 93 Abs. 1 S. 1–2, § 22 Nr. 5 S. 3 EStG; BMF 05.10.2023 Rn. 148, 229 f. |
| AVD, gefördert (Ehepartner) | ohne Rückzahlung auf dessen Vertrag; spätere Steuer grob geschätzt (`latentTax`) | § 93 Abs. 1 S. 4 Buchst. c EStG |
| AVD, ungefördert (E10) | ohne Rückzahlung; Gewinn bei den Erben einkommensteuerpflichtig | § 22 Nr. 5 S. 2 Buchst. c EStG |
| Versicherung vor Rentenbeginn | Fondsguthaben einkommensteuerfrei | § 20 Abs. 1 Nr. 6 S. 1 EStG (nur Erlebensfall, Rückkauf) |
| Versicherung, Leibrente | Restrenten der Garantiezeit, Ertragsanteil bei den Erben | § 22 Nr. 1 S. 3 Buchst. a bb EStG |
| Depots (ETF, aktiver Fonds, Nebendepot, ETF aus der Kapitalauszahlung) | Erben übernehmen Anschaffungskosten und Vorabpauschalen; Verkauf im Todesjahr | § 20 Abs. 4 S. 6 EStG, § 19 Abs. 1 InvStG |

**Gemeinsam** heißt:

- **Ein Tarif im Todesjahr.** AVD-Erträge (gefördert und ungefördert) und der Ertragsanteil der ersten Restrente
  zählen zusammen: `taxAdd(incHeir, ΣX, idx)`. Spätere Restrenten werden wie im Einzelfall Jahr für Jahr versteuert.
- **Ein Sparer-Pauschbetrag** (1.000 €, § 20 Abs. 9 EStG) für den Verkauf aller Depots; Gewinne und Verluste der
  Depots werden verrechnet (wie `capNet` der Summe).
- Ohne Fix `heirTax` (Originalpfad, Steuer mit dem Einkommen der verstorbenen Person) gibt es keine gemeinsame Steuer
  der Erben; dann ist der Erbwert die Summe der Teile.

Der Hinweistext nennt Förderrückzahlung, Einkommensteuer der Erben, Abgeltungsteuer der Depots und die restlichen
Rentenjahre. `detail` liefert die Steuern als Zahlen. Tests I9 in `tests/combo.test.ts`: Ein Teil ergibt den
Einzelwert; mehrere Teile ergeben nie mehr als die Teile einzeln, solange kein Depot im Verlust ist (Progression, ein
Pauschbetrag); ohne `heirTax` die Summe.

Beispiele (Standardwerte, in heutiger Kaufkraft):

| Fall | gemeinsam | Teile einzeln | Ehepartner erbt |
|---|---|---|---|
| Tod mit 50, 150 € ETF + 150 € AVD | 127.756 € | 127.908 € | 136.950 € |
| Tod mit 80, 150 € ETF + 150 € AVD | 115.721 € | 115.805 € | 128.117 € |
| Tod mit 70, 150 € AVD + 150 € Versicherung (Leibrente, 20 Jahre Garantie) | 168.464 € | 168.560 € | 191.717 € |

Der Unterschied ist klein: ETF und Nebendepot teilen sich einen Pauschbetrag, und Restrente und AVD-Erträge stehen
im Todesjahr in einem Tarif.

## 7. Grenzen

- **Erbfall:** eine Person als Erbe, Verkauf aller Depots im Todesjahr, keine Fünftelregelung (Abschnitt
  „Erbfall“, offene Punkte in `docs/abweichungen-vom-original.md`).
- **Keine Fix-Schalter in der Oberfläche.** Die Kombi-Engine rechnet immer mit allen Korrekturen.
- Die **Zuordnung je Teil** ist eine Konvention (anteilig); nur die Summe ist eindeutig.
- **Versicherung:** Kapitalauszahlung oder Leibrente folgt dem Schalter `insLump`. Die Suche schaltet das nicht um.
  Die Szenario-Zeile „Versicherung als lebenslange Rente“ zeigt die Wirkung.
- **Raster 10 €.** Eine Aufteilung abseits des Rasters kann wenige Euro besser sein. Sie wird dann selbst als beste
  gezeigt.
- Übernommene **Vereinfachungen des Originals**:
  - Kapitalauszahlung vor 12 Jahren ohne Pauschbetrag
  - Pauschbetrag nominal fest
  - AVD-30-%-Auszahlung mit eigenem KV-Topf
  - `latentTax` grob
  - Tarif 2026 fortgeschrieben
