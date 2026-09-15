// Removing a box from the switcher, when the removal does not finish (001 FR-007, constitution II).
//
// The switcher closed and called the shell's removal without waiting for it. A failure became an
// unhandled rejection: no message, and the list and the route were not updated from what had actually
// happened until some later refresh - a box whose row was already gone stayed listed and active.
// `removeBox` and `settleRemoval` are tested as units in `__tests__/accounts/removeBox.test.ts`; this
// mounts the real shell over fakes of its dependencies and removes a box the way a user does, so what
// is checked is what ends up on screen.

import { enableScreens } from 'react-native-screens';
enableScreens(false);

import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { AppThemeProvider } from '../../src/theme/ThemeProvider';
import { AppShell } from '../../src/app/AppShell';
import { LockGate } from '../../src/app/lock/LockGate';
import { InMemoryVaultKeyStorage, Vault } from '../../src/services/secureStore/vault';
import { t } from '../../src/i18n/strings';
import * as telemetry from '../../src/services/telemetry/telemetry';
import type { DataBoxAccount, MessageEnvelope } from '../../src/services/isds/types';

/** The fake database and Keychain behind the shell. */
const mockWorld = {
  accounts: [] as DataBoxAccount[],
  /**
   * How a removal fails: `rowStays` refuses the row delete (`removeRow`), `keychainRefuses` drops the
   * row and then cannot delete the secrets (`forgetSecrets`) - the order the real removal works in.
   */
  removal: 'ok' as 'ok' | 'rowStays' | 'keychainRefuses',
  /** Boxes whose Keychain items will not delete after their row went, whatever `removal` says. */
  keychainRefusesFor: new Set<string>(),
  /** The archive refuses to clear. */
  archiveRefuses: false,
  /** Boxes whose archive clear waits for the test to let it go. */
  archiveHeld: new Map<string, Promise<void>>(),
  /** Everything else held for a box that was cleared, in order. */
  purged: [] as string[],
  /** How many times the app lock was reset. */
  lockResets: 0,
  /** Boxes whose Keychain items were deleted, in order. */
  forgotten: [] as string[],
  /** Boxes whose row will not delete, whatever `removal` says. */
  rowStaysFor: new Set<string>(),
  /** The accounts table will not read. */
  listBroken: false,
  /** A row delete breaks the accounts table for every read after it. */
  listBreaksOnRemoval: false,
  /** The settings table, where the marks of unfinished removals are kept. */
  settings: new Map<string, string>(),
  /** The box the fake ISDS signs in as. */
  signInAs: 'a',
  /** Boxes added through the sign-in flow, in order. */
  added: [] as string[],
  /** Boxes whose listing waits for the test to let it go. */
  listHeld: new Map<string, Promise<void>>(),
  /** The signal each box was last listed under. */
  listSignals: new Map<string, AbortSignal>(),
};

function mockArchive(): MessageEnvelope[] {
  return [
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
  ];
}

