// The box chip on a message row has to be readable in the language the reader chose.
//
// Reported from the English README screenshots: the chip rendered the raw ISDS code, so an English
// user saw "FO" and "PFO" beside a switcher that called the same boxes "Individual" and "Sole
// trader". FO is fyzická osoba - an everyday word in Czech and three letters of a foreign language
// in English.

import { STRINGS_FOR_TEST } from '../../src/i18n/strings';
import type { BoxType } from '../../src/services/isds/types';

const TYPES: BoxType[] = ['OVM', 'FO', 'PFO', 'PO'];

describe('the short box-type label', () => {
  it('exists in both locales for every type ISDS can return', () => {
    for (const locale of ['cs', 'en'] as const) {
      for (const type of TYPES) {
        expect(STRINGS_FOR_TEST[locale][`box.type.short.${type}`]).toBeTruthy();
      }
    }
  });

  it('is not the raw ISDS code in English', () => {
    // The actual bug. Czech deliberately keeps the acronyms; English must not.
    for (const type of TYPES.filter(t => t !== 'OVM')) {
      expect(STRINGS_FOR_TEST.en[`box.type.short.${type}`]).not.toBe(type);
    }
  });

  it('keeps the acronyms in Czech, where they are the everyday words', () => {
    expect(STRINGS_FOR_TEST.cs['box.type.short.FO']).toBe('FO');
    expect(STRINGS_FOR_TEST.cs['box.type.short.PFO']).toBe('PFO');
  });

  it('uses the SAME English words as the switcher, not synonyms for them', () => {
    // The drift this test exists for, caught on a screenshot: the chip said "Sole trader" and
    // "Company" while the switcher said "Self-employed" and "Legal entity" about the same box. A
    // short label may be the full one cut off; it may never be a different word for the same thing.
    for (const type of TYPES) {
      const short = STRINGS_FOR_TEST.en[`box.type.short.${type}`];
      const full = STRINGS_FOR_TEST.en[`send.dbType.${type}`];
      expect(full.toLowerCase().startsWith(short.toLowerCase())).toBe(true);
    }
  });

  it('stays short enough for a chip beside a sender name', () => {
    // Not a pixel measurement, a sanity bound: anything long here pushes the name out of a row that
    // already carries a date and a subject.
    for (const locale of ['cs', 'en'] as const) {
      for (const type of TYPES) {
        expect(
          STRINGS_FOR_TEST[locale][`box.type.short.${type}`].length,
        ).toBeLessThanOrEqual(14);
      }
    }
  });
});
