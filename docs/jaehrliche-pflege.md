# Jährliche Pflege: Arbeitsauftrag

Diese Datei ist ein Arbeitsauftrag. Gib sie einer KI (oder arbeite sie selbst ab), am besten im Januar, wenn die neuen Jahreswerte veröffentlicht sind.

## Auftrag

Rentenbilanz rechnet mit Steuer- und Sozialversicherungswerten, die sich jedes Jahr ändern. Lege für das neue Jahr eine neue Rechtsstand-Tabelle an und bring alle Werte auf den aktuellen Stand. Menschen planen ihre Altersvorsorge mit diesen Zahlen, deshalb gilt:

- **Nur Primärquellen:** Gesetzestext (gesetze-im-internet.de, Bundesgesetzblatt), BMF-Schreiben, Verordnungen und Bekanntmachungen der Ministerien. Keine Blogs oder Vergleichsportale als alleinige Quelle.
- **Jeden Wert mit Quelle belegen:** Fundstelle (Paragraf, Absatz, Datum des Schreibens oder der Verordnung) im Kommentar der Tabelle und im Bericht, dazu der Link im Bericht.
- **Unklares nicht raten:** Ist ein Wert noch nicht veröffentlicht oder die Rechtslage unklar, den Vorjahreswert in die neue Tabelle übernehmen, im Kommentar „Wert <Vorjahr> übernommen, <Grund>“ vermerken und den Punkt im Bericht als offen markieren.
- **Neutral bleiben:** Texte zeigen nur Zahlen und Regeln, keine Empfehlung.

## So sind die Jahreswerte organisiert

- **Rechtsstand-Tabellen** in `src/lib/engine/law.ts`: Jeder gesetzliche Jahreswert und Betrag, mit dem gerechnet wird, steht dort genau einmal (Tarif, Soli, Abgeltungsteuer, Pauschbeträge, KV-BBG, AVD-Höchstbeträge und Zulagen, Ertragsanteil, KV/PV-Sätze, Basiszins). Jede Tabelle ist eingefroren (`defineLaw`). `LAWS` listet alle Tabellen, älteste zuerst. `CURRENT_LAW` ist immer die letzte.
- **Die App** rechnet ohne Optionen, also mit `CURRENT_LAW`. Die Engine holt jeden Wert über `lawOf(opts)`; in `core.ts`, `combo.ts`, `engine.ts`, `analyze.ts`, `search.ts` usw. steht kein Jahreswert mehr als Zahl (`tests/law.test.ts` prüft das).
- **Texte der Oberfläche** (Glossar, Einstellungen, Rechenweg, Hinweise, „Was die Zahlen nicht zeigen“, Rechtsstand im Kopf) holen jeden Jahreswert aus `src/lib/lawText.ts` (`LT`, erzeugt aus `CURRENT_LAW`). Auch die Standardwerte `basis`, `kvRate` und `abgRate` in `DEFAULTS` und die Grenze der Eingabe `allowanceUsed` folgen der Tabelle. `tests/law.test.ts` sucht in ganz `src/` nach Jahreswerten als fertigem Text („1.800 €“, „26,375 %“) oder als eindeutiger Zahl und hält die Formatierung für 2026 fest.
- **Golden** (`tests/golden.test.ts`, gegen `legacy/index.html`) und **I1** (`tests/combo.test.ts`, `combo.ts` gegen `engine.ts`) übergeben immer ausdrücklich `LAW_2026`. Sie bleiben deshalb grün, egal wie viele Tabellen dazukommen, und dürfen nie angepasst werden.
- **Regeltests** mit Beträgen von 2026 (Steuer auf 70.000 €, 150 € gefördert, Snapshots …) sind über `tests/helpers/law-2026.ts` fest an `LAW_2026` gebunden (eine Zeile `vi.mock(…)` am Dateianfang). Auch sie bleiben mit einer neuen Tabelle grün.
- **Zukunftstest** `npm run test:law-probe` (Teil von `npm run test:all`): rechnet die ganze Unit-Suite mit einer erfundenen, in sich stimmigen Tabelle (`tests/probe/law-probe.ts`) als `CURRENT_LAW`. Rot werden darf dabei nur das Live-Fixture. Schlägt etwas anderes an, mischt ein Test oder die App zwei Rechtsstände.
- **Live-Fixture** (`tests/live-regression.test.ts`, `tests/fixtures/live-regression.json`): friert die Ergebnisse der App über rund 500 Fälle bitgenau ein (Kennzahlen lesbar, Details als SHA-256). Es gehört zu einem Rechtsstand (`"law"`) und wird mit einer neuen Tabelle **bewusst** neu erzeugt; der Diff gehört in den Bericht.
- **Keine Schalter für Jahreswerte:** Neue Werte kommen in eine neue Tabelle, nicht hinter einen Schalter in `fixes.ts`. Schalter (`fixes.ts`, `docs/korrekturen.md`) gibt es nur für Änderungen an der **Rechnung**.

