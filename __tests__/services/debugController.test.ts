// Stopping a recording, now that stopping no longer holds the JS thread.
//
// Building the archive yields to the UI (Principle I), so the app keeps answering while a bundle is
// written - and two things that could not happen while the build froze everything now can: a second
// "Ukončit a uložit" arriving mid-write, and a new recording starting before the last one is on disk.
// Each test below is one of those, and each produced a wrong result before the controller knew.
//
// A third arrives with them: the Debug screen can be left during a save and opened again, and a
// recording started there, then stopped before the older save is on disk, is a recording of its own.

import { strFromU8, unzipSync } from 'fflate';
import RNBlobUtil from 'react-native-blob-util';
import {
  cancelDebug,
  debugSaveInFlight,
  startDebug,
  stopDebugAndWrite,
} from '../../src/services/debug/debugController';
import {
  debugSnapshot,
  isDebugRecording,
  record,
} from '../../src/services/debug/debugLog';
import { yieldToScheduler } from '../../src/services/text/textCodec';

/**
 * Every push into a zip member, in the order the archives made them: `<member>` for a slice and
 * `<member> closed` for the push that ends it. The real fflate still does the work; this only watches,
 * so a test can see whether two archives were ever being built at the same time.
 */
const mockZipPushes: string[] = [];
jest.mock('fflate', () => {
  const actual = jest.requireActual('fflate');
  class WatchedZipDeflate extends actual.ZipDeflate {
    push(chunk: Uint8Array, final?: boolean) {
      mockZipPushes.push(`${this.filename}${final ? ' closed' : ''}`);
      return super.push(chunk, final);
    }
  }
  return { ...actual, ZipDeflate: WatchedZipDeflate };
});

const writeFile = RNBlobUtil.fs.writeFile as jest.Mock;
/** The mock's own in-memory write, for a test that holds a write open and then lets it land. */
const storeFile = writeFile.getMockImplementation() as (...args: unknown[]) => Promise<void>;

/** The trail a written bundle holds, read back from the file. */
async function trailIn(path: string): Promise<string> {
  const base64 = (await RNBlobUtil.fs.readFile(path, 'base64')) as string;
  return strFromU8(unzipSync(new Uint8Array(Buffer.from(base64, 'base64')))['log.ndjson']);
}

async function until(condition: () => boolean): Promise<void> {
  for (let turn = 0; !condition(); turn++) {
    if (turn > 1000) {
      throw new Error('condition never held');
    }
    await yieldToScheduler();
  }
}

beforeEach(() => {
  cancelDebug();
  writeFile.mockClear();
});

afterEach(() => {
  cancelDebug();
});

it('hands a second stop the write already under way instead of writing the file twice', async () => {
  startDebug('standard');
  record('trace', 'isds.listReceived');
  const first = stopDebugAndWrite();
  const second = stopDebugAndWrite();
  expect(second).toBe(first);
  expect((await first).path).toMatch(/obalka-debug-.*-standard\.zip$/);
  expect(writeFile).toHaveBeenCalledTimes(1);

  // One write per stop, not one write ever: a failed write lets the next stop try again...
  writeFile.mockRejectedValueOnce(new Error('disk full'));
  startDebug('standard');
  await expect(stopDebugAndWrite()).rejects.toThrow('disk full');
  // ...and the next recording saves as normal.
  startDebug('standard');
  await stopDebugAndWrite();
  expect(writeFile).toHaveBeenCalledTimes(3);
});

it('lets a recording started during the last write keep its own trail', async () => {
  startDebug('standard');
  record('trace', 'the old recording');
  const stopping = stopDebugAndWrite();
  startDebug('full');
  record('trace', 'the new recording');
  await stopping;

  expect(isDebugRecording()).toBe(true);
  expect(debugSnapshot().some(e => e.message === 'the new recording')).toBe(true);

  // And a written trail is still cleared, so the mail it held lives only in the file.
  await stopDebugAndWrite();
  expect(debugSnapshot()).toEqual([]);
});

