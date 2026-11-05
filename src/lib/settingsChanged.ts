// Geänderte Annahmen im Tab „Weitere Einstellungen & Annahmen“ (Badge an der Tab-Beschriftung). Aus AssumptionCheck.svelte
// ausgelagert, damit die Logik ohne Svelte testbar ist.
import { CONTRIB_KEYS, DEFAULTS, type InputKey, type Inputs } from './engine/inputs';

/** Schlüssel, die im Tab „Weitere Einstellungen & Annahmen“ stehen (für das Badge an der Tab-Beschriftung). */
export const SETTINGS_KEYS: readonly InputKey[] = [
  'studyEnd', 'incStudy', 'eligStudy', 'incPeak', 'incPeakAge', 'kids', 'kidsFrom', 'kidsYears', 'bonus', 'kvRate',
  'etfM', 'etfTer', 'avdM', 'avdCost', 'reinvest', 'insM', 'insEff', 'fondM', 'fondAA', 'fondTer',
  'infl', 'dyn', 'basis', 'kist', 'married', 'incSpouse', 'incSpouseRet', 'avdSpouse', 'allowanceUsed',
];

/**
 * Geänderte Annahmen im Einstellungs-Tab. Beiträge zählen nur, wenn sie vom gemeinsamen Monatsbeitrag
 * abweichen (der gemeinsame Beitrag selbst steht in den Eckdaten). Felder, die gerade nichts bewirken
 * (Kinder-Zeitraum ohne Kinder, Ausbildungs-Details ohne Ausbildung), zählen nicht.
 */
export function changedSettings(i: Inputs): InputKey[] {
  const inStudy = i.studyEnd > i.a0;
  return SETTINGS_KEYS.filter(k => {
    if ((CONTRIB_KEYS as readonly string[]).includes(k)) return i[k] !== i.setAll;
    if (k === 'studyEnd') return inStudy !== (DEFAULTS.studyEnd > DEFAULTS.a0) || (inStudy && i.studyEnd !== DEFAULTS.studyEnd);
    if ((k === 'incStudy' || k === 'eligStudy') && !inStudy) return false;
    if ((k === 'kidsFrom' || k === 'kidsYears') && !(i.kids > 0)) return false;
    if ((k === 'incSpouse' || k === 'incSpouseRet' || k === 'avdSpouse') && !i.married) return false;
    if (k === 'incPeakAge') return false; // zählt mit incPeak als eine Angabe (eine Zeile im Annahmen-Check)
    return i[k] !== DEFAULTS[k];
  });
}