## Regeln für Änderungen am Code

1. **Neue Tabelle anlegen:** In `law.ts` die letzte Tabelle kopieren, als `LAW_<Jahr>` benennen, `id` und `year` setzen und am Ende von `LAWS` eintragen. Dann jeden Wert prüfen und ändern. Über der Tabelle die Quellen nennen wie bei `LAW_2026`, bei jedem geänderten oder übernommenen Wert einen kurzen Kommentar mit Fundstelle.
2. **Alte Tabellen nie ändern.** `LAW_2026` brauchen Golden und I1 für immer; jede andere alte Tabelle bleibt so, wie sie war. Einzige Ausnahme: ein neues Feld (siehe 4).
3. **Abgeleitete Werte mitziehen:** `abg.withSoli` = `rate · soliFactor`, `abg.soliFactor` = `1 + soli.rate`, `abg.divisor` = `1 / rate`. Sie stehen als Literale in der Tabelle, damit die Rechnung bitgleich bleibt; `tests/law.test.ts` prüft, dass sie exakt zu den Grundwerten passen. Ist eine Gleichheit in Gleitkomma nicht exakt erreichbar, nicht runden oder tricksen, sondern im Bericht als offen melden.
4. **Ändert sich die Form einer Regel** (andere Zahl von Tarifzonen, neue Zulagenart, ein Wert aus der Liste „Nicht in der Tabelle“ im Kopf von `law.ts`, etwa Teilfreistellung oder Teilkapitalauszahlung), ist das eine Änderung der Rechnung: Code in `combo.ts` anpassen, neues Tabellenfeld anlegen, in alten Tabellen mit dem Wert, der genau das bisherige Verhalten ergibt. Das zuerst umsetzen, solange `CURRENT_LAW` noch die alte Tabelle ist: Golden, I1 und das bestehende Fixture müssen dann unverändert grün sein. Erst danach die neue Tabelle anlegen. Außerdem in `docs/korrekturen.md` mit Rechtsquelle dokumentieren, gezielte Tests ergänzen und die Zuordnung in `tests/law.test.ts` (`ENGINE_VALUES` oder `OTHER_VALUES`) erweitern. Wenn unklar ist, wie das sauber geht: nicht improvisieren, sondern den Punkt im Bericht als offen melden.
5. **Standardwerte** der Eingaben (`DEFAULTS` in `src/lib/engine/inputs.ts`: `basis`, `kvRate`, `abgRate`) folgen der Tabelle von selbst (`kvRate` = ermäßigter Satz + Ø-Zusatzbeitrag + PV + Kinderlosenzuschlag, auf 6 Nachkommastellen gerundet). Die Link-Basis in `src/lib/link.ts` nie ändern, sonst werden geteilte Links falsch gelesen. Geteilte Links speichern nur Abweichungen von dieser Basis; ein alter Link behält also den Basiszins und KV-Satz, mit dem er erstellt wurde, und das ist gewollt. **Ausnahme Abgeltungsteuersatz:** Ein Link ohne `abgRate` meinte „heutiges Recht“, wird aber als 25 % gelesen. Ändert sich `abg.rate`, würden alte Links deshalb als hypothetische Steueränderung angezeigt. In diesem Fall nicht selbst entscheiden, sondern im Bericht als offen melden (Lösung: neue `LINK_VERSION`, alte Links ohne `abgRate` auf den neuen Satz abbilden).
6. **Texte:** Jahreswerte in Texten kommen aus `LT` (`src/lib/lawText.ts`) und ändern sich mit der neuen Tabelle von selbst. Neue Texte mit einem Jahreswert immer über `LT` schreiben, nie als Zahl; `tests/law.test.ts` („kein Jahreswert als fertiger Text“) schlägt sonst an. Braucht ein Text eine neue Angabe (etwa einen neuen Satz mit Fundstelle wie `basiszinsSource`), das Feld in der Tabelle und in `lawText` ergänzen. Trotzdem die Texte einmal lesen: Prosa, die einen Wert beschreibt, ohne ihn zu nennen („wächst mit der Inflation“, „höchstens“), kann durch eine Rechtsänderung falsch werden. Dazu nach der alten Jahreszahl suchen (`grep -rn "2026" src`); Kommentare im Code nennen Beispielwerte von 2026 und dürfen so bleiben. Keine Bezeichner umbenennen (`LAW_2026`, Dateinamen) und Rechtsstand-Angaben wie „BGBl. 2026“, „ab 2027“ oder `avdStart` nicht anfassen.
7. **`engine.ts` und `legacy/index.html`** nicht ändern. `engine.ts` liest seine Werte ebenfalls über `lawOf(opts)`, rechnet in Golden und I1 aber immer mit `LAW_2026`.

