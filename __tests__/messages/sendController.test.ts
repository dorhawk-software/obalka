import { SendController } from '../../src/features/messages/state/sendController';
import type { SendTransport } from '../../src/features/messages/state/sendController';
import {
  TransportNetworkError,
  TransportTimeoutError,
} from '../../src/services/isds/transport';
import type { SecureStore } from '../../src/services/secureStore/secureStore';
import type {
  DataBoxAccount,
  OutgoingDocument,
  Recipient,
} from '../../src/services/isds/types';
import { liveSignal } from '../helpers/fakeTransport';

const account: DataBoxAccount = {
  id: 'a1',
  boxId: 'box1',
  loginName: 'user',
  label: 'Sender',
  dbType: null,
  alias: null,
  authMethod: 'password',
  host: 'czebox',
  secretRef: 'ref',
  sessionValidUntil: null,
  passwordExpiresAt: null,
  lastSyncedAt: null,
  messageCount: null,
  unreadCount: null,
  pdzCreditCzk: null,
  syncError: null,
  createdAt: 0,
  updatedAt: 0,
};

// Nothing stored: these tests never look at the box's password, and a password box holds no session.
const secureStore: Pick<SecureStore, 'readPassword' | 'readSession'> = {
  readPassword: async () => ({ status: 'absent' }),
  readSession: async () => ({ status: 'absent' }),
};
const ovm: Recipient = {
  boxId: 'aaaaaa1',
  name: 'Úřad',
  address: 'Náměstí 1, 11000 Praha',
  dbType: 'OVM',
  acceptsPdz: false,
};
const person: Recipient = {
  boxId: 'bbbbbb2',
  name: 'Jan Novák',
  address: null,
  dbType: 'FO',
  acceptsPdz: true,
};

const unset = (name: string) => async (): Promise<never> => {
  throw new Error(`${name} not configured`);
};

function controller(
  transport: Partial<SendTransport>,
  opts: { now?: () => number } = {},
): SendController {
  const full: SendTransport = {
    findRecipients: transport.findRecipients ?? unset('findRecipients'),
    sendMessage: transport.sendMessage ?? unset('sendMessage'),
    sendBigMessage: transport.sendBigMessage ?? unset('sendBigMessage'),
    getCreditInfo: transport.getCreditInfo ?? unset('getCreditInfo'),
    getSentMessages: transport.getSentMessages ?? unset('getSentMessages'),
  };
  return new SendController({
    transport: full,
    secureStore,
    host: 'czebox',
    now: opts.now,
  });
}

// A lean SENT-list envelope (only the fields reconcile/status inspect matter).
const sentEnvelope = (over: {
  id: string;
  subject: string;
  recipientBoxId: string | null;
  deliveryTime: number | null;
  acceptanceTime?: number | null;
  state?: number;
}) => ({
  sender: 'Sender',
  senderAddress: null,
  recipient: null,
  recipientAddress: null,
  acceptanceTime: null,
  state: 6,
  attachmentSize: 0,
  ...over,
});

const doc: OutgoingDocument = {
  fileName: 'a.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 1024,
  contentBase64: 'AAA=',
  isMain: true,
};
const sentOk: Partial<SendTransport> = {
  sendMessage: async () => ({ type: 'sent', messageId: 'dm1' }),
  getCreditInfo: async () => ({ type: 'credit', balanceCzk: 100 }),
};
const noPdz: Recipient = { ...person, acceptsPdz: false };

describe('SendController.searchRecipients', () => {
  it('returns the recipients on success', async () => {
    const c = controller({
      findRecipients: async () => ({
        type: 'recipients',
        recipients: [ovm, person],
      }),
    });
    const out = await c.searchRecipients(account, 'novak', liveSignal());
    expect(out).toEqual({ kind: 'recipients', recipients: [ovm, person] });
  });

  it('does not call the transport for a blank query', async () => {
    let called = false;
    const c = controller({
      findRecipients: async () => {
        called = true;
        return { type: 'recipients', recipients: [] };
      },
    });
    const out = await c.searchRecipients(account, '   ', liveSignal());
    expect(out).toEqual({ kind: 'recipients', recipients: [] });
    expect(called).toBe(false);
  });

  it('maps a session expiry (authFault) to reauth', async () => {
    const c = controller({
      findRecipients: async () => ({ type: 'authFault' }),
    });
    expect(await c.searchRecipients(account, 'x', liveSignal())).toEqual({
      kind: 'reauth',
    });
  });

  it('maps a server fault to a localized error (never throws)', async () => {
    const c = controller({
      findRecipients: async () => ({ type: 'serverFault' }),
    });
    expect(await c.searchRecipients(account, 'x', liveSignal())).toEqual({
      kind: 'error',
      messageKey: 'send.error.search',
    });
  });

  it('maps a thrown timeout/network error to a recoverable error (Principle II)', async () => {
    const timeout = controller({
      findRecipients: async () => {
        throw new TransportTimeoutError();
      },
    });
    expect(await timeout.searchRecipients(account, 'x', liveSignal())).toEqual({
      kind: 'error',
      messageKey: 'send.error.timeout',
    });

    const network = controller({
      findRecipients: async () => {
        throw new TransportNetworkError();
      },
    });
    expect(await network.searchRecipients(account, 'x', liveSignal())).toEqual({
      kind: 'error',
      messageKey: 'send.error.network',
    });
  });
});

