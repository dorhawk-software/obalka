// One listing of a box's folder at a time (2026-10-03, the double load).
//
// Launch refreshes every box while the inbox opens on one of them, and both asked ISDS for the same
// list a moment apart. A second request while the first is under way now shares it. What must not
// change: a request whose callers have all gone is abandoned, and a pull-to-refresh - which aborts its
// own previous request before asking again - still gets a listing of its own.

import { MessagesController } from '../../src/features/messages/state/messagesController';
import { InMemoryMessagesStore } from '../../src/services/db/messagesStore';
import type { DataBoxAccount } from '../../src/services/isds/types';

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

/** A transport whose listings wait until the test lets them answer. */
function build() {
  const pending: { release: () => void; signal: AbortSignal | undefined }[] = [];
  const list = jest.fn(
    (args: { signal?: AbortSignal }) =>
      new Promise(resolve => {
        pending.push({
          signal: args.signal,
          release: () => resolve({ type: 'messages', messages: [] }),
        });
      }),
  );
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
    messagesStore: new InMemoryMessagesStore(),
    now: () => 1_000,
  });
  /** Waits until the transport has been asked `n` times in all. */
  const asked = async (n: number) => {
    for (let i = 0; i < 50 && list.mock.calls.length < n; i++) {
      await Promise.resolve();
    }
    expect(list).toHaveBeenCalledTimes(n);
  };
  return { controller, list, pending, asked };
}

describe('listing a box that is already being listed', () => {
  it('asks ISDS once, and both callers get the answer', async () => {
    const { controller, pending, asked } = build();
    const first = controller.listReceived(account, new AbortController().signal);
    const second = controller.listReceived({ ...account }, new AbortController().signal);
    await asked(1);
    pending[0].release();
    await expect(first).resolves.toMatchObject({ kind: 'loaded' });
    await expect(second).resolves.toMatchObject({ kind: 'loaded' });
  });

  it('keeps going for the caller still waiting when the other one leaves', async () => {
    const { controller, pending, asked } = build();
    const leaving = new AbortController();
    void controller.listReceived(account, leaving.signal);
    const staying = controller.listReceived(account, new AbortController().signal);
    await asked(1);
    leaving.abort();
    expect(pending[0].signal?.aborted).toBe(false);
    pending[0].release();
    await expect(staying).resolves.toMatchObject({ kind: 'loaded' });
  });

  it('is abandoned when every caller has left', async () => {
    const { controller, pending, asked } = build();
    const a = new AbortController();
    const b = new AbortController();
    void controller.listReceived(account, a.signal);
    void controller.listReceived(account, b.signal);
    await asked(1);
    a.abort();
    b.abort();
    expect(pending[0].signal?.aborted).toBe(true);
  });

  it('gives a pull-to-refresh a listing of its own', async () => {
    // The list's pull aborts the request it started on open, then asks again.
    const { controller, asked } = build();
    const open = new AbortController();
    void controller.listReceived(account, open.signal);
    await asked(1);
    open.abort();
    void controller.listReceived(account, new AbortController().signal);
    await asked(2);
  });

  it('asks again once the previous listing has answered', async () => {
    const { controller, pending, asked } = build();
    const first = controller.listReceived(account, new AbortController().signal);
    await asked(1);
    pending[0].release();
    await first;
    void controller.listReceived(account, new AbortController().signal);
    await asked(2);
  });

  it('does not join a different folder or a different box', async () => {
    const { controller, asked } = build();
    void controller.listReceived(account, new AbortController().signal);
    void controller.listSent(account, new AbortController().signal);
    void controller.listReceived(
      { ...account, boxId: 'box2', id: 'acc_box2', secretRef: 'box2' },
      new AbortController().signal,
    );
    await asked(3);
  });
});
