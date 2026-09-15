// The phrase that protects a transfer (025 T010).
//
// It is the whole security of the channel, and the recovery key rides over that channel - so the
// properties worth pinning are the ones a later "let us make it shorter" would quietly break.

import {
  PHRASE_DIGITS,
  PHRASE_ENTROPY_BITS,
  PHRASE_WORDS,
  WORDS_CS,
  WORDS_EN,
  generateCodePhrase,
  parseCodePhrase,
} from '../../src/services/transfer/codePhrase';
import { setActiveLocale } from '../../src/i18n/strings';

describe.each([
  ['cs', WORDS_CS],
  ['en', WORDS_EN],
])('the %s word list', (_locale, list) => {
  it('is exactly 256 words, which is what makes the choice unbiased', () => {
    // One CSPRNG byte picks one word. 256 divides 256, so no value is more likely than another -
    // the same property `recoveryKey.ts` gets from a 32-symbol alphabet. Change the length and the
    // generator silently starts favouring the front of the list.
    expect(list.length).toBe(256);
  });

  it('has no duplicates', () => {
    expect(new Set(list).size).toBe(list.length);
  });

  it('is ASCII, so it survives every keyboard somebody types it on', () => {
    // A word with a diacritic is a word half the phones in the world will autocorrect.
    for (const w of list) {
      expect(w).toMatch(/^[a-z]+$/);
    }
  });

  it('keeps every word distinct in its first four letters', () => {
    // Two words that start alike are two words somebody will read across a table and confuse.
    const prefixes = list.map((w: string) => w.slice(0, 4));
    expect(new Set(prefixes).size).toBe(list.length);
  });
});

describe('the phrase follows the app s language', () => {
  afterEach(() => setActiveLocale('cs'));

  it('draws its words from the ACTIVE locale', () => {
    // Czech words in an English app are noise somebody has to transcribe letter by letter, which is
    // the friction this feature exists to remove.
    setActiveLocale('en');
    for (let i = 0; i < 30; i++) {
      for (const w of generateCodePhrase().split('-').slice(1)) {
        expect(WORDS_EN).toContain(w);
      }
    }
    setActiveLocale('cs');
    for (let i = 0; i < 30; i++) {
      for (const w of generateCodePhrase().split('-').slice(1)) {
        expect(WORDS_CS).toContain(w);
      }
    }
  });

  it('ACCEPTS a phrase from the other language, because the phones need not match', () => {
    // Somebody helping a relative, a phone restored from a different setup. The phrase is passed to
    // the transport as a literal string - nothing decodes a word back to an index - so accepting a
    // wider set costs no entropy.
    setActiveLocale('en');
    expect(parseCodePhrase('7K2M-ryba-kotva-duha-lampa')).toBe('7K2M-ryba-kotva-duha-lampa');
    setActiveLocale('cs');
    expect(parseCodePhrase('7K2M-anchor-bacon-cedar-daisy')).toBe(
      '7K2M-anchor-bacon-cedar-daisy',
    );
  });

  it('still refuses a word that is on neither list', () => {
    expect(parseCodePhrase('7K2M-ryba-kotva-duha-zzzzz')).toBeNull();
  });
});

describe('generating a phrase', () => {
  it('reads as a code, not a sentence', () => {
    expect(generateCodePhrase()).toMatch(/^[0-9A-Z]{4}(-[a-z]+){4}$/);
  });

  it('carries the entropy it claims', () => {
    // 4 words from 256 = 32 bits; 4 symbols from 32 = 20 bits. Stated as a constant so a change
    // that shortens the phrase has to come here and argue with the number.
    const bits =
      PHRASE_WORDS * Math.log2(WORDS_CS.length) + PHRASE_DIGITS * Math.log2(32);
    expect(bits).toBe(PHRASE_ENTROPY_BITS);
  });

  it('does not repeat itself', () => {
    const seen = new Set(Array.from({ length: 200 }, () => generateCodePhrase()));
    expect(seen.size).toBe(200);
  });

  it('round-trips through its own parser', () => {
    for (let i = 0; i < 50; i++) {
      const phrase = generateCodePhrase();
      expect(parseCodePhrase(phrase)).toBe(phrase);
    }
  });
});

describe('reading a phrase back', () => {
  it('forgives how a person actually types it', () => {
    // Capitals, spaces instead of dashes, and the stray spacing somebody adds reading aloud. Being
    // strict here protects nothing: the phrase is proved by whether the handshake succeeds.
    const canonical = '7K2M-ryba-kotva-duha-lampa';
    for (const typed of [
      '7K2M-ryba-kotva-duha-lampa',
      '7k2m ryba kotva duha lampa',
      '  7K2M  RYBA  Kotva  duha  lampa  ',
      '7K2M, ryba, kotva, duha, lampa',
      '7K2M_ryba_kotva_duha_lampa',
    ]) {
      expect(parseCodePhrase(typed)).toBe(canonical);
    }
  });

  it('applies the substitutions people make from their own handwriting', () => {
    // O/0 and I/1 and U/V, exactly as the recovery key does - and only in the DIGITS, where the
    // alphabet excludes them. Applying them to words would corrupt real words.
    expect(parseCodePhrase('7KOM-ryba-kotva-duha-lampa')).toBe(
      '7K0M-ryba-kotva-duha-lampa',
    );
    expect(parseCodePhrase('7KIM-ryba-kotva-duha-lampa')).toBe(
      '7K1M-ryba-kotva-duha-lampa',
    );
  });

  it('REFUSES a word that is not on the list rather than guessing at it', () => {
    // The property that matters most here. A near-miss silently corrected is how somebody ends up
    // handing their archive to a stranger's phone that happened to be listening.
    expect(parseCodePhrase('7K2M-ryba-kotva-duha-lampada')).toBeNull();
    expect(parseCodePhrase('7K2M-ryba-kotva-duha-lamp')).toBeNull();
  });

  it('refuses the wrong shape', () => {
    expect(parseCodePhrase('')).toBeNull();
    expect(parseCodePhrase('ryba-kotva-duha-lampa')).toBeNull();
    expect(parseCodePhrase('7K2M-ryba-kotva-duha')).toBeNull();
    expect(parseCodePhrase('7K2M-ryba-kotva-duha-lampa-navic')).toBeNull();
    expect(parseCodePhrase('7K2-ryba-kotva-duha-lampa')).toBeNull();
  });

  it('refuses a digit group using the characters the alphabet leaves out', () => {
    // The alphabet has no I, L, O or U precisely because they get miscopied; a phrase claiming to
    // contain one was not generated here.
    expect(parseCodePhrase('7K2$-ryba-kotva-duha-lampa')).toBeNull();
  });
});
