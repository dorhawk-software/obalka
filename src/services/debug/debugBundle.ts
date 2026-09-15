// Turning the trail into a file the user can open, read, share or delete.
//
// THERE IS NO NETWORK CODE IN THIS FILE, and that is a property rather than an omission:
// `__tests__/services/debugNoUpload.test.ts` reads this directory and fails if `fetch`, `XMLHttpRequest`,
// `WebSocket` or the Sentry SDK appears anywhere in it. The promise the Settings screen makes to the
// user is "nothing is ever sent by itself", and a promise that rests on nobody adding an import later
// is not a promise.
//
// The zip holds two plain-text members on purpose. A user cannot consent to sharing a file they
// cannot inspect, so `manifest.json` says what the bundle is and `log.ndjson` is one JSON object per
// line - readable in any text editor, greppable, and diffable.
//
// `fflate` rather than a native zip module: it is pure JavaScript, so this feature adds no build
// step to either platform, and deflate matters here because a log of SOAP envelopes is the most
// compressible thing this app will ever produce.
//
// PURE JAVASCRIPT ALSO MEANS THE JS THREAD (Principle I). This file first called `zipSync` at level 9
// and then a character-by-character base64 loop, both in one synchronous stretch over a trail of up
// to 4 MB: from the tap on "Ukončit a uložit" until the archive existed, no frame rendered and no
// touch was answered. Both steps now work in slices and yield to the scheduler between them, the same
// shape as `encodeUtf8Async` and `argon2idAsync`. fflate's own async API is no way out: its browser
// build, the one Metro bundles, hands the work to a Web Worker, and React Native has none.

import { Platform } from 'react-native';
import RNBlobUtil from 'react-native-blob-util';
import { strToU8, Zip, ZipDeflate } from 'fflate';
import { yieldToScheduler } from '../text/textCodec';
import type { DebugEntry, DebugLevel } from './debugLog';

/** Where bundles live: the app's own documents directory, visible to the OS share sheet. */
export function bundleDir(): string {
  return `${RNBlobUtil.fs.dirs.DocumentDir}/debug`;
}

export interface BundleManifest {
  app: string;
  appVersion: string;
  platform: string;
  osVersion: string;
  level: DebugLevel;
  startedAt: string;
  endedAt: string;
  entries: number;
  dropped: number;
  /** What is in here, in the app's two languages, for whoever opens the zip. */
  contents: { cs: string; en: string };
}

const CONTENTS: Record<DebugLevel, { cs: string; en: string }> = {
  standard: {
    cs: 'Technický záznam bez obsahu zpráv. Obsahuje operace, časy, stavové kódy HTTP a ISDS a chybová hlášení. Neobsahuje texty zpráv, přílohy, jména, ID schránek ani přihlašovací údaje.',
    en: 'A technical trail with no message content. Operations, timings, HTTP and ISDS status codes and error messages. No message text, attachments, names, box IDs or credentials.',
  },
  full: {
    cs: 'Podrobný technický záznam VČETNĚ obsahu komunikace s ISDS: odeslaná a přijatá data, tedy i texty vašich zpráv a údaje o nich. Přihlašovací údaje ani hesla v něm nejsou nikdy. Sdílejte jen s někým, komu důvěřujete.',
    en: 'A detailed technical trail INCLUDING the ISDS traffic: what was sent and received, so your message text and details about it are in here. Credentials and passwords never are. Share it only with someone you trust.',
  },
};

export function buildManifest(input: {
  appVersion: string;
  level: DebugLevel;
  startedAt: number;
  endedAt: number;
  entries: number;
  dropped: number;
}): BundleManifest {
  return {
    app: 'Obálka',
    appVersion: input.appVersion,
    platform: Platform.OS,
    osVersion: String(Platform.Version),
    level: input.level,
    startedAt: new Date(input.startedAt).toISOString(),
    endedAt: new Date(input.endedAt).toISOString(),
    entries: input.entries,
    dropped: input.dropped,
    contents: CONTENTS[input.level],
  };
}

