// What a screen reader says about ONE message row.
//
// A row is a small layout: an avatar, a name, a date, a subject, sometimes a chip. Sighted, that is a
// single glance. Announced, it was one stop per fragment - VoiceOver read "Jan Novák", then "12. 5.",
// then the subject, then the chip, with no clue they belonged together, and a fifty-message inbox cost
// something like 250 swipes to walk. Composing the row into one sentence makes it one stop, in the
// order the eye takes it, and it is a sentence rather than a concatenation so the pauses land between
// the facts instead of inside them.
//
// Pure functions, deliberately: the label is the part of a row that is worth asserting in a test, and
// none of this needs a rendered tree to check.

import { t } from '../../../i18n/strings';
import { attentionDaysRemaining } from './attention';
import { formatTermDate } from '../screens/TermPicker';

/** A part that already closes itself - the compact date form "13.06." is the common one. */
const ENDS_SENTENCE = /[.!?:]$/;

/**
 * Joins the parts of a row into one spoken sentence, dropping the ones this row does not have.
 *
 * The separator is a period AND a space, except after a part that already ends in one. Naively
 * joining produced "13.06.. Ve schránce…" on a search hit - caught on the device, because a doubled
 * period is invisible in a source file and audible in a screen reader.
 */
function sentence(parts: (string | null | undefined)[]): string {
  return parts
    .filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
    .reduce(
      (acc, part) =>
        acc === ''
          ? part
          : `${acc}${ENDS_SENTENCE.test(acc) ? ' ' : '. '}${part}`,
      '',
    );
}

/**
 * The words on a deadline chip - used BOTH by the chip and by the row label that has to speak it, so
 * the two cannot say different things about the same date.
 */
export function termChipLabel(date: number, now: number): string {
  const days = attentionDaysRemaining(date, now);
  if (days === 0) {
    return t('term.chip.today');
  }
  return t(days < 0 ? 'term.chip.overdue' : 'term.chip', {
    d: formatTermDate(date),
  });
}

/**
 * A received row. Unread leads - it is the one fact that changes what the user does next, and a
 * screen reader has no gold dot to see.
 */
export function receivedRowLabel(row: {
  sender: string;
  subject: string;
  date: string;
  unread: boolean;
  /** The user's own deadline on this message, already worded (`termChipLabel`), or null. */
  term: string | null;
}): string {
  return sentence([
    row.unread ? t('messages.unread') : null,
    row.sender,
    row.subject,
    row.date,
    row.term,
  ]);
}

/**
 * An attention row - the same sentence as a received row, plus the legal status that put it in the
 * group. The fiction pill comes FIRST because it is the fact with a clock attached.
 */
export function attentionRowLabel(row: {
  sender: string;
  subject: string;
  date: string;
  unread: boolean;
  /** The fiction pill's parts ("Doručeno fikcí 3. 6.", "Lhůta běží"), or null when it shows none. */
  fiction: string[] | null;
  term: string | null;
}): string {
  return sentence([
    row.unread ? t('messages.unread') : null,
    row.sender,
    row.subject,
    row.date,
    ...(row.fiction ?? []),
    row.term,
  ]);
}

/**
 * A sent row. The delivery state rides at the end of the visual row as a glyph; here it is the word
 * the glyph stands for, because that is the whole question a sent message raises.
 */
export function sentRowLabel(row: {
  recipient: string;
  subject: string;
  date: string;
  /** The delivery state in words (`messageStatus(...).labelKey`, resolved). */
  status: string;
  /** The extra lines the row shows under the subject (fiction countdown, erased/vault note). */
  notes: (string | null)[];
}): string {
  return sentence([
    t('messages.row.to', { name: row.recipient }),
    row.subject,
    row.date,
    row.status,
    ...row.notes,
  ]);
}

/**
 * A search hit. Same shape as a received row, plus the box it was found in - the one thing a hit
 * carries that an inbox row does not, and the reason the pill is on screen at all.
 */
export function searchRowLabel(row: {
  party: string;
  subject: string;
  date: string;
  box: string;
}): string {
  return sentence([
    row.party,
    row.subject,
    row.date,
    t('messages.row.inBox', { name: row.box }),
  ]);
}
