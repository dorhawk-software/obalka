// The vault key (001 T028, research R6b).
//
// One random 256-bit key seals every box password and session cookie (`seal.ts`). Where that key is
// kept is the whole of the app lock's strength:
//
// - lock OFF - a Keychain item with no access control, readable whenever the phone is unlocked, which
//   is exactly what a plain password item was before the vault existed;
// - lock ON - the same key behind BIOMETRY_ANY_OR_DEVICE_PASSCODE. Reading it is the unlock, the one
//   prompt users already get, and the key lives in memory only until the app goes to the background.
//
// Toggling moves the key and nothing else; no sealed secret is ever re-encrypted.
//
// The rule this file exists to keep: **never a second key.** Every stored secret is sealed under one
// key, and a new one silently generated beside it - because a read was cancelled, because the Keychain
// hiccupped, because two reads raced - would make all of them unreadable at once. So a key is generated
// only when no key item exists at all, or when the existing one is proven permanently unreadable
// (`isPermanentKeyLoss`), and generation is serialised and read back before anything uses it.
//
// Platform-free: the Keychain sits behind `VaultKeyStorage` (`keychainVaultKeyStorage.ts` on a phone,
// `InMemoryVaultKeyStorage` in tests), and the lock setting behind two functions.

import { VAULT_KEY_BYTES } from './seal';
import { reportFailure } from '../telemetry/telemetry';
import type { AppLock, EnableResult, UnlockResult } from '../appLock/appLock';

/** Where the vault key is kept. Every method may throw; the vault decides what a throw means. */
export interface VaultKeyStorage {
  /** The ungated copy, or null when there is none. Throws `VaultKeyUnreadableError` for a non-key. */
  readPlain(): Promise<Uint8Array | null>;
  writePlain(key: Uint8Array): Promise<void>;
  deletePlain(): Promise<void>;
  hasPlain(): Promise<boolean>;
  /**
   * The gated copy, or null when there is none. Shows the OS prompt; a cancel or a failed prompt
   * THROWS, so "not there" and "not allowed" can never be confused.
   */
  readGated(promptTitle: string): Promise<Uint8Array | null>;
  /** Throws `NoScreenLockError` when the OS would store it without a gate. May prompt (Android). */
  writeGated(key: Uint8Array, promptTitle: string): Promise<void>;
  deleteGated(): Promise<void>;
  /** Whether a gated copy exists - without prompting. */
  hasGated(): Promise<boolean>;
  /** Whether the phone has a screen lock, without which no gated item can exist. */
  canGate(): Promise<boolean>;
  /** Whether a biometric is enrolled - what decides if the Settings row offers the lock at all. */
  canUseBiometrics(): Promise<boolean>;
  /** Delete the placeholder item the app lock used before the vault (`cz.obalka.applock`). */
  removeLegacyToken(): Promise<void>;
}

/** The persisted app-lock switch (`app_settings.appLock`), which is the truth the key's place follows. */
export interface LockSetting {
  read(): Promise<boolean>;
  write(on: boolean): Promise<void>;
}

export interface VaultDeps {
  storage: VaultKeyStorage;
  lockSetting: LockSetting;
  randomBytes?: (n: number) => Uint8Array;
}

/** A stored vault-key value that is not a key. It can never become one, so it counts as lost. */
export class VaultKeyUnreadableError extends Error {
  constructor(message = 'The stored vault key is not a key.') {
    super(message);
    this.name = 'VaultKeyUnreadableError';
  }
}

/** The OS would have stored the key without a gate - the phone has no screen lock. */
export class NoScreenLockError extends Error {
  constructor(message = 'This phone cannot hold an item behind a screen lock.') {
    super(message);
    this.name = 'NoScreenLockError';
  }
}

/**
 * No key could be had for this operation: it was aborted while the app was locked, or the Keychain
 * failed. NOT "there is no password" - a caller must never turn this into a re-authentication.
 */
export class VaultUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VaultUnavailableError';
  }
}

