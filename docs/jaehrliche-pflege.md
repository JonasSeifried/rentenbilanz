# Jährliche Pflege: Arbeitsauftrag

Diese Datei ist ein Arbeitsauftrag. Gib sie einer KI (oder arbeite sie selbst ab), am besten im Januar, wenn die neuen Jahreswerte veröffentlicht sind.

## Auftrag

Rentenbilanz rechnet mit Steuer- und Sozialversicherungswerten, die sich jedes Jahr ändern. Bring alle Werte unten auf den aktuellen Stand. Menschen planen ihre Altersvorsorge mit diesen Zahlen, deshalb gilt:

- **Nur Primärquellen:** Gesetzestext (gesetze-im-internet.de, Bundesgesetzblatt), BMF-Schreiben, Bekanntmachungen der Ministerien. Keine Blogs oder Vergleichsportale als alleinige Quelle.
- **Jeden Wert mit Quelle belegen:** Fundstelle (Paragraf, Absatz, Datum des Schreibens) und Link notieren.
- **Unklares nicht raten:** Wenn ein Wert noch nicht veröffentlicht oder die Rechtslage unklar ist, alten Wert lassen und den Punkt im Bericht als offen markieren.
- **Neutral bleiben:** Texte zeigen nur Zahlen und Regeln, keine Empfehlung.

## Regeln für Änderungen am Code

- Gerechnet wird nur in `src/lib/engine/combo.ts`. `src/lib/engine/engine.ts` und `legacy/index.html` sind Referenzen für die Golden-Tests und werden nicht geändert.
- Standardwerte ändern sich nur in `DEFAULTS` (`src/lib/engine/inputs.ts`). Das ist für die Golden-Tests unkritisch, weil sie beiden Seiten dieselben Eingaben geben. Die Link-Basis in `src/lib/link.ts` nie ändern, sonst werden geteilte Links falsch gelesen (wenn es doch sein muss: neue `LINK_VERSION`).
- Ändert sich ein Wert, der auch in Texten steht (Glossar, Annahmen, „Was die Zahlen nicht zeigen“), den Text mit anpassen. Im ganzen Repo nach dem alten Wert **und nach der alten Jahreszahl** suchen (`grep -rn "2026" src`), damit auch Angaben wie „Tarif 2026“ oder „Durchschnitt 2026“ nicht vergessen werden. Dabei keine Bezeichner umbenennen (etwa `tax2026`) und Rechtsstand-Angaben wie „BGBl. 2026“ oder `avdStart` nicht anfassen.
- Ändert sich die Rechnung (nicht nur ein Zahlenwert), die Abweichung in `docs/korrekturen.md` mit Rechtsquelle und Wirkung dokumentieren und gezielte Tests ergänzen.

### Achtung: Werte auf dem Referenzpfad

`tests/golden.test.ts` vergleicht zwei Rechnungen centgenau mit dem Original in `legacy/index.html`, wo die Werte 2026 fest stehen: `engine.ts` und `analyze()`, also `combo.ts` mit abgeschalteten Korrekturen (`NO_FIXES`). `tests/combo.test.ts` (I1) prüft außerdem `combo.ts` mit den historischen E-Korrekturen bitgenau gegen `engine.ts`. Jeder Wert, den eine dieser Rechnungen benutzt, ist ein **Referenzwert**:

| Wert | Stelle |
|---|---|
| Tarif und Soli: `tariff()`, `est()`, `soli()` mit `fg`, `tax()`, `tax2026()` | `core.ts` |
| Tarifkopie `incomeTaxNom` mit Grundfreibetrag `12348` | `combo.ts` |
| `KV_BBG`, `AVD_SUB_MAX`, `AVD_MAX`, `ERTRAG` | `core.ts` |
| Grundzulage (Sätze 0,5/0,25, Grenzen 360/1.800 €) in `grundOf` und `grund` | `combo.ts` |
| Kinderzulage `kind` (300 €), Bonus `bon` (200 €) | `combo.ts` |
| Sparer-Pauschbetrag für Alleinstehende 1.000 € (`SPB`, Sparer-Pauschbetrag der Erben `heirAllowance` und weitere Stellen, `grep -nw "1000" src/lib/engine/combo.ts`) | `combo.ts` |
| Abgeltungsteuer ohne Kirchensteuer `.26375` in `ABG` | `combo.ts` |

Für Referenzwerte gilt:

