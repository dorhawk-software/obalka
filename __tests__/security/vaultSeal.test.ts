// Sealing a box secret under the vault key (001 T028).
//
// The seal is the only thing between a Keychain item and the password inside it once the app lock is
// on, so the properties that matter are pinned one by one: it round-trips, it never contains the
// plaintext, a changed byte is caught, a seal from a lost key is told apart from a damaged one, and a
// seal cannot be moved to another box or kind and still open.

import {
  SealError,
  VAULT_KEY_BYTES,
  isSealed,
  keyIdOf,
  openSecret,
  sealSecret,
  type SealFailure,
} from '../../src/services/secureStore/seal';

const key = (fill: number) => new Uint8Array(VAULT_KEY_BYTES).fill(fill);
const K1 = key(1);
const K2 = key(2);
const PASSWORD = 'Heslo-ěščřžýáíé-SENTINEL';
const COOKIE = 'IPCZ-X-COOKIE=SENTINEL-session-token; path=/';

function reasonOf(fn: () => unknown): SealFailure | 'none' {
  try {
    fn();
    return 'none';
  } catch (e) {
    if (e instanceof SealError) {
      return e.reason;
    }
    throw e;
  }
}

/** Flip one hex digit at `index` of the hex body (after the `obalka-vault-1:` prefix). */
function flipHex(sealed: string, index: number): string {
  const colon = sealed.indexOf(':');
  const at = colon + 1 + index;
  const digit = sealed[at] === '0' ? '1' : '0';
  return sealed.slice(0, at) + digit + sealed.slice(at + 1);
}

describe('sealing a box secret', () => {
  it('round-trips a password and a session cookie, including non-ASCII text', () => {
    const p = sealSecret(K1, 'password', 'box1', PASSWORD);
    const c = sealSecret(K1, 'session', 'box1', COOKIE);
    expect(openSecret(K1, 'password', 'box1', p)).toBe(PASSWORD);
    expect(openSecret(K1, 'session', 'box1', c)).toBe(COOKIE);
  });

  it('never contains the plaintext, and two seals of the same secret differ', () => {
    const a = sealSecret(K1, 'password', 'box1', PASSWORD);
    const b = sealSecret(K1, 'password', 'box1', PASSWORD);
    expect(a).not.toContain('SENTINEL');
    expect(a).not.toBe(b); // a fresh random nonce each time
    expect(isSealed(a)).toBe(true);
    expect(a.startsWith('obalka-vault-1:')).toBe(true);
  });

  it('tells a pre-vault plain value apart from a seal', () => {
    expect(isSealed(JSON.stringify({ password: PASSWORD }))).toBe(false);
  });

  it('detects a changed ciphertext byte', () => {
    const sealed = sealSecret(K1, 'password', 'box1', PASSWORD);
    const lastDigit = sealed.length - sealed.indexOf(':') - 2;
    expect(reasonOf(() => openSecret(K1, 'password', 'box1', flipHex(sealed, lastDigit)))).toBe(
      'tampered',
    );
  });

  it('detects a changed nonce', () => {
    const sealed = sealSecret(K1, 'password', 'box1', PASSWORD);
    expect(reasonOf(() => openSecret(K1, 'password', 'box1', flipHex(sealed, 16)))).toBe('tampered');
  });

  it('reads a seal from another key as a lost key, not as tampering', () => {
    const sealed = sealSecret(K1, 'password', 'box1', PASSWORD);
    expect(reasonOf(() => openSecret(K2, 'password', 'box1', sealed))).toBe('keyMismatch');
    // The key id is a fingerprint, not the key: it differs per key and says nothing readable.
    expect(keyIdOf(K1)).not.toEqual(keyIdOf(K2));
  });

  it('will not open a seal moved to another box', () => {
    const sealed = sealSecret(K1, 'password', 'box1', PASSWORD);
    expect(reasonOf(() => openSecret(K1, 'password', 'box2', sealed))).toBe('tampered');
  });

  it('will not open a password seal as a session cookie, or the other way round', () => {
    const p = sealSecret(K1, 'password', 'box1', PASSWORD);
    const c = sealSecret(K1, 'session', 'box1', COOKIE);
    expect(reasonOf(() => openSecret(K1, 'session', 'box1', p))).toBe('tampered');
    expect(reasonOf(() => openSecret(K1, 'password', 'box1', c))).toBe('tampered');
  });

  it('refuses a seal from a newer format rather than guessing', () => {
    const sealed = sealSecret(K1, 'password', 'box1', PASSWORD).replace(
      'obalka-vault-1:',
      'obalka-vault-2:',
    );
    expect(reasonOf(() => openSecret(K1, 'password', 'box1', sealed))).toBe('version');
  });

  it.each([
    ['a plain JSON value', JSON.stringify({ password: PASSWORD })],
    ['no version', 'obalka-vault-:00'],
    ['a truncated body', 'obalka-vault-1:0011'],
    ['non-hex characters', `obalka-vault-1:${'zz'.repeat(60)}`],
  ])('reads %s as a damaged format', (_label, stored) => {
    expect(reasonOf(() => openSecret(K1, 'password', 'box1', stored))).toBe('format');
  });

  it('refuses a key of the wrong length outright', () => {
    expect(() => sealSecret(new Uint8Array(16), 'password', 'box1', PASSWORD)).toThrow(
      'must be 32 bytes',
    );
  });
});
