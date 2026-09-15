import { AppState } from 'react-native';
import { act, render, waitFor, fireEvent } from '@testing-library/react-native';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { Text } from '../../src/theme/ui';
import { LockGate } from '../../src/app/lock/LockGate';
import { t } from '../../src/i18n/strings';
import {
  InMemoryVaultKeyStorage,
  Vault,
} from '../../src/services/secureStore/vault';

// The lock auto-prompts only when foregrounded; simulate that for the gate tests.
beforeEach(() => {
  (AppState as unknown as { currentState: string }).currentState = 'active';
  (AppState.addEventListener as jest.Mock).mockClear();
});

const wrap = (ui: React.ReactElement) =>
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      {ui}
    </TamaguiProvider>,
  );

const content = <Text>SECRET-CONTENT</Text>;

/** The real vault over a fake Keychain, with the lock setting as given. */
function vaultWith(lockOn: boolean) {
  const storage = new InMemoryVaultKeyStorage();
  const vault = new Vault({
    storage,
    lockSetting: { read: async () => lockOn, write: async () => {} },
  });
  return { vault, storage };
}

/**
 * Deliver an AppState change to the listeners registered from `from` on. The mock's `remove` does
 * nothing, so a listener of a lock screen that has since unmounted would otherwise still be called.
 */
function emitAppState(state: string, from = 0) {
  const calls = (AppState.addEventListener as jest.Mock).mock.calls.slice(from);
  for (const [type, handler] of calls) {
    if (type === 'change') {
      handler(state);
    }
  }
}

const filled = (fill: number) => new Uint8Array(32).fill(fill);

function setAppState(state: string) {
  (AppState as unknown as { currentState: string }).currentState = state;
}

const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/** Press what `testID` names and let whatever it starts settle. */
async function press(v: Awaited<ReturnType<typeof wrap>>, testID: string) {
  await act(async () => {
    fireEvent.press(v.getByTestId(testID));
    await wait(0);
  });
}

/** Press the lock screen's button and let the attempt it starts settle. */
const pressUnlock = (v: Awaited<ReturnType<typeof wrap>>) => press(v, 'unlock');

/** The real vault, locked, over a gated item every read of which fails on a Keychain error. */
async function lockedOverAFailingKey() {
  const { vault, storage } = vaultWith(true);
  storage.gated = filled(7);
  storage.gatedReadError = new Error('Wrapped error: Keystore operation failed');
  const v = await wrap(
    <LockGate enabled lock={vault}>
      {content}
    </LockGate>,
  );
  await act(() => wait(0)); // the attempt the lock screen makes on its own
  return { vault, storage, v };
}

/** Holds each gated read until released, as a prompt the user has not answered yet would. */
function holdPrompt(storage: InMemoryVaultKeyStorage) {
  const read = storage.readGated.bind(storage);
  let asked = false;
  let release: () => void = () => {};
  storage.readGated = async title => {
    asked = true;
    await new Promise<void>(resolve => {
      release = resolve;
    });
    return read(title);
  };
  return {
    asked: () => asked,
    release: () => release(),
    /** Back to a prompt that answers at once. */
    restore: () => {
      storage.readGated = read;
    },
  };
}

