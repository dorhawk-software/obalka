// The file itself: a real zip, readable by anything, saying plainly what it holds.
//
// "The user can open it" is the whole consent model of this feature, so it is worth proving that the
// zip really is a zip and that its two members really are plain text.
//
// And that making it does not freeze the app (Principle I). The archive used to come out of one
// `zipSync` at level 9 followed by a per-character base64 loop, both in a single synchronous stretch
// over a trail of up to 4 MB. It is built in slices now, and the tests below hold both halves of that
// promise: the event loop gets turns while the work runs, and the archive unzips to exactly the
// members, byte for byte, that the one-shot `zipSync` made from the same input.

import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import RNBlobUtil from 'react-native-blob-util';
import {
  buildManifest,
  bundleFileName,
  toBase64Async,
  toNdjson,
  writeBundle,
  zipBundle,
  type BundleManifest,
} from '../../src/services/debug/debugBundle';
import type { DebugEntry } from '../../src/services/debug/debugLog';

const ENTRIES: DebugEntry[] = [
  { t: 1_757_500_000_000, kind: 'trace', message: 'isds.listReceived', data: { httpStatus: 200 } },
  { t: 1_757_500_001_000, kind: 'failure', message: 'isds.download: TypeError' },
];

const manifest = (level: 'standard' | 'full' = 'standard') =>
  buildManifest({
    appVersion: '0.0.1',
    level,
    startedAt: 1_757_500_000_000,
    endedAt: 1_757_500_002_000,
    entries: ENTRIES.length,
    dropped: 0,
  });

/** What one `zipSync` at level 9 made of the same input: the archive as it was built before. */
function reference(m: BundleManifest, entries: readonly DebugEntry[]) {
  return unzipSync(
    zipSync(
      {
        'manifest.json': strToU8(JSON.stringify(m, null, 2)),
        'log.ndjson': strToU8(toNdjson(entries)),
      },
      { level: 9 },
    ),
  );
}

/** Same member names, and every member identical byte for byte. */
function expectSameMembers(
  actual: Record<string, Uint8Array>,
  expected: Record<string, Uint8Array>,
) {
  expect(Object.keys(actual).sort()).toEqual(Object.keys(expected).sort());
  for (const name of Object.keys(expected)) {
    expect(actual[name].length).toBe(expected[name].length);
    expect(Buffer.from(actual[name]).equals(Buffer.from(expected[name]))).toBe(true);
  }
}

/**
 * How many macrotask turns the event loop got while `work` ran.
 *
 * A timer that re-arms itself on every turn stands in for the UI: each time it runs is a moment a
 * frame could have rendered or a touch been answered. Work that never yields lets it run zero times,
 * however long it takes.
 */
async function turnsDuring<T>(work: () => Promise<T>): Promise<{ result: T; turns: number }> {
  let turns = 0;
  let running = true;
  const tick = () => {
    if (running) {
      turns += 1;
      setTimeout(tick, 0);
    }
  };
  setTimeout(tick, 0);
  try {
    const result = await work();
    return { result, turns };
  } finally {
    running = false;
  }
}

/**
 * A trail shaped like a Full recording: envelopes in Czech with an emoji in them, and bodies of
 * pseudo-random letters that compress poorly, the way attachment content does.
 */
function fullTrail(charsWanted: number): DebugEntry[] {
  const out: DebugEntry[] = [];
  let chars = 0;
  let seed = 1;
  for (let i = 0; chars < charsWanted; i++) {
    let body = '';
    if (i % 4 === 0) {
      const letters: string[] = [];
      for (let k = 0; k < 20_000; k++) {
        seed = (seed * 48_271) % 2_147_483_647;
        letters.push(String.fromCharCode(65 + (seed % 26)));
      }
      body = letters.join('');
    } else {
      body = `<dmAnnotation>Rozhodnutí o dani č. ${i} 📨</dmAnnotation>`.repeat(40);
    }
    const entry: DebugEntry = {
      t: 1_757_500_000_000 + i,
      kind: 'http.body',
      message: `← 200 /DS/dz ${i}`,
      data: { body },
    };
    chars += JSON.stringify(entry).length;
    out.push(entry);
  }
  return out;
}

