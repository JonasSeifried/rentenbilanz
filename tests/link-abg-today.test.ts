// Heute (Satz der neuesten Tabelle = 25 % = Basiswert der Link-Basis v1) ändert die Rechtsstand-Regel für abgRate
// (link.ts LAW_KEYS) nichts: Kodieren und Dekodieren bitgleich zum bisherigen Verfahren (Abweichung von LINK_BASE_V1).
import { describe, expect, it } from 'vitest';
import { decodeState, encodeState, LINK_BASE_V1, LINK_VERSION } from '../src/lib/link';
import { BOOL_KEYS, DEFAULTS, INPUT_KEYS, inLimits, type InputKey, type Inputs } from '../src/lib/engine/inputs';
import { CURRENT_LAW } from '../src/lib/engine/law';

function oldEncode(inputs: Inputs): string {
  const q = new URLSearchParams(); q.set('v', LINK_VERSION);
  for (const k of INPUT_KEYS) { const v = inputs[k]; if (v === LINK_BASE_V1[k]) continue; q.set(k, typeof v === 'boolean' ? (v ? '1' : '0') : String(v)); }
  return q.toString();
}

describe('abgRate im Link: heute bitgleich', () => {
  it('Voraussetzung: geltender Satz = Basiswert 25', () => {
    expect(CURRENT_LAW.abg.rate).toBe(.25);
    expect(DEFAULTS.abgRate).toBe(LINK_BASE_V1.abgRate);
  });
  it('Zufallseingaben: gleicher Link wie bisher, Rundreise exakt', () => {
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let n = 0; n < 500; n++) {
      const i = { ...DEFAULTS } as Record<string, unknown>;
      for (const k of INPUT_KEYS) {
        if (rnd() >= .3) continue;
        if (BOOL_KEYS.has(k)) { i[k] = rnd() < .5; continue; }
        const x = (LINK_BASE_V1[k] as number) + Math.round(rnd() * 10);
        if (inLimits(k as InputKey, x)) i[k] = x; // außerhalb der Grenzen verwirft der Link den Wert ohnehin
      }
      if (rnd() < .3) i.abgRate = rnd() < .5 ? 25 : Math.round(rnd() * 60);
      const inp = i as unknown as Inputs;
      const s = encodeState(inp, 'overview');
      expect(s).toBe(oldEncode(inp));
      expect(decodeState('#' + s).inputs).toEqual(inp);
    }
  });
  it('bestehende Links: fehlend → 25, ausdrücklich → wie geschrieben', () => {
    expect(decodeState('#v=1&a0=40').inputs!.abgRate).toBe(25);
    expect(decodeState('#a0=40').inputs!.abgRate).toBe(25);
    expect(decodeState('#v=1&abgRate=30').inputs!.abgRate).toBe(30);
    expect(decodeState('#v=1&abgRate=25').inputs!.abgRate).toBe(25);
    expect(decodeState('#v=1').inputs).toEqual(LINK_BASE_V1);
  });
});
