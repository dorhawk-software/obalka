import {
  parseMessageDownload,
  parseMessageList,
  parseSoapBody,
  parseSoapBodyWithAttrs,
} from '../../src/services/isds/soap';
import {
  MessagesController,
  enclosuresAfterWalk,
  isUnread,
} from '../../src/features/messages/state/messagesController';
import type { MessagesTransport } from '../../src/features/messages/state/messagesController';
import type {
  VodzAttachmentDownloader,
  VodzDownloadResult,
} from '../../src/services/files/vodzAttachmentDownloader';
import {
  InMemoryMessagesStore,
  normalizeSearch,
  SEARCH_LIMIT,
  type MessagesStore,
} from '../../src/services/db/messagesStore';
import { TransportNetworkError } from '../../src/services/isds/transport';
import type { MessageDetail, MessageEnvelope } from '../../src/services/isds/types';
import type { SecretRead } from '../../src/services/secureStore/secureStore';
import {
  account,
  detailWithBase64,
  envelope,
  fakeFiles,
  makeController,
  notConfigured,
  passwordOnly,
  signal,
} from '../helpers/messagesControllerHarness';

const listResponse = (records: string): string =>
  '<?xml version="1.0"?>' +
  '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" ' +
  'xmlns:p="http://isds.czechpoint.cz/v20"><soapenv:Body>' +
  '<p:GetListOfReceivedMessagesResponse>' +
  records +
  '<p:dmStatus><p:dmStatusCode>0000</p:dmStatusCode><p:dmStatusMessage>OK</p:dmStatusMessage></p:dmStatus>' +
  '</p:GetListOfReceivedMessagesResponse></soapenv:Body></soapenv:Envelope>';

const record = (
  id: string,
  subject: string,
  sender: string,
  delivery: string,
  atts = '0',
): string =>
  `<p:dmRecord><p:dmID>${id}</p:dmID><p:dmAnnotation>${subject}</p:dmAnnotation>` +
  `<p:dmSender>${sender}</p:dmSender><p:dmDeliveryTime>${delivery}</p:dmDeliveryTime>` +
  `<p:dmMessageStatus>5</p:dmMessageStatus><p:dmAttachmentSize>${atts}</p:dmAttachmentSize></p:dmRecord>`;

describe('isUnread', () => {
  it('treats delivered-but-not-read (state < 7) as unread, read (7) as read', () => {
    // Confirmed live: state 6 = delivered/unread, state 7 = read.
    expect([4, 5, 6].map(isUnread)).toEqual([true, true, true]);
    expect(isUnread(7)).toBe(false);
    expect(isUnread(0)).toBe(false); // parse fallback / unknown
  });
});

describe('parseMessageList', () => {
  it('maps records to envelopes, newest first', () => {
    const xml = listResponse(
      '<p:dmRecords>' +
        record('100', 'Older', 'Alice', '2026-06-01T10:00:00', '0') +
        record('200', 'Newer', 'Bob', '2026-06-05T09:00:00', '3') +
        '</p:dmRecords>',
    );
    const msgs = parseMessageList(parseSoapBody(xml));
    expect(msgs.map(m => m.id)).toEqual(['200', '100']); // sorted by deliveryTime desc
    expect(msgs[0]).toMatchObject({
      id: '200',
      subject: 'Newer',
      sender: 'Bob',
      attachmentSize: 3,
      state: 5,
    });
    expect(msgs[0].deliveryTime).toBe(Date.parse('2026-06-05T09:00:00'));
  });

  it('tolerates a single record (object, not array)', () => {
    const xml = listResponse(
      '<p:dmRecords>' +
        record('1', 'Solo', 'X', '2026-01-01T00:00:00') +
        '</p:dmRecords>',
    );
    expect(parseMessageList(parseSoapBody(xml)).map(m => m.id)).toEqual(['1']);
  });

  it('returns [] for an empty list', () => {
    expect(parseMessageList(parseSoapBody(listResponse('')))).toEqual([]);
  });
});

describe('attachments on disk', () => {
  it('getDetail persists attachments to files before caching (localPath + size, no base64)', async () => {
    const store = new InMemoryMessagesStore();
    const c = makeController(
      { downloadMessage: async () => ({ type: 'detail', detail: detailWithBase64() }) },
      undefined,
      store,
      undefined,
      fakeFiles,
    );
    const out = await c.getDetail(account({ boxId: 'b1' }), '2', 'received', signal());
    expect(out.kind).toBe('detail');
    const cached = await store.getDetail('b1', '2');
    expect(cached?.attachments[0].localPath).toBeTruthy();
    expect(cached?.attachments[0].size).toBeGreaterThan(0);
    expect(cached?.attachments[0].contentBase64).toBe('');
  });

  it('migrate-on-open: a cached base64 detail is rewritten to files on getCachedDetail', async () => {
    const store = new InMemoryMessagesStore();
    await store.cacheDetail('b1', detailWithBase64()); // legacy base64, no localPath
    const c = makeController({}, undefined, store, undefined, fakeFiles);
    const got = await c.getCachedDetail('b1', '2');
    expect(got?.attachments[0].localPath).toBeTruthy();
    expect(got?.attachments[0].contentBase64).toBe('');
  });

  it('setAttachmentsUnavailable persists the flag', async () => {
    const store = new InMemoryMessagesStore();
    await store.cacheDetail('b1', detailWithBase64());
    const c = makeController({}, undefined, store, undefined, fakeFiles);
    await c.setAttachmentsUnavailable('b1', '2', true);
    expect((await store.getDetail('b1', '2'))?.attachmentsUnavailable).toBe(true);
  });

  it('recordSentMessage caches the sent attachments as a sent-folder detail (no re-download)', async () => {
    const store = new InMemoryMessagesStore();
    const c = makeController({}, undefined, store);
    await c.recordSentMessage(account({ boxId: 'b1', label: 'Me' }), {
      messageId: 's1',
      subject: 'Hello',
      recipient: {
        boxId: 'r1',
        name: 'Recipient',
        address: 'Nová 1, 60200 Brno',
        dbType: 'FO',
        acceptsPdz: true,
      },
      files: [
        {
          fileName: 'doc.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 2048,
          contentBase64: 'AAAA',
          isMain: true,
        },
      ],
      sentAt: 1000,
    });
    // Opening it yields the attachment straight away - no download needed.
    const detail = await c.getCachedDetail('b1', 's1');
    expect(detail?.attachments.map(a => a.name)).toEqual(['doc.pdf']);
    expect(detail?.attachments[0].contentBase64).toBe('AAAA');
    // It lands in the SENT folder (not received), and reads as already-downloaded.
    const sent = await store.getList('b1', 'sent');
    expect(sent.envelopes.map(e => e.id)).toContain('s1');
    expect(sent.downloaded).toContain('s1');
    const received = await store.getList('b1', 'received');
    expect(received.envelopes.map(e => e.id)).not.toContain('s1');
  });
});

