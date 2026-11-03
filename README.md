# Vorsorge-Rechner

Öffentlicher Rechner, der ETF-Depot, Altersvorsorgedepot (ab 2027), fondsgebundene Rentenversicherung und aktiven Fonds vergleicht: netto, mit Steuertarif 2026, Förderung, Vorabpauschale, Auszahlphase, Krankenversicherung und Erbfall. Rein statisch, kein Backend, keine Tracker, keine externen Anfragen.

**Name:** Arbeitstitel. Er steht nur in `src/lib/site.ts` (wird beim Build auch in die HTML-Seiten eingesetzt).

## Entwickeln

```sh
npm install
npm run dev        # http://localhost:5173
npm run build      # statische Seite in dist/
npm run test:all   # Typprüfung, Golden-/Unit-Tests, Build, Browser-Tests
```

Für die Browser-Tests einmalig: `npx playwright install chromium webkit`.

## Deploy auf Cloudflare Pages

- Build command: `npm run build`
- Build output directory: `dist`
- Node-Version kommt aus `.node-version`.

`public/_headers` setzt die Sicherheits-Header (u. a. CSP ohne fremde Quellen). Alle Pfade sind relativ, die Seite läuft auch in einem Unterordner.

## Aufbau

| Pfad | Inhalt |
|---|---|
| `legacy/index.html` | Ursprünglicher Rechner, Referenz für die Golden-Tests. Nicht ändern. |
| `src/lib/engine/` | Rechen-Engine, unverändert aus dem Original portiert (`engine.ts`, `analyze.ts`), Eingaben und Standardwerte (`inputs.ts`) |
| `src/lib/link.ts`, `storage.ts`, `state.svelte.ts` | Link-Format, Speichern im Browser, App-Zustand |
| `src/lib/glossary.ts` | Erklärtexte zu Fachbegriffen |
| `src/lib/panels/`, `src/lib/components/` | Oberfläche (Svelte 5) |
| `impressum.html`, `datenschutz.html` | Rechtliche Seiten |
| `tests/` | Golden-Tests (Original gegen Port) und Unit-Tests (Vitest) |
| `e2e/` | Browser-Tests (Playwright, Chromium und WebKit/iPhone) |

## Wichtig beim Ändern

- **Engine:** `tests/golden.test.ts` vergleicht jede Zahl mit `legacy/index.html` (29 benannte und 300 Zufallsszenarien). Rechtliche Änderungen deshalb bewusst machen: Engine ändern, Golden-Test-Erwartung dokumentiert anpassen.
- **Standardwerte** (`DEFAULTS` in `inputs.ts`) dürfen sich ändern; geteilte Links bleiben gültig, weil sie gegen eine eingefrorene Basis kodiert sind (`link.ts`, `LINK_VERSION`).
- **Rechtsstand und Prüfdatum** stehen in `src/lib/site.ts` und werden im Kopf, im Druck und in der Fußzeile angezeigt.

## Jährliche Pflege (Checkliste)

Die Rechnung nutzt Werte, die sich jedes Jahr ändern. Nach jeder Änderung: `npm run test:all`, dann Rechtsstand und Prüfdatum in `src/lib/site.ts` anpassen.

- [ ] **Januar – Basiszins** für die Vorabpauschale (BMF-Schreiben): Standardwert `basis` in `src/lib/engine/inputs.ts`, Text in `glossary.ts` (`basiszins`) und unter „Weitere Einstellungen“.
- [ ] **Einkommensteuertarif** (§ 32a EStG) und **Soli-Freigrenze**: `est()` / `soli()` in `src/lib/engine/engine.ts` (Steuerreform 2027 im Blick behalten).
- [ ] **Beitragsbemessungsgrenze KV/PV** (`KV_BBG` in `engine.ts`), **Versicherungspflichtgrenze** und **Zusatzbeitrag/Pflegesatz** (Standard `kvRate`, Texte `kvFreiwillig`/`kvRate` im Glossar).
- [ ] **Altersvorsorgedepot:** Zulagen, Höchstbeträge, Bonus, Auszahlregeln gegen das aktuelle Gesetz/BMF-Schreiben prüfen; Hinweis zum Start (`avdStart`) entfällt ab 2027 automatisch.
- [ ] Änderungen an der Rechnung bewusst machen: Golden-Tests vergleichen mit `legacy/index.html` (Korrekturen aus), `tests/fixes.test.ts` und `tests/combo*.test.ts` prüfen die aktuelle Rechnung. Abweichungen in `docs/abweichungen-vom-original.md` dokumentieren.
- [ ] Standardwerte ändern sich nur in `DEFAULTS`; die Link-Basis in `link.ts` nie ändern (sonst neue `LINK_VERSION`).

## Weitere Dokumentation

- `docs/abweichungen-vom-original.md`: Korrekturen an der ursprünglichen Rechnung mit Rechtsquellen und Wirkung.
- `docs/kombi-modus.md`: Rechenmodell des Kombi-Modus (gemeinsame Besteuerung, Suche nach der besten Aufteilung).

## Speichern und Teilen

- Eingaben werden automatisch im `localStorage` dieses Browsers gespeichert; die Adresszeile bleibt sauber.
- „Link teilen“ kopiert einen Link mit dem Szenario im `#`-Teil (wird nicht an den Server gesendet).
- Wird ein Link geöffnet und ist im Browser nichts gespeichert, wird das Szenario übernommen. Gibt es eigene, abweichende Eingaben, erscheint es im Ansichtsmodus: Nichts wird überschrieben, bis „Übernehmen“ geklickt wird.
- „Auf Standardwerte zurücksetzen“ mit Rückgängig; „Gespeicherte Eingaben löschen“ unter Weitere Einstellungen.