describe('LockGate', () => {
  it('renders children directly when the lock is disabled', async () => {
    const { vault } = vaultWith(false);
    const v = await wrap(
      <LockGate enabled={false} lock={vault}>
        {content}
      </LockGate>,
    );
    expect(v.queryByText('SECRET-CONTENT')).toBeTruthy();
    expect(v.queryByTestId('unlock')).toBeNull();
  });

  it('locked → auto-unlocks by reading the vault key, then reveals content', async () => {
    const { vault, storage } = vaultWith(true);
    storage.gated = new Uint8Array(32).fill(7);
    const v = await wrap(
      <LockGate enabled lock={vault}>
        {content}
      </LockGate>,
    );
    await waitFor(() => expect(v.queryByTestId('unlock')).toBeNull());
    expect(v.queryByText('SECRET-CONTENT')).toBeTruthy();
    // One prompt, and it was the key's: the unlock and the secret gate are the same act.
    expect(storage.prompts).toBe(1);
    expect(await vault.useKey()).toEqual(new Uint8Array(32).fill(7));
  });

  it('stays locked when authentication fails; the retry button re-prompts', async () => {
    const { vault, storage } = vaultWith(true);
    storage.gated = new Uint8Array(32).fill(7);
    storage.prompt = 'cancel';
    const v = await wrap(
      <LockGate enabled lock={vault}>
        {content}
      </LockGate>,
    );
    // The auto-attempt fails → the lock screen stays up. Content stays MOUNTED behind the opaque
    // overlay (so navigation/state survives a lock); the lock UI being present is the "locked" signal.
    await waitFor(() => expect(v.getByText(t('lock.failed'))).toBeTruthy());
    expect(storage.gated).toEqual(new Uint8Array(32).fill(7)); // a cancel costs no key

    storage.prompt = 'succeed';
    fireEvent.press(v.getByTestId('unlock'));
    await waitFor(() => expect(v.queryByTestId('unlock')).toBeNull());
    expect(v.queryByText('SECRET-CONTENT')).toBeTruthy();
  });

  it('drops the key when the app goes to the background, and asks again on return', async () => {
    const { vault, storage } = vaultWith(true);
    storage.gated = new Uint8Array(32).fill(7);
    const v = await wrap(
      <LockGate enabled lock={vault}>
        {content}
      </LockGate>,
    );
    await waitFor(() => expect(v.queryByTestId('unlock')).toBeNull());

    // Stay in the background so the lock screen does not immediately prompt again.
    (AppState as unknown as { currentState: string }).currentState = 'background';
    await act(async () => emitAppState('background'));
    expect(v.getByTestId('unlock')).toBeTruthy();
    const lockScreenListeners = (AppState.addEventListener as jest.Mock).mock.calls.length - 1;

    let read = false;
    void vault.useKey().then(() => {
      read = true;
    });
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    expect(read).toBe(false); // the key went with the foreground

    // Back to the foreground: the lock screen prompts on its own, as on a phone.
    (AppState as unknown as { currentState: string }).currentState = 'active';
    await act(async () => emitAppState('active', lockScreenListeners));
    await waitFor(() => expect(read).toBe(true));
    await waitFor(() => expect(v.queryByTestId('unlock')).toBeNull());
    expect(storage.prompts).toBe(2);
  });

  it.each([
    ['the app returns before the prompt answers', 'returnFirst'],
    ['the prompt answers before the app returns', 'answerFirst'],
  ] as const)(
    'unlocks with the phone passcode even though its screen sends the app to the background (%s)',
    async (_label, order) => {
      // On Android 10 and older "Use PIN" opens the passcode screen as an activity of its own, and
      // React Native reports this app as backgrounded while it is up. Dropping the key for that voided
      // every passcode unlock, and the lock screen asked again - for ever.
      const { vault, storage } = vaultWith(true);
      storage.gated = filled(7);
      const prompt = holdPrompt(storage);
      const v = await wrap(
        <LockGate enabled lock={vault}>
          {content}
        </LockGate>,
      );
      await waitFor(() => expect(prompt.asked()).toBe(true));

      setAppState('background');
      await act(async () => emitAppState('background'));
      const comeBack = async () => {
        setAppState('active');
        await act(async () => emitAppState('active'));
      };
      if (order === 'returnFirst') {
        await comeBack();
        await act(async () => prompt.release());
      } else {
        await act(async () => prompt.release());
        await comeBack();
      }

      await waitFor(() => expect(v.queryByTestId('unlock')).toBeNull());
      expect(v.queryByText('SECRET-CONTENT')).toBeTruthy();
      expect(storage.prompts).toBe(1);
      expect(await vault.useKey()).toEqual(filled(7));
    },
  );

  it('keeps no key from a prompt that answered after the user really left, and asks again on return', async () => {
    // A guard for the window above: holding the lock while an unlock is out must not turn into holding
    // the key while nobody is there.
    const { vault, storage } = vaultWith(true);
    storage.gated = filled(7);
    const prompt = holdPrompt(storage);
    const v = await wrap(
      <LockGate enabled lock={vault}>
        {content}
      </LockGate>,
    );
    await waitFor(() => expect(prompt.asked()).toBe(true));

    setAppState('background');
    await act(async () => emitAppState('background'));
    await act(async () => prompt.release());
    // Nobody comes back within the window.
    await act(() => wait(1700));
    expect(v.getByTestId('unlock')).toBeTruthy();
    expect(v.queryByText(t('lock.failed'))).toBeNull(); // leaving is not a failed attempt
    let read = false;
    void vault.useKey().then(() => {
      read = true;
    });
    await act(() => wait(0));
    expect(read).toBe(false);

    prompt.restore();
    setAppState('active');
    await act(async () => emitAppState('active'));
    await waitFor(() => expect(v.queryByTestId('unlock')).toBeNull());
    expect(read).toBe(true);
    expect(storage.prompts).toBe(2);
  });

  it('opens at once when the unlock lands while iOS still shows its own sheet, with no second prompt', async () => {
    // iOS keeps the app 'inactive', not 'background', while Face ID or the passcode sheet is up. The
    // return window is for the background only: waiting there for 'active' could run out and ask again.
    const { vault, storage } = vaultWith(true);
    storage.gated = filled(7);
    const prompt = holdPrompt(storage);
    const v = await wrap(
      <LockGate enabled lock={vault}>
        {content}
      </LockGate>,
    );
    await waitFor(() => expect(prompt.asked()).toBe(true));

    setAppState('inactive');
    await act(async () => emitAppState('inactive'));
    await act(async () => prompt.release());
    // No 'active' arrives in this test at all - longer than the return window.
    await act(() => wait(1700));

    expect(v.queryByTestId('unlock')).toBeNull();
    expect(storage.prompts).toBe(1);
    expect(await vault.useKey()).toEqual(filled(7));
  });

  it('stays locked when the app goes to the background between the unlock and the reveal', async () => {
    // The gate drops the key on that background. Finishing the reveal anyway opened the app on return
    // with no prompt and no key, so every refresh behind it waited for an unlock nothing asked for.
    const { vault, storage } = vaultWith(true);
    storage.gated = filled(7);
    const v = await wrap(
      <LockGate enabled lock={vault}>
        {content}
      </LockGate>,
    );
    // Unlocked: the key is read, and the cover holds for the OS success animation.
    await act(async () => {
      await vault.useKey();
      await wait(0);
    });
    expect(v.getByTestId('unlock')).toBeTruthy();

    setAppState('background');
    await act(async () => emitAppState('background'));
    await act(() => wait(700)); // past the hold and the fade
    expect(v.getByTestId('unlock')).toBeTruthy();
    let read = false;
    void vault.useKey().then(() => {
      read = true;
    });
    await act(() => wait(0));
    expect(read).toBe(false);

    setAppState('active');
    await act(async () => emitAppState('active'));
    await waitFor(() => expect(v.queryByTestId('unlock')).toBeNull());
    expect(read).toBe(true);
    expect(storage.prompts).toBe(2);
  });

  it('tells a phone without a screen lock what to set, instead of "try again"', async () => {
    const { vault, storage } = vaultWith(true);
    storage.screenLock = false;
    const v = await wrap(
      <LockGate enabled lock={vault}>
        {content}
      </LockGate>,
    );
    await waitFor(() => expect(v.getByText(t('lock.noScreenLock'))).toBeTruthy());
    expect(v.getByTestId('unlock')).toBeTruthy();
    expect(storage.gated).toBeNull();
  });

  it('with the lock off, shows itself once to move a key found only behind the gate', async () => {
    const { vault, storage } = vaultWith(false);
    storage.gated = new Uint8Array(32).fill(9);
    const v = await wrap(
      <LockGate enabled={false} lock={vault}>
        {content}
      </LockGate>,
    );
    expect(v.queryByTestId('unlock')).toBeNull();

    let key: Uint8Array | null = null;
    await act(async () => {
      void vault.useKey().then(k => {
        key = k;
      });
    });
    // The lock screen appeared, prompted on its own (the app is active), and moved the key back.
    await waitFor(() => expect(key).toEqual(new Uint8Array(32).fill(9)));
    await waitFor(() => expect(v.queryByTestId('unlock')).toBeNull());
    expect(storage.prompts).toBe(1);
    expect(storage.plain).toEqual(new Uint8Array(32).fill(9));
    expect(storage.gated).toBeNull();
  });

  it('explains a key that keeps failing to read and offers to set the lock up again - acting only on a yes', async () => {
    // Before, a Keychain error that is not a proven loss was "try again" on every attempt, for ever.
    const { vault, storage, v } = await lockedOverAFailingKey();
    expect(v.queryByTestId('lock-reset')).toBeNull();
    await pressUnlock(v);
    expect(v.queryByTestId('lock-reset')).toBeNull();
    await pressUnlock(v);
    expect(v.getByText(t('lock.keyUnreadable'))).toBeTruthy();
    expect(v.getByLabelText(t('lock.reset.link'))).toBeTruthy(); // named for a screen reader
    expect(storage.gated).toEqual(filled(7)); // offered, not done

    // Opened and cancelled: the key and the lock screen both stay.
    await press(v, 'lock-reset');
    expect(v.getByTestId('lock-reset-dialog')).toBeTruthy();
    expect(v.getByText(t('lock.reset.body'))).toBeTruthy();
    await press(v, 'lock-reset-cancel');
    expect(v.queryByTestId('lock-reset-dialog')).toBeNull();
    expect(storage.gated).toEqual(filled(7));
    expect(v.getByTestId('unlock')).toBeTruthy();

    // Confirmed: a new key behind the gate, read back in one prompt, and the app opens.
    const prompts = storage.prompts;
    await press(v, 'lock-reset');
    await press(v, 'lock-reset-confirm');
    await waitFor(() => expect(v.queryByTestId('unlock')).toBeNull());
    expect(v.queryByText('SECRET-CONTENT')).toBeTruthy();
    const fresh = await vault.useKey();
    expect(fresh).not.toEqual(filled(7));
    expect(storage.gated).toEqual(fresh);
    expect(storage.prompts).toBe(prompts + 1);
  });

  it('closes the confirmation when the app goes to the background, and keeps the key', async () => {
    const { storage, v } = await lockedOverAFailingKey();
    await pressUnlock(v);
    await pressUnlock(v);
    await press(v, 'lock-reset');
    expect(v.getByTestId('lock-reset-dialog')).toBeTruthy();

    setAppState('background');
    await act(async () => emitAppState('background'));
    expect(v.queryByTestId('lock-reset-dialog')).toBeNull();
    expect(storage.gated).toEqual(filled(7));
    expect(v.getByTestId('unlock')).toBeTruthy();
  });

  it('starts no unlock under the open confirmation when the app reports active again, so its yes still counts', async () => {
    // iOS says 'active' again after Control Center or a system sheet, without the app having left, so
    // the confirmation stays open. The attempt that started then was still out when the person
    // answered, and the yes was dropped: `run` refuses a second attempt while one is out.
    const { vault, storage, v } = await lockedOverAFailingKey();
    await pressUnlock(v);
    await pressUnlock(v);
    await press(v, 'lock-reset');
    const held = holdPrompt(storage);
    await act(async () => emitAppState('active'));
    expect(held.asked()).toBe(false);
    held.restore();

    await press(v, 'lock-reset-confirm');
    await waitFor(() => expect(v.queryByTestId('unlock')).toBeNull());
    expect(await vault.useKey()).not.toEqual(filled(7));
  });

  it('never offers the reset for a prompt that keeps being cancelled', async () => {
    const { vault, storage } = vaultWith(true);
    storage.gated = filled(7);
    storage.prompt = 'cancel';
    const v = await wrap(
      <LockGate enabled lock={vault}>
        {content}
      </LockGate>,
    );
    await act(() => wait(0));
    for (let i = 0; i < 4; i++) {
      await pressUnlock(v);
    }
    expect(storage.prompts).toBe(5); // every press really asked
    expect(v.queryByTestId('lock-reset')).toBeNull();
    expect(v.queryByText(t('lock.keyUnreadable'))).toBeNull();
    expect(storage.gated).toEqual(filled(7));
  });
});
