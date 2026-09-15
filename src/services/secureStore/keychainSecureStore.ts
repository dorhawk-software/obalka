// Box secret items in the Keychain / Keystore (feature 001, T008 and T028; constitution Principle III).
//
// One item per box per secret, keyed by service (`vaultSecureStore.ts` names them). Stored device-only
// and non-synced, with no access control of their own: what they hold is a seal, and the key that
// opens it is what sits behind the biometric gate while the app lock is on (research R6b). Gating
// each item instead would put a fingerprint prompt in front of every WS call.

import * as Keychain from 'react-native-keychain';
import type { SecretItems } from './vaultSecureStore';

/** The Keychain account name. The service is what identifies an item; this is not a secret. */
const USERNAME = 'obalka';

export class KeychainSecretItems implements SecretItems {
  async get(service: string): Promise<string | null> {
    const found = await Keychain.getGenericPassword({ service });
    return found ? found.password : null;
  }

  async set(service: string, value: string): Promise<void> {
    const result = await Keychain.setGenericPassword(USERNAME, value, {
      service,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    if (result === false) {
      throw new Error('The Keychain did not store the item.');
    }
  }

  async remove(service: string): Promise<void> {
    await Keychain.resetGenericPassword({ service });
  }
}