jest.mock('../../src/features/accounts/deps', () => {
  const accountsController = {
    listAccounts: async () => {
      if (mockWorld.listBroken) {
        throw new Error('database disk image is malformed');
      }
      return mockWorld.accounts.map(a => ({ ...a }));
    },
    recordSync: async () => {},
    recordCredit: async () => {},
    recordSyncFailure: async () => {},
    setAlias: async () => {},
    removeRow: async (boxId: string) => {
      if (mockWorld.removal === 'rowStays' || mockWorld.rowStaysFor.has(boxId)) {
        throw new Error('database is locked');
      }
      mockWorld.accounts = mockWorld.accounts.filter(a => a.boxId !== boxId);
      if (mockWorld.listBreaksOnRemoval) {
        mockWorld.listBroken = true;
      }
    },
    forgetSecrets: async (boxId: string) => {
      if (mockWorld.removal === 'keychainRefuses' || mockWorld.keychainRefusesFor.has(boxId)) {
        throw new Error('errSecInteractionNotAllowed');
      }
      mockWorld.forgotten.push(boxId);
    },
    addAccount: async (input: { ownerInfo: { boxId: string; label: string } }) => {
      mockWorld.added.push(input.ownerInfo.boxId);
      const added = mockAccount(input.ownerInfo.boxId, input.ownerInfo.label);
      mockWorld.accounts = [...mockWorld.accounts, added];
      return added;
    },
    reauthAccount: async () => {},
  };
  return {
    accountsController,
    removalQueue: new (jest.requireActual('../../src/features/accounts/state/removalQueue').RemovalQueue)(),
    boxWork: new (jest.requireActual('../../src/features/messages/state/boxWork').BoxWork)(),
    messagesController: {
      listReceived: async (listed: DataBoxAccount, signal: AbortSignal) => {
        mockWorld.listSignals.set(listed.boxId, signal);
        await mockWorld.listHeld.get(listed.boxId);
        return {
          kind: 'loaded',
          messages: mockArchive(),
          downloaded: [],
          syncedAt: Date.now(),
        };
      },
      listSent: async () => ({ kind: 'loaded', messages: [], downloaded: [] }),
      getCachedMessages: async () => ({ envelopes: mockArchive(), downloaded: [], syncedAt: null }),
      getCredit: async () => null,
      clearBoxCache: async (boxId: string) => {
        await mockWorld.archiveHeld.get(boxId);
        if (mockWorld.archiveRefuses) {
          throw new Error('database is locked');
        }
        mockWorld.purged.push(`archive:${boxId}`);
      },
    },
    // The shell listens for restores ending while a phone has no boxes (2026-09-24); none run here.
    backupController: { subscribe: () => () => {}, currentRun: () => null },
    transferController: { available: () => false },
    remindersController: {
      listForBox: async () => [],
      clearBox: async (boxId: string) => {
        mockWorld.purged.push(`reminders:${boxId}`);
      },
    },
    scanController: {
      clearBox: async (boxId: string) => {
        mockWorld.purged.push(`scan:${boxId}`);
      },
    },
    appLock: {
      forget: async () => {
        mockWorld.lockResets += 1;
      },
    },
    draftsStore: { list: async () => [] },
    settingsStore: {
      getSetting: async (key: string) => mockWorld.settings.get(key) ?? null,
      setSetting: async (key: string, value: string) => {
        mockWorld.settings.set(key, value);
      },
    },
    // The sign-in flow, over a fake ISDS that signs in as `signInAs`.
    createLoginDeps: () => ({
      authService: {
        beginLogin: async () => ({
          kind: 'signedIn',
          ownerInfo: {
            boxId: mockWorld.signInAs,
            label: 'Nová',
            dbType: null,
            passwordExpiresAt: null,
          },
          sessionCookie: null,
        }),
        submitOtp: async () => ({ kind: 'needsOtpSms' }),
        resendSms: async () => ({ kind: 'needsOtpSms' }),
        mobileKeyLogin: async () => ({ kind: 'needsOtpSms' }),
        abandon: async () => {},
      },
      accountsController,
      host: 'czebox',
    }),
  };
});

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

function mockAccount(boxId: string, label: string): DataBoxAccount {
  return {
    id: boxId,
    boxId,
    loginName: 'user',
    label,
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
  };
}

const account = mockAccount;

/** The shell as the app mounts it - behind the lock screen when a `lock` is given, as with the lock on. */
async function renderShell(lock?: Vault) {
  const view = await render(
    <GestureHandlerRootView>
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <AppThemeProvider isDark={false}>
          <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
            {lock ? (
              <LockGate enabled lock={lock}>
                <AppShell />
              </LockGate>
            ) : (
              <AppShell />
            )}
          </SafeAreaProvider>
        </AppThemeProvider>
      </TamaguiProvider>
    </GestureHandlerRootView>,
  );
  await waitFor(() => expect(view.getByTestId('boxSwitcher')).toBeTruthy());
  return view;
}

type View = Awaited<ReturnType<typeof renderShell>>;

/** Switcher → the box's ⋯ → Odebrat → Smazat, as a user removes one. */
async function removeFromSwitcher(view: View, boxId: string) {
  for (const testID of ['boxSwitcher', `boxMenu-${boxId}`, `boxRemove-${boxId}`, 'removeDelete']) {
    await act(async () => {
      fireEvent.press(view.getByTestId(testID));
    });
  }
}

async function openSwitcher(view: View) {
  await act(async () => {
    fireEvent.press(view.getByTestId('boxSwitcher'));
  });
}