/**
 * Whether a failed read of the key proves it can never be read again.
 *
 * Only then may a new key take its place. The words are the platforms' own, and they are the only
 * signal there is: react-native-keychain reports every Android failure as `E_CRYPTO_FAILED` and
 * keeps the cause in the message - `KeyPermanentlyInvalidatedException` ("Key permanently
 * invalidated", raised once the screen lock is removed) and a failed authentication tag (the library
 * deleting and regenerating a key it could not recover, after which the stored bytes cannot open).
 * A cancel ("code: 13, …"), a lockout, a missing activity or an iOS `errSecUserCanceled` are all
 * temporary and match nothing here. An iOS item invalidated with the passcode is deleted by the
 * system, which the vault sees as "no key", not as an error.
 */
export function isPermanentKeyLoss(error: unknown): boolean {
  if (error instanceof VaultKeyUnreadableError) {
    return true;
  }
  const message =
    error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  return /permanently invalidated|authentication tag verification failed/i.test(message);
}

/**
 * Unlocks in a row that may fail on a Keychain error before the lock screen offers to set the lock up
 * again (`keyUnreadable`). More than one, because a Keychain can fail once and answer the next time;
 * few, because every try until then is a prompt that leads nowhere.
 */
export const UNREADABLE_AFTER_FAILURES = 3;

/**
 * Whether a failed read of the gated key is the prompt's own outcome - the person cancelled, did not
 * match, or is locked out for a while - rather than the Keychain failing.
 *
 * Those prove nothing about the key, so they never count towards `keyUnreadable`. Counting them would
 * also let anyone holding the phone reach the reset offer just by cancelling, and a reset replaces the
 * owner's key. The words are the platforms' own: react-native-keychain reports an Android
 * BiometricPrompt error as "code: N, msg: ..." - 3 a timeout, 5 cancelled by the system, 7 a lockout, 9
 * biometrics locked out until the passcode is used, 10 cancelled by the person, 13 the cancel button -
 * and "Not assigned current activity" when there is no screen to prompt over; iOS rejects with the
 * text of errSecUserCanceled, errSecAuthFailed or errSecInteractionNotAllowed.
 */
export function isPromptOutcome(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  return (
    /\bcode: (3|5|7|9|10|13), msg:/.test(message) ||
    /User canceled the operation|passphrase you entered is not correct|User interaction is not allowed|Not assigned current activity/i.test(
      message,
    )
  );
}

/**
 * Whether a failed read of the gated key is any error of Android's BiometricPrompt - the "code: N,
 * msg: ..." react-native-keychain builds in `onAuthenticationError`, which is the only place that shape
 * comes from. Besides the person's own answers (`isPromptOutcome`) that is the sensor unavailable (1),
 * unable to process (2), out of space (4), a vendor error (8), nothing enrolled (11), no hardware (12)
 * or a security update required (15).
 *
 * None of them is about the key. The prompt failed, and a new key is read through the very same prompt
 * - on Android it is asked on the gated write already - so with the lock on a reset would delete the
 * owner's key and then fail exactly where the old read did, leaving every box to sign in again for
 * nothing. With the lock off the reset takes an ungated key and asks nothing, so there they still count.
 */
export function isBiometricPromptError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  return /\bcode: \d+, msg:/.test(message);
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

function platformRandomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  globalThis.crypto.getRandomValues(out);
  return out;
}

export class Vault implements AppLock {
  private key: Uint8Array | null = null;
  /** The lock setting as last read or written; null until the first read. */
  private lockOn: boolean | null = null;
  private lockOnRead: Promise<boolean> | null = null;
  /** Lock off, but the key is found only behind the gate: one unlock is needed to move it back. */
  private recovering = false;
  /**
   * Unlocks in a row whose read of the gated key failed on a Keychain error - not a proven loss, not
   * the prompt's own outcome. Reaching `UNREADABLE_AFTER_FAILURES` is what lets `resetKey` act.
   */
  private unreadableReads = 0;
  /** Counts `lock()` calls, so an unlock whose prompt was still out when the app locked keeps nothing. */
  private lockEpoch = 0;
  /** Bumped on every change a waiting read or the lock screen could care about. */
  private version = 0;
  private queue: Promise<unknown> = Promise.resolve();
  private readonly waiters = new Set<() => void>();
  private readonly listeners = new Set<() => void>();
  private readonly randomBytes: (n: number) => Uint8Array;

