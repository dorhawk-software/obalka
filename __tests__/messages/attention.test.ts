// "Vyžaduje pozornost" membership (feature 010 US1). Pure, so all of it is testable with no device,
// no storage and no notification permission - which is exactly why US1 is the MVP.
//
// The story this replaced was a delivery-fiction countdown on unopened RECEIVED messages. That cannot
// exist: listing the inbox is what serves a message (§17/3), so no row can still be counting down.
// What survives is stronger than it sounds - because listing serves it, `state === 6` means "the legal
// clock is already running and you have not read this", which is the population the original story was
// trying to protect.

import {
  attentionEntries,
  summarizeAttention,
  MAX_UNREAD_SHOWN,
  type AttentionEntry,
  type AttentionReason,
} from '../../src/features/messages/state/attention';
import type { Reminder } from '../../src/features/messages/state/reminders';
import type { MessageEnvelope } from '../../src/services/isds/types';

const DAY = 24 * 60 * 60 * 1000;
/** 2026-08-17 09:00 UTC - fixed, so nothing here depends on when the suite runs. */
const NOW = Date.UTC(2026, 7, 17, 9, 0);

const env = (
  id: string,
  state: number,
  deliveryTime = NOW - DAY,
): MessageEnvelope => ({
  id,
  subject: `s${id}`,
  sender: 'Úřad',
  senderAddress: null,
  recipient: null,
  recipientAddress: null,
  recipientBoxId: null,
  deliveryTime,
  acceptanceTime: null,
  state,
  attachmentSize: 0,
});

const rem = (messageId: string, date: number): Reminder => ({
  boxId: 'b1',
  messageId,
  date,
  createdBy: 'user',
  createdAt: NOW - DAY,
});

const ids = (entries: readonly AttentionEntry[]) => entries.map(e => e.messageId);

