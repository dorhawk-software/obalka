// A message's signed original (.zfo): whether ISDS can still hand it over, and what the detail screen
// says about it (004 amendment, 2026-09-14).
//
// Provozní řád ISDS, "Doba uchovávání datové zprávy": a message is kept 90 days from delivery by
// sign-in, and one that was NOT delivered by sign-in - served by fiction - for at least three years.
// Read carefully, that says four things the screen has to respect:
//
//   * the window runs from dmAcceptanceTime (doručení), not dmDeliveryTime (dodání);
//   * state 5 (served by fiction) buys at least three years;
//   * a fiction-served message that was read afterwards shows state 7 and cannot be told from one
//     read on sign-in - so past 90 days the app can only say "probably deleted", and still lets the
//     user try, because a message served by fiction is exactly the one a court asks for;
//   * state 9 means ISDS erased the content, and a download that already confirmed the message gone
//     (`attachmentsUnavailable`) is the same fact learned the hard way.
//
// Pure, so the screen and the controller cannot disagree about any of it.

import type { MessageDetail, SignedOriginal } from '../../../services/isds/types';
import { MESSAGE_STATE } from './messageState';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Delivered by sign-in. */
export const SIGNED_IN_RETENTION_MS = 90 * DAY_MS;
/** Served by fiction: "nejméně 3 let" - a floor, not a date ISDS promises to delete it on. */
export const FICTION_RETENTION_MS = 3 * 365 * DAY_MS;

export type OriginalAvailability = 'held' | 'probablyDeleted' | 'deleted';

export function signedOriginalAvailability(
  envelope: { state: number; acceptanceTime: number | null },
  detail: Pick<MessageDetail, 'attachmentsUnavailable'> | null,
  now: number,
): OriginalAvailability {
  if (detail?.attachmentsUnavailable === true || envelope.state === MESSAGE_STATE.contentErased) {
    return 'deleted';
  }
  if (envelope.acceptanceTime == null) {
    return 'held'; // not delivered yet, and ISDS does not drop what it has not delivered
  }
  const window =
    envelope.state === MESSAGE_STATE.servedByFiction
      ? FICTION_RETENTION_MS
      : SIGNED_IN_RETENTION_MS;
  return now - envelope.acceptanceTime > window ? 'probablyDeleted' : 'held';
}

/** What the detail's "Originál zprávy" row shows. */
export type SignedOriginalRow =
  /** On this device: open it, or save it somewhere. */
  | { kind: 'stored'; original: SignedOriginal }
  /** Not on this device, and worth asking ISDS for. `late` = past the window; `missing` = a file that was here. */
  | { kind: 'fetch'; late: boolean; missing: boolean }
  /** Not on this device, and ISDS no longer has it. Nothing to press. */
  | { kind: 'unavailable'; missing: boolean };

export function signedOriginalRow(
  original: SignedOriginal | undefined,
  fileMissing: boolean,
  availability: OriginalAvailability,
): SignedOriginalRow {
  if (original != null && !fileMissing) {
    return { kind: 'stored', original };
  }
  const missing = original != null;
  if (availability === 'deleted') {
    return { kind: 'unavailable', missing };
  }
  return { kind: 'fetch', late: availability === 'probablyDeleted', missing };
}
