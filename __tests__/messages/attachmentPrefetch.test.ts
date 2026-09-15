// Downloading attachments without being asked message by message (026 US1, US4).
//
// What is pinned here is what it must NOT do as much as what it does: it never runs unless the person
// asked for it (settings) and is on a connection they allowed; it asks ISDS for a message once, never
// for one ISDS has deleted; it covers received AND sent messages; and it never marks anything read -
// the fake below has no way to, which is the point: the only thing it can call is the download.

import {
  AttachmentPrefetcher,
  canAsk,
  inScope,
  type AutoDownloadPrefs,
} from '../../src/features/messages/state/attachmentPrefetch';
import {
  InMemoryMessagesStore,
  type UndownloadedMessage,
} from '../../src/services/db/messagesStore';
import type { MessageDetailOutcome } from '../../src/features/messages/state/messagesController';
import type {
  DataBoxAccount,
  MessageDetail,
  MessageEnvelope,
} from '../../src/services/isds/types';
import {
  AUTO_DOWNLOAD_DEFAULTS,
  readAutoDownload,
  writeAutoDownload,
  writeAutoDownloadWifiOnly,
} from '../../src/features/messages/state/autoDownloadSettings';

const DAY = 24 * 60 * 60 * 1000;
const NOW = 400 * DAY;

const account = (boxId: string, syncError: DataBoxAccount['syncError'] = null): DataBoxAccount => ({
  id: `acc_${boxId}`,
  boxId,
  loginName: 'novak',
  label: 'Jan Novak',
  dbType: 'FO',
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
  syncError,
  createdAt: 1,
  updatedAt: 1,
});

const envelope = (id: string, over: Partial<MessageEnvelope> = {}): MessageEnvelope => ({
  id,
  subject: `Zpráva ${id}`,
  sender: 'Úřad',
  senderAddress: null,
  recipient: null,
  recipientAddress: null,
  recipientBoxId: null,
  deliveryTime: NOW - DAY,
  acceptanceTime: NOW - DAY,
  state: 6,
  attachmentSize: 1,
  ...over,
});

const undownloaded = (
  over: Partial<MessageEnvelope> = {},
  folder: 'received' | 'sent' = 'received',
  firstSeenAt: number | null = NOW - DAY,
): UndownloadedMessage => ({ folder, envelope: envelope('m', over), firstSeenAt });

describe('which messages ISDS may be asked for', () => {
  it('asks for a delivered message still inside its retention window, received or sent', () => {
    expect(canAsk(undownloaded(), NOW)).toBe(true);
    expect(canAsk(undownloaded({ state: 2 }, 'sent'), NOW)).toBe(true);
  });

  it('never asks for what ISDS has already deleted or never held', () => {
    // 90 days after delivery by sign-in, ISDS has deleted it: a call that can only answer "gone".
    expect(canAsk(undownloaded({ acceptanceTime: NOW - 91 * DAY }), NOW)).toBe(false);
    expect(canAsk(undownloaded({ state: 9 }), NOW)).toBe(false); // content erased
    expect(canAsk(undownloaded({ state: 8 }), NOW)).toBe(false); // undeliverable, received
    expect(canAsk(undownloaded({ state: 3 }, 'sent'), NOW)).toBe(false); // failed the antivirus
  });

  it('keeps "new only" to messages this phone first saw at or after the switch', () => {
    const since = NOW - 2 * DAY;
    expect(inScope(undownloaded({}, 'received', NOW - DAY), { kind: 'since', since })).toBe(true);
    expect(inScope(undownloaded({}, 'received', NOW - 3 * DAY), { kind: 'since', since })).toBe(false);
    // A row from before 026, a restore or a transfer: already here, not new.
    expect(inScope(undownloaded({}, 'received', null), { kind: 'since', since })).toBe(false);
    expect(inScope(undownloaded({}, 'received', null), { kind: 'all' })).toBe(true);
  });
});

/** A phone: a store, a download that records what it was asked, and the switches. */
async function phone(options: {
  prefs?: Partial<AutoDownloadPrefs>;
  backupAll?: boolean;
  metered?: boolean | null;
  outcome?: (messageId: string) => MessageDetailOutcome['kind'];
  accounts?: DataBoxAccount[];
} = {}) {
  const store = new InMemoryMessagesStore();
  const accounts = options.accounts ?? [account('abc123')];
  // Seen at NOW - 5 days: two received, one sent, one already downloaded, one ISDS deleted.
  await store.cacheList(
    'abc123',
    'received',
    [
      envelope('r1'),
      envelope('r2'),
      envelope('old', { acceptanceTime: NOW - 200 * DAY }),
      envelope('have'),
    ],
    NOW - 5 * DAY,
  );
  await store.cacheList('abc123', 'sent', [envelope('s1', { state: 6 })], NOW - 5 * DAY);
  await store.cacheDetail('abc123', { id: 'have', attachments: [] } as unknown as MessageDetail);
  const asked: string[] = [];
  const holds: string[] = [];
  const prefetcher = new AttachmentPrefetcher({
    listAccounts: async () => accounts,
    listUndownloaded: boxId => store.listUndownloaded(boxId),
    download: async (acc, messageId, folder) => {
      asked.push(`${acc.boxId}/${folder}/${messageId}`);
      const kind = options.outcome?.(messageId) ?? 'detail';
      if (kind === 'detail') {
        await store.cacheDetail(acc.boxId, { id: messageId, attachments: [] } as unknown as MessageDetail);
        return { kind: 'detail', detail: {} as MessageDetail };
      }
      return kind === 'error'
        ? { kind: 'error', messageKey: 'messages.error.load' }
        : ({ kind } as MessageDetailOutcome);
    },
    autoDownload: async () => ({ ...AUTO_DOWNLOAD_DEFAULTS, ...options.prefs }),
    backupWantsAll: async () => options.backupAll === true,
    isMetered: async () => options.metered ?? false,
    holdBackups: () => {
      holds.push('hold');
      return () => holds.push('release');
    },
    now: () => NOW,
  });
  /** Let the queued run finish. */
  const settle = () => prefetcher.downloadMissing({ stop: { cancelled: true } });
  return { store, prefetcher, asked, holds, settle, accounts };
}

