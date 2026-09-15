// Argon2id: native where the device has it, pure JS where it does not (006).
//
// Why this file exists: on Hermes the pure-JS derivation at the shipped cost took roughly ten
// seconds - measured on the emulator, and the reason a backup felt broken. The same parameters
// through the platform's native Argon2 take tens of milliseconds. Hermes has no JIT; @noble's
// implementation is not the problem, running it in an interpreter is.
//
// The parameters and the algorithm are UNCHANGED. That matters more than the speed: an archive
// sealed by one path must open through the other, on a phone that may not be this one. Which is why
// the native library is not simply trusted -
//
//   Before it is used for anything, it derives a known answer that @noble derives too, and the two
//   are compared byte for byte. Cheap parameters, a millisecond, once per launch. If a native build
//   ever disagrees - a different Argon2 version, a salt encoded differently, a broken port - this
//   notices immediately and falls back, rather than writing archives that only that phone can read.

import { argon2id, argon2idAsync } from '@noble/hashes/argon2.js';
import { measure, reportFailure } from '../telemetry/telemetry';
import { encodeUtf8 } from '../text/textCodec';

export interface Argon2Params {
  /** Memory cost, KiB. */
  m: number;
  /** Time cost, passes. */
  t: number;
  /** Parallelism. */
  p: number;
}

/** Bytes of key material to derive. */
const KEY_BYTES = 32;

type NativeArgon2 = (
  password: string,
  salt: string,
  options: {
    mode: 'argon2id';
    memory: number;
    iterations: number;
    parallelism: number;
    hashLength: number;
    saltEncoding: 'hex';
  },
) => Promise<{ rawHash: string }>;

/**
 * Resolved per call, never at import.
 *
 * `react-native-argon2` reads `NativeModules.RNArgon2` at module scope and would throw on any build
 * where the native side is not linked - jest, or an app bundle from before the rebuild. A throwing
 * import takes the whole screen with it; a missing module should only mean "use the slow path".
 */
function nativeArgon2(): NativeArgon2 | null {
  try {
    const mod = require('react-native-argon2') as { default?: NativeArgon2 };
    return typeof mod?.default === 'function' ? mod.default : null;
  } catch (e) {
    // Falling back to the JS path is CORRECT and must stay silent to the user - but it is also the
    // difference between a derive that takes a second and one that takes thirty on the JS thread,
    // which is Principle I's exact failure mode. Silent to them, not to us.
    reportFailure('backup.argon2', e, { stage: 'native' });
    return null;
  }
}

const hex = (bytes: Uint8Array) =>
  Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');

function fromHex(text: string): Uint8Array {
  const out = new Uint8Array(text.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(text.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/** The known-answer check: cheap enough to run at startup, real enough to catch a wrong answer. */
const KAT = { m: 256, t: 1, p: 1 } as const;
const KAT_SECRET = 'obalka-argon2-selftest';
const KAT_SALT = new Uint8Array(16).fill(0x2a);

let verified: Promise<NativeArgon2 | null> | null = null;

/**
 * The native implementation, if it exists AND agrees with the reference. Cached for the session.
 *
 * Deliberately not exported: nothing should be able to reach the native path without passing this.
 */
function usableNative(): Promise<NativeArgon2 | null> {
  if (!verified) {
    verified = (async () => {
      const native = nativeArgon2();
      if (!native) {
        return null;
      }
      try {
        const theirs = await native(KAT_SECRET, hex(KAT_SALT), {
          mode: 'argon2id',
          memory: KAT.m,
          iterations: KAT.t,
          parallelism: KAT.p,
          hashLength: KEY_BYTES,
          saltEncoding: 'hex',
        });
        const ours = argon2id(encodeUtf8(KAT_SECRET), KAT_SALT, {
          m: KAT.m,
          t: KAT.t,
          p: KAT.p,
          dkLen: KEY_BYTES,
        });
        return theirs.rawHash.toLowerCase() === hex(ours) ? native : null;
      } catch {
        return null;
      }
    })();
  }
  return verified;
}

/**
 * Derive the file key.
 *
 * `onProgress` only fires on the JS path - the native one finishes before a bar could usefully move,
 * and reporting fake intermediate values would be worse than reporting none.
 */
export async function deriveArgon2id(
  secret: string,
  salt: Uint8Array,
  params: Argon2Params,
  onProgress?: (fraction: number) => void,
): Promise<Uint8Array> {
  // Timed, because this is the one operation in the app whose cost is deliberately high and whose
  // parameters were chosen on a guess. Constitution I forbids blocking the UI thread; the JS
  // fallback path below is exactly where that would happen, and nothing has ever measured it on a
  // real device. `measure` is a transparent pass-through when telemetry is off or unconfigured.
  return measure('backup.argon2', () => deriveArgon2idInner(secret, salt, params, onProgress), {
    stage: 'crypto',
  });
}

async function deriveArgon2idInner(
  secret: string,
  salt: Uint8Array,
  params: Argon2Params,
  onProgress?: (fraction: number) => void,
): Promise<Uint8Array> {
  const native = await usableNative();
  if (native) {
    const { rawHash } = await native(secret, hex(salt), {
      mode: 'argon2id',
      memory: params.m,
      iterations: params.t,
      parallelism: params.p,
      hashLength: KEY_BYTES,
      saltEncoding: 'hex',
    });
    onProgress?.(1);
    return fromHex(rawHash);
  }
  // The fallback is async and yields every 16ms (≈ a frame): slow is survivable, a frozen app is not.
  return argon2idAsync(encodeUtf8(secret), salt, {
    m: params.m,
    t: params.t,
    p: params.p,
    dkLen: KEY_BYTES,
    asyncTick: 16,
    onProgress,
  });
}

/** For the tests: forget the cached verdict so a different environment can be exercised. */
export function resetArgon2Selftest(): void {
  verified = null;
}
