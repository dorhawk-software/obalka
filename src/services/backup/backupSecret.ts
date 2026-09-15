// Where the backup passphrase lives (006 FR-013).
//
// The user asked for it to be viewable later, the way a banking app reveals a card PIN. That is a
// STORAGE decision, not an authentication one: the passphrase goes into the Keychain behind
// `BIOMETRY_ANY_OR_DEVICE_PASSCODE`, so reading it makes the OS show the prompt. No custom gate, no
// timer to get wrong, no way to accidentally show it without the check - the same trick
// `keychainAppLock.ts` already uses, and the reason there is no new native module here.
//
// It is stored at all - rather than shown once and forgotten - because a recovery key nobody can
// look up is one that gets photographed, or lost while the phone still works. The device copy costs
// nothing security-wise: anyone who can pass the biometric prompt on an unlocked phone can already
// read the archive itself.

import * as Keychain from 'react-native-keychain';
import { reportFailure } from '../telemetry/telemetry';

/** The copy behind the OS gate. Read only to SHOW the passphrase to a person (FR-013). */
const SERVICE = 'cz.obalka.backupkey';

/**
 * The copy the app itself uses, with no gate.
 *
 * Needed the moment backups became automatic: a backup that happens because a sync brought a new
 * message cannot stop to ask for a fingerprint, and one that did would be a backup nobody keeps
 * enabled. It sits at exactly the protection level the DATABASE key already has - Keychain, device
 * unlocked, this device only - and that is the honest bar: anyone who can read this can already read
 * the archive it protects, because the same store holds the key to the archive itself.
 *
 * The gated copy is not redundant. It guards a different act: showing a secret to whoever is holding
 * the phone, which is the thing a shoulder-surfer or a borrowed phone actually threatens.
 */
const USE_SERVICE = 'cz.obalka.backupkey.use';

/**
 * The person declined the screen-lock prompt that storing the passphrase raises on Android.
 *
 * Its own type so a caller can tell a decision from a fault (2026-09-15). A transfer that could not
 * keep the key that arrived reported every refusal as a failed restore, which put a person pressing
 * "cancel" into the failure reports beside a Keystore that had actually broken.
 */
export class BackupPromptDeclinedError extends Error {
  constructor() {
    super('The screen-lock prompt was declined.');
    this.name = 'BackupPromptDeclinedError';
  }
}

/**
 * Whether a Keychain rejection is the person declining the prompt, not the store failing.
 *
 * react-native-keychain has no cancel code of its own. On Android every prompt error arrives as
 * `E_CRYPTO_FAILED` with BiometricPrompt's own code in the message, "code: 10, msg: …": 10 is
 * ERROR_USER_CANCELED (back, or a tap outside the prompt) and 13 is ERROR_NEGATIVE_BUTTON. Everything
 * else stays a failure, 5 (ERROR_CANCELED, the SYSTEM withdrawing the prompt) and the lockouts
 * included. On iOS the rejection code is the OSStatus, and a cancel is errSecUserCanceled, -128.
 */
export function isPromptDeclined(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const code = (error as { code?: unknown }).code;
  if (code === '-128' || code === -128) {
    return true;
  }
  return /\bcode: (10|13)\b/.test(error.message);
}

export interface BackupSecretStore {
  /**
   * Whether this phone can hold the passphrase behind a gate at all.
   *
   * A Keystore/Keychain item that requires authentication cannot exist on a phone with no screen
   * lock, so `save()` would fail there - and the user would be told the backup failed, which says
   * nothing about the actual problem or its one-tap fix.
   */
  canProtect(): Promise<boolean>;
  /**
   * `promptTitle` is used on Android, which asks for the gate when STORING as well as when reading.
   * Rejects with `BackupPromptDeclinedError` when that prompt is declined.
   */
  save(passphrase: string, promptTitle: string): Promise<void>;
  /** Triggers the OS prompt. Returns null when there is none stored, or the user declined. */
  reveal(promptTitle: string): Promise<string | null>;
  /** The app's own copy - no prompt. For making a backup, never for showing one to a person. */
  forUse(): Promise<string | null>;
  has(): Promise<boolean>;
  clear(): Promise<void>;
}

