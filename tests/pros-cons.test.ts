// „Was die Zahlen nicht zeigen“ (prosCons.ts): passende Produkte, Texte folgen den Annahmen, Links zeigen auf echte Felder.
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { readParams } from '../src/lib/engine/engine';
import { DEFAULTS, type Inputs } from '../src/lib/engine/inputs';
import { faqs, prosCons } from '../src/lib/prosCons';

const P = (x: Partial<Inputs> = {}) => readParams({ ...DEFAULTS, ...x });
const ALL = ['etf', 'avd', 'ins', 'fond'] as const;

describe('prosCons', () => {
  it('nur die gewählten Produkte, in Produktreihenfolge, je Seite mindestens zwei Punkte', () => {
    expect(prosCons(P(), ['avd', 'etf']).map(x => x.key)).toEqual(['etf', 'avd']);
    expect(prosCons(P(), ['ins']).map(x => x.key)).toEqual(['ins']);
    for (const x of prosCons(P(), [...ALL])) { expect(x.pros.length).toBeGreaterThanOrEqual(2); expect(x.cons.length).toBeGreaterThanOrEqual(2); }
  });
  it('folgt den Annahmen: Umschichtung, AVD-Kosten, Leibrente, Auszahlplan-Ende', () => {
    const avd = (x: Partial<Inputs>) => prosCons(P(x), ['avd'])[0].cons.map(c => c.text).join(' ');
    expect(avd({})).toContain('Gerechnet ist ein Depot ohne Umschichtung');
    expect(avd({ avdStd: true, avdSafe: 2.5 })).toContain('der Rest mit 2,5 % im Jahr');
    expect(avd({ avdCost: 0.8 })).toContain('Gerechnet: 0,8 % im Jahr');
    expect(prosCons(P(), ['ins'])[0].pros[0].text).toContain('Gerechnet ist die Kapitalauszahlung');
    expect(prosCons(P({ insLump: false }), ['ins'])[0].pros[0].text).toContain('die Rente läuft weiter');
    expect(prosCons(P({ H: 95 }), ['etf'])[0].cons.at(-1)!.text).toContain('endet mit 95');
  });
  it('jeder Link zeigt auf ein Feld mit dieser ID im angegebenen Tab', () => {
    const dir = fileURLToPath(new URL('../src/lib/panels/', import.meta.url));
    const src: Record<string, string> = {};
    for (const f of readdirSync(dir)) src[f] = readFileSync(dir + f, 'utf8');
    const file = { settings: 'Settings.svelte', detail: 'Detail.svelte', heirs: 'Heirs.svelte', overview: 'Overview.svelte' } as const;
    const points = [P(), P({ avdStd: true }), P({ insLump: false })].flatMap(p => prosCons(p, [...ALL]).flatMap(x => [...x.pros, ...x.cons]));
    const linked = points.filter(pt => pt.field);
    expect(linked.length).toBeGreaterThan(3);
    for (const pt of linked) {
      expect(pt.fieldLabel, pt.field).toBeTruthy();
      expect(src[file[pt.tab ?? 'settings']], pt.field).toContain(`id="${pt.field}"`);
    }
  });
});

describe('faqs', () => {
  it('AVD-Fragen nur mit AVD, „150 € + Rest“ nur mit AVD und ETF; keine leeren Antworten', () => {
    expect(faqs(P(), ['etf', 'avd']).map(f => f.id)).toEqual(['avd150', 'early', 'crash', 'mix']);
    expect(faqs(P(), ['etf', 'ins']).map(f => f.id)).toEqual(['early', 'crash']);
    expect(faqs(P(), ['avd']).map(f => f.id)).toEqual(['avd150', 'early', 'crash']);
    for (const f of faqs(P(), [...ALL])) for (const a of f.a) expect(a.length).toBeGreaterThan(20);
    expect(faqs(P({ g: 5, gPay: 3 }), ['etf']).find(f => f.id === 'crash')!.a[0]).toContain('(5 % bis zur Rente, 3 % danach)');
  });
});
