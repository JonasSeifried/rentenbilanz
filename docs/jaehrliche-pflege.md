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
- Standardwerte ändern sich nur in `DEFAULTS` (`src/lib/engine/inputs.ts`). Die Link-Basis in `src/lib/link.ts` nie ändern, sonst werden geteilte Links falsch gelesen (wenn es doch sein muss: neue `LINK_VERSION`).
- Ändert sich ein Wert, der auch in Texten steht (Glossar, Annahmen, „Was die Zahlen nicht zeigen“), den Text mit anpassen. Im ganzen Repo nach dem alten Wert **und nach der alten Jahreszahl** suchen (`grep -rn "2026" src`), damit auch Angaben wie „Tarif 2026“ oder „Durchschnitt 2026“ nicht vergessen werden.
- Ändert sich die Rechnung (nicht nur ein Zahlenwert), die Abweichung in `docs/korrekturen.md` mit Rechtsquelle und Wirkung dokumentieren und gezielte Tests ergänzen.

### Achtung: Werte, die auch die Referenz nutzt

Einige Werte in `src/lib/engine/core.ts` gehören nicht nur der aktuellen Rechnung, sondern auch der Referenz: `engine.ts` importiert `tax` (also `tariff()`, `est()`, `soli()`), `KV_BBG`, `AVD_SUB_MAX`, `AVD_MAX` und `ERTRAG`, und `tests/golden.test.ts` vergleicht `engine.ts` und `analyze()` mit abgeschalteten Korrekturen (`NO_FIXES`) centgenau mit `legacy/index.html`, wo die Werte 2026 fest stehen.

Deshalb gilt für diese Werte:

1. Die Werte 2026 in `core.ts` **nicht überschreiben**. Sie bleiben die Referenz.
2. Die neuen Werte als eigene Konstanten oder Funktionen anlegen (zum Beispiel `tariff2027()`, `KV_BBG_2027`) und nur in `combo.ts` verwenden.
3. Den Wechsel hinter einen neuen Schalter in `src/lib/engine/fixes.ts` legen (`FixId` und Eintrag in `FIXES`). Er ist in `ALL_FIXES` an und in `NO_FIXES` aus, so bleiben die Golden-Tests unverändert grün.
4. Den Schalter in `docs/korrekturen.md` dokumentieren und gezielte Tests ergänzen.

Wenn unklar ist, wie ein Wert sauber hinter den Schalter kommt: nicht improvisieren, sondern den Punkt im Bericht als offen melden.

## Aufgaben

### 1. Basiszins für die Vorabpauschale

- **Quelle:** BMF-Schreiben zum Basiszins nach § 18 Abs. 4 InvStG (erscheint Anfang Januar).
- **Stellen:** Standardwert `basis` in `DEFAULTS` (`src/lib/engine/inputs.ts`), Glossar-Eintrag `basiszins` in `src/lib/glossary.ts`, Text unter „Weitere Einstellungen“ (`src/lib/panels/Settings.svelte`).

### 2. Einkommensteuertarif und Solidaritätszuschlag

- **Quelle:** § 32a EStG (Grundfreibetrag, Tarifzonen), § 3 und § 4 SolZG (Freigrenze). Geplante Steuerreformen beachten.
- **Stellen:** Die Tarifkoeffizienten stehen zweimal: in `tariff()` in `src/lib/engine/core.ts` (genutzt von `est()`, `tax()` und `tax2026()`) und als eigene Kopie in `incomeTaxNom` in `combo.ts`, dort auch der Grundfreibetrag `12348` an zwei Stellen. Die Soli-Freigrenze ist `fg` in `soli()` (`core.ts`). `assess` in `combo.ts` nutzt sie für die Veranlagung. Alle Stellen gemeinsam pflegen. Die Werte in `core.ts` sind Referenzwerte, siehe „Achtung“ oben.

### 3. Kirchensteuer, Splitting, Pauschbeträge und Partner-Vertrag

- **Kirchensteuersätze:** 8 % in Bayern und Baden-Württemberg, 9 % sonst. Stellen: Auswahl in `Settings.svelte`, Glossar `kirchensteuer`.
- **Abgeltungsteuer mit Kirchensteuer** nach § 32d Abs. 1 EStG: `ABG` in `combo.ts`, Prozentangaben im Glossar `abgeltung` und in den Annahmen.
- **Sonderausgaben-Pauschbetrag** 36 € / 72 € (§ 10c EStG).
- **Soli-Freigrenze bei Zusammenveranlagung** (derzeit 40.700 €): keine eigene Konstante. Sie ergibt sich in `assess` (`combo.ts`) als Splitting über `soli()` mit der Einzel-Freigrenze `fg`. Nur der Kommentar dort nennt den Betrag, er muss mitgezogen werden.
- **Sparer-Pauschbetrag** bei Zusammenveranlagung (derzeit 2.000 €): `SPB`.
- **Partner-Vertrag** (`avdSpouse`): § 10a Abs. 3, § 79 S. 2, § 84 S. 3–4 EStG (derzeit 175 €), Mindestbeitrag 120 €, Höchstbetrag plus 120 €. Stellen: `spouseAvd` und der AVD-Block in `combo.ts`, Glossar `partnerVertrag`.

