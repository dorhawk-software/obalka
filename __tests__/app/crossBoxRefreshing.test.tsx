// "načítá se…" on the Jinde line is only as true as the shell's bookkeeping behind it (024 FR-003).
//
// `countInFlight`, the row marking and the clause are tested where they live
// (`__tests__/messages/crossBox.test.ts`, `crossBoxLine.test.tsx`). This mounts the real shell over a
// fake of its dependencies whose answers the test hands out one at a time, and reads the line off
// the inbox between them - because every way the note can lie is a question of WHEN: never showing,
// showing for a box nobody is fetching, clearing while the old count is still on screen, or staying
// up for good after a refresh that failed.

import { enableScreens } from 'react-native-screens';
enableScreens(false);

import { act, render, waitFor } from '@testing-library/react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { AppThemeProvider } from '../../src/theme/ThemeProvider';
import { AppShell } from '../../src/app/AppShell';
import type { DataBoxAccount, MessageEnvelope } from '../../src/services/isds/types';
import type { MessagesOutcome } from '../../src/features/messages/state/messagesController';

interface Held<T> {
  promise: Promise<T>;
  release: (value: T) => void;
}

function hold<T>(): Held<T> {
  let release!: (value: T) => void;
  const promise = new Promise<T>(resolve => {
    release = resolve;
  });
  return { promise, release };
}

/** The fake database and the fake ISDS behind the shell, and which of their answers are held back. */
const mockWorld = {
  accounts: [] as DataBoxAccount[],
  /** What each box's unread badge becomes once its listing is recorded. */
  unreadAfterSync: {} as Record<string, number>,
  /** Listings the test answers by hand. Every other box answers at once. */
  listings: new Map<string, Held<MessagesOutcome>>(),
  /** While set, re-reading the accounts table waits for it. */
  reads: null as Held<void> | null,
  readsWaiting: 0,
  /** Boxes whose recorded listing the database refuses to write. */
  failingWrites: new Set<string>(),
  /** Every box a listing was recorded for, refused or not. */
  writesAttempted: [] as string[],
};

function mockArchive(boxId: string): MessageEnvelope[] {
  // One read message in the open box, so its inbox is a list the line can sit in.
  return boxId === 'open'
    ? [
        {
          id: 'read',
          subject: 'Oznámení',
          sender: 'Úřad',
          senderAddress: null,
          recipient: null,
          recipientAddress: null,
          recipientBoxId: null,
          deliveryTime: Date.now() - 24 * 60 * 60 * 1000,
          acceptanceTime: Date.now() - 23 * 60 * 60 * 1000,
          state: 7,
          attachmentSize: null,
        },
      ]
    : [];
}

function mockListing(boxId: string): Promise<MessagesOutcome> {
  return (
    mockWorld.listings.get(boxId)?.promise ??
    Promise.resolve({
      kind: 'loaded',
      messages: mockArchive(boxId),
      downloaded: [],
      syncedAt: Date.now(),
    })
  );
}

jest.mock('../../src/features/accounts/deps', () => ({
  accountsController: {
    listAccounts: async () => {
      const reads = mockWorld.reads;
      if (reads) {
        mockWorld.readsWaiting += 1;
        await reads.promise;
      }
      return mockWorld.accounts.map(a => ({ ...a }));
    },
    recordSync: async (boxId: string) => {
      mockWorld.writesAttempted.push(boxId);
      if (mockWorld.failingWrites.has(boxId)) {
        throw new Error('disk I/O error');
      }
      mockWorld.accounts = mockWorld.accounts.map(a =>
        a.boxId === boxId
          ? { ...a, unreadCount: mockWorld.unreadAfterSync[boxId] ?? 0, syncError: null }
          : a,
      );
    },
    recordCredit: async () => {},
    recordSyncFailure: async (boxId: string, syncError: DataBoxAccount['syncError']) => {
      mockWorld.accounts = mockWorld.accounts.map(a =>
        a.boxId === boxId ? { ...a, syncError } : a,
      );
    },
  },
  messagesController: {
    listReceived: (account: DataBoxAccount) => mockListing(account.boxId),
    listSent: async () => ({ kind: 'loaded', messages: [], downloaded: [] }),
    getCachedMessages: async (boxId: string) => ({
      envelopes: mockArchive(boxId),
      downloaded: [],
      syncedAt: null,
    }),
    getCredit: async () => null,
  },
  // The shell listens for restores ending while a phone has no boxes (2026-09-24); none run here.
  backupController: { subscribe: () => () => {}, currentRun: () => null },
  transferController: { available: () => false },
  remindersController: { listForBox: async () => [] },
  scanController: { clearBox: async () => {} },
  draftsStore: { list: async () => [] },
  settingsStore: {
    getSetting: async () => null,
    setSetting: async () => {},
  },
  createLoginDeps: () => ({}),
  removalQueue: new (jest.requireActual('../../src/features/accounts/state/removalQueue').RemovalQueue)(),
  boxWork: new (jest.requireActual('../../src/features/messages/state/boxWork').BoxWork)(),
}));

// Diagnostics already answered, so the shell goes straight to the inbox instead of the consent card.
jest.mock('../../src/app/settings/SettingsProvider', () => {
  const actual = jest.requireActual('../../src/app/settings/SettingsProvider');
  return {
    ...actual,
    useSettings: () => ({ ...actual.useSettings(), telemetry: false }),
  };
});

const SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const account = (boxId: string, over: Partial<DataBoxAccount> = {}): DataBoxAccount => ({
  id: boxId,
  boxId,
  loginName: 'user',
  label: boxId,
  dbType: null,
  alias: null,
  authMethod: 'password',
  host: 'production',
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
  ...over,
});