beforeEach(() => {
  mockWorld.accounts = [account('a', 'Alfa'), account('b', 'Beta')];
  mockWorld.removal = 'ok';
  mockWorld.keychainRefusesFor = new Set();
  mockWorld.archiveRefuses = false;
  mockWorld.archiveHeld = new Map();
  mockWorld.purged = [];
  mockWorld.lockResets = 0;
  mockWorld.forgotten = [];
  mockWorld.rowStaysFor = new Set();
  mockWorld.listBroken = false;
  mockWorld.listBreaksOnRemoval = false;
  mockWorld.settings = new Map();
  mockWorld.signInAs = 'a';
  mockWorld.added = [];
  mockWorld.listHeld = new Map();
  mockWorld.listSignals = new Map();
});

/** Long enough for work the test did not hold to land, if the shell started any. */
const settle = () =>
  act(async () => {
    await new Promise(resolve => setTimeout(resolve, 50));
  });

/** The device-local setting the marks of unfinished removals are kept in. */
const MARKS = 'unfinishedRemovals';

describe('a box removal that does not finish', () => {
  it('says the box is still here when its row would not delete, and removes it on retry', async () => {
    mockWorld.removal = 'rowStays';
    const view = await renderShell();
    await removeFromSwitcher(view, 'b');

    await waitFor(() => expect(view.getByTestId('removeFailed')).toBeTruthy());
    expect(view.getByTestId('removeFailed')).toHaveTextContent(new RegExp(t('box.removeFailed.kept')));
    // Named, because the switcher it was removed from has closed.
    expect(view.getByTestId('removeFailed')).toHaveTextContent(/Beta/);
    // A box the app still lists keeps everything held for it.
    expect(mockWorld.purged).toEqual([]);

    mockWorld.removal = 'ok';
    await act(async () => {
      fireEvent.press(view.getByTestId('removeFailedRetry'));
    });
    await waitFor(() => expect(view.queryByTestId('removeFailed')).toBeNull());
    expect(mockWorld.purged).toEqual(['archive:b', 'reminders:b', 'scan:b']);
    await openSwitcher(view);
    expect(view.queryByTestId('switchBox-b')).toBeNull();
    expect(view.getByTestId('switchBox-a')).toBeTruthy();
  });

  it('moves off a removed active box even when a later step failed, and says the removal did not finish', async () => {
    mockWorld.removal = 'keychainRefuses';
    const view = await renderShell();
    await removeFromSwitcher(view, 'a');

    await waitFor(() => expect(view.getByTestId('removeFailed')).toBeTruthy());
    expect(view.getByTestId('removeFailed')).toHaveTextContent(
      new RegExp(t('box.removeFailed.incomplete')),
    );
    // Nothing can reach the box any more, so the rest of it still went.
    expect(mockWorld.purged).toEqual(['archive:a', 'reminders:a', 'scan:a']);

    await act(async () => {
      fireEvent.press(view.getByTestId('removeFailedClose'));
    });
    expect(view.queryByTestId('removeFailed')).toBeNull();
    // The list shows what the store holds, not what it held before: the removed box is gone and
    // the one left is the active one.
    await openSwitcher(view);
    expect(view.queryByTestId('switchBox-a')).toBeNull();
    expect(view.getByTestId('switchBox-b').props.accessibilityState?.selected).toBe(true);
  });

  it('reaches Welcome when the last box goes, and says there that part of it stayed', async () => {
    mockWorld.accounts = [account('a', 'Alfa')];
    mockWorld.archiveRefuses = true;
    const view = await renderShell();
    await removeFromSwitcher(view, 'a');

    await waitFor(() => expect(view.getByTestId('welcome')).toBeTruthy());
    expect(view.getByTestId('removeFailed')).toHaveTextContent(
      new RegExp(t('box.removeFailed.incomplete')),
    );
    // No box is left, so the lock went with it - the failed archive does not keep it armed.
    expect(mockWorld.lockResets).toBe(1);
    // …and the steps after the archive still ran.
    expect(mockWorld.purged).toEqual(['reminders:a', 'scan:a']);
  });

  it('says nothing when the removal went through', async () => {
    const view = await renderShell();
    await removeFromSwitcher(view, 'b');
    await waitFor(() => expect(mockWorld.purged).toEqual(['archive:b', 'reminders:b', 'scan:b']));
    expect(view.queryByTestId('removeFailed')).toBeNull();
  });
});