  constructor(private readonly deps: VaultDeps) {
    this.randomBytes = deps.randomBytes ?? platformRandomBytes;
  }

  // --- For sealing and opening -------------------------------------------------------------------

  /**
   * A copy of the key for ONE operation, which should zero it when done.
   *
   * Never prompts. While the app is locked it WAITS for the unlock rather than answering - a read
   * that answered "nothing" here would send a box to re-authentication for having been asked while
   * the phone was in a pocket. Rejects with `VaultUnavailableError` when `signal` aborts first or the
   * Keychain fails; never with anything that could be read as "no password".
   *
   * A copy, because `lock()` zeroes the held key: an operation that already has its key finishes
   * with it instead of sealing under a buffer that was wiped halfway through.
   */
  async useKey(signal?: AbortSignal): Promise<Uint8Array> {
    for (;;) {
      if (signal?.aborted) {
        throw new VaultUnavailableError('Aborted while waiting for the vault key.');
      }
      if (this.key) {
        return this.key.slice();
      }
      const seen = this.version;
      let on: boolean;
      try {
        on = await this.isLockOn();
      } catch (e) {
        throw new VaultUnavailableError(`The app-lock setting could not be read: ${String(e)}`);
      }
      if (!on && !this.recovering) {
        let outcome: 'ready' | 'recovery';
        try {
          outcome = await this.exclusive(() => this.acquireWithoutPrompt());
        } catch (e) {
          reportFailure('keychain.read', e, { stage: 'native' });
          throw new VaultUnavailableError(`The vault key could not be read: ${String(e)}`);
        }
        if (outcome === 'ready') {
          continue;
        }
        this.setRecovering(true);
        continue;
      }
      await this.waitForChange(seen, signal);
    }
  }

  // --- AppLock -----------------------------------------------------------------------------------

  async isAvailable(): Promise<boolean> {
    try {
      return await this.deps.storage.canUseBiometrics();
    } catch (e) {
      // `false` here hides the App-lock row entirely. A phone that HAS biometrics and reports that
      // it does not is indistinguishable, to the user, from a phone that has none.
      reportFailure('appLock.arm', e, { stage: 'native' });
      return false;
    }
  }

  /**
   * Put the key behind the gate and switch the lock on. One prompt on either platform: Android asks
   * on the gated write and the read-back falls inside the key's 5-second window; iOS writes silently
   * and asks on the read-back. The read-back is not ceremony - it is what proves the phone can open
   * what it just locked, before the ungated copy is deleted.
   */
  enable(promptTitle: string): Promise<EnableResult> {
    return this.exclusive(async () => {
      const { storage } = this.deps;
      try {
        if (await this.isLockOn()) {
          return 'enabled';
        }
        if (!(await storage.canGate())) {
          return 'noScreenLock';
        }
        if (!this.key && (await this.acquireWithoutPrompt()) === 'recovery') {
          // The key is already behind the gate (a restored setting, an unfinished toggle). Read it;
          // never write a different one over it.
          let found: Uint8Array | null = null;
          try {
            found = await storage.readGated(promptTitle);
          } catch (e) {
            if (!isPermanentKeyLoss(e)) {
              return 'cancelled';
            }
            reportFailure('appLock.authenticate', e, { stage: 'crypto' });
            await storage.deleteGated();
          }
          if (found) {
            await this.deps.lockSetting.write(true);
            this.lockOn = true;
            this.setKey(found);
            this.setRecovering(false);
            return 'enabled';
          }
          await this.acquireWithoutPrompt();
        }
        const key = (this.key as Uint8Array).slice();
        const gated = await this.gate(key, promptTitle);
        if (gated !== 'ok') {
          // A copy the read-back never confirmed. The key is still in the ungated item, and a lock
          // that stays off should not leave a gated twin behind it.
          await storage.deleteGated();
          return gated === 'noScreenLock' ? 'noScreenLock' : 'cancelled';
        }
        // The setting before the delete: a crash between them leaves both copies, and whichever way
        // the setting reads on the next launch has a key it can use without a surprise prompt.
        await this.deps.lockSetting.write(true);
        this.lockOn = true;
        await storage.deletePlain();
        await this.removeLegacyToken();
        this.changed();
        return 'enabled';
      } catch (e) {
        reportFailure('appLock.arm', e, { stage: 'native' });
        return 'cancelled';
      }
    });
  }