## Aufgaben

Je Aufgabe: Quelle, Felder der Tabelle (`LAW_<Jahr>` in `law.ts`), weitere Stellen.

### 1. Basiszins für die Vorabpauschale

- **Quelle:** BMF-Schreiben zum Basiszins nach § 18 Abs. 4 InvStG (erscheint Anfang Januar).
- **Tabelle:** `basiszins` (Anteil, z. B. 0,032) und `basiszinsSource` (Fundstelle für den Text, z. B. „BMF, 13.01.2026“).
- **Folgt von selbst:** Standardwert `basis`, Glossar `basiszins`, Hinweis in den Einstellungen.

### 2. Einkommensteuertarif und Solidaritätszuschlag

- **Quelle:** § 32a Abs. 1 EStG (Grundfreibetrag, Zonengrenzen, Koeffizienten), § 3 Abs. 3 und § 4 SolZG (Freigrenze, Satz, Milderungszone). Geplante Steuerreformen beachten.
- **Tabelle:** `tariff` (`gfb`, `z2End`, `z3End`, `z4End`, Koeffizienten `a2 b2`, `a3 b3 c3`, `r4 c4`, `r5 c5`), `soli` (`fg`, `rate`, `cap`). `tests/law.test.ts` prüft, dass der Tarif an den Zonengrenzen stetig ist (fängt Tippfehler in Koeffizienten).
- **Folgt von selbst:** Soli-Freigrenze bei Zusammenveranlagung (Splitting, keine eigene Zahl), Texte mit dem Grundfreibetrag und „Tarif <Jahr>“.

### 3. Kirchensteuer, Splitting, Pauschbeträge und Partner-Vertrag

- **Kirchensteuersätze:** 8 % in Bayern und Baden-Württemberg, 9 % sonst (Eingabe, keine Tabelle). Stellen: Auswahl in `Settings.svelte`, Glossar `kirchensteuer`.
- **Abgeltungsteuer** nach § 32d Abs. 1 EStG: Tabelle `abg` (`rate`, `withSoli`, `soliFactor`, `divisor`, siehe Regel 3). Prozentangaben in Texten und `DEFAULTS.abgRate` folgen von selbst. Ändert sich der Satz: das hypothetische Szenario „Abgeltungsteuer 30 % statt …“ (`taxAbg` in `analyze.ts`, fest 30 %) prüfen, ob es noch eine sinnvolle Erhöhung ist, und die Link-Frage aus Regel 5 im Bericht melden. Golden und I1 setzen `abgRate` selbst auf den Satz von 2026.
- **Sonderausgaben-Pauschbetrag** (§ 10c EStG): `saPausch` (Ehegatten das Doppelte).
- **Sparer-Pauschbetrag** (§ 20 Abs. 9 EStG): `spb` (zusammen veranlagt das Doppelte; auch Grenze der Eingabe `allowanceUsed`).
- **Partner-Vertrag** (`avdSpouse`): § 10a Abs. 3, § 79 S. 2, § 84 S. 3–4 EStG. Tabelle `avd.spouseMinOwn` (Mindestbeitrag), `avd.spouseRaise` (Erhöhung des Höchstbetrags), `avd.spouseGrundMax` (höchste Grundzulage).