describe('SendController.send', () => {
  it('sends a free (OVM) message straight through', async () => {
    const c = controller(sentOk);
    const out = await c.send(
      account,
      { recipient: ovm, subject: 'Ahoj', files: [doc] },
      liveSignal(),
    );
    expect(out).toEqual({ kind: 'sent', messageId: 'dm1' });
  });

  it('rejects an empty message (≥1 document required), without calling the transport', async () => {
    let called = false;
    const c = controller({
      sendMessage: async () => {
        called = true;
        return { type: 'sent', messageId: 'x' };
      },
    });
    const out = await c.send(
      account,
      { recipient: ovm, subject: 'x', files: [] },
      liveSignal(),
    );
    expect(out).toEqual({ kind: 'error', messageKey: 'send.error.noDocument' });
    expect(called).toBe(false);
  });

  it('NO SILENT SPEND: a paid (PDZ) send needs confirmation (with the live credit) before any send', async () => {
    let sent = false;
    const c = controller({
      getCreditInfo: async () => ({ type: 'credit', balanceCzk: 100 }),
      sendMessage: async () => {
        sent = true;
        return { type: 'sent', messageId: 'x' };
      },
    });
    const out = await c.send(
      account,
      { recipient: person, subject: 'x', files: [doc] },
      liveSignal(),
    );
    expect(out).toMatchObject({
      kind: 'needsConfirmation',
      estimate: { paid: true },
      credit: { balanceCzk: 100 },
    });
    expect(sent).toBe(false);
  });

  it('blocks a recipient that does not accept PDZ (no network)', async () => {
    let creditCalled = false;
    const c = controller({
      getCreditInfo: async () => {
        creditCalled = true;
        return { type: 'credit', balanceCzk: 100 };
      },
    });
    const out = await c.send(
      account,
      { recipient: noPdz, subject: 'x', files: [doc] },
      liveSignal(),
    );
    expect(out).toEqual({ kind: 'blocked', reason: 'recipientRejectsPdz' });
    expect(creditCalled).toBe(false);
  });

  it('blocks an insufficient-credit send (no spend)', async () => {
    let sent = false;
    const c = controller({
      getCreditInfo: async () => ({ type: 'credit', balanceCzk: 5 }),
      sendMessage: async () => {
        sent = true;
        return { type: 'sent', messageId: 'x' };
      },
    });
    const out = await c.send(
      account,
      { recipient: person, subject: 'x', files: [doc] },
      liveSignal(),
    );
    expect(out).toEqual({ kind: 'blocked', reason: 'insufficientCredit' });
    expect(sent).toBe(false);
  });

  it('blocks when the credit/PDZ lookup faults (treated as PDZ unavailable)', async () => {
    const c = controller({
      getCreditInfo: async () => ({ type: 'serverFault' }),
    });
    const out = await c.send(
      account,
      { recipient: person, subject: 'x', files: [doc] },
      liveSignal(),
    );
    expect(out).toEqual({ kind: 'blocked', reason: 'pdzDisabled' });
  });

  it('blocks a message over the VoDZ ceiling (>100 MB → genuinely unsupported)', async () => {
    const c = controller(sentOk);
    const huge = { ...doc, sizeBytes: 101 * 1024 * 1024 };
    const out = await c.send(
      account,
      { recipient: ovm, subject: 'x', files: [huge] },
      liveSignal(),
    );
    expect(out).toEqual({ kind: 'blocked', reason: 'tooLarge' });
  });

  it('sends a paid message once confirmed', async () => {
    const c = controller(sentOk);
    const out = await c.send(
      account,
      { recipient: person, subject: 'x', files: [doc] },
      liveSignal(),
      { confirmedPaid: true },
    );
    expect(out).toEqual({ kind: 'sent', messageId: 'dm1' });
  });

  it('maps a session expiry to reauth', async () => {
    const c = controller({ sendMessage: async () => ({ type: 'authFault' }) });
    const out = await c.send(
      account,
      { recipient: ovm, subject: 'x', files: [doc] },
      liveSignal(),
    );
    expect(out).toEqual({ kind: 'reauth' });
  });

  it('never throws - a timeout maps to a recoverable error (Principle II)', async () => {
    const timeout = controller({
      sendMessage: async () => {
        throw new TransportTimeoutError();
      },
    });
    expect(
      await timeout.send(
        account,
        { recipient: ovm, subject: 'x', files: [doc] },
        liveSignal(),
      ),
      // a timeout on the actual send is `ambiguous` - it may have gone through (reconcile on retry)
    ).toEqual({
      kind: 'error',
      messageKey: 'send.error.timeout',
      ambiguous: true,
    });

    // a non-timeout/network throw falls back to the generic send error
    const other = controller({
      sendMessage: async () => {
        throw new Error('boom');
      },
    });
    expect(
      await other.send(
        account,
        { recipient: ovm, subject: 'x', files: [doc] },
        liveSignal(),
      ),
    ).toEqual({ kind: 'error', messageKey: 'send.error.send' });
  });
});

