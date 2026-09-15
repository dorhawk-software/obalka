// Every ISDS call path takes its credentials from the vault (001 T028, research R6b).
//
// The vault and its sealed store have suites of their own (`vaultKey`, `vaultSecureStore`). What
// those cannot show is the promise the app lock makes where it matters: that with the lock on,
// nothing the app starts behind the lock screen - the launch refresh, credit, marking a message read,
// a recipient search, an ordinary or a large-volume send, a message or signed-original download -
// reads a secret or reaches ISDS before the unlock; that a read which cannot happen right now never
// turns into "sign in again"; and that a key the phone really lost does. So these run the real
// controllers over the real vault and the real sealing. Only the Keychain, the archive and the
// network are fakes.

import {
  MessagesController,
  classifyFailure,
  type MessagesTransport,
} from '../../src/features/messages/state/messagesController';
import {
  SendController,
  type SendTransport,
} from '../../src/features/messages/state/sendController';
import { AccountsController } from '../../src/features/accounts/state/accountsController';
import { removeBox } from '../../src/features/accounts/state/removeBox';
import { InMemoryAccountsStore } from '../../src/services/db/accountsStore';
import { InMemoryMessagesStore } from '../../src/services/db/messagesStore';
import { IsdsHttpTransport } from '../../src/services/isds/isdsTransport';
import { NoopCookieJar } from '../../src/services/isds/cookieJar';
import {
  InMemoryVaultKeyStorage,
  Vault,
} from '../../src/services/secureStore/vault';
import {
  InMemorySecretItems,
  VaultSecureStore,
} from '../../src/services/secureStore/vaultSecureStore';
import type {
  HttpClient,
  HttpRequest,
  HttpResponse,
} from '../../src/services/isds/httpClient';
import type { AttachmentFileStore } from '../../src/services/files/attachmentFileStore';
import type {
  DataBoxAccount,
  MessageDetail,
  OutgoingDocument,
  OwnerInfo,
  Recipient,
} from '../../src/services/isds/types';

const PROMPT = 'Odemknout Obálku';
const COOKIE_A = 'IPCZ-X-COOKIE=SENTINEL-session-A';
const PASSWORD_P = 'SENTINEL-heslo-P';

const flush = async () => {
  for (let i = 0; i < 5; i++) {
    await new Promise(resolve => setTimeout(resolve, 0));
  }
};

const owner = (boxId: string): OwnerInfo => ({
  boxId,
  label: boxId,
  dbType: null,
  passwordExpiresAt: null,
});

/**
 * A phone with two boxes added through the real controllers - an SMS box holding a session, and a
 * password box - and, when asked, the lock switched on and the app just back from the background.
 */
async function phone(opts: { lockOn: boolean }) {
  const keyStorage = new InMemoryVaultKeyStorage();
  const items = new InMemorySecretItems();
  const accounts = new InMemoryAccountsStore();
  let setting = false;
  const vault = new Vault({
    storage: keyStorage,
    lockSetting: {
      read: async () => setting,
      write: async on => {
        setting = on;
      },
    },
  });
  const secureStore = new VaultSecureStore({
    vault,
    items,
    boxIds: async () => (await accounts.list()).map(a => a.boxId),
    legacySessions: {
      legacySessionCookies: async () => [],
      clearLegacySessionCookie: async () => {},
    },
  });
  const accountsController = new AccountsController({
    accounts,
    secureStore,
  });
  await accountsController.addAccount({
    loginName: 'login-a',
    password: 'pw-a',
    method: 'otp_totp',
    host: 'production',
    ownerInfo: owner('boxA'),
    sessionCookie: COOKIE_A,
  });
  await accountsController.addAccount({
    loginName: 'login-p',
    password: PASSWORD_P,
    method: 'password',
    host: 'production',
    ownerInfo: owner('boxP'),
  });
  if (opts.lockOn) {
    expect(await vault.enable(PROMPT)).toBe('enabled');
    vault.lock(); // to the background; the app comes back under the lock screen
  }
  const list = await accounts.list();
  const box = (boxId: string) => list.find(a => a.boxId === boxId) as DataBoxAccount;
  return {
    keyStorage,
    items,
    vault,
    secureStore,
    accountsController,
    boxA: box('boxA'),
    boxP: box('boxP'),
    setting: () => setting,
  };
}

type Call = { op: string; password: string | null; sessionCookie: string | null };

