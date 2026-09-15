// Whether ISDS can still hand over a message's signed original, and what the detail says (004).
//
// The retention rule is the Provozní řád's, and it is easy to get subtly wrong in the direction that
// costs a user their one chance: measuring from the day the message ARRIVED rather than the day it
// was delivered, or forgetting that a message served by fiction is kept for years, not days. And the
// row must never claim an original is gone on a date alone - only ISDS saying so makes it gone.

import {
  FICTION_RETENTION_MS,
  signedOriginalAvailability,
  signedOriginalRow,
} from '../../src/features/messages/state/signedOriginal';
import { MESSAGE_STATE } from '../../src/features/messages/state/messageState';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 8, 14, 12);

describe('whether ISDS still holds the signed original', () => {
  it('counts 90 days from delivery, not from arrival', () => {
    // Arrived 100 days ago, delivered by sign-in 80 days ago: still held.
    expect(
      signedOriginalAvailability(
        { state: MESSAGE_STATE.read, acceptanceTime: NOW - 80 * DAY },
        null,
        NOW,
      ),
    ).toBe('held');
    expect(
      signedOriginalAvailability(
        { state: MESSAGE_STATE.read, acceptanceTime: NOW - 91 * DAY },
        null,
        NOW,
      ),
    ).toBe('probablyDeleted');
  });

  it('gives a message served by fiction at least three years', () => {
    expect(
      signedOriginalAvailability(
        { state: MESSAGE_STATE.servedByFiction, acceptanceTime: NOW - 400 * DAY },
        null,
        NOW,
      ),
    ).toBe('held');
    expect(
      signedOriginalAvailability(
        { state: MESSAGE_STATE.servedByFiction, acceptanceTime: NOW - FICTION_RETENTION_MS - DAY },
        null,
        NOW,
      ),
    ).toBe('probablyDeleted');
  });

  it('holds what has not been delivered yet', () => {
    expect(
      signedOriginalAvailability({ state: MESSAGE_STATE.delivered, acceptanceTime: null }, null, NOW),
    ).toBe('held');
  });

  it('knows it is gone when ISDS erased the content, or a download already confirmed it', () => {
    expect(
      signedOriginalAvailability(
        { state: MESSAGE_STATE.contentErased, acceptanceTime: NOW - DAY },
        null,
        NOW,
      ),
    ).toBe('deleted');
    expect(
      signedOriginalAvailability(
        { state: MESSAGE_STATE.read, acceptanceTime: NOW - DAY },
        { attachmentsUnavailable: true },
        NOW,
      ),
    ).toBe('deleted');
  });
});

describe('the row the detail shows', () => {
  const original = { fileName: 'DZ_1234567.zfo', localPath: '/d/DZ_1234567.zfo', size: 2048 };

  it('offers the stored original while its file is there, whatever ISDS still holds', () => {
    expect(signedOriginalRow(original, false, 'deleted')).toEqual({ kind: 'stored', original });
  });

  it('offers to fetch one that is not here, and says when it is probably too late', () => {
    expect(signedOriginalRow(undefined, false, 'held')).toEqual({
      kind: 'fetch',
      late: false,
      missing: false,
    });
    // Still offered: a date is not ISDS saying no.
    expect(signedOriginalRow(undefined, false, 'probablyDeleted')).toEqual({
      kind: 'fetch',
      late: true,
      missing: false,
    });
  });

  it('calls a recorded original whose file vanished missing, not never saved', () => {
    expect(signedOriginalRow(original, true, 'held')).toEqual({
      kind: 'fetch',
      late: false,
      missing: true,
    });
    expect(signedOriginalRow(original, true, 'deleted')).toEqual({
      kind: 'unavailable',
      missing: true,
    });
  });

  it('offers nothing to press once ISDS has confirmed it is gone', () => {
    expect(signedOriginalRow(undefined, false, 'deleted')).toEqual({
      kind: 'unavailable',
      missing: false,
    });
  });
});