### 4. Kranken- und Pflegeversicherung

- **Quelle:** Sozialversicherungsrechengrößen-Verordnung des Jahres, Bekanntmachung des durchschnittlichen Zusatzbeitrags (BMG), Beitragssatz der Pflegeversicherung (§ 55 SGB XI).
- **Stellen:** Beitragsbemessungsgrenze `KV_BBG` in `src/lib/engine/core.ts` (Referenzwert, siehe „Achtung“ oben); Standardwert `kvRate` in `DEFAULTS`; Glossar `kvFreiwillig` und `kvRate`. Die Versicherungspflichtgrenze steht nur als Text im Glossar (`src/lib/glossary.ts`, nach dem Betrag suchen).

### 5. Altersvorsorgedepot

- **Quelle:** aktuelles Gesetz (Altersvorsorgereformgesetz, EStG, AltZertG) und BMF-Schreiben zur steuerlichen Förderung.
- **Prüfen:** Zulagen, Höchstbeträge, Bonus und Auszahlregeln.
- **Stellen:** `AVD_SUB_MAX` (geförderte Eigenbeiträge) und `AVD_MAX` (Eigenbeiträge insgesamt) in `core.ts` sind Referenzwerte, siehe „Achtung“ oben. Zulagen und Bonus stehen als Zahlen in `combo.ts`: Grundzulage zweimal (`grundOf` und `grund` im AVD-Block, Sätze 0,5/0,25 und Grenzen 360/1.800 €), Kinderzulage (`kind`, 300 €), Bonus (`bon`, 200 € unter 25), mittelbare Zulage des Partners (175 €). Nach den alten Beträgen suchen, auch in Glossar und Texten.
- **Standarddepot:** Umschichtungsanteile `AVD_STD_GLIDE` in `core.ts` (§ 1 Abs. 1c Nr. 5 AltZertG; gelten mit dem Schalter „Umschichtung vor Rentenbeginn“ für alle Produkte) und Kostendeckel (§ 2a Abs. 2 AltZertG). Abgleichen mit dem Glossar (`standarddepot`, `umschichtung`, `avdKosten`) und `src/lib/prosCons.ts`.
- **Teilfreistellung** (§ 20 InvStG: 30 % für Aktienfonds, 0 % für den sicheren Teil) in `combo.ts` prüfen.
- Der Hinweis zum Start (`avdStart` in `src/lib/site.ts`) schaltet sich ab 2027 selbst ab, dafür ist nichts zu tun.

### 6. „Was die Zahlen nicht zeigen“

- **Stelle:** `src/lib/prosCons.ts`.
- **Prüfen:** jede Rechtsaussage gegen ihre Fundstelle: § 12 SGB II, § 93 EStG, AltZertG; bei der Betriebsrente § 1a BetrAVG, § 3 Nr. 63 EStG, SvEV, §§ 226, 248, 250 SGB V.

### 7. Hilfsrechnung Bruttorente

- **Stelle:** `src/lib/pensionTax.ts`.
- **Prüfen:** Pflegeversicherungssatz (`PV_RATE`, Zuschlag für Kinderlose `PV_CHILDLESS`), durchschnittlicher Zusatzbeitrag (`ZUSATZ_AVG`), Tabelle der Besteuerungsanteile (§ 22 Nr. 1 S. 3 Buchst. a Doppelbuchst. aa EStG).

## Abschluss

1. `npm run test:all` ausführen. Alle Tests müssen grün sein.
   - Die Golden-Tests (`tests/golden.test.ts`) vergleichen mit `legacy/index.html` bei abgeschalteten Korrekturen. Schlagen sie nach einer Wertänderung fehl, wurde ein Referenzwert überschrieben: die Änderung zurücknehmen und wie unter „Achtung“ hinter einen Schalter legen. Die Referenz und die Golden-Tests nie anpassen.
   - `tests/fixes.test.ts` und `tests/combo*.test.ts` prüfen die aktuelle Rechnung. Erwartete Werte nur anpassen, wenn die Änderung durch eine Quelle belegt ist.
2. In `src/lib/site.ts` Rechtsstand (`lawState`, `lawStateShort`) und Prüfdatum (`updated`) anpassen.
3. Den Rechtsstand-Badge in `README.md` und `README.en.md` an `lawStateShort` angleichen.
4. Committen, eine Nachricht je Aufgabe oder eine zusammenfassende Nachricht mit allen geänderten Werten.

## Bericht

Am Ende eine Tabelle ausgeben:

| Aufgabe | Wert | alt | neu | Quelle | Status |
|---|---|---|---|---|---|

Status ist `geändert`, `unverändert` (geprüft, gleicher Wert) oder `offen` (noch nicht veröffentlicht oder unklar, mit Begründung).
