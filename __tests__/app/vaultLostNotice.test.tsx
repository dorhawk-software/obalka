// The notice for a vault key the phone lost (001 T028).
//
// Every box asking to sign in again at once looks like the app forgetting everything. The one thing
// that turns it into an explanation is this dialog, so what is pinned is that it appears for a key
// that is really gone, says so in the app's words, appears once rather than once per box, and stays
// quiet for a secret that is merely absent - and that it never draws over the lock screen or while the
// app is in the background, because an RN Modal is not hidden by the in-tree lock cover.

import { AppState, type AppStateStatus } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { LockGate } from '../../src/app/lock/LockGate';
import { VaultLostNotice } from '../../src/app/lock/VaultLostNotice';
import { t } from '../../src/i18n/strings';
import {
  InMemoryVaultKeyStorage,
  Vault,
} from '../../src/services/secureStore/vault';
import {
  InMemorySecretItems,
  VaultSecureStore,
} from '../../src/services/secureStore/vaultSecureStore';

const wrap = (ui: React.ReactElement) =>
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      {ui}
    </TamaguiProvider>,
  );

// AppState with listeners that really go away when removed, so a change reaches only what is mounted.
const appStateListeners = new Set<(state: AppStateStatus) => void>();

function emitAppState(state: AppStateStatus) {
  (AppState as unknown as { currentState: string }).currentState = state;
  for (const listener of [...appStateListeners]) {
    listener(state);
  }
}

beforeEach(() => {
  appStateListeners.clear();
  (AppState as unknown as { currentState: string }).currentState = 'active';
  (AppState.addEventListener as jest.Mock).mockImplementation(
    (type: string, listener: (state: AppStateStatus) => void) => {
      if (type !== 'change') {
        return { remove: () => {} };
      }
      appStateListeners.add(listener);
      return { remove: () => appStateListeners.delete(listener) };
    },
  );
});

const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/**
 * Two boxes' passwords sealed, then the key they were sealed under gone - and a fresh launch, with the
 * app lock as given. With the lock on, that launch's unlock puts a new key behind the gate.
 */
async function lostKeyPhone(lockOn: boolean) {
  const storage = new InMemoryVaultKeyStorage();
  const items = new InMemorySecretItems();
  let setting = false;
  const launch = () => {
    const vault = new Vault({
      storage,
      lockSetting: {
        read: async () => setting,
        write: async on => {
          setting = on;
        },
      },
    });
    const store = new VaultSecureStore({
      vault,
      items,
      boxIds: async () => ['boxA', 'boxB'],
      legacySessions: {
        legacySessionCookies: async () => [],
        clearLegacySessionCookie: async () => {},
      },
    });
    return { vault, store };
  };
  const before = launch();
  await before.store.savePassword('boxA', 'pw-a');
  await before.store.savePassword('boxB', 'pw-b');
  storage.plain = null;
  setting = lockOn;
  return launch();
}

async function afterTheKeyWasLost() {
  return (await lostKeyPhone(false)).store;
}