/** The messages transport, recording what each call carried. */
function messagesTransport() {
  const calls: Call[] = [];
  const record = (op: string, args: { password: string | null; sessionCookie: string | null }) =>
    calls.push({ op, password: args.password, sessionCookie: args.sessionCookie });
  const transport: MessagesTransport = {
    listReceivedMessages: async args => {
      record('list', args);
      return { type: 'messages', messages: [] };
    },
    getSentMessages: async args => {
      record('sent', args);
      return { type: 'messages', messages: [] };
    },
    downloadMessage: async args => {
      record('download', args);
      return { type: 'authFault' };
    },
    downloadSignedMessage: async args => {
      record('signed', args);
      return { type: 'authFault' };
    },
    markMessageAsDownloaded: async args => {
      record('mark', args);
      return { type: 'ok' };
    },
    getCreditInfo: async args => {
      record('credit', args);
      return { type: 'credit', balanceCzk: 10 };
    },
  };
  return { transport, calls };
}

/** The send transport, recording what each call carried. */
function sendTransport() {
  const calls: Call[] = [];
  const record = (op: string, args: { password: string | null; sessionCookie: string | null }) =>
    calls.push({ op, password: args.password, sessionCookie: args.sessionCookie });
  const transport: SendTransport = {
    findRecipients: async args => {
      record('search', args);
      return { type: 'recipients', recipients: [] };
    },
    sendMessage: async args => {
      record('send', args);
      return { type: 'sent', messageId: '1' };
    },
    sendBigMessage: async args => {
      record('sendBig', args);
      return { type: 'sent', messageId: '2' };
    },
    getCreditInfo: async () => {
      throw new Error('a free send asks for no credit');
    },
    getSentMessages: async () => {
      throw new Error('no reconcile was asked for');
    },
  };
  return { transport, calls };
}

const ovm: Recipient = {
  boxId: 'urad001',
  name: 'Úřad',
  address: null,
  dbType: 'OVM',
  acceptsPdz: false,
};

const doc = (sizeBytes: number): OutgoingDocument => ({
  fileName: 'a.pdf',
  mimeType: 'application/pdf',
  sizeBytes,
  contentBase64: 'QUJD',
  isMain: true,
});

const cachedDetail = (id: string): MessageDetail => ({
  id,
  subject: 's',
  sender: 'x',
  senderAddress: null,
  recipient: null,
  recipientAddress: null,
  deliveryTime: 1,
  acceptanceTime: null,
  attachments: [],
});

/** ISDS's answer to a message list that went through: nothing new. */
const EMPTY_LIST: HttpResponse = {
  status: 200,
  text:
    '<?xml version="1.0"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">' +
    '<soap:Body><GetListOfReceivedMessagesResponse><dmStatus><dmStatusCode>0000</dmStatusCode>' +
    '</dmStatus><dmRecords/></GetListOfReceivedMessagesResponse></soap:Body></soap:Envelope>',
};

/** Records every request, so what went on the wire is what is asserted. */
class RecordingHttp implements HttpClient {
  readonly sent: HttpRequest[] = [];
  constructor(private readonly reply: (req: HttpRequest) => HttpResponse) {}
  async send(req: HttpRequest): Promise<HttpResponse> {
    this.sent.push(req);
    return this.reply(req);
  }
}