describe('MessagesController', () => {
  // The archive is the product. ISDS keeps a message 90 days from delivery-by-login and then drops
  // it; the local copy is meant to outlive that, and the FAQ says so in as many words. The list the
  // controller returns is therefore the ARCHIVE (freshly upserted from the live response), never the
  // live response alone - which used to make an old message vanish from the inbox the moment ISDS
  // purged it, visible as a flash: the cache rendered it, then the live result dropped it.
  it('keeps archived messages ISDS no longer returns', async () => {
    const store = new InMemoryMessagesStore();
    const old = { ...envelope('1'), id: 'april', deliveryTime: 100 };
    const fresh = { ...envelope('2'), id: 'new', deliveryTime: 900 };
    // Sync 1: ISDS still lists both.
    const first = makeController(
      {
        listReceivedMessages: async () => ({
          type: 'messages',
          messages: [fresh, old],
        }),
      },
      undefined,
      store,
    );
    await first.listReceived(account({ boxId: 'box1' }), signal());

    // Sync 2: ISDS has purged the April one - it is simply absent from the response.
    const second = makeController(
      {
        listReceivedMessages: async () => ({ type: 'messages', messages: [fresh] }),
      },
      undefined,
      store,
    );
    const out = await second.listReceived(account({ boxId: 'box1' }), signal());
    expect(out.kind).toBe('loaded');
    if (out.kind !== 'loaded') {
      return;
    }
    expect(out.messages.map(m => m.id)).toEqual(['new', 'april']); // newest first, nothing lost
  });

  it('applies the live state to a message already in the archive', async () => {
    const store = new InMemoryMessagesStore();
    const c = (state: number) =>
      makeController(
        {
          listReceivedMessages: async () => ({
            type: 'messages',
            messages: [{ ...envelope('1'), state }],
          }),
        },
        undefined,
        store,
      );
    await c(4).listReceived(account({ boxId: 'box1' }), signal()); // dodána
    const out = await c(7).listReceived(account({ boxId: 'box1' }), signal()); // přečtena
    expect(out.kind === 'loaded' && out.messages[0].state).toBe(7);
    expect(out.kind === 'loaded' && out.messages).toHaveLength(1); // upserted, not duplicated
  });

  it('loaded: returns the messages from the transport', async () => {
    const c = makeController({
      listReceivedMessages: async () => ({ type: 'messages', messages: [] }),
    });
    // `syncedAt` rides along so the inbox can say how fresh the list is - the store computed it all
    // along and every caller dropped it (2026-09-09 critique).
    expect(await c.listReceived(account(), signal())).toEqual({
      kind: 'loaded',
      messages: [],
      downloaded: [],
      syncedAt: null, // the fake store has never stamped one
    });
  });

  it('password box: reads the secret and passes it as Basic credentials', async () => {
    let seenPassword: string | null = 'unset';
    const c = makeController({
      listReceivedMessages: async args => {
        seenPassword = args.password;
        return { type: 'messages', messages: [] };
      },
    });
    await c.listReceived(account({ authMethod: 'password' }), signal());
    expect(seenPassword).toBe('pw');
  });

  it('OTP box: does not read or send a password (rides the session cookie)', async () => {
    const secrets = {
      readPassword: jest.fn(async (): Promise<SecretRead> => ({ status: 'found', value: 'pw' })),
      readSession: jest.fn(
        async (): Promise<SecretRead> => ({ status: 'found', value: 'IPCZ-X-COOKIE=S' }),
      ),
    };
    let seenPassword: string | null = 'unset';
    let seenCookie: string | null = 'unset';
    const c = makeController(
      {
        listReceivedMessages: async args => {
          seenPassword = args.password;
          seenCookie = args.sessionCookie;
          return { type: 'messages', messages: [] };
        },
      },
      secrets,
    );
    await c.listReceived(account({ authMethod: 'otp_totp' }), signal());
    expect(secrets.readPassword).not.toHaveBeenCalled();
    expect(seenPassword).toBeNull();
    // …and its own session, read from the secure store rather than the account (001 T028).
    expect(seenCookie).toBe('IPCZ-X-COOKIE=S');
  });

  it('uses the box-specific host (production vs czebox)', async () => {
    let seenHost = '';
    const c = makeController({
      listReceivedMessages: async args => {
        seenHost = args.host;
        return { type: 'messages', messages: [] };
      },
    });
    await c.listReceived(account({ host: 'production' }), signal());
    expect(seenHost).toBe('production');
  });

  it('authFault -> reauth', async () => {
    const c = makeController({
      listReceivedMessages: async () => ({ type: 'authFault' }),
    });
    expect(await c.listReceived(account(), signal())).toEqual({
      kind: 'reauth',
    });
  });

  it('a thrown network error becomes a recoverable error (never throws)', async () => {
    const c = makeController({
      listReceivedMessages: async () => {
        throw new TransportNetworkError();
      },
    });
    expect(await c.listReceived(account(), signal())).toEqual({
      kind: 'error',
      messageKey: 'messages.error.network',
    });
  });

  it('getDetail: returns the downloaded message detail', async () => {
    const detail = {
      id: '42',
      subject: 'Hello',
      sender: 'ČSSZ',
      senderAddress: null,
      recipient: 'ACME',
      recipientAddress: null,
      deliveryTime: 1,
      acceptanceTime: 2,
      attachments: [],
    };
    const c = makeController({
      downloadMessage: async () => ({ type: 'detail', detail }),
    });
    expect(await c.getDetail(account(), '42', 'received', signal())).toEqual({
      kind: 'detail',
      detail,
    });
  });

  it('getDetail: passes the messageId + box-specific host/credentials', async () => {
    let seen: { id?: string; host?: string; password?: string | null } = {};
    const c = makeController({
      downloadMessage: async args => {
        seen = { id: args.messageId, host: args.host, password: args.password };
        return { type: 'authFault' };
      },
    });
    const out = await c.getDetail(
      account({ host: 'production' }),
      '7',
      'received',
      signal(),
    );
    expect(seen).toEqual({ id: '7', host: 'production', password: 'pw' });
    expect(out).toEqual({ kind: 'reauth' });
  });

  it('getDetail: a thrown network error becomes a recoverable error (never throws)', async () => {
    const c = makeController({
      downloadMessage: async () => {
        throw new TransportNetworkError();
      },
    });
    expect(await c.getDetail(account(), '1', 'received', signal())).toEqual({
      kind: 'error',
      messageKey: 'messages.error.network',
    });
  });
});


