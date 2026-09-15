// Our UTF-8 codecs, checked against Node's real TextDecoder/TextEncoder (010 US3).
//
// They exist because Hermes has neither and two published polyfills failed on the device. That makes
// this suite the only thing standing between a mis-decoded document and a wrong date offered to the
// user, so it compares against the platform implementation rather than against hand-written
// expectations - including the malformed input a hostile or merely broken PDF can contain.

import {
  decodeUtf8,
  decodeUtf8Async,
  encodeUtf8,
  encodeUtf8Async,
  installTextCodecs,
} from '../../src/services/text/textCodec';

const enc = new TextEncoder();
const dec = new TextDecoder('utf-8');

const SAMPLES = [
  '',
  'Odvolání lze podat do 8. 7. 2026.',
  'Příliš žluťoučký kůň úpěl ďábelské ódy',
  'ASCII only, 12345',
  'emoji 👩‍⚖️ and 𝕄𝕒𝕥𝕙',
  'mixed ěščřžýáíé 中文 العربية',
];

describe('decodeUtf8', () => {
  it.each(SAMPLES)('round-trips %p exactly as the platform does', s => {
    expect(decodeUtf8(enc.encode(s))).toBe(s);
  });

  it('matches the platform on a long document-sized string', () => {
    const long = SAMPLES.join(' ').repeat(500);
    expect(decodeUtf8(enc.encode(long))).toBe(long);
  });

  it.each([
    ['a lone continuation byte', [0x41, 0x80, 0x42]],
    ['a truncated 3-byte sequence', [0xe2, 0x82]],
    ['an over-long encoding of "/"', [0xc0, 0xaf]],
    ['a surrogate half', [0xed, 0xa0, 0x80]],
    ['a byte above the Unicode range', [0xf5, 0x80, 0x80, 0x80]],
  ])('replaces %s, exactly like the platform', (_name, bytes) => {
    const input = new Uint8Array(bytes);
    expect(decodeUtf8(input)).toBe(dec.decode(input));
  });

  it('treats no input at all as an empty string (the call that broke a published polyfill)', () => {
    const decoder = new (globalThis as unknown as {
      TextDecoder: new () => { decode: (i?: unknown) => string };
    }).TextDecoder();
    expect(decoder.decode()).toBe('');
  });

  // The strongest check available: thousands of random byte strings, compared against the platform.
  // Hand-written cases cover the malformed input someone thought of; this covers the rest.
  it('agrees with the platform on random bytes', () => {
    let seed = 20260819;
    const rnd = () => {
      // A deterministic PRNG - a failing run must be reproducible.
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    for (let n = 0; n < 2000; n++) {
      const len = 1 + Math.floor(rnd() * 24);
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        // Biased towards the lead/continuation ranges, where the interesting failures live.
        bytes[i] = rnd() < 0.5 ? Math.floor(rnd() * 256) : 0x80 + Math.floor(rnd() * 0x50);
      }
      expect([Array.from(bytes), decodeUtf8(bytes)]).toEqual([
        Array.from(bytes),
        dec.decode(bytes),
      ]);
    }
  });
});

describe('encodeUtf8', () => {
  it.each(SAMPLES)('encodes %p byte-for-byte as the platform does', s => {
    expect(Array.from(encodeUtf8(s))).toEqual(Array.from(enc.encode(s)));
  });
});

describe('installTextCodecs', () => {
  it('leaves an engine that already has them alone', () => {
    const before = globalThis.TextDecoder;
    installTextCodecs();
    expect(globalThis.TextDecoder).toBe(before);
  });

  it('installs a decoder that handles what pdf.js asks for', () => {
    const g = globalThis as unknown as { TextDecoder?: unknown };
    const real = g.TextDecoder;
    try {
      delete g.TextDecoder;
      installTextCodecs();
      const D = g.TextDecoder as new (
        label?: string,
        o?: { fatal?: boolean; ignoreBOM?: boolean },
      ) => { decode(i?: unknown): string };
      // pdf.js constructs it exactly like this, `fatal` included.
      const d = new D('utf-8', { ignoreBOM: true, fatal: true });
      expect(d.decode(enc.encode('do 8. 7. 2026'))).toBe('do 8. 7. 2026');
      // …and hands it an ArrayBuffer as well as a view.
      expect(d.decode(enc.encode('lhůta').buffer)).toBe('lhůta');
    } finally {
      g.TextDecoder = real;
    }
  });
});

// The JS thread must survive an archive-sized encode (impeccable audit, 2026-09-09).
//
// `encodePayload` used to call the SYNCHRONOUS encoder on the JSON of every message in the archive,
// and it was evaluated as an argument - `seal(encodePayload(payload), …)` - so not even the await
// around it yielded. Once backups became automatic that ran eight seconds after any sync, while the
// user was still scrolling: no frame rendered, no touch was answered, and nothing on screen
// explained why. The KDF next door had already been fixed the same way; this is the same test.
describe('encoding something the size of a real archive', () => {
  const big = JSON.stringify({
    messages: Array.from({ length: 4000 }, (_, i) => ({
      id: `msg${i}`,
      subject: `Rozhodnutí ve věci ${i} - příloha`,
      sender: 'Úřad práce ČR - krajská pobočka',
    })),
  });

  it('produces the same bytes as the synchronous encoder', async () => {
    // The async path is an optimisation, not a second implementation: identical output or nothing.
    expect(await encodeUtf8Async(big)).toEqual(encodeUtf8(big));
  });

  it('round-trips through the decoder, diacritics and all', async () => {
    expect(decodeUtf8(await encodeUtf8Async(big))).toBe(big);
  });

  it('lets the thread run while it works', async () => {
    let ticks = 0;
    const timer = setInterval(() => {
      ticks++;
    }, 1);
    try {
      await encodeUtf8Async(big);
    } finally {
      clearInterval(timer);
    }
    // With the synchronous encoder this is 0 - the interval never gets a turn.
    expect(ticks).toBeGreaterThan(0);
  });

  it('handles the boundaries a chunked encoder gets wrong', async () => {
    // A surrogate pair straddling a slice boundary is the bug this design invites.
    for (const n of [65535, 65536, 65537]) {
      const text = 'a'.repeat(n) + '😀' + 'ř';
      expect(await encodeUtf8Async(text)).toEqual(encodeUtf8(text));
      expect(decodeUtf8(await encodeUtf8Async(text))).toBe(text);
    }
  });
});

describe('decoding something the size of a signed message (004)', () => {
  it('decodes in slices exactly as it does whole, whatever a slice boundary cuts through', async () => {
    // Well over one slice, with two-, three- and four-byte characters landing on the boundaries.
    const text = 'Příliš žluťoučký kůň úpěl ďábelské ódy – 👩‍⚖️ '.repeat(12000);
    const bytes = enc.encode(text);
    expect(await decodeUtf8Async(bytes)).toBe(text);
    // A malformed sequence astride a boundary becomes what a whole decode makes of it, not two errors.
    const broken = bytes.slice();
    broken[262143] = 0xe2;
    broken[262144] = 0x41;
    expect(await decodeUtf8Async(broken)).toBe(dec.decode(broken));
  });
});
