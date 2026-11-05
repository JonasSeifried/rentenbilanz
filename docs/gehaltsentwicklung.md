# Gehaltsentwicklung, 05.11.2026

Neu, nicht im Original. Bisher blieb das zu versteuernde Einkommen im Beruf (`incWork`) vom heutigen Alter bis zum
Rentenbeginn real gleich, abgesehen von einer Ausbildungsphase. Das Gehalt bestimmt den Grenzsteuersatz in der
Ansparphase. Davon hängen ab:

- die zusätzliche Steuererstattung des Altersvorsorgedepots über die Zulagen hinaus (Günstigerprüfung § 10a EStG,
  Veranlagung nach E4, [zulagen-veranlagung-2026-11.md](zulagen-veranlagung-2026-11.md)),
- die Kapitalertrags-Günstigerprüfung R3 in den Ansparjahren ([engine-rest-2026-11.md](engine-rest-2026-11.md)),
- im historischen Erbfallpfad ohne `heirTax` die Steuer bei Tod vor Rentenbeginn.

Einkommen im Alter (`incRet`), Einkommen der Erben (`incHeir`) und die Beiträge (Dynamik `dyn`) bleiben eigene Eingaben.
Die Beiträge steigen also nicht automatisch mit dem Gehalt.

## Modell

Eingaben `incPeak` (Zielgehalt, zu versteuern, heutiges Geld) und `incPeakAge` (Alter, ab dem es gilt).
`incPeak = −1` (Standard) schaltet die Gehaltsentwicklung aus. `incomeAt(p, age)` in `src/lib/engine/core.ts`:

- vor `studyEnd`: `incStudy` (Ausbildung, unverändert),
- ab Berufsbeginn `s = studyEnd` (nach `readParams` mindestens das heutige Alter) mit `incWork`, bis `incPeakAge`
  mit konstantem realem Wachstum `g = (incPeak / incWork)^(1 / (incPeakAge − s)) − 1`,
- ab `incPeakAge` bis Rentenbeginn `incPeak`.

Liegt `incPeakAge` nicht nach dem Berufsbeginn, gilt `incPeak` sofort. Sinkende Verläufe sind erlaubt (zum Beispiel
Teilzeit). Ist Start- oder Zielgehalt 0, wird linear übergeleitet, weil ein geometrischer Übergang dann nicht definiert ist.
Ein Zielalter nach Rentenbeginn wird nie erreicht; dann gilt bis zur Rente der Zwischenwert.

**Warum geometrisch:** Gehälter wachsen erfahrungsgemäß eher prozentual als um feste Beträge. Ob jemand früh schneller
aufsteigt und später flacher, ist individuell; das Modell nimmt den einfachsten nachvollziehbaren Verlauf mit zwei
Eingaben. Zwischen „heute“ und „Zielalter“ gibt es keine weiteren Stützstellen.

**Abschaltbar, bitgleich:** Ohne Gehaltsentwicklung liefert `incomeAt` exakt den Ausdruck des Originals
(`a0 + t < studyEnd ? incStudy : incWork`). Die Schlüssel sind keine Originaleingaben (`NEW_KEYS` in `inputs.ts`);
fehlen sie (Eingaben des Originals, alte Links, alte Speicherstände), ist die Gehaltsentwicklung aus. Weil es eine neue
Eingabe und keine Korrektur einer Originalformel ist, gibt es keinen Schalter in `fixes.ts` (wie bei `shift`).
Golden-, I1- und Fix-Tests bleiben unverändert grün.

**Steuerrecht:** Keine neue Rechtsregel. Der Tarif 2026 mit Inflationsfortschreibung, die AVD-Veranlagung (E4) und R3
werden mit dem Einkommen des jeweiligen Jahres gerechnet, wie bisher mit dem konstanten Wert.

## Szenariozeile

Unter „Was die Empfehlung kippen würde“ (nur außerhalb des Originalpfads, wie `shift`):

- ohne Gehaltsentwicklung: **„Gehalt steigt bis 45 real um 30 %“**, nur wenn der Berufsbeginn vor 45 liegt,
- mit Gehaltsentwicklung: **„Gehalt bleibt konstant“**.

