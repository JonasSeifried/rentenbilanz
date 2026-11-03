import { describe, expect, it } from 'vitest';
import { DEFAULTS } from '../src/lib/engine/inputs';
import { decodeState, encodeState } from '../src/lib/link';

describe('Kombi-Modus im Link', () => {
  it('Kombi-Schlüssel überstehen Kodieren und Dekodieren', () => {
    const inp = { ...DEFAULTS, combo: true, cBudget: 500, cEtf: 200, cAvd: 150, cIns: 150, cFond: 0 };
    const q = encodeState(inp, 'overview');
    expect(q).toContain('combo=1');
    expect(q).toContain('cBudget=500');
    expect(decodeState('#' + q).inputs).toEqual(inp);
  });
  it('Standardwerte erzeugen keine Kombi-Schlüssel', () => {
    expect(encodeState({ ...DEFAULTS }, 'overview')).not.toMatch(/combo|cBudget|cEtf/);
  });
});