describe('attentionEntries - who needs looking at', () => {
  it('includes unread messages and excludes read ones', () => {
    const out = attentionEntries(
      [env('unread', 6), env('read', 7)],
      [],
      NOW,
    );
    expect(ids(out)).toEqual(['unread']);
    expect(out[0].reason).toBe('unread');
    expect(out[0].date).toBeNull();
  });

  it('includes a READ message that carries a reminder', () => {
    // The whole point of the second feed: you have seen it, and you still owe something on it.
    const out = attentionEntries(
      [env('read', 7)],
      [rem('read', NOW + 3 * DAY)],
      NOW,
    );
    expect(ids(out)).toEqual(['read']);
    expect(out[0].reason).toBe('reminder');
  });

  it('prefers the reminder reason when a message is both unread and dated', () => {
    // A date is the stronger signal - "by Thursday" beats "you have not opened this".
    const out = attentionEntries(
      [env('m', 6)],
      [rem('m', NOW + 2 * DAY)],
      NOW,
    );
    expect(out[0].reason).toBe('reminder');
    expect(out[0].date).toBe(NOW + 2 * DAY);
  });

  it('orders dated items by date first, then undated unread newest-first', () => {
    const out = attentionEntries(
      [
        env('older-unread', 6, NOW - 5 * DAY),
        env('newer-unread', 6, NOW - 1 * DAY),
        env('far', 7, NOW - 9 * DAY),
        env('soon', 7, NOW - 9 * DAY),
      ],
      [rem('far', NOW + 9 * DAY), rem('soon', NOW + 1 * DAY)],
      NOW,
    );
    expect(ids(out)).toEqual(['soon', 'far', 'newer-unread', 'older-unread']);
  });

  it('reports whole days remaining, and goes negative when overdue', () => {
    const out = attentionEntries(
      [env('due', 7), env('late', 7)],
      [rem('due', NOW + 2 * DAY), rem('late', NOW - 2 * DAY)],
      NOW,
    );
    const byId = Object.fromEntries(out.map(e => [e.messageId, e]));
    expect(byId.due.daysRemaining).toBe(2);
    expect(byId.late.daysRemaining).toBe(-2);
  });

  it('keeps an overdue reminder in the group rather than dropping it', () => {
    // A missed deadline is the last thing to hide. Contrast `sentFictionCountdown`, which returns null
    // once the fiction has landed - there, the event is over and nothing is owed.
    const out = attentionEntries([env('late', 7)], [rem('late', NOW - 5 * DAY)], NOW);
    expect(ids(out)).toEqual(['late']);
  });

  it('ignores a reminder whose message is not in the list', () => {
    // Reminders outlive message content, but the group renders rows - a reminder with no row is not
    // one of them.
    expect(attentionEntries([env('a', 7)], [rem('ghost', NOW + DAY)], NOW)).toEqual([]);
  });

  // 013 put already-served-by-fiction messages in this group and that stays. A state-5 message is
  // also unread, so the two feeds overlap - the point is that they are not the same news.
  describe('served by fiction (the feed 013 put here, kept)', () => {
    const fikce = (id: string, acceptedAt: number): MessageEnvelope => ({
      ...env(id, 5),
      acceptanceTime: acceptedAt,
    });

    it('reports `fiction`, not `unread`, for a state-5 message', () => {
      const out = attentionEntries([fikce('f', NOW - 2 * DAY)], [], NOW);
      expect(out[0].reason).toBe('fiction');
    });

    it('sorts fiction above plain unread but below a dated reminder', () => {
      const out = attentionEntries(
        [env('unread', 6, NOW - DAY), fikce('f', NOW - 2 * DAY), env('dated', 7)],
        [rem('dated', NOW + 8 * DAY)],
        NOW,
      );
      // The reminder still has a deadline to hit; the fiction has already happened; the unread one is
      // merely unopened.
      expect(ids(out)).toEqual(['dated', 'f', 'unread']);
    });

    it('orders several fiction entries newest-accepted first', () => {
      const out = attentionEntries(
        [fikce('old', NOW - 20 * DAY), fikce('recent', NOW - 2 * DAY)],
        [],
        NOW,
      );
      expect(ids(out)).toEqual(['recent', 'old']);
    });

    it('lets a user reminder override the fiction reason', () => {
      // If the user has flagged it, their date is what they are working to.
      const out = attentionEntries([fikce('f', NOW - DAY)], [rem('f', NOW + DAY)], NOW);
      expect(out[0].reason).toBe('reminder');
    });
  });

  it('returns an empty array when nothing qualifies - the caller renders no header', () => {
    expect(attentionEntries([env('read', 7)], [], NOW)).toEqual([]);
    expect(attentionEntries([], [], NOW)).toEqual([]);
  });

  it('is crash-safe: garbled input yields no entry, never an exception', () => {
    const broken = { ...env('bad', 7), deliveryTime: null };
    expect(() =>
      attentionEntries(
        [broken, env('ok', 6)],
        [{ ...rem('bad', Number.NaN) }],
        NOW,
      ),
    ).not.toThrow();
    // The unread one still makes it; the garbled date does not become a dated entry.
    const out = attentionEntries(
      [broken, env('ok', 6)],
      [{ ...rem('bad', Number.NaN) }],
      NOW,
    );
    expect(out.every(e => e.reason !== 'reminder')).toBe(true);
  });

  it('treats states below 4 as not-yet-arrived rather than unread', () => {
    // 1–3 are sender-side states; a received row should never be in them, and if a garbled envelope
    // says so we do not claim the user owes anything.
    expect(attentionEntries([env('x', 1), env('y', 3)], [], NOW)).toEqual([]);
  });
});