describe('with the app lock on, behind the lock screen', () => {
  it('the launch refresh reads no secret and reaches ISDS for no box until the unlock, which is the only prompt', async () => {
    const p = await phone({ lockOn: true });
    const { transport, calls } = messagesTransport();
    const messages = new MessagesController({
      transport,
      secureStore: p.secureStore,
      messagesStore: new InMemoryMessagesStore(),
    });
    const signal = new AbortController().signal;
    // What `AppShell.refreshAll` does for each box at launch, while the lock screen is still up.
    const refresh = Promise.all(
      [p.boxA, p.boxP].map(async account => ({
        outcome: await messages.listReceived(account, signal),
        credit: await messages.getCredit(account, signal),
      })),
    );
    await flush();
    expect(calls).toEqual([]);

    const prompts = p.keyStorage.prompts;
    expect(await p.vault.unlock(PROMPT)).toBe('unlocked');
    const results = await refresh;
    expect(results.map(r => r.outcome.kind)).toEqual(['loaded', 'loaded']);
    expect(results.map(r => r.credit)).toEqual([10, 10]);
    expect(p.keyStorage.prompts).toBe(prompts + 1);
    expect(calls).toEqual(
      expect.arrayContaining([
        { op: 'list', password: null, sessionCookie: COOKIE_A },
        { op: 'list', password: PASSWORD_P, sessionCookie: null },
        { op: 'credit', password: null, sessionCookie: COOKIE_A },
        { op: 'credit', password: PASSWORD_P, sessionCookie: null },
      ]),
    );

    // The next refresh, and the one after: not a single prompt more.
    await messages.listReceived(p.boxA, signal);
    await messages.listReceived(p.boxP, signal);
    expect(p.keyStorage.prompts).toBe(prompts + 1);
  });

  it('marking read, a search, an ordinary and a large-volume send all wait - and carry the session from the vault', async () => {
    const p = await phone({ lockOn: true });
    const m = messagesTransport();
    const s = sendTransport();
    const messages = new MessagesController({
      transport: m.transport,
      secureStore: p.secureStore,
      messagesStore: new InMemoryMessagesStore(),
    });
    const send = new SendController({ transport: s.transport, secureStore: p.secureStore });
    const signal = new AbortController().signal;
    const pending = Promise.all([
      messages.markRead(p.boxA, 'm1'),
      send.searchRecipients(p.boxA, 'Úřad', signal),
      send.send(p.boxA, { recipient: ovm, subject: 'Malá', files: [doc(1024)] }, signal),
      // Over 20 MB: the VoDZ track, `sendBigMessage` (018 T006).
      send.send(
        p.boxA,
        { recipient: ovm, subject: 'Velká', files: [doc(25 * 1024 * 1024)] },
        signal,
      ),
    ]);
    await flush();
    expect([...m.calls, ...s.calls]).toEqual([]);

    expect(await p.vault.unlock(PROMPT)).toBe('unlocked');
    const [marked, search, small, big] = await pending;
    expect(marked).toBe(true);
    expect(search).toEqual({ kind: 'recipients', recipients: [] });
    expect(small).toEqual({ kind: 'sent', messageId: '1' });
    expect(big).toEqual({ kind: 'sent', messageId: '2' });
    expect(m.calls).toEqual([{ op: 'mark', password: null, sessionCookie: COOKIE_A }]);
    expect(s.calls).toEqual(
      expect.arrayContaining([
        { op: 'search', password: null, sessionCookie: COOKIE_A },
        { op: 'send', password: null, sessionCookie: COOKIE_A },
        { op: 'sendBig', password: null, sessionCookie: COOKIE_A },
      ]),
    );
  });

  it('a message download and a signed-original download wait too, with the same session', async () => {
    const p = await phone({ lockOn: true });
    const { transport, calls } = messagesTransport();
    const store = new InMemoryMessagesStore();
    await store.cacheDetail('boxA', cachedDetail('m1'));
    const messages = new MessagesController({
      transport,
      secureStore: p.secureStore,
      messagesStore: store,
      // Present, so the signed-original path runs; the test ends at the transport's answer.
      attachmentFiles: {} as AttachmentFileStore,
    });
    const signal = new AbortController().signal;
    const pending = Promise.all([
      messages.getDetail(p.boxA, 'm2', 'received', signal),
      messages.fetchSignedOriginal(p.boxA, 'm1', 'received', signal),
    ]);
    await flush();
    expect(calls).toEqual([]);

    expect(await p.vault.unlock(PROMPT)).toBe('unlocked');
    expect((await pending).map(o => o.kind)).toEqual(['reauth', 'reauth']);
    expect(calls).toEqual([
      { op: 'download', password: null, sessionCookie: COOKIE_A },
      { op: 'signed', password: null, sessionCookie: COOKIE_A },
    ]);
  });
});

