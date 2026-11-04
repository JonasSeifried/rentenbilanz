import { describe, expect, it } from 'vitest';
import { DEFAULTS } from '../src/lib/engine/inputs';
import { decodeState, encodeState } from '../src/lib/link';

describe('Kombi im Link', () => {
  it('Kombi-Schlüssel überstehen Kodieren und Dekodieren', () => {
    const inp = { ...DEFAULTS, combo: true, setAll: 450, etfM: 450, avdM: 450, insM: 450, fondM: 450, cEtf: 300, cAvd: 150, cIns: 0, cFond: 0 };
    const q = encodeState(inp, 'overview');
    expect(q).toContain('combo=1');
    expect(q).toContain('cEtf=300');
    expect(q).not.toContain('cIns');
    expect(decodeState('#' + q).inputs).toEqual(inp);
  });
  it('Standardwerte erzeugen keine Kombi-Schlüssel', () => {
    expect(encodeState({ ...DEFAULTS }, 'overview')).not.toMatch(/combo|cEtf|cAvd|cIns|cFond/);
  });
});
