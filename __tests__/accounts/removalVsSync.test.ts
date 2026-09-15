// A box removal against work already in flight for that box (001 T037, constitution III).
//
// A launch or refresh-all sync already out for a box when the box was removed wrote its envelopes back
// into the archive after the purge: `loadFolder` cached the list once ISDS answered, without asking
// whether the box was still listed, and nothing aborted the call. A download, a signed original or a
// large-volume walk landing late left the box's files the same way. Each is raced here against a real
// removal - `removeBox`, `AccountsController`, `MessagesController` and `BoxWork`, wired as `deps.ts`
// wires them, over in-memory stores - and what is left of the box afterwards is what is checked.

import {
  removeBox,
  resumeRemoval,
  type RemoveBoxDeps,
} from '../../src/features/accounts/state/removeBox';
import { AccountsController } from '../../src/features/accounts/state/accountsController';
import {
  MessagesController,
  type MessagesTransport,
} from '../../src/features/messages/state/messagesController';
import { BoxWork } from '../../src/features/messages/state/boxWork';
import { InMemoryAccountsStore } from '../../src/services/db/accountsStore';
import { InMemoryMessagesStore } from '../../src/services/db/messagesStore';
import { InMemorySecureStore } from '../../src/services/secureStore/secureStore';
import * as telemetry from '../../src/services/telemetry/telemetry';
import type { AttachmentFileStore } from '../../src/services/files/attachmentFileStore';
import type { VodzAttachmentDownloader } from '../../src/services/files/vodzAttachmentDownloader';
import type {
  MessageDetailResult,
  MessageListResult,
  SignedMessageResult,
} from '../../src/services/isds/transport';
import type {
  DataBoxAccount,
  MessageDetail,
  MessageEnvelope,
} from '../../src/services/isds/types';

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

const signal = () => new AbortController().signal;

function held() {
  let release!: () => void;
  const promise = new Promise<void>(resolve => {
    release = resolve;
  });
  return { promise, release };
}

/** An ISDS call that answers when the test says, keeping the signal it was made under. */
function heldCall<T>() {
  let answer: (value: T) => void = () => {};
  let made: AbortSignal | null = null;
  return {
    call: (args: { signal: AbortSignal }): Promise<T> => {
      made = args.signal;
      return new Promise<T>(resolve => {
        answer = resolve;
      });
    },
    answer: (value: T) => answer(value),
    signal: () => made,
  };
}

const unexpected = (name: string) => async (): Promise<never> => {
  throw new Error(`${name} was not expected`);
};

const envelope = (id: string): MessageEnvelope => ({
  id,
  subject: 'Výzva',
  sender: 'Úřad',
  senderAddress: null,
  recipient: null,
  recipientAddress: null,
  recipientBoxId: null,
  deliveryTime: 1000,
  acceptanceTime: null,
  state: 5,
  attachmentSize: null,
});

/** A downloaded message whose document still arrives inline, as ISDS sends it. */
const detail = (id: string): MessageDetail => ({
  id,
  subject: 'Výzva',
  sender: 'Úřad',
  senderAddress: null,
  recipient: null,
  recipientAddress: null,
  deliveryTime: 1000,
  acceptanceTime: null,
  attachments: [
    { name: 'vyzva.pdf', mimeType: 'application/pdf', metaType: 'main', contentBase64: 'QUJDRA==' },
  ],
});