  /**
   * Move the key back to the ungated item and switch the lock off. No prompt: the Settings screen is
   * behind the lock, so the key is in memory. Throws when it is not, or when the Keychain refuses -
   * and then the lock stays on, which is the safe way to fail.
   */
  disable(): Promise<void> {
    return this.exclusive(async () => {
      const { storage } = this.deps;
      if (!(await this.isLockOn())) {
        return;
      }
      if (!this.key) {
        throw new VaultUnavailableError('The app is locked; the lock cannot be switched off now.');
      }
      const key = this.key.slice();
      await storage.writePlain(key);
      const back = await storage.readPlain();
      if (!back || !sameBytes(back, key)) {
        throw new Error('The vault key did not read back from the ungated item.');
      }
      await this.deps.lockSetting.write(false);
      this.lockOn = false;
      await storage.deleteGated();
      await this.removeLegacyToken();
      this.changed();
    });
  }

  /**
   * No box is left: delete the key in both places and switch the lock off (001 T037).
   *
   * Every sealed secret belonged to a box, and each went with its box, so there is nothing left for
   * the key to open - and a phone with no boxes is how it is handed to someone else. The next box
   * starts a fresh key. Never throws: each step runs even when an earlier one fails, because a lock
   * reset that stopped halfway would keep the previous owner's gate in front of the Welcome screen.
   */
  forget(): Promise<void> {
    return this.exclusive(async () => {
      this.clearKey();
      const { storage } = this.deps;
      const steps: (() => Promise<void>)[] = [
        () => storage.deletePlain(),
        () => storage.deleteGated(),
        () => storage.removeLegacyToken(),
        () => this.deps.lockSetting.write(false),
      ];
      for (const step of steps) {
        try {
          await step();
        } catch (e) {
          reportFailure('appLock.arm', e, { stage: 'native' });
        }
      }
      this.lockOn = false;
      this.recovering = false;
      this.unreadableReads = 0;
      this.changed();
    });
  }

  /**
   * The phone holds no box at all and the lock is off: delete any key left over.
   *
   * Keychain items outlive an iOS reinstall while the database does not, so a fresh install can find
   * the previous one's key - behind the gate, where the lock-off app could reach it only through a
   * surprise unlock. With no box, no secret the app could look up depends on it. With the lock on
   * this does nothing: the lock screen is in charge of the key then.
   */
  discardIfLockOff(): Promise<void> {
    return this.exclusive(async () => {
      if (await this.isLockOn()) {
        return;
      }
      const { storage } = this.deps;
      this.clearKey();
      await storage.deletePlain();
      await storage.deleteGated();
      await this.removeLegacyToken();
      this.recovering = false;
      this.unreadableReads = 0;
      this.changed();
    });
  }

