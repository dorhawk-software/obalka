// A restored inbox must not say when it was last updated if this phone never updated it.
//
// Found on the Android emulator on 2026-09-24. After a backup file was restored from Welcome, and
// again after the same data came over by phone transfer, the inbox of a box that had never been
// synced on this phone ended with "Aktualizováno 01.01.1970". The backup carries `downloadedAt` only
// as a marker (1 = "this message's body is here", `snapshot.ts`), and the restore wrote that marker
// into the row's sync time. The store's newest-stamp reducers skip 0 but not 1, so one millisecond
// past the epoch reached the line at the end of the list.
//
// Everything here runs the path the app runs: the real stores, `createBackup` / `restoreBackup` (the
// file restore and the transfer share it), and the inbox screen reading the restored store.

import { render, waitFor, type RenderResult } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { TamaguiProvider } from 'tamagui';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { tamaguiConfig } from '../../tamagui.config';
import { t } from '../../src/i18n/strings';
import { InMemoryAccountsStore } from '../../src/services/db/accountsStore';
import { InMemoryMessagesStore } from '../../src/services/db/messagesStore';
import { InMemoryDraftsStore } from '../../src/services/db/draftsStore';
import { InMemoryRemindersStore } from '../../src/services/db/remindersStore';
import { backupSink, backupSource, type BackupStores } from '../../src/services/backup/stores';
import {
  createBackup,
  listRestorable,
  restoreBackup,
  type SyncTarget,
} from '../../src/services/backup/backupService';
import type { BackupManifest } from '../../src/services/backup/schema';
import { freshnessLabel } from '../../src/features/messages/state/groupByDate';
import { MESSAGE_STATE } from '../../src/features/messages/state/messageState';
import type {
  DataBoxAccount,
  MessageDetail,
  MessageEnvelope,
} from '../../src/services/isds/types';

/** The stores the mocked inbox reads - whatever the test last restored into. */
let mockStores: BackupStores | null = null;

jest.mock('../../src/features/accounts/deps', () => ({
  messagesController: {
    // The box's sign-in has expired, as it had on the emulator: the live sync is refused and the
    // screen keeps what the archive gave it.
    listReceived: async () => ({ kind: 'reauth' as const }),
    listSent: async () => ({ kind: 'reauth' as const }),
    getCachedMessages: (boxId: string, folder?: 'received' | 'sent') =>
      mockStores!.messages.getList(boxId, folder ?? 'received'),
    getMergedMessages: (folder?: 'received' | 'sent') =>
      mockStores!.messages.listAcrossBoxes(folder ?? 'received', 500),
  },
  draftsStore: { list: jest.fn(async () => []) },
  remindersController: { listForBox: jest.fn(async () => []) },
}));

import { MessageList } from '../../src/features/messages/screens/MessageList';

const PASSPHRASE = 'FKPX-9WQ2-7TDM-4RJH-2CVB';
const FAST = { m: 256, t: 1, p: 1 };
const BOX = 'abc123';
/** When the phone that made the backup last synced the box. */
const SYNCED_THERE = Date.UTC(2026, 8, 10, 9, 0);
/** When the phone the backup lands on last synced the box, where it did. */
const SYNCED_HERE = Date.UTC(2026, 8, 20, 9, 0);
const NOW = Date.UTC(2026, 8, 24, 10, 0);

const account = (boxId: string): DataBoxAccount => ({
  id: `acc_${boxId}`,
  boxId,
  loginName: `login-${boxId}`,
  label: 'Jan Novák',
  dbType: 'FO',
  alias: null,
  authMethod: 'password',
  host: 'production',
  secretRef: `ref-${boxId}`,
  sessionValidUntil: null,
  passwordExpiresAt: null,
  lastSyncedAt: SYNCED_THERE,
  messageCount: 2,
  unreadCount: 0,
  pdzCreditCzk: null,
  syncError: null,
  createdAt: 1,
  updatedAt: 2,
});

const envelope = (id: string): MessageEnvelope => ({
  id,
  subject: `Rozhodnutí ${id}`,
  sender: 'Finanční úřad',
  senderAddress: 'Náměstí 1, Praha',
  recipient: null,
  recipientAddress: null,
  recipientBoxId: null,
  deliveryTime: Date.UTC(2026, 8, 1),
  acceptanceTime: Date.UTC(2026, 8, 2),
  state: MESSAGE_STATE.read,
  attachmentSize: 0,
});

const detail = (id: string): MessageDetail => ({
  id,
  subject: `Rozhodnutí ${id}`,
  sender: 'Finanční úřad',
  senderAddress: 'Náměstí 1, Praha',
  recipient: null,
  recipientAddress: null,
  deliveryTime: Date.UTC(2026, 8, 1),
  acceptanceTime: Date.UTC(2026, 8, 2),
  attachments: [],
});

const emptyStores = (): BackupStores => ({
  accounts: new InMemoryAccountsStore(),
  messages: new InMemoryMessagesStore(),
  drafts: new InMemoryDraftsStore(),
  reminders: new InMemoryRemindersStore(),
});

