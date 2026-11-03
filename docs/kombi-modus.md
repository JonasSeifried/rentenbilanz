# Kombi-Modus „Budget aufteilen“

Im Kombi-Modus verteilt man ein Monatsbudget auf mehrere Produkte. Der Rechner versteuert die Teile gemeinsam, wie
es bei einer Person auch tatsächlich geschieht. Er sucht außerdem die rechnerisch beste Aufteilung unter den
gewählten Annahmen.

| Datei | Inhalt |
|---|---|
| `src/lib/engine/combo.ts` | Rechenkern `combo()`, Kennzahlen `comboStats()`, `readCombo()`, `shareAllowance()` |
| `src/lib/engine/search.ts` | Suchraum, beste Aufteilung `bestSplit()`, reine Strategien, erschöpfende Suche (Tests) |
| `src/lib/engine/comboAnalyze.ts` | `analyzeCombo()` (deine Aufteilung, reine Strategien, beste, Wechselwirkung), `robustRows()` |
| `src/lib/comboVerdict.ts` | Ergebnissätze `comboVerdict()`, `splitText()` |
| `tests/combo.test.ts` | Invarianten I1–I8 |
| `tests/combo-search.test.ts` | Suche (S1–S3), Auswertung, Robustheit, Ergebnissätze, Laufzeit |

---

## 1. Rechenmodell

`combo(p, split)` rechnet alle Teile Jahr für Jahr. `split` enthält die Monatsbeiträge je Produkt in € (heutiges
Geld). Sie wachsen mit der Beitragsdynamik wie im Einzelvergleich. Die Formeln stammen aus `engine.ts`, und zwar in
der Fassung **mit allen Korrekturen** (`docs/abweichungen-vom-original.md`). Gemeinsam gerechnet werden drei Dinge:

1. **Einkommensteuer im Alter.** Steuerpflichtig sind der AVD-Auszahlplan einschließlich der 30-%-Auszahlung, der
   Ertragsanteil der Leibrente und die hälftig steuerpflichtige Kapitalauszahlung der Versicherung (nach 12 Jahren).
   Pro Jahr gibt es **eine** Steuer: `taxAdd(Rente, Σ, t)`.
   - Die 30-%-Auszahlung des AVD bekommt netto die Grenzsteuer über allen anderen Einkünften des Jahres.
   - Die Kapitalauszahlung vor 12 Jahren bleibt pauschal mit Abgeltungsteuer und ohne Pauschbetrag belastet
     (Vereinfachung des Originals).
2. **Ein Sparer-Pauschbetrag** von 1.000 € im Jahr gilt für alle Depots zusammen: ETF, aktiver Fonds,
   AVD-Nebendepot und das ETF aus der Kapitalauszahlung. Zuerst deckt er die Entnahmegewinne aller Depots, der Rest
   dann die Vorabpauschalen.
3. **Ein KV/PV-Jahresbuch** bis zur Beitragsbemessungsgrenze, gemeinsam für alle Produkte (Fix E7). Darin stehen
   der AVD-Auszahlplan, die Leibrente, die Kapitalauszahlung als C/10 über 10 Jahre (E8) und die Fondsbasis aller
   Depots (70 % des Gewinns plus 70 % der Vorabpauschale in der Rentenphase, E6). Die AVD-30-%-Auszahlung bleibt
   wie im Original in einem eigenen Topf `10 · Spielraum(n)` (Befund E9 offen).

Die Reihenfolge hat keine Zyklen. Die Einkommensteuer hängt nicht an den Fonds, weil Fondserträge der
Abgeltungsteuer unterliegen. Deshalb laufen erst der AVD-Vertrag und die Ansparphase der Versicherung, dann das
Steuerbuch, dann alle Depots im Gleichschritt und zuletzt das KV-Buch.

Unverändert aus der Einzelrechnung übernommen sind die Günstigerprüfung und die Zulagen. Sie hängen nur am AVD-Teil
(I3). Auch der Sparer-Pauschbetrag bleibt nominal fest, und `latentTax` bleibt eine grobe Schätzung.

### Aufteilung gemeinsamer Abzüge (Konvention)

Gemeinsame Steuern, Freibeträge und KV werden **anteilig nach der Bemessungsgrundlage** auf die Teile verteilt:

- Einkommensteuer: `tot · x_i/Σx`
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
Zufallsszenarien mal 4 Produkte (1.302 Fälle, ~194.000 Zahlen). Der Test läuft mit `ALL_FIXES`, mit `NO_FIXES`, mit
jedem Fix allein und mit allen Fixes außer einem. Die Option `fixes` von `combo()` gibt es nur dafür. Die App ruft
`combo()` immer ohne Optionen auf, also mit allen Fixes.

**Wer `engine.ts` ändert, muss `combo.ts` gleich mitändern.** Sonst schlägt I1 fehl.

### Ausgaben

Diese Felder gibt es je Teil und für die Summe:

- `net[t]`, `vals[t]`, `own`, `ownReal`, `capR`, `capNet`, `cost` (nur mit `{cost: true}`), `foerder`
- nur AVD: `capAVD`, `sideR`, `zul`, `ref`, `lumpNet`
- nur Versicherung: `kapNet`, `annual`

Je Teil gibt es außerdem die Anteile `incTax[]`, `abgTax[]` und `kv[]` sowie `taxBase[]`, den
einkommensteuerpflichtigen Betrag. Die Summe enthält die gemeinsamen Bücher `incTax[]`, `abgTax[]` und `kv[]` und das
Flag `kvClipped`: Die BBG hat mehrere Produkte gemeinsam gedeckelt.

`capNet` der Summe verkauft ETF, aktiven Fonds und Nebendepot mit einem einzigen Pauschbetrag.

