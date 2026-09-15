// `TextDecoder` / `TextEncoder` for Hermes (010 US3).
//
// Hermes implements neither, and pdf.js needs both the moment it pulls a string out of its WASM
// heap. Two off-the-shelf polyfills were tried on the device first, and both failed in ways a test
// on Node would never have shown: one rejects `{fatal: true}`, which pdf.js always passes; the other
// then threw "Cannot read property 'buffer' of undefined" because pdf.js calls `decode()` with no
// argument. Forty lines that handle exactly what the caller does are more predictable than a
// dependency that handles a hundred encodings and not this caller.
//
// Scope, stated plainly: **UTF-8 only**. Any other label decodes as UTF-8 rather than throwing -
// pdf.js asks for utf-8, and a scan that produces slightly wrong text is a suggestion the user
// rejects, while a throw would take out the whole read. Invalid bytes become U+FFFD, the standard
// non-fatal behaviour, and `fatal` is deliberately ignored for the same reason.
//
// Moved out of `services/scan/` when the backup needed it too: Hermes ships no `TextDecoder`, and the
// backup discovered that the hard way - sealing an archive worked (a `TextEncoder` does exist) and
// opening it threw `ReferenceError: Property 'TextDecoder' doesn't exist`, which the restore screen
// then reported as a wrong password. Code that needs UTF-8 imports THESE functions rather than
// touching a global, so nothing depends on a shim having been installed first.

/** Anything a caller might hand `decode`, plus nothing at all. */
type DecodeInput = ArrayBuffer | ArrayBufferView | null | undefined;

function toBytes(input: DecodeInput): Uint8Array {
  if (input == null) {
    return new Uint8Array(0);
  }
  if (input instanceof Uint8Array) {
    return input;
  }
  if (ArrayBuffer.isView(input)) {
    return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  }
  return new Uint8Array(input);
}

/**
 * UTF-8 → string, replacing anything malformed rather than throwing.
 *
 * Follows the WHATWG decoder's error handling rather than an ad-hoc version of it, because the two
 * differ in a way that matters: on a bad byte the spec emits ONE U+FFFD for the partial sequence and
 * re-examines the offending byte, where a naive loop emits one per byte and can swallow the start of
 * the next character. The per-lead-byte continuation ranges below also reject over-long forms and
 * surrogates by construction - the two ways malformed input can otherwise smuggle a DIFFERENT
 * character past a decoder.
 */
export function decodeUtf8(bytes: Uint8Array): string {
  let out = '';
  let chunk: number[] = [];
  const flush = () => {
    if (chunk.length > 0) {
      out += String.fromCharCode.apply(null, chunk);
      chunk = [];
    }
  };
  const push = (cp: number) => {
    if (cp > 0xffff) {
      const v = cp - 0x10000;
      chunk.push(0xd800 + (v >> 10), 0xdc00 + (v & 0x3ff));
    } else {
      chunk.push(cp);
    }
    // Built in chunks: `+=` per character is slow over a document, and one giant
    // `String.fromCharCode.apply` overflows the stack.
    if (chunk.length >= 4096) {
      flush();
    }
  };

  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i];
    if (b < 0x80) {
      push(b);
      i++;
      continue;
    }
    // Lead byte → how many continuations, and what the FIRST of them is allowed to be.
    let n = 0;
    let lo = 0x80;
    let hi = 0xbf;
    let cp = 0;
    if (b >= 0xc2 && b <= 0xdf) {
      n = 1;
      cp = b & 0x1f;
    } else if (b >= 0xe0 && b <= 0xef) {
      n = 2;
      cp = b & 0x0f;
      if (b === 0xe0) {
        lo = 0xa0; // rejects over-long 3-byte forms
      } else if (b === 0xed) {
        hi = 0x9f; // rejects UTF-16 surrogates
      }
    } else if (b >= 0xf0 && b <= 0xf4) {
      n = 3;
      cp = b & 0x07;
      if (b === 0xf0) {
        lo = 0x90; // rejects over-long 4-byte forms
      } else if (b === 0xf4) {
        hi = 0x8f; // rejects code points above U+10FFFF
      }
    } else {
      push(0xfffd); // 0x80–0xc1 and 0xf5–0xff are never lead bytes
      i++;
      continue;
    }

    let k = 1;
    let bad = false;
    for (; k <= n; k++) {
      const c = bytes[i + k];
      const min = k === 1 ? lo : 0x80;
      const max = k === 1 ? hi : 0xbf;
      if (c === undefined || c < min || c > max) {
        bad = true;
        break;
      }
      cp = (cp << 6) | (c & 0x3f);
    }
    if (bad) {
      // One replacement for the partial sequence, and resume AT the offending byte - which may
      // itself begin a valid character.
      push(0xfffd);
      i += k;
      continue;
    }
    push(cp);
    i += n + 1;
  }
  flush();
  return out;
}

/**
 * How many source characters one `encodeUtf8Async` slice converts before yielding.
 *
 * 64k characters is a few milliseconds of interpreted work - small enough that a frame is never
 * missed, large enough that the yields themselves cost nothing measurable.
 */
const ENCODE_SLICE = 65536;

/**
 * Encode `text.slice(from, to)` into `out` at `at`.
 *
 * Returns BOTH offsets - where writing stopped and where reading stopped - because a surrogate pair
 * can straddle the boundary: the encoder consumes two units for one code point, so the next slice
 * must resume after the low surrogate rather than at `to`. Without that, the pair is encoded as a
 * code point AND again as a stray low surrogate. The boundary test in `textCodec.test.ts` caught
 * exactly that on the first run.
 *
 * Shared by the sync and async encoders so there is one implementation of UTF-8 in this file. Writes
 * into a caller-owned buffer: the previous version pushed into a `number[]` and copied it at the
 * end, which on Hermes means one boxed element per BYTE of the archive.
 */