1. Den Wert 2026 **nicht überschreiben**. Er bleibt für den Referenzpfad.
2. Den neuen Wert als eigene Konstante oder Funktion anlegen (zum Beispiel `tariff2027()`, `KV_BBG_2027`) und in `combo.ts` nur verwenden, wenn der neue Schalter an ist.
3. Den Schalter in `src/lib/engine/fixes.ts` anlegen: neue `FixId`, Eintrag in `FIXES` und eine **neue, eindeutige `FindingId` mit R-Präfix** (zum Beispiel `R10`; nicht E, denn E-Korrekturen erwarten die Tests bitgleich in `engine.ts`). Er ist dann in `ALL_FIXES` an und in `NO_FIXES` aus.
4. Den Schalter an allen Stellen berücksichtigen, an denen `combo.ts` den Wert nutzt. Beim Tarif sind das alle Aufrufe von `tax()`, `tax2026()`, `est()` und `soli()` sowie die Kopie in `incomeTaxNom` (`grep -n "tax(\|tax2026(\|est(\|soli(\|12348" src/lib/engine/combo.ts`).
5. Den Schalter in `docs/korrekturen.md` dokumentieren und gezielte Tests in einer eigenen Testdatei ergänzen.

Nicht auf dem Referenzpfad liegen Werte, die das Original nicht kannte: Zusammenveranlagung (Sparer-Pauschbetrag 2.000 €, Pauschbetrag 72 €), Kirchensteuer (Sätze, Pauschbetrag 36 €), Partner-Vertrag (175 €) und alles in `pensionTax.ts`. Sie dürfen direkt geändert werden.

Wenn unklar ist, ob ein Wert auf dem Referenzpfad liegt: ändern und `npx vitest run tests/golden.test.ts tests/combo.test.ts` laufen lassen. Schlägt einer fehl, die Änderung zurücknehmen und den Wert wie oben hinter den Schalter legen. Wenn unklar ist, wie das sauber geht: nicht improvisieren, sondern den Punkt im Bericht als offen melden.

## Aufgaben

### 1. Basiszins für die Vorabpauschale

- **Quelle:** BMF-Schreiben zum Basiszins nach § 18 Abs. 4 InvStG (erscheint Anfang Januar).
- **Stellen:** Standardwert `basis` in `DEFAULTS` (`src/lib/engine/inputs.ts`), Glossar-Eintrag `basiszins` in `src/lib/glossary.ts`, Text unter „Weitere Einstellungen“ (`src/lib/panels/Settings.svelte`).

### 2. Einkommensteuertarif und Solidaritätszuschlag

- **Quelle:** § 32a EStG (Grundfreibetrag, Tarifzonen), § 3 und § 4 SolZG (Freigrenze). Geplante Steuerreformen beachten.
- **Stellen:** Die Tarifkoeffizienten stehen zweimal: in `tariff()` in `src/lib/engine/core.ts` (genutzt von `est()`, `tax()` und `tax2026()`) und als eigene Kopie in `incomeTaxNom` in `combo.ts`, dort auch der Grundfreibetrag (`grep -n "12348\|12.348"`). Die Soli-Freigrenze ist `fg` in `soli()` (`core.ts`). Alles davon sind Referenzwerte: nur über einen Schalter ändern, siehe „Achtung“ oben.

### 3. Kirchensteuer, Splitting, Pauschbeträge und Partner-Vertrag

- **Kirchensteuersätze:** 8 % in Bayern und Baden-Württemberg, 9 % sonst. Stellen: Auswahl in `Settings.svelte`, Glossar `kirchensteuer`.
- **Abgeltungsteuer mit Kirchensteuer** nach § 32d Abs. 1 EStG: `ABG` in `combo.ts` (der Wert ohne Kirchensteuer, `.26375`, ist ein Referenzwert), Prozentangaben im Glossar `abgeltung` und in den Annahmen.
- **Sonderausgaben-Pauschbetrag** 36 € / 72 € (§ 10c EStG).
- **Soli-Freigrenze bei Zusammenveranlagung** (derzeit 40.700 €): keine eigene Konstante. Sie ergibt sich in `assess` (`combo.ts`) als Splitting über `soli()` mit der Einzel-Freigrenze `fg`. Nur der Kommentar dort nennt den Betrag, er muss mitgezogen werden.
- **Sparer-Pauschbetrag** (derzeit 1.000 €, bei Zusammenveranlagung 2.000 €): `SPB` und weitere Stellen in `combo.ts`. Der Wert für Alleinstehende ist ein Referenzwert.
- **Partner-Vertrag** (`avdSpouse`): § 10a Abs. 3, § 79 S. 2, § 84 S. 3–4 EStG (derzeit 175 €), Mindestbeitrag 120 €, Höchstbetrag plus 120 €. Stellen: `spouseAvd` und der AVD-Block in `combo.ts`, Glossar `partnerVertrag`.

### 4. Kranken- und Pflegeversicherung

- **Quelle:** Sozialversicherungsrechengrößen-Verordnung des Jahres, Bekanntmachung des durchschnittlichen Zusatzbeitrags (BMG), Beitragssatz der Pflegeversicherung (§ 55 SGB XI).
- **Stellen:** Beitragsbemessungsgrenze `KV_BBG` in `src/lib/engine/core.ts` (Referenzwert, nur über einen Schalter ändern); Standardwert `kvRate` in `DEFAULTS`; Glossar `kvFreiwillig` und `kvRate`. Die Versicherungspflichtgrenze steht nur als Text im Glossar (`src/lib/glossary.ts`, nach dem Betrag suchen).