describe('the zip', () => {
  it('is a real zip holding exactly two plain-text members', async () => {
    const files = unzipSync(await zipBundle(manifest(), ENTRIES));
    expect(Object.keys(files).sort()).toEqual(['log.ndjson', 'manifest.json']);
  });

  it('round-trips the trail', async () => {
    const files = unzipSync(await zipBundle(manifest(), ENTRIES));
    const lines = strFromU8(files['log.ndjson']).split('\n');
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0])).toEqual(ENTRIES[0]);
  });

  it('compresses, which is the point of a log of envelopes', async () => {
    const repetitive: DebugEntry[] = Array.from({ length: 200 }, (_, i) => ({
      t: i,
      kind: 'http.body',
      message: '← 200 /DS/dz',
      data: { body: '<dmDm><dmID>1</dmID></dmDm>'.repeat(20) },
    }));
    const raw = toNdjson(repetitive).length;
    expect((await zipBundle(manifest('full'), repetitive)).length).toBeLessThan(raw / 4);
  });
});

describe('built without holding the JS thread (Principle I)', () => {
  it('yields while it compresses, and makes the same archive zipSync did', async () => {
    const m = manifest('full');
    const trail = fullTrail(600_000);
    const { result, turns } = await turnsDuring(() => zipBundle(m, trail));
    // About one turn per 16 KB of trail. The old one-shot build gave the loop none at all.
    expect(turns).toBeGreaterThanOrEqual(20);
    expectSameMembers(unzipSync(result), reference(m, trail));
  });

  it('slices an entry larger than a slice, instead of spending one long turn on it', async () => {
    // One clamped SOAP body is up to 64k characters, and in Czech each of them can be two bytes.
    const huge: DebugEntry[] = [
      { t: 1, kind: 'http.body', message: '← 200 /DS/dz', data: { body: 'žluťoučký kůň '.repeat(10_000) } },
    ];
    const { result, turns } = await turnsDuring(() => zipBundle(manifest('full'), huge));
    expect(turns).toBeGreaterThanOrEqual(5);
    expectSameMembers(unzipSync(result), reference(manifest('full'), huge));
  });

  it('keeps every character whole where the slices meet', async () => {
    // Entry sizes that walk across the slice boundary one character at a time, in text where a cut
    // in the wrong place would split a two-byte letter or an emoji's surrogate pair.
    const trail: DebugEntry[] = [];
    for (let i = 0; i < 40; i++) {
      trail.push({
        t: i,
        kind: 'console',
        message: `${'ř'.repeat(8_000 + i)}😀${'a'.repeat(i)}`,
      });
    }
    const m = manifest('full');
    const { result, turns } = await turnsDuring(() => zipBundle(m, trail));
    // The claim is only worth something if the trail really was cut: about 640 KB of mostly two-byte
    // text, in slices of 16 KB whose edges land inside characters. A one-shot build has no edges.
    expect(turns).toBeGreaterThanOrEqual(20);
    expectSameMembers(unzipSync(result), reference(m, trail));
  });

  it('turns a compression failure into a rejection rather than a silently broken file', async () => {
    // fflate reports stream errors through a callback, not by throwing. A bundle that swallowed one
    // would write a truncated zip and tell the screen it was saved (Principle II).
    let broken: typeof zipBundle | undefined;
    jest.isolateModules(() => {
      jest.doMock('fflate', () => {
        const actual = jest.requireActual<typeof import('fflate')>('fflate');
        class FailingDeflate extends actual.ZipDeflate {
          push(chunk: Uint8Array, final?: boolean) {
            if (this.filename === 'log.ndjson') {
              this.ondata(new Error('deflate failed') as never, new Uint8Array(0), !!final);
              return;
            }
            super.push(chunk, final);
          }
        }
        return { ...actual, ZipDeflate: FailingDeflate };
      });
      broken = (
        require('../../src/services/debug/debugBundle') as typeof import('../../src/services/debug/debugBundle')
      ).zipBundle;
    });
    jest.dontMock('fflate');
    await expect(broken!(manifest(), ENTRIES)).rejects.toThrow('deflate failed');
  });

  it('encodes base64 exactly, padding included, on both sides of every slice boundary', async () => {
    const SLICE = 3 * 16_384;
    let seed = 7;
    for (const length of [0, 1, 2, 3, 4, SLICE - 1, SLICE, SLICE + 1, SLICE + 2, 2 * SLICE + 1]) {
      const bytes = new Uint8Array(length);
      for (let i = 0; i < length; i++) {
        seed = (seed * 48_271) % 2_147_483_647;
        bytes[i] = seed & 0xff;
      }
      expect(await toBase64Async(bytes)).toBe(Buffer.from(bytes).toString('base64'));
    }
  });

  it('yields between base64 slices', async () => {
    const bytes = new Uint8Array(6 * 3 * 16_384 + 1);
    const { result, turns } = await turnsDuring(() => toBase64Async(bytes));
    expect(turns).toBeGreaterThanOrEqual(4);
    expect(result).toBe(Buffer.from(bytes).toString('base64'));
  });

  it('writes a file that decodes to the same archive, and yields all the way to the write', async () => {
    const m = manifest('full');
    const trail = fullTrail(300_000);
    const at = new Date('2026-09-14T10:00:00').getTime();
    const { result: path, turns } = await turnsDuring(() => writeBundle(m, trail, at));
    expect(turns).toBeGreaterThanOrEqual(10);
    expect(path).toBe(`/docs/debug/${bundleFileName(at, 'full')}`);
    const written = (await RNBlobUtil.fs.readFile(path, 'base64')) as string;
    expectSameMembers(unzipSync(new Uint8Array(Buffer.from(written, 'base64'))), reference(m, trail));
  });
});

