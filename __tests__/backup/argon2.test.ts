// Choosing the native Argon2 - and refusing it when it disagrees (006).
//
// The speed fix is a native library, which means two implementations now exist for the SAME file
// format. An archive sealed by one has to open through the other, on a phone that may not be this
// one, years from now. So the native path is gated on a known-answer check against @noble rather
// than on trust: cheap parameters, once per launch, compared byte for byte.
//
// These tests exercise the gate, because the failure it prevents is the worst kind - archives that
// look fine and open nowhere else.

import { deriveArgon2id, resetArgon2Selftest } from '../../src/services/backup/argon2';
import { argon2id } from '@noble/hashes/argon2.js';
import { encodeUtf8 } from '../../src/services/text/textCodec';

const PARAMS = { m: 256, t: 1, p: 1 };
const SALT = new Uint8Array(16).fill(9);
const SECRET = 'FKPX-9WQ2-7TDM-4RJH-2CVB';

const reference = () =>
  argon2id(encodeUtf8(SECRET), SALT, { ...PARAMS, dkLen: 32 });

const hex = (bytes: Uint8Array) =>
  Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');

/** A stand-in for the native module: answers with whatever `impl` computes. */
function mockNative(impl: (password: string, saltHex: string, opts: never) => string) {
  jest.doMock('react-native-argon2', () => ({
    __esModule: true,
    default: jest.fn(async (password: string, saltHex: string, opts: never) => ({
      rawHash: impl(password, saltHex, opts),
    })),
  }));
}

beforeEach(() => {
  jest.resetModules();
  resetArgon2Selftest();
});

describe('argon2 selection', () => {
  it('falls back to JS when there is no native module, and still derives the right key', async () => {
    // The default in jest: the package is not linked. Nothing may break because of that.
    const key = await deriveArgon2id(SECRET, SALT, PARAMS);
    expect(hex(key)).toBe(hex(reference()));
  });

  it('uses the native module when it agrees with the reference', async () => {
    mockNative((password, saltHex, opts) => {
      const o = opts as unknown as { memory: number; iterations: number; parallelism: number };
      const salt = new Uint8Array(saltHex.length / 2);
      for (let i = 0; i < salt.length; i++) {
        salt[i] = parseInt(saltHex.slice(i * 2, i * 2 + 2), 16);
      }
      return hex(
        argon2id(encodeUtf8(password), salt, {
          m: o.memory,
          t: o.iterations,
          p: o.parallelism,
          dkLen: 32,
        }),
      );
    });
    // `require` rather than `import()`: jest's module registry is what `doMock` rewires, and dynamic
    // import needs --experimental-vm-modules.
    const derive = require('../../src/services/backup/argon2')
      .deriveArgon2id as typeof deriveArgon2id;
    const native = require('react-native-argon2').default as jest.Mock;

    const key = await derive(SECRET, SALT, PARAMS);

    expect(hex(key)).toBe(hex(reference()));
    // Called twice: once for the self-test, once for the real derivation.
    expect(native).toHaveBeenCalledTimes(2);
  });

  it('REFUSES a native module whose answer differs, and derives in JS instead', async () => {
    // The scenario this whole gate exists for: a native build that computes something else. Trusting
    // it would produce archives openable on exactly one phone.
    mockNative(() => '00'.repeat(32));
    const derive = require('../../src/services/backup/argon2')
      .deriveArgon2id as typeof deriveArgon2id;

    const key = await derive(SECRET, SALT, PARAMS);

    expect(hex(key)).toBe(hex(reference()));
    expect(hex(key)).not.toBe('00'.repeat(32));
  });

  it('refuses a native module that throws, rather than failing the backup', async () => {
    jest.doMock('react-native-argon2', () => ({
      __esModule: true,
      default: jest.fn(async () => {
        throw new Error('JNI is unhappy');
      }),
    }));
    const derive = require('../../src/services/backup/argon2')
      .deriveArgon2id as typeof deriveArgon2id;

    expect(hex(await derive(SECRET, SALT, PARAMS))).toBe(hex(reference()));
  });

  it('runs the self-test once, not once per backup', async () => {
    mockNative((password, saltHex, opts) => {
      const o = opts as unknown as { memory: number; iterations: number; parallelism: number };
      const salt = new Uint8Array(saltHex.length / 2);
      for (let i = 0; i < salt.length; i++) {
        salt[i] = parseInt(saltHex.slice(i * 2, i * 2 + 2), 16);
      }
      return hex(
        argon2id(encodeUtf8(password), salt, {
          m: o.memory,
          t: o.iterations,
          p: o.parallelism,
          dkLen: 32,
        }),
      );
    });
    // `require` rather than `import()`: jest's module registry is what `doMock` rewires, and dynamic
    // import needs --experimental-vm-modules.
    const derive = require('../../src/services/backup/argon2')
      .deriveArgon2id as typeof deriveArgon2id;
    const native = require('react-native-argon2').default as jest.Mock;

    await derive(SECRET, SALT, PARAMS);
    await derive(SECRET, SALT, PARAMS);
    await derive(SECRET, SALT, PARAMS);

    // 1 self-test + 3 derivations. A per-call self-test would cost a whole extra KDF each time.
    expect(native).toHaveBeenCalledTimes(4);
  });
});