  /**
   * Unlock the app by reading the key - the one prompt. Resolves `failed` for a cancel or a failed
   * prompt (never a new key), `noScreenLock` when the phone cannot show a gate at all, and
   * `keyUnreadable` once the key behind the gate has kept failing to read on a Keychain error.
   */
  unlock(promptTitle: string): Promise<UnlockResult> {
    // Taken at the call, not when the queue reaches it: a lock that lands anywhere after the user
    // asked to unlock belongs to a later moment than this attempt.
    const epoch = this.lockEpoch;
    return this.exclusive(async () => {
      try {
        return await this.unlockInner(promptTitle, epoch);
      } catch (e) {
        reportFailure('appLock.authenticate', e, { stage: 'native' });
        return 'failed';
      }
    });
  }

  /**
   * Set the lock up again with a new key - after the key behind the gate kept failing to read
   * (`keyUnreadable`) and the person confirmed it on the lock screen.
   *
   * The path a key the phone invalidated takes: the gated item is deleted, and `unlockInner` then
   * finds no key behind the gate. With the lock on it puts a new one there, and reading that back is
   * the one prompt; with it off it takes the ungated key or makes one, without a prompt. Every seal
   * the old key made then reads as lost - each box signs in again, `VaultLostNotice` says why, and the
   * archive is not touched. An ungated copy of the key, if a toggle left one, is used rather than
   * replaced, and then nothing is lost.
   *
   * Refused - `failed`, nothing deleted - unless the unlocks before it really ended `keyUnreadable`,
   * which a cancelled prompt never counts towards and any key in hand resets (`setKey`).
   */
  resetKey(promptTitle: string): Promise<UnlockResult> {
    const epoch = this.lockEpoch;
    return this.exclusive(async () => {
      if (this.unreadableReads < UNREADABLE_AFTER_FAILURES) {
        return 'failed';
      }
      const { storage } = this.deps;
      try {
        if ((await this.isLockOn()) && !(await storage.canGate())) {
          return 'noScreenLock'; // nothing could go behind a gate now, so the old item stays
        }
        await storage.deleteGated();
        this.unreadableReads = 0;
        return await this.unlockInner(promptTitle, epoch);
      } catch (e) {
        reportFailure('appLock.authenticate', e, { stage: 'native' });
        return 'failed';
      }
    });
  }

  /**
   * The app went to the background: drop the key. With the lock off there is nothing to drop - the
   * key is exactly as readable as its Keychain item.
   */
  lock(): void {
    if (this.lockOn === false) {
      return;
    }
    // Counted even with no key held. A caller can lock while a prompt is still out, and that prompt's
    // read then resolves AFTER this call - holding the key in memory behind a lock screen that is up
    // again, until the next unlock. `unlockInner` checks the count before it keeps a key. (The
    // LockGate itself holds its lock while an unlock is out, because the phone's own passcode screen
    // backgrounds the app on older Android, and decides by whether the app comes back.)
    this.lockEpoch += 1;
    if (!this.key) {
      return;
    }
    this.clearKey();
    this.changed();
  }

