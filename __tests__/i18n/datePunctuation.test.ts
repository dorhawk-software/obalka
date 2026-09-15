// A date placeholder ends its own sentence.
//
// `formatTermDate` is the only thing that fills `{d}`, and it renders the compact Czech form - "11. 9."
// - which already ends in a period. `pwd.soon` added another, so the password-expiry strip read
// "Platnost hesla končí 11. 9.." on screen. Caught on the device, not in review: it is one pixel of
// punctuation and it is the kind of thing eyes slide over in a source file.

import { STRINGS_FOR_TEST, type Locale } from '../../src/i18n/strings';
import { formatTermDate } from '../../src/features/messages/screens/TermPicker';

const LOCALES: Locale[] = ['cs', 'en'];

describe('a date placeholder', () => {
  it('renders with a trailing period of its own', () => {
    // The premise of the rule below. If the format ever loses its period, these strings need it back.
    expect(formatTermDate(Date.UTC(2026, 8, 11))).toMatch(/\.$/);
  });

  it.each(LOCALES)('is never followed by another period (%s)', locale => {
    const offenders = Object.entries(STRINGS_FOR_TEST[locale])
      .filter(([, value]) => /\{d\}\./.test(value))
      .map(([key, value]) => `${key}: ${value}`);
    expect(offenders).toEqual([]);
  });
});