const detailOf = (id: string) => ({
  id,
  subject: `s${id}`,
  sender: 'X',
  senderAddress: null,
  recipient: null,
  recipientAddress: null,
  deliveryTime: 1,
  acceptanceTime: 2,
  attachments: [],
});

describe('MessagesController - offline cache', () => {
  it('listReceived caches the envelopes; getCachedMessages returns them offline', async () => {
    const store = new InMemoryMessagesStore();
    const c = makeController(
      {
        listReceivedMessages: async () => ({
          type: 'messages',
          messages: [envelope('2'), envelope('1')],
        }),
      },
      undefined,
      store,
    );
    const out = await c.listReceived(account({ boxId: 'b1' }), signal());
    expect(out).toMatchObject({ kind: 'loaded', downloaded: [] });

    // A later offline read returns the cached envelopes (newest first), no network.
    const cached = await c.getCachedMessages('b1');
    expect(cached.envelopes.map(m => m.id)).toEqual(['2', '1']);
  });

  it('listSent caches under the SENT folder; received and sent never collide (008)', async () => {
    const store = new InMemoryMessagesStore();
    const c = makeController(
      {
        listReceivedMessages: async () => ({
          type: 'messages',
          messages: [envelope('r1')],
        }),
        getSentMessages: async () => ({
          type: 'messages',
          messages: [envelope('s1')],
        }),
      },
      undefined,
      store,
    );
    await c.listReceived(account({ boxId: 'b1' }), signal());
    expect(await c.listSent(account({ boxId: 'b1' }), signal())).toMatchObject({
      kind: 'loaded',
    });

    // Each folder reads only its own messages.
    expect(
      (await c.getCachedMessages('b1', 'received')).envelopes.map(m => m.id),
    ).toEqual(['r1']);
    expect(
      (await c.getCachedMessages('b1', 'sent')).envelopes.map(m => m.id),
    ).toEqual(['s1']);
  });

  it('listSent surfaces a server fault; the cached sent list remains for the screen fallback', async () => {
    const store = new InMemoryMessagesStore();
    await store.cacheList('b1', 'sent', [envelope('s9')], 1); // seed the sent cache
    const c = makeController(
      { getSentMessages: async () => ({ type: 'serverFault' }) },
      undefined,
      store,
    );
    expect(await c.listSent(account({ boxId: 'b1' }), signal())).toMatchObject({
      kind: 'error',
    });
    // The screen falls back to this cached sent list (folder-scoped), unaffected by the fault.
    expect(
      (await c.getCachedMessages('b1', 'sent')).envelopes.map(m => m.id),
    ).toEqual(['s9']);
  });

  it('getDetail caches the detail; it then counts as downloaded + is readable offline', async () => {
    const store = new InMemoryMessagesStore();
    const c = makeController(
      {
        listReceivedMessages: async () => ({
          type: 'messages',
          messages: [envelope('2', 1)],
        }),
        downloadMessage: async () => ({
          type: 'detail',
          detail: detailOf('2'),
        }),
      },
      undefined,
      store,
    );
    await c.listReceived(account({ boxId: 'b1' }), signal());
    await c.getDetail(account({ boxId: 'b1' }), '2', 'received', signal());

    expect((await c.getCachedMessages('b1')).downloaded).toEqual(['2']); // now offline-available
    expect(await c.getCachedDetail('b1', '2')).toMatchObject({ id: '2' });
    expect(await c.getCachedDetail('b1', '999')).toBeNull(); // never downloaded
  });

  it('getDetail (VoDZ sent): streams enclosures, merges the cached envelope, caches the detail', async () => {
    const store = new InMemoryMessagesStore();
    const enclosure = {
      name: 'velky.pdf',
      mimeType: 'application/pdf',
      metaType: 'main',
      contentBase64: '', // VoDZ enclosures are file-backed, never inline base64
      localPath: '/files/vodz/b1/9/0_velky.pdf',
    };
    const vodz: VodzAttachmentDownloader = {
      download: jest.fn(async () => ({
        type: 'attachments' as const,
        attachments: [enclosure],
      })),
      // The original is best-effort after the enclosures (004); here it does not arrive.
      downloadSignedZfo: jest.fn(async () => ({ type: 'serverFault' as const })),
    };
    const c = makeController(
      {
        getSentMessages: async () => ({
          type: 'messages',
          messages: [envelope('9', 1)],
        }),
        // SignedSentMessageDownload can't serve a large-volume message → 'unsupported'.
        downloadMessage: async () => ({ type: 'unsupported' }),
      },
      undefined,
      store,
      vodz,
    );
    await c.listSent(account({ boxId: 'b1' }), signal()); // seed the sent envelope into the cache

    const out = await c.getDetail(account({ boxId: 'b1' }), '9', 'sent', signal());
    expect(out).toMatchObject({
      kind: 'detail',
      detail: { id: '9', subject: 's9', attachments: [enclosure] },
    });
    expect(vodz.download).toHaveBeenCalled();
    // cached → the file-backed attachment is openable offline.
    expect(await c.getCachedDetail('b1', '9')).toMatchObject({
      id: '9',
      attachments: [{ localPath: '/files/vodz/b1/9/0_velky.pdf' }],
    });
  });

  it('getDetail (VoDZ) with no downloader wired → honest message, never throws', async () => {
    const c = makeController({
      downloadMessage: async () => ({ type: 'unsupported' }),
    });
    expect(await c.getDetail(account(), '9', 'sent', signal())).toEqual({
      kind: 'error',
      messageKey: 'detail.attachments.vodzFailed',
    });
  });

  it('getDetail (VoDZ): the enclosures and the original ride the box’s own session, not the shared jar', async () => {
    // 018 T015: this path read the password alone, so an OTP or Mobile Key box's large message went
    // out with whatever session the native jar held - another box's, after a second login.
    const store = new InMemoryMessagesStore();
    await store.cacheList('b1', 'sent', [envelope('9', 30000)], 1);
    const vodz: VodzAttachmentDownloader = {
      download: jest.fn(async () => ({ type: 'attachments' as const, attachments: [] })),
      downloadSignedZfo: jest.fn(async () => ({ type: 'serverFault' as const })),
    };
    const c = makeController(
      { downloadMessage: async () => ({ type: 'unsupported' }) },
      {
        readPassword: async () => ({ status: 'absent' }),
        readSession: async () => ({ status: 'found', value: 'IPCZ-X-COOKIE=MINE' }),
      },
      store,
      vodz,
    );
    await c.getDetail(account({ boxId: 'b1', authMethod: 'otp_totp' }), '9', 'sent', signal());
    const session = expect.objectContaining({
      authMethod: 'otp_totp',
      sessionCookie: 'IPCZ-X-COOKIE=MINE',
      password: null,
    });
    expect(vodz.download).toHaveBeenCalledWith(session);
    expect(vodz.downloadSignedZfo).toHaveBeenCalledWith(session);
  });

  it('getCredit: returns the balance on success, passing the box id + credentials', async () => {
    let seen: { boxId: string; password: string | null } | null = null;
    const c = makeController({
      getCreditInfo: async args => {
        seen = { boxId: args.boxId, password: args.password };
        return { type: 'credit', balanceCzk: 100 };
      },
    });
    expect(await c.getCredit(account({ boxId: 'b7' }), signal())).toBe(100);
    expect(seen).toEqual({ boxId: 'b7', password: 'pw' });
  });

  it('getCredit: null when the box has no PDZ facility / a fault (never throws)', async () => {
    const fault = makeController({
      getCreditInfo: async () => ({ type: 'serverFault' }),
    });
    expect(await fault.getCredit(account(), signal())).toBeNull();

    const threw = makeController({
      getCreditInfo: async () => {
        throw new TransportNetworkError();
      },
    });
    expect(await threw.getCredit(account(), signal())).toBeNull();
  });

  it('getPasswordExpiry: ISDS\'s date with the box\'s own credentials - at most once a day', async () => {
    const seen: (string | null)[] = [];
    const c = makeController({
      getPasswordInfo: async args => {
        seen.push(args.password);
        return { type: 'expiry', expiresAt: null };
      },
    });
    expect(await c.getPasswordExpiry(account({ boxId: 'b7' }), signal())).toEqual({ expiresAt: null });
    // The clock stands still in `makeController`: the same day, so no second call.
    expect(await c.getPasswordExpiry(account({ boxId: 'b7' }), signal())).toBeNull();
    expect(seen).toEqual(['pw']);
    // Another box has a day of its own.
    expect(await c.getPasswordExpiry(account({ boxId: 'b8' }), signal())).toEqual({ expiresAt: null });
  });

  it('getPasswordExpiry: nothing for a Mobile Key box, a fault or a throw - and a fault is tried again', async () => {
    let calls = 0;
    const c = makeController({
      getPasswordInfo: async () => {
        calls += 1;
        if (calls === 2) {
          throw new TransportNetworkError();
        }
        return calls === 1 ? { type: 'serverFault' } : { type: 'expiry', expiresAt: 5 };
      },
    });
    expect(await c.getPasswordExpiry(account({ authMethod: 'mobile_key' }), signal())).toBeNull();
    expect(calls).toBe(0);
    expect(await c.getPasswordExpiry(account(), signal())).toBeNull();
    expect(await c.getPasswordExpiry(account(), signal())).toBeNull();
    expect(await c.getPasswordExpiry(account(), signal())).toEqual({ expiresAt: 5 });
  });

  it('clearBoxCache drops a box archive', async () => {
    const store = new InMemoryMessagesStore();
    const c = makeController(
      {
        listReceivedMessages: async () => ({
          type: 'messages',
          messages: [envelope('1')],
        }),
      },
      undefined,
      store,
    );
    await c.listReceived(account({ boxId: 'b1' }), signal());
    await c.clearBoxCache('b1');
    expect((await c.getCachedMessages('b1')).envelopes).toEqual([]);
  });
});