/** A phone with boxes `a` and `b`, wired as the app wires them. */
async function phone() {
  const accountsStore = new InMemoryAccountsStore();
  const secureStore = new InMemorySecureStore();
  const accounts = new AccountsController({
    accounts: accountsStore,
    secureStore,
  });
  for (const boxId of ['a', 'b']) {
    await accounts.addAccount({
      loginName: `login-${boxId}`,
      password: 'pw',
      method: 'password',
      host: 'czebox',
      ownerInfo: { boxId, label: boxId, dbType: null, passwordExpiresAt: null },
    });
  }
  // As `deps.ts` builds it: a write asks the store whether its box is listed.
  const work = new BoxWork(async boxId =>
    (await accountsStore.list()).some(a => a.boxId === boxId),
  );
  const archive = new InMemoryMessagesStore();
  const onDisk = new Set<string>();
  const log: string[] = [];
  const files: AttachmentFileStore = {
    async persist(boxId, messageId, attachments) {
      return attachments.map((a, i) => {
        const localPath = `/disk/${boxId}/${messageId}/${i}`;
        onDisk.add(localPath);
        return { ...a, contentBase64: '', localPath, size: a.contentBase64.length };
      });
    },
    async persistSignedZfo(boxId, messageId, signature) {
      const localPath = `/disk/${boxId}/${messageId}/DZ_${messageId}.zfo`;
      onDisk.add(localPath);
      return { fileName: `DZ_${messageId}.zfo`, localPath, size: signature.length };
    },
    async removeForBox(boxId) {
      log.push(`files:cleared:${boxId}`);
      for (const path of [...onDisk]) {
        if (path.startsWith(`/disk/${boxId}/`)) {
          onDisk.delete(path);
        }
      }
    },
    async exists(path) {
      return onDisk.has(path);
    },
    async readBytes() {
      return null;
    },
  };
  const messages = (
    transport: Partial<MessagesTransport>,
    vodzDownloader?: VodzAttachmentDownloader,
  ) =>
    new MessagesController({
      transport: {
        listReceivedMessages: unexpected('listReceivedMessages'),
        getSentMessages: unexpected('getSentMessages'),
        downloadMessage: unexpected('downloadMessage'),
        downloadSignedMessage: unexpected('downloadSignedMessage'),
        markMessageAsDownloaded: unexpected('markMessageAsDownloaded'),
        getCreditInfo: unexpected('getCreditInfo'),
        ...transport,
      },
      secureStore,
      messagesStore: archive,
      attachmentFiles: files,
      vodzDownloader,
      now: () => 1000,
      work,
    });
  const removal = (
    controller: MessagesController,
    purges: RemoveBoxDeps['purges'] = [
      { step: 'archive', run: boxId => controller.clearBoxCache(boxId) },
    ],
  ): RemoveBoxDeps => ({
    accounts,
    purges,
    appLock: { forget: async () => {} },
    setAppLock: () => {},
    work,
  });
  const box = async (boxId: string): Promise<DataBoxAccount> => {
    const found = (await accounts.listAccounts()).find(a => a.boxId === boxId);
    if (!found) {
      throw new Error(`no box ${boxId}`);
    }
    return found;
  };
  return { accounts, archive, onDisk, log, messages, removal, box };
}

/** An ISDS call that rejects the way the transport does once its signal aborts, and never answers. */
function stoppableCall() {
  let made: AbortSignal | null = null;
  return {
    call: (args: { signal: AbortSignal }): Promise<never> => {
      made = args.signal;
      return new Promise<never>((_, reject) => {
        args.signal.addEventListener('abort', () =>
          reject(Object.assign(new Error('Aborted'), { name: 'AbortError' })),
        );
      });
    },
    signal: () => made,
  };
}

describe('a sync out for a box when its removal starts', () => {
  it('is stopped, and writes nothing of the box when ISDS answers anyway - while the box that stays syncs', async () => {
    const p = await phone();
    const listings = { a: heldCall<MessageListResult>(), b: heldCall<MessageListResult>() };
    const controller = p.messages({
      listReceivedMessages: args => (args.loginName === 'login-a' ? listings.a : listings.b).call(args),
    });
    const loadingA = controller.listReceived(await p.box('a'), signal());
    const loadingB = controller.listReceived(await p.box('b'), signal());
    await flush();

    expect((await removeBox('a', p.removal(controller))).kind).toBe('removed');
    expect(listings.a.signal()?.aborted).toBe(true);
    expect(listings.b.signal()?.aborted).toBe(false);

    // A response already on its way does not hear the abort.
    listings.a.answer({ type: 'messages', messages: [envelope('a1')] });
    listings.b.answer({ type: 'messages', messages: [envelope('b1')] });
    expect(await loadingA).not.toMatchObject({ kind: 'loaded' });
    expect(await loadingB).toMatchObject({ kind: 'loaded' });
    expect((await p.archive.getList('a', 'received')).envelopes).toEqual([]);
    expect((await p.archive.getList('b', 'received')).envelopes.map(e => e.id)).toEqual(['b1']);
  });

  it('lets a listing already being written land before the archive is cleared, never after it', async () => {
    const p = await phone();
    const writing = held();
    const cacheList = p.archive.cacheList.bind(p.archive);
    const cached = jest
      .spyOn(p.archive, 'cacheList')
      .mockImplementation(async (...args: Parameters<InMemoryMessagesStore['cacheList']>) => {
        await writing.promise;
        await cacheList(...args);
      });
    const controller = p.messages({
      listReceivedMessages: async () => ({ type: 'messages', messages: [envelope('a1')] }),
    });
    const loading = controller.listReceived(await p.box('a'), signal());
    await flush();
    expect(cached).toHaveBeenCalled();

    let ended = false;
    const removing = removeBox('a', p.removal(controller)).then(result => {
      ended = true;
      return result;
    });
    await flush();
    // The archive waits for the write that got in first.
    expect(ended).toBe(false);

    writing.release();
    expect((await removing).kind).toBe('removed');
    await loading;
    expect((await p.archive.getList('a', 'received')).envelopes).toEqual([]);
  });
});

