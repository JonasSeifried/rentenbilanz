// Zukunftstest: Was passiert, wenn eine neue Rechtsstand-Tabelle dazukommt und CURRENT_LAW darauf zeigt?
// Läuft die ganze Unit-Suite mit einer erfundenen, in sich stimmigen Tabelle (tests/probe/law-probe.ts) als CURRENT_LAW
// und verlangt, dass genau die erwarteten Tests rot werden: das Live-Fixture (bewusst neu zu erzeugen) und sonst nichts.
// Golden, I1, die an 2026 gebundenen Regeltests (tests/helpers/law-2026.ts), Konsistenz und Vergiftungstest müssen grün
// bleiben; schlägt etwas anderes an, mischt ein Test oder die App zwei Rechtsstände.
//   npm run test:law-probe
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Tests, die mit einer neuen Tabelle rot werden MÜSSEN (Datei, Testname als Muster).
const EXPECTED = [
  ['live-regression.test.ts', /Live-Rechnung = eingefrorenes Fixture/],
];

const dir = mkdtempSync(join(tmpdir(), 'law-probe-'));
const out = join(dir, 'result.json');
try {
  spawnSync('npx', ['vitest', 'run', '--config', 'vitest.lawprobe.config.ts', '--reporter=json', '--outputFile=' + out], { stdio: ['ignore', 'ignore', 'inherit'] });
  const res = JSON.parse(readFileSync(out, 'utf8'));
  const failed = [], broken = [];
  for (const f of res.testResults) {
    const file = f.name.split('/').pop();
    if (f.status !== 'passed' && f.assertionResults.length === 0) broken.push(file + ': ' + (f.message || '').split('\n')[0]);
    for (const a of f.assertionResults) if (a.status === 'failed') failed.push([file, a.fullName]);
  }
  const isExpected = ([file, name]) => EXPECTED.some(([f, re]) => f === file && re.test(name));
  const unexpected = failed.filter(x => !isExpected(x));
  const missing = EXPECTED.filter(([f, re]) => !failed.some(([file, name]) => file === f && re.test(name)));
  const ok = !broken.length && !unexpected.length && !missing.length;
  for (const b of broken) console.error('Datei lädt nicht: ' + b);
  for (const [f, n] of unexpected) console.error('Unerwartet rot: ' + f + ' › ' + n);
  for (const [f, re] of missing) console.error('Hätte rot werden müssen (Probe-Tabelle nicht aktiv?): ' + f + ' ' + re);
  console.log(ok
    ? `Probe-Rechtsstand: ${res.numTotalTests} Tests, rot nur das Live-Fixture.`
    : 'Probe-Rechtsstand: Tests mischen Rechtsstände oder lesen Jahreswerte nicht aus der Tabelle (siehe oben).');
  process.exitCode = ok ? 0 : 1;
} finally {
  rmSync(dir, { recursive: true, force: true });
}