const mkEnv = (
  id: string,
  subject: string,
  sender: string,
  delivery: number,
): MessageEnvelope => ({
  id,
  subject,
  sender,
  senderAddress: null,
  recipient: null,
  recipientAddress: null,
  recipientBoxId: null,
  deliveryTime: delivery,
  acceptanceTime: null,
  state: 6,
  attachmentSize: 0,
});

describe('normalizeSearch', () => {
  it('lower-cases, strips diacritics, and trims', () => {
    expect(normalizeSearch('  Úřad ČSSZ  ')).toBe('urad cssz');
    expect(normalizeSearch('Daňové')).toBe('danove');
  });
});

describe('archive search', () => {
  it('matches subject/sender accent- and case-insensitively, across boxes, newest first', async () => {
    const store = new InMemoryMessagesStore();
    await store.cacheList(
      'b1',
      'received',
      [mkEnv('1', 'Daňové přiznání', 'Finanční úřad', 100)],
      1,
    );
    await store.cacheList(
      'b2',
      'received',
      [mkEnv('2', 'Faktura za služby', 'ČSSZ', 200)],
      1,
    );

    // "danove" (no diacritics, lower) matches "Daňové"; result carries its boxId.
    const a = await store.search('DANOVE');
    expect(a.map(h => h.envelope.id)).toEqual(['1']);
    expect(a[0].boxId).toBe('b1');

    // sender match in the other box
    expect((await store.search('cssz')).map(h => h.envelope.id)).toEqual(['2']);
  });

  it('returns cross-box hits sorted by delivery time (newest first)', async () => {
    const store = new InMemoryMessagesStore();
    await store.cacheList(
      'b1',
      'received',
      [mkEnv('1', 'Smlouva alfa', 'X', 100)],
      1,
    );
    await store.cacheList(
      'b2',
      'received',
      [mkEnv('2', 'Alfa dodatek', 'Y', 200)],
      1,
    );
    expect(
      (await store.search('alfa')).map(h => `${h.boxId}:${h.envelope.id}`),
    ).toEqual(['b2:2', 'b1:1']);
  });

  it('an empty/whitespace query returns nothing', async () => {
    const store = new InMemoryMessagesStore();
    await store.cacheList('b1', 'received', [mkEnv('1', 'Cokoliv', 'X', 1)], 1);
    expect(await store.search('   ')).toEqual([]);
  });

  it('controller.searchMessages delegates to the store', async () => {
    const store = new InMemoryMessagesStore();
    await store.cacheList(
      'b1',
      'received',
      [mkEnv('1', 'Hledaný předmět', 'X', 1)],
      1,
    );
    const c = makeController({}, undefined, store);
    expect((await c.searchMessages('hledany')).map(h => h.envelope.id)).toEqual(
      ['1'],
    );
  });
});

