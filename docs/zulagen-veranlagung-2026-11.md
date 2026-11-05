# E4 und D1: Zulagen-Veranlagung und I4-Dokumentation, 04.11.2026

Ausgangs-HEAD: `c2b6672228ea94f751b81ba4093f142940f57287`, Arbeitskopie bei Beginn sauber.
Ein unabhängiges Review von c2b6672 hat F1–F4 und das geprüfte
R-Paket freigegeben; dieser Nachtrag ist die anschließende eigene Implementierung, kein weiteres unabhängiges Review.

## E4: Herleitung aus amtlichen Primärquellen

Die frühere Zurückstellung allein wegen eines fehlenden AVD-Verwaltungsschreibens war nicht ausreichend.
Die gesetzlichen Rechenschritte lassen sich für den modellierten Grundtarif herleiten:

1. [§ 10a Abs. 2 EStG](https://www.gesetze-im-internet.de/estg/__10a.html): Sonderausgabenabzug nur,
   wenn günstiger als der reguläre Zulageanspruch; andernfalls entfallen Abzug und Hinzurechnung.
   Der [BFH, Urteil vom 09.04.2025, X R 11/21, Leitsätze 1–4 und Gründe II.1/II.2](https://www.bundesfinanzhof.de/de/entscheidung/entscheidungen-online/detail/STRE202510126/)
   konkretisiert den Vergleich als Differenz der **tariflichen Einkommensteuer**, ohne Soli.
   Weitere Steuerermäßigungen können die Entscheidung über den tatsächlichen Abzug beeinflussen;
   sie sind im Rechner nicht enthalten. Eine solche Ausnahme wird hier nicht als Tarifregel nachgebaut.
2. [§ 2 Abs. 6 EStG](https://www.gesetze-im-internet.de/estg/__2.html): Wird der Abzug gewählt, ist die
   reguläre Zulage bei der Festsetzung hinzuzurechnen. Der Berufseinsteigerbonus bleibt gemäß der dortigen
   Ausnahme und § 10a Abs. 1 außerhalb von Abzug und Gegenrechnung (E3). Er fließt weiterhin ins AVD.
3. [§ 3 Abs. 1–3 SolZG](https://www.gesetze-im-internet.de/solzg_1995/__3.html): Die Soli-Basis knüpft
   an die festzusetzende ESt an, mit besonderer Berücksichtigung der Kinderfreibeträge. Für den modellierten
   Fall ohne persönliche Kinderfreibetragsrechnung umfasst sie deshalb die hinzugerechnete reguläre Zulage.
   [§ 4 SolZG](https://www.gesetze-im-internet.de/solzg_1995/__4.html) bestimmt 5,5 % sowie die
   Milderungszone mit 11,9 % oberhalb der Freigrenze; Kapitalsteuer nach § 32d Abs. 3/4 bleibt gesondert.
4. Das amtliche [AVRG, BGBl. 2026 I Nr. 156](https://www.recht.bund.de/bgbl/1/2026/156/regelungstext.pdf?__blob=publicationFile&v=1)
   wurde erneut direkt heruntergeladen und als Text gelesen: MD5 `c0120027357f7d9ccfe433a59979c9f9`.
   Art. 2 Nr. 1 (Seiten 2–3) ändert den Abzugsrahmen auf 1.800 € Eigenbeiträge **zuzüglich** Zulage und
   erweitert den Personenkreis, beseitigt aber weder die Vergleichsregel noch die Bonusausnahme.
   Art. 2 Nr. 7–9 (Seiten 4–5) regelt Zulagen/Bonus und die Zulagenschwelle.
   Art. 14 Abs. 2 (Seite 23) setzt Art. 2 zum 01.01.2027 in Kraft. Keine Änderung des SolZG durch das AVRG.

Die Soli-Folgerung ist eine Herleitung aus diesen Normen, keine neu bestätigte AVD-Verwaltungspraxis.
Kein neuer BMF-/BVSz-Nachweis wird behauptet. Die amtlichen HTML-Texte wurden gelesen; nach Timeout des
Webwerkzeugs wurden § 32d und § 20 direkt per curl abgerufen und mit korrekter Zeichenkodierung gelesen.
Das Webwerkzeug meldete beim AVRG 403; der direkte Abruf des amtlichen PDFs gelang.

## Vollständige Vergleichsrechnung im vorhandenen Eingabemodell

Seien `x` das nominale sonstige zvE, `d = E + z` der förderfähige Abzug, `z` die reguläre Zulage ohne Bonus,
`e_t(x)` die nominale ESt im indexierten Tarif und `s_t(e)` der Soli auf eine ESt-Basis.
Die abziehbare ESt-Differenz ist `e_t(x) − e_t(max(0,x−d))`.

- Ist sie **größer** als `z`, gilt `A_t(x) = e_t(max(0,x−d)) + z`.
- Sonst, auch bei Gleichstand, gilt `A_t(x) = e_t(x)`; kein SA-Abzug und keine Zulagenhinzurechnung.
- Endgültige Belastung: `L_t(x) = A_t(x) + s_t(A_t(x))`.
- Zusätzliche AVD-Erstattung ohne Kapitalerträge: `e_t(x) + s_t(e_t(x)) − L_t(x)`.

Damit wird weder Soli auf eine bereits wieder abgezogene Zulage gerechnet noch der Abzug allein wegen einer
Soli-Entlastung gewählt. Im Grundtarif ohne weitere Steuerermäßigungen ist `e+s(e)` monoton; die Entscheidung
nach ESt ergibt deshalb auch die niedrigere Gesamtbelastung. Bei null Beitrag gibt es weiterhin keine Förderung.
Unter 120 € bleiben mit R6 eigene Beiträge abziehbar, ohne Zulage/Bonus. Förderfähiger Höchstbetrag und Dynamik
ändern sich nicht.

**Rundung/Indexierung:** Mit R8 wird zuerst das nominale zvE auf ganze Euro abgerundet, der indexierte
[§-32a-Tarif](https://www.gesetze-im-internet.de/estg/__32a.html) angewendet und erst danach die nominale
ESt abgerundet. Die nominale Zulage wird anschließend hinzugerechnet, nicht mit dem Tarif indexiert.
Soli-Freigrenze und Tarif wachsen weiterhin gemäß der vorhandenen Modellannahme mit Inflation.
Ohne R8 bleibt die historische Einkommensabrundung in heutigen Euro aktiv, ohne volle ESt-Euro-Rundung.
Die vorhandene Soli-Funktion rechnet intern mit Bruchteilen eines Cents; die Centabrundung aus § 4 Satz 3
ist weiterhin nicht gesondert modelliert. Die Reviewprobe von 495,717 € ist deshalb ein interner Modellwert,
keine Behauptung eines exakt centgleichen Steuerbescheids.

**Persönliche Grenzen:** `incWork`/`incStudy` sind weiter vorgegebene zvE-Basen im Grundtarif. Die Kinderangaben
bestimmen nur Zulagen; sie enthalten weder Freibetragsanteile noch das vollständige Familien-Steuerprofil.
Die besondere Kinderfreibetragsrechnung nach § 3 Abs. 2 SolZG, § 31-Günstigerprüfung, Zusammenveranlagung,
Kirchensteuer, externe Einkünfte und individuelle weitere Steuerermäßigungen bleiben unmodelliert.
E4 korrigiert die Zulagenhinzurechnung in dieser vorhandenen Näherung, keine vollständige persönliche
Steuerveranlagungssoftware. Auch die gezielte Kinderzulagenprobe prüft nur die Abzugsentscheidung bei vorgegebenem
Anspruch; sie bestätigt keine exakte Familienveranlagung.

## R3, Wiederanlage und Bilanz

[§ 32d Abs. 6 EStG](https://www.gesetze-im-internet.de/estg/__32d.html) vergleicht einschließlich
Zuschlagsteuern, einheitlich für alle Kapitalerträge. `K` ist die gemeinsame nach Teilfreistellung/Pauschbetrag
verbleibende Kapitalbasis; `Q` der zunächst finanzierte Quellenabzug einschließlich Soli.

- Abgeltungspfad: `L_t(x) + Q`.
- Tarifpfad: `L_t(x+K)`, **erneut** einschließlich der SA-/Zulagenentscheidung auf dieser höheren Basis.
- Zusätzliche R3-Cash-Erstattung: `max(0, L_t(x)+Q−L_t(x+K))`.

Die vorher berechnete AVD-Erstattung steckt bereits in `L_t(x)`. Sie wird nicht noch einmal als R3-Cash gezählt.
Bei Wiederanlage kommt genau diese AVD-Erstattung einmal ins Nebendepot; bei ausgeschalteter Wiederanlage bleibt
sie wie bisher als ausgegebene Förderung außerhalb von `net[]`/`cumH`. Zusätzliche R3-Erstattung steht dagegen
in `net[t]`, ohne Wiederanlage. Quellenabzug, dessen Steuerverkäufe und die realisierten Basen bleiben erhalten.
Förderverzug verschiebt weiterhin nur den Empfang der AVD-Erstattung, nicht deren nominalen Anspruch.
Die Rentenjahresprüfung nach R1/R3 und die marginale AVD-Teilauszahlung werden nicht um eine neue Erstattung ergänzt.

`soliOnZulage` (E4) ist einzeln abschaltbar. Die neue Rechnung steht ausschließlich in `combo.ts`;
`fixes.ts` ergänzt nur den Katalog. `core.ts`, `engine.ts` und `legacy/index.html` sind unverändert.
Die für E4 benötigte getrennte nominale ESt verwendet lokal dieselben Tarifkoeffizienten wie `tax2026`;
bei jährlicher Tarifpflege sind beide Stellen gemeinsam zu aktualisieren.
Die historischen E-Referenztests schließen das neue E4 ausdrücklich aus, prüfen aber weiterhin alle bisherigen
E-Schalter. Die 16 R-Paket-Teilmengen bleiben auf ihrem bisherigen Ausgangsstand ohne E4 geprüft.
Zusätzlich laufen E4 allein, E4 ausgehend von ALL und die gezielten E4/R3/R8/E3-Kombinationen;
keine Behauptung aller 65.536 Teilmengen des jetzt 16 Schalter umfassenden Katalogs.

Die reparierten alternativen Versicherungs-Kapitalrechnungen behalten ihr eigenes gemeinsames
Pauschbetragsbuch. Keine Erhöhung der anfänglichen Versicherungsleistung um spätere Erstattungen, keine
Änderung der tatsächlichen Leibrentenbücher durch die Alternative. Die marginale Liquidationssteuer und
Verlustsaldierung mit kurzer Versicherungsleistung bleiben bestehen; die halbe Tarifleistung bleibt getrennt.

## Wirkung und D1

Die Review-Jahresprobe mit 110.000 € Einkommen, 1.800 € Eigenbeitrag, 540 € regulärer Zulage, Inflation null
und R8 ergibt vor E4 559,977 €, jetzt **495,717 €** zusätzliche Erstattung; Differenz **64,26 €**.
Nach Abzug beträgt die ESt einschließlich Zulage 34.621 €, der Soli darauf 1.698,249 €.
Das ist keine isoliert ausgetauschte Soli-Zeile: Abzugsentscheidung und R3 nutzen dieselbe Veranlagung.

Erneut gemessen, `cumHReal`, KV/PV 21,1 %, neue Optionen jeweils im Standard:

| Fall | ETF | AVD vor E4 → nach E4 | Versicherung |
|---|---:|---:|---:|
| Default | 153.289 € | 174.856 → 174.856 € | 127.694 € |
| DK | 140.713 € | 140.903 → 140.903 € | 105.292 € |
| High, KV-Brutto 20.000 € | 330.961 € | 316.109 → 312.445 € | 254.574 € |
| High, KV-Brutto ausdrücklich 45.000 € | 330.961 € | 316.109 → 312.445 € | 264.449 € |

High-AVD ungerundet: 316.109,03615819727 → 312.445,41631573957 €, also −3.663,6198424577 € real.
Die geringere jährliche zusätzliche Erstattung verkleinert das wiederangelegte Nebendepot über 37 Ansparjahre.
Default/DK liegen in der Ansparphase unter der Soli-Freigrenze; ihre Werte und die Standard-Kombisuche bleiben
unverändert. DK hat weiter nur 190 € Abstand, keine robuste Überlegenheit.
Für High ergeben sich mit Restprofil 312.985 €, Förderverzug 310.061 €, hypothetisch indexiertem Pauschbetrag
314.108 € und nur 1 % AVD-Auszahlkosten 297.852 € AVD-`cumHReal`. Die zugehörigen ETF-/Versicherungswerte
bleiben wie im vorigen Bericht. Diese Messungen ersetzen dessen historischen High-AVD-Werte ab diesem Stand.

**D1/P3:** Die Aussage zur Wechselwirkung in `kombi-modus.md` ist auf den historischen Pfad ohne R3 begrenzt.
Der genaue Gegenfall aus dem neuen unabhängigen Review ist dauerhaft in `tests/combo.test.ts` erhalten:
23.869,339078368866 € gemeinsam, 23.856,13732911591 € getrennt, **+13,201749252955779 € real**, ohne KV und
R8. Mit zusätzlich ausgeschaltetem R3 bleibt die strikte Ungleichung in der Probe bestehen. Keine höhere
pauschale Toleranz, keine vollständig rundungsfreie analytische Behauptung. Aktuelle Prüfstrategie:
Jahresbilanzen, gezielte Regression und erschöpfende Suchgegenproben.

## Prüfung und verbleibende Grenzen

Gezielte neue Jahres-/Schwellentests in `tests/zulagen-veranlagung.test.ts`: unabhängige Steuerformeln,
Abzug/kein Abzug/Gleichstand, Grundfreibetrag und Tarifzonen, Soli-Freigrenze/Milderungszone/voller Soli,
nominale Indexierung über alle Ansparjahre, Beiträge 0/108/120/300/1.800/6.840 €, Bonus mit E3 an/aus,
Wiederanlage und Förderverzug, gemeinsame R3-Jahresbilanz mit tatsächlichem Wechsel der SA-Entscheidung.

128 temporäre eigene Gegenproben bestanden: 64 gemischte Fälle sind mit ausgeschaltetem E4 direkt bitgleich
zum Code des geprüften HEADs c2b6672, einschließlich Kapital-, Zahlungs-, Steuer-, Förder- und Erbwerten;
weitere 64 Fälle ohne AVD sind auch mit E4 bitgleich. Enthalten sind R3/R8/E3 an/aus, Umschichtung,
Förderverzug, KV, beide Versicherungsmodi, Auszahlprofil, Indexierung und eigene Auszahlkosten.
Der abschließende direkte Vergleich erhält auch
vorzeichenbehaftete Nullwerte, ohne JSON-Zwischenformat.

Abschlussvalidierung:

- `npm ci` erfolgreich.
- `npm test`: **268 Funktionstests in 14 Dateien**, anschließend **3 separate Laufzeitprüfungen** grün.
  Golden/I1, Kombi, Suche einschließlich 50 erschöpfender Zufallsgegenproben und die bisherigen
  Fix-Teilmengen sind enthalten. Laufzeitbudgets und Toleranzen wurden nicht erhöht.
- Nach Ergänzung weiterer Soli-Übergangswerte und R3-Bilanzen mit Wiederanlage an/aus:
  alle **7 E4-Tests** und die temporäre direkte Bitgleichheitsprüfung erneut grün.
- `npm run check` abschließend: **0 Fehler, 0 Warnungen**.
- `npm run build`: erfolgreich, die bestehenden drei theme.js-Hinweise bleiben.
- `git diff --check` sauber. `core.ts`, `engine.ts` und `legacy/index.html` ohne Diff zum Ausgangs-HEAD.

H1 benötigt weiterhin ein eigenes Hinterbliebenenprofil. H2 im geförderten Teil einschließlich Zuordnung der
zusätzlichen R3-Entlastung bleibt offen; ungeförderte Restbasis wird separat fortgeschrieben.
Die neue kombinierte ESt-/Soli-Erstattung begründet keine neue Förderkonto-Rückzahlungsformel.
E9/E12/E13 bleiben offen. Kein zusätzlicher Mindestbeitragszeitraum, keine neue AVD-KV-Regel oder
Verwaltungsfrist. `kvGrossRet` bleibt unabhängig von `incRet`, auch in alten Links mit eigenem Standard 20.000 €.