describe('SendController.send - size routing (VoDZ / US3)', () => {
  const small = { ...doc, sizeBytes: 1 * 1024 * 1024 }; // 1 MB → ordinary
  const big = { ...doc, sizeBytes: 25 * 1024 * 1024 }; // 25 MB → VoDZ band (20–100)

  it('sends an ordinary (≤20 MB) message via sendMessage, NOT the big track', async () => {
    let bigCalled = false;
    const c = controller({
      sendMessage: async () => ({ type: 'sent', messageId: 'dm-normal' }),
      sendBigMessage: async () => {
        bigCalled = true;
        return { type: 'sent', messageId: 'dm-big' };
      },
    });
    const out = await c.send(
      account,
      { recipient: ovm, subject: 'x', files: [small] },
      liveSignal(),
    );
    expect(out).toEqual({ kind: 'sent', messageId: 'dm-normal' });
    expect(bigCalled).toBe(false);
  });

  it('routes a 20–100 MB message to the VoDZ track (sendBigMessage), NOT sendMessage', async () => {
    let normalCalled = false;
    const c = controller({
      sendMessage: async () => {
        normalCalled = true;
        return { type: 'sent', messageId: 'dm-normal' };
      },
      sendBigMessage: async () => ({ type: 'sent', messageId: 'dm-big' }),
    });
    const out = await c.send(
      account,
      { recipient: ovm, subject: 'x', files: [big] },
      liveSignal(),
    );
    expect(out).toEqual({ kind: 'sent', messageId: 'dm-big' });
    expect(normalCalled).toBe(false);
  });

  it('keeps the no-silent-spend gate for a paid VoDZ send (confirmation before any big send)', async () => {
    let bigCalled = false;
    const c = controller({
      getCreditInfo: async () => ({ type: 'credit', balanceCzk: 100 }),
      sendBigMessage: async () => {
        bigCalled = true;
        return { type: 'sent', messageId: 'dm-big' };
      },
    });
    const out = await c.send(
      account,
      { recipient: person, subject: 'x', files: [big] },
      liveSignal(),
    );
    expect(out).toMatchObject({ kind: 'needsConfirmation' });
    expect(bigCalled).toBe(false);
  });
});

