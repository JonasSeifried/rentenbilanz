# Neutrale Darstellung und Kosten-Gleichstand

**Stand:** 05.11.2026. Entscheidung des Betreibers: Der Rechner sagt nicht, welches Produkt das beste ist. Er zeigt
Zahlen, Abstände und die Annahmen, an denen sie hängen. Die Rechnung selbst ist unverändert (Golden-Tests grün).

## Was sich in der Oberfläche geändert hat

| Stelle | Vorher | Jetzt |
|---|---|---|
| Ergebnis (`verdict.ts`) | „Rechnerisch vorne: …“, „Knapp vorne“, „Kein klarer Favorit“, Farbmarke des Siegers | „Ø netto im Monat (67–90): ETF-Depot …, Altersvorsorgedepot …“ in fester Reihenfolge; je Produkt ein Satz „X zahlt bis 90 rund Y € (Z %) mehr/weniger aus als das ETF-Depot“ |
| Kacheln | Rand und Badge „vorne“ | ohne Hervorhebung, feste Reihenfolge (ETF, AVD, Versicherung, Fonds, Kombi) |
| Szenarien | Spalte „Vorne“, fett markierte Zelle, gelb = „anderes Produkt vorne“ | keine Spalte „Vorne“, keine Markierung; gelb = „mindestens ein Abstand zwischen zwei Produkten kehrt sich um“ |
| Überschrift Szenarien | „Was das Ergebnis kippen würde“ | „Wann sich die Abstände umkehren“ |
| Robustheit | „Das Ergebnis hält in allen …“, „liegt ein anderes Produkt vorne“ | „In N von M Szenarien kehrt sich mindestens ein Abstand zwischen zwei Produkten um“ |
| Rente im Detail, Erbfall | fett markierter größter/kleinster Wert | keine Markierung |
| Mobile Ergebnisleiste | Siegersatz mit Farbmarke | „Ø netto/Monat: ETF … · AVD … · …“ |
| Kombi-Dialog | beste Aufteilung automatisch berechnet und genannt | Suche nur auf Knopfdruck (siehe unten), Texte „Aufteilung mit der höchsten Summe unter diesen Annahmen“ |
| Glossar, häufige Fragen, Rechenweg | „lohnt sich“, „keinen fairen Gewinner“, „vorne“, „Rangfolge“ | sachliche Formulierungen |

Intern bleibt `analyze().lead`: Golden- und Fix-Tests vergleichen ihn mit dem Original. Die Oberfläche nutzt ihn nicht mehr.

### Vergleichsgröße

Abstände beziehen sich auf das erste Produkt der festen Reihenfolge, in der Regel das ETF-Depot (einfachste
Vergleichsgröße, keine Förderung, jederzeit verfügbar). Ist das ETF-Depot nicht im Vergleich, ist es das nächste
Produkt. Gerechnet wird mit der Summe netto bis zum Ende des Auszahlplans in heutiger Kaufkraft (`cumHReal`, E1).

### Kombi-Suche: opt-in

Die Suche (`search.ts`) bleibt unverändert. Sie liefert die Aufteilung mit der höchsten Summe unter den Annahmen, bei
Unterschieden unter 0,1 % eine einfachere mit mehr ETF. Begründung für opt-in: Eine ungefragt genannte „beste“
Aufteilung wirkt wie eine Empfehlung, obwohl Verfügbarkeit, Bindung und Absicherung nicht in der Summe stecken. Auf
Knopfdruck („Aufteilung mit der höchsten Summe berechnen“) ist sie eine Rechnung, die die Person selbst anfordert.
Das rechnerische Maximum wird offen genannt, wenn der Rechner eine gleichwertige einfachere Aufteilung zeigt.

## Kosten-Gleichstand (`src/lib/engine/breakEven.ts`)

Für AVD (`avdCost`), Versicherung (`insEff`) und aktiven Fonds (`fondTer`) sucht der Rechner den Kostensatz, bei dem
die Summe netto bis H (heutige Kaufkraft) gleich der des ETF-Depots ist.