describe('while the active box is still being removed', () => {
  it('shows a box that is still there, not a blank screen, when the list is read again', async () => {
    // The row goes first and the archive is cleared after it. Opening the switcher meanwhile re-read
    // the table, the active box was not in it any more, and the navigator drew nothing - its header
    // and the switcher included - until the removal settled.
    let release!: () => void;
    mockWorld.archiveHeld = new Map([['a', new Promise<void>(resolve => (release = resolve))]]);
    const view = await renderShell();
    await removeFromSwitcher(view, 'a');

    await openSwitcher(view);
    await waitFor(() => expect(view.getByTestId('switchBox-b')).toBeTruthy());
    expect(view.getByTestId('switchBox-b').props.accessibilityState?.selected).toBe(true);
    expect(view.queryByTestId('switchBox-a')).toBeNull();

    await act(async () => {
      release();
    });
    await waitFor(() => expect(mockWorld.purged).toEqual(['archive:a', 'reminders:a', 'scan:a']));
    expect(view.queryByTestId('removeFailed')).toBeNull();
  });
});

describe('removing a second box while the first is still going', () => {
  it('finishes one removal before the next: nothing removed comes back, and no notice is lost', async () => {
    // The switcher closes before a removal settles, so a second box can be removed meanwhile. Run at
    // once, the removal to settle last put a box the other had already removed back on screen - here
    // it even made it the active one - and a removal that went through took down the notice of one
    // that had not.
    mockWorld.accounts = [account('a', 'Alfa'), account('b', 'Beta'), account('c', 'Cyril')];
    mockWorld.keychainRefusesFor = new Set(['a']);
    let releaseA!: () => void;
    let releaseB!: () => void;
    mockWorld.archiveHeld = new Map([
      ['a', new Promise<void>(resolve => (releaseA = resolve))],
      ['b', new Promise<void>(resolve => (releaseB = resolve))],
    ]);
    const view = await renderShell();
    // Alfa, the active box, is still clearing its archive when Beta is removed as well.
    await removeFromSwitcher(view, 'a');
    await removeFromSwitcher(view, 'b');

    await act(async () => {
      releaseA();
    });
    await waitFor(() => expect(view.getByTestId('removeFailed')).toBeTruthy());
    await act(async () => {
      releaseB();
    });
    await waitFor(() => expect(mockWorld.purged).toContain('scan:b'));
    await act(async () => {});
    // Beta went through after Alfa did not finish, and the notice about Alfa is still up.
    expect(view.getByTestId('removeFailed')).toHaveTextContent(/Alfa/);

    await act(async () => {
      fireEvent.press(view.getByTestId('removeFailedClose'));
    });
    await openSwitcher(view);
    expect(view.queryByTestId('switchBox-a')).toBeNull();
    expect(view.queryByTestId('switchBox-b')).toBeNull();
    expect(view.getByTestId('switchBox-c').props.accessibilityState?.selected).toBe(true);
  });
});

/** Deliver an AppState change to every listener registered so far - the jest mock never calls them. */
function emitAppState(state: 'active' | 'background') {
  (AppState as unknown as { currentState: string }).currentState = state;
  for (const [type, handler] of (AppState.addEventListener as jest.Mock).mock.calls) {
    if (type === 'change') {
      handler(state);
    }
  }
}

