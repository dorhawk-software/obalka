// A message row, said out loud.
//
// The row is an avatar, a name, a date, a subject and sometimes a chip. Sighted, one glance. To a
// screen reader it was one stop per fragment - "Úřad", then "12. 5.", then the subject, then the chip,
// none of them announced as belonging to the same message - so a fifty-message inbox cost something
// like 250 swipes to walk, and the gold unread dot, which is the one thing on the row that changes
// what you do next, was announced not at all.
//
// These are the sentences that replaced that. Pure, so the wording is testable without a tree.

import {
  attentionRowLabel,
  receivedRowLabel,
  searchRowLabel,
  sentRowLabel,
  termChipLabel,
} from '../../src/features/messages/state/rowLabel';
import { setActiveLocale } from '../../src/i18n/strings';

const DAY = 86400000;

beforeEach(() => {
  setActiveLocale('cs');
});

describe('the sentence rule', () => {
  it('never doubles a period after a part that already ends in one', () => {
    // "13.06." is what `rowDate` produces, and joining naively read "13.06.. Ve schránce…" out loud
    // on the device. Every builder below shares this join.
    const label = searchRowLabel({
      party: 'Úřad',
      subject: 'Sdělení',
      date: '13.06.',
      box: 'Moje schránka',
    });
    expect(label).toBe('Úřad. Sdělení. 13.06. Ve schránce Moje schránka');
    expect(label).not.toMatch(/\.\./);
  });
});

describe('a received row', () => {
  const base = {
    sender: 'Městský soud v Praze',
    subject: 'Předvolání',
    date: '12. 5.',
    unread: false,
    term: null,
  };

  it('reads as one sentence, in the order the eye takes it', () => {
    expect(receivedRowLabel(base)).toBe('Městský soud v Praze. Předvolání. 12. 5.');
  });

  it('leads with unread - the gold dot has no spoken form of its own', () => {
    expect(receivedRowLabel({ ...base, unread: true })).toBe(
      'Nová. Městský soud v Praze. Předvolání. 12. 5.',
    );
  });

  it('carries the deadline when the row shows one', () => {
    expect(receivedRowLabel({ ...base, term: 'Termín 22. 8.' })).toBe(
      'Městský soud v Praze. Předvolání. 12. 5. Termín 22. 8.',
    );
  });

  it('never leaves a gap where a missing part was', () => {
    // The join is over the parts that EXIST - an absent term must not become ". ." in the middle.
    const label = receivedRowLabel({ ...base, sender: '', term: null });
    expect(label).not.toMatch(/\.\s*\./);
    expect(label).toBe('Předvolání. 12. 5.');
  });
});

describe('an attention row', () => {
  const base = {
    sender: 'Okresní soud',
    subject: 'Usnesení',
    date: '3. 6.',
    unread: true,
    fiction: ['Doručeno fikcí 3. 6.', 'Lhůta běží'],
    term: null,
  };

  it('puts the legal clock before the user\u2019s own deadline', () => {
    const label = attentionRowLabel({ ...base, term: 'Termín 22. 8.' });
    expect(label.indexOf('Doručeno fikcí')).toBeLessThan(
      label.indexOf('Termín 22. 8.'),
    );
  });

  it('says everything the two pills show', () => {
    expect(attentionRowLabel(base)).toBe(
      'Nová. Okresní soud. Usnesení. 3. 6. Doručeno fikcí 3. 6. Lhůta běží',
    );
  });
});

describe('a sent row', () => {
  const base = {
    recipient: 'Finanční úřad',
    subject: 'Odpověď',
    date: '3. 6.',
    status: 'Dodáno',
    notes: [],
  };

  it('says who it went to - the row shows only an arrow', () => {
    expect(sentRowLabel(base)).toBe('Komu: Finanční úřad. Odpověď. 3. 6. Dodáno');
  });

  it('speaks the delivery state, which the row draws as a glyph', () => {
    expect(sentRowLabel({ ...base, status: 'Doručeno fikcí' })).toContain(
      'Doručeno fikcí',
    );
  });

  it('appends the extra lines the row draws, and only those', () => {
    expect(
      sentRowLabel({ ...base, notes: ['Zbývá 5 dnů', null] }),
    ).toBe('Komu: Finanční úřad. Odpověď. 3. 6. Dodáno. Zbývá 5 dnů');
  });
});

describe('a search hit', () => {
  it('names the box it was found in', () => {
    expect(
      searchRowLabel({
        party: 'ČSSZ',
        subject: 'Rozhodnutí',
        date: '1. 2.',
        box: 'Moje firma',
      }),
    ).toBe('ČSSZ. Rozhodnutí. 1. 2. Ve schránce Moje firma');
  });
});

describe('the deadline wording', () => {
  // Shared with the chip itself, so a row cannot say one thing while the pill beside it says another.
  const now = Date.UTC(2026, 7, 22, 10, 0, 0);

  it('is "today" on the day', () => {
    expect(termChipLabel(now, now)).toBe('Termín dnes');
  });

  it('is a date while it is ahead', () => {
    // The separator is a NON-BREAKING space (U+00A0), and this asserts it rather than tolerating it.
    // With an ordinary space "11. 9." is two breakable tokens, and in the password-expiry strip at a
    // large text size the day and the month wrapped onto different lines with the action button
    // between them - the strip read "Platnost / hesla končí 11. Změnit v portálu / 9.".
    expect(termChipLabel(now + 3 * DAY, now)).toMatch(/^Termín \d+\.\u00A0\d+\.$/);
  });

  it('never lets a date break across lines', () => {
    // The property, stated once for every date the chips render: exactly one separator, and it is
    // the non-breaking one. A regular space anywhere in a date is the bug above.
    for (const days of [1, 3, 9, 40, 200]) {
      const label = termChipLabel(now + days * DAY, now);
      const date = label.replace(/^Termín /, '');
      expect(date).not.toMatch(/\d\. \d/); // no breakable gap inside the date
      expect(date).toContain('\u00A0');
    }
  });

  it('says so once it has passed', () => {
    expect(termChipLabel(now - 3 * DAY, now)).toMatch(/^Termín prošel /);
  });
});
