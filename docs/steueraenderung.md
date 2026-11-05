# Was-wäre-wenn: Steueränderung

Der Rechner rechnet mit dem heutigen Steuerrecht (Stand 2026) für die ganze Laufzeit und nimmt keine künftige Gesetzesänderung
vorweg. Weil die Produkte an verschiedenen Steuern hängen, lässt sich eine Änderung als **hypothetische Sensitivität**
durchrechnen: `abgRate`, `estAdd` und `taxFrom` unter „Weitere Einstellungen“, „Modellannahmen und Sensitivitäten“.
Standard (25 %, 0, ab Rentenbeginn) ist bitgleich zum bisherigen Verhalten (`tests/steueraenderung.test.ts`).

## Warum die Produkte verschieden betroffen sind

| Produkt | Steuer | Bemessungsgrundlage | Fundstelle |
|---|---|---|---|
| ETF-Depot, aktiver Fonds | Abgeltungsteuer 25 % (Günstigerprüfung möglich) | Gewinn bei Verkauf, Vorabpauschale; Aktienfonds 70 % (Teilfreistellung) | § 32d, § 20 Abs. 2 EStG; § 20 InvStG |
| Altersvorsorgedepot | Einkommensteuer, persönlicher Satz | ganze Auszahlung, soweit auf geförderten Beiträgen | § 22 Nr. 5 S. 1 und 2 EStG |
| Versicherung, Kapital, nach 12 Jahren und ab 62 | Einkommensteuer | Hälfte des Unterschiedsbetrags nach 15 % Teilfreistellung | § 20 Abs. 1 Nr. 6 S. 2 und 9, § 52 Abs. 28 S. 7 EStG |
| Versicherung, Kapital, sonst | Abgeltungsteuer | Unterschiedsbetrag nach 15 % Teilfreistellung | § 20 Abs. 1 Nr. 6 S. 1, § 32d EStG |
| Versicherung, Leibrente | Einkommensteuer | Ertragsanteil | § 22 Nr. 1 S. 3 Buchst. a Doppelbuchst. bb EStG |

Die gleiche Erhöhung in Prozentpunkten trifft also verschieden große Beträge. Wie stark, hängt von Einkommen, Laufzeit und
Gewinnanteil ab. Deshalb rechnet der Rechner das aus, statt es pauschal zu behaupten.

## Bisherige Übergangsregeln (Bestandsschutz)

- **2005, Versicherungen:** Vor dem 01.01.2005 abgeschlossene Kapitallebensversicherungen bleiben nach altem Recht
  (§ 20 Abs. 1 Nr. 6 EStG in der Fassung vom 31.12.2004) steuerfrei: § 52 Abs. 28 S. 5 EStG, Alterseinkünftegesetz vom
  05.07.2004. Die genauen Bedingungen der alten Steuerfreiheit (u. a. 12 Jahre Laufzeit) stehen im alten Recht und sind hier
  nicht im Einzelnen geprüft.
- **2009, Wertpapiere:** Bei Einführung der Abgeltungsteuer (Unternehmensteuerreformgesetz 2008, BGBl. 2007 I S. 1912)
  blieben Kursgewinne auf vor dem 01.01.2009 gekaufte Wertpapiere nach einem Jahr Haltedauer steuerfrei:
  § 52a Abs. 11 S. 4 EStG a. F.
- **2018, Fonds:** Für diese Alt-Anteile an Investmentfonds sind Wertsteigerungen ab 01.01.2018 steuerpflichtig, soweit der
  Gewinn 100.000 € je Person übersteigt: § 56 Abs. 6 S. 1 Nr. 2 InvStG.
- **Verfassungsrecht:** BVerfG, Beschluss vom 07.07.2010, 2 BvL 14/02, 2 BvL 2/04, 2 BvL 13/05 (BVerfGE 127, 1), zur
  Verlängerung der Spekulationsfrist für Grundstücke: Eine Änderung für künftige Veräußerungen ist eine unechte Rückwirkung
  und grundsätzlich zulässig. Wertzuwächse, die bis zur Verkündung (31.03.1999) entstanden waren und nach altem Recht
  steuerfrei hätten realisiert werden können, dürfen nicht nachträglich besteuert werden. Die Übertragung auf Depots und
  Versicherungen ist eine eigene Wertung.

Daraus folgt nur: Bisher wurden bestehende Verträge und Anteile meist geschützt, ein Anspruch darauf besteht nicht. Der
Rechner rechnet **ohne Bestandsschutz** (schärfste Annahme). Einen Schalter „Halbierung bei der Versicherung fällt weg“ gibt
es bewusst nicht: Eine solche Änderung träfe nach bisheriger Praxis eher neue Verträge.

## Rechnung (`src/lib/engine/combo.ts`)

- **Stichtag:** `tChange` = Rentenbeginn (`taxFrom` = −1) oder Jahr des Alters `taxFrom` (nicht vor heute). Ab diesem Jahr
  gelten beide Änderungen für alle Zahlungen, Verkäufe, Vorabpauschalen, die Günstigerprüfung und die Erben; davor heutiges
  Recht (auch für Beiträge und Erstattungen in der Ansparphase).
