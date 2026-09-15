// The vault key: where it lives, when it is readable, and the rule that there is never a second one
// (001 T028, research R6b).
//
// Every box secret is sealed under this key, so the failures worth pinning are the silent ones: a
// prompt added to ordinary use, a read that answers "nothing" while the app is locked, and above all a
// new key generated beside an existing one - which would make every stored secret unreadable at once
// and look, to the user, like the app forgetting all their passwords.

import {
  InMemoryVaultKeyStorage,
  Vault,
  VaultKeyUnreadableError,
  VaultUnavailableError,
  isBiometricPromptError,
  isPermanentKeyLoss,
  isPromptOutcome,
} from '../../src/services/secureStore/vault';

const PROMPT = 'Odemknout Obálku';

function setup(opts: { lockOn?: boolean; platform?: 'ios' | 'android' } = {}) {
  const storage = new InMemoryVaultKeyStorage();
  storage.platform = opts.platform ?? 'ios';
  let setting = opts.lockOn ?? false;
  const settingWrites: boolean[] = [];
  let generated = 0;
  const vault = new Vault({
    storage,
    lockSetting: {
      read: async () => setting,
      write: async on => {
        setting = on;
        settingWrites.push(on);
      },
    },
    // Each "random" key is distinct and recognisable, so "the same key" and "a new key" can be told
    // apart in an assertion.
    randomBytes: n => new Uint8Array(n).fill(++generated),
  });
  return { vault, storage, setting: () => setting, settingWrites, generated: () => generated };
}

const key = (fill: number) => new Uint8Array(32).fill(fill);
const flush = () => new Promise(resolve => setTimeout(resolve, 0));

describe('with the lock off', () => {
  it('creates one key on first use, without a prompt, and persists it before handing it out', async () => {
    const { vault, storage } = setup();
    const k = await vault.useKey();
    expect(storage.plain).toEqual(k);
    expect(storage.gated).toBeNull();
    expect(storage.prompts).toBe(0);
  });

  it('gives two racing first reads the same key, and writes only one', async () => {
    const { vault, storage, generated } = setup();
    const keys = await Promise.all([1, 2, 3, 4, 5].map(() => vault.useKey()));
    for (const k of keys) {
      expect(k).toEqual(keys[0]);
    }
    expect(generated()).toBe(1);
    expect(storage.log.filter(l => l === 'writePlain')).toHaveLength(1);
  });

  it('uses the key already stored rather than making one', async () => {
    const { vault, storage, generated } = setup();
    storage.plain = key(42);
    expect(await vault.useKey()).toEqual(key(42));
    expect(generated()).toBe(0);
  });

  it('hands out a copy, so an operation zeroing its key cannot damage the vault’s', async () => {
    const { vault } = setup();
    const first = await vault.useKey();
    const expected = first.slice();
    first.fill(0);
    expect(await vault.useKey()).toEqual(expected);
  });

  it('reports a Keychain that will not answer as unavailable - never as a reason for a new key', async () => {
    const { vault, storage, generated } = setup();
    storage.plain = key(42);
    storage.plainReadError = new Error('keychain busy');
    await expect(vault.useKey()).rejects.toBeInstanceOf(VaultUnavailableError);
    expect(storage.plain).toEqual(key(42));
    expect(generated()).toBe(0);
    expect(await vault.useKey()).toEqual(key(42));
  });

  it('treats an ungated key whose Keystore key Android lost as lost - a new key, not "unavailable" for ever', async () => {
    // The entry survives, the Keystore key under it does not: react-native-keychain makes a new
    // Keystore key under the alias and every read of the old entry then fails its authentication tag.
    const { vault, storage, generated } = setup();
    storage.plain = key(42);
    storage.plainKeyLost = true;
    const k = await vault.useKey();
    expect(k).not.toEqual(key(42));
    expect(generated()).toBe(1);
    expect(storage.log).toEqual(['deletePlain', 'writePlain']);
    expect(storage.plain).toEqual(k);
    expect(storage.prompts).toBe(0);
    expect(await vault.useKey()).toEqual(k); // and it stays: one new key, not one per read
    expect(generated()).toBe(1);
  });

  it('still makes no key for a plain read that fails for any other reason, however often', async () => {
    const { vault, storage, generated } = setup();
    storage.plain = key(42);
    for (let i = 0; i < 3; i++) {
      storage.plainReadError = new Error('Wrapped error: Keystore operation failed');
      await expect(vault.useKey()).rejects.toBeInstanceOf(VaultUnavailableError);
    }
    expect(generated()).toBe(0);
    expect(storage.plain).toEqual(key(42));
  });

  it('replaces a stored value that is not a key at all', async () => {
    const { vault, storage, generated } = setup();
    storage.plain = key(42);
    storage.plainReadError = new VaultKeyUnreadableError();
    const k = await vault.useKey();
    expect(generated()).toBe(1);
    expect(storage.log).toEqual(['deletePlain', 'writePlain']);
    expect(storage.plain).toEqual(k);
  });
});

