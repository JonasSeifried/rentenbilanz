# Umsetzung der restlichen Review-Punkte, 04.11.2026

Ausgangspunkt: tatsächlich geprüfter HEAD `8168de3abc98d472fff15928d73518a5aef2e047`.
R1/R2/R6/R8 waren bereits enthalten. Alle neuen Steuerkorrekturen stehen ausschließlich in `combo.ts`,
einzeln abschaltbar in `fixes.ts`. `engine.ts` und `legacy/index.html` bleiben unverändert.
Dieser Bericht beschreibt eine Implementierung mit eigenen gezielten Prüfungen, kein weiteres unabhängiges Review.

## R3: ein jährlicher Antrag für sämtliche modellierten Kapitalerträge

[`§ 32d Abs. 6 EStG`](https://www.gesetze-im-internet.de/estg/__32d.html) verlangt die einheitliche Prüfung
aller Kapitalerträge. `capitalGuenstiger` umfasst ETF, aktiven Fonds, beide Teilfreistellungen,
AVD-Nebendepot, Versicherungs-Folge-ETF, Umschichtungsgewinne, Vorabpauschalen und Gewinne der
Steuerfinanzierungsverkäufe sowie die voll besteuerte Versicherungsleistung vor zwölf Jahren.
Die obligatorisch tarifbesteuerte hälftige Versicherungsleistung steht bereits in der sonstigen Tarifbasis.

Die Engine führt zunächst den Quellenabzug mit 26,375 % einschließlich Soli und dessen Finanzierung aus.
Nach dem gemeinsamen KV-Buch und R1 wird **einmal je Jahr** verglichen:

- Abgeltungspfad: zusätzliche Tarifsteuer nach Sonderausgaben plus gesamte Quellensteuer.
- Tarifpfad: Steuer auf dieselbe Basis zuzüglich aller nach Teilfreistellung und gemeinsamem Pauschbetrag
  verbleibenden Kapitalerträge. Der bestehende Soli-Tarif wird jeweils mitgerechnet.

Die positive Differenz kommt als verfügbares Geld desselben Steuerjahres zurück, ohne Wiederanlage.
Der Quellenabzug und die schon erfolgten Anteilsverkäufe werden nicht rückwirkend zurückgenommen.
`abgTax` zeigt die endgültige Belastung der Kapitalerträge **nach** dieser Erstattung, auch wenn dafür der Tarif
maßgeblich war. Die Erstattung wird anteilig nach dem Quellenabzug den Produkten zugeordnet.
`incTax` bleibt die zusätzliche Steuer der übrigen Tarifbasis nach R1. Beide Bücher zusammen sind die Gesamtsteuer.
Die AVD-Teilauszahlung hat auch nach dieser Prüfung einen marginalen Nettowert; keine doppelte Erstattung.

**Ansparphase:** Die Prüfung verwendet Ausbildungs-/Arbeitseinkommen und die AVD-Sonderausgaben desselben
Beitragsjahres. Für eine nominale Basis `x` gilt mit förderfähigem Abzug `d` und gegenzurechnender Zulage `z`:
`L(x) = min(T(x), T(max(0,x−d)) + z)`; verglichen werden `L(x)+Quellensteuer` und `L(x+Kapitalerträge)`.
Damit wird die AVD-Günstigerprüfung nicht mit § 32d verwechselt oder ein Abzug zweimal genutzt.
Der Berufseinsteigerbonus bleibt gemäß E3 außerhalb von `d/z`. Die bisher berechnete AVD-Erstattung und deren
Wiederanlage bleiben erhalten; ein zusätzlicher Vorteil durch das Zusammenwirken mit Kapitalerträgen ist in der
Kapitalertrags-Erstattung enthalten. Die gesetzliche Zuordnung dieses zusätzlichen Vorteils zum rückforderbaren
Förderkonto ist Teil des weiterhin offenen H2, keine neue bestätigte Verwaltungsformel.

Zahlungen vor Rentenbeginn stehen in `net[t]`, gehen aber nicht in `cumH` (Zeitraum R bis H) ein. Sie werden
nicht automatisch angespart. Eine Niedrigeinkommensphase mit hohen Depots kann deshalb einen zusätzlichen
verfügbaren Vorteil haben, der im Ruhestandsvergleich nicht erscheint. Externe Kapitalerträge, verbrauchter
Pauschbetrag, Zusammenveranlagung, Kirchensteuer und persönliche weitere Abzüge bleiben außerhalb des Modells.

**Erbfall:** Alle im Todesjahr liquidierten Depots werden zusammen geprüft, über den AVD-Erträgen und der ersten
Restrente im Tarif der einen modellierten erbenden Person (`incHeir`). Zukünftige Restrenten sind weiterhin einzeln
versteuert; der Kapitalverkauf wird nicht auf diese späteren Jahre verteilt. Keine eigene KV der Erben gerechnet.

## R4: offener VP-Posten über den Jahreswechsel

[`§ 18 Abs. 3 InvStG`](https://www.gesetze-im-internet.de/invstg_2018/__18.html): Zufluss am ersten Werktag
des Folgejahres. `vpNextYear` speichert die am Jahresende ermittelte volle Vorabpauschale je Teildepot,
vorerst ohne Steuer, KV oder Basisanrechnung. Jahresanfang des Folgejahres:

1. Gemeinsamen Pauschbetrag nach dem der Versicherung zugeordneten Anteil bestimmen (R7).
2. Zugeflossene VP aller Depots anteilig damit verrechnen.
3. Volle VP **vor** dem Finanzierungsverkauf auf die Basis anrechnen (§ 19 Abs. 1 InvStG), auch bei Steuer null.
4. Quellensteuer wie R2 vollständig finanzieren: `q=max(0,(V−B)/V)`, `S=VP-Steuer/(1−q×tf×0,26375)`.
   Vermögen um S, Basis anteilig reduzieren; beide Steuern ins Buch.
5. Entnahmen aus dem verbleibenden Vermögen neu bestimmen; nur den verbleibenden Pauschbetrag nutzen.
6. Im Rentenjahr VP und Steuerverkaufsgewinn nach Teilfreistellung in das gemeinsame KV-Buch aufnehmen,
   anschließend R1 und R3. Eine VP des letzten Ansparjahres zählt somit zur KV des ersten Rentenjahres.

Eine im Jahr gekaufte Position erhält erst im Folgejahr ihre VP. Nach vollständiger vorschüssiger Entnahme
entsteht keine weitere VP. Steuerlose VP verbrauchen trotzdem Pauschbetrag und erhöhen die Basis.
Fondsverkäufe im Todesjahr übernehmen auch offene VP: erst deren Zufluss, dann volle Basisanrechnung beim
Verkauf; VP plus verbleibender Veräußerungsgewinn werden nur einmal mit einem Pauschbetrag besteuert.
Gewinne/Verluste werden bei der vollständigen Liquidation wie bisher gemeinsam saldiert.
Die Modellgrenze bleibt Tod zu Jahresbeginn und anschließender Zufluss/Verkauf bei den Erben; keine unterjährige
Zuordnung zwischen letzter Erklärung der verstorbenen Person und Erben. `capR` ist der Bestand vor der Abrechnung
zu Rentenbeginn; `capNet` berücksichtigt den hypothetischen gemeinsamen Verkauf. Bei AVD bleibt dessen
latente Steuer darin eine Schätzung.

Durchschnittsbasis, Verlustabschneiden bei laufenden Verkäufen und Erwerbsmonatsnäherung bleiben unverändert.
FIFO und ein vollständiges Verlustvortragsbuch sind keine durch R4 neu gelösten Modellpunkte.

## R5: sonstige Bruttoeinnahmen für KV getrennt vom zvE

`kvGrossIncome` nutzt `kvGrossRet`: sonstige beitragspflichtige Bruttoeinnahmen im Alter, ohne die verglichenen
Produkte, in heutigem Geld. KV-Spielraum = `max(0,69.750−kvGrossRet)×Inflationsfaktor`.
`incRet` bleibt sonstiges zvE **vor** zusätzlichen produktbedingten KV-Beiträgen; Beiträge auf bestehendes
Einkommen sind darin bereits abgezogen. Keine Brutto-Schätzung, kein Multiplikator aus `incRet`.
Grundlage: [`§ 240 SGB V`](https://www.gesetze-im-internet.de/sgb_5/__240.html), § 3 Abs. 1 der
[Beitragsverfahrensgrundsätze Selbstzahler](https://www.gkv-spitzenverband.de/media/dokumente/krankenversicherung_1/grundprinzipien_1/finanzierung/beitragsbemessung/2025-01-01_Einheitliche_Grundsaetze_zur_Beitragsbemessung_freiwilliger_Mitglieder_Stand_01_01_2025.pdf).
Die beitragsrechtliche Bruttobasis ist von der steuerlichen Behandlung unabhängig.

**Kompatibilität:** Linkversion 1 und Speicherversion 2 bleiben lesbar. Neue Felder sind angehängt, alte Werte
nicht umkodiert. Alte Links/Speicher ohne `kvGrossRet` erhalten den eigenständigen Standard 20.000 €;
der Hinweis am Feld fordert die unabhängige Angabe. Ein alter Link mit `incRet=45.000` ist somit nicht automatisch
eine Behauptung von 45.000 € Brutto. Das kann bei ausgeschöpfter BBG Ergebnisse verändern und wird ausdrücklich
als Änderung des Eingabemodells ausgewiesen. Alle neuen Optionen werden gespeichert und geteilt.

## R7: Versicherung und Fonds teilen den Pauschbetrag

`insuranceAllowance`: [`§ 32d Abs. 2 Nr. 2`](https://www.gesetze-im-internet.de/estg/__32d.html) schließt
bei hälftig steuerpflichtigen Versicherungsleistungen § 20 Abs. 6 aus, **nicht** Abs. 9.
[`§ 20 Abs. 9 EStG`](https://www.gesetze-im-internet.de/estg/__20.html) gilt deshalb auch hier.
Von dem nach 15-%-Freistellung und Halbierung verbleibenden positiven Ertrag wird zunächst maximal der eine
Pauschbetrag abgezogen. Fonds erhalten nur den Rest. Das ist eine offen gelegte Zuordnung im Jahresmodell,
kein zweiter Freibetrag und keine Behauptung über die Reihenfolge tatsächlicher Bankabrechnungen.
Auch eine Versicherungsleistung vor zwölf Jahren nutzt jetzt denselben Betrag (bisherige Vereinfachung E11
entfällt auf dem neuen Pfad) und nimmt an R3 teil. Die alternativen Kapital-Anzeigewerte bei Leibrente
berücksichtigen den Pauschbetrag ebenfalls. Die anfängliche Auszahlung wird weiterhin nicht um spätere
KV- oder Kapitalertrags-Erstattungen erhöht.

## V1/V2/V3 und Kosten: wählbare Annahmen

- **V1 `payResidual`:** Standard weiterhin vorschüssige nominal konstante Annuität für offene Depots,
  jährlich Restkapital/Restjahre für das AVD. Optional erhalten auch alle offenen Depots das Restprofil;
  dabei bleiben Kosten, Steuern und Neben-/Folgedepots im Modell. Unterschiedliche reale Zahlungstermine
  beeinflussen `cumH`. Keine Behauptung eines neutralen, vertraglich vorgeschriebenen Entnahmeprofils.
- **V2 `fundingDelay`:** Standard Ende des Beitragsjahres; Sensitivität verschiebt Zulage und bisherige
  AVD-Erstattung an das Ende des Folgejahres. Letzte Ansparförderung kommt am Ende des ersten Rentenjahres,
  Zulage ins AVD, Erstattung bei Wiederanlage ins Nebendepot. Keine Förderung geht am Rentenübergang verloren.
  Ansprüche/Sonderausgaben gehören weiterhin zum Beitragsjahr; nominale Ansprüche bleiben gleich, reale
  Förderung wird zum Empfangsjahr bewertet. Die zusätzliche Kapital-Günstigerprüfungs-Erstattung bleibt bei
  der für R3 allgemein gewählten Jahresannahme. Keine behauptete einjährige Verwaltungsfrist;
  § 89 n. F. regelt vierteljährliche Antragsübermittlung, nicht den individuellen Gutschrifttermin.
  Offene Förderansprüche werden im Erbwert nicht gesondert als Forderung bewertet; dessen Prüfung bei
  eingeschaltetem Verzug erfordert zusätzliche rechtliche Zuordnung (H2).
- **V3 `indexAllowance`:** Standard nominal 1.000 €. Optional wächst er mit Inflation, ausdrücklich
  **hypothetisch**, auch beim Erb-/Kapitalverkauf und der Versicherung. Keine künftige Gesetzesänderung
  vorweggenommen. Der bisher indexierte Tarif samt Soli-Grenze und BBG bleibt eine explizite Modellannahme;
  R8 rundet erst im nominalen Steuerjahr.
- **Kosten:** `avdPayCost`, `etfPayTer`, `fondPayTer` erlauben getrennte Auszahlkosten. `−1` übernimmt
  die bisherige jeweilige Ansparquote (Standard); jeder nichtnegative Wert ist der eigene Auszahlsatz.
  ETF-Satz umfasst Neben-/Folge- und sichere Teildepots. Der AVD-Satz gilt auch ungefördert im Vertrag.
  Das Kosten-Anzeigefeld bleibt die entgangene Kapitalbildung bis Rentenbeginn; spätere Kosten wirken im Netto.
  Keine Änderung des Rentenfaktors durch diese Depotkosten; die Leibrente bleibt vertragsspezifisch über
  `rf` modelliert, ohne erfundene zusätzliche Rentenverwaltungsgebühr. Kosten der Versicherung sind in
  der Ansparphase konstante Renditeminderung; Abschlusskosten werden zeitlich geglättet, frühe
  Rückkaufs-/Todesfallwerte können dadurch zu hoch sein. Spreads und Ordergebühren fehlen.
- **Kaufkosten aktiver Fonds:** Beschriftung nennt jetzt den Anteil am **Bruttobeitrag** (`c×(1−a)`).
  Ist ein Prospekt-Aufschlag auf den Nettoanteilswert gemeint, muss zuvor `a/(1+a)` umgerechnet werden
  (5 % Nettoaufschlag entspricht rund 4,762 % Bruttokosten). Kein universeller Prospektwert behauptet.

Primärnachweis für V1, Förderverfahren und Kostendeckel: verkündetes
[AVRG, BGBl. 2026 I Nr. 156](https://www.recht.bund.de/bgbl/1/2026/156/regelungstext.pdf?__blob=publicationFile&v=1),
Art. 2 Nr. 10, Art. 6 (§ 1 Abs. 1 Nr. 4 Buchst. b und § 2a Abs. 1–2 AltZertG n. F.). Amtliches PDF erneut
per curl gelesen, MD5 `c0120027357f7d9ccfe433a59979c9f9`. 80 % sind Mindestquote, Neufestlegung spätestens
alle drei Jahre; gerechnet werden jährlich 100 %. Effektivkosten bis Auszahlungsbeginn höchstens 1 % beim
Standarddepot: daraus folgt keine Garantie identischer Kosten in der Auszahlphase.

Zusätzliche Szenariozeilen zeigen Profil, Verzug, AVD-Auszahlkosten +0,5 Prozentpunkte und hypothetische
Pauschbetragsindexierung; bei KV auch höheren Satz und höhere sonstige Bruttobasis bei konstantem zvE.
Unveränderte Rendite- und Versicherungs-Kostensensitivitäten bleiben erhalten. Konstante Renditen zeigen kein
Sequenzrisiko, keine Ausfallwahrscheinlichkeit und keine Garantie eines Ruhestandseinkommens.

## Wirkung in heutiger Kaufkraft

`comboStats(...).cumHReal`, Einzelprodukte über `analyze`, KV/PV 21,1 %, gerundet.
Default/DK/High mit den neuen Optionen im Standard. Die vorgegebenen Ausgangswerte wurden mit
abgeschaltetem neuem R-Paket exakt reproduziert. Isolierte Korrekturen sind keine addierbaren Beiträge.

| Fall | ETF vorher → jetzt | AVD vorher → jetzt | Versicherung vorher → jetzt |
|---|---:|---:|---:|
| Default | 152.506 → 153.289 | 174.850 → 174.856 | 127.222 → 127.694 |
| DK | 140.049 → 140.713 | 140.926 → 140.903 | 104.712 → 105.292 |
| High, unabhängiger Brutto-Standard 20.000 | 331.567 → 330.961 | 316.189 → 316.109 | 264.532 → 254.574 |
| High, KV-Brutto ausdrücklich 45.000 | 331.567 → 330.961 | 316.189 → 316.109 | 264.532 → 264.449 |

**Ursachen:** R3 allein auf dem geprüften Ausgangspfad erhöht Default-ETF um rund 737 €, Versicherung um
297 €; DK um 934/424 € (KV-Abzug aus R1 senkt auch die Tarifbasis der Kapitalerträge); High unverändert.
R4 allein verändert Default E/A/V um +30/+6/−20 €, DK −293/−23/−35 €, High −606/−80/−317 €.
Die früheren isolierten Review-Messungen hatten noch keinen vollständigen R2-Steuerverkauf und eine andere
Freibetragsreihenfolge; sie sind keine Sollwerte für diese Umsetzung. Quellensteuer finanziert sich nun erst
im Folgejahr, dort ändern sich Pauschbetragsverbrauch, Restbasis und Entnahmen; im ersten Rentenjahr kommt
zusätzliche KV hinzu. R7 allein bringt der Versicherung rund +56/+49/+98 €. Zusammen ändern sich
Kapitalauszahlung, Folge-ETF, R1 und R3 erneut. Bei High erklärt die neue unabhängige KV-Bruttobasis die weiteren
rund −9.875 € der Versicherung: 20.000 statt 45.000 € belegen weniger BBG, dadurch mehr produktbedingte KV.
Das ist keine aus dem zvE abgeleitete Verbesserung oder Schätzung des tatsächlichen Bruttoeinkommens.

| Sensitivität, aktuelle Engine | Default E / A / V | DK E / A / V | High E / A / V |
|---|---:|---:|---:|
| Restprofil aller Depots | 156.712 / 175.303 / 130.131 | 143.295 / 141.263 / 106.926 | 336.904 / 316.719 / 258.515 |
| AVD-Förderung ein Jahr später | 153.289 / 172.160 / 127.694 | 140.713 / 138.657 / 105.292 | 330.961 / 313.534 / 254.574 |
| Pauschbetrag hypothetisch indexiert | 161.760 / 175.070 / 131.710 | 148.720 / 141.116 / 109.173 | 338.751 / 318.232 / 258.521 |
| Nur AVD-Auszahlkosten 1 % | 153.289 / 166.480 / 127.694 | 140.713 / 134.227 / 105.292 | 330.961 / 301.515 / 254.574 |
| KV-Brutto 1,2 × bisheriges zvE, ausdrücklich gesetztes Szenario | unverändert | unverändert | 330.961 / 327.920 / 277.144 |

Die letzte Zeile setzt Brutto explizit auf 24.000/54.000 €, **keine automatische Eingabeableitung**.
AVD-Auszahlkosten allein kosten rund 8.376/6.676/14.594 €; die ursprüngliche Sensitivität mit höheren Kosten
in beiden Phasen war deshalb wesentlich größer. DK: nur noch **190 €** Vorsprung für AVD; Restprofil oder
Förderverzug wechseln die Reihenfolge zum ETF. Keine robuste Produktüberlegenheit aus diesem Abstand ableiten.

Beste Kombi bei 450 €: 120 € ETF + 330 € AVD, rund 469.602 €; bei 300 € weiterhin 150/150 als gleichwertige
Alternative, Maximum 110/190 mit rund 285 € Abstand. Bei 1.000 € 430/570, rund 994.191 €, rund 12.412 € vor
850/150. Die erschöpfende Gegenprüfung bleibt enthalten; diese Zahlen sind Modellvergleiche, keine Prognosen.

## H1/H2 und offene Zuordnungen: geprüft, nicht als geklärt ausgegeben

**H1:** `latentTax` verteilt Kapital rechnerisch über die Restlaufzeit der verstorbenen Person, mit deren
`incRet` und einem zum Bewertungsjahr fixierten Tarifindex. Es modelliert weder Alter/Einkommen/Vertrag des
überlebenden Ehepartners noch dessen tatsächliches späteres Wachstum, Abzüge und Auszahlprofil. Der Wert ist
kein eigener Hinterbliebenen-Auszahlplan und keine heute fällige Steuer. Ein bloßer Austausch `incRet → incHeir`
würde nur einen anderen scheinpräzisen Wert schaffen. Eine belastbare neue Rechnung benötigt eigene
Hinterbliebenen-Eingaben und einen expliziten künftigen Zahlungsplan; deshalb bleibt die Approximation erhalten
und wird nun auch direkt im Erbfall-Panel kenntlich gemacht. Restrenten werden als künftige Zahlungen summiert,
in Realanzeige mit Inflation abgezinst, nicht als sofort liquide Todesfallleistung ausgegeben. Ihre Steuer wird
jahrweise mit `incHeir` berechnet. Kein zusätzlicher Diskontierungszins oder sicherer Wiederanlageertrag erfunden.

**H2:** Der ungeförderte Vertragsteil führt bereits `Bu`/`basesU`: Einzahlungen erhöhen, anteilige Entnahmen
vermindern die Basis; Renditen erhöhen sie nicht. Das bleibt erhalten. Im geförderten Teil werden eigene
Restbeiträge, Zulagen und Rückzahlungsbetrag nach Rentenbeginn weiterhin über `V/C0` angenähert. Positive
Rendite kann damit eine verbrauchte Basis rechnerisch wieder erhöhen; diese bekannte Schwäche bleibt
**offen**, einschließlich Zuordnung schon förderunschädlich ausgezahlter Raten. Ein bloßes Umschalten auf
Restjahre/Gesamtjahre wäre eine alternative Konvention, keine nachgewiesene Zuordnungsformel für das neue AVD.
[`§ 22 Nr. 5 S. 2 c/S. 3`](https://www.gesetze-im-internet.de/estg/__22.html) und
[`§ 93 Abs. 1 EStG`](https://www.gesetze-im-internet.de/estg/__93.html) belegen Gewinn-/Rückzahlungsprinzip,
aber nicht die konkrete neue AVD-Zuordnung nach Teilentnahmen. Deshalb keine neue Rechtsformel für H2.
Gilt auch für offene Ansprüche bei V2 und die zusätzliche SA-Wechselwirkung aus R3; genaue Erbwerte setzen
Anbieter-/ZfA-Abrechnungen voraus. H1/H2 ändern `cumH` nicht.

- **E4:** Soli auf hinzugerechnete Zulagen bleibt offen. § 3 Abs. 2 SolZG ist ein Wortlautargument, keine neu
  bestätigte AVD-Verwaltungsaussage. Keine Änderung auf dieser Grundlage allein.
- **E9:** Die BVSz § 5 Abs. 4 nennt Versicherungsunternehmen, nicht ausdrücklich das AVD. Weder ganze
  ungeförderte Rate gegenüber Gewinnanteil noch 1/120 gegenüber 1/12 der Teilauszahlung neu entschieden.
  Bestehende Rechnung bleibt: ganze Rate und gesonderter 10×KV-Spielraum für 30 %. Dieser separate Topf
  kann zu viel Beitrag verlangen; keine pauschale Behauptung, jede offene Alternative sei günstiger.
- **E12:** Bestehende Riester-Verträge kennen ungeförderte Fortsetzung ohne Förderberechtigung; daraus folgt
  keine belegte Zugangsregel zu neuen AVD-Verträgen. Weiter Nebendepot in diesen Jahren.
- **E13:** Keine zusätzliche fünfjährige Mindestbeitragsdauer eingeführt. § 22 Nr. 5 verweist auf zwölf Jahre
  Laufzeit und das maßgebliche Auszahlungsalter; eine zusätzliche AVD-Regel ist nicht belegt.

Das im vorangegangenen unabhängigen Review geprüfte BMF-Schreiben vom 05.10.2023 (Rn. 148/149, 155,
229/230, 232 ff.) bleibt die dokumentierte Riester-Referenz. Der erneute Abruf von PDF und amtlicher
Handbuchfassung scheiterte in diesem Lauf (Fehlerseite/503); daraus wird **kein** neuer Primärnachweis für eine
AVD-Zuordnung behauptet. AVRG, EStG/InvStG und BVSz wurden direkt gelesen. Keine neue Mindestbeitragsdauer,
AVD-KV-Auslegung oder Bearbeitungsfrist ergänzt.

## Validierung

`tests/review-rest.test.ts` ergänzt unabhängige Jahres-Cashflows: VP-Zufluss, Quellensteuer und eigener
Verkaufsgewinn, volle Basisanrechnung, Jahreswechsel in Rente/Erbfall, vollständige Entnahme, KV 0/10/30 %,
beide Teilfreistellungen; außerdem gemeinsamer Tarif nach KV/AVD-SA für niedrige bis hohe Einkommen,
kurze Versicherungsverträge, ein Pauschbetrag, marginale AVD-Teilauszahlung, getrennte KV-Eingaben,
Link-/Speicher-Rundweg, Nullrendite-Bilanz des Förderverzugs und getrennte Auszahlkosten.

Historische Golden-/I1-Vergleiche bleiben mit ausgeschalteten neuen Fixes bitgleich. Neue Params sind
explizit als zusätzliche Schlüssel zugelassen; keine Referenzformel geändert. Alte R1/R2-Tests bleiben erhalten:
R2-Entstehungsjahrtest schaltet nur R4 ab, marginaler R1-Test nur R3; neue Tests prüfen das Zusammenwirken.
Die KV-BBG-Tests nutzen jetzt ausdrücklich `kvGrossRet`, Beispiele mit hoher belegter BBG setzen diese auch.

**I4:** `min(Tarif,Abgeltung)` ist am Wechsel nicht konvex. Die strikte historische Konvexitätsprüfung läuft
zusätzlich ohne R3 (und ohne nominale Rundung); aktuelle gemeinsame Steuer-/KV-Bilanzen bleiben unabhängig
geprüft. Kein neuer großzügiger Euro-Toleranzwert zur Kaschierung eines Rechenfehlers.
Fixkombinationen: alle historischen E-Teilmengen, alle 16 Teilmengen des neuen R-Pakets auf dem geprüften
Ausgangsstand, jeder Fix allein und jeder einzeln ausgeschaltet sowie ALL/NO; nicht exponentiell alle 32.768
Teilmengen mal sämtliche Suchszenarien. Die Suche wird weiterhin gegen erschöpfende Suche geprüft.

Die zusätzlichen Jahresprüfungen und Szenariozeilen erhöhen die Laufzeit. Messgrenzen wurden dafür begründet
angepasst (Robustheitszeile Median <50 statt <30 ms; `analyze+scenarios` <3,5× statt <1,5× Referenz).
Eine Einzelrechnung bleibt <0,5 ms, Suche 4 Produkte/500 € <30 ms, `analyzeCombo` <5 ms in den Laufzeittests.


**Abschluss:** `npx vitest run`: **13 Dateien, 257 Tests grün** (einschließlich Golden-, Kombi-, Such- und Fix-Tests).
`npm run check`: **0 Fehler, 0 Warnungen**. Produktionsbuild erfolgreich; die vorhandenen Vite-Hinweise zum
klassischen `theme.js` auf den drei HTML-Seiten bleiben unverändert. Keine Browser-/e2e-Prüfung.