describe('the file on disk', () => {
  /** The trail a written bundle holds, read back from the file. */
  async function trailIn(path: string): Promise<string> {
    const base64 = (await RNBlobUtil.fs.readFile(path, 'base64')) as string;
    return strFromU8(unzipSync(new Uint8Array(Buffer.from(base64, 'base64')))['log.ndjson']);
  }

  it('never replaces a bundle stopped in the same minute', async () => {
    // Recording again straight after a first try that missed the bug is the ordinary case. Both
    // bundles are named after the same minute, and the native write replaces a file of that name.
    const m = manifest('standard');
    const at = new Date('2026-09-14T11:00:05').getTime();
    const first = await writeBundle(m, [{ t: 1, kind: 'trace', message: 'first try' }], at);
    const second = await writeBundle(m, [{ t: 2, kind: 'trace', message: 'second try' }], at + 20_000);
    const third = await writeBundle(m, [{ t: 3, kind: 'trace', message: 'third try' }], at + 40_000);

    expect(first).toBe(`/docs/debug/${bundleFileName(at, 'standard')}`);
    expect(second).toBe(first.replace(/\.zip$/, '-2.zip'));
    expect(third).toBe(first.replace(/\.zip$/, '-3.zip'));
    expect(await trailIn(first)).toContain('first try');
    expect(await trailIn(second)).toContain('second try');
    expect(await trailIn(third)).toContain('third try');
  });
});

describe('the manifest', () => {
  it('says what the bundle contains, in both languages', () => {
    // FR-004 and Principle VI: a bundle the user cannot understand is a bundle they cannot consent
    // to sharing, and the person who eventually opens it may not be the person who made it.
    const m = manifest('full');
    expect(m.contents.cs).toContain('Přihlašovací údaje');
    expect(m.contents.en).toContain('Credentials');
    expect(m.contents.en).toContain('message text'); // full mode says so plainly
  });

  it('does not claim the standard bundle carries mail', () => {
    expect(manifest('standard').contents.en).toContain('No message text');
  });

  it('carries the version and the window, which is what dates a bug', () => {
    const m = manifest();
    expect(m.appVersion).toBe('0.0.1');
    expect(m.startedAt).toBe(new Date(1_757_500_000_000).toISOString());
    expect(m.entries).toBe(2);
  });
});

describe('the file name', () => {
  it('sorts chronologically and says its level out loud', () => {
    const name = bundleFileName(new Date('2026-09-10T14:32:00').getTime(), 'full');
    expect(name).toMatch(/^obalka-debug-2026-09-10-1432-full\.zip$/);
  });
});

describe('ndjson', () => {
  it('is one object per line, so a truncated file still parses', () => {
    const text = toNdjson(ENTRIES);
    for (const line of text.split('\n')) {
      expect(() => JSON.parse(line)).not.toThrow();
    }
  });

  it('handles an empty trail', async () => {
    expect(toNdjson([])).toBe('');
    const files = unzipSync(await zipBundle(manifest(), []));
    expect(Object.keys(files).sort()).toEqual(['log.ndjson', 'manifest.json']);
    expectSameMembers(files, reference(manifest(), []));
  });
});
