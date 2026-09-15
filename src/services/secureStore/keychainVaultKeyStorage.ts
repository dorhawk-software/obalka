// The vault key in the Keychain / Keystore (001 T028, research R6b).
//
// Two items, one key. `cz.obalka.vault.key` has no access control - it is used while the app lock is
// off. `cz.obalka.vault.key.gated` sits behind BIOMETRY_ANY_OR_DEVICE_PASSCODE - used while it is on,
// and reading it is the unlock. Both are `WHEN_UNLOCKED_THIS_DEVICE_ONLY`, like the database key.

import 'react-native-get-random-values';
import * as Keychain from 'react-native-keychain';
import { VAULT_KEY_BYTES } from './seal';
import {
  NoScreenLockError,
  VaultKeyUnreadableError,
  type VaultKeyStorage,
} from './vault';

const PLAIN_SERVICE = 'cz.obalka.vault.key';
const GATED_SERVICE = 'cz.obalka.vault.key.gated';
/** The placeholder the app lock read before the vault existed. Deleted once the vault takes over. */
const LEGACY_LOCK_SERVICE = 'cz.obalka.applock';
const USERNAME = 'vault';

function toHex(key: Uint8Array): string {
  return Array.from(key, b => b.toString(16).padStart(2, '0')).join('');
}

function fromHex(stored: string): Uint8Array {
  if (!new RegExp(`^[0-9a-f]{${VAULT_KEY_BYTES * 2}}$`).test(stored)) {
    throw new VaultKeyUnreadableError();
  }
  const out = new Uint8Array(VAULT_KEY_BYTES);
  for (let i = 0; i < VAULT_KEY_BYTES; i++) {
    out[i] = parseInt(stored.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/**
 * Android storages that carry no authentication.
 *
 * Asked for access control on a phone with no screen lock, react-native-keychain does not fail - it
 * picks the best storage that "works", which is the unauthenticated one, and reports it in the
 * result. An item that silently has no gate would make the app lock open without asking, so that
 * result is treated as the refusal it really is.
 */
const UNGATED_STORAGE: readonly string[] = [
  Keychain.STORAGE_TYPE.AES_GCM_NO_AUTH,
  // Recognised here, never chosen: nothing in this app passes a `storage` option, so this constant
  // decides no cipher for any write or read (a read decrypts with the cipher recorded beside the item,
  // KeychainModule.kt getGenericPassword). What it does is keep the refusal above complete - AES-CBC
  // has no authentication and ties with AES-GCM-no-auth in the library's fallback (001 T049).
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- deprecated as a storage to WRITE with; this only recognises a write the library may still report as AES-CBC, and dropping it would let that ungated write pass as the app lock
  Keychain.STORAGE_TYPE.AES_CBC,
];

export class KeychainVaultKeyStorage implements VaultKeyStorage {
  async readPlain(): Promise<Uint8Array | null> {
    const found = await Keychain.getGenericPassword({ service: PLAIN_SERVICE });
    return found ? fromHex(found.password) : null;
  }

  async writePlain(key: Uint8Array): Promise<void> {
    const result = await Keychain.setGenericPassword(USERNAME, toHex(key), {
      service: PLAIN_SERVICE,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    if (result === false) {
      throw new Error('The Keychain did not store the vault key.');
    }
  }

  async deletePlain(): Promise<void> {
    await Keychain.resetGenericPassword({ service: PLAIN_SERVICE });
  }

  hasPlain(): Promise<boolean> {
    return Keychain.hasGenericPassword({ service: PLAIN_SERVICE });
  }

  async readGated(promptTitle: string): Promise<Uint8Array | null> {
    const found = await Keychain.getGenericPassword({
      service: GATED_SERVICE,
      // Repeated on the read deliberately: Android takes the allowed authenticators from THIS call,
      // not from what was stored, and its default asks for biometrics alone - a phone with a PIN and
      // no fingerprint would be shut out of its own app lock (`keychainPrompts.test.ts`).
      accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE,
      authenticationPrompt: { title: promptTitle },
    });
    return found ? fromHex(found.password) : null;
  }

  async writeGated(key: Uint8Array, promptTitle: string): Promise<void> {
    const result = await Keychain.setGenericPassword(USERNAME, toHex(key), {
      service: GATED_SERVICE,
      accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      // Android asks on the WRITE too (the Keystore key requires authentication), so it gets our
      // words rather than the library's English default.
      authenticationPrompt: { title: promptTitle },
    });
    if (result === false) {
      throw new Error('The Keychain did not store the gated vault key.');
    }
    if (typeof result === 'object' && UNGATED_STORAGE.includes(result.storage)) {
      await Keychain.resetGenericPassword({ service: GATED_SERVICE });
      throw new NoScreenLockError();
    }
  }

  async deleteGated(): Promise<void> {
    await Keychain.resetGenericPassword({ service: GATED_SERVICE });
  }

  hasGated(): Promise<boolean> {
    // No prompt on either platform: iOS asks with authentication UI disabled, Android only looks for
    // the stored entry.
    return Keychain.hasGenericPassword({ service: GATED_SERVICE });
  }

  canGate(): Promise<boolean> {
    // The passcode, not biometrics: a phone with a PIN and no fingerprint holds a gated item fine.
    return Keychain.isPasscodeAuthAvailable();
  }

  async canUseBiometrics(): Promise<boolean> {
    return (await Keychain.getSupportedBiometryType()) != null;
  }

  async removeLegacyToken(): Promise<void> {
    await Keychain.resetGenericPassword({ service: LEGACY_LOCK_SERVICE });
  }
}