// RN Modals draw above the in-tree lock overlay, and the notice names the box: it is never drawn while
// the app is in the background or behind the lock screen. It is held there rather than closed, and
// shown again once the app is back and open (`useAppCovered`). Closed on the way to the background, or
// never opened for a removal that settled there, it was lost for good: nothing said on return that the
// removal had not finished.
describe('the notice and the background', () => {
  afterEach(() => {
    (AppState as unknown as { currentState: string }).currentState = 'active';
  });

  it('goes while the app is in the background, and is back on return', async () => {
    mockWorld.removal = 'rowStays';
    const view = await renderShell();
    await removeFromSwitcher(view, 'b');
    await waitFor(() => expect(view.getByTestId('removeFailed')).toBeTruthy());

    await act(async () => emitAppState('background'));
    expect(view.queryByTestId('removeFailed')).toBeNull();

    await act(async () => emitAppState('active'));
    expect(view.getByTestId('removeFailed')).toHaveTextContent(/Beta/);
    expect(view.getByTestId('removeFailed')).toHaveTextContent(new RegExp(t('box.removeFailed.kept')));
  });

  it('shows a removal that settled while the app was in the background once the app is back', async () => {
    mockWorld.removal = 'keychainRefuses';
    let release!: () => void;
    mockWorld.archiveHeld = new Map([['b', new Promise<void>(resolve => (release = resolve))]]);
    const view = await renderShell();
    await removeFromSwitcher(view, 'b');
    await act(async () => emitAppState('background'));
    await act(async () => {
      release();
    });
    await waitFor(() => expect(mockWorld.purged).toContain('scan:b'));
    await settle();
    expect(view.queryByTestId('removeFailed')).toBeNull();

    await act(async () => emitAppState('active'));
    expect(view.getByTestId('removeFailed')).toHaveTextContent(/Beta/);
    expect(view.getByTestId('removeFailed')).toHaveTextContent(
      new RegExp(t('box.removeFailed.incomplete')),
    );
    // The list followed what happened meanwhile: Beta is gone.
    await act(async () => {
      fireEvent.press(view.getByTestId('removeFailedClose'));
    });
    await openSwitcher(view);
    await waitFor(() => expect(view.queryByTestId('switchBox-b')).toBeNull());
  });
});

describe('the notice and the lock screen', () => {
  // AppState listeners that really go away when removed, so a change reaches only what is mounted: a
  // lock screen that has unmounted must not start an unlock of its own.
  const listeners = new Set<(state: AppStateStatus) => void>();
  const emit = (state: AppStateStatus) => {
    (AppState as unknown as { currentState: string }).currentState = state;
    for (const listener of [...listeners]) {
      listener(state);
    }
  };

  beforeEach(() => {
    listeners.clear();
    (AppState as unknown as { currentState: string }).currentState = 'active';
    (AppState.addEventListener as jest.Mock).mockImplementation(
      (type: string, listener: (state: AppStateStatus) => void) => {
        if (type !== 'change') {
          return { remove: () => {} };
        }
        listeners.add(listener);
        return { remove: () => listeners.delete(listener) };
      },
    );
  });

  afterEach(() => {
    (AppState.addEventListener as jest.Mock).mockImplementation(() => ({ remove: jest.fn() }));
    (AppState as unknown as { currentState: string }).currentState = 'active';
  });

  it('is never drawn over it: a removal that settled in the background shows once the app is unlocked', async () => {
    mockWorld.removal = 'keychainRefuses';
    let release!: () => void;
    mockWorld.archiveHeld = new Map([['b', new Promise<void>(resolve => (release = resolve))]]);
    // The app lock on: the vault key behind the gate, read by the lock screen's unlock.
    const vault = new Vault({
      storage: new InMemoryVaultKeyStorage(),
      lockSetting: { read: async () => true, write: async () => {} },
    });
    const view = await renderShell(vault);
    await waitFor(() => expect(view.queryByTestId('unlock')).toBeNull());
    await removeFromSwitcher(view, 'b');

    await act(async () => emit('background'));
    expect(view.getByTestId('unlock')).toBeTruthy();
    await act(async () => {
      release();
    });
    await waitFor(() => expect(mockWorld.purged).toContain('scan:b'));
    await settle();
    expect(view.queryByTestId('removeFailed')).toBeNull();

    // Back in the foreground the lock screen asks on its own, and the notice waits until it has gone.
    await act(async () => emit('active'));
    expect(view.getByTestId('unlock')).toBeTruthy();
    expect(view.queryByTestId('removeFailed')).toBeNull();
    await waitFor(() => expect(view.queryByTestId('unlock')).toBeNull());
    expect(view.getByTestId('removeFailed')).toHaveTextContent(/Beta/);
  });
});