### 5. Altersvorsorgedepot

- **Quelle:** aktuelles Gesetz (Altersvorsorgereformgesetz, EStG, AltZertG) und BMF-Schreiben zur steuerlichen Förderung.
- **Prüfen:** Zulagen, Höchstbeträge, Bonus und Auszahlregeln.
- **Stellen:** `AVD_SUB_MAX` (geförderte Eigenbeiträge) und `AVD_MAX` (Eigenbeiträge insgesamt) in `core.ts`. Zulagen und Bonus stehen als Zahlen in `combo.ts`: Grundzulage zweimal (`grundOf` und `grund` im AVD-Block, Sätze 0,5/0,25 und Grenzen 360/1.800 €), Kinderzulage (`kind`, 300 €), Bonus (`bon`, 200 € unter 25). Das alles sind Referenzwerte, siehe „Achtung“ oben. Die mittelbare Zulage des Partners (175 €) ist keiner. Nach den alten Beträgen auch in Glossar und Texten suchen.
- **Standarddepot:** Umschichtungsanteile `AVD_STD_GLIDE` in `core.ts` (§ 1 Abs. 1c Nr. 5 AltZertG; gelten mit dem Schalter „Umschichtung vor Rentenbeginn“ für alle Produkte) und Kostendeckel (§ 2a Abs. 2 AltZertG). Abgleichen mit dem Glossar (`standarddepot`, `umschichtung`, `avdKosten`) und `src/lib/prosCons.ts`.
- **Teilfreistellung** (§ 20 InvStG: 30 % für Aktienfonds, 0 % für den sicheren Teil) in `combo.ts` prüfen.
- Der Hinweis zum Start (`avdStart` in `src/lib/site.ts`) schaltet sich ab 2027 selbst ab, dafür ist nichts zu tun.

### 6. „Was die Zahlen nicht zeigen“

- **Stelle:** `src/lib/prosCons.ts`.
- **Prüfen:** jede Rechtsaussage gegen ihre Fundstelle: § 12 SGB II, § 93 EStG, AltZertG; bei der Betriebsrente § 1a BetrAVG, § 3 Nr. 63 EStG, SvEV, §§ 226, 248, 250 SGB V.

### 7. Hilfsrechnung Bruttorente

- **Stelle:** `src/lib/pensionTax.ts`.
- **Prüfen:** allgemeiner KV-Beitragssatz (`KV_GENERAL`, § 241 SGB V), Pflegeversicherungssatz (`PV_RATE`, Zuschlag für Kinderlose `PV_CHILDLESS`), durchschnittlicher Zusatzbeitrag (`ZUSATZ_AVG`), Werbungskosten-Pauschbetrag für Renten (`WK_PAUSCH`, § 9a S. 1 Nr. 3 EStG), Sonderausgaben-Pauschbetrag (`SA_PAUSCH`, § 10c EStG), Tabelle der Besteuerungsanteile (§ 22 Nr. 1 S. 3 Buchst. a Doppelbuchst. aa EStG).

## Abschluss

1. `npm run test:all` ausführen. Alle Tests müssen grün sein.
   - `tests/golden.test.ts` und I1 in `tests/combo.test.ts` dürfen nie angepasst werden. Schlagen sie fehl, wurde ein Referenzwert überschrieben: die Änderung zurücknehmen und wie unter „Achtung“ hinter einen Schalter legen.
   - **Erwartet** ändern sich Tests, die die aktuelle Rechnung mit allen Korrekturen festhalten, vor allem die Snapshots „Snapshots mit ALL_FIXES“ in `tests/fixes.test.ts` und feste Beträge in anderen Testdateien. Solche erwarteten Werte nur anpassen, wenn die Abweichung allein aus den belegten neuen Werten folgt. Im Bericht je angepasstem Test alten und neuen Wert nennen.
2. In `src/lib/site.ts` Rechtsstand (`lawState`, `lawStateShort`) und Prüfdatum (`updated`) anpassen.
3. Hat sich der Rechtsstand (das Gesetz in `lawState`) geändert, den Badge in `README.md` (`Rechtsstand-TT.MM.JJJJ`) und `README.en.md` (`Legal%20status-JJJJ--MM--TT`, Bindestriche verdoppelt) auf dasselbe Datum setzen. Neue Steuerwerte allein ändern den Badge nicht.
4. Committen, eine Nachricht je Aufgabe oder eine zusammenfassende Nachricht mit allen geänderten Werten.

## Bericht

Am Ende eine Tabelle ausgeben:

| Aufgabe | Wert | alt | neu | Quelle | Status |
|---|---|---|---|---|---|

Status ist `geändert`, `unverändert` (geprüft, gleicher Wert) oder `offen` (noch nicht veröffentlicht oder unklar, mit Begründung).