### 4. Kranken- und Pflegeversicherung

- **Quelle:** Sozialversicherungsrechengrößen-Verordnung des Jahres, Bekanntmachung des durchschnittlichen Zusatzbeitrags (BMG), Beitragssätze (§§ 241, 243 SGB V, § 55 SGB XI).
- **Tabelle:** `kvBbg` (rechnet), `kvJaeg` (nur Glossartext), `kv` (`general`, `reduced`, `zusatzAvg`, `pv`, `pvChildless`; Hilfsrechnung und Standardwert).
- **Folgt von selbst:** Standardwert `kvRate`, Glossar `kvFreiwillig` und `kvRate`, Einstellungen (KV-Satz, BBG), Hilfsrechnung Bruttorente.

### 5. Altersvorsorgedepot

- **Quelle:** aktuelles Gesetz (Altersvorsorgereformgesetz, EStG, AltZertG) und BMF-Schreiben zur steuerlichen Förderung.
- **Tabelle:** `avd.subMax` (geförderte Eigenbeiträge), `avd.max` (Eigenbeiträge insgesamt), `avd.minOwn` (Mindesteigenbeitrag), Grundzulage `avd.grundRate1`/`grundTop1`/`grundRate2`/`grundTop2`, `avd.kid` (Kinderzulage), `avd.bonus` (Berufseinsteigerbonus). Die Suche rechnet den Förderhöchstbetrag je Monat daraus (`avdCap` in `search.ts`); liegt er nicht auf dem 10-€-Raster, wird er zusätzlich geprüft.
- **Nicht in der Tabelle** (Struktur, siehe Regel 4): Altersgrenze des Bonus (unter 25), Teilkapitalauszahlung 30 %, Umschichtungsanteile `AVD_STD_GLIDE` in `core.ts` (§ 1 Abs. 1c Nr. 5 AltZertG), Kostendeckel (§ 2a Abs. 2 AltZertG), Teilfreistellung (§ 20 InvStG: 30 % Aktienfonds, 0 % sicherer Teil). Trotzdem jedes Jahr gegen das Gesetz prüfen.
- **Folgt von selbst:** Texte in Glossar, `prosCons.ts`, `verdict.ts` (auch die Schwellen der Hinweise), Einstellungen, Kombi-Dialog. Der Hinweis zum Start (`avdStart` in `src/lib/site.ts`) schaltet sich ab 2027 selbst ab.

### 6. Ertragsanteil der Leibrente

- **Quelle:** § 22 Nr. 1 S. 3 Buchst. a Doppelbuchst. bb EStG (Tabelle, seit 2005 unverändert).
- **Tabelle:** `ertrag` (Alter bei Rentenbeginn → Prozent).

### 7. „Was die Zahlen nicht zeigen“

- **Stelle:** `src/lib/prosCons.ts`.
- **Prüfen:** jede Rechtsaussage gegen ihre Fundstelle: § 12 SGB II, § 93 EStG, AltZertG; bei der Betriebsrente § 1a BetrAVG, § 3 Nr. 63 EStG, SvEV, §§ 226, 248, 250 SGB V.

### 8. Hilfsrechnung Bruttorente

- **Stelle:** `src/lib/pensionTax.ts` liest `KV_GENERAL`, `PV_RATE`, `PV_CHILDLESS`, `ZUSATZ_AVG`, `WK_PAUSCH` und `SA_PAUSCH` aus `CURRENT_LAW` (Tabellenfelder `kv.*`, `wkPauschRente`, `saPausch`).
- **Prüfen:** die Tabelle der Besteuerungsanteile `taxSharePct` (§ 22 Nr. 1 S. 3 Buchst. a Doppelbuchst. aa EStG). Sie ist ein mehrjähriger gesetzlicher Fahrplan, kein Jahreswert, und steht deshalb im Code.

