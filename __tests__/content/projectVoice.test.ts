// Public texts speak in the app's or the project's voice ("Aplikace…", "the developers"), never "I"
// (the owner, 2026-09-24) - and, since the owner's answer 13 to the 031 critique (2026-11-15), never
// "we" either: "budeme posílat", "ani my", "jsme vám poslali" (that SMS comes from ISDS, not the
// app), and the progress lines that said "I" - "Zjišťuji", "Ukládám", "Přenáším" - now say what is
// happening rather than who is doing it.
//
// Czech hides the person in the verb's ending, so this reads endings. Unicode-aware word edges: `\b`
// is ASCII-only and never matches after "ě" or "í".

import { STRINGS_FOR_TEST } from '../../src/i18n/strings';

const W = '(?<![\\p{L}])';
const E = '(?![\\p{L}])';

/** The user's own words, said by the user: buttons they press - "Rozumím", "Remind me". */
const USER_SPEAKS = new Set(['common.ok', 'detail.fikce.remind', 'notif.passwordAsk.allow']);

/** Words that end like a verb in the first person but are not one. */
const NOT_VERBS = new Set(['prosím', 'přihlášením', 'zatím', 'potom', 'přitom', 'mezitím', 'tím', 'ním', 'kým', 'čím', 'nám', 'vám', 'tam', 'sám', 'všem', 'jím']);

const FIRST_PERSON_CS = new RegExp(
  `${W}(jsme|budeme|nebudeme|my|nás|náš|naše|našich|naši|jsem|budu)${E}` +
    `|${W}\\p{L}+(íme|eme|áme|ujeme)${E}`,
  'giu',
);

/**
 * "I" in a progress line opens it - "Ukládám zálohu", "Zjišťuji…", "Čtu zprávy" - and the same endings
 * inside a sentence are mostly a noun's case ("přihlášením", "schránkám"), so the singular is read only
 * there. The -u verbs ("čtu", "píšu", "beru", "jdu", "můžu") are told from the nouns that also open a
 * line in -u ("Přílohu", "Zálohu", "Komu") by the consonant before it; "Čtu zprávy" slipped past
 * the first guard and was found by the canvas sync (2026-11-15).
 */
const OPENS_IN_FIRST_PERSON = new RegExp(`^\\p{L}+(uji|uju|ám|ím|tu|šu|ru|du|žu)${E}`, 'u');

const FIRST_PERSON_EN = /\b(we|we'll|we’ll|we've|we’ve|us|our|ours|I|I'm|I’m|I'll|I’ll|me|my)\b/g;

describe("the app's voice", () => {
  it('says no Czech "I" or "we"', () => {
    const offenders = Object.entries(STRINGS_FOR_TEST.cs)
      .filter(([key]) => !USER_SPEAKS.has(key))
      .flatMap(([key, value]) =>
        [...value.matchAll(FIRST_PERSON_CS), ...(value.match(OPENS_IN_FIRST_PERSON) ?? []).slice(0, 1).map(w => [w])]
          .map(m => m[0])
          .filter(word => !NOT_VERBS.has(word.toLowerCase()))
          .map(word => `${key}: ${word}`),
      );
    expect(offenders).toEqual([]);
  });

  it('says no English "I" or "we"', () => {
    const offenders = Object.entries(STRINGS_FOR_TEST.en)
      .filter(([key]) => !USER_SPEAKS.has(key))
      .flatMap(([key, value]) => [...value.matchAll(FIRST_PERSON_EN)].map(m => `${key}: ${m[0]}`));
    expect(offenders).toEqual([]);
  });
});