// A launch or refresh-all sync still out for a box when it is removed wrote that box's envelopes back
// into the archive after the purge. The shell runs each box's refresh under a signal its removal aborts
// (`refreshAll`'s `forBox` and the removal's `work`, one `BoxWork`); what the controller then refuses
// to write is in `__tests__/accounts/removalVsSync.test.ts`.
describe('a sync out for a box when it is removed', () => {
  it('is stopped when the removal starts, and the box that stays is not', async () => {
    let release!: () => void;
    const listing = new Promise<void>(resolve => (release = resolve));
    mockWorld.listHeld = new Map([
      ['a', listing],
      ['b', listing],
    ]);
    const view = await renderShell();
    // The launch refresh, still out for both boxes.
    await waitFor(() => expect(mockWorld.listSignals.get('b')).toBeDefined());
    expect(mockWorld.listSignals.get('b')?.aborted).toBe(false);

    await removeFromSwitcher(view, 'b');
    await waitFor(() => expect(mockWorld.purged).toEqual(['archive:b', 'reminders:b', 'scan:b']));
    expect(mockWorld.listSignals.get('b')?.aborted).toBe(true);
    expect(mockWorld.listSignals.get('a')?.aborted).toBe(false);

    await act(async () => {
      release();
    });
    await settle();
  });
});

// A removal that took the row and stopped was never tried again: once its dialog closed, or the app
// was killed halfway, what stayed of the box stayed until the same box was added and removed again.
describe('a removal that did not finish, finished later', () => {
  it('is finished at the next launch, and a box listed again is left alone', async () => {
    // `gone` lost its row last time and nothing more; `a` was marked too, and has been added since.
    mockWorld.settings.set(MARKS, JSON.stringify(['gone', 'a']));
    const view = await renderShell();

    await waitFor(() => expect(mockWorld.settings.get(MARKS)).toBe('[]'));
    expect(mockWorld.forgotten).toEqual(['gone']);
    expect(mockWorld.purged).toEqual(['archive:gone', 'reminders:gone', 'scan:gone']);
    // Nothing is said: the user was told when it did not finish, and there is nothing to show.
    expect(view.queryByTestId('removeFailed')).toBeNull();
    await openSwitcher(view);
    expect(view.getByTestId('switchBox-a')).toBeTruthy();
  });

  it('is finished when the dialog saying it did not finish is closed', async () => {
    mockWorld.keychainRefusesFor = new Set(['a']);
    const view = await renderShell();
    await removeFromSwitcher(view, 'a');
    await waitFor(() => expect(view.getByTestId('removeFailed')).toBeTruthy());
    expect(mockWorld.forgotten).toEqual([]);

    mockWorld.keychainRefusesFor = new Set();
    await act(async () => {
      fireEvent.press(view.getByTestId('removeFailedClose'));
    });
    await waitFor(() => expect(mockWorld.forgotten).toEqual(['a']));
    await waitFor(() => expect(mockWorld.settings.get(MARKS)).toBe('[]'));
    expect(view.queryByTestId('removeFailed')).toBeNull();
  });
});

describe('when the accounts table will not read after a row went', () => {
  it('takes the removed box off the screen, and says the removal did not finish', async () => {
    // The list after the removal threw, and the shell kept the whole old list on screen - the removed
    // box included, and still active - saying only that it could not tell what was left.
    mockWorld.listBreaksOnRemoval = true;
    const view = await renderShell();
    await removeFromSwitcher(view, 'a');

    await waitFor(() => expect(view.getByTestId('removeFailed')).toBeTruthy());
    expect(view.getByTestId('removeFailed')).toHaveTextContent(
      new RegExp(t('box.removeFailed.incomplete')),
    );
    await act(async () => {
      fireEvent.press(view.getByTestId('removeFailedClose'));
    });
    await openSwitcher(view);
    expect(view.queryByTestId('switchBox-a')).toBeNull();
    expect(view.getByTestId('switchBox-b').props.accessibilityState?.selected).toBe(true);
  });
});