describe('switching the lock on', () => {
  it.each(['ios', 'android'] as const)(
    'costs exactly one prompt on %s and moves the key, unchanged',
    async platform => {
      const { vault, storage, setting } = setup({ platform });
      const k = await vault.useKey();
      expect(await vault.enable(PROMPT)).toBe('enabled');
      expect(storage.prompts).toBe(1);
      expect(storage.lastPromptTitle).toBe(PROMPT);
      expect(storage.gated).toEqual(k);
      expect(storage.plain).toBeNull();
      expect(setting()).toBe(true);
      // Still unlocked: the key the toggle just read is in memory, and using it asks nothing more.
      expect(await vault.useKey()).toEqual(k);
      expect(storage.prompts).toBe(1);
    },
  );

  it('leaves the lock off and the key where it was when the prompt is cancelled', async () => {
    const { vault, storage, setting } = setup();
    const k = await vault.useKey();
    storage.prompt = 'cancel';
    expect(await vault.enable(PROMPT)).toBe('cancelled');
    expect(setting()).toBe(false);
    expect(storage.plain).toEqual(k);
    expect(storage.gated).toBeNull();
    expect(await vault.useKey()).toEqual(k);
  });

  it('says so when the phone has no screen lock, and moves nothing', async () => {
    const { vault, storage, setting } = setup();
    const k = await vault.useKey();
    storage.screenLock = false;
    expect(await vault.enable(PROMPT)).toBe('noScreenLock');
    expect(storage.prompts).toBe(0);
    expect(storage.plain).toEqual(k);
    expect(setting()).toBe(false);
  });
});