- **Keine neue Rechnung:** Jede Auswertung ist `single()` aus `analyze.ts`, also dieselbe Einzelrechnung wie im
  Vergleich, nur mit geändertem Kostensatz. Alle anderen Eingaben bleiben gleich, auch die ETF-Kosten.
- **Verfahren:** Bisektion zwischen 0 % und 3 % (bzw. der angenommenen Kosten, falls höher), bis das
  Intervall höchstens 0,005 Prozentpunkte breit ist; angegeben ist die Mitte (Fehler höchstens 0,0025 Prozentpunkte),
  angezeigt auf 0,01. Wegen der Rundung kann die Anzeige an einer Rundungsgrenze um 0,01 abweichen. Der Abstand bei den angenommenen Kosten ist schon bekannt; so sind es je
  Produkt etwa 10 Auswertungen (Laufzeit: Test < 15 ms für drei Produkte).
- **Auszahlphase:** Beim AVD und beim Fonds gilt der Kostensatz auch in der Auszahlphase, solange dort keine eigenen
  Kosten eingetragen sind (`avdPayCost`/`fondPayTer` = −1). Sonst wird nur die Ansparphase variiert; der Text sagt das.
- **Kein Gleichstand:** Zahlt das Produkt auch mit 0 % weniger oder auch mit 3 % mehr aus als das ETF-Depot, steht
  dort „zwischen 0 und 3 % kein Gleichstand“.
- **Nur bei fairem Vergleich** (gleiche Beiträge, Erstattung angelegt) und wenn das ETF-Depot im Vergleich ist. Für
  die Kombi wird kein Gleichstand gerechnet.
- **Aktiver Fonds mit Umschichtung (`shift`):** Der sichere Teil nach der Umschichtung ist ein Renten-/Geldmarkt-ETF mit
  ETF-Kosten (in der Auszahlphase `etfPayTer`, sonst `etfTer`; Hinweis unter Weitere Einstellungen). Variiert wird nur
  der Aktienteil; der Text nennt das.
- **Leibrente:** Der Vergleich endet wie überall mit dem Auszahlplan (H); der Text weist darauf hin, dass die Rente
  danach weiterläuft.

Angezeigt wird der Gleichstand unter den Abstandssätzen im Ergebnis und im Rechenweg (Abschnitt „Kosten-Gleichstand
mit dem ETF-Depot“).

### Werte (Standardwerte: 22 J., zvE 38.000 €, Rente-zvE 20.000 €, 150 €/Monat, 6 %)

| Fall | AVD-Kosten beim Gleichstand (angenommen 0,5 %) |
|---|---:|
| Standardwerte | 0,87 % |
| freiwillig gesetzlich versichert (KV/PV 21,1 %) | 0,50 % |
| zwei Kinder | 1,02 % |
| zvE 70.000 € | 1,33 % |

Versicherung bei Standardwerten (Kapitalauszahlung): Gleichstand bei 0,21 % Effektivkosten (angenommen 0,9 %);
aktiver Fonds: 0,07 % laufende Kosten (angenommen 1,6 %, Ausgabeaufschlag 5 % unverändert).

Einordnung: Altersvorsorgedepots gibt es erst ab 01.01.2027; die Kosten realer Produkte sind noch unbekannt. Für das
Standarddepot gilt bis zum Beginn der Auszahlphase ein Kostendeckel von 1,0 % (§ 2a Abs. 1–2 AltZertG, wie im
Glossar `standarddepot` und in `prosCons.ts`); für andere Altersvorsorgedepots gibt es keinen Deckel. Bei den Standardwerten
liegt der Gleichstand unter diesem Deckel, die Kostenannahme entscheidet also über das Vorzeichen des Abstands.
Tests: `tests/neutral.test.ts`, Laufzeit in `tests/performance.test.ts`.
