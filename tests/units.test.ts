import { describe, expect, it } from 'vitest';
import { decodeState, encodeState, sameInputs } from '../src/lib/link';
import { sanitize } from '../src/lib/storage';
import { DEFAULTS, INPUT_KEYS, type Inputs } from '../src/lib/engine/inputs';
import { parseDe } from '../src/lib/number';

describe('Link-Format', () => {
  it('Standardwerte ergeben einen kurzen Link', () => {
    expect(encodeState({ ...DEFAULTS }, 'overview')).toBe('v=1');
  });
  it('Hin- und Rückweg erhält alle Werte und den Tab', () => {
    const v: Inputs = { ...DEFAULTS, a0: 31, incWork: 61234.5, kvOn: true, etfOn: false, g: -1.5, real: false };
    const d = decodeState('#' + encodeState(v, 'heirs'));
    expect(d.tab).toBe('heirs');
    expect(sameInputs(d.inputs!, v)).toBe(true);
  });
  it('Zufällige Eingaben überstehen den Hin- und Rückweg', () => {
    for (let n = 0; n < 200; n++) {
      const v = { ...DEFAULTS } as Inputs;
      for (const k of INPUT_KEYS) {
        if (typeof DEFAULTS[k] === 'boolean') (v[k] as boolean) = Math.random() < 0.5;
        else (v[k] as number) = Math.round((Math.random() * 2000 - 500)) / 10;
      }
      expect(sameInputs(decodeState(encodeState(v, 'overview')).inputs!, v)).toBe(true);
    }
  });
  it('Nur Tab, kein Szenario', () => {
    expect(decodeState('#t=detail')).toEqual({ inputs: null, tab: 'detail', unsupported: false });
  });
  it('Unbekannte Version wird nicht geladen', () => {
    expect(decodeState('#v=9&a0=40').unsupported).toBe(true);
  });
  it('Müll wird ignoriert', () => {
    const d = decodeState('#a0=&incWork=1e999&kvOn=ja&g=5&__proto__=1');
    expect(d.inputs!.a0).toBe(DEFAULTS.a0);
    expect(d.inputs!.incWork).toBe(DEFAULTS.incWork);
    expect(d.inputs!.kvOn).toBe(DEFAULTS.kvOn);
    expect(d.inputs!.g).toBe(5);
  });
});

describe('Gespeicherte Werte prüfen', () => {
  it('übernimmt nur bekannte Felder mit passendem Typ', () => {
    const s = sanitize({ a0: 30, incWork: '50000', kvOn: 1, g: NaN, evil: 'x' })!;
    expect(s.a0).toBe(30);
    expect(s.incWork).toBe(DEFAULTS.incWork);
    expect(s.kvOn).toBe(DEFAULTS.kvOn);
    expect(s.g).toBe(DEFAULTS.g);
    expect('evil' in s).toBe(false);
  });
  it('lehnt Unbrauchbares ab', () => {
    expect(sanitize(null)).toBeNull();
    expect(sanitize('x')).toBeNull();
    expect(sanitize({ foo: 1 })).toBeNull();
  });
});

describe('Deutsche Zahleneingabe', () => {
  it.each([
    ['38.000', 38000], ['38000', 38000], ['1.234.567', 1234567], ['0,2', 0.2], ['0.2', 0.2], ['1.234,5', 1234.5],
    ['-2', -2], ['−2,5', -2.5], [' 150 € ', 150], ['6 %', 6], ['.5', 0.5],
  ])('%s → %d', (s, x) => expect(parseDe(s)).toBe(x));
  it.each(['', 'abc', '1,2,3', '--1', '1e5', '-'])('„%s“ ist ungültig', s => expect(parseDe(s)).toBeNull());
});
