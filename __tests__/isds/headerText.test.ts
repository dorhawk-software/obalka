import { decodeEncodedWord } from '../../src/services/isds/headerText';

describe('decodeEncodedWord (RFC 2047)', () => {
  it('decodes the real ISDS "code sent" message header', () => {
    // The exact value returned by czebox for X-Response-message-text on a TOTP send.
    expect(decodeEncodedWord('=?UTF-8?B?SmVkbm9yw6F6b3bDvSBrw7NkIG9kZXNsw6FuLg==?=')).toBe(
      'Jednorázový kód odeslán.',
    );
  });

  it('is case-insensitive on the charset/encoding tokens', () => {
    expect(decodeEncodedWord('=?utf-8?b?w6HEjQ==?=')).toBe('áč');
  });

  it('returns plain (non-encoded) values unchanged', () => {
    expect(decodeEncodedWord('plain text')).toBe('plain text');
  });

  it('passes through undefined', () => {
    expect(decodeEncodedWord(undefined)).toBeUndefined();
  });
});