it('stops a recording started during the last save, instead of handing it that save', async () => {
  // Both stopped within one minute, so both bundles want the same file name.
  const now = jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-09-14T10:00:30').getTime());
  try {
    startDebug('standard');
    record('trace', 'the old recording');
    const first = stopDebugAndWrite();
    startDebug('standard');
    record('trace', 'the new recording');
    const second = stopDebugAndWrite();

    // Handed the older save, this stop used to leave the new recording running behind a screen
    // that said it had stopped, and its trail was never written.
    expect(second).not.toBe(first);
    expect(isDebugRecording()).toBe(false);
    expect(debugSaveInFlight()).toBe(second);

    const [older, newer] = await Promise.all([first, second]);
    expect(newer.path).not.toBe(older.path);
    expect(await trailIn(older.path)).toContain('the old recording');
    expect(await trailIn(older.path)).not.toContain('the new recording');
    expect(await trailIn(newer.path)).toContain('the new recording');
    expect(await trailIn(newer.path)).not.toContain('the old recording');
    expect(debugSaveInFlight()).toBeNull();
  } finally {
    now.mockRestore();
  }
});

it('writes a bundle only once the one before it is on disk', async () => {
  let release: () => void = () => {};
  writeFile.mockImplementationOnce(async (...args: unknown[]) => {
    await new Promise<void>(resolve => {
      release = resolve;
    });
    await storeFile(...args);
  });
  startDebug('standard');
  record('trace', 'first');
  const first = stopDebugAndWrite();
  startDebug('full');
  record('trace', 'second');
  const second = stopDebugAndWrite();

  await until(() => writeFile.mock.calls.length === 1);
  // A trail this short is zipped and encoded in a handful of turns. Give the second save many more
  // than that: it must still be waiting, because the first write has not finished.
  for (let turn = 0; turn < 50; turn++) {
    await yieldToScheduler();
  }
  expect(writeFile).toHaveBeenCalledTimes(1);

  release();
  await Promise.all([first, second]);
  expect(writeFile).toHaveBeenCalledTimes(2);
});

it('never builds two archives at once: a save stopped mid-compression waits for the one before it', async () => {
  // The test above holds the native WRITE, which comes after the archive is built, so a queue that
  // waited only for the write would pass it while two archives were deflated turn about. This one holds
  // nothing: it stops a second recording while the first archive is still being compressed, and reads
  // the order of the pushes (review, 2026-09-15).
  mockZipPushes.length = 0;
  for (let i = 0; i < 2; i++) {
    writeFile.mockImplementationOnce(async (...args: unknown[]) => {
      mockZipPushes.push('written');
      await storeFile(...args);
    });
  }
  startDebug('full');
  // About 100 KB of trail: several 16 KB slices, each its own turn.
  for (let i = 0; i < 100; i++) {
    record('trace', `first ${i} ${'x'.repeat(1_000)}`);
  }
  const first = stopDebugAndWrite();
  await until(() => mockZipPushes.includes('log.ndjson'));
  // Provably mid-compression: the first archive's log has taken a slice and is not closed yet.
  expect(mockZipPushes).not.toContain('log.ndjson closed');

  startDebug('standard');
  record('trace', 'second');
  const second = stopDebugAndWrite();
  const [older, newer] = await Promise.all([first, second]);

  // The first archive from its manifest to its write, with nothing of the second anywhere inside it...
  const firstWritten = mockZipPushes.indexOf('written');
  const firstArchive = mockZipPushes.slice(0, firstWritten);
  expect(firstArchive.length).toBeGreaterThan(3);
  expect(firstArchive[0]).toBe('manifest.json closed');
  expect(firstArchive.slice(1, -1).every(push => push === 'log.ndjson')).toBe(true);
  expect(firstArchive[firstArchive.length - 1]).toBe('log.ndjson closed');
  // ...and the second one begun only once the first was on disk.
  expect(mockZipPushes.slice(firstWritten + 1)).toEqual([
    'manifest.json closed',
    'log.ndjson closed',
    'written',
  ]);
  expect(await trailIn(older.path)).toContain('first 99');
  expect(await trailIn(newer.path)).toContain('second');
  expect(await trailIn(newer.path)).not.toContain('first 0');
});
