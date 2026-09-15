// Decoder for ISDS response headers that carry localized text. HTTP headers are ASCII, so ISDS
// MIME-encodes diacritics as an RFC 2047 "encoded-word", e.g.
//   X-Response-message-text: =?UTF-8?B?SmVkbm9yw6F6b3bDvSBrw7NkIG9kZXNsw6FuLg==?=
// We decode the UTF-8 Base64 ('B') form; any other value is returned unchanged.

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function base64ToBytes(b64: string): number[] {
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const ch of b64) {
    const val = B64.indexOf(ch);
    if (val < 0) {
      continue; // skip '=' padding and any stray whitespace
    }
    buffer = (buffer << 6) | val;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return bytes;
}

function utf8FromBytes(bytes: number[]): string {
  let out = '';
  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i++];
    if (b < 0x80) {
      out += String.fromCharCode(b);
    } else if (b >= 0xc0 && b < 0xe0) {
      out += String.fromCharCode(((b & 0x1f) << 6) | (bytes[i++] & 0x3f));
    } else if (b >= 0xe0 && b < 0xf0) {
      const b1 = bytes[i++];
      const b2 = bytes[i++];
      out += String.fromCharCode(((b & 0x0f) << 12) | ((b1 & 0x3f) << 6) | (b2 & 0x3f));
    } else {
      const b1 = bytes[i++];
      const b2 = bytes[i++];
      const b3 = bytes[i++];
      const cp = ((b & 0x07) << 18) | ((b1 & 0x3f) << 12) | ((b2 & 0x3f) << 6) | (b3 & 0x3f);
      const off = cp - 0x10000;
      out += String.fromCharCode(0xd800 + (off >> 10), 0xdc00 + (off & 0x3ff));
    }
  }
  return out;
}

/** Decode an RFC 2047 `=?UTF-8?B?...?=` encoded-word; returns the input unchanged if not encoded. */
export function decodeEncodedWord(value: string | undefined): string | undefined {
  if (!value) {
    return value;
  }
  const m = /^=\?utf-8\?b\?(.*?)\?=$/i.exec(value.trim());
  if (!m) {
    return value;
  }
  return utf8FromBytes(base64ToBytes(m[1]));
}