describe('with the lock on', () => {
  async function locked(platform: 'ios' | 'android' = 'ios') {
    const s = setup({ platform });
    const k = await s.vault.useKey();
    await s.vault.enable(PROMPT);
    s.vault.lock();
    return { ...s, k };
  }

  it('keeps the key unreadable while locked, and a refresh after the unlock adds no prompt', async () => {
    const { vault, storage, k } = await locked();
    let resolved = false;
    const pending = vault.useKey().then(got => {
      resolved = true;
      return got;
    });
    await flush();
    expect(resolved).toBe(false); // waiting, not answering

    expect(await vault.unlock(PROMPT)).toBe('unlocked');
    expect(await pending).toEqual(k);
    expect(storage.prompts).toBe(2); // the toggle, then the unlock

    for (let i = 0; i < 20; i++) {
      await vault.useKey(); // twenty WS calls' worth of secret reads
    }
    expect(storage.prompts).toBe(2);
  });

  it('lets a read waiting for the unlock be abandoned - as unavailable, never as an empty answer', async () => {
    const { vault } = await locked();
    const ctrl = new AbortController();
    const pending = vault.useKey(ctrl.signal);
    ctrl.abort();
    await expect(pending).rejects.toBeInstanceOf(VaultUnavailableError);
  });

  it('never makes a new key when the unlock is cancelled', async () => {
    const { vault, storage, k, generated } = await locked();
    const writesBefore = storage.log.length;
    storage.prompt = 'cancel';
    expect(await vault.unlock(PROMPT)).toBe('failed');
    expect(await vault.unlock(PROMPT)).toBe('failed');
    expect(storage.log.length).toBe(writesBefore);
    expect(storage.gated).toEqual(k);
    expect(storage.plain).toBeNull();
    expect(generated()).toBe(1);

    storage.prompt = 'succeed';
    expect(await vault.unlock(PROMPT)).toBe('unlocked');
    expect(await vault.useKey()).toEqual(k);
  });

  it('switches off without a prompt and moves the same key back', async () => {
    const { vault, storage, k, setting } = await locked('android');
    await vault.unlock(PROMPT);
    const prompts = storage.prompts;
    await vault.disable();
    expect(storage.prompts).toBe(prompts);
    expect(setting()).toBe(false);
    expect(storage.plain).toEqual(k);
    expect(storage.gated).toBeNull();
    vault.lock(); // lock off: nothing to drop
    expect(await vault.useKey()).toEqual(k);
  });

  it('keeps no key from an unlock whose prompt was still out when the app went to the background', async () => {
    // The lock screen can go to the background with the OS prompt up. That prompt's read resolves
    // after the lock, and keeping its key would leave every secret readable behind a lock screen that
    // is showing again.
    const { vault, storage, k } = await locked();
    const ask = storage.readGated.bind(storage);
    let answer: () => void = () => {};
    storage.readGated = async title => {
      await new Promise<void>(resolve => {
        answer = resolve;
      });
      return ask(title);
    };
    const attempt = vault.unlock(PROMPT);
    await flush();
    vault.lock(); // LockGate: the app left the foreground while the prompt was showing
    answer();
    expect(await attempt).toBe('failed');

    let read = false;
    void vault.useKey().then(() => {
      read = true;
    });
    await flush();
    expect(read).toBe(false);

    storage.readGated = ask;
    expect(await vault.unlock(PROMPT)).toBe('unlocked');
    expect(await vault.useKey()).toEqual(k);
  });

  it('refuses to switch off while locked, and stays on', async () => {
    const { vault, storage, k, setting } = await locked();
    await expect(vault.disable()).rejects.toBeInstanceOf(VaultUnavailableError);
    expect(setting()).toBe(true);
    expect(storage.gated).toEqual(k);
  });
});

describe('the first unlock after this update', () => {
  it.each(['ios', 'android'] as const)(
    'gives a lock that was on before the vault a key behind the gate in one prompt (%s)',
    async platform => {
      const { vault, storage } = setup({ lockOn: true, platform });
      storage.legacyToken = true; // the old placeholder item
      expect(await vault.unlock(PROMPT)).toBe('unlocked');
      expect(storage.prompts).toBe(1);
      expect(storage.gated).not.toBeNull();
      expect(storage.plain).toBeNull();
      expect(storage.legacyToken).toBe(false);
    },
  );

  it('moves a key found in the ungated item behind the gate unchanged (a restored lock setting)', async () => {
    const { vault, storage, generated } = setup({ lockOn: true });
    storage.plain = key(42);
    expect(await vault.unlock(PROMPT)).toBe('unlocked');
    expect(storage.gated).toEqual(key(42));
    expect(storage.plain).toBeNull();
    expect(generated()).toBe(0);
  });
});

describe('when the phone has lost the key', () => {
  it('asks for a screen lock while there is none, then puts a new key behind it', async () => {
    const { vault, storage, generated } = setup();
    const old = await vault.useKey();
    await vault.enable(PROMPT);
    vault.lock();
    // The screen lock was removed: Android permanently invalidates the gated key.
    storage.prompt = 'invalidated';
    storage.screenLock = false;
    expect(await vault.unlock(PROMPT)).toBe('noScreenLock');

    storage.screenLock = true;
    storage.prompt = 'succeed';
    expect(await vault.unlock(PROMPT)).toBe('unlocked');
    const fresh = await vault.useKey();
    expect(fresh).not.toEqual(old);
    expect(storage.gated).toEqual(fresh);
    expect(generated()).toBe(2);
  });

  it('makes a new key when the system deleted the gated item (iOS, passcode removed and set again)', async () => {
    const { vault, storage } = setup();
    const old = await vault.useKey();
    await vault.enable(PROMPT);
    vault.lock();
    storage.gated = null;
    expect(await vault.unlock(PROMPT)).toBe('unlocked');
    expect(await vault.useKey()).not.toEqual(old);
  });
});