// A double tap on "Odeslat" (audit 2026-09-23). The screen guards its button, but its `busy` state
// lands a render late, and ISDS has no idempotency key: two overlapping calls used to be two official
// messages - and for a PDZ two charges. The second call is made here WITHOUT awaiting the first, the
// way a second press arrives before the re-render.
describe('SendController.send - one send of a message per box at a time (double tap)', () => {
  const big = { ...doc, sizeBytes: 25 * 1024 * 1024 }; // the VoDZ band

  /** A transport whose send is held open until the test lets it go, counting every call. */
  function heldTransport() {
    let release: () => void = () => {};
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });
    const sendMessage = jest.fn(async () => {
      await gate;
      return { type: 'sent' as const, messageId: 'dm-once' };
    });
    const sendBigMessage = jest.fn(async () => {
      await gate;
      return { type: 'sent' as const, messageId: 'dm-big-once' };
    });
    const getCreditInfo = jest.fn(async () => ({ type: 'credit' as const, balanceCzk: 100 }));
    return { sendMessage, sendBigMessage, getCreditInfo, release: () => release() };
  }

  it('a free message: the second call joins the first and ISDS is asked once', async () => {
    const t = heldTransport();
    const c = controller(t);
    const message = { recipient: ovm, subject: 'Podání', files: [doc] };
    const first = c.send(account, message, liveSignal());
    const second = c.send(account, message, liveSignal());
    t.release();
    const outcomes = await Promise.all([first, second]);

    expect(t.sendMessage).toHaveBeenCalledTimes(1);
    expect(outcomes).toEqual([
      { kind: 'sent', messageId: 'dm-once' },
      { kind: 'sent', messageId: 'dm-once' },
    ]);
    // Joined, not merely equal: the caller is handed the very send that is running.
    expect(second).toBe(first);
  });

  it('a confirmed PDZ: one send, so one charge', async () => {
    const t = heldTransport();
    const c = controller(t);
    const message = { recipient: person, subject: 'Faktura', files: [doc] };
    const first = c.send(account, message, liveSignal(), { confirmedPaid: true });
    const second = c.send(account, message, liveSignal(), { confirmedPaid: true });
    t.release();
    await Promise.all([first, second]);

    expect(t.sendMessage).toHaveBeenCalledTimes(1);
  });

  it('a large-volume (VoDZ) message: sendBigMessage once', async () => {
    const t = heldTransport();
    const c = controller(t);
    const message = { recipient: ovm, subject: 'Spis', files: [big] };
    const first = c.send(account, message, liveSignal());
    const second = c.send(account, message, liveSignal());
    t.release();
    await Promise.all([first, second]);

    expect(t.sendBigMessage).toHaveBeenCalledTimes(1);
    expect(t.sendMessage).not.toHaveBeenCalled();
  });

  it('holds only while the send runs: the next message, once it is over, is sent', async () => {
    const t = heldTransport();
    const c = controller(t);
    t.release();
    await c.send(account, { recipient: ovm, subject: 'První', files: [doc] }, liveSignal());
    await c.send(account, { recipient: ovm, subject: 'Druhá', files: [doc] }, liveSignal());

    expect(t.sendMessage).toHaveBeenCalledTimes(2);
  });

  it('holds per message: a different message from the same box is sent, not answered for', async () => {
    // Joining it would report as sent a message that never left.
    const t = heldTransport();
    const c = controller(t);
    const first = c.send(account, { recipient: ovm, subject: 'Malá', files: [doc] }, liveSignal());
    const second = c.send(account, { recipient: ovm, subject: 'Jiná', files: [doc] }, liveSignal());
    const third = c.send(account, { recipient: person, subject: 'Malá', files: [doc] }, liveSignal(), {
      confirmedPaid: true,
    });
    t.release();
    await Promise.all([first, second, third]);

    expect(t.sendMessage).toHaveBeenCalledTimes(3);
  });

  it('joins a double tap even though the typed body was rendered to a new PDF each time', async () => {
    const t = heldTransport();
    const c = controller(t);
    const pdf = (content: string) => ({ ...doc, fileName: 'Textová zpráva.pdf', contentBase64: content });
    const first = c.send(account, { recipient: ovm, subject: 'x', files: [pdf('AAA=')] }, liveSignal());
    const second = c.send(account, { recipient: ovm, subject: 'x', files: [pdf('AAB=')] }, liveSignal());
    t.release();
    await Promise.all([first, second]);

    expect(t.sendMessage).toHaveBeenCalledTimes(1);
  });

  it('holds per box: another box sends at the same time', async () => {
    const t = heldTransport();
    const c = controller(t);
    const other: DataBoxAccount = { ...account, id: 'a2', boxId: 'box2' };
    const first = c.send(account, { recipient: ovm, subject: 'x', files: [doc] }, liveSignal());
    const second = c.send(other, { recipient: ovm, subject: 'x', files: [doc] }, liveSignal());
    t.release();
    await Promise.all([first, second]);

    expect(t.sendMessage).toHaveBeenCalledTimes(2);
  });
});