describe('a read that cannot happen right now is never a reason to sign in again', () => {
  it('an inbox sync abandoned while the app is locked is a retry, not an expired session', async () => {
    const p = await phone({ lockOn: true });
    const { transport, calls } = messagesTransport();
    const messages = new MessagesController({
      transport,
      secureStore: p.secureStore,
      messagesStore: new InMemoryMessagesStore(),
    });
    const ctrl = new AbortController();
    const pending = messages.listReceived(p.boxA, ctrl.signal);
    await flush();
    ctrl.abort(); // the user left the inbox behind the lock screen
    const outcome = await pending;
    expect(outcome).toEqual({ kind: 'error', messageKey: 'messages.error.credentials' });
    // The verdict the launch refresh would store for this SMS box: anything but re-auth.
    expect(classifyFailure(p.boxA, outcome)).toBe('error');
    expect(calls).toEqual([]);
    // What the controller saw underneath: not `absent`, which is the answer that means "sign in".
    const gone = new AbortController();
    gone.abort();
    expect(await p.secureStore.readSession('boxA', gone.signal)).toEqual({ status: 'unavailable' });
  });

  it('a Keychain that will not read keeps a cookie box out of re-auth, and a send says what happened', async () => {
    const p = await phone({ lockOn: false });
    const m = messagesTransport();
    const s = sendTransport();
    const messages = new MessagesController({
      transport: m.transport,
      secureStore: p.secureStore,
      messagesStore: new InMemoryMessagesStore(),
    });
    const send = new SendController({ transport: s.transport, secureStore: p.secureStore });
    p.items.failWhen = (op, service) => op === 'get' && service === 'cz.obalka.session.boxA';
    const signal = new AbortController().signal;

    const outcome = await messages.listReceived(p.boxA, signal);
    expect(outcome).toEqual({ kind: 'error', messageKey: 'messages.error.credentials' });
    expect(classifyFailure(p.boxA, outcome)).toBe('error');
    expect(
      await send.send(p.boxA, { recipient: ovm, subject: 'Malá', files: [doc(1024)] }, signal),
    ).toEqual({ kind: 'error', messageKey: 'send.error.credentials' });
    expect([...m.calls, ...s.calls]).toEqual([]);

    // The session itself was fine all along.
    p.items.failWhen = null;
    expect((await messages.listReceived(p.boxA, signal)).kind).toBe('loaded');
  });
});