  needsRecovery(): boolean {
    return this.recovering;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  // --- Internals ---------------------------------------------------------------------------------

  private async unlockInner(promptTitle: string, epoch: number): Promise<UnlockResult> {
    const { storage } = this.deps;
    const on = await this.isLockOn();
    if (this.key && !this.recovering) {
      return 'unlocked';
    }
    if (!on && !this.recovering) {
      if ((await this.acquireWithoutPrompt()) === 'ready') {
        return 'unlocked';
      }
      this.setRecovering(true);
    }

    // 1. A key behind the gate: reading it IS the unlock.
    if (await storage.hasGated()) {
      let found: Uint8Array | null = null;
      try {
        found = await storage.readGated(promptTitle);
      } catch (e) {
        if (!isPermanentKeyLoss(e)) {
          // Never a reason for a new key on its own.
          if (!(await storage.canGate())) {
            return 'noScreenLock';
          }
          if (isPromptOutcome(e)) {
            return 'failed'; // a cancel, a failed fingerprint, a lockout
          }
          if (on && isBiometricPromptError(e)) {
            return 'failed'; // the prompt itself failing, which a new key could not get past either
          }
          // The Keychain failing rather than the person. One that keeps failing would leave the lock
          // screen saying "try again" for ever, so after a few in a row the person is told, and may
          // choose to set the lock up again (`resetKey`).
          reportFailure('appLock.authenticate', e, { stage: 'native' });
          this.unreadableReads += 1;
          return this.unreadableReads >= UNREADABLE_AFTER_FAILURES ? 'keyUnreadable' : 'failed';
        }
        reportFailure('appLock.authenticate', e, { stage: 'crypto' });
        await storage.deleteGated();
      }
      if (found) {
        if (on) {
          if (await storage.hasPlain()) {
            await storage.deletePlain(); // left by a toggle that did not finish; the setting says on
          }
        } else {
          await storage.writePlain(found);
          const back = await storage.readPlain();
          if (!back || !sameBytes(back, found)) {
            throw new Error('The vault key did not read back from the ungated item.');
          }
          await storage.deleteGated();
        }
        await this.removeLegacyToken();
        if (epoch !== this.lockEpoch) {
          // The app locked while the prompt was out. The key stays where it is stored; it is simply
          // not held, and the lock screen asks again when the app returns.
          found.fill(0);
          return 'failed';
        }
        this.setKey(found);
        this.setRecovering(false);
        return 'unlocked';
      }
    }

    if (!on) {
      // Lock off and nothing readable behind the gate after all: no prompt was needed.
      this.setRecovering(false);
      await this.acquireWithoutPrompt();
      return 'unlocked';
    }

    // 2. Lock on and no key behind the gate - the first unlock after this update, a restored setting,
    //    or a key the phone invalidated. Put one there; reading it back is the unlock.
    if (!(await storage.canGate())) {
      return 'noScreenLock';
    }
    const plain = await this.readPlainOrDiscard();
    const key = plain ?? this.randomBytes(VAULT_KEY_BYTES);
    const gated = await this.gate(key, promptTitle);
    if (gated !== 'ok') {
      return gated;
    }
    if (plain) {
      await storage.deletePlain();
    }
    await this.removeLegacyToken();
    if (epoch !== this.lockEpoch) {
      key.fill(0); // behind the gate now, and read from there by the next unlock
      return 'failed';
    }
    this.setKey(key);
    return 'unlocked';
  }

  /**
   * The key without a prompt, for the lock-off case. `recovery` when the only key is behind the gate:
   * one exists, so generating another here is exactly what must never happen.
   */
  private async acquireWithoutPrompt(): Promise<'ready' | 'recovery'> {
    if (this.key) {
      return 'ready';
    }
    const { storage } = this.deps;
    const plain = await this.readPlainOrDiscard();
    if (plain) {
      if (await storage.hasGated()) {
        // Left by a toggle that did not finish. The setting says off, and the same key is right here.
        await storage.deleteGated();
      }
      this.setKey(plain);
      return 'ready';
    }
    if (await storage.hasGated()) {
      return 'recovery';
    }
    const fresh = this.randomBytes(VAULT_KEY_BYTES);
    await storage.writePlain(fresh);
    // Read back before anything is sealed under it: a key that was never persisted would take every
    // secret sealed in this session with it at the next launch.
    const back = await storage.readPlain();
    if (!back || !sameBytes(back, fresh)) {
      throw new Error('A new vault key did not read back after it was written.');
    }
    this.setKey(fresh);
    return 'ready';
  }

  /** Write `key` behind the gate and read it back. */
  private async gate(
    key: Uint8Array,
    promptTitle: string,
  ): Promise<'ok' | 'failed' | 'noScreenLock'> {
    const { storage } = this.deps;
    try {
      await storage.writeGated(key, promptTitle);
    } catch (e) {
      if (e instanceof NoScreenLockError) {
        return 'noScreenLock';
      }
      return 'failed'; // Android asks on the write; a cancel there changed nothing
    }
    let back: Uint8Array | null;
    try {
      back = await storage.readGated(promptTitle);
    } catch {
      // The gated copy stays: it holds this very key, and the next attempt simply reads it.
      return 'failed';
    }
    if (!back || !sameBytes(back, key)) {
      reportFailure('keychain.write', new Error('The gated vault key did not read back.'), {
        stage: 'native',
      });
      await storage.deleteGated();
      return 'failed';
    }
    return 'ok';
  }

  private async readPlainOrDiscard(): Promise<Uint8Array | null> {
    try {
      return await this.deps.storage.readPlain();
    } catch (e) {
      // A Keychain error is not a missing key - except one that proves the stored key can never be
      // read. On Android the ungated item is an entry in the library's preferences, encrypted under
      // a Keystore key of its own, and the two can part: a Keystore wiped while the entry survives.
      // react-native-keychain then quietly generates a NEW Keystore key under the same alias
      // (`CipherStorageBase.extractGeneratedKey`) and the old entry fails its authentication tag on
      // every read after that. Rethrown, that read answered "unavailable" for ever and no box was
      // ever asked to sign in again; it is the same loss as a gated key the phone invalidated.
      if (!isPermanentKeyLoss(e)) {
        throw e;
      }
      reportFailure('keychain.read', e, { stage: 'crypto' });
      await this.deps.storage.deletePlain();
      return null;
    }
  }

  private async removeLegacyToken(): Promise<void> {
    try {
      await this.deps.storage.removeLegacyToken();
    } catch (e) {
      // A leftover placeholder protects nothing and unlocks nothing; not worth failing an unlock for.
      reportFailure('keychain.write', e, { stage: 'native' });
    }
  }

  private async isLockOn(): Promise<boolean> {
    if (this.lockOn !== null) {
      return this.lockOn;
    }
    this.lockOnRead ??= this.deps.lockSetting.read();
    let value: boolean;
    try {
      value = await this.lockOnRead;
    } catch (e) {
      this.lockOnRead = null;
      throw e;
    }
    // A toggle may have written a newer value while this read was out.
    if (this.lockOn === null) {
      this.lockOn = value;
    }
    return this.lockOn;
  }

  private setKey(key: Uint8Array): void {
    if (this.key && this.key !== key) {
      this.key.fill(0);
    }
    this.key = key;
    // A key in hand: whatever kept failing to read is no longer in the way, and no reset is owed.
    this.unreadableReads = 0;
    this.changed();
  }

  private clearKey(): void {
    this.key?.fill(0);
    this.key = null;
  }

  private setRecovering(value: boolean): void {
    if (this.recovering !== value) {
      this.recovering = value;
      this.changed();
    }
  }

  private changed(): void {
    this.version += 1;
    for (const wake of [...this.waiters]) {
      wake();
    }
    for (const listener of [...this.listeners]) {
      listener();
    }
  }

  private waitForChange(seen: number, signal?: AbortSignal): Promise<void> {
    if (this.version !== seen) {
      return Promise.resolve();
    }
    if (signal?.aborted) {
      // Aborted while the setting was being read: no 'abort' event will ever come for this signal.
      return Promise.reject(new VaultUnavailableError('Aborted while the app was locked.'));
    }
    return new Promise<void>((resolve, reject) => {
      const onAbort = () => {
        this.waiters.delete(wake);
        reject(new VaultUnavailableError('Aborted while the app was locked.'));
      };
      const wake = () => {
        this.waiters.delete(wake);
        signal?.removeEventListener('abort', onAbort);
        resolve();
      };
      this.waiters.add(wake);
      signal?.addEventListener('abort', onAbort);
    });
  }

  /** One key operation at a time, so two first reads cannot race to two keys. Never nest it. */
  private exclusive<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn, fn);
    this.queue = run.catch(() => undefined);
    return run;
  }
}

