// Regressions-Fixture der Live-Rechnung (alle Korrekturen, neueste Rechtsstand-Tabelle, Aufrufe wie in der App).
// Golden prüft nur den Originalpfad (NO_FIXES), I1 nur die E-Fixes gegen engine.ts; dieses Fixture friert das ein,
// was Nutzer tatsächlich sehen: 29 + 300 Golden-Szenarien, gezielte Fälle (Splitting, Kirchensteuer, Gehaltsverlauf,
// Umschichtung, Partner-Vertrag, Kombi, Steueränderung …) und 150 erweiterte Zufallsfälle.
// Je Fall: Kennzahlen (stats) lesbar und exakt, dazu SHA-256 über die vollständige bitgenaue Serialisierung
// (net[], vals[], Erbfall jedes Jahres mit Text, alle Skalare, Szenarien, Kombi; gezielt auch Break-even und Suche).
//
// Neu erzeugen NUR bewusst (neue Rechtsstand-Tabelle oder gewollte Rechenänderung), Diff im Bericht begründen:
//   UPDATE_LIVE_FIXTURE=1 npx vitest run tests/live-regression.test.ts
// Vollständige Serialisierung zur Fehlersuche (zwei Stände vergleichen):
//   LIVE_DUMP=/pfad/zum/ordner npx vitest run tests/live-regression.test.ts
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { computeLive, liveCases, type LiveRecord } from './live/cases';
import { CURRENT_LAW } from '../src/lib/engine/law';

const FILE = fileURLToPath(new URL('./fixtures/live-regression.json', import.meta.url));

interface Fixture { law: string; note: string; cases: LiveRecord[] }

describe('Live-Rechnung = eingefrorenes Fixture (bitgenau)', () => {
  it('alle Fälle', () => {
    const cases = liveCases();
    const results = cases.map(c => computeLive(c));
    const dump = process.env.LIVE_DUMP;
    if (dump) {
      mkdirSync(dump, { recursive: true });
      results.forEach((r, i) => writeFileSync(join(dump, String(i).padStart(3, '0') + '.txt'), r.record.id + '\n' + r.full));
    }
    const records = results.map(r => r.record);
    if (process.env.UPDATE_LIVE_FIXTURE) {
      const fx: Fixture = { law: CURRENT_LAW.id, note: 'Erzeugt mit UPDATE_LIVE_FIXTURE=1 (tests/live-regression.test.ts). Nur bewusst neu erzeugen, Diff im Bericht begründen (docs/jaehrliche-pflege.md).', cases: records };
      writeFileSync(FILE, JSON.stringify(fx, null, 1) + '\n');
      console.log(`Fixture neu geschrieben: ${records.length} Fälle`);
      return;
    }
    const fx = JSON.parse(readFileSync(FILE, 'utf8')) as Fixture;
    expect(fx.law, 'Fixture gehört zu einem anderen Rechtsstand: bewusst neu erzeugen (docs/jaehrliche-pflege.md)').toBe(CURRENT_LAW.id);
    expect(records.map(r => r.id)).toEqual(fx.cases.map(r => r.id));
    const diffs: string[] = [];
    records.forEach((r, i) => {
      const e = fx.cases[i];
      const a = JSON.stringify({ stats: r.stats, lead: r.lead, canRank: r.canRank, scen: r.scen }), b = JSON.stringify({ stats: e.stats, lead: e.lead, canRank: e.canRank, scen: e.scen });
      if (a !== b) diffs.push(`${r.id}: Kennzahlen\n  neu   ${a}\n  vorher ${b}`);
      else if (r.hash !== e.hash) diffs.push(`${r.id}: Kennzahlen gleich, aber Details (Jahreswerte/Erbfall/Szenarien/Texte) anders`);
    });
    if (diffs.length) expect.fail(`${diffs.length} von ${records.length} Fällen weichen ab:\n` + diffs.slice(0, 20).join('\n'));
    console.log(`Live-Fixture: ${records.length} Fälle bitgleich`);
  }, 120_000);
});
