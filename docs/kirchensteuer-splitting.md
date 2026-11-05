# Steuerprofil: Kirchensteuer und Zusammenveranlagung, 05.11.2026

Neue Eingaben (keine Korrektur des Originals, daher kein Fix-Schalter): `kist` (Kirchensteuersatz in %, 0 = keine),
`married` (zusammen veranlagt), `incSpouse` / `incSpouseRet` (zu versteuerndes Einkommen des Partners vor bzw. ab dem
eigenen Rentenbeginn, heutiges Geld). Standard `kist = 0`, `married = false`: Die Rechnung ist dann bitgleich zur
bisherigen (`fam = false` in `combo.ts` wählt jeden bisherigen Ausdruck; Golden-Test, I1 und die Default/DK/High-Werte
unverändert). Rechnung nur in `src/lib/engine/combo.ts` (`assess`, `taxNom`, `ABG`, `SPB`), Parameter in `core.ts`.

## Primärquellen (abgerufen am 05.11.2026)

Gesetzestexte direkt von gesetze-im-internet.de, AVRG als amtliches PDF (BGBl. 2026 I Nr. 156, MD5
`c0120027357f7d9ccfe433a59979c9f9`, identisch mit dem im E4-Nachtrag gelesenen Stand).

| Regel | Fundstelle | Umsetzung |
|---|---|---|
| Bemessung der Kirchensteuer: ESt „abweichend von § 2 Abs. 6“ nur mit Kinderfreibeträgen in allen Fällen; keine Ausnahme für § 10a | [§ 51a Abs. 2 S. 1–3 EStG](https://www.gesetze-im-internet.de/estg/__51a.html), Abs. 6 (Landesrecht) | KiSt = k × (tarifliche ESt + hinzugerechnete Zulage), wie beim Soli (E4) |
| Abgeltungsteuer mit Kirchensteuer: 25 % ermäßigt um 25 % der KiSt, ESt = (e − 4q)/(4 + k) | [§ 32d Abs. 1 S. 3–5 EStG](https://www.gesetze-im-internet.de/estg/__32d.html) | Satz einschließlich Soli und KiSt `(1,055 + k)/(4 + k)`: 9 % → 27,9951 %, 8 % → 27,8186 %; gilt für Vorabpauschale, Entnahmen, Umschichtung, Steuerverkauf (R2), Kapitalauszahlung < 12 Jahre, Erbfall |
| KiSt auf Kapitalertragsteuer als Zuschlag | § 51a Abs. 2b–2d EStG | wie oben |
| Günstigerprüfung Kapitalerträge „einschließlich Zuschlagsteuern“; bei Ehegatten nur für alle Kapitalerträge beider | § 32d Abs. 6 S. 1, 3, 4 EStG | R3 vergleicht Abgeltungsteuer inkl. KiSt mit dem Tarif inkl. KiSt; Partner ohne Kapitalerträge |
| Gezahlte KiSt ist Sonderausgabe, außer KiSt auf Kapitalertragsteuer / § 32d-Tarif | [§ 10 Abs. 1 Nr. 4 EStG](https://www.gesetze-im-internet.de/estg/__10.html) | Abzug nur der KiSt der Veranlagung, nicht der Abgeltung-KiSt |
| Sonderausgaben-Pauschbetrag 36 €, Ehegatten 72 € (deckt u. a. Nr. 4) | [§ 10c EStG](https://www.gesetze-im-internet.de/estg/__10c.html) | Abzug nur über 36/72 € (keine weiteren Sonderausgaben dieser Art angenommen) |
| Splitting: 2 × Tarif der Hälfte des gemeinsamen zvE | [§ 32a Abs. 5 EStG](https://www.gesetze-im-internet.de/estg/__32a.html), § 26b | eigener Haushalt; zvE und Steuer der Hälfte auf volle Euro abgerundet (R8) |
| Soli-Freigrenze 40.700 € bei § 32a Abs. 5/6, sonst 20.350 €; Bemessung wie § 51a | [§ 3 Abs. 2, 3 SolZG](https://www.gesetze-im-internet.de/solzg_1995/__3.html), [§ 4](https://www.gesetze-im-internet.de/solzg_1995/__4.html) | `2 × soli(E/2)` = min(5,5 % E; 11,9 % (E − 40.700)) |
| Gemeinsamer Sparer-Pauschbetrag 2.000 €, Übertrag auf den anderen Ehegatten | [§ 20 Abs. 9 S. 2–3 EStG](https://www.gesetze-im-internet.de/estg/__20.html) | 2.000 € für die verglichenen Produkte (Partner ohne eigene Kapitalerträge) |
| § 10a-Abzug jedem Ehegatten gesondert; mittelbar Berechtigter: Beiträge und Zulagen beider beim unmittelbar Berechtigten, Höchstbetrag + 120 € (AVRG); beide unmittelbar: Zulage beider in der Günstigerprüfung | [§ 10a Abs. 3 EStG](https://www.gesetze-im-internet.de/estg/__10a.html), AVRG Art. 2 Nr. 1 c | Partner ohne eigenen geförderten Vertrag ⇒ nur die eigene Zulage; S. 2–5 nicht gerechnet (offen) |
| Mittelbare Zulageberechtigung bleibt: eigener Vertrag des Partners, ≥ 120 € (bisher 60 €) eigener Beitrag, Grundzulage höchstens 175 €, bemessen an den geförderten Beiträgen des unmittelbar Berechtigten | [§ 79 S. 2 EStG](https://www.gesetze-im-internet.de/estg/__79.html); AVRG Art. 2 Nr. 4 a, Nr. 7 (§ 84 S. 3–4 n. F.), Nr. 8 (§ 85 S. 2 n. F.) | nicht gerechnet: wäre ein zweiter Vertrag mit eigenem Beitrag des Partners (offen) |
| Günstigerprüfung nach tariflicher ESt | BFH X R 11/21 (siehe E4) | Vergleich `b.est − a.est > z` mit Splitting-ESt; KiSt-Abzug jeweils im eigenen Fall |

Kirchensteuersätze: 8 % in Bayern und Baden-Württemberg, 9 % in den übrigen Ländern (Kirchensteuerbeschlüsse nach
Landes-KiStG, § 51a Abs. 6 EStG). Andere Werte zwischen 0 und 10 % sind über Link/Speicher möglich.

## Rechenmodell

`assess(x, t, own, ded, z)` (nominal, Jahr t):

1. zvE = x + (eigener Haushalt und verheiratet: Partner-zvE · I(t)) − ded.
2. ESt E(v) = Tarif (Grundtarif) bzw. 2 · Tarif(v/2) (Splitting), mit R8-Rundung und indexiertem Tarif wie bisher.
3. KiSt-Abzug: E = E(zvE − max(0, KiSt − 36/72 €)), KiSt = k · (E + z), Fixpunkt (bis E stehen bleibt, höchstens
   10 Schritte; Kontraktion k · Grenzsteuersatz < 5 %). Das ist der Beharrungszustand „im Jahr gezahlte KiSt ≈ KiSt
   des Jahres“; tatsächlich wirken Vorauszahlungen, Erstattungen und Nachzahlungen mit Versatz.
4. Gesamt = E + z + Soli(E + z) + KiSt.

Alle bisherigen Differenzrechnungen (Mehrsteuer auf Auszahlungen, R1-KV-Abzug, R3, AVD-Teilauszahlung, latente Steuer)
laufen über `taxNom` und damit über `assess`. Das eingegebene zvE gilt **vor** dem Kirchensteuer-Abzug.
Wegen der Euro-Abrundung pendelt der Fixpunkt in rund 3,6 % der Einkommen zwischen zwei um 1 € verschiedenen Werten;
dann gilt deterministisch der höhere. AVD-Günstigerprüfung: Beide Varianten nutzen dieselbe im Jahr gezahlte
Kirchensteuer, die des Abzugsfalls (§ 10 Abs. 1 Nr. 4: ein gezahlter Betrag); günstiger ⇒ Abzug, sonst nicht.

**Wer zahlt mit welchem Tarif (`own`):** eigener Haushalt (Ansparphase, Rente, Kapital bei Rentenbeginn) mit Splitting
und 2.000 € Pauschbetrag; Erben (`incHeir`) einzeln im Grundtarif mit eigenem 1.000-€-Pauschbetrag, aber mit **demselben
Kirchensteuersatz** (Annahme, keine eigene Eingabe). Partner erbt (`heirMarried`, verheiratet): Im Todesjahr lebten
beide zu Jahresbeginn, daher noch Zusammenveranlagung (§ 26 Abs. 1 EStG): Erträge im Todesjahr (ungeförderter AVD-Teil,
Depots, in der Kombi auch die Restrente) im Splittingtarif mit dem Partner-Einkommen des Jahres, eigenes Einkommen der
verstorbenen Person 0 (Tod zu Jahresbeginn), 2.000 € Pauschbetrag; `incHeir` wirkt dann nicht. Spätere Steuer auf das
übertragene AVD mit `incSpouseRet` im Grundtarif (vorher: Einkommen der verstorbenen Person), spätere Restrenten mit dem
Partner-Einkommen des jeweiligen Jahres; Restzeitraum weiter der der verstorbenen Person (H1). Ledig unverändert.

**Zeitachse des Partners:** `incSpouse` gilt in allen eigenen Ansparjahren (auch einer eigenen Ausbildung),
`incSpouseRet` ab dem eigenen Rentenbeginn. Ein abweichender Rentenbeginn des Partners ist nicht abbildbar.

## Wirkung (cumH heutige Kaufkraft, KV/PV 21,1 %, ETF / AVD / Versicherung)

| Fall | ETF | AVD | Versicherung | AVD-Erstattung gesamt nominal |
|---|---:|---:|---:|---:|
| Default (ledig, keine KiSt) | 153.289 | 174.856 | 127.694 | 8.017 |
| Default, KiSt 9 % | 151.597 | 171.907 | 126.624 | 8.296 |
| Default, KiSt 8 % | 151.781 | 172.222 | 126.740 | 8.265 |
| Default, verheiratet, Partner 38.000/20.000 € | 159.807 | 177.174 | 131.201 | 8.162 |
| … und KiSt 9 % | 158.471 | 174.355 | 130.258 | 8.445 |
| Default, verheiratet, Partner 0/0 € | 176.707 | 199.696 | 138.223 | 1.246 |
| DK (kvOn) | 140.713 | 140.903 | 105.292 | 8.017 |
| DK, KiSt 9 % | 139.342 | 138.680 | 104.734 | 8.296 |
| DK, verheiratet, Partner 0/0 € | 159.222 | 162.136 | 108.467 | 1.246 |
| High | 330.961 | 312.445 | 264.449 | 18.335 |
| High, KiSt 9 % | 327.449 | 310.677 | 262.712 | 19.085 |
| High, verheiratet, Partner 0/0 € | 337.801 | 316.913 | 273.176 | 11.802 |

Default/DK/High-Zeilen ohne Steuerprofil sind die bisherigen Werte. Beobachtungen ohne Wertung: Kirchensteuer senkt
alle Produkte; beim AVD stärker (−2.949 € gegenüber ETF −1.692 € im Default), weil die Auszahlungen voll
einkommensteuerpflichtig sind; die Erstattung in der Ansparphase steigt dagegen (+279 €). In DK wechselt mit KiSt 9 % der
knappe Abstand ETF − AVD das Vorzeichen (vorher −190 €, jetzt +662 €). Verheiratet mit einem Partner ohne Einkommen fällt die AVD-Erstattung fast weg (Splitting senkt den
Grenzsteuersatz in der Ansparphase), die Auszahlungen werden aber ebenfalls niedriger besteuert.

Erbwert AVD bei Tod mit 50 (real): Default 108.719 €, Ehepartner erbt 124.715 €; KiSt 9 % 107.520 / 122.629 €;
verheiratet mit Partner 38.000/20.000 € 108.855 / 125.238 €; High verheiratet mit Partner 0/0 € 316.173 / 414.471 €
(Nebendepot im Todesjahr gemeinsam veranlagt, spätere AVD-Steuer mit Partner-Einkommen 0).

Jahresproben (Inflation 0, 1.800 € Beitrag, 540 € Zulage, 60 → 65): Erstattung je Jahr ledig 38.000 € 175,00 €,
mit KiSt 9 % 182,03 €; verheiratet 38.000 € + Partner 0 € 26,00 €; 38.000 + 38.000 € 180,00 €; 110.000 € + 0 €
318,00 € (kein Soli wegen 40.700-€-Freigrenze; ledig 495,717 €).

## Tests

`tests/kirchensteuer-splitting.test.ts` (14 Tests) mit eigener, von der Engine unabhängiger Veranlagung:
Abgeltungsteuersatz 8/9 %, Leibrente mit KiSt und Sonderausgabenabzug, AVD-Günstigerprüfung mit KiSt (20.000/38.000/
110.000 €), Erben mit KiSt, Splitting-Leibrente mit Partner 0/10.000/60.000 €, AVD-Erstattung verheiratet (fünf Fälle,
beide Entscheidungen), Soli-Freigrenze, 2.000-€-Pauschbetrag und Erben weiter 1.000 €, Partner-Latenzsteuer,
Bitgleichheit bei ausgeschaltetem Profil, Link/Speicher, Rechenweg, Einstellungs-Badge.

## Offene Punkte (bewusst nicht gerechnet)

- **Partner mit eigenem gefördertem Vertrag:** mittelbare Zulage (§ 79 S. 2, bis 175 €, ≥ 120 € eigener Beitrag),
  gemeinsame Günstigerprüfung (§ 10a Abs. 3 S. 2–5), +120 € Höchstbetrag. Bräuchte einen zweiten Vertrag mit eigenem
  Beitrag des Partners im fairen Vergleich.
- **Partner mit eigenen Kapitalerträgen:** teilen sich die 2.000 € Pauschbetrag (§ 20 Abs. 9 S. 3) und die
  Günstigerprüfung beider (§ 32d Abs. 6 S. 4). Gerechnet ist der günstigste Fall (Partner ohne Kapitalerträge).
- **Kirchensteuer:** Kappung (auf Antrag in den meisten Ländern 2,75–4 % des zvE; wirkt erst bei sehr hohen
  Einkommen), Kinderfreibeträge in der Bemessung (§ 51a Abs. 2 S. 1, wie beim Soli), glaubensverschiedene Ehe
  (Halbteilung bzw. besonderes Kirchgeld), unterschiedliche Konfession der Erben; zeitlicher Versatz des SA-Abzugs.
- **Witwensplitting** im Folgejahr nach dem Tod (§ 32a Abs. 6 S. 1 Nr. 1) für die spätere AVD-Steuer des Partners und ein eigenes Hinterbliebenenprofil (H1). Das Todesjahr selbst ist gemeinsam veranlagt (§ 26 Abs. 1, siehe oben).
- **KV:** bleibt je Person (KVdR, freiwillige Versicherung). Die Anrechnung des Partner-Einkommens bei freiwillig
  Versicherten mit privat versichertem Partner (§ 240 Abs. 5 SGB V) ist nicht gerechnet.
- **Abweichende Rentenbeginne** der Partner; Partner-Einkommen ist je Phase real konstant.