/**
 * The Keychain for tests: two items, a placeholder, and a phone whose prompts and screen lock can be
 * set. `platform` picks the prompt behaviour that matters for counting: iOS writes a gated item
 * silently and asks on every gated read; Android asks on the gated write and lets a read inside the
 * key's authentication window through without asking again.
 */
export class InMemoryVaultKeyStorage implements VaultKeyStorage {
  plain: Uint8Array | null = null;
  gated: Uint8Array | null = null;
  legacyToken = false;
  platform: 'ios' | 'android' = 'ios';
  /** Whether the phone has a screen lock. */
  screenLock = true;
  biometrics = true;
  /** What the next prompt does. `invalidated` models a gated key the OS has permanently invalidated. */
  prompt: 'succeed' | 'cancel' | 'invalidated' = 'succeed';
  /** Prompts actually shown. */
  prompts = 0;
  lastPromptTitle: string | null = null;
  /** Every mutation, in order. */
  readonly log: string[] = [];
  /** Makes the next plain read throw, like a Keychain that will not answer. */
  plainReadError: Error | null = null;
  /**
   * Makes every read of the gated item throw this until the item is written again or deleted - an
   * item gone bad in a way no error names as permanent, while a new one would work.
   */
  gatedReadError: Error | null = null;
  /**
   * The ungated entry survives but Android lost the Keystore key under it: every read fails its
   * authentication tag, as react-native-keychain reports it, until the item is written or deleted.
   */
  plainKeyLost = false;
  private windowOpen = false;