describe('MessagesController - markRead', () => {
  const seedUnread = async (
    store: InMemoryMessagesStore,
    c: MessagesController,
  ) => {
    await c.listReceived(account({ boxId: 'b1' }), signal()); // caches envelope('2') as state 6
    expect(isUnread((await store.getEnvelope('b1', '2'))!.state)).toBe(true);
  };

  it('flips the cached message to read once the server confirms', async () => {
    const store = new InMemoryMessagesStore();
    const c = makeController(
      {
        listReceivedMessages: async () => ({
          type: 'messages',
          messages: [envelope('2')],
        }),
        markMessageAsDownloaded: async () => ({ type: 'ok' }),
      },
      undefined,
      store,
    );
    await seedUnread(store, c);
    expect(await c.markRead(account({ boxId: 'b1' }), '2')).toBe(true); // newly marked read
    expect(isUnread((await store.getEnvelope('b1', '2'))!.state)).toBe(false); // now read
  });

  it('leaves the message unread when the server does not confirm (and never throws)', async () => {
    const store = new InMemoryMessagesStore();
    const c = makeController(
      {
        listReceivedMessages: async () => ({
          type: 'messages',
          messages: [envelope('2')],
        }),
        markMessageAsDownloaded: async () => ({ type: 'authFault' }),
      },
      undefined,
      store,
    );
    await seedUnread(store, c);
    expect(await c.markRead(account({ boxId: 'b1' }), '2')).toBe(false); // not marked
    expect(isUnread((await store.getEnvelope('b1', '2'))!.state)).toBe(true); // unchanged
  });

  it('swallows a thrown transport error (best-effort)', async () => {
    const store = new InMemoryMessagesStore();
    const c = makeController(
      {
        listReceivedMessages: async () => ({
          type: 'messages',
          messages: [envelope('2')],
        }),
        markMessageAsDownloaded: async () => {
          throw new TransportNetworkError();
        },
      },
      undefined,
      store,
    );
    await seedUnread(store, c);
    expect(await c.markRead(account({ boxId: 'b1' }), '2')).toBe(false); // swallowed → not marked
    expect(isUnread((await store.getEnvelope('b1', '2'))!.state)).toBe(true);
  });

  it('sends the messageId + box-specific host/credentials', async () => {
    let seen: { id?: string; host?: string; password?: string | null } = {};
    const c = makeController({
      markMessageAsDownloaded: async args => {
        seen = { id: args.messageId, host: args.host, password: args.password };
        return { type: 'ok' };
      },
    });
    await c.markRead(account({ host: 'production' }), '7');
    expect(seen).toEqual({ id: '7', host: 'production', password: 'pw' });
  });

  it('OTP box: rides the session cookie (no password read or sent)', async () => {
    const secrets = {
      readPassword: jest.fn(async (): Promise<SecretRead> => ({ status: 'found', value: 'pw' })),
      readSession: jest.fn(
        async (): Promise<SecretRead> => ({ status: 'found', value: 'IPCZ-X-COOKIE=S' }),
      ),
    };
    let seenPassword: string | null = 'unset';
    let seenCookie: string | null = 'unset';
    const c = makeController(
      {
        markMessageAsDownloaded: async args => {
          seenPassword = args.password;
          seenCookie = args.sessionCookie;
          return { type: 'ok' };
        },
      },
      secrets,
    );
    await c.markRead(account({ authMethod: 'otp_totp' }), '7');
    expect(secrets.readPassword).not.toHaveBeenCalled();
    expect(seenPassword).toBeNull();
    expect(seenCookie).toBe('IPCZ-X-COOKIE=S');
  });
});

// A MessageDownloadResponse with the envelope in dmReturnedMessage.dmDm and file metadata as XML
// ATTRIBUTES (dmFileDescr/dmMimeType/dmFileMetaType) + base64 content as the dmEncodedContent child.
const downloadResponse = (files: string): string =>
  '<?xml version="1.0"?>' +
  '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" ' +
  'xmlns:p="http://isds.czechpoint.cz/v20"><soapenv:Body>' +
  '<p:MessageDownloadResponse><p:dmReturnedMessage>' +
  '<p:dmDm><p:dmID>42</p:dmID><p:dmAnnotation>Předmět</p:dmAnnotation>' +
  '<p:dmSender>Odesílatel s.r.o.</p:dmSender><p:dmSenderAddress>Praha 1</p:dmSenderAddress>' +
  '<p:dmRecipient>Příjemce</p:dmRecipient>' +
  `<p:dmFiles>${files}</p:dmFiles></p:dmDm>` +
  '<p:dmDeliveryTime>2026-06-05T09:00:00</p:dmDeliveryTime>' +
  '<p:dmAcceptanceTime>2026-06-06T10:30:00</p:dmAcceptanceTime>' +
  '</p:dmReturnedMessage>' +
  '<p:dmStatus><p:dmStatusCode>0000</p:dmStatusCode></p:dmStatus>' +
  '</p:MessageDownloadResponse></soapenv:Body></soapenv:Envelope>';

const dmFile = (descr: string, mime: string, content: string): string =>
  `<p:dmFile dmFileDescr="${descr}" dmMimeType="${mime}" dmFileMetaType="main">` +
  `<p:dmEncodedContent>${content}</p:dmEncodedContent></p:dmFile>`;