describe('a download out for a box when its removal starts', () => {
  it('leaves no file and no detail of the message when ISDS answers anyway', async () => {
    const p = await phone();
    const download = heldCall<MessageDetailResult>();
    const controller = p.messages({ downloadMessage: download.call });
    const opening = controller.getDetail(await p.box('a'), '7', 'received', signal());
    await flush();

    await removeBox('a', p.removal(controller));
    expect(download.signal()?.aborted).toBe(true);

    download.answer({ type: 'detail', detail: detail('7'), signedZfo: 'U0lHTkVE' });
    expect(await opening).not.toMatchObject({ kind: 'detail' });
    expect([...p.onDisk]).toEqual([]);
    expect(await p.archive.getDetail('a', '7')).toBeNull();
  });

  it('writes no signed original that arrives after the removal', async () => {
    const p = await phone();
    await p.archive.cacheList('a', 'received', [envelope('7')], 1000);
    await p.archive.cacheDetail('a', { ...detail('7'), attachments: [] });
    const original = heldCall<SignedMessageResult>();
    const controller = p.messages({ downloadSignedMessage: original.call });
    const fetching = controller.fetchSignedOriginal(await p.box('a'), '7', 'received', signal());
    await flush();

    await removeBox('a', p.removal(controller));
    expect(original.signal()?.aborted).toBe(true);

    original.answer({ type: 'signed', signedZfo: 'U0lHTkVE' });
    expect(await fetching).not.toMatchObject({ kind: 'saved' });
    expect([...p.onDisk]).toEqual([]);
    // Nor does the detail it would have recorded the original on come back.
    expect(await p.archive.getDetail('a', '7')).toBeNull();
  });

  it('stops a large-volume walk, and clears the box’s files only once the walk has stopped', async () => {
    const p = await phone();
    await p.archive.cacheList('a', 'received', [envelope('7')], 1000);
    const walk: VodzAttachmentDownloader = {
      download: async ({ boxId, messageId, signal: walking }) => {
        p.log.push('walk:started');
        // The first enclosure, already streamed to disk.
        p.onDisk.add(`/disk/${boxId}/${messageId}/0`);
        await new Promise(resolve => walking.addEventListener('abort', resolve));
        p.log.push('walk:stopped');
        throw Object.assign(new Error('Aborted'), { name: 'AbortError' });
      },
      downloadSignedZfo: unexpected('downloadSignedZfo'),
    };
    const controller = p.messages({ downloadMessage: async () => ({ type: 'unsupported' }) }, walk);
    const opening = controller.getDetail(await p.box('a'), '7', 'received', signal());
    await flush();
    expect(p.log).toEqual(['walk:started']);

    await removeBox('a', p.removal(controller));
    expect(p.log).toEqual(['walk:started', 'walk:stopped', 'files:cleared:a']);
    expect([...p.onDisk]).toEqual([]);
    expect(await opening).toMatchObject({ kind: 'error' });
  });
});

describe('a box whose removal is still clearing it', () => {
  it('gets nothing written for it: a stored message opened meanwhile is shown as it was, with no file made', async () => {
    const p = await phone();
    // Stored before files were kept on disk, so opening it writes the document out (migrate-on-open).
    await p.archive.cacheDetail('a', detail('7'));
    const controller = p.messages({});
    const clearing = held();
    const removing = removeBox(
      'a',
      p.removal(controller, [
        {
          step: 'archive',
          run: async boxId => {
            await clearing.promise;
            await controller.clearBoxCache(boxId);
          },
        },
      ]),
    );
    await flush();

    const opened = await controller.getCachedDetail('a', '7');
    expect(opened?.attachments[0].contentBase64).toBe('QUJDRA==');
    expect([...p.onDisk]).toEqual([]);

    clearing.release();
    expect((await removing).kind).toBe('removed');
    expect([...p.onDisk]).toEqual([]);
    expect(await p.archive.getDetail('a', '7')).toBeNull();
  });
});

