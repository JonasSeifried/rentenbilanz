import { afterEach, describe, expect, it } from 'vitest';
import { decodeState, encodeState, LINK_BASE_V1, sameInputs } from '../src/lib/link';
import { clearSaved, loadSaved, sanitize, saveInputs, storageAvailable, STORAGE_KEY } from '../src/lib/storage';
import {
  COMBO_KEYS, DEFAULTS, INPUT_KEYS, LEGACY_KEYS, LIMITS, NUMERIC_KEYS, type Inputs,
} from '../src/lib/engine/inputs';
import { parseDe } from '../src/lib/number';

describe('Link-Format', () => {
  it('Standardwerte ergeben einen kurzen Link', () => {
    // Gegen die eingefrorene Basis prüfen, nicht gegen DEFAULTS: Standardwerte dürfen sich ändern,
    // die Basis von Version 1 nie.
    expect(encodeState({ ...LINK_BASE_V1 }, 'overview')).toBe('v=1');
  });
  it('Neue Standardwerte erscheinen im Link, wenn sie von der Basis abweichen (kvRate 21,1)', () => {
    expect(encodeState({ ...DEFAULTS }, 'overview')).toBe('v=1&kvRate=21.1');
    expect(decodeState('#v=1&kvRate=21.1').inputs!.kvRate).toBe(21.1);
  });
  it('Alter Link ohne neue Schlüssel: Kombi aus, Erben-Einkommen und KV-Frage wie bisher', () => {
    const d = decodeState('#v=1&a0=40&kvOn=1&kvRate=21.7').inputs!;
    expect(d.a0).toBe(40);
    expect(d.combo).toBe(false);
    expect(d.incHeir).toBe(38000);
    expect(d.kvKind).toBe(0);
    expect(d.cEtf).toBe(0);
    expect(d.kvRate).toBe(21.7); // Basiswert bleibt, wenn der Link nichts sagt
    expect(decodeState('#v=1&a0=40').inputs!.kvRate).toBe(21.7);
  });
  it('Neue Schlüssel stehen in der Basis, Kombi-Schlüssel sind kein Altbestand', () => {
    for (const k of INPUT_KEYS) expect(k in LINK_BASE_V1).toBe(true);
    for (const k of COMBO_KEYS) expect(LEGACY_KEYS).not.toContain(k);
    expect(LEGACY_KEYS).not.toContain('incHeir');
    expect(LEGACY_KEYS).not.toContain('kvKind');
    expect(LEGACY_KEYS).not.toContain('avdStd');
    expect(LEGACY_KEYS).not.toContain('avdSafe');
    expect(LEGACY_KEYS.length + COMBO_KEYS.length + 13).toBe(INPUT_KEYS.length);
  });
  it('Jeder numerische Schlüssel hat Grenzen, die den Standardwert enthalten', () => {
    for (const k of NUMERIC_KEYS) {
      const [lo, hi] = LIMITS[k];
      expect(DEFAULTS[k]).toBeGreaterThanOrEqual(lo);
      expect(DEFAULTS[k]).toBeLessThanOrEqual(hi);
    }
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
        else {
          const [lo, hi] = LIMITS[k as (typeof NUMERIC_KEYS)[number]];
          (v[k] as number) = Math.round((lo + Math.random() * (hi - lo)) * 10) / 10;
        }
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
  it('Werte außerhalb der Grenzen werden ignoriert', () => {
    const d = decodeState('#incWork=1e300&setAll=1e200&a0=-5&kids=99&g=5&kvKind=7').inputs!;
    expect(d.incWork).toBe(LINK_BASE_V1.incWork);
    expect(d.setAll).toBe(LINK_BASE_V1.setAll);
    expect(d.a0).toBe(LINK_BASE_V1.a0);
    expect(d.kids).toBe(LINK_BASE_V1.kids);
    expect(d.kvKind).toBe(0);
    expect(d.g).toBe(5);
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
  it('verwirft Werte außerhalb der Grenzen', () => {
    const s = sanitize({ a0: 30, incWork: 1e300, setAll: -1 })!;
    expect(s.a0).toBe(30);
    expect(s.incWork).toBe(DEFAULTS.incWork);
    expect(s.setAll).toBe(DEFAULTS.setAll);
    expect(sanitize({ incWork: 1e300 })).toBeNull();
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

// Minimaler localStorage-Ersatz (die Tests laufen in Node ohne Browser).
function fakeStorage(init: Record<string, string> = {}) {
  const data = new Map(Object.entries(init));
  const probeWrites = { n: 0 };
  const api = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => { if (k === '__vr_probe__') probeWrites.n++; data.set(k, String(v)); },
    removeItem: (k: string) => { data.delete(k); },
  };
  (globalThis as unknown as { window: unknown }).window = { localStorage: api };
  return { data, probeWrites };
}
const stored = (d: Map<string, string>) => JSON.parse(d.get(STORAGE_KEY)!);
afterEach(() => { delete (globalThis as unknown as { window?: unknown }).window; });

describe('Speicher (Format v2, nur Abweichungen)', () => {
  it('speichert nur Schlüssel ungleich DEFAULTS und lädt DEFAULTS ⊕ Abweichung (Roundtrip)', () => {
    const { data } = fakeStorage();
    const v: Inputs = { ...DEFAULTS, a0: 31, kvOn: true, g: 5.5, combo: true };
    expect(saveInputs(v)).toBe(true);
    const raw = stored(data);
    expect(raw.v).toBe(2);
    expect(raw.inputs).toEqual({ a0: 31, kvOn: true, g: 5.5, combo: true });
    const back = loadSaved()!;
    expect(sameInputs(back, v)).toBe(true);
  });
  it('geänderte Standardwerte kommen bei Nutzern mit v2-Speicher an (nur Abweichungen gespeichert)', () => {
    fakeStorage({ [STORAGE_KEY]: JSON.stringify({ v: 2, inputs: { a0: 40 } }) });
    const l = loadSaved()!;
    expect(l.a0).toBe(40);
    expect(l.kvRate).toBe(DEFAULTS.kvRate);
  });
  it('v1-Speicher mit kvRate 21,7 lädt als neuer Standard 21,1', () => {
    fakeStorage({ [STORAGE_KEY]: JSON.stringify({ v: 1, inputs: { ...LINK_BASE_V1, a0: 35, kvRate: 21.7 } }) });
    const l = loadSaved()!;
    expect(l.kvRate).toBe(21.1);
    expect(l.a0).toBe(35);
  });
  it('v1-Speicher mit bewusst geändertem kvRate 19 bleibt 19', () => {
    fakeStorage({ [STORAGE_KEY]: JSON.stringify({ v: 1, inputs: { ...LINK_BASE_V1, kvRate: 19 } }) });
    expect(loadSaved()!.kvRate).toBe(19);
  });
  it('v1-Speicher ohne neue Schlüssel lädt mit Standardwerten für incHeir, kvKind und Kombi', () => {
    const old: Record<string, unknown> = { ...LINK_BASE_V1, a0: 29 };
    for (const k of ['incHeir', 'kvKind', ...COMBO_KEYS]) delete old[k];
    fakeStorage({ [STORAGE_KEY]: JSON.stringify({ v: 1, inputs: old }) });
    const l = loadSaved()!;
    expect(l.a0).toBe(29);
    expect(l.combo).toBe(false);
    expect(l.incHeir).toBe(38000);
    expect(l.kvKind).toBe(0);
  });
  it('1e300 im Speicher wird ignoriert (v1 und v2)', () => {
    fakeStorage({ [STORAGE_KEY]: JSON.stringify({ v: 2, inputs: { incWork: 1e300, a0: 33 } }) });
    expect(loadSaved()).toMatchObject({ incWork: DEFAULTS.incWork, a0: 33 });
    fakeStorage({ [STORAGE_KEY]: JSON.stringify({ v: 1, inputs: { ...LINK_BASE_V1, incWork: 1e300, a0: 34 } }) });
    expect(loadSaved()).toMatchObject({ incWork: DEFAULTS.incWork, a0: 34 });
  });
  it('unbekannte Version und Müll ergeben null', () => {
    fakeStorage({ [STORAGE_KEY]: JSON.stringify({ v: 9, inputs: { a0: 40 } }) });
    expect(loadSaved()).toBeNull();
    fakeStorage({ [STORAGE_KEY]: '{kaputt' });
    expect(loadSaved()).toBeNull();
  });
  it('leere Abweichung (alles Standard) wird gespeichert und lädt als Standardwerte', () => {
    fakeStorage();
    saveInputs({ ...DEFAULTS, a0: 40 });
    saveInputs({ ...DEFAULTS });
    expect(sameInputs(loadSaved()!, DEFAULTS)).toBe(true);
  });
  it('onlyKeys schreibt nur die genannten Schlüssel in den gespeicherten Stand', () => {
    const { data } = fakeStorage();
    saveInputs({ ...DEFAULTS, a0: 40, g: 5 });                  // „anderer Tab“
    saveInputs({ ...DEFAULTS, incRet: 31000 }, ['incRet']);     // dieser Tab kennt a0/g nicht
    expect(stored(data).inputs).toEqual({ a0: 40, g: 5, incRet: 31000 });
    saveInputs({ ...DEFAULTS }, ['a0']);                        // zurück auf Standard entfernt den Schlüssel
    expect(stored(data).inputs).toEqual({ g: 5, incRet: 31000 });
  });
  it('Speicher-Probe läuft nur einmal, nicht bei jedem Speichern', () => {
    const { probeWrites } = fakeStorage();
    expect(storageAvailable()).toBe(true);
    saveInputs({ ...DEFAULTS, a0: 30 }); saveInputs({ ...DEFAULTS, a0: 31 }); loadSaved(); clearSaved();
    expect(probeWrites.n).toBe(1);
  });
  it('ohne Speicher: false bzw. null, kein Fehler', () => {
    expect(storageAvailable()).toBe(false);
    expect(saveInputs({ ...DEFAULTS })).toBe(false);
    expect(loadSaved()).toBeNull();
  });
});
