// Zukunftstest: Was passiert, wenn eine neue Rechtsstand-Tabelle dazukommt und CURRENT_LAW darauf zeigt?
// Läuft die ganze Unit-Suite mit einer erfundenen, in sich stimmigen Tabelle (tests/probe/law-probe.ts) als CURRENT_LAW
// und verlangt, dass genau die erwarteten Tests rot werden: das Live-Fixture (bewusst neu zu erzeugen) und sonst nichts.
// Golden, I1, die an 2026 gebundenen Regeltests (tests/helpers/law-2026.ts), Konsistenz und Vergiftungstest müssen grün
// bleiben; schlägt etwas anderes an, mischt ein Test oder die App zwei Rechtsstände.
// Scheitert auch bei Fehlern außerhalb von Tests (unbehandelte Fehler, Hooks, Dateien, die nicht laden, vitest-Absturz).
//   npm run test:law-probe
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Tests, die mit einer neuen Tabelle rot werden MÜSSEN (Datei, Testname als Muster).
const EXPECTED = [
  ['live-regression.test.ts', /Live-Rechnung = eingefrorenes Fixture/],
];

const dir = mkdtempSync(join(tmpdir(), 'law-probe-'));
const out = join(dir, 'result.json');
const errors = [];
try {
  const run = spawnSync('npx', ['vitest', 'run', '--config', 'vitest.lawprobe.config.ts', '--reporter=json', '--reporter=default', '--outputFile.json=' + out], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const log = (run.stdout || '') + (run.stderr || '');
  if (run.error) errors.push('vitest nicht gestartet: ' + run.error.message);
  if (run.signal) errors.push('vitest abgebrochen (Signal ' + run.signal + ')');
  if (/Unhandled (Rejection|Error)s?\b|caught \d+ unhandled/.test(log)) errors.push('Unbehandelte Fehler während der Tests:\n' + log.split('\n').filter(l => /Unhandled|unhandled|Error:/.test(l)).slice(0, 10).join('\n'));
  if (!existsSync(out)) {
    errors.push('vitest hat kein Ergebnis geschrieben (Exit ' + run.status + '):\n' + log.split('\n').slice(-20).join('\n'));
  } else {
    const res = JSON.parse(readFileSync(out, 'utf8'));
    const failed = [];
    for (const f of res.testResults) {
      const file = f.name.split('/').pop();
      const bad = f.assertionResults.filter(a => a.status === 'failed');
      for (const a of bad) failed.push([file, a.fullName]);
      // Datei rot ohne rote Assertion: lädt nicht, Hook-Fehler o. Ä.
      if (f.status !== 'passed' && bad.length === 0) errors.push('Datei rot ohne roten Test (lädt nicht oder Hook-Fehler): ' + file + ': ' + (f.message || '').split('\n')[0]);
    }
    const isExpected = ([file, name]) => EXPECTED.some(([f, re]) => f === file && re.test(name));
    for (const [f, n] of failed.filter(x => !isExpected(x))) errors.push('Unerwartet rot: ' + f + ' › ' + n);
    for (const [f, re] of EXPECTED.filter(([f, re]) => !failed.some(([file, name]) => file === f && re.test(name)))) errors.push('Hätte rot werden müssen (Probe-Tabelle nicht aktiv?): ' + f + ' ' + re);
    if (!errors.length) console.log(`Probe-Rechtsstand: ${res.numTotalTests} Tests, rot nur das Live-Fixture.`);
  }
  if (errors.length) {
    for (const e of errors) console.error(e);
    console.error('Probe-Rechtsstand: fehlgeschlagen (siehe oben).');
  }
  process.exitCode = errors.length ? 1 : 0;
} finally {
  rmSync(dir, { recursive: true, force: true });
}