## Abschluss

1. `npx vitest run tests/law.test.ts`: Konsistenz der neuen Tabelle, Standardwerte, keine Jahreswerte außerhalb der Tabelle. Erst weiter, wenn grün.
2. **Fixture bewusst neu erzeugen und begründen:**
   - Vorher (mit der alten Tabelle als `CURRENT_LAW`, also vor dem Eintrag in `LAWS`) vollständige Ausgabe sichern: `LIVE_DUMP=<ordner-alt> npx vitest run tests/live-regression.test.ts`.
   - Nach dem Eintrag neu erzeugen: `UPDATE_LIVE_FIXTURE=1 npx vitest run tests/live-regression.test.ts`, dazu `LIVE_DUMP=<ordner-neu>` für die Fehlersuche.
   - `git diff tests/fixtures/live-regression.json` zeigt je Fall die geänderten Kennzahlen. Im Bericht nennen: wie viele Fälle sich geändert haben, für „golden: Standardwerte“ und zwei, drei typische Fälle (verheiratet, Kirchensteuer, KV, Kombi) alt/neu von `avgMonthly` und `cumHReal` je Produkt, und welcher neue Wert die Änderung erklärt. Eine Änderung, die sich nicht aus den belegten neuen Werten erklären lässt (zum Beispiel ein Fall, auf den keiner der geänderten Werte wirken kann), ist ein Fehler: anhalten und im Bericht melden, nicht das Fixture übernehmen.
3. `npm run test:all` ausführen. Alle Tests müssen grün sein.
   - `tests/golden.test.ts`, I1 in `tests/combo.test.ts` und `tests/law-propagation.test.ts` dürfen nie angepasst werden. Schlagen sie fehl, wurde eine alte Tabelle verändert oder die Option `law` geht irgendwo verloren: Ursache beheben, nicht den Test.
   - Unit-Tests: Außer dem Live-Fixture darf nichts rot werden (das prüft vorab auch `npm run test:law-probe`). Schlägt ein Regeltest an, der feste Beträge von 2026 erwartet, fehlt ihm die Bindung an 2026 (`tests/helpers/law-2026.ts`): die Zeile ergänzen, nicht die Zahl ändern.
   - **Erwartet** ändern können sich Browser-Tests (`e2e/`), die mit den Standardwerten der App rechnen, zum Beispiel der Link-Test mit `kvRate` in `e2e/app.spec.ts`. Den erwarteten Wert nur anpassen, wenn die Abweichung allein aus den belegten neuen Werten folgt; im Bericht je angepasstem Test alten und neuen Wert nennen.
4. In `src/lib/site.ts` das Prüfdatum (`updated`) anpassen und, falls sich das Gesetz geändert hat, den Rechtsstand in `lawState` und `lawStateShort` („Steuerwerte <Jahr>“ folgt von selbst aus der Tabelle).
5. Hat sich der Rechtsstand (das Gesetz in `lawState`) geändert, den Badge in `README.md` (`Rechtsstand-TT.MM.JJJJ`) und `README.en.md` (`Legal%20status-JJJJ--MM--TT`, Bindestriche verdoppelt) auf dasselbe Datum setzen. Neue Steuerwerte allein ändern den Badge nicht.
6. Committen, eine Nachricht je Aufgabe oder eine zusammenfassende Nachricht mit allen geänderten Werten und der Zahl der geänderten Fixture-Fälle.

## Bericht

Am Ende eine Tabelle ausgeben:

| Aufgabe | Tabellenfeld | alt | neu | Quelle | Status |
|---|---|---|---|---|---|

Status ist `geändert`, `unverändert` (geprüft, gleicher Wert) oder `offen` (noch nicht veröffentlicht oder unklar, mit Begründung).

Danach der Fixture-Diff (Schritt 2 des Abschlusses): Zahl der geänderten Fälle, Beispiele alt/neu, Begründung, und die angepassten Tests mit altem und neuem Wert.