function encodeInto(
  text: string,
  from: number,
  to: number,
  out: Uint8Array,
  at: number,
): { at: number; next: number } {
  let o = at;
  let i = from;
  for (; i < to; i++) {
    let cp = text.charCodeAt(i);
    if (cp >= 0xd800 && cp <= 0xdbff && i + 1 < text.length) {
      const low = text.charCodeAt(i + 1);
      if (low >= 0xdc00 && low <= 0xdfff) {
        cp = 0x10000 + ((cp - 0xd800) << 10) + (low - 0xdc00);
        i++;
      }
    }
    if (cp < 0x80) {
      out[o++] = cp;
    } else if (cp < 0x800) {
      out[o++] = 0xc0 | (cp >> 6);
      out[o++] = 0x80 | (cp & 0x3f);
    } else if (cp < 0x10000) {
      out[o++] = 0xe0 | (cp >> 12);
      out[o++] = 0x80 | ((cp >> 6) & 0x3f);
      out[o++] = 0x80 | (cp & 0x3f);
    } else {
      out[o++] = 0xf0 | (cp >> 18);
      out[o++] = 0x80 | ((cp >> 12) & 0x3f);
      out[o++] = 0x80 | ((cp >> 6) & 0x3f);
      out[o++] = 0x80 | (cp & 0x3f);
    }
  }
  return { at: o, next: i };
}

/** string → UTF-8. Synchronous: for short strings - a key, a filename, a header. */
export function encodeUtf8(text: string): Uint8Array {
  // 4 bytes is the most any UTF-16 unit can become, so this never grows.
  const out = new Uint8Array(text.length * 4);
  return out.subarray(0, encodeInto(text, 0, text.length, out, 0).at);
}

/**
 * string → UTF-8, yielding to the scheduler between slices.
 *
 * For anything whose size the USER controls - above all the backup payload, which is the JSON of
 * every message in the archive. The sync version holds the JS thread for the whole conversion: no
 * frame renders, no touch is answered, and since backups became automatic that happened eight
 * seconds after any sync, while the person was still scrolling. Hermes has no JIT, so "it is only a
 * loop" is not a defence.
 */
export async function encodeUtf8Async(text: string): Promise<Uint8Array> {
  const out = new Uint8Array(text.length * 4);
  let at = 0;
  let from = 0;
  while (from < text.length) {
    const to = Math.min(from + ENCODE_SLICE, text.length);
    // `next`, not `to`: the slice may have consumed one unit past its end to finish a surrogate pair.
    const done = encodeInto(text, from, to, out, at);
    at = done.at;
    from = done.next;
    if (from < text.length) {
      await yieldToScheduler();
    }
  }
  return out.subarray(0, at);
}

/** How many bytes one `decodeUtf8Async` slice decodes before yielding - `ENCODE_SLICE`, reversed. */
const DECODE_SLICE = 262144;

/**
 * UTF-8 → string, yielding to the scheduler between slices (004, the signed original).
 *
 * For text whose size ISDS controls: a signed message's XML is as large as the documents inside it.
 * A slice never ends inside a character - the cut backs off over continuation bytes - so every slice
 * decodes exactly as the whole would, including a malformed sequence, which still becomes one U+FFFD.
 */
export async function decodeUtf8Async(bytes: Uint8Array): Promise<string> {
  if (bytes.length <= DECODE_SLICE) {
    return decodeUtf8(bytes);
  }
  const parts: string[] = [];
  let from = 0;
  while (from < bytes.length) {
    let to = Math.min(from + DECODE_SLICE, bytes.length);
    // At most three continuation bytes can belong to a character that starts before the cut.
    for (let back = 0; back < 3 && to < bytes.length && (bytes[to] & 0xc0) === 0x80; back++) {
      to--;
    }
    parts.push(decodeUtf8(bytes.subarray(from, to)));
    from = to;
    if (from < bytes.length) {
      await yieldToScheduler();
    }
  }
  return parts.join('');
}

/** One macrotask boundary: lets the UI thread render a frame and deliver touches. */
export function yieldToScheduler(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

class HermesTextDecoder {
  readonly encoding: string;
  readonly fatal = false;
  readonly ignoreBOM: boolean;

  constructor(label = 'utf-8', options: { ignoreBOM?: boolean } = {}) {
    this.encoding = String(label).toLowerCase();
    this.ignoreBOM = options?.ignoreBOM ?? false;
  }

  decode(input?: DecodeInput): string {
    const bytes = toBytes(input);
    const text = decodeUtf8(bytes);
    // `ignoreBOM: true` means "leave the BOM in the output" (the confusing name is the spec's).
    return !this.ignoreBOM && text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  }
}

class HermesTextEncoder {
  readonly encoding = 'utf-8';
  encode(text = ''): Uint8Array {
    return encodeUtf8(String(text));
  }
}

/** Install both on `globalThis` if the engine has none. Safe to call repeatedly. */
export function installTextCodecs(): void {
  const g = globalThis as unknown as {
    TextDecoder?: unknown;
    TextEncoder?: unknown;
  };
  if (typeof g.TextDecoder !== 'function') {
    g.TextDecoder = HermesTextDecoder;
  }
  if (typeof g.TextEncoder !== 'function') {
    g.TextEncoder = HermesTextEncoder;
  }
}
