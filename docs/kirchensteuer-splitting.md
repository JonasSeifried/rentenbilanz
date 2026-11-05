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
| § 10a-Abzug jedem Ehegatten gesondert; mittelbar Berechtigter: Beiträge und Zulagen beider beim unmittelbar Berechtigten, Höchstbetrag + 120 € (AVRG); beide unmittelbar: Zulage beider in der Günstigerprüfung | [§ 10a Abs. 3 EStG](https://www.gesetze-im-internet.de/estg/__10a.html), AVRG Art. 2 Nr. 1 c | Standard ohne Partner-Vertrag ⇒ nur die eigene Zulage; mit `avdSpouse` S. 1–5 gerechnet (Abschnitt unten) |
| Mittelbare Zulageberechtigung bleibt: eigener Vertrag des Partners, ≥ 120 € (bisher 60 €) eigener Beitrag, Grundzulage höchstens 175 €, bemessen an den geförderten Beiträgen des unmittelbar Berechtigten | [§ 79 S. 2 EStG](https://www.gesetze-im-internet.de/estg/__79.html); AVRG Art. 2 Nr. 4 a, Nr. 7 (§ 84 S. 3–4 n. F.), Nr. 8 (§ 85 S. 2 n. F.) | mit `avdSpouse` gerechnet, wenn das Partner-zvE 0 ist (Abschnitt unten) |
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
Nach dem Merge mit `allowanceUsed`: Der gemeinsame Pauschbetrag ist im eigenen Haushalt und im Todesjahr um den
anderweitig genutzten Betrag gekürzt. Nach dem Review des Merges gibt es die Ehepartner-Sicht (`heirMarried`) bei
`married` auch für ETF-Depot, aktiven Fonds, Versicherung und eine Kombi ohne AVD (vorher nur AVD und Kombi mit AVD;
die Depots standen dort mit dem Erben-Tarif neben der Ehepartner-Zeile des AVD). Ledig bleibt alles unverändert.

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

## Partner mit eigenem gefördertem Vertrag (`avdSpouse`, 05.11.2026)

Eingabe „Partner zahlt selbst ins Altersvorsorgedepot“ (€/Monat, nur bei „verheiratet“, wächst mit der Beitragsdynamik).
Standard 0 ⇒ bitgleich (Test `tests/partner-avd.test.ts`, Golden-Test, I1). Rechnung nur in `combo.ts`
(`spouseAvd`, `spD`/`spZ`, AVD-Block), Parameter in `core.ts`. Der Partner-Vertrag ist kein verglichenes Produkt;
gerechnet wird nur, wie er die eigenen Zahlen ändert.

### Primärquellen (abgerufen am 05.11.2026)

- [§ 10a Abs. 3 EStG](https://www.gesetze-im-internet.de/estg/__10a.html): S. 1 Abzug je Ehegatte gesondert; S. 2–4
  mittelbar berechtigter Ehegatte: beide Beiträge und beide Zulagen beim unmittelbar Berechtigten, Höchstbetrag + 60 €
  (AVRG Art. 2 Nr. 1 c: 120 €), eigene Beiträge vorrangig, mindestens 60 € (120 €) des Partners; S. 5 beide unmittelbar:
  Zulage beider in der Günstigerprüfung. Abs. 4 S. 3–4: Zurechnung der festgestellten Steuerermäßigung im Verhältnis der
  berücksichtigten Beiträge, der Anteil auf Beiträge des mittelbar Berechtigten gehört zu dessen Vertrag.
- [§ 79 S. 2 EStG](https://www.gesetze-im-internet.de/estg/__79.html) mit AVRG Art. 2 Nr. 4 a (60 → 120 €);
  § 84 n. F. (AVRG Art. 2 Nr. 7): Grundzulage 50 % bis 360 €, 25 % bis 1.800 €; mittelbar Berechtigte „höchstens
  175 Euro“, bemessen an den geförderten Beiträgen des unmittelbar berechtigten Ehegatten (S. 3–4); § 86 n. F. (Nr. 9):
  Mindesteigenbeitrag 120 €. AVRG als amtliches PDF, MD5 `c0120027357f7d9ccfe433a59979c9f9`, Art. 14 Abs. 2:
  Art. 2 gilt ab 01.01.2027.
- [BMF-Schreiben vom 05.10.2023](https://www.steuerschroeder.de/blog/wp-content/uploads/2023/10/2023-10-05-stl-foerderung-private-altersvorsorge.pdf)
  (IV C 3 – S 2015/22/10001 :001, BStBl 2023 I S. 1726; Riester, Normstruktur gleich): Rn. 26 (mittelbare Berechtigung
  gibt keinen eigenen Sonderausgabenabzug), Rn. 27 (mittelbar nur, wenn **beide** Ehegatten einen eigenen Vertrag haben),
  Rn. 109 (mittelbar: Steuerermäßigung beider Beiträge samt Zulagen gegen beide Zulagen), Rn. 110 (beide unmittelbar:
  Summe beider Abzüge gegen beide Zulagen, auch wenn nur einer den Abzug beantragt), Rn. 113 (Rechenbeispiel),
  Rn. 116/118–120 (Zurechnung im Verhältnis der geförderten Eigenbeiträge).

### Welcher Fall gilt (Annahme ohne zweite Frage)

Nach § 10a Abs. 1 n. F. sind unmittelbar begünstigt: Pflichtversicherte der Rentenversicherung, Beamte und gleichgestellte
und neu Selbständige unter 67 mit Steuererklärung (S. 5 n. F.). Damit ist fast jeder Partner mit eigenem Erwerbseinkommen
unmittelbar begünstigt. Regel im Rechner: **Partner-zvE vor dem eigenen Rentenbeginn (`incSpouse`) > 0 ⇒ unmittelbar,
= 0 ⇒ mittelbar.** Falsch ist das z. B. bei einem Partner mit nur Miet- oder Kapitaleinkünften (wäre mittelbar) oder in
Elternzeit mit Kindererziehungszeiten ohne zvE (wäre unmittelbar). Steht im Hinweis am Feld und im Glossar.

### Rechnung je Ansparjahr (nominal; x = gemeinsames zvE, L(x, D, Z) = Belastung nach Günstigerprüfung wie bisher)

- **Unmittelbar:** Partner eP = min(Beitrag, 1.800 €), zP = Grundzulage(eP) ab 120 € (darunter mit R6 nur Abzug, zP = 0),
  ohne Kinderzulage und Bonus (Bonus zählt nicht, E3). Ausgangslage aller Produkte: L(x, eP + zP, zP) (auch in der
  Günstigerprüfung der Kapitalerträge R3). Mit eigenem Vertrag: L(x, E + z + eP + zP, z + zP).
  **Eigene Erstattung = L(x, eP + zP, zP) − L(x, E + z + eP + zP, z + zP)** (Änderung der gemeinsamen Steuer durch den
  eigenen Vertrag). Eigene Zulage unverändert.
- **Mittelbar** (nur, wenn der eigene geförderte Beitrag E ≥ 120 € und der Partner-Beitrag ≥ 120 € ist): zP = min(175 €,
  Grundzulage(E)); vom Partner-Beitrag zählt min(Beitrag, 1.920 € − E). Ohne eigenen Vertrag gäbe es für den Partner
  weder Zulage noch Abzug (Rn. 26/27), Ausgangslage daher ohne Abzug: **Erstattung = Steuer(x) − L(x, E + z + eP + zP, z + zP)**.
  Die Partner-Zulage zP fließt in den Partner-Vertrag und ist **nicht** im Ergebnis enthalten (Summe als `zulSpouse`
  unter „Rente im Detail“ und im Rechenweg). Andere Produkte unverändert.
- **Erbfall (Rückzahlungsbetrag § 93 Abs. 1):** zurückgefordert wird die diesem Vertrag zugerechnete Steuerermäßigung
  (Steuer(x) − gemeinsame Belastung) · E / (E + eP) statt der Erstattung (§ 10a Abs. 4 S. 3–4, Rn. 116/118); ohne
  Partner-Vertrag identisch mit der Erstattung.

Handproben (Inflation 0, 1.800 € eigener Beitrag, 540 € Zulage): beide 38.000 €, Partner 10 €/Monat: Partner allein
spart 56 € < 60 € Zulage (kein Abzug), gemeinsam 774 € > 600 € ⇒ eigene Erstattung 174 € statt 180 €.
110.000 € + 0 €, Partner 50 €/Monat (mittelbar): Abzug 1.800 + 120 + 540 + 175 = 2.635 €, Ersparnis 966 € − 715 € ⇒ 251 €
statt 858 − 540 = 318 €; Partner-Zulage 175 €/Jahr.

### Wirkung (cumH heutige Kaufkraft, eigener Beitrag 150 €/Monat, KV/PV 21,1 %)

| Fall | Partner €/Monat | ETF | AVD | Versicherung | AVD-Erstattung nominal | Partner-Zulage nominal (nicht enthalten) |
|---|---:|---:|---:|---:|---:|---:|
| verheiratet, beide 38.000 €, Partner im Alter 20.000 € | 0 | 159.807 | 177.174 | 131.201 | 8.162 | – |
| | 10 | 159.807 | 176.696 | 131.201 | 7.940 | – |
| | 50 | 159.807 | 176.908 | 131.201 | 8.056 | – |
| | 150 | 159.807 | 176.456 | 131.201 | 7.872 | – |
| verheiratet, Partner 0/0 € (mittelbar) | 0 | 176.707 | 199.696 | 138.223 | 1.246 | – |
| | 10 / 50 / 150 | 176.707 | 197.055 | 138.223 | 0 | 7.875 |
| High (110.000 €, 500 €/Monat, kvOn), Partner 0/0 € | 0 | 337.801 | 316.913 | 273.176 | 11.802 | – |
| | 10 / 50 / 150 | 337.801 | 312.581 | 273.176 | 9.321 | 6.475 |

Beobachtungen ohne Wertung: Unmittelbar ändert der Partner-Vertrag die eigene Erstattung nur über die gemeinsame Prüfung
und den Progressionsverlauf (−0,15 % bis −0,4 % AVD). Mittelbar senkt er die eigene Erstattung, weil die Partner-Zulage in
der Günstigerprüfung gegengerechnet wird (Default: Abzug lohnt nicht mehr, −2.641 € AVD real); dem stehen 175 € Zulage im
Jahr im Partner-Vertrag gegenüber, die nur durch den eigenen Vertrag entstehen, aber nicht in den Zahlen stehen.
Über 120 € im Jahr hängt das Ergebnis im mittelbaren Fall nicht vom Partner-Beitrag ab (Default: Höchstbetrag mit
eigenen 1.800 € fast ausgeschöpft, es zählen 120 €).

### Offen (bewusst nicht gerechnet)

- **Wert der mittelbaren Partner-Zulage:** entsteht nur durch den eigenen Vertrag, liegt aber im Partner-Vertrag
  (eigene Erträge, Auszahlung an den Partner). Nicht im Ergebnis; Summe wird angezeigt. Ob sie dem Vergleich
  zugerechnet werden soll, ist eine Modellentscheidung, keine Rechtsfrage.
- Partner-Zulage, wenn der eigene geförderte Beitrag unter 120 € liegt (R6: Abzug ohne Zulage): ob diese Beiträge
  „geförderte Altersvorsorgebeiträge“ im Sinne von § 84 S. 4 n. F. sind, ist ungeklärt; gerechnet ohne Partner-Wirkung.
- Kinderzulage beim Partner (§ 85 Abs. 2, Zuordnung zur Mutter), Berufseinsteigerbonus des Partners, Einzelveranlagung,
  abweichender Rentenbeginn, Fall „Partner ohne zvE, aber unmittelbar begünstigt“ (und umgekehrt).
- Bestandsverträge (§ 52 Abs. 50a n. F.) und § 90 Abs. 2 S. 7 n. F. (kein mittelbarer Anspruch, wenn der unmittelbar
  Berechtigte einen Bestandsvertrag hat): nicht abgebildet, der Rechner geht von neuen Verträgen ab 2027 aus.

## Tests

`tests/kirchensteuer-splitting.test.ts` (14 Tests) mit eigener, von der Engine unabhängiger Veranlagung:
Abgeltungsteuersatz 8/9 %, Leibrente mit KiSt und Sonderausgabenabzug, AVD-Günstigerprüfung mit KiSt (20.000/38.000/
110.000 €), Erben mit KiSt, Splitting-Leibrente mit Partner 0/10.000/60.000 €, AVD-Erstattung verheiratet (fünf Fälle,
beide Entscheidungen), Soli-Freigrenze, 2.000-€-Pauschbetrag und Erben weiter 1.000 €, Partner-Latenzsteuer,
Bitgleichheit bei ausgeschaltetem Profil, Link/Speicher, Rechenweg, Einstellungs-Badge.

## Offene Punkte (bewusst nicht gerechnet)

- **Partner mit eigenem gefördertem Vertrag:** seit `avdSpouse` gerechnet; Restpunkte im Abschnitt oben.
- **Partner mit eigenen Kapitalerträgen:** teilen sich die 2.000 € Pauschbetrag (§ 20 Abs. 9 S. 3) und die
  Günstigerprüfung beider (§ 32d Abs. 6 S. 4). Gerechnet ist der günstigste Fall (Partner ohne Kapitalerträge).
- **Kirchensteuer:** Kappung (auf Antrag in den meisten Ländern 2,75–4 % des zvE; wirkt erst bei sehr hohen
  Einkommen), Kinderfreibeträge in der Bemessung (§ 51a Abs. 2 S. 1, wie beim Soli), glaubensverschiedene Ehe
  (Halbteilung bzw. besonderes Kirchgeld), unterschiedliche Konfession der Erben; zeitlicher Versatz des SA-Abzugs.
- **Witwensplitting** im Folgejahr nach dem Tod (§ 32a Abs. 6 S. 1 Nr. 1) für die spätere AVD-Steuer des Partners und ein eigenes Hinterbliebenenprofil (H1). Das Todesjahr selbst ist gemeinsam veranlagt (§ 26 Abs. 1, siehe oben).
- **KV:** bleibt je Person (KVdR, freiwillige Versicherung). Die Anrechnung des Partner-Einkommens bei freiwillig
  Versicherten mit privat versichertem Partner (§ 240 Abs. 5 SGB V) ist nicht gerechnet.
- **Abweichende Rentenbeginne** der Partner; Partner-Einkommen ist je Phase real konstant.
