// Reading a recovery key back the way somebody actually wrote it down (006 T003).
//
// The generation side is a CSPRNG and needs little proving. The PARSING side is where this feature
// is won or lost, because it is used exactly once, by a person who has just lost their phone and is
// copying twenty characters off a piece of paper. Every rejection at that moment is a cruelty that
// protects nothing: the key is proved by whether the backup opens, not by whether it was typed in
// capitals.

import {
  format,
  generateRecoveryKey,
  parseRecoveryKey,
} from '../../src/services/backup/recoveryKey';

describe('generateRecoveryKey', () => {
  it('is grouped for copying, and long enough to be pointless to guess', () => {
    const key = generateRecoveryKey();
    expect(key).toMatch(/^[0-9A-Z]{4}(-[0-9A-Z]{4}){4}$/);
    expect(key.replace(/-/g, '')).toHaveLength(20); // 20 x 5 bits = 100 bits
  });

  it('never contains the characters people miscopy', () => {
    // I, L, O and U are absent by construction; if they appear, someone widened the alphabet and
    // made every handwritten key ambiguous.
    for (let i = 0; i < 50; i++) {
      expect(generateRecoveryKey()).not.toMatch(/[ILOU]/);
    }
  });

  it('does not repeat itself', () => {
    const keys = new Set(Array.from({ length: 200 }, generateRecoveryKey));
    expect(keys.size).toBe(200);
  });
});

describe('parseRecoveryKey', () => {
  const KEY = 'FKPX-9WQ2-7TDM-4RJH-2CVB';

  it('accepts the key exactly as it was shown', () => {
    expect(parseRecoveryKey(KEY)).toBe(KEY);
  });

  it('accepts it the way it gets typed', () => {
    expect(parseRecoveryKey('fkpx9wq27tdm4rjh2cvb')).toBe(KEY);
    expect(parseRecoveryKey('  FKPX 9WQ2 7TDM 4RJH 2CVB  ')).toBe(KEY);
    expect(parseRecoveryKey('FKPX9WQ2-7TDM4RJH2CVB')).toBe(KEY);
  });

  it('forgives the substitutions people make reading their own handwriting', () => {
    // O for 0 and I/l for 1 are the classic pair, and the alphabet has no O or I to be ambiguous
    // with - so mapping them is safe rather than lossy.
    expect(parseRecoveryKey('OKPX-9WQ2-7TDM-4RJH-2CVB')).toBe('0KPX-9WQ2-7TDM-4RJH-2CVB');
    expect(parseRecoveryKey('IKPX-9WQ2-7TDM-4RJH-2CVB')).toBe('1KPX-9WQ2-7TDM-4RJH-2CVB');
  });

  it('refuses what cannot be a key at all', () => {
    expect(parseRecoveryKey('')).toBeNull();
    expect(parseRecoveryKey('FKPX-9WQ2')).toBeNull(); // too short
    expect(parseRecoveryKey(KEY + '-EXTRA')).toBeNull(); // too long
  });

  it('round-trips whatever it generates', () => {
    for (let i = 0; i < 100; i++) {
      const key = generateRecoveryKey();
      expect(parseRecoveryKey(key.toLowerCase())).toBe(key);
    }
  });
});

describe('format', () => {
  it('groups in fours and leaves a short tail alone', () => {
    expect(format('ABCDEFGH')).toBe('ABCD-EFGH');
    expect(format('ABCDE')).toBe('ABCD-E');
  });
});