/** The phone the backup is made on: one box, synced, one message downloaded and one not. */
async function oldPhone(): Promise<BackupStores> {
  const stores = emptyStores();
  await stores.accounts.add(account(BOX));
  await stores.messages.cacheList(BOX, 'received', [envelope('m1'), envelope('m2')], SYNCED_THERE);
  await stores.messages.cacheDetail(BOX, detail('m1'), SYNCED_THERE);
  return stores;
}

function memoryTarget(): SyncTarget {
  const manifests: BackupManifest[] = [];
  const archives = new Map<string, Uint8Array>();
  return {
    listManifests: async () => [...manifests],
    putBackup: async (manifest, archive) => {
      manifests.push(manifest);
      archives.set(manifest.archiveName, archive);
    },
    deleteBackup: async () => {},
    getArchive: async name => archives.get(name)!,
  };
}

/** Back the old phone up, and restore that backup onto `onto` - as many times as asked. */
async function restoreOnto(onto: BackupStores, times = 1): Promise<void> {
  const target = memoryTarget();
  await createBackup(backupSource(await oldPhone()), target, PASSPHRASE, {
    appVersion: '0.0.1',
    kdf: FAST,
  });
  const [candidate] = await listRestorable(target);
  for (let i = 0; i < times; i++) {
    await restoreBackup(candidate.manifest, target, PASSPHRASE, backupSink(onto, fn => fn()));
  }
}

describe('what a restored archive says about its freshness', () => {
  it('has no sync time for a box this phone never synced', async () => {
    const onto = emptyStores();
    await restoreOnto(onto);

    const list = await onto.messages.getList(BOX, 'received');
    expect(list.envelopes.map(e => e.id).sort()).toEqual(['m1', 'm2']);
    expect(list.downloaded).toEqual(['m1']);
    expect(list.syncedAt).toBeNull();
    expect(freshnessLabel(list.syncedAt, NOW)).toBeNull();
  });

  it('still has none after the same data arrives a second time, as a transfer after a file restore', async () => {
    // The second pass merges into rows that are already here, which is where the marker came back
    // from `existingMessage` and was written as a sync time a second way.
    const onto = emptyStores();
    await restoreOnto(onto, 2);

    const list = await onto.messages.getList(BOX, 'received');
    expect(list.syncedAt).toBeNull();
    expect(freshnessLabel(list.syncedAt, NOW)).toBeNull();
    const merged = await onto.messages.listAcrossBoxes('received', 500);
    expect(merged.syncedAt).toBeNull();
  });

  it('keeps the sync time of a box this phone did sync', async () => {
    // A restore is a merge (006 FR-005). It must not move a real stamp backwards, to "never" or to
    // anything else.
    const onto = emptyStores();
    await onto.accounts.add(account(BOX));
    await onto.messages.cacheList(BOX, 'received', [envelope('m1'), envelope('m2')], SYNCED_HERE);
    await restoreOnto(onto);

    const list = await onto.messages.getList(BOX, 'received');
    expect(list.syncedAt).toBe(SYNCED_HERE);
  });

  it('reads the stamps earlier restores already wrote as "never"', async () => {
    // Archives restored before the fix hold 1 (downloaded rows) and 0 (the rest). The reducers skip 0;
    // 1 they return, and the label must refuse it.
    const onto = emptyStores();
    await onto.messages.cacheList(BOX, 'received', [envelope('m1')], 1);
    await onto.messages.cacheList(BOX, 'received', [envelope('m2')], 0);

    const list = await onto.messages.getList(BOX, 'received');
    expect(freshnessLabel(list.syncedAt, NOW)).toBeNull();
  });
});

const SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const mount = (unified: boolean): Promise<RenderResult> =>
  render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <NavigationContainer>
          <MessageList
            account={{ ...account(BOX), lastSyncedAt: null, secretRef: '' }}
            onOpenSwitcher={() => {}}
            onSearch={() => {}}
            onOpenMessage={() => {}}
            onCompose={() => {}}
            onReauth={() => {}}
            onOpenFaq={() => {}}
            unified={
              unified
                ? { accounts: [account(BOX)], onRefreshAll: () => {}, onReauthBox: () => {} }
                : null
            }
          />
        </NavigationContainer>
      </TamaguiProvider>
    </SafeAreaProvider>,
  );

describe('the end of a restored inbox', () => {
  afterEach(() => {
    mockStores = null;
  });

  it('says the box has not been updated yet, never 1970', async () => {
    const onto = emptyStores();
    await restoreOnto(onto, 2);
    mockStores = onto;

    const view = await mount(false);
    await waitFor(() => view.getByText(t('messages.synced.never')));
    expect(view.queryByText(/1970/)).toBeNull();
  });

  it('says the same in the merged view, which reads only the archive', async () => {
    // The merged view used to put "now" in place of a missing stamp, so an archive nobody had synced
    // on this phone said it had just been updated.
    const onto = emptyStores();
    await restoreOnto(onto);
    mockStores = onto;

    const view = await mount(true);
    await waitFor(() => view.getByText(t('messages.synced.never')));
    expect(view.queryByText(t('messages.synced.now'))).toBeNull();
    expect(view.queryByText(/1970/)).toBeNull();
  });
});