describe('two removals that do not finish', () => {
  it('shows both notices, one after the other, and closing one about a box still listed deletes nothing', async () => {
    // The second failure replaced the first notice, and with it the only prompt about a box already
    // gone from the app.
    mockWorld.accounts = [account('a', 'Alfa'), account('b', 'Beta'), account('c', 'Cyril')];
    mockWorld.keychainRefusesFor = new Set(['a']);
    mockWorld.rowStaysFor = new Set(['b']);
    let releaseA!: () => void;
    mockWorld.archiveHeld = new Map([['a', new Promise<void>(resolve => (releaseA = resolve))]]);
    const view = await renderShell();
    await removeFromSwitcher(view, 'a');
    await removeFromSwitcher(view, 'b');

    await act(async () => {
      releaseA();
    });
    await waitFor(() => expect(mockWorld.purged).toContain('scan:a'));
    await settle();
    expect(view.getByTestId('removeFailed')).toHaveTextContent(/Alfa/);
    expect(view.getByTestId('removeFailed')).toHaveTextContent(
      new RegExp(t('box.removeFailed.incomplete')),
    );

    await act(async () => {
      fireEvent.press(view.getByTestId('removeFailedClose'));
    });
    await waitFor(() => expect(view.getByTestId('removeFailed')).toHaveTextContent(/Beta/));
    expect(view.getByTestId('removeFailed')).toHaveTextContent(
      new RegExp(t('box.removeFailed.kept')),
    );

    // Closing is not a second removal: a box still listed keeps everything, and Odebrat with it.
    mockWorld.rowStaysFor = new Set();
    await act(async () => {
      fireEvent.press(view.getByTestId('removeFailedClose'));
    });
    await settle();
    expect(mockWorld.forgotten).not.toContain('b');
    expect(mockWorld.purged.filter(entry => entry.endsWith(':b'))).toEqual([]);
    await openSwitcher(view);
    expect(view.getByTestId('switchBox-b')).toBeTruthy();
  });
});

describe('removing the last box', () => {
  it('shows Welcome as soon as its row is gone, while the rest of it is still being cleared', async () => {
    // The screen stayed empty for as long as the archive and its files took, then Welcome appeared.
    mockWorld.accounts = [account('a', 'Alfa')];
    let release!: () => void;
    mockWorld.archiveHeld = new Map([['a', new Promise<void>(resolve => (release = resolve))]]);
    const view = await renderShell();
    await removeFromSwitcher(view, 'a');

    await waitFor(() => expect(view.getByTestId('welcome')).toBeTruthy());
    expect(mockWorld.purged).toEqual([]);
    expect(mockWorld.lockResets).toBe(0);

    await act(async () => {
      release();
    });
    await waitFor(() => expect(mockWorld.lockResets).toBe(1));
    expect(mockWorld.purged).toEqual(['archive:a', 'reminders:a', 'scan:a']);
    expect(view.getByTestId('welcome')).toBeTruthy();
    expect(view.queryByTestId('removeFailed')).toBeNull();
  });

  it('holds a box added from that Welcome until the removal has finished', async () => {
    // The same box added again straight away: the old removal must not clear it, or reset the lock
    // over its new key.
    mockWorld.accounts = [account('a', 'Alfa')];
    let release!: () => void;
    mockWorld.archiveHeld = new Map([['a', new Promise<void>(resolve => (release = resolve))]]);
    const view = await renderShell();
    await removeFromSwitcher(view, 'a');
    await waitFor(() => expect(view.getByTestId('welcome')).toBeTruthy());

    for (const testID of ['welcome-add-box', 'method-password', 'continue']) {
      await act(async () => {
        fireEvent.press(view.getByTestId(testID));
      });
    }
    await act(async () => {
      fireEvent.changeText(view.getByTestId('loginName'), 'user');
    });
    await act(async () => {
      fireEvent.changeText(view.getByTestId('password'), 'secret');
    });
    await act(async () => {
      fireEvent.press(view.getByTestId('submit'));
    });
    await settle();
    expect(mockWorld.added).toEqual([]);

    await act(async () => {
      release();
    });
    await waitFor(() => expect(mockWorld.added).toEqual(['a']));
    expect(mockWorld.purged).toEqual(['archive:a', 'reminders:a', 'scan:a']);
    expect(mockWorld.lockResets).toBe(1);
    await waitFor(() => expect(view.getByTestId('boxSwitcher')).toBeTruthy());
  });
});

describe('reporting a removal that did not finish', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reports a Keychain that refused as the Keychain, not as a database write', async () => {
    const reported = jest.spyOn(telemetry, 'reportFailure');
    mockWorld.keychainRefusesFor = new Set(['b']);
    const view = await renderShell();
    await removeFromSwitcher(view, 'b');
    await waitFor(() => expect(view.getByTestId('removeFailed')).toBeTruthy());

    expect(reported).toHaveBeenCalledWith(
      'keychain.write',
      new Error('errSecInteractionNotAllowed'),
      { stage: 'native' },
    );
    expect(reported).not.toHaveBeenCalledWith('db.write', expect.anything(), expect.anything());
  });
});
