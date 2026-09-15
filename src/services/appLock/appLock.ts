// App-lock contract (feature 001, User Story 2 and T028; constitution Principle III).
//
// The lock used to be a placeholder Keychain item behind the biometric gate: reading it made the OS
// prompt, and its value meant nothing. It gated the screen and nothing else - a box password stayed
// readable while the app sat locked. Since T028 the thing behind the gate is the vault key that seals
// every box secret, so unlocking the app and being able to read a password are the same act.
// `Vault` (`services/secureStore/vault.ts`) implements this; research R6b is the reasoning.

/**
 * How an unlock attempt ended. `failed` covers a cancel, a failed prompt and a Keychain error that has
 * not kept repeating; none of them changes a key. `keyUnreadable`: the key behind the gate has failed
 * to read on a Keychain error several times in a row, so "try again" alone would be a loop - the lock
 * screen says so and offers `resetKey`.
 */
export type UnlockResult = 'unlocked' | 'failed' | 'noScreenLock' | 'keyUnreadable';

/** How switching the lock on ended. */
export type EnableResult = 'enabled' | 'cancelled' | 'noScreenLock';

export interface AppLock {
  /** Can the device gate the app (a biometric is enrolled)? Drives whether the toggle is offerable. */
  isAvailable(): Promise<boolean>;
  /** Switch the lock on: the key goes behind the gate. One prompt. */
  enable(promptTitle: string): Promise<EnableResult>;
  /** Switch the lock off: the key goes back to the ungated item. No prompt; throws if it cannot. */
  disable(): Promise<void>;
  /** No box is left: delete the key and switch the lock off. Never throws. */
  forget(): Promise<void>;
  /** Unlock by reading the key - the one prompt. Never throws. */
  unlock(promptTitle: string): Promise<UnlockResult>;
  /**
   * After `keyUnreadable`, and only once the person has confirmed it: set the lock up again with a new
   * key, the way a key the phone invalidated is replaced - each box signs in again, the archive is
   * untouched. One prompt. Refused (`failed`, nothing changed) unless the unlocks before it really
   * ended `keyUnreadable`. Never throws.
   */
  resetKey(promptTitle: string): Promise<UnlockResult>;
  /** The app left the foreground: drop the key from memory. */
  lock(): void;
  /**
   * The lock is off but the key was found only behind the gate (a toggle can be interrupted) - one
   * unlock is needed to move it back. Not a restore: the lock setting stays on its phone, so no backup
   * or transfer brings it (`DEVICE_LOCAL_SETTINGS`).
   */
  needsRecovery(): boolean;
  /** Called whenever `needsRecovery` (or the key) may have changed. Returns the unsubscribe. */
  subscribe(listener: () => void): () => void;
}
