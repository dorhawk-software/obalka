// The Odeslané dot's archive half (014 FR-009, owner 2026-11-11): a listing that moves a sent message
// to an outcome the sender acts on marks it, until that box's Odeslané is seen.
//
// The SQLite store does the same in its upsert (`stateNewsAt = CASE …`), against the row's old state;
// these run the in-memory store, which mirrors it, and the rule both share.

import {
  InMemoryMessagesStore,
  SENT_NEWS_STATES,
  isSentNews,
} from '../../src/services/db/messagesStore';
import { MESSAGE_STATE } from '../../src/features/messages/state/messageState';
import type { MessageEnvelope } from '../../src/services/isds/types';

const envelope = (id: string, state: number): MessageEnvelope => ({
  id,
  subject: id,
  sender: 'Já',
  senderAddress: null,
  recipient: 'Úřad',
  recipientAddress: null,
  recipientBoxId: null,
  deliveryTime: 1,
  acceptanceTime: null,
  state,
  attachmentSize: null,
});

describe('what is news on the Odeslané tab', () => {
  it('is a sent message moved to served, failed or undeliverable - not to "in the box"', () => {
    expect(SENT_NEWS_STATES).toEqual([
      MESSAGE_STATE.antivirusFailed,
      MESSAGE_STATE.servedByFiction,
      MESSAGE_STATE.servedBySignIn,
      MESSAGE_STATE.undeliverable,
    ]);
    expect(isSentNews('sent', MESSAGE_STATE.delivered, MESSAGE_STATE.servedByFiction)).toBe(true);
    expect(isSentNews('sent', MESSAGE_STATE.submitted, MESSAGE_STATE.delivered)).toBe(false);
  });

  it('is never a message first seen in that state, an unchanged one, or a received one', () => {
    expect(isSentNews('sent', undefined, MESSAGE_STATE.servedBySignIn)).toBe(false);
    expect(isSentNews('sent', MESSAGE_STATE.servedBySignIn, MESSAGE_STATE.servedBySignIn)).toBe(false);
    expect(isSentNews('received', MESSAGE_STATE.delivered, MESSAGE_STATE.servedBySignIn)).toBe(false);
  });
});

describe('the archive', () => {
  it('counts per box what a listing changed, and forgets it once that box is seen', async () => {
    const store = new InMemoryMessagesStore();
    await store.cacheList('a', 'sent', [envelope('m1', 4), envelope('m2', 6)], 100);
    await store.cacheList('b', 'sent', [envelope('m3', 1)], 100);
    expect(await store.sentNews()).toEqual({});

    await store.cacheList('a', 'sent', [envelope('m1', 5), envelope('m2', 6)], 200);
    await store.cacheList('b', 'sent', [envelope('m3', 8)], 200);
    expect(await store.sentNews()).toEqual({ a: 1, b: 1 });

    await store.clearSentNews(['a']);
    expect(await store.sentNews()).toEqual({ b: 1 });
    // A later listing that changes nothing does not bring it back.
    await store.cacheList('a', 'sent', [envelope('m1', 5)], 300);
    expect(await store.sentNews()).toEqual({ b: 1 });
  });
});
