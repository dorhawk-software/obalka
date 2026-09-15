// Every string exists in both languages.
//
// `t()` falls back to Czech when a key is missing, which is the right runtime behaviour and a poor
// development one: an English-speaking user gets a Czech sentence, and nothing anywhere reports it.
// This is the check that turns that silence into a failing test, and it also catches the opposite
// mistake - a key added to `en` and never to `cs`, which falls back to the raw key.
//
// Plural families are compared per LOCALE rather than key by key: Czech picks between one/few/many
// and English between one/other, so the sets are legitimately different. What must hold is that each
// language defines every form its own rule can ask for - a `plural()` result with no string behind it
// is the same silent fallback in a less obvious place.

import { STRINGS_FOR_TEST } from '../../src/i18n/strings';
import { cs as loginCs, en as loginEn } from '../../src/i18n/loginMessages';

const CATEGORIES = ['one', 'few', 'many', 'other'] as const;
/** The forms each locale's rule in `strings.ts` can actually return. */
const FORMS: Record<'cs' | 'en', readonly string[]> = {
  cs: ['one', 'few', 'many'],
  en: ['one', 'other'],
};

const isPlural = (key: string) =>
  CATEGORIES.some(c => key.endsWith(`.${c}`));
const base = (key: string) => key.slice(0, key.lastIndexOf('.'));
const singular = (keys: string[]) => keys.filter(k => !isPlural(k));
const families = (keys: string[]) => [...new Set(keys.filter(isPlural).map(base))];

const pairs: [string, Record<string, string>, Record<string, string>][] = [
  ['strings.ts', STRINGS_FOR_TEST.cs, STRINGS_FOR_TEST.en],
  ['loginMessages.ts', loginCs, loginEn],
];

describe.each(pairs)('%s', (_file, cs, en) => {
  it('has an English string for every Czech one', () => {
    expect(singular(Object.keys(cs)).filter(k => !(k in en))).toEqual([]);
  });

  it('has a Czech string for every English one', () => {
    expect(singular(Object.keys(en)).filter(k => !(k in cs))).toEqual([]);
  });

  it('defines every plural form each language can ask for', () => {
    const all = [...new Set([...families(Object.keys(cs)), ...families(Object.keys(en))])];
    const missing: string[] = [];
    for (const family of all) {
      for (const [locale, forms] of Object.entries(FORMS)) {
        const map = locale === 'cs' ? cs : en;
        for (const form of forms) {
          if (!(`${family}.${form}` in map)) {
            missing.push(`${locale}: ${family}.${form}`);
          }
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('leaves no placeholder untranslated on either side', () => {
    // A `{name}` in one language and not the other means the interpolation silently drops a value.
    const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();
    for (const key of Object.keys(cs)) {
      if (key in en) {
        expect({ key, has: placeholders(en[key]) }).toEqual({
          key,
          has: placeholders(cs[key]),
        });
      }
    }
  });
});