export const backupSecretStore: BackupSecretStore = {
  async canProtect() {
    try {
      // `isPasscodeAuthAvailable` is the right question rather than `getSupportedBiometryType`: a
      // phone with a PIN and no fingerprint can hold the item perfectly well, and asking about
      // biometrics would refuse it for no reason.
      return await Keychain.isPasscodeAuthAvailable();
    } catch (e) {
      // `false` here means the whole backup feature quietly refuses to arm. A phone that CAN hold
      // the item but reports that it cannot is indistinguishable, to the user, from a phone with no
      // passcode - and they are told to go set one they already have.
      reportFailure('keychain.read', e, { stage: 'native' });
      return false;
    }
  },

  async save(passphrase, promptTitle) {
    // The ungated copy first: if the gated write is declined, the app is left able to make backups
    // but not to show the passphrase - which is recoverable. The reverse would leave a phone that can
    // show a key it cannot use.
    await Keychain.setGenericPassword('backup', passphrase, {
      service: USE_SERVICE,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    try {
      await Keychain.setGenericPassword('backup', passphrase, {
        service: SERVICE,
        accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE,
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        // Android asks on the WRITE too (the key requires authentication to use), so this needs our
        // words on it - without a title the OS shows the library's English default, which is the one
        // string in the flow the user did not choose a language for.
        authenticationPrompt: { title: promptTitle },
      });
    } catch (e) {
      throw isPromptDeclined(e) ? new BackupPromptDeclinedError() : e;
    }
  },

  async reveal(promptTitle) {
    try {
      const found = await Keychain.getGenericPassword({
        service: SERVICE,
        // `accessControl` is NOT remembered from the write - on Android the READ decides which
        // authenticators the prompt offers, and its default (NONE) asks for biometrics only. On a
        // phone with a PIN and no fingerprint that prompt cannot succeed: the OS answers "No
        // fingerprints enrolled" and the password becomes permanently unreadable. Repeating the
        // access control here is what lets the device passcode answer the prompt.
        accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE,
        authenticationPrompt: { title: promptTitle },
      });
      return found ? found.password : null;
    } catch {
      // A declined or failed prompt is a normal outcome, not an error to raise at the user.
      return null;
    }
  },

  async forUse() {
    try {
      const found = await Keychain.getGenericPassword({ service: USE_SERVICE });
      return found ? found.password : null;
    } catch (e) {
      // A null here sends the user to re-enter a passphrase they may not have written down. Worth
      // separating "there is no key" from "the keychain would not answer".
      reportFailure('keychain.read', e, { stage: 'native' });
      return null;
    }
  },

  /**
   * Whether a passphrase exists - WITHOUT prompting.
   *
   * The screen needs to know which state to render before the user has asked for anything, and
   * showing a biometric prompt merely because a settings screen opened would train people to approve
   * prompts they did not ask for.
   */
  async has() {
    // EITHER copy means backups are on. A phone that was set up before the app kept two would
    // otherwise report itself as "off" after an update, with its archives still sitting there -
    // which is a lie about the user's own data, and the kind that erodes trust in the whole feature.
    for (const service of [USE_SERVICE, SERVICE]) {
      try {
        if ((await Keychain.hasGenericPassword({ service })) === true) {
          return true;
        }
      } catch {
        // Try the other one.
      }
    }
    return false;
  },

  async clear() {
    for (const service of [SERVICE, USE_SERVICE]) {
      try {
        await Keychain.resetGenericPassword({ service });
      } catch {
        // Best effort, both copies: "turn it off" must not leave one of them behind.
      }
    }
  },
};
