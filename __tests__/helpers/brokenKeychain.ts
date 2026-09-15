// A Keychain that fails on every call, for the suites that mount the whole app over one (2026-09-24).
//
// Seen on the Android emulator: after an in-process reload, react-native-keychain 10 rejected every
// call with `IllegalStateException: There are multiple DataStores active for the same file`, and the
// app showed a blank screen with an unhandled rejection. The reload is a development accident, but it
// stands in for what a phone can do on its own - a vendor Keystore bug, a corrupted store - and the
// constitution (Principle II) owes the user a clear, localized, recoverable state then, never a blank
// app. The database key is a Keychain item too, so this takes the whole encrypted database with it.

import { act, fireEvent, screen } from '@testing-library/react-native';
import * as Keychain from 'react-native-keychain';
import { accountsController, settingsStore } from '../../src/features/accounts/deps';
import { APP_LOCK_KEY, TELEMETRY_KEY } from '../../src/app/settings/settingsKeys';
import type { DataBoxAccount } from '../../src/services/isds/types';

/** The words the library rejected with on the emulator. */
export const KEYCHAIN_FAILURE =
  'java.lang.IllegalStateException: There are multiple DataStores active for the same file: /data/user/0/cz.obalka/files/datastore/RN_KEYCHAIN.preferences_pb. You should either maintain your DataStore as a singleton or confirm that there is no two DataStore\'s active on the same file (by confirming that the scope is cancelled).';

type AnyMock = jest.Mock<unknown, unknown[]>;

/**
 * Make every react-native-keychain method reject, until `heal()`; after that each works as the in-memory
 * mock does. `calls` counts the calls made while broken, so a suite can see the failure was reached.
 */
export function breakKeychain(): { heal: () => void; failedCalls: () => number } {
  // The module the app imports - `jest.requireMock` hands back a separate copy of the manual mock.
  const keychain = Keychain as unknown as Record<string, unknown>;
  let broken = true;
  let failed = 0;
  for (const value of Object.values(keychain)) {
    if (jest.isMockFunction(value)) {
      const mock = value as AnyMock;
      const working = mock.getMockImplementation();
      mock.mockImplementation((...args: unknown[]) => {
        if (broken) {
          failed += 1;
          return Promise.reject(new Error(KEYCHAIN_FAILURE));
        }
        return working?.(...args);
      });
    }
  }
  return {
    heal: () => {
      broken = false;
    },
    failedCalls: () => failed,
  };
}

/** Let every timer-free promise chain the app started run, and Node report any rejection left unhandled. */
export async function settle(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 10; i++) {
      await new Promise<void>(resolve => setTimeout(resolve, 0));
    }
  });
}

/** Press what `testID` names, and let what it starts settle. */
export async function press(testID: string): Promise<void> {
  await act(async () => {
    fireEvent.press(screen.getByTestId(testID));
  });
  await settle();
}

/**
 * Fail the test on any promise rejection nobody handled. On the device that is the red "Uncaught (in
 * promise)" and, for the settings read, the reason nothing was ever drawn.
 */
export function failOnUnhandledRejections(): void {
  const seen: unknown[] = [];
  const onRejection = (reason: unknown) => {
    seen.push(reason);
  };
  beforeEach(() => {
    seen.length = 0;
    process.on('unhandledRejection', onRejection);
  });
  afterEach(async () => {
    await settle();
    process.off('unhandledRejection', onRejection);
    expect(seen.map(r => (r instanceof Error ? r.message : String(r)))).toEqual([]);
  });
}

/** A box the accounts table holds, for the suites that need one. */
export const SAVED_BOX = {
  id: 'acc_abc1234',
  boxId: 'abc1234',
  loginName: 'jana',
  label: 'Jana Nováková',
  dbType: 'FO',
  alias: null,
  authMethod: 'password',
  host: 'production',
  secretRef: '',
  sessionValidUntil: null,
  passwordExpiresAt: null,
  lastSyncedAt: null,
  messageCount: null,
  unreadCount: null,
  pdzCreditCzk: null,
  syncError: null,
  createdAt: 1_757_000_000_000,
  updatedAt: 1_757_000_000_000,
} as DataBoxAccount;

/**
 * The settings, with the app lock as given, and - when `boxes` is given - the box list, answered while
 * every other read of the database fails with its Keychain-held key. That is what lets a suite reach
 * the lock screen and the inbox over a Keychain that fails on every call: without it the settings read
 * fails first (`keychainFailureLaunch.test.tsx`). Without `boxes`, the box list fails too.
 *
 * Spies on the app's own stores, the way `launchEmptiesCookieJar.test.tsx` sets its mark. The
 * diagnostics question counts as answered, so a phone with a box goes straight to its inbox.
 */
export function savedState({
  lockOn,
  boxes,
}: {
  readonly lockOn: boolean;
  readonly boxes?: readonly DataBoxAccount[];
}): void {
  const settings: Record<string, string> = {
    [APP_LOCK_KEY]: lockOn ? '1' : '0',
    [TELEMETRY_KEY]: '0',
  };
  jest
    .spyOn(settingsStore, 'getSetting')
    .mockImplementation(async key => settings[key] ?? null);
  if (boxes) {
    jest.spyOn(accountsController, 'listAccounts').mockImplementation(async () => [...boxes]);
  }
}