function renderShell() {
  return render(
    <GestureHandlerRootView>
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <AppThemeProvider isDark={false}>
          <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
            <AppShell />
          </SafeAreaProvider>
        </AppThemeProvider>
      </TamaguiProvider>
    </GestureHandlerRootView>,
  );
}

/** Long enough for a re-read the test did NOT hold to reach the screen, if the shell asked for one. */
const settle = () =>
  act(async () => {
    await new Promise(resolve => setTimeout(resolve, 50));
  });

const LAUNCHING =
  'Jinde: 2 nepřečtené · naposledy 1 nepřečtená · 1 nenačtená · načítá se…';

let slow: Held<MessagesOutcome>;

beforeEach(() => {
  // The first box is the one opened, so the line reports the other two: one whose launch refresh the
  // test holds open, and one waiting for a sign-in, which the refresh skips.
  mockWorld.accounts = [
    account('open'),
    account('slow', { unreadCount: 2 }),
    account('expired', { unreadCount: 1, syncError: 'reauth' }),
  ];
  mockWorld.unreadAfterSync = { slow: 3 };
  slow = hold<MessagesOutcome>();
  mockWorld.listings = new Map([['slow', slow]]);
  mockWorld.reads = null;
  mockWorld.readsWaiting = 0;
  mockWorld.failingWrites = new Set();
  mockWorld.writesAttempted = [];
});

describe('the shell tells the Jinde line which boxes are being refreshed', () => {
  it("says it while a box is fetched and stops only once that box's new count is on screen", async () => {
    const view = await renderShell();
    // The expired box is skipped, so it stays "nenačtená": the note is about the box being fetched.
    await waitFor(() =>
      expect(view.getByTestId('crossBoxSummary')).toHaveTextContent(LAUNCHING),
    );

    // ISDS answers. The shell records it and goes back to the accounts table for the new count -
    // which the test holds, to look at the moment in between.
    const reread = hold<void>();
    mockWorld.reads = reread;
    await act(async () => {
      slow.release({ kind: 'loaded', messages: [], downloaded: [], syncedAt: Date.now() });
    });
    await waitFor(() => expect(mockWorld.readsWaiting).toBeGreaterThan(0));
    await settle();
    // The old count is still what the line states, so it must still say the new one is coming.
    expect(view.getByTestId('crossBoxSummary')).toHaveTextContent(LAUNCHING);

    mockWorld.reads = null;
    await act(async () => {
      reread.release();
    });
    await waitFor(() =>
      expect(view.getByTestId('crossBoxSummary')).toHaveTextContent(
        'Jinde: 3 nepřečtené · naposledy 1 nepřečtená · 1 nenačtená',
      ),
    );
  });

  it('takes the note down when the box cannot be refreshed, and says that instead', async () => {
    const view = await renderShell();
    await waitFor(() =>
      expect(view.getByTestId('crossBoxSummary')).toHaveTextContent(LAUNCHING),
    );
    await act(async () => {
      slow.release({ kind: 'error', messageKey: 'messages.error.load' });
    });
    // Both counts are memories now, and both boxes are "nenačtené" - no longer "still refreshing".
    await waitFor(() =>
      expect(view.getByTestId('crossBoxSummary')).toHaveTextContent(
        'Jinde: naposledy 3 nepřečtené · 2 nenačtené',
      ),
    );
  });

  it('never marks a box waiting for a password change as loading', async () => {
    // The skip and the mark were two copies of one rule, and the mark's copy knew only `reauth`: a
    // box whose password had expired read "načítá se…" through a refresh that never fetched it.
    mockWorld.accounts = [
      account('open'),
      account('slow', { unreadCount: 2 }),
      account('expired', { unreadCount: 1, syncError: 'passwordExpired' }),
    ];
    const view = await renderShell();
    await waitFor(() =>
      expect(view.getByTestId('crossBoxSummary')).toHaveTextContent(LAUNCHING),
    );
  });

  it('keeps the note up while one box is still fetched after another failed to record, and settles when both are done', async () => {
    // The failure the source used to be read for, driven for real now that it no longer rejects. A
    // database write that throws for one box used to reject the whole refresh: the note came down
    // for the box still out, the accounts were never re-read, and nothing caught the rejection.
    mockWorld.accounts = [
      account('open'),
      account('slow', { unreadCount: 2 }),
      account('broken', { unreadCount: 1 }),
    ];
    mockWorld.failingWrites = new Set(['broken']);
    const view = await renderShell();
    await waitFor(() => expect(mockWorld.writesAttempted).toContain('broken'));
    await settle();
    // `broken` is done - badly - and `slow` is still out: its old count is still what the line
    // states, so the line must still say the numbers are about to change. (How `broken` reads in
    // between depends on whether the inbox's own focus re-read has seen its flag yet; that is not
    // what is being asked here.)
    expect(view.getByTestId('crossBoxSummary')).toHaveTextContent(
      /^Jinde: 2 nepřečtené · .*načítá se…$/,
    );

    await act(async () => {
      slow.release({ kind: 'loaded', messages: [], downloaded: [], syncedAt: Date.now() });
    });
    // Settled once both are done and the table is re-read: the new count for `slow`, and `broken`
    // as a box that did not refresh, its unread count kept as the last one known.
    await waitFor(() =>
      expect(view.getByTestId('crossBoxSummary')).toHaveTextContent(
        'Jinde: 3 nepřečtené · naposledy 1 nepřečtená · 1 nenačtená',
      ),
    );
  });
});