describe('the lock off, but the key only behind the gate', () => {
  it('asks for one unlock through the lock screen and moves the key back - never a new one', async () => {
    const { vault, storage, generated } = setup({ lockOn: false });
    storage.gated = key(42);
    const listener = jest.fn();
    vault.subscribe(listener);

    const pending = vault.useKey();
    await flush();
    expect(vault.needsRecovery()).toBe(true);
    expect(listener).toHaveBeenCalled();

    expect(await vault.unlock(PROMPT)).toBe('unlocked');
    expect(await pending).toEqual(key(42));
    expect(storage.prompts).toBe(1);
    expect(storage.plain).toEqual(key(42));
    expect(storage.gated).toBeNull();
    expect(vault.needsRecovery()).toBe(false);
    expect(generated()).toBe(0);
  });
});

describe('forgetting the key when no box is left', () => {
  it('deletes both copies, switches the lock off, and the next box gets a fresh key', async () => {
    const { vault, storage, setting } = setup();
    const old = await vault.useKey();
    await vault.enable(PROMPT);
    await vault.forget();
    expect(storage.plain).toBeNull();
    expect(storage.gated).toBeNull();
    expect(setting()).toBe(false);
    const next = await vault.useKey();
    expect(next).not.toEqual(old);
    expect(storage.prompts).toBe(1); // only the toggle ever asked
  });

  it('finishes every step even when one of them fails', async () => {
    const { vault, storage, setting } = setup();
    await vault.useKey();
    await vault.enable(PROMPT);
    storage.deleteGated = async () => {
      throw new Error('keychain refused');
    };
    await expect(vault.forget()).resolves.toBeUndefined();
    expect(setting()).toBe(false);
    expect(storage.plain).toBeNull();
  });
});

describe('a phone with no box at all', () => {
  it('discards a key left from a previous install when the lock is off', async () => {
    const { vault, storage } = setup({ lockOn: false });
    storage.gated = key(42); // what an iOS reinstall can leave in the Keychain
    await vault.discardIfLockOff();
    expect(storage.gated).toBeNull();
    expect(storage.plain).toBeNull();
    expect(vault.needsRecovery()).toBe(false);
    expect(storage.prompts).toBe(0);
  });

  it('leaves the key alone while the lock is on - the lock screen is in charge of it then', async () => {
    const { vault, storage } = setup({ lockOn: true });
    storage.gated = key(42);
    await vault.discardIfLockOff();
    expect(storage.gated).toEqual(key(42));
  });
});