- **Abgeltungsteuer:** `abg(t)` ersetzt die Konstante `ABG`. Mit Kirchensteuer verallgemeinert aus § 32d Abs. 1 S. 3–4 EStG
  (S. 3: Ermäßigung um 25 % der Kirchensteuer; S. 4: ESt = (e − 4q)/(4 + k)): ESt = e · s/(1 + s · k), insgesamt
  s · (1,055 + k)/(1 + s · k). **Annahme:** Auch die 25 % in S. 3 folgen dem neuen Satz. Bliebe S. 3 bei 25 %, wäre
  ESt = e · s/(1 + 0,25 · k) (bei s = 30 %, k = 9 %: 33,59 % statt 33,45 % einschließlich Soli und Kirchensteuer). Bei
  s = 25 % exakt der bisherige Ausdruck. Teilfreistellung und Sparer-Pauschbetrag bleiben gleich. Bei 0 % wird die
  Bemessungsgrundlage der kurzen Versicherungsleistung direkt geführt statt über Steuer ÷ Satz zurückgerechnet.
- **Einkommensteuer:** `estAddAt(t)` Prozentpunkte zusätzlicher Grenzsteuersatz oberhalb des Grundfreibetrags
  (12.348 €, heutiges Geld, mit dem Tarif indexiert): tarifliche ESt + d · max(0, zvE − 12.348 €), mindestens 0. Soli und
  Kirchensteuer darauf, bei Splitting je Hälfte. Grundfreibetrag und Tarifzonen bleiben. Negativ = Senkung (bis −14 Punkte,
  der Eingangssteuersatz).
- **Szenarien:** Bei heutigem Recht zwei Zeilen „Abgeltungsteuer 30 % statt 25 %“ und „Einkommensteuer 5 Prozentpunkte
  höher“ (je ab dem Stichtag), sonst eine Zeile „Steuerrecht wie heute“. Sie zählen in der Robustheit mit.

## Gemessene Wirkung (Summe der Auszahlungen bis 90, heutige Kaufkraft, ab Rentenbeginn)

| Fall | Annahme | ETF-Depot | Altersvorsorgedepot | Versicherung |
|---|---|---:|---:|---:|
| Default | heute | 153.289 € | 174.856 € | 127.694 € |
| Default | Abgeltungsteuer 30 % | −107 € | −10 € | −51 € |
| Default | Einkommensteuer +5 | −753 € | −10.712 € | −2.458 € |
| DK (KV freiwillig 21,7 %) | Abgeltungsteuer 30 % | −82 € | −5 € | −33 € |
| DK | Einkommensteuer +5 | −92 € | −8.299 € | −970 € |
| High (30 J., 110.000 €, 500 €/Monat) | Abgeltungsteuer 30 % | −9.073 € | −332 € | −3.306 € |
| High | Einkommensteuer +5 | +1.926 € | −8.298 € | −1.937 € |

Erläuterungen:
- Default: Mit 20.000 € Einkommen im Alter ist der persönliche Satz auf die Fondsgewinne niedriger als 26,375 %; die
  Günstigerprüfung (§ 32d Abs. 6) wählt ihn. Deshalb trifft eine höhere Abgeltungsteuer das ETF-Depot kaum, eine höhere
  Einkommensteuer dagegen schon.
- Versicherung bei Abgeltungsteuer: Die Kapitalauszahlung selbst ist unverändert (Einkommensteuer); betroffen ist nur das
  Folgedepot, aus dem sie bis 90 ausgezahlt wird.
- AVD bei Abgeltungsteuer: nur das Nebendepot mit den angelegten Erstattungen.
- High, ETF +1.926 €: Die KV/PV auf die ETF-Erträge ist als Sonderausgabe abziehbar (R1); bei höherem Steuersatz entlastet
  dieser Abzug die übrige Rente stärker. Die Abgeltungsteuer auf die ETF-Gewinne selbst ändert sich nicht.

## Offene Punkte

- Grob geschätzte latente Steuer auf das AVD (Bewertung bei Rentenbeginn, Übertrag auf den Ehepartner im Erbfall,
  `latentTax`/`latentTaxO`): verteilt den Wert auf die Restjahre, rechnet aber jedes Jahr mit dem Satz des
  Bewertungsjahres. Liegt der Stichtag später, fehlt dort die Änderung.
- Die Szenarien „Abgeltungsteuer 30 %“ und „Einkommensteuer +5“ ändern bei Standardwerten die Zahl der Szenarien
  (Robustheitssatz, Kombi-Ergebnissatz); die Rechnung selbst bleibt bitgleich.
- Andere denkbare Änderungen (Teilfreistellung, Sparer-Pauschbetrag, Besteuerungsanteil, Halbierungsregel, Vorabpauschale)
  sind nicht als Feld vorhanden.
- Fassung des § 22 Nr. 5 EStG ab 01.01.2027 (Altersvorsorgereformgesetz, BGBl. 2026 I Nr. 156) nicht im Volltext geprüft;
  die nachgelagerte volle Besteuerung geförderter Leistungen ist nach geltendem Recht belegt.