describe('SendController.send - no double charge (reconcileFirst)', () => {
  const NOW = 1_700_000_000_000;
  const message = { recipient: person, subject: 'Smlouva', files: [doc] };

  it('finds a matching just-sent message and returns it WITHOUT re-sending or charging', async () => {
    let sent = false;
    let creditCalled = false;
    const c = controller(
      {
        getSentMessages: async () => ({
          type: 'messages',
          messages: [
            sentEnvelope({
              id: 'dm-existing',
              subject: 'Smlouva',
              recipientBoxId: person.boxId,
              deliveryTime: NOW - 60_000, // 1 min ago - inside the window
            }),
          ],
        }),
        sendMessage: async () => {
          sent = true;
          return { type: 'sent', messageId: 'dm-new' };
        },
        getCreditInfo: async () => {
          creditCalled = true;
          return { type: 'credit', balanceCzk: 100 };
        },
      },
      { now: () => NOW },
    );
    const out = await c.send(account, message, liveSignal(), {
      confirmedPaid: true,
      reconcileFirst: true,
    });
    expect(out).toEqual({
      kind: 'sent',
      messageId: 'dm-existing',
      reconciled: true,
    });
    expect(sent).toBe(false);
    expect(creditCalled).toBe(false);
  });

  it('proceeds to a normal send when no recent sent message matches', async () => {
    const c = controller(
      {
        getSentMessages: async () => ({
          type: 'messages',
          messages: [
            // same subject but a DIFFERENT recipient → not our message
            sentEnvelope({
              id: 'dm-other',
              subject: 'Smlouva',
              recipientBoxId: 'zzzzzz9',
              deliveryTime: NOW - 60_000,
            }),
            // our recipient but stale (outside the 15-min window)
            sentEnvelope({
              id: 'dm-stale',
              subject: 'Smlouva',
              recipientBoxId: person.boxId,
              deliveryTime: NOW - 60 * 60_000,
            }),
          ],
        }),
        ...sentOk,
      },
      { now: () => NOW },
    );
    const out = await c.send(account, message, liveSignal(), {
      confirmedPaid: true,
      reconcileFirst: true,
    });
    expect(out).toEqual({ kind: 'sent', messageId: 'dm1' });
  });

  it('falls through to a normal send if the sent-list lookup itself fails (never blocks the user)', async () => {
    const c = controller(
      {
        getSentMessages: async () => {
          throw new TransportTimeoutError();
        },
        ...sentOk,
      },
      { now: () => NOW },
    );
    const out = await c.send(account, message, liveSignal(), {
      confirmedPaid: true,
      reconcileFirst: true,
    });
    expect(out).toEqual({ kind: 'sent', messageId: 'dm1' });
  });
});

describe('SendController.fetchSentStatus (post-send confirmation, T035)', () => {
  it('returns the sent message’s delivery/acceptance state from the sent list', async () => {
    const c = controller({
      getSentMessages: async () => ({
        type: 'messages',
        messages: [
          sentEnvelope({
            id: 'dm-99',
            subject: 's',
            recipientBoxId: 'r',
            deliveryTime: 1700,
            acceptanceTime: 1800,
            state: 7,
          }),
        ],
      }),
    });
    expect(await c.fetchSentStatus(account, 'dm-99', liveSignal())).toEqual({
      deliveryTime: 1700,
      acceptanceTime: 1800,
      state: 7,
    });
  });

  it('returns null when the message is not (yet) in the sent list', async () => {
    const c = controller({
      getSentMessages: async () => ({ type: 'messages', messages: [] }),
    });
    expect(
      await c.fetchSentStatus(account, 'missing', liveSignal()),
    ).toBeNull();
  });

  it('never throws - a transport failure yields null (confirmation is best-effort)', async () => {
    const c = controller({
      getSentMessages: async () => {
        throw new TransportTimeoutError();
      },
    });
    expect(await c.fetchSentStatus(account, 'x', liveSignal())).toBeNull();
  });
});

describe('SendController.estimate', () => {
  it('an OVM recipient is free', () => {
    const c = controller({
      findRecipients: async () => ({ type: 'recipients', recipients: [] }),
    });
    expect(c.estimate(ovm)).toMatchObject({
      paid: false,
      tier: 'none',
      approxCzk: null,
    });
  });

  it('a private recipient is a paid PDZ', () => {
    const c = controller({
      findRecipients: async () => ({ type: 'recipients', recipients: [] }),
    });
    expect(c.estimate(person, [{ sizeBytes: 1024 }])).toMatchObject({
      paid: true,
      tier: 'normal',
    });
  });
});