describe('a key behind the gate that keeps failing to read', () => {
  // A Keychain error that is neither a proven loss nor the person's own answer to the prompt. Before
  // 2026-09-15 each one was "try again", for ever, and the lock screen had no other way out.
  const keychainError = () => new Error('Wrapped error: Keystore operation failed');

  async function lockedAndFailing(platform: 'ios' | 'android' = 'ios') {
    const s = setup({ platform });
    const k = await s.vault.useKey();
    await s.vault.enable(PROMPT);
    s.vault.lock();
    s.storage.gatedReadError = keychainError();
    return { ...s, k };
  }

  it('says so after three failures in a row - and changes nothing by itself', async () => {
    const { vault, storage, k, generated } = await lockedAndFailing();
    const log = [...storage.log];
    expect(await vault.unlock(PROMPT)).toBe('failed');
    expect(await vault.unlock(PROMPT)).toBe('failed');
    expect(await vault.unlock(PROMPT)).toBe('keyUnreadable');
    expect(await vault.unlock(PROMPT)).toBe('keyUnreadable');
    expect(storage.log).toEqual(log);
    expect(storage.gated).toEqual(k);
    expect(generated()).toBe(1);
  });

  it('never counts a cancelled, failed or locked-out prompt, however often - and then refuses a reset', async () => {
    const { vault, storage, k, generated } = await lockedAndFailing();
    for (const message of [
      'code: 13, msg: Cancel',
      'code: 10, msg: Authentication canceled by user',
      'code: 7, msg: Too many attempts. Try again later.',
      'User canceled the operation.',
    ]) {
      storage.gatedReadError = new Error(message);
      for (let i = 0; i < 3; i++) {
        expect(await vault.unlock(PROMPT)).toBe('failed');
      }
    }
    expect(await vault.resetKey(PROMPT)).toBe('failed');
    expect(storage.gated).toEqual(k);
    expect(storage.log).not.toContain('deleteGated');
    expect(generated()).toBe(1);
  });

  it.each(['code: 1, msg: Biometric hardware unavailable', 'code: 8, msg: Vendor error'])(
    'never offers a reset with the lock on for a prompt that itself keeps failing (%p) - the new key would need that prompt too',
    async message => {
      // Counted, the third one offered the reset: it deleted the owner's key, the new key's own
      // prompt failed the same way, and every box had to sign in again for nothing.
      const { vault, storage, k, generated } = await lockedAndFailing('android');
      storage.gatedReadError = new Error(message);
      for (let i = 0; i < 4; i++) {
        expect(await vault.unlock(PROMPT)).toBe('failed');
      }
      expect(await vault.resetKey(PROMPT)).toBe('failed');
      expect(storage.gated).toEqual(k);
      expect(storage.log).not.toContain('deleteGated');
      expect(generated()).toBe(1);
    },
  );

  it('refuses a reset before it was offered', async () => {
    const { vault, storage, k } = await lockedAndFailing();
    expect(await vault.unlock(PROMPT)).toBe('failed');
    expect(await vault.unlock(PROMPT)).toBe('failed');
    expect(await vault.resetKey(PROMPT)).toBe('failed');
    expect(storage.gated).toEqual(k);
    expect(storage.log).not.toContain('deleteGated');
  });

  it('forgets the failures once a read works again', async () => {
    const { vault, storage, k } = await lockedAndFailing();
    await vault.unlock(PROMPT);
    await vault.unlock(PROMPT);
    storage.gatedReadError = null;
    expect(await vault.unlock(PROMPT)).toBe('unlocked');
    vault.lock();
    storage.gatedReadError = keychainError();
    expect(await vault.unlock(PROMPT)).toBe('failed');
    expect(await vault.resetKey(PROMPT)).toBe('failed');
    expect(storage.gated).toEqual(k);
  });

  it.each(['ios', 'android'] as const)(
    'sets the lock up again only when asked: a new key behind the gate in one prompt, the lock still on (%s)',
    async platform => {
      const { vault, storage, k, setting, generated } = await lockedAndFailing(platform);
      for (let i = 0; i < 3; i++) {
        await vault.unlock(PROMPT);
      }
      const prompts = storage.prompts;
      expect(await vault.resetKey(PROMPT)).toBe('unlocked');
      const fresh = await vault.useKey();
      expect(fresh).not.toEqual(k);
      expect(storage.gated).toEqual(fresh);
      expect(storage.plain).toBeNull();
      expect(setting()).toBe(true);
      expect(generated()).toBe(2);
      expect(storage.prompts).toBe(prompts + 1);

      // And it is an ordinary lock from here on.
      vault.lock();
      expect(await vault.unlock(PROMPT)).toBe('unlocked');
      expect(await vault.useKey()).toEqual(fresh);
    },
  );

  it('keeps the lock on and holds no key when the reset’s own prompt is cancelled', async () => {
    const { vault, storage, k, setting } = await lockedAndFailing();
    for (let i = 0; i < 3; i++) {
      await vault.unlock(PROMPT);
    }
    storage.prompt = 'cancel';
    expect(await vault.resetKey(PROMPT)).toBe('failed');
    expect(setting()).toBe(true);
    let read = false;
    void vault.useKey().then(() => {
      read = true;
    });
    await flush();
    expect(read).toBe(false);

    // The next unlock opens with the key the confirmed reset put behind the gate.
    storage.prompt = 'succeed';
    expect(await vault.unlock(PROMPT)).toBe('unlocked');
    await flush();
    expect(read).toBe(true);
    const fresh = await vault.useKey();
    expect(fresh).not.toEqual(k);
    expect(storage.gated).toEqual(fresh);
  });

  it('says there is no screen lock rather than deleting a key it could not put back behind one', async () => {
    const { vault, storage, k } = await lockedAndFailing();
    for (let i = 0; i < 3; i++) {
      await vault.unlock(PROMPT);
    }
    storage.screenLock = false;
    expect(await vault.resetKey(PROMPT)).toBe('noScreenLock');
    expect(storage.gated).toEqual(k);
  });

  it('with the lock off, replaces a key found only behind the gate that keeps failing - without a prompt', async () => {
    const { vault, storage, setting, generated } = setup({ lockOn: false });
    storage.gated = key(42);
    storage.gatedReadError = keychainError();
    const pending = vault.useKey();
    await flush();
    expect(vault.needsRecovery()).toBe(true);
    expect(await vault.unlock(PROMPT)).toBe('failed');
    expect(await vault.unlock(PROMPT)).toBe('failed');
    expect(await vault.unlock(PROMPT)).toBe('keyUnreadable');

    expect(await vault.resetKey(PROMPT)).toBe('unlocked');
    const fresh = await pending;
    expect(fresh).not.toEqual(key(42));
    expect(storage.plain).toEqual(fresh);
    expect(storage.gated).toBeNull();
    expect(vault.needsRecovery()).toBe(false);
    expect(storage.prompts).toBe(0);
    expect(setting()).toBe(false);
    expect(generated()).toBe(1);
  });

  it('with the lock off, still offers it for a prompt that itself keeps failing - that reset asks nothing', async () => {
    const { vault, storage, generated } = setup({ lockOn: false, platform: 'android' });
    storage.gated = key(42);
    storage.gatedReadError = new Error('code: 1, msg: Biometric hardware unavailable');
    const pending = vault.useKey();
    await flush();
    expect(await vault.unlock(PROMPT)).toBe('failed');
    expect(await vault.unlock(PROMPT)).toBe('failed');
    expect(await vault.unlock(PROMPT)).toBe('keyUnreadable');
    expect(await vault.resetKey(PROMPT)).toBe('unlocked');
    expect(await pending).not.toEqual(key(42));
    expect(storage.prompts).toBe(0);
    expect(generated()).toBe(1);
  });
});

