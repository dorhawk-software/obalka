// Every gated Keychain read must let the DEVICE PASSCODE answer the prompt.
//
// Found on the emulator, and it is not a detail: react-native-keychain decides which authenticators
// the Android prompt offers from the options of THAT CALL, not from what was stored. The default
// (ACCESS_CONTROL.NONE) asks for biometrics alone, so on a phone with a PIN and no fingerprint - or
// one whose biometrics are temporarily locked out - the OS answers "No fingerprints enrolled", the
// promise rejects, and the code above it reads that as "the user cancelled".
//
// The consequences are silent and permanent-looking: a backup password that can never be shown again,
// and an app lock that can never be opened. So the option is pinned here rather than trusted to
// review - the failure only shows up on a real device, in a state most test phones are not in.

import * as Keychain from 'react-native-keychain';
import {
  BackupPromptDeclinedError,
  backupSecretStore,
  isPromptDeclined,
} from '../../src/services/backup/backupSecret';
import { KeychainVaultKeyStorage } from '../../src/services/secureStore/keychainVaultKeyStorage';
import { NoScreenLockError } from '../../src/services/secureStore/vault';

const PASSCODE_ALLOWED: string[] = [
  Keychain.ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE,
  Keychain.ACCESS_CONTROL.DEVICE_PASSCODE,
];

const get = Keychain.getGenericPassword as jest.Mock;
const set = Keychain.setGenericPassword as jest.Mock;
const reset = Keychain.resetGenericPassword as jest.Mock;

/** The vault key the app lock now reads (001 T028) - any 32 bytes do for the options under test. */
const KEY = new Uint8Array(32).fill(7);

beforeEach(() => {
  get.mockClear();
  set.mockClear();
});

describe('gated Keychain reads', () => {
  it('the backup passphrase can be unlocked with the device passcode', async () => {
    await backupSecretStore.save('FKPX-9WQ2-7TDM-4RJH-2CVB', 'unlock');
    await backupSecretStore.reveal('unlock');

    const options = get.mock.calls.at(-1)?.[0] ?? {};
    expect(PASSCODE_ALLOWED).toContain(options.accessControl);
  });

  it('the app lock can be opened with the device passcode', async () => {
    const storage = new KeychainVaultKeyStorage();
    await storage.writeGated(KEY, 'unlock');
    expect(await storage.readGated('unlock')).toEqual(KEY);

    const options = get.mock.calls.at(-1)?.[0] ?? {};
    expect(PASSCODE_ALLOWED).toContain(options.accessControl);
    expect(options.authenticationPrompt?.title).toBe('unlock');
  });

  it('stores the gated copy behind the gate the read asks for', async () => {
    await backupSecretStore.save('FKPX-9WQ2-7TDM-4RJH-2CVB', 'unlock');
    await new KeychainVaultKeyStorage().writeGated(KEY, 'unlock');

    const gated = set.mock.calls.filter(
      call => !String(call[2]?.service ?? '').endsWith('.use'),
    );
    expect(gated.length).toBeGreaterThan(0);
    for (const call of gated) {
      expect(PASSCODE_ALLOWED).toContain(call[2]?.accessControl);
    }
  });

  it('keeps a SECOND, ungated copy of the backup passphrase - and only of that', async () => {
    // The two-copy design (006 FR-017). Backups happen on their own after a sync, and a backup that
    // stopped to ask for a fingerprint is a backup nobody keeps switched on. The ungated copy sits at
    // exactly the protection level the DATABASE key already has - Keychain, device unlocked, this
    // device only - which is the honest bar: whoever can read it can already read the archive.
    //
    // The gated copy still exists, and guards the different act: showing the secret to whoever is
    // holding the phone.
    set.mockClear();
    await backupSecretStore.save('FKPX-9WQ2-7TDM-4RJH-2CVB', 'unlock');

    const ungated = set.mock.calls.filter(
      call => String(call[2]?.service ?? '').endsWith('.use'),
    );
    expect(ungated).toHaveLength(1);
    expect(ungated[0][2]?.accessControl).toBeUndefined();
    expect(ungated[0][2]?.accessible).toBe(
      Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    );

    // …and the vault key gets no such copy while the lock is on: its ungated item exists only while
    // the lock is OFF, and switching it on deletes it (vaultKey.test.ts).
    set.mockClear();
    await new KeychainVaultKeyStorage().writeGated(KEY, 'unlock');
    expect(
      set.mock.calls.filter(call => String(call[2]?.service ?? '').endsWith('.use')),
    ).toEqual([]);
  });

  it('keeps the lock-off copy of the vault key ungated, device-only and silent', async () => {
    set.mockClear();
    get.mockClear();
    const storage = new KeychainVaultKeyStorage();
    await storage.writePlain(KEY);
    expect(await storage.readPlain()).toEqual(KEY);

    const write = set.mock.calls.at(-1)?.[2] ?? {};
    expect(write.accessControl).toBeUndefined();
    expect(write.accessible).toBe(Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY);
    expect(get.mock.calls.at(-1)?.[0]?.authenticationPrompt).toBeUndefined();
  });

  // react-native-keychain on an Android phone with no screen lock picks an unauthenticated storage
  // instead of failing. An app lock written there would open without asking anybody. Both of the
  // library's unauthenticated storages count: in 10.0.0 AES-CBC and AES-GCM-no-auth tie in its
  // fallback, and which one wins is a HashMap's iteration order. AES-CBC is spelled as the string
  // the native side reports, because its enum member is deprecated - not because it cannot come back.
  it.each([
    ['AES-GCM without authentication', Keychain.STORAGE_TYPE.AES_GCM_NO_AUTH],
    ['AES-CBC', 'KeystoreAESCBC' as Keychain.STORAGE_TYPE],
  ])('refuses a gated write the OS silently stored without a gate (%s)', async (_, storage) => {
    set.mockResolvedValueOnce({ service: 'cz.obalka.vault.key.gated', storage });
    reset.mockClear();
    await expect(
      new KeychainVaultKeyStorage().writeGated(KEY, 'unlock'),
    ).rejects.toBeInstanceOf(NoScreenLockError);
    expect(reset.mock.calls.at(-1)?.[0]?.service).toBe('cz.obalka.vault.key.gated');
  });

  it('keeps a gated write the OS stored behind authentication', async () => {
    set.mockResolvedValueOnce({
      service: 'cz.obalka.vault.key.gated',
      storage: Keychain.STORAGE_TYPE.AES_GCM,
    });
    reset.mockClear();
    await new KeychainVaultKeyStorage().writeGated(KEY, 'unlock');
    expect(reset).not.toHaveBeenCalled();
  });

  it('reads the app-usable copy without a prompt', async () => {
    await backupSecretStore.save('FKPX-9WQ2-7TDM-4RJH-2CVB', 'unlock');
    get.mockClear();

    await backupSecretStore.forUse();

    const options = get.mock.calls.at(-1)?.[0] ?? {};
    expect(String(options.service)).toMatch(/\.use$/);
    expect(options.authenticationPrompt).toBeUndefined();
  });

  it('names its own prompt - Android asks on the write too, and would use an English default', async () => {
    await backupSecretStore.save('FKPX-9WQ2-7TDM-4RJH-2CVB', 'Uložit heslo k záloze');

    expect(set.mock.calls.at(-1)?.[2]?.authenticationPrompt?.title).toBe(
      'Uložit heslo k záloze',
    );
  });
});