describe('parseMessageDownload', () => {
  const respNode = (xml: string) =>
    parseSoapBodyWithAttrs(xml).MessageDownloadResponse as Record<
      string,
      unknown
    >;

  it('parses the envelope fields + delivery/acceptance times', () => {
    const detail = parseMessageDownload(
      respNode(downloadResponse(dmFile('Doc.pdf', 'application/pdf', 'AAA='))),
    );
    expect(detail).toMatchObject({
      id: '42',
      subject: 'Předmět',
      sender: 'Odesílatel s.r.o.',
      senderAddress: 'Praha 1',
      recipient: 'Příjemce',
    });
    expect(detail.deliveryTime).toBe(Date.parse('2026-06-05T09:00:00'));
    expect(detail.acceptanceTime).toBe(Date.parse('2026-06-06T10:30:00'));
  });

  it('reads file metadata from attributes + base64 from dmEncodedContent', () => {
    const detail = parseMessageDownload(
      respNode(
        downloadResponse(dmFile('Faktura.pdf', 'application/pdf', 'JVBERi0=')),
      ),
    );
    expect(detail.attachments).toEqual([
      {
        name: 'Faktura.pdf',
        mimeType: 'application/pdf',
        metaType: 'main',
        contentBase64: 'JVBERi0=',
      },
    ]);
  });

  it('tolerates multiple files and a missing/empty file list', () => {
    const two = parseMessageDownload(
      respNode(
        downloadResponse(
          dmFile('a.pdf', 'application/pdf', 'AA==') +
            dmFile('b.xml', 'text/xml', 'BB=='),
        ),
      ),
    );
    expect(two.attachments.map(a => a.name)).toEqual(['a.pdf', 'b.xml']);
    expect(
      parseMessageDownload(respNode(downloadResponse(''))).attachments,
    ).toEqual([]);
  });
});

// 006 FR-017: this hook is what makes "the archive backs itself up" true. It has to fire when the
// archive actually gained something, and stay quiet when a refresh returned nothing - an automatic
// backup for an unchanged archive is work, battery and a new file for no reason.
describe('telling the archive it changed (006 FR-017)', () => {
  const build = (messages: MessageEnvelope[]) => {
    const changed = jest.fn();
    const controller = new MessagesController({
      transport: {
        listReceivedMessages: async () => ({ type: 'messages', messages }),
        getSentMessages: async () => ({ type: 'messages', messages: [] }),
      } as never,
      secureStore: passwordOnly(),
      messagesStore: new InMemoryMessagesStore(),
      onArchiveChanged: changed,
    });
    return { controller, changed };
  };

  it('fires after a sync that brought messages', async () => {
    const { controller, changed } = build([envelope('1'), envelope('2')]);
    await controller.listReceived(account(), new AbortController().signal);
    expect(changed).toHaveBeenCalled();
  });

  it('stays quiet after a sync that brought none', async () => {
    const { controller, changed } = build([]);
    await controller.listReceived(account(), new AbortController().signal);
    expect(changed).not.toHaveBeenCalled();
  });
});

// A count is a fact, and this one was capped (audit, 2026-09-09).
//
// The query took 100 rows and the screen rendered "100 výsledků" as the answer - under a hint saying
// it had searched the whole archive. Everything past the hundredth match was dropped without a word.
// The store now returns one MORE than the cap so the screen can tell "exactly 100" from "at least
// 100" and say the second one out loud.
describe('search results past the cap', () => {
  const store = new InMemoryMessagesStore();

  beforeAll(async () => {
    await store.cacheList(
      'box1',
      'received',
      Array.from({ length: SEARCH_LIMIT + 40 }, (_, i) => ({
        ...envelope(String(i)),
        subject: `Rozhodnutí ${i}`,
        deliveryTime: 1_000 + i,
      })),
      1,
    );
  });

  it('hands back one more than the cap, so truncation is detectable', async () => {
    const hits = await store.search('Rozhodnutí');
    expect(hits).toHaveLength(SEARCH_LIMIT + 1);
  });

  it('returns fewer than the cap untouched', async () => {
    const hits = await store.search('Rozhodnutí 7');
    // "Rozhodnutí 7", "…70".."…79" - a real, small answer that must not be dressed up as capped.
    expect(hits.length).toBeLessThan(SEARCH_LIMIT);
    expect(hits.length).toBeGreaterThan(0);
  });
});

// The attachment re-download used to decide "ISDS has deleted this message" in the detail screen, from
// ANY server failure on a message delivered over 90 days ago - a 500, a paused VoDZ service or an
// unparseable answer included - and recorded the files as lost for good. Only ISDS's own code for a
// deleted message (1219, 004 research R8), past the retention window, may do that now.
describe('getDetail: telling a deleted message from a download that failed', () => {
  const DAY = 24 * 60 * 60 * 1000;
  const NOW = 1_000_000_000_000;

  async function archive(acceptedDaysAgo: number) {
    const store = new InMemoryMessagesStore();
    await store.cacheList(
      'b1',
      'received',
      [{ ...envelope('2', 1), state: 7, acceptanceTime: NOW - acceptedDaysAgo * DAY }],
      1,
    );
    await store.cacheDetail('b1', detailWithBase64());
    return store;
  }

  const controllerOver = (
    store: MessagesStore,
    transport: Partial<MessagesTransport>,
    vodz?: VodzAttachmentDownloader,
  ) =>
    new MessagesController({
      transport: {
        listReceivedMessages: notConfigured('listReceivedMessages'),
        getSentMessages: notConfigured('getSentMessages'),
        downloadMessage: transport.downloadMessage ?? notConfigured('downloadMessage'),
        downloadSignedMessage: notConfigured('downloadSignedMessage'),
        markMessageAsDownloaded: notConfigured('markMessageAsDownloaded'),
        getCreditInfo: notConfigured('getCreditInfo'),
        getPasswordInfo: notConfigured('getPasswordInfo'),
      },
      secureStore: passwordOnly(),
      messagesStore: store,
      vodzDownloader: vodz,
      now: () => NOW,
    });

  it('records the files as lost when ISDS answers 1219 past the retention window', async () => {
    const store = await archive(91);
    const c = controllerOver(store, { downloadMessage: async () => ({ type: 'gone' }) });
    expect(await c.getDetail(account({ boxId: 'b1' }), '2', 'received', signal())).toEqual({
      kind: 'gone',
    });
    expect((await store.getDetail('b1', '2'))?.attachmentsUnavailable).toBe(true);
  });

  it('records nothing for 1219 within the window, and says ISDS refused', async () => {
    const store = await archive(10);
    const c = controllerOver(store, { downloadMessage: async () => ({ type: 'gone' }) });
    expect(await c.getDetail(account({ boxId: 'b1' }), '2', 'received', signal())).toEqual({
      kind: 'error',
      messageKey: 'detail.attachments.refused',
    });
    expect((await store.getDetail('b1', '2'))?.attachmentsUnavailable).toBeUndefined();
  });

  it.each([
    ['another refusal', { type: 'refused' as const }, 'detail.attachments.refused'],
    ['a server fault', { type: 'serverFault' as const }, 'messages.error.load'],
  ])('never records the files as lost for %s, however old the message', async (_why, answer, key) => {
    const store = await archive(400);
    const c = controllerOver(store, { downloadMessage: async () => answer });
    expect(await c.getDetail(account({ boxId: 'b1' }), '2', 'received', signal())).toEqual({
      kind: 'error',
      messageKey: key,
    });
    expect((await store.getDetail('b1', '2'))?.attachmentsUnavailable).toBeUndefined();
  });

  it('reads the large-volume download the same way: 1219 is gone, a fault is a retry', async () => {
    const gone = await archive(91);
    const vodzGone: VodzAttachmentDownloader = {
      download: jest.fn(async () => ({ type: 'gone' as const })),
      downloadSignedZfo: jest.fn(),
    };
    const c1 = controllerOver(gone, { downloadMessage: async () => ({ type: 'unsupported' }) }, vodzGone);
    expect(await c1.getDetail(account({ boxId: 'b1' }), '2', 'received', signal())).toEqual({
      kind: 'gone',
    });
    expect((await gone.getDetail('b1', '2'))?.attachmentsUnavailable).toBe(true);

    const fault = await archive(91);
    const vodzFault: VodzAttachmentDownloader = {
      download: jest.fn(async () => ({ type: 'serverFault' as const })),
      downloadSignedZfo: jest.fn(),
    };
    const c2 = controllerOver(fault, { downloadMessage: async () => ({ type: 'unsupported' }) }, vodzFault);
    expect(await c2.getDetail(account({ boxId: 'b1' }), '2', 'received', signal())).toEqual({
      kind: 'error',
      messageKey: 'detail.attachments.vodzFailed',
    });
    expect((await fault.getDetail('b1', '2'))?.attachmentsUnavailable).toBeUndefined();
  });
});