describe('after a listing the person started (026 US4)', () => {
  it('does nothing while automatic download is off', async () => {
    const { prefetcher, asked, settle, accounts } = await phone();
    prefetcher.afterListing(accounts[0]);
    await settle();
    expect(asked).toEqual([]);
  });

  it('downloads every missing attachment, received and sent, once, newest first - and never what ISDS deleted', async () => {
    const { prefetcher, asked, settle, accounts, holds } = await phone({ prefs: { on: true, since: null } });
    prefetcher.afterListing(accounts[0]);
    await settle();
    expect(asked.sort()).toEqual(['abc123/received/r1', 'abc123/received/r2', 'abc123/sent/s1']);
    // Automatic backups waited for the run, and were let go after it.
    expect(holds).toEqual(['hold', 'release']);

    // Downloaded now, so a second listing asks for nothing.
    prefetcher.afterListing(accounts[0]);
    await settle();
    expect(asked).toHaveLength(3);
  });

  it('keeps "new only" to messages that arrive after the switch', async () => {
    const { store, prefetcher, asked, settle, accounts } = await phone({
      prefs: { on: true, since: NOW - DAY },
    });
    await store.cacheList('abc123', 'received', [envelope('fresh')], NOW);
    prefetcher.afterListing(accounts[0]);
    await settle();
    expect(asked).toEqual(['abc123/received/fresh']);
  });

  it('waits for Wi-Fi when told to, and not when not', async () => {
    const onMobile = await phone({ prefs: { on: true, wifiOnly: true }, metered: true });
    onMobile.prefetcher.afterListing(onMobile.accounts[0]);
    await onMobile.settle();
    expect(onMobile.asked).toEqual([]);

    const allowed = await phone({ prefs: { on: true, wifiOnly: false }, metered: true });
    allowed.prefetcher.afterListing(allowed.accounts[0]);
    await allowed.settle();
    expect(allowed.asked).toHaveLength(3);
  });

  it('runs for a backup set to carry every attachment, even with the switch off - Wi-Fi rule included', async () => {
    const wanted = await phone({ backupAll: true });
    wanted.prefetcher.afterListing(wanted.accounts[0]);
    await wanted.settle();
    expect(wanted.asked).toHaveLength(3);

    const onMobile = await phone({ backupAll: true, metered: true });
    onMobile.prefetcher.afterListing(onMobile.accounts[0]);
    await onMobile.settle();
    expect(onMobile.asked).toEqual([]);
  });

  it('stops at the first sign-in refusal, and does not ask again for a message that failed', async () => {
    const refused = await phone({ prefs: { on: true }, outcome: () => 'reauth' });
    refused.prefetcher.afterListing(refused.accounts[0]);
    await refused.settle();
    expect(refused.asked).toHaveLength(1);

    const failing = await phone({ prefs: { on: true }, outcome: id => (id === 'r1' ? 'error' : 'detail') });
    failing.prefetcher.afterListing(failing.accounts[0]);
    await failing.settle();
    failing.prefetcher.afterListing(failing.accounts[0]);
    await failing.settle();
    expect(failing.asked.filter(a => a.endsWith('/r1'))).toHaveLength(1);
  });
});

describe('before a backup in the all mode (026 US1)', () => {
  it('downloads for every box that does not need a sign-in, whatever the Wi-Fi rule, and counts as it goes', async () => {
    const { prefetcher, asked } = await phone({
      prefs: { on: false, wifiOnly: true },
      metered: true,
      accounts: [account('abc123'), account('locked', 'reauth')],
    });
    const progress: string[] = [];
    const report = await prefetcher.downloadMissing({
      stop: { cancelled: false },
      onProgress: p => progress.push(`${p.done}/${p.total}`),
    });
    expect(asked).toHaveLength(3);
    expect(report).toEqual({ downloaded: 3, failed: 0 });
    expect(progress).toEqual(['0/3', '1/3', '2/3', '3/3']);
  });

  it('estimates what it would ask for and what ISDS has deleted', async () => {
    const { prefetcher } = await phone();
    expect(await prefetcher.estimate()).toEqual({ askable: 3, gone: 1 });
  });
});

describe('the switches as stored (026 FR-005)', () => {
  function table() {
    const values = new Map<string, string>();
    return {
      values,
      getSetting: async (key: string) => values.get(key) ?? null,
      setSetting: async (key: string, value: string) => {
        values.set(key, value);
      },
    };
  }

  it('is off and Wi-Fi only on a phone that never touched them', async () => {
    expect(await readAutoDownload(table())).toEqual({ on: false, since: null, wifiOnly: true });
  });

  it('stores the moment for "new only", and no moment for every message', async () => {
    const t = table();
    await writeAutoDownload(t, true, { onlyNew: true, now: 1234 });
    expect(await readAutoDownload(t)).toEqual({ on: true, since: 1234, wifiOnly: true });
    await writeAutoDownload(t, true, { onlyNew: false });
    expect(await readAutoDownload(t)).toEqual({ on: true, since: null, wifiOnly: true });
    await writeAutoDownloadWifiOnly(t, false);
    await writeAutoDownload(t, false);
    expect(await readAutoDownload(t)).toEqual({ on: false, since: null, wifiOnly: false });
  });
});
