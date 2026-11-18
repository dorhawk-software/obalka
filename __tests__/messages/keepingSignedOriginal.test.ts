// Keeping each message's signed original (004 amendment, 2026-09-14), split out of messages.test.ts
// by topic when the owner's 2026-11-18 case (the original rides the automatic download too) took that
// file past its size limit.

import { AttachmentPrefetcher } from '../../src/features/messages/state/attachmentPrefetch';
import { AUTO_DOWNLOAD_DEFAULTS } from '../../src/features/messages/state/autoDownloadSettings';
import type { MessagesTransport } from '../../src/features/messages/state/messagesController';
import type { VodzAttachmentDownloader } from '../../src/services/files/vodzAttachmentDownloader';
import { InMemoryMessagesStore } from '../../src/services/db/messagesStore';
import { TransportNetworkError } from '../../src/services/isds/transport';
import type { MessageDetail } from '../../src/services/isds/types';
import type { AttachmentFileStore } from '../../src/services/files/attachmentFileStore';
import {
  account,
  detailWithBase64,
  envelope,
  fakeFiles,
  makeController,
  signal,
} from '../helpers/messagesControllerHarness';

// The signed original (004 amendment, 2026-09-14). Constitution IV: messages AND their signed ZFO
// envelopes are kept, and never silently lost or overwritten.
describe('keeping the signed original', () => {
  const DAY = 24 * 60 * 60 * 1000;

  /** A file store whose .zfo files can be deleted under it, and which counts what it writes. */
  function disk() {
    const onDisk = new Set<string>();
    const written: string[] = [];
    const removedBoxes: string[] = [];
    const files: AttachmentFileStore = {
      ...fakeFiles,
      async persistSignedZfo(boxId, messageId, signature) {
        if (signature === 'BAD') {
          return null;
        }
        const localPath = `/disk/${boxId}/${messageId}/DZ_${messageId}.zfo`;
        onDisk.add(localPath);
        written.push(signature);
        return { fileName: `DZ_${messageId}.zfo`, localPath, size: signature.length };
      },
      async exists(path) {
        return !path.endsWith('.zfo') || onDisk.has(path);
      },
      async removeForBox(boxId) {
        removedBoxes.push(boxId);
        for (const path of [...onDisk]) {
          if (path.startsWith(`/disk/${boxId}/`)) {
            onDisk.delete(path);
          }
        }
      },
    };
    return { files, onDisk, written, removedBoxes };
  }

  const downloading = (signedZfo?: string): Partial<MessagesTransport> => ({
    downloadMessage: async () => ({ type: 'detail', detail: detailWithBase64(), signedZfo }),
  });

  it('stores the original a download brought as a file, recorded on the detail', async () => {
    const store = new InMemoryMessagesStore();
    const { files, written } = disk();
    const c = makeController(downloading('U0lHTkVE'), undefined, store, undefined, files);
    const out = await c.getDetail(account({ boxId: 'b1' }), '2', 'received', signal());
    const original = { fileName: 'DZ_2.zfo', localPath: '/disk/b1/2/DZ_2.zfo', size: 8 };
    expect(out).toMatchObject({ kind: 'detail', detail: { signedZfo: original } });
    expect((await store.getDetail('b1', '2'))?.signedZfo).toEqual(original);
    expect(written).toEqual(['U0lHTkVE']);
  });

  // The owner, 2026-11-18: "download original along with the attachments". The automatic download
  // goes through this same `getDetail` (deps.ts), so it is wired here the way deps.ts wires it, with
  // the real controller under it: a prefetcher given any other download would bring no original.
  it('keeps the original when the attachments download automatically, too', async () => {
    const store = new InMemoryMessagesStore();
    const { files, written } = disk();
    const c = makeController(downloading('U0lHTkVE'), undefined, store, undefined, files);
    const now = Date.now();
    await store.cacheList(
      'b1',
      'received',
      [{ id: '2', subject: 'Výzva', sender: 'Úřad', senderAddress: null, recipient: null,
        recipientAddress: null, recipientBoxId: null, deliveryTime: now - DAY,
        acceptanceTime: now - DAY, state: 6, attachmentSize: 1 }],
      now - DAY,
    );
    const box = account({ boxId: 'b1' });
    const prefetcher = new AttachmentPrefetcher({
      listAccounts: async () => [box],
      listUndownloaded: boxId => store.listUndownloaded(boxId),
      download: (acc, messageId, folder, s) => c.getDetail(acc, messageId, folder, s),
      autoDownload: async () => ({ ...AUTO_DOWNLOAD_DEFAULTS, on: true, since: null }),
      backupWantsAll: async () => false,
      isMetered: async () => false,
      holdBackups: () => () => {},
      now: () => now,
    });
    prefetcher.afterListing(box);
    await prefetcher.downloadMissing({ stop: { cancelled: true } });
    expect(written).toEqual(['U0lHTkVE']);
    expect((await store.getDetail('b1', '2'))?.signedZfo?.fileName).toBe('DZ_2.zfo');
  });

  it('never overwrites an original the archive already holds', async () => {
    const store = new InMemoryMessagesStore();
    const { files, written } = disk();
    await makeController(downloading('Rmlyc3Q='), undefined, store, undefined, files).getDetail(
      account({ boxId: 'b1' }), '2', 'received', signal(),
    );
    await makeController(downloading('TmV3ZXI='), undefined, store, undefined, files).getDetail(
      account({ boxId: 'b1' }), '2', 'received', signal(),
    );
    expect(written).toEqual(['Rmlyc3Q=']);
    expect((await store.getDetail('b1', '2'))?.signedZfo?.size).toBe(8);
  });

  it('writes the new one when the recorded file has gone from the device', async () => {
    const store = new InMemoryMessagesStore();
    const { files, onDisk, written } = disk();
    const c = makeController(downloading('Rmlyc3Q='), undefined, store, undefined, files);
    await c.getDetail(account({ boxId: 'b1' }), '2', 'received', signal());
    onDisk.clear();
    await c.getDetail(account({ boxId: 'b1' }), '2', 'received', signal());
    expect(written).toHaveLength(2);
  });

  it('keeps the recorded original when a later download brings none', async () => {
    const store = new InMemoryMessagesStore();
    const { files } = disk();
    await makeController(downloading('Rmlyc3Q='), undefined, store, undefined, files).getDetail(
      account({ boxId: 'b1' }), '2', 'received', signal(),
    );
    await makeController(downloading(undefined), undefined, store, undefined, files).getDetail(
      account({ boxId: 'b1' }), '2', 'received', signal(),
    );
    expect((await store.getDetail('b1', '2'))?.signedZfo?.fileName).toBe('DZ_2.zfo');
  });

  it('lets a download stand when its original could not be written', async () => {
    const store = new InMemoryMessagesStore();
    const { files } = disk();
    const persist = jest.spyOn(files, 'persistSignedZfo');
    const out = await makeController(downloading('BAD'), undefined, store, undefined, files).getDetail(
      account({ boxId: 'b1' }), '2', 'received', signal(),
    );
    // The write was attempted and failed - not skipped.
    expect(persist).toHaveBeenCalledWith('b1', '2', 'BAD');
    expect(out.kind).toBe('detail');
    expect((await store.getDetail('b1', '2'))?.signedZfo).toBeUndefined();
    expect((await store.getDetail('b1', '2'))?.attachments[0].localPath).toBeTruthy();
  });

  it('puts no base64 into the archive when there is nowhere to write a file', async () => {
    const store = new InMemoryMessagesStore();
    await makeController(downloading('U0lHTkVEIE9SSUdJTkFM'), undefined, store).getDetail(
      account({ boxId: 'b1' }), '2', 'received', signal(),
    );
    expect(JSON.stringify(await store.getDetail('b1', '2'))).not.toContain('U0lHTkVEIE9SSUdJTkFM');
  });

  describe('a large-volume message', () => {
    const enclosure = {
      name: 'velky.pdf',
      mimeType: 'application/pdf',
      metaType: 'main',
      contentBase64: '',
      localPath: '/files/vodz/b1/9/0_velky.pdf',
      size: 30_000_000,
    };
    const original = { fileName: 'DZ_9.zfo', localPath: '/disk/b1/9/DZ_9.zfo', size: 40_000_000 };

    async function withEnvelope() {
      const store = new InMemoryMessagesStore();
      await store.cacheList('b1', 'received', [envelope('9', 30000)], 1);
      return store;
    }

    it('streams its original after the enclosures, for the folder it came from', async () => {
      const store = await withEnvelope();
      const vodz: VodzAttachmentDownloader = {
        download: jest.fn(async () => ({ type: 'attachments' as const, attachments: [enclosure] })),
        downloadSignedZfo: jest.fn(async () => ({ type: 'zfo' as const, original })),
      };
      const c = makeController(
        { downloadMessage: async () => ({ type: 'unsupported' }) },
        undefined,
        store,
        vodz,
        disk().files,
      );
      const out = await c.getDetail(account({ boxId: 'b1' }), '9', 'received', signal());
      expect(out).toMatchObject({ kind: 'detail', detail: { attachments: [enclosure], signedZfo: original } });
      expect(vodz.downloadSignedZfo).toHaveBeenCalledWith(
        expect.objectContaining({ messageId: '9', sent: false }),
      );
      expect((await store.getDetail('b1', '9'))?.signedZfo).toEqual(original);
    });

    it('keeps the enclosures when the original does not arrive', async () => {
      const store = await withEnvelope();
      const vodz: VodzAttachmentDownloader = {
        download: jest.fn(async () => ({ type: 'attachments' as const, attachments: [enclosure] })),
        downloadSignedZfo: jest.fn(async () => ({ type: 'serverFault' as const })),
      };
      const c = makeController(
        { downloadMessage: async () => ({ type: 'unsupported' }) },
        undefined,
        store,
        vodz,
        disk().files,
      );
      const out = await c.getDetail(account({ boxId: 'b1' }), '9', 'received', signal());
      expect(out).toMatchObject({ kind: 'detail', detail: { attachments: [enclosure] } });
      // It was asked for, after the enclosures, and its failure did not take them along.
      expect(vodz.downloadSignedZfo).toHaveBeenCalledWith(expect.objectContaining({ messageId: '9' }));
      const cached = await store.getDetail('b1', '9');
      expect(cached?.attachments).toEqual([enclosure]);
      expect(cached?.signedZfo).toBeUndefined();
    });
  });

  describe('fetching it for a message downloaded before originals were kept', () => {
    async function archived(acceptanceTime: number | null, state = 7) {
      const store = new InMemoryMessagesStore();
      await store.cacheList('b1', 'received', [{ ...envelope('2', 1), state, acceptanceTime }], 1);
      const attachments = [
        { name: 'a.pdf', mimeType: 'application/pdf', metaType: 'main', contentBase64: '', localPath: '/disk/b1/2/0', size: 4 },
      ];
      await store.cacheDetail('b1', { ...detailWithBase64(), attachments });
      return { store, attachments };
    }

    it('fetches only the original, and leaves the attachments exactly as they were', async () => {
      const { store, attachments } = await archived(1000 - DAY);
      let seenSent: boolean | undefined;
      const { files, written } = disk();
      const c = makeController(
        {
          downloadSignedMessage: async args => {
            seenSent = args.signedSent;
            return { type: 'signed', signedZfo: 'T1JJR0lOQUw=' };
          },
        },
        undefined,
        store,
        undefined,
        files,
      );
      const out = await c.fetchSignedOriginal(account({ boxId: 'b1' }), '2', 'sent', signal());
      expect(out).toMatchObject({ kind: 'saved', detail: { signedZfo: { fileName: 'DZ_2.zfo' } } });
      expect(seenSent).toBe(true);
      expect(written).toEqual(['T1JJR0lOQUw=']);
      const cached = await store.getDetail('b1', '2');
      expect(cached?.attachments).toEqual(attachments);
      expect(cached?.signedZfo?.localPath).toBe('/disk/b1/2/DZ_2.zfo');
    });

    it('does not ask ISDS for an original that is already here', async () => {
      const { store } = await archived(1000 - DAY);
      const { files, onDisk } = disk();
      const held = { fileName: 'DZ_2.zfo', localPath: '/disk/b1/2/DZ_2.zfo', size: 3 };
      onDisk.add(held.localPath);
      const cached = await store.getDetail('b1', '2');
      await store.cacheDetail('b1', { ...(cached as MessageDetail), signedZfo: held });
      // No transport method configured: calling ISDS at all would come back as an error.
      const c = makeController({}, undefined, store, undefined, files);
      expect(await c.fetchSignedOriginal(account({ boxId: 'b1' }), '2', 'received', signal())).toMatchObject({
        kind: 'saved',
        detail: { signedZfo: held },
      });
    });

    it('asks the large-volume service for a VoDZ original', async () => {
      const { store } = await archived(1000 - DAY);
      const original = { fileName: 'DZ_2.zfo', localPath: '/disk/b1/2/DZ_2.zfo', size: 9 };
      const vodz: VodzAttachmentDownloader = {
        download: jest.fn(),
        downloadSignedZfo: jest.fn(async () => ({ type: 'zfo' as const, original })),
      };
      const c = makeController(
        { downloadSignedMessage: async () => ({ type: 'unsupported' }) },
        undefined,
        store,
        vodz,
        disk().files,
      );
      const out = await c.fetchSignedOriginal(account({ boxId: 'b1' }), '2', 'received', signal());
      expect(out).toMatchObject({ kind: 'saved', detail: { signedZfo: original } });
      expect(vodz.download).not.toHaveBeenCalled();
    });

    it('records the message as gone when ISDS answers 1219 past its retention window', async () => {
      const { store } = await archived(1000 - 91 * DAY);
      const c = makeController(
        { downloadSignedMessage: async () => ({ type: 'gone' }) },
        undefined,
        store,
        undefined,
        disk().files,
      );
      const out = await c.fetchSignedOriginal(account({ boxId: 'b1' }), '2', 'received', signal());
      expect(out.kind).toBe('gone');
      expect((await store.getDetail('b1', '2'))?.attachmentsUnavailable).toBe(true);
    });

    it('never records a message as gone for any other refusal, past the window or not', async () => {
      // Until 2026-09-15 any dmStatusCode but 0000/1281 past the window recorded the message gone for
      // good - 1222, or a VoDZ service paused under load (3013), included. ISDS documents only 1219 as
      // a deletion (004 research R8); the rest is a refusal the user can retry, and says so.
      const { store } = await archived(1000 - 91 * DAY);
      const c = makeController(
        { downloadSignedMessage: async () => ({ type: 'refused' }) },
        undefined,
        store,
        undefined,
        disk().files,
      );
      expect(await c.fetchSignedOriginal(account({ boxId: 'b1' }), '2', 'received', signal())).toEqual({
        kind: 'error',
        messageKey: 'detail.original.refused',
      });
      expect((await store.getDetail('b1', '2'))?.attachmentsUnavailable).toBeUndefined();
    });

    it('treats 1219 within the window as a refusal to retry, and records nothing', async () => {
      // Inside the window 1219 contradicts ISDS's own description of it; no permanent record on that.
      const { store } = await archived(1000 - DAY);
      const c = makeController(
        { downloadSignedMessage: async () => ({ type: 'gone' }) },
        undefined,
        store,
        undefined,
        disk().files,
      );
      expect(await c.fetchSignedOriginal(account({ boxId: 'b1' }), '2', 'received', signal())).toEqual({
        kind: 'error',
        messageKey: 'detail.original.refused',
      });
      expect((await store.getDetail('b1', '2'))?.attachmentsUnavailable).toBeUndefined();
    });

    it('reads the large-volume service the same way: 1219 is gone, anything else a refusal', async () => {
      const gone = await archived(1000 - 91 * DAY);
      const vodzGone: VodzAttachmentDownloader = {
        download: jest.fn(),
        downloadSignedZfo: jest.fn(async () => ({ type: 'gone' as const })),
      };
      const c1 = makeController(
        { downloadSignedMessage: async () => ({ type: 'unsupported' }) },
        undefined,
        gone.store,
        vodzGone,
        disk().files,
      );
      expect((await c1.fetchSignedOriginal(account({ boxId: 'b1' }), '2', 'received', signal())).kind).toBe(
        'gone',
      );
      const refused = await archived(1000 - 91 * DAY);
      const vodzRefused: VodzAttachmentDownloader = {
        download: jest.fn(),
        downloadSignedZfo: jest.fn(async () => ({ type: 'refused' as const })),
      };
      const c2 = makeController(
        { downloadSignedMessage: async () => ({ type: 'unsupported' }) },
        undefined,
        refused.store,
        vodzRefused,
        disk().files,
      );
      expect(await c2.fetchSignedOriginal(account({ boxId: 'b1' }), '2', 'received', signal())).toEqual({
        kind: 'error',
        messageKey: 'detail.original.refused',
      });
      expect((await refused.store.getDetail('b1', '2'))?.attachmentsUnavailable).toBeUndefined();
    });

    it('hands the large-volume service the box’s own session, read from the vault', async () => {
      // 018 T015: the VoDZ original went out with the password alone, so a cookie box's rode the jar.
      const { store } = await archived(1000 - DAY);
      const vodz: VodzAttachmentDownloader = {
        download: jest.fn(),
        downloadSignedZfo: jest.fn(async () => ({ type: 'serverFault' as const })),
      };
      const c = makeController(
        { downloadSignedMessage: async () => ({ type: 'unsupported' }) },
        {
          readPassword: async () => ({ status: 'absent' }),
          readSession: async () => ({ status: 'found', value: 'IPCZ-X-COOKIE=MINE' }),
        },
        store,
        vodz,
        disk().files,
      );
      await c.fetchSignedOriginal(
        account({ boxId: 'b1', authMethod: 'mobile_key' }),
        '2',
        'sent',
        signal(),
      );
      expect(vodz.downloadSignedZfo).toHaveBeenCalledWith(
        expect.objectContaining({
          authMethod: 'mobile_key',
          sessionCookie: 'IPCZ-X-COOKIE=MINE',
          password: null,
          sent: true,
        }),
      );
    });

    it('never records a message as gone because ISDS could not be reached', async () => {
      // Past the window, but an outage is not ISDS saying the message no longer exists.
      const { store } = await archived(1000 - 91 * DAY);
      const c = makeController(
        { downloadSignedMessage: async () => ({ type: 'serverFault' }) },
        undefined,
        store,
        undefined,
        disk().files,
      );
      expect(await c.fetchSignedOriginal(account({ boxId: 'b1' }), '2', 'received', signal())).toEqual({
        kind: 'error',
        messageKey: 'detail.original.fetchFailed',
      });
      expect((await store.getDetail('b1', '2'))?.attachmentsUnavailable).toBeUndefined();
    });

    it('asks for a sign-in on an expired session, and never throws on a network failure', async () => {
      const { store } = await archived(1000 - DAY);
      const reauth = makeController(
        { downloadSignedMessage: async () => ({ type: 'authFault' }) },
        undefined,
        store,
        undefined,
        disk().files,
      );
      expect(await reauth.fetchSignedOriginal(account({ boxId: 'b1' }), '2', 'received', signal())).toEqual({
        kind: 'reauth',
      });
      const offline = makeController(
        {
          downloadSignedMessage: async () => {
            throw new TransportNetworkError();
          },
        },
        undefined,
        store,
        undefined,
        disk().files,
      );
      expect(await offline.fetchSignedOriginal(account({ boxId: 'b1' }), '2', 'received', signal())).toEqual({
        kind: 'error',
        messageKey: 'messages.error.network',
      });
    });
  });

  describe('removing a box', () => {
    it('removes its files with its rows - attachments and originals alike', async () => {
      const store = new InMemoryMessagesStore();
      const { files, onDisk, removedBoxes } = disk();
      const c = makeController(downloading('U0lHTkVE'), undefined, store, undefined, files);
      await c.getDetail(account({ boxId: 'b1' }), '2', 'received', signal());
      await c.clearBoxCache('b1');
      expect(removedBoxes).toEqual(['b1']);
      expect(onDisk.size).toBe(0);
      expect(await store.getDetail('b1', '2')).toBeNull();
    });

    it('still removes the rows when the files will not delete', async () => {
      const store = new InMemoryMessagesStore();
      await store.cacheDetail('b1', detailWithBase64());
      const stubborn: AttachmentFileStore = {
        ...fakeFiles,
        async removeForBox() {
          throw new Error('permission denied');
        },
      };
      const c = makeController({}, undefined, store, undefined, stubborn);
      await expect(c.clearBoxCache('b1')).resolves.toBeUndefined();
      expect(await store.getDetail('b1', '2')).toBeNull();
    });

    it('still removes the files when the rows will not clear, and says the rows did not', async () => {
      // Only a removal calls this, once the box's own row is gone. Files kept back because the archive
      // table was busy were copies of mail that nothing in the app could reach any more.
      const store = new InMemoryMessagesStore();
      const { files, onDisk, removedBoxes } = disk();
      const c = makeController(downloading('U0lHTkVE'), undefined, store, undefined, files);
      await c.getDetail(account({ boxId: 'b1' }), '2', 'received', signal());
      expect(onDisk.size).toBe(1);
      store.clearBox = async () => {
        throw new Error('database is locked');
      };
      await expect(c.clearBoxCache('b1')).rejects.toThrow('database is locked');
      expect(removedBoxes).toEqual(['b1']);
      expect(onDisk.size).toBe(0);
    });
  });
});