describe('VaultLostNotice', () => {
  it('explains once why every box asks to sign in again, and not again after it is read', async () => {
    const store = await afterTheKeyWasLost();
    const v = await wrap(<VaultLostNotice source={store} />);
    expect(v.queryByTestId('vault-lost-dialog')).toBeNull();

    await act(async () => {
      expect(await store.readPassword('boxA')).toEqual({ status: 'lost' });
      expect(await store.readPassword('boxB')).toEqual({ status: 'lost' });
    });
    expect(v.getAllByTestId('vault-lost-dialog')).toHaveLength(1);
    expect(v.getByText(t('vault.lost.title'))).toBeTruthy();
    expect(v.getByText(t('vault.lost.body'))).toBeTruthy();

    await act(async () => {
      fireEvent.press(v.getByTestId('vault-lost-ok'));
    });
    expect(v.queryByTestId('vault-lost-dialog')).toBeNull();

    // The next refresh meets the same dead seals; the user has already been told.
    await act(async () => {
      await store.readPassword('boxA');
    });
    expect(v.queryByTestId('vault-lost-dialog')).toBeNull();
  });

  it('shows at once when the loss was found before it mounted', async () => {
    const store = await afterTheKeyWasLost();
    await store.readPassword('boxA');
    const v = await wrap(<VaultLostNotice source={store} />);
    expect(v.getByTestId('vault-lost-dialog')).toBeTruthy();
  });

  it('says nothing for a box that simply has no stored password', async () => {
    const store = await afterTheKeyWasLost();
    const v = await wrap(<VaultLostNotice source={store} />);
    await act(async () => {
      expect(await store.readPassword('boxNone')).toEqual({ status: 'absent' });
    });
    expect(v.queryByTestId('vault-lost-dialog')).toBeNull();
  });

  it('waits for the lock screen to go - never drawn over it while an unlock is still revealing', async () => {
    // What happens on a phone: a refresh started behind the lock screen reads the moment the unlock
    // has the key, and the lock cover is still up then, holding for the OS success animation.
    const { vault, store } = await lostKeyPhone(true);
    const v = await wrap(
      <LockGate enabled lock={vault}>
        <VaultLostNotice source={store} />
      </LockGate>,
    );
    const read = store.readPassword('boxA');
    await act(async () => {
      await vault.useKey(); // the lock screen's own unlock, made on mount
      await wait(0);
    });
    expect(await read).toEqual({ status: 'lost' });
    expect(v.getByTestId('unlock')).toBeTruthy(); // the cover, still up
    expect(v.queryByTestId('vault-lost-dialog')).toBeNull();

    await waitFor(() => expect(v.queryByTestId('unlock')).toBeNull());
    expect(v.getByTestId('vault-lost-dialog')).toBeTruthy();
  });

  it('goes while the app is in the background, and is back - still unread - once the app is unlocked again', async () => {
    const { vault, store } = await lostKeyPhone(true);
    const v = await wrap(
      <LockGate enabled lock={vault}>
        <VaultLostNotice source={store} />
      </LockGate>,
    );
    await act(async () => {
      await vault.useKey();
      await store.readPassword('boxA');
    });
    await waitFor(() => expect(v.getByTestId('vault-lost-dialog')).toBeTruthy());

    await act(async () => emitAppState('background'));
    expect(v.queryByTestId('vault-lost-dialog')).toBeNull();
    expect(v.getByTestId('unlock')).toBeTruthy();

    // Coming back: the lock screen asks on its own, and the dialog waits until it has gone.
    await act(async () => emitAppState('active'));
    expect(v.queryByTestId('vault-lost-dialog')).toBeNull();
    await waitFor(() => expect(v.queryByTestId('unlock')).toBeNull());
    expect(v.getByTestId('vault-lost-dialog')).toBeTruthy();
  });

  it('with the lock off, goes while the app is in the background and is back on return', async () => {
    const store = await afterTheKeyWasLost();
    const v = await wrap(<VaultLostNotice source={store} />);
    await act(async () => {
      await store.readPassword('boxA');
    });
    expect(v.getByTestId('vault-lost-dialog')).toBeTruthy();

    await act(async () => emitAppState('background'));
    expect(v.queryByTestId('vault-lost-dialog')).toBeNull();
    await act(async () => emitAppState('active'));
    expect(v.getByTestId('vault-lost-dialog')).toBeTruthy();
  });

  it('is not opened for a loss found while the app is in the background', async () => {
    const store = await afterTheKeyWasLost();
    emitAppState('background');
    const v = await wrap(<VaultLostNotice source={store} />);
    await act(async () => {
      await store.readPassword('boxA');
    });
    expect(v.queryByTestId('vault-lost-dialog')).toBeNull();
    await act(async () => emitAppState('active'));
    expect(v.getByTestId('vault-lost-dialog')).toBeTruthy();
  });
});