// Constitution IV (2026-09-15). A large-volume walk that stopped after some enclosures arrived was cached
// as the message's whole detail: the missing enclosures were recorded nowhere, nothing offered them
// again, and the message looked complete.
describe('getDetail: a large-volume message whose enclosures stopped arriving part-way', () => {
  const DAY = 24 * 60 * 60 * 1000;
  const NOW = 1_000_000_000_000;
  const enclosure = (n: number) => ({
    name: `priloha-${n}.pdf`,
    mimeType: 'application/pdf',
    metaType: n === 0 ? 'main' : 'enclosure',
    contentBase64: '',
    localPath: `/docs/attachments/b1/9/${n}_priloha-${n}.pdf`,
    size: 10 + n,
  });
  const original = { fileName: 'DZ_9.zfo', localPath: '/disk/b1/9/DZ_9.zfo', size: 40 };
  const partialDetail = (held: number, missingFrom = held): MessageDetail => ({
    id: '9',
    subject: 's9',
    sender: 'X',
    senderAddress: null,
    recipient: null,
    recipientAddress: null,
    deliveryTime: 9,
    acceptanceTime: null,
    attachments: Array.from({ length: held }, (_, n) => enclosure(n)),
    enclosuresMissingFrom: missingFrom,
  });

  async function archive(acceptedDaysAgo = 1) {
    const store = new InMemoryMessagesStore();
    await store.cacheList(
      'b1',
      'received',
      [{ ...envelope('9', 30000), state: 7, acceptanceTime: NOW - acceptedDaysAgo * DAY }],
      1,
    );
    return store;
  }

  /** A VoDZ service answering each walk in turn, whose original always arrives. */
  function answering(...answers: VodzDownloadResult[]) {
    const download = jest.fn<Promise<VodzDownloadResult>, unknown[]>();
    for (const answer of answers) {
      download.mockResolvedValueOnce(answer);
    }
    const downloadSignedZfo = jest.fn(async () => ({ type: 'zfo' as const, original }));
    return { download, downloadSignedZfo };
  }

  const controllerOver = (store: MessagesStore, vodz: VodzAttachmentDownloader) =>
    new MessagesController({
      transport: {
        listReceivedMessages: notConfigured('listReceivedMessages'),
        getSentMessages: notConfigured('getSentMessages'),
        // A large-volume message: the ordinary download cannot serve it.
        downloadMessage: async () => ({ type: 'unsupported' }),
        downloadSignedMessage: notConfigured('downloadSignedMessage'),
        markMessageAsDownloaded: notConfigured('markMessageAsDownloaded'),
        getCreditInfo: notConfigured('getCreditInfo'),
        getPasswordInfo: notConfigured('getPasswordInfo'),
      },
      secureStore: passwordOnly(),
      messagesStore: store,
      vodzDownloader: vodz,
      attachmentFiles: fakeFiles,
      now: () => NOW,
    });
  const open = (c: MessagesController) =>
    c.getDetail(account({ boxId: 'b1' }), '9', 'received', signal());

  it.each([
    ['a fault', 'serverFault', { kind: 'error', messageKey: 'detail.attachments.missingFailed' }],
    // Half-way it is no verdict on a message that has just served enclosures (`walkFailure`).
    ['ISDS reporting a deletion half-way', 'gone', { kind: 'error', messageKey: 'detail.attachments.refused' }],
    ['a lost session', 'authFault', { kind: 'reauth' }],
  ] as const)('keeps what arrived before %s and records the rest as missing', async (_why, stopped, failure) => {
    const store = await archive(400);
    const vodz = answering({
      type: 'partial',
      attachments: [enclosure(0), enclosure(1)],
      missingFrom: 2,
      stopped,
    });
    const out = await open(controllerOver(store, vodz));
    expect(out).toEqual({
      kind: 'partial',
      detail: expect.objectContaining({
        attachments: [enclosure(0), enclosure(1)],
        enclosuresMissingFrom: 2,
      }),
      failure,
    });
    const cached = await store.getDetail('b1', '9');
    expect(cached).toMatchObject({ attachments: [enclosure(0), enclosure(1)], enclosuresMissingFrom: 2 });
    expect(cached?.attachmentsUnavailable).toBeUndefined();
    // Not the original while the enclosures are incomplete: it can run to gigabytes over the same service.
    expect(vodz.downloadSignedZfo).not.toHaveBeenCalled();
  });

  it('resumes at the first missing enclosure, keeps the ones it holds, and closes the record once whole', async () => {
    const store = await archive();
    const vodz = answering(
      { type: 'partial', attachments: [enclosure(0), enclosure(1)], missingFrom: 2, stopped: 'serverFault' },
      { type: 'attachments', attachments: [enclosure(2)] },
    );
    const c = controllerOver(store, vodz);
    await open(c);
    const out = await open(c);
    expect(vodz.download).toHaveBeenNthCalledWith(1, expect.objectContaining({ messageId: '9', from: 0 }));
    expect(vodz.download).toHaveBeenNthCalledWith(2, expect.objectContaining({ messageId: '9', from: 2 }));
    const whole = [enclosure(0), enclosure(1), enclosure(2)];
    expect(out).toMatchObject({ kind: 'detail', detail: { attachments: whole, signedZfo: original } });
    const cached = await store.getDetail('b1', '9');
    expect(cached?.attachments).toEqual(whole);
    expect(cached).not.toHaveProperty('enclosuresMissingFrom');
    // The original follows once the message is whole, as for any other.
    expect(vodz.downloadSignedZfo).toHaveBeenCalledTimes(1);
  });

  it('leaves the record as it stood when a resumed walk brings nothing, and says the missing ones failed', async () => {
    const store = await archive();
    await store.cacheDetail('b1', partialDetail(1));
    const vodz = answering({ type: 'serverFault' });
    expect(await open(controllerOver(store, vodz))).toEqual({
      kind: 'error',
      messageKey: 'detail.attachments.missingFailed',
    });
    expect(vodz.download).toHaveBeenCalledWith(expect.objectContaining({ from: 1 }));
    expect(await store.getDetail('b1', '9')).toEqual(partialDetail(1));
  });

  it('starts from the first enclosure when the record does not add up', async () => {
    // It names enclosures 0 … 2 as held, and holds one: resuming would leave a hole in the list.
    const store = await archive();
    await store.cacheDetail('b1', partialDetail(1, 3));
    const vodz = answering({ type: 'attachments', attachments: [enclosure(0), enclosure(1)] });
    const out = await open(controllerOver(store, vodz));
    expect(vodz.download).toHaveBeenCalledWith(expect.objectContaining({ from: 0 }));
    expect(out).toMatchObject({ kind: 'detail', detail: { attachments: [enclosure(0), enclosure(1)] } });
  });

  it('reads 1219 on the first enclosure a resumed walk asks for as a download that brought nothing', async () => {
    // Past the retention window that is ISDS saying it deleted the message (`attachmentsGone`); what
    // arrived before stays in the archive, with its record.
    const store = await archive(400);
    await store.cacheDetail('b1', partialDetail(2));
    const vodz = answering({ type: 'gone' });
    expect(await open(controllerOver(store, vodz))).toEqual({ kind: 'gone' });
    expect(vodz.download).toHaveBeenCalledWith(expect.objectContaining({ from: 2 }));
    expect(await store.getDetail('b1', '9')).toEqual({ ...partialDetail(2), attachmentsUnavailable: true });
  });

  it('keeps every enclosure of a message it held whole when the download of its missing files stops part-way', async () => {
    // The archive holds the message whole, with its original. A file went from the device, and the
    // download offered for it starts from the first enclosure - and stops after one.
    const store = await archive();
    const whole: MessageDetail = { ...partialDetail(3), signedZfo: original };
    delete whole.enclosuresMissingFrom;
    await store.cacheDetail('b1', whole);
    const fresh = { ...enclosure(0), size: 99 };
    const vodz = answering({ type: 'partial', attachments: [fresh], missingFrom: 1, stopped: 'serverFault' });
    const out = await open(controllerOver(store, vodz));
    expect(vodz.download).toHaveBeenCalledWith(expect.objectContaining({ from: 0 }));
    expect(out).toMatchObject({
      kind: 'partial',
      failure: { kind: 'error', messageKey: 'detail.attachments.missingFailed' },
    });
    // Enclosures 1 and 2 are still the ones it held: listed, never recorded as missing, never re-fetched.
    const cached = await store.getDetail('b1', '9');
    expect(cached?.attachments).toEqual([fresh, enclosure(1), enclosure(2)]);
    expect(cached).not.toHaveProperty('enclosuresMissingFrom');
    expect(cached?.signedZfo).toEqual(original);
    expect(vodz.downloadSignedZfo).not.toHaveBeenCalled();
  });
});