// ── The group's PRESENTATION, which is a different decision from its membership ─────────────────
//
// FR-001 makes every unread message eligible, and that stays. What the 2026-09-09 critique found is
// that nothing capped the group, so on a first sync it *was* the inbox - and the block's oversized
// numeral then counted ordinary mail. `attention.ts` argues the principle in its own header ("An
// attention section that is usually empty teaches people to skip the one that is not"); a section
// that is always full teaches the identical skip.
describe('summarizeAttention', () => {
  const entry = (
    messageId: string,
    reason: AttentionReason,
    date: number | null = null,
    daysRemaining: number | null = null,
  ): AttentionEntry => ({ messageId, reason, date, daysRemaining });

  it('never drops a dated or fiction-served entry', () => {
    const entries = [
      entry('a', 'reminder', 1_000, -2),
      entry('b', 'estimate', 2_000, 5),
      entry('c', 'fiction'),
      ...Array.from({ length: 30 }, (_, i) => entry(`u${i}`, 'unread')),
    ];
    const { shown, summary } = summarizeAttention(entries);
    expect(shown.filter(e => e.date != null)).toHaveLength(2);
    expect(shown.filter(e => e.reason === 'fiction')).toHaveLength(1);
    expect(summary.dated).toBe(2);
    expect(summary.overdue).toBe(1);
    expect(summary.fiction).toBe(1);
  });

  it('caps the plain-unread tail and says how many it left', () => {
    const entries = Array.from({ length: 30 }, (_, i) => entry(`u${i}`, 'unread'));
    const { shown, summary } = summarizeAttention(entries);
    expect(shown).toHaveLength(MAX_UNREAD_SHOWN);
    expect(summary.unread).toBe(MAX_UNREAD_SHOWN);
    expect(summary.unreadBeyondCap).toBe(30 - MAX_UNREAD_SHOWN);
  });

  it('keeps the incoming sort order', () => {
    const entries = [
      entry('overdue', 'reminder', 1_000, -3),
      entry('soon', 'reminder', 2_000, 1),
      entry('fic', 'fiction'),
      entry('u1', 'unread'),
    ];
    expect(summarizeAttention(entries).shown.map(e => e.messageId)).toEqual([
      'overdue',
      'soon',
      'fic',
      'u1',
    ]);
  });

  it('is empty in, empty out - the group simply does not render', () => {
    const { shown, summary } = summarizeAttention([]);
    expect(shown).toEqual([]);
    expect(summary).toEqual({
      dated: 0,
      overdue: 0,
      fiction: 0,
      unread: 0,
      unreadBeyondCap: 0,
    });
  });
});

// ── Reading offline has to count for something ──────────────────────────────────────────────────
//
// `state` is the server's truth about delivery and stays that way: `markRead` only flips it once
// ISDS confirms. The consequence, until the 2026-09-09 critique, was that reading offline changed
// nothing - the attention group keys off `state`, so a commuter who read eight messages on the metro
// arrived with the same "8". `openedAt` is the local half: the user's own act, recorded here.
describe('a message the user has already opened on this device', () => {
  const now = Date.UTC(2026, 7, 22, 10, 0, 0);
  const base = (over: Partial<MessageEnvelope> = {}): MessageEnvelope =>
    ({
      id: 'm1',
      subject: 's',
      sender: 'x',
      senderAddress: null,
      recipient: null,
      recipientAddress: null,
      recipientBoxId: null,
      deliveryTime: now - 3 * 86_400_000,
      acceptanceTime: null,
      state: 6,
      attachmentSize: null,
      ...over,
    } as MessageEnvelope);

  it('drops out of the group', () => {
    expect(attentionEntries([base()], [], now)).toHaveLength(1);
    expect(
      attentionEntries([base({ openedAt: now - 60_000 })], [], now),
    ).toHaveLength(0);
  });

  it('still counts when a legal clock is what put it there', () => {
    // Fiction is not about having looked - the law signed for them, and opening it later does not
    // undo that. Same for a deadline the user set.
    const served = base({ state: 5, acceptanceTime: now - 86_400_000, openedAt: now });
    expect(attentionEntries([served], [], now).map(e => e.reason)).toEqual([
      'fiction',
    ]);
    const dated = base({ openedAt: now });
    expect(
      attentionEntries([dated], [{ messageId: 'm1', date: now + 86_400_000 }] as never, now).map(
        e => e.reason,
      ),
    ).toEqual(['reminder']);
  });
});