describe('a key the phone lost', () => {
  it('sends each box to sign in again over the real transport, with no secret on the wire, and says why', async () => {
    const p = await phone({ lockOn: true });
    // The screen lock was removed and set again, and the gated key did not survive it.
    p.keyStorage.gated = null;
    const lost = jest.fn();
    p.secureStore.subscribeLost(lost);
    const http = new RecordingHttp(() => ({ status: 401, text: '' }));
    const messages = new MessagesController({
      transport: new IsdsHttpTransport(http, new NoopCookieJar()),
      secureStore: p.secureStore,
      messagesStore: new InMemoryMessagesStore(),
    });

    expect(await p.vault.unlock(PROMPT)).toBe('unlocked'); // a new key, behind the gate
    const a = await messages.listReceived(p.boxA, new AbortController().signal);
    const pw = await messages.listReceived(p.boxP, new AbortController().signal);
    expect(a).toEqual({ kind: 'reauth' });
    expect(pw).toEqual({ kind: 'reauth' });
    expect(classifyFailure(p.boxA, a)).toBe('reauth');
    expect(classifyFailure(p.boxP, pw)).toBe('reauth');
    // The SMS box did not ask ISDS anonymously, and nothing sealed under the old key went anywhere.
    expect(http.sent).toHaveLength(1);
    expect(JSON.stringify(http.sent)).not.toContain('SENTINEL');
    expect(lost).toHaveBeenCalled();

    // Signing in again seals the new session under the new key, and the box reads it.
    await p.accountsController.reauthAccount('boxA', 'pw-a', 'otp_totp', null, 'IPCZ-X-COOKIE=NEW');
    expect(await p.secureStore.readSession('boxA')).toEqual({
      status: 'found',
      value: 'IPCZ-X-COOKIE=NEW',
    });
  });

  it('sends only the box whose own Keychain item lost its Android Keystore key to sign in again - the other box and the archive untouched', async () => {
    // Not the vault key: one item, encrypted under a Keystore key of its own that Android lost, so
    // every read of it fails its authentication tag. It used to read as "unavailable" for ever - a
    // "try again" that never worked, and no way back to signing in.
    const p = await phone({ lockOn: false });
    const lost = jest.fn();
    p.secureStore.subscribeLost(lost);
    const archive = new InMemoryMessagesStore();
    await archive.cacheList(
      'boxA',
      'received',
      [
        {
          id: 'msg1',
          subject: 'Uloženo',
          sender: 'Úřad',
          senderAddress: null,
          recipient: null,
          recipientAddress: null,
          recipientBoxId: null,
          deliveryTime: 1000,
          acceptanceTime: 2000,
          state: 1,
          attachmentSize: null,
        },
      ],
      1,
    );
    const http = new RecordingHttp(() => EMPTY_LIST);
    const messages = new MessagesController({
      transport: new IsdsHttpTransport(http, new NoopCookieJar()),
      secureStore: p.secureStore,
      messagesStore: archive,
    });
    p.items.keyLost.add('cz.obalka.session.boxA');
    const signal = new AbortController().signal;

    const a = await messages.listReceived(p.boxA, signal);
    expect(a).toEqual({ kind: 'reauth' });
    expect(classifyFailure(p.boxA, a)).toBe('reauth');
    // The password box still syncs, over Basic: the only request that went out.
    expect((await messages.listReceived(p.boxP, signal)).kind).toBe('loaded');
    expect(http.sent).toHaveLength(1);
    expect(http.sent[0].headers?.Authorization).toMatch(/^Basic /);
    // The box's archive stays, and nobody is told the phone lost its key - it did not.
    expect((await archive.getList('boxA', 'received')).envelopes.map(e => e.id)).toEqual(['msg1']);
    expect(lost).not.toHaveBeenCalled();

    await p.accountsController.reauthAccount('boxA', 'pw-a', 'otp_totp', null, 'IPCZ-X-COOKIE=NEW');
    expect(await p.secureStore.readSession('boxA')).toEqual({
      status: 'found',
      value: 'IPCZ-X-COOKIE=NEW',
    });
  });

  it('sends a password box whose own password item lost its Android Keystore key to sign in again, and leaves the SMS box syncing', async () => {
    // The password item, not the session: the same loss on the other kind of box, which reaches ISDS
    // with HTTP Basic and so has no session to fall back on either.
    const p = await phone({ lockOn: false });
    const lost = jest.fn();
    p.secureStore.subscribeLost(lost);
    // ISDS answers a request without credentials as it answers any unauthenticated one.
    const http = new RecordingHttp(req =>
      req.cookie != null || req.headers?.Authorization != null
        ? EMPTY_LIST
        : { status: 401, text: '' },
    );
    const messages = new MessagesController({
      transport: new IsdsHttpTransport(http, new NoopCookieJar()),
      secureStore: p.secureStore,
      messagesStore: new InMemoryMessagesStore(),
    });
    p.items.keyLost.add('cz.obalka.box.boxP');
    const signal = new AbortController().signal;

    const pw = await messages.listReceived(p.boxP, signal);
    expect(pw).toEqual({ kind: 'reauth' });
    expect(classifyFailure(p.boxP, pw)).toBe('reauth');
    expect((await messages.listReceived(p.boxA, signal)).kind).toBe('loaded');
    expect(http.sent.map(r => r.cookie ?? null)).toEqual([null, COOKIE_A]);
    // Nothing sealed under the password item went out with the password box's request.
    expect(http.sent[0].headers?.Authorization).toBeUndefined();
    expect(JSON.stringify(http.sent[0])).not.toContain('SENTINEL');
    expect(lost).not.toHaveBeenCalled();

    await p.accountsController.reauthAccount('boxP', 'new-password', 'password');
    expect(await p.secureStore.readPassword('boxP')).toEqual({
      status: 'found',
      value: 'new-password',
    });
  });
});

describe('removing boxes', () => {
  it('deletes both of a box’s Keychain items, and the last box takes the key and the lock with it', async () => {
    const p = await phone({ lockOn: true });
    expect(await p.vault.unlock(PROMPT)).toBe('unlocked');
    expect([...p.items.values.keys()].sort()).toEqual([
      'cz.obalka.box.boxA',
      'cz.obalka.box.boxP',
      'cz.obalka.session.boxA',
    ]);
    const deps = {
      accounts: p.accountsController,
      purges: [],
      appLock: p.vault,
      setAppLock: jest.fn(),
    };

    await removeBox('boxA', deps);
    expect([...p.items.values.keys()]).toEqual(['cz.obalka.box.boxP']);
    expect(p.keyStorage.gated).not.toBeNull(); // another box still needs it

    await removeBox('boxP', deps);
    expect(p.items.values.size).toBe(0);
    expect(p.keyStorage.gated).toBeNull();
    expect(p.keyStorage.plain).toBeNull();
    expect(p.setting()).toBe(false);
    expect(deps.setAppLock).toHaveBeenCalledWith(false);
  });
});