/** One JSON object per line. Deliberately not a JSON array: a truncated file still parses line by line. */
export function toNdjson(entries: readonly DebugEntry[]): string {
  return entries.map(e => JSON.stringify(e)).join('\n');
}

/** `obalka-debug-2026-09-10-1432-full.zip` - sorts chronologically and says its level in its name. */
export function bundleFileName(at: number, level: DebugLevel): string {
  const d = new Date(at);
  const p = (n: number) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(
    d.getMinutes(),
  )}`;
  return `obalka-debug-${stamp}-${level}.zip`;
}

/**
 * Bytes of the trail one compression turn deflates before it yields.
 *
 * Deflate at level 9 is the most expensive work per byte in this feature, so this number sets the
 * longest pause that stopping a recording can cause. Measured on 2026-09-14 under `node --jitless` -
 * V8 with its JIT off, standing in for Hermes, which has none - on a shared, loaded development
 * machine, over a 4.2 MB trail shaped like a Full recording (envelopes plus base64 bodies): one
 * `zipSync` held the thread for 2.2 to 7.0 s across runs; in slices of this size the median turn took
 * 9-10 ms and the 95th percentile 13-15 ms, for an archive 0.02% larger (each push of 8 KB or more
 * ends a deflate block). Slices of 64 KB had a median turn of 33-63 ms. That is a proxy, not a device
 * measurement; what the tests hold is the shape - the work yields, and the archive is unchanged.
 */
const ZIP_SLICE = 16_384;

/** Bytes one base64 turn encodes. A multiple of three, so only the very last turn can need padding. */
const BASE64_SLICE = 3 * 16_384;

/** `String.fromCharCode` takes the bytes as arguments, and a call stack only holds so many. */
const CHAR_CODE_CHUNK = 8_192;

/**
 * The zip's bytes. Unzips to exactly what one `zipSync` at level 9 produced from the same input - the
 * same two members, byte for byte - but gets there in turns of at most `ZIP_SLICE` bytes, yielding to
 * the scheduler after each one (Principle I).
 *
 * The trail is serialised entry by entry, so the whole NDJSON string never exists at once either.
 * Lines are grouped and encoded whole, and the `\n` between two groups is ASCII, so the UTF-8 of the
 * groups, one after another, is the UTF-8 of the full text. The byte slices handed to deflate may cut
 * a character in two, which deflate, working on bytes, does not care about.
 */
export async function zipBundle(
  manifest: BundleManifest,
  entries: readonly DebugEntry[],
): Promise<Uint8Array> {
  const parts: Uint8Array[] = [];
  // fflate reports a failure through this callback rather than throwing it. Kept, and rethrown by
  // `settle` straight after the push that caused it, so it leaves this function as a rejection - which
  // the controller turns into the screen's "could not be saved" (Principle II) - instead of vanishing.
  const outcome: { failure: Error | null } = { failure: null };
  const zip = new Zip((err, data) => {
    if (err) {
      outcome.failure = outcome.failure ?? err;
      return;
    }
    parts.push(data);
  });
  const settle = () => {
    if (outcome.failure) {
      throw outcome.failure;
    }
  };

  const manifestFile = new ZipDeflate('manifest.json', { level: 9 });
  zip.add(manifestFile);
  // A page of JSON: one push is one short turn.
  manifestFile.push(strToU8(JSON.stringify(manifest, null, 2)), true);
  settle();

  const log = new ZipDeflate('log.ndjson', { level: 9 });
  zip.add(log);
  let pending = '';
  for (let i = 0; i < entries.length; i++) {
    pending += (i === 0 ? '' : '\n') + JSON.stringify(entries[i]);
    if (pending.length >= ZIP_SLICE) {
      await deflateInSlices(log, strToU8(pending), false, settle);
      pending = '';
    }
  }
  // Always a final push, even an empty one: it is what closes the member, and an empty trail is still
  // a valid, empty `log.ndjson`.
  await deflateInSlices(log, strToU8(pending), true, settle);
  zip.end();
  settle();
  return concat(parts);
}

/**
 * Hand `bytes` to one zip member at most `ZIP_SLICE` at a time, yielding after every push.
 *
 * Sliced by BYTES, not by entries: one entry can be far larger than a slice - a clamped SOAP body
 * alone is up to 64k characters - and turns sized by entries would last as long as the largest
 * envelope in the trail.
 */
async function deflateInSlices(
  file: ZipDeflate,
  bytes: Uint8Array,
  final: boolean,
  settle: () => void,
): Promise<void> {
  let at = 0;
  do {
    const end = Math.min(at + ZIP_SLICE, bytes.length);
    const closes = final && end === bytes.length;
    file.push(bytes.subarray(at, end), closes);
    settle();
    at = end;
    if (!closes) {
      await yieldToScheduler();
    }
  } while (at < bytes.length);
}

function concat(parts: readonly Uint8Array[]): Uint8Array {
  let length = 0;
  for (const part of parts) {
    length += part.length;
  }
  const out = new Uint8Array(length);
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/**
 * bytes → base64, yielding to the scheduler between slices.
 *
 * Base64 is how the archive crosses to the native file write, and it was the second synchronous
 * stretch after the zip: the old per-character loop took 377-435 ms over the 2.7 MB archive of the
 * measurement above. Each slice is now one `btoa` - the same call the backup's `writeBytes` already
 * relies on - over a whole number of three-byte groups, so the pieces join into exactly the standard,
 * padded encoding of the whole archive.
 */
export async function toBase64Async(bytes: Uint8Array): Promise<string> {
  const pieces: string[] = [];
  for (let from = 0; from < bytes.length; from += BASE64_SLICE) {
    if (from > 0) {
      await yieldToScheduler();
    }
    const to = Math.min(from + BASE64_SLICE, bytes.length);
    const binary: string[] = [];
    for (let i = from; i < to; i += CHAR_CODE_CHUNK) {
      binary.push(
        String.fromCharCode(...bytes.subarray(i, Math.min(i + CHAR_CODE_CHUNK, to))),
      );
    }
    pieces.push(btoa(binary.join('')));
  }
  return pieces.join('');
}

/**
 * Write the bundle to disk and return its path.
 *
 * Nothing here holds the JS thread for the whole bundle: the zip and the base64 each yield between
 * slices, and the write itself is native.
 */
export async function writeBundle(
  manifest: BundleManifest,
  entries: readonly DebugEntry[],
  at: number,
): Promise<string> {
  const dir = bundleDir();
  await RNBlobUtil.fs.mkdir(dir).catch(() => {
    /* already there is the desired state */
  });
  const zipped = await zipBundle(manifest, entries);
  const data = await toBase64Async(zipped);
  // Named after the slow part rather than before it, so the name is checked right before it is used.
  const path = await freeBundlePath(dir, bundleFileName(at, manifest.level));
  await RNBlobUtil.fs.writeFile(path, data, 'base64');
  return path;
}

/**
 * `name` in `dir`, or the same name with -2, -3, … when it is already taken.
 *
 * A bundle is named after the minute it was stopped, and two recordings ending within one minute is
 * the ordinary case of "the first one missed the bug, record it again". The native write replaces a
 * file of the same name, so the second bundle used to delete the first without a word.
 */
async function freeBundlePath(dir: string, name: string): Promise<string> {
  const stem = name.replace(/\.zip$/, '');
  let path = `${dir}/${name}`;
  let n = 1;
  while (await RNBlobUtil.fs.exists(path)) {
    n += 1;
    path = `${dir}/${stem}-${n}.zip`;
  }
  return path;
}
