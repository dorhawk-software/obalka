// A listing the person started is what automatic download follows (026 FR-003, FR-004).
//
// Two small facts the whole feature rests on: `onListed` fires after a listing that worked and never
// after one that failed, and a row's `firstSeenAt` is written when a listing first brings it onto the
// phone and never moved again - it is what "new messages only" means.

import { MessagesController } from '../../src/features/messages/state/messagesController';
import { InMemoryMessagesStore } from '../../src/services/db/messagesStore';
import type { DataBoxAccount, MessageEnvelope } from '../../src/services/isds/types';

const account: DataBoxAccount = {
  id: 'acc_box1',
  boxId: 'box1',
  loginName: 'novak',
  label: 'Jan Novak',
  dbType: null,
  alias: null,
  authMethod: 'password',
  host: 'czebox',
  secretRef: 'box1',
  sessionValidUntil: null,
  passwordExpiresAt: null,
  lastSyncedAt: null,
  messageCount: null,
  unreadCount: null,
  pdzCreditCzk: null,
  syncError: null,
  createdAt: 1,
  updatedAt: 1,
};

const envelope = (id: string): MessageEnvelope => ({
  id,
  subject: 's',
  sender: 'x',
  senderAddress: null,
  recipient: null,
  recipientAddress: null,
  recipientBoxId: null,
  deliveryTime: 1_000,
  acceptanceTime: 1_000,
  state: 6,
  attachmentSize: 1,
});

function build(list: () => Promise<unknown>, now: () => number) {
  const store = new InMemoryMessagesStore();
  const listed: string[] = [];
  const fail = async (): Promise<never> => {
    throw new Error('not in this test');
  };
  const controller = new MessagesController({
    transport: {
      listReceivedMessages: list as never,
      getSentMessages: list as never,
      downloadMessage: fail,
      downloadSignedMessage: fail,
      markMessageAsDownloaded: fail,
      getCreditInfo: fail,
    },
    secureStore: {
      readPassword: async () => ({ status: 'found', value: 'pw' }),
      readSession: async () => ({ status: 'absent' }),
    },
    messagesStore: store,
    now,
    onListed: a => listed.push(a.boxId),
  });
  return { controller, store, listed };
}

describe('a listing and automatic download', () => {
  it('tells the downloader after a listing that worked, received or sent', async () => {
    const { controller, listed } = build(
      async () => ({ type: 'messages', messages: [envelope('1')] }),
      () => 1_000,
    );
    await controller.listReceived(account, new AbortController().signal);
    await controller.listSent(account, new AbortController().signal);
    expect(listed).toEqual(['box1', 'box1']);
  });

  it('says nothing after a listing that failed', async () => {
    const { controller, listed } = build(async () => ({ type: 'authFault' }), () => 1_000);
    await controller.listReceived(account, new AbortController().signal);
    expect(listed).toEqual([]);
  });

  it('stamps when a message first arrived on this phone, once', async () => {
    let clock = 1_000;
    let messages = [envelope('1')];
    const { controller, store } = build(
      async () => ({ type: 'messages', messages }),
      () => clock,
    );
    await controller.listReceived(account, new AbortController().signal);
    clock = 9_000;
    messages = [envelope('1'), envelope('2')];
    await controller.listReceived(account, new AbortController().signal);

    const seen = Object.fromEntries(
      (await store.listUndownloaded('box1')).map(m => [m.envelope.id, m.firstSeenAt]),
    );
    expect(seen).toEqual({ '1': 1_000, '2': 9_000 });
  });
});