// Stopped by the box's removal is the app working, not a failure: an abort is never reported
// (`MessagesController.mapError`). Marking read and the credit catch everything they meet, and the
// removal's abort went out as read receipts, or the credit service, failing.
describe('a call its box’s removal stopped', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('marking a message read: stopped and not reported, while one that failed on its own still is', async () => {
    const reported = jest.spyOn(telemetry, 'reportFailure').mockImplementation(() => {});
    const p = await phone();
    const refused = new Error('socket hang up');
    const marking = stoppableCall();
    const controller = p.messages({
      markMessageAsDownloaded: async args => {
        if (args.messageId === 'broken') {
          throw refused;
        }
        return marking.call(args);
      },
    });
    await expect(controller.markRead(await p.box('b'), 'broken')).resolves.toBe(false);
    expect(reported).toHaveBeenCalledWith('isds.markRead', refused, { stage: 'transport' });
    reported.mockClear();

    const marked = controller.markRead(await p.box('a'), '7');
    await flush();
    await removeBox('a', p.removal(controller));
    expect(marking.signal()?.aborted).toBe(true);
    await expect(marked).resolves.toBe(false);
    expect(reported).not.toHaveBeenCalledWith('isds.markRead', expect.anything(), expect.anything());
  });

  it('the credit: stopped and not reported, while one that failed on its own still is', async () => {
    const reported = jest.spyOn(telemetry, 'reportFailure').mockImplementation(() => {});
    const p = await phone();
    const refused = new Error('socket hang up');
    const credit = stoppableCall();
    const controller = p.messages({
      getCreditInfo: async args => {
        if (args.boxId === 'b') {
          throw refused;
        }
        return credit.call(args);
      },
    });
    await expect(controller.getCredit(await p.box('b'), signal())).resolves.toBeNull();
    expect(reported).toHaveBeenCalledWith('isds.credit', refused, { stage: 'transport' });
    reported.mockClear();

    const asking = controller.getCredit(await p.box('a'), signal());
    await flush();
    await removeBox('a', p.removal(controller));
    expect(credit.signal()?.aborted).toBe(true);
    await expect(asking).resolves.toBeNull();
    expect(reported).not.toHaveBeenCalledWith('isds.credit', expect.anything(), expect.anything());
  });
});

// A removal finished later (`resumeRemoval`): at the next launch, or when its dialog is closed. It
// stops the box's work only once the box is known not to be listed, and then as a removal does.
describe('a removal finished later', () => {
  it('stops a call still out for a box whose row is gone and writes nothing of it, and leaves a box listed again syncing', async () => {
    const p = await phone();
    const listings = { a: heldCall<MessageListResult>(), b: heldCall<MessageListResult>() };
    const controller = p.messages({
      listReceivedMessages: args => (args.loginName === 'login-a' ? listings.a : listings.b).call(args),
    });
    const loadingA = controller.listReceived(await p.box('a'), signal());
    const loadingB = controller.listReceived(await p.box('b'), signal());
    await flush();
    // The removal that took box a's row did not finish; box b was added again, or restored, meanwhile.
    await p.accounts.removeRow('a');

    expect((await resumeRemoval('b', p.removal(controller))).kind).toBe('listed');
    expect(listings.b.signal()?.aborted).toBe(false);
    expect((await resumeRemoval('a', p.removal(controller))).kind).toBe('removed');
    expect(listings.a.signal()?.aborted).toBe(true);

    listings.a.answer({ type: 'messages', messages: [envelope('a1')] });
    listings.b.answer({ type: 'messages', messages: [envelope('b1')] });
    expect(await loadingA).not.toMatchObject({ kind: 'loaded' });
    expect(await loadingB).toMatchObject({ kind: 'loaded' });
    expect((await p.archive.getList('a', 'received')).envelopes).toEqual([]);
    expect((await p.archive.getList('b', 'received')).envelopes.map(e => e.id)).toEqual(['b1']);
  });
});
