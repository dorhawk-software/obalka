// The recovery key (006 T003) - the one thing standing between a lost phone and a lost archive.
//
// It is GENERATED, not chosen. A passphrase people pick has weak instances, and the people most in
// need of a backup are the least likely to pick a strong one; a key from a CSPRNG has none. The cost
// is that it has to be written down, which makes how it LOOKS a security property: a key that is
// painful to copy is a key that gets photographed, mistyped, or skipped.
//
// So the alphabet excludes the characters people confuse when copying by hand - I, L, O and U are
// gone (Crockford's choice, for the same reason) - and reading is deliberately forgiving: case,
// spacing and the classic O/0 and I/1 substitutions are all accepted. Being strict at the moment
// somebody is restoring a lost phone would be a cruelty that protects nothing, since the key is
// verified by the decryption itself.

/** No I, L, O or U: the four that get miscopied. 32 symbols = 5 bits each. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** 20 symbols = 100 bits. Far beyond what Argon2id needs to make guessing pointless. */
const SYMBOLS = 20;
const GROUP = 4;

/** A new key, formatted for writing down: `FKPX-9WQ2-7TDM-4RJH-2CVB`. */
export function generateRecoveryKey(): string {
  const bytes = new Uint8Array(SYMBOLS);
  globalThis.crypto.getRandomValues(bytes);
  // Rejection-free because 256 is a multiple of 32: every byte maps to a symbol with no bias.
  const symbols = Array.from(bytes, b => ALPHABET[b % ALPHABET.length]).join('');
  return format(symbols);
}

/** Insert the dashes. Grouping is the difference between copying this correctly and not. */
export function format(symbols: string): string {
  return (symbols.match(new RegExp(`.{1,${GROUP}}`, 'g')) ?? []).join('-');
}

/**
 * Read a key back the way a person actually typed it.
 *
 * Returns the canonical form, or null when it could not be one. The forgiveness here is not
 * sloppiness: the key is proved by whether the backup opens, so rejecting a lowercase 'o' up front
 * only means refusing to try.
 */
export function parseRecoveryKey(input: string): string | null {
  const cleaned = input
    .toUpperCase()
    .replace(/[\s-]/g, '')
    // The substitutions people make reading their own handwriting.
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1')
    .replace(/U/g, 'V');
  if (cleaned.length !== SYMBOLS) {
    return null;
  }
  for (const c of cleaned) {
    if (!ALPHABET.includes(c)) {
      return null;
    }
  }
  return format(cleaned);
}