Die 30 % sind eine **Annahme**, gespiegelt zur bestehenden Zeile „Gehalt 30 % niedriger“, kein statistischer
Durchschnittsverlauf. Ein amtlicher Beleg wurde gesucht: Die Verdiensterhebung des Statistischen Bundesamts
(GENESIS-Tabelle 62361-0031, Merkmal Alter) ist ohne Anmeldung nicht maschinell abrufbar, und die Tabellen auf destatis.de
zeigen Verdienste nur nach Wirtschaftszweig. Außerdem beschreibt ein Querschnitt nach Altersgruppen nicht den Verlauf
einer einzelnen Person (Kohorten- und Qualifikationseffekte). Darum keine scheinbar amtliche Zahl.

„Gehalt 30 % niedriger“ senkt mit Gehaltsentwicklung den ganzen Verlauf (Start- und Zielgehalt), ohne sie wie bisher nur
`incWork`.

## Wirkung in heutiger Kaufkraft

`cumHReal` (Summe netto bis 90), Einzelprodukte über `analyze`, alle Korrekturen. Default/DK mit KV/PV 21,1 % wie in den
übrigen Berichten; High wie in `tests/fixes.test.ts` (a0 30, 110.000 €, 500 € je Produkt, KV 21,7 %, KV-Brutto 45.000 €).
ETF und Versicherung ändern sich nicht: Ihre Besteuerung in der Ansparphase hängt im Modell nicht vom Gehalt ab
(in diesen Fällen deckt der Pauschbetrag die Vorabpauschale der Ansparphase, R3 erstattet nichts; bei höheren Depots kann R3 mit dem Gehalt variieren).

| Fall | ETF | AVD konstant | AVD +30 % bis 45 | AVD 60.000 € ab 45 |
|---|---:|---:|---:|---:|
| Default (38.000 €) | 153.289 | 174.856 | 178.845 | 182.307 |
| DK (KV 21,1 %) | 140.713 | 140.903 | 144.594 | 147.797 |
| DK (KV 21,7 %) | 140.356 | 139.932 | 143.616 | 146.811 |
| High (110.000 € → 143.000 €) | 330.246 | 310.722 | 309.473 | – |

- **Default:** AVD-Vorsprung vor dem ETF +21.567 € → +25.556 € (+30 % bis 45) bzw. +29.018 € (60.000 €).
  Erstattung real 5.347 € → 7.125 € bzw. 8.725 €.
- **DK:** Aus 190 € Vorsprung (21,1 %) werden 3.881 € bzw. 7.084 €; bei 21,7 % kippt die Rangfolge von −424 € auf
  +3.260 € bzw. +6.455 €. Der knappe DK-Abstand ist also stark gehaltsabhängig.
- **High:** Ein höheres Gehalt **senkt** hier die Erstattung (13.126 € → 12.484 €). 110.000 € liegen in der
  Milderungszone des Solidaritätszuschlags (§ 4 SolZG: 11,9 % der Einkommensteuer über der Freigrenze statt 5,5 %).
  2.340 € Sonderausgaben sparen bei 110.000 € 1.100 €, ab etwa 120.000 € nur noch 1.037 €. Kein Fehler, sondern der
  Tarifverlauf.

Beste Kombi (ETF/AVD/Versicherung, Standardwerte): bei 300 € 110/190 → 100/200 (324.372 → 327.990 €), bei 450 € und
1.000 € unverändert 120/330 bzw. 430/570 (+3.611 € bzw. +3.563 €). Die Robustheitsprüfung der Kombi zählt eine
Szenariozeile mehr; in den getesteten Standardfällen verschiebt die neue Zeile die beste Aufteilung nicht.

Diese Zahlen sind Modellvergleiche, keine Prognosen.

## Tests

`tests/salary-path.test.ts`: Verlauf (Ausbildung, geometrischer Übergang, konstant ab Zielalter, Randfälle),
Bitgleichheit bei Zielgehalt = Startgehalt und bei Zielalter vor Berufsbeginn (vier Fälle, fünf Aufteilungen),
unabhängige Jahresprüfung der AVD-Erstattung (ohne Inflation und Dynamik: Erstattung mit Verlauf = Summe der
Jahreserstattungen konstanter Läufe mit dem jeweiligen Einkommen), ETF/Versicherung unverändert, Szenariozeilen,
Link- und Speicher-Rundweg einschließlich alter Links ohne die neuen Schlüssel.
