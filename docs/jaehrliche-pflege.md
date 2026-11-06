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
- Ändert sich ein Wert, der auch in Texten steht (Glossar, Annahmen, „Was die Zahlen nicht zeigen“), den Text mit anpassen. Im ganzen Repo nach dem alten Wert suchen (`grep`), damit keine Stelle vergessen wird.
- Ändert sich die Rechnung (nicht nur ein Zahlenwert), die Abweichung in `docs/korrekturen.md` mit Rechtsquelle und Wirkung dokumentieren und gezielte Tests ergänzen.

## Aufgaben

### 1. Basiszins für die Vorabpauschale

- **Quelle:** BMF-Schreiben zum Basiszins nach § 18 Abs. 4 InvStG (erscheint Anfang Januar).
- **Stellen:** Standardwert `basis` in `DEFAULTS` (`src/lib/engine/inputs.ts`), Glossar-Eintrag `basiszins` in `src/lib/glossary.ts`, Text unter „Weitere Einstellungen“ (`src/lib/panels/Settings.svelte`).

### 2. Einkommensteuertarif und Solidaritätszuschlag

- **Quelle:** § 32a EStG (Grundfreibetrag, Tarifzonen), § 3 und § 4 SolZG (Freigrenze). Geplante Steuerreformen beachten.
- **Stellen:** `est()` und `soli()` in `src/lib/engine/core.ts`; die getrennte nominale Einkommensteuer für die Veranlagung und das Steuerprofil (`incomeTaxNom` und `assess` in `combo.ts`). Alle Stellen gemeinsam pflegen, sie müssen zueinander passen.

### 3. Kirchensteuer, Splitting, Pauschbeträge und Partner-Vertrag

- **Kirchensteuersätze:** 8 % in Bayern und Baden-Württemberg, 9 % sonst. Stellen: Auswahl in `Settings.svelte`, Glossar `kirchensteuer`.
- **Abgeltungsteuer mit Kirchensteuer** nach § 32d Abs. 1 EStG: `ABG` in `combo.ts`, Prozentangaben im Glossar `abgeltung` und in den Annahmen.
- **Sonderausgaben-Pauschbetrag** 36 € / 72 € (§ 10c EStG).
- **Soli-Freigrenze bei Zusammenveranlagung** (derzeit 40.700 €): `assess` in `combo.ts`.
- **Sparer-Pauschbetrag** bei Zusammenveranlagung (derzeit 2.000 €): `SPB`.
- **Partner-Vertrag** (`avdSpouse`): § 10a Abs. 3, § 79 S. 2, § 84 S. 3–4 EStG (derzeit 175 €), Mindestbeitrag 120 €, Höchstbetrag plus 120 €. Stellen: `spouseAvd` und der AVD-Block in `combo.ts`, Glossar `partnerVertrag`.

### 4. Kranken- und Pflegeversicherung

- **Quelle:** Sozialversicherungsrechengrößen-Verordnung des Jahres, Bekanntmachung des durchschnittlichen Zusatzbeitrags (BMG), Beitragssatz der Pflegeversicherung (§ 55 SGB XI).
- **Stellen:** Beitragsbemessungsgrenze `KV_BBG` in `src/lib/engine/core.ts`; Versicherungspflichtgrenze; Standardwert `kvRate` in `DEFAULTS`; Glossar `kvFreiwillig` und `kvRate`.

### 5. Altersvorsorgedepot

- **Quelle:** aktuelles Gesetz (Altersvorsorgereformgesetz, EStG, AltZertG) und BMF-Schreiben zur steuerlichen Förderung.
- **Prüfen:** Zulagen, Höchstbeträge, Bonus und Auszahlregeln.
- **Standarddepot:** Umschichtungsanteile `AVD_STD_GLIDE` in `core.ts` (§ 1 Abs. 1c Nr. 5 AltZertG; gelten mit dem Schalter „Umschichtung vor Rentenbeginn“ für alle Produkte) und Kostendeckel (§ 2a Abs. 2 AltZertG). Abgleichen mit dem Glossar (`standarddepot`, `umschichtung`, `avdKosten`) und `src/lib/prosCons.ts`.
- **Teilfreistellung** (§ 20 InvStG: 30 % für Aktienfonds, 0 % für den sicheren Teil) in `combo.ts` prüfen.
- Der Hinweis zum Start (`avdStart` in `src/lib/site.ts`) schaltet sich ab 2027 selbst ab, dafür ist nichts zu tun.

### 6. „Was die Zahlen nicht zeigen“

- **Stelle:** `src/lib/prosCons.ts`.
- **Prüfen:** jede Rechtsaussage gegen ihre Fundstelle: § 12 SGB II, § 93 EStG, AltZertG; bei der Betriebsrente § 1a BetrAVG, § 3 Nr. 63 EStG, SvEV, §§ 226, 248, 250 SGB V.

### 7. Hilfsrechnung Bruttorente

- **Stelle:** `src/lib/pensionTax.ts`.
- **Prüfen:** Pflegeversicherungssatz, durchschnittlicher Zusatzbeitrag (`ZUSATZ_AVG`), Tabelle der Besteuerungsanteile (§ 22 Nr. 1 S. 3 Buchst. a Doppelbuchst. aa EStG).

## Abschluss

1. `npm run test:all` ausführen. Alle Tests müssen grün sein.
   - Die Golden-Tests (`tests/golden.test.ts`) vergleichen mit `legacy/index.html` bei abgeschalteten Korrekturen. Schlagen sie nach einer Wertänderung fehl, nicht die Referenz ändern, sondern prüfen, ob der neue Wert über den abschaltbaren Pfad in `combo.ts` laufen muss.
   - `tests/fixes.test.ts` und `tests/combo*.test.ts` prüfen die aktuelle Rechnung. Erwartete Werte nur anpassen, wenn die Änderung durch eine Quelle belegt ist.
2. In `src/lib/site.ts` Rechtsstand (`lawState`, `lawStateShort`) und Prüfdatum (`updated`) anpassen.
3. Den Rechtsstand-Badge in `README.md` und `README.en.md` anpassen, falls sich der Rechtsstand geändert hat.
4. Committen, eine Nachricht je Aufgabe oder eine zusammenfassende Nachricht mit allen geänderten Werten.

## Bericht

Am Ende eine Tabelle ausgeben:

| Aufgabe | Wert | alt | neu | Quelle | Status |
|---|---|---|---|---|---|

Status ist `geändert`, `unverändert` (geprüft, gleicher Wert) oder `offen` (noch nicht veröffentlicht oder unklar, mit Begründung).