  async readPlain(): Promise<Uint8Array | null> {
    if (this.plainReadError) {
      const e = this.plainReadError;
      this.plainReadError = null;
      throw e;
    }
    if (this.plain && this.plainKeyLost) {
      throw new Error(
        'Decryption failed: Authentication tag verification failed. This usually indicates that the encrypted data was modified, corrupted, or is being decrypted with the wrong key.',
      );
    }
    return this.plain ? this.plain.slice() : null;
  }

  async writePlain(key: Uint8Array): Promise<void> {
    this.plain = key.slice();
    this.plainKeyLost = false;
    this.log.push('writePlain');
  }

  async deletePlain(): Promise<void> {
    if (this.plain) {
      this.log.push('deletePlain');
    }
    this.plain = null;
    this.plainKeyLost = false;
  }

  async hasPlain(): Promise<boolean> {
    return this.plain !== null;
  }

  async readGated(promptTitle: string): Promise<Uint8Array | null> {
    if (!this.gated) {
      return null;
    }
    if (this.gatedReadError) {
      throw this.gatedReadError;
    }
    if (this.prompt === 'invalidated') {
      // Android fails before any prompt is drawn: the key cannot even be initialised.
      throw new Error('Wrapped error: Key permanently invalidated');
    }
    if (this.platform === 'android' && this.windowOpen) {
      this.windowOpen = false;
      return this.gated.slice();
    }
    this.ask(promptTitle);
    return this.gated.slice();
  }

  async writeGated(key: Uint8Array, promptTitle: string): Promise<void> {
    if (!this.screenLock) {
      throw new NoScreenLockError();
    }
    if (this.platform === 'android') {
      this.ask(promptTitle);
      this.windowOpen = true;
    }
    this.gated = key.slice();
    this.gatedReadError = null;
    this.log.push('writeGated');
  }

  async deleteGated(): Promise<void> {
    if (this.gated) {
      this.log.push('deleteGated');
    }
    this.gated = null;
    this.gatedReadError = null;
  }

  async hasGated(): Promise<boolean> {
    return this.gated !== null;
  }

  async canGate(): Promise<boolean> {
    return this.screenLock;
  }

  async canUseBiometrics(): Promise<boolean> {
    return this.biometrics;
  }

  async removeLegacyToken(): Promise<void> {
    this.legacyToken = false;
  }

  private ask(promptTitle: string): void {
    this.prompts += 1;
    this.lastPromptTitle = promptTitle;
    if (!this.screenLock) {
      throw new Error('No screen lock is set.');
    }
    if (this.prompt === 'cancel') {
      throw new Error('code: 13, msg: Cancel');
    }
  }
}