describe('enclosuresAfterWalk: what the archive records for a large-volume walk', () => {
  const enclosure = (n: number) => ({
    name: `priloha-${n}.pdf`,
    mimeType: 'application/pdf',
    metaType: 'enclosure',
    contentBase64: '',
    localPath: `/docs/attachments/b1/9/${n}_priloha-${n}.pdf`,
    size: n,
  });
  const detail = (held: number, missingFrom?: number): MessageDetail => ({
    id: '9',
    subject: 's9',
    sender: 'X',
    senderAddress: null,
    recipient: null,
    recipientAddress: null,
    deliveryTime: 9,
    acceptanceTime: null,
    attachments: Array.from({ length: held }, (_, n) => enclosure(n)),
    ...(missingFrom == null ? {} : { enclosuresMissingFrom: missingFrom }),
  });

  it('records where the missing enclosures start for a first walk, and for a resume', () => {
    expect(enclosuresAfterWalk(null, [], { attachments: [enclosure(0)], missingFrom: 1 })).toEqual({
      attachments: [enclosure(0)],
      enclosuresMissingFrom: 1,
    });
    const resumed = detail(1, 1);
    expect(
      enclosuresAfterWalk(resumed, resumed.attachments, { attachments: [enclosure(1)], missingFrom: 2 }),
    ).toEqual({ attachments: [enclosure(0), enclosure(1)], enclosuresMissingFrom: 2 });
  });

  it('keeps a message it held whole whole, with the enclosures past the stop it still holds', () => {
    const fresh = { ...enclosure(0), size: 99 };
    expect(enclosuresAfterWalk(detail(3), [], { attachments: [fresh], missingFrom: 1 })).toEqual({
      attachments: [fresh, enclosure(1), enclosure(2)],
    });
  });

  it('records the rest as missing when the message it held had no enclosure past the stop', () => {
    // The archive's "whole" named two; the walk brought two and stopped. Nothing held lies past it.
    expect(
      enclosuresAfterWalk(detail(2), [], { attachments: [enclosure(0), enclosure(1)], missingFrom: 2 }),
    ).toEqual({ attachments: [enclosure(0), enclosure(1)], enclosuresMissingFrom: 2 });
  });

  it('records nothing missing for a walk that reached the end', () => {
    expect(enclosuresAfterWalk(detail(1, 1), [enclosure(0)], { attachments: [enclosure(1)] })).toEqual({
      attachments: [enclosure(0), enclosure(1)],
    });
  });
});