Kennzahlen (`comboStats`, wie `analyze`): `avgMonthly`, `cumH`, `cum100`, `lump` in der Anzeige-Einheit und
`cumHReal` immer in heutiger Kaufkraft.

## 2. Fairness

Bei jeder **vollständigen** Aufteilung (Σ = Budget) fließt gleich viel eigenes Geld hinein:
Budget × 12 × Σ Dynamikfaktor (I2). Beim AVD zählen dazu der geförderte Teil und das Nebendepot. Einen Vergleich
gibt es deshalb nur bei vollständiger Aufteilung. Der Hinweis „Monatsbeiträge sind nicht gleich“ (`unequal`) gilt im
Kombi-Modus nicht.

Wird die Steuererstattung ausgegeben (`reinvest = false`), fließt beim AVD netto weniger eigenes Geld hinein. Dann
nennt der Rechner keine beste Aufteilung (`refundSpent`).

## 3. Suche nach der besten Aufteilung

**Zielgröße** ist `cumHReal`: die Summe netto von Rentenbeginn bis zum Ende des Auszahlplans, in heutiger Kaufkraft
und unabhängig vom Anzeige-Schalter (E1). Die 30-%-Auszahlung zählt mit.

**Suchraum** (`searchSpace`):

- Σ = Budget, nur gewählte Produkte, Schritt 10 €.
- AVD ∈ {0, 10, …, 150}. Sind Kinder angegeben, kommt 25 € dazu, denn dort ist die Kinderzulage voll.
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

**Genauigkeit:** In 50 Zufallsszenarien ist die Suche identisch mit der erschöpfenden Suche (0,00 € Verlust). Die
Szenarien mischen 3 und 4 Produkte, Budgets von 30 bis 600 €, KV, Leibrente, Kinder, Studium und Dynamik. Dafür
braucht die Suche im Schnitt 66 Auswertungen, die erschöpfende 854. Auch auf dem Originalpfad und im Nominalmodus
stimmt sie (S1).

**Nebenprodukt:** `curve` enthält das beste Ergebnis je AVD-Betrag, mit dem Rest bestmöglich verteilt.

### AVD über 150 €

AVD 500 € entspricht AVD 150 € plus 350 € im ETF: Nebendepot und ETF teilen Pauschbetrag, KV-Buch und Kosten.
Bei Standardwerten ist der Unterschied kleiner als 1 €. Ganz linear ist die Summe zweier Depots aber nicht. Die
Vorabpauschale ist je Depot auf den tatsächlichen Wertzuwachs gedeckelt, und Verluste werden je Depot bei 0
abgeschnitten. Gemessen sind das höchstens 0,1 %, meist weit darunter (I7).

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
  heutiger Kaufkraft. Ohne KV ist sie nie positiv (I4), wegen des progressiven Tarifs und des einen Pauschbetrags.
  Mit KV kann sie positiv sein, weil eine BBG die Summe deckelt.
- `gap`, `complete`, `restTarget` (ETF, sonst das erste Nicht-AVD-Produkt, sonst AVD), `refundSpent`, `canRank`.

**Robustheit:** `robustRows(p, setup, bestSplit)` ist ein Generator mit **einer Zeile je `next()`**. Er geht die
Szenarien des Einzelvergleichs durch (`scenarioList`), ohne „Steuererstattung ausgegeben“, denn diese Zeile ist von
vornherein unfair. Je Zeile liefert er:

- deine Aufteilung,
- die beste Aufteilung,
- das beste Einzelprodukt,
- die beste Aufteilung der Ausgangslage, im Szenario gerechnet.

`flip` heißt: Eine andere Aufteilung ist im Szenario mehr als 1 € besser. `robustSummary` bildet die Stufen wie
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
| beste Aufteilung, 3 Produkte, 500 € | ≈ 2,6 ms (64 Auswertungen) |
| beste Aufteilung, 4 Produkte, 500 € | ≈ 6–7 ms (139 Auswertungen; Test: < 15 ms) |
| Robustheit je Zeile, 4 Produkte | Median ≈ 9 ms, max ≈ 16 ms (Test: Median < 30 ms) |

Laut Prototyp-Messung (Kombi-Design §3) ist Chromium mit 4-facher CPU-Drosselung etwa 4- bis 5-mal langsamer.

**Empfohlene Einbindung (WP4):**

1. Synchron in `$derived`:
   `setup = readCombo(app.inputs, p)` und `C = analyzeCombo(p, setup, lastBest)`, dann `comboVerdict(C, robust)`.
2. Die beste Aufteilung **120 ms entprellt**:
   `lastBest = bestSplit(p, setup.budget, setup.keys)`.
   Bis dahin zeigt `C.best === 'pending'`, mit `aria-busy` und „wird berechnet …“. Die vorige beste Aufteilung darf
   die Oberfläche aus dem letzten `ComboAnalysis` weiter anzeigen.
3. Die Robustheit in Leerlauf-Slots: `requestIdleCallback`, ersatzweise `setTimeout(0)`. Je Slot genau ein
   `gen.next()` von `robustRows(p, setup, lastBest.split)`. Ein Generationszähler verwirft die Zeilen, wenn sich die
   Eingaben geändert haben. Ist der Generator fertig, kommt `robustSummary(rows)` an `comboVerdict`.

Alle Ergebnisse von `bestSplit` sind serialisierbar. Falls echte Geräte ruckeln, lässt sich die Suche ohne
API-Änderung in einen Web Worker verschieben.

## 6. Grenzen

- **Kein Erbfall** für Aufteilungen. Ein gemeinsamer Erbwert bräuchte eine gemeinsame Steuer im Todesjahr. Die
  Oberfläche verweist auf „Gleich viel je Produkt“.
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