describe('what counts as the biometric prompt failing rather than the Keychain', () => {
  it.each([
    ['code: 1, msg: Biometric hardware unavailable', true],
    ['code: 12, msg: No hardware', true],
    ['Wrapped error: code: 8, msg: Vendor error', true],
    ['code: 13, msg: Cancel', true],
    ['Wrapped error: Keystore operation failed', false],
    ['User canceled the operation.', false],
    ['Wrapped error: Key permanently invalidated', false],
    ['Decryption failed: Authentication tag verification failed.', false],
  ])('%p → %p', (message, outcome) => {
    expect(isBiometricPromptError(new Error(message))).toBe(outcome);
  });
});

describe('what counts as the prompt’s own answer rather than the Keychain failing', () => {
  it.each([
    ['code: 13, msg: Cancel', true],
    ['code: 10, msg: Authentication canceled by user', true],
    ['code: 5, msg: Fingerprint operation canceled.', true],
    ['code: 3, msg: Timeout', true],
    ['code: 7, msg: Too many attempts. Try again later.', true],
    ['code: 9, msg: Too many attempts. Fingerprint sensor disabled.', true],
    ['Wrapped error: code: 13, msg: Cancel', true],
    ['Not assigned current activity', true],
    ['User canceled the operation.', true],
    ['The user name or passphrase you entered is not correct.', true],
    ['User interaction is not allowed.', true],
    ['code: 1, msg: Biometric hardware unavailable', false],
    ['code: 12, msg: No hardware', false],
    ['Wrapped error: Keystore operation failed', false],
    ['Unable to decode the provided data.', false],
    ['Wrapped error: Key permanently invalidated', false],
  ])('%p → %p', (message, outcome) => {
    expect(isPromptOutcome(new Error(message))).toBe(outcome);
  });
});

describe('what counts as a key the phone can never read again', () => {
  it.each([
    ['Wrapped error: Key permanently invalidated', true],
    [
      'Decryption failed: Authentication tag verification failed. This usually indicates that the encrypted data was modified',
      true,
    ],
    ['code: 13, msg: Cancel', false],
    ['code: 10, msg: Authentication canceled by user', false],
    ['code: 7, msg: Too many attempts. Try again later.', false],
    ['User canceled the operation.', false],
    ['Not assigned current activity', false],
  ])('%p → %p', (message, permanent) => {
    expect(isPermanentKeyLoss(new Error(message))).toBe(permanent);
  });

  it('counts a stored value that is not a key', () => {
    expect(isPermanentKeyLoss(new VaultKeyUnreadableError())).toBe(true);
  });
});