describe('a declined prompt when storing the passphrase (2026-09-15)', () => {
  /** A rejection shaped the way react-native-keychain's native side shapes it. */
  function rejection(code: string, message: string): Error {
    return Object.assign(new Error(message), { code });
  }

  /** The ungated write succeeds; the gated one - the one with the prompt - rejects with `error`. */
  async function storeRejectedWith(error: Error): Promise<unknown> {
    set.mockResolvedValueOnce(true).mockRejectedValueOnce(error);
    return backupSecretStore.save('FKPX-9WQ2-7TDM-4RJH-2CVB', 'unlock').then(
      () => null,
      (e: unknown) => e,
    );
  }

  it('is a decline, typed as one, on both platforms', async () => {
    // A transfer reported every refusal as a failed restore, so the cancel button reached the failure
    // reports. The shapes are the library's own: Android puts BiometricPrompt's code in the message of
    // E_CRYPTO_FAILED (10 = the user cancelled, 13 = the negative button); iOS rejects with the OSStatus.
    for (const declined of [
      rejection('E_CRYPTO_FAILED', 'code: 10, msg: Authentication canceled by user.'),
      rejection('E_CRYPTO_FAILED', 'code: 13, msg: Zrušit'),
      rejection('-128', 'User canceled the operation.'),
    ]) {
      expect(isPromptDeclined(declined)).toBe(true);
      expect(await storeRejectedWith(declined)).toBeInstanceOf(BackupPromptDeclinedError);
    }
  });

  it('stays the failure it is when the store itself broke, or the system withdrew the prompt', async () => {
    for (const failed of [
      rejection('E_CRYPTO_FAILED', 'code: 5, msg: Canceled'),
      rejection('E_CRYPTO_FAILED', 'code: 7, msg: Too many attempts. Try again later.'),
      rejection('E_CRYPTO_FAILED', 'Wrapped error: Key permanently invalidated'),
      rejection('-25300', 'The specified item could not be found in the keychain.'),
    ]) {
      expect(isPromptDeclined(failed)).toBe(false);
      expect(await storeRejectedWith(failed)).toBe(failed);
    }
    expect(isPromptDeclined('code: 10')).toBe(false);
  });
});
