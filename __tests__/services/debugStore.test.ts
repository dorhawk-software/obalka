// The saved bundles, as the Debug screen lists them (023).
//
// Constitution II: a failure has to reach the screen as a failure. `listBundles` returned no bundles on
// any error until 2026-09-15, so a folder nobody could read was shown as a folder with nothing in it,
// and a bundle whose stat failed was dropped from the list without a word - a file that may hold the
// user's mail, hidden from the one screen that can delete it.

import RNBlobUtil from 'react-native-blob-util';
import { bundleDir, bundleFileName } from '../../src/services/debug/debugBundle';
import {
  BundleListTimeoutError,
  deleteAllBundles,
  deleteBundle,
  listBundles,
  LIST_TIMEOUT_MS,
} from '../../src/services/debug/debugStore';

const fs = RNBlobUtil.fs as unknown as {
  writeFile: jest.Mock;
  unlink: jest.Mock;
  exists: jest.Mock;
  stat: jest.Mock;
  ls: jest.Mock;
};

/** The in-memory stat, which knows a size but no modification time. */
const statFile = fs.stat.getMockImplementation() as (path: string) => Promise<{ size: number }>;

const save = (name: string) =>
  fs.writeFile(`${bundleDir()}/${name}`, 'UEsFBgAAAAAAAAAAAAAAAAAAAAAAAA==', 'base64');

const nameAt = (when: string) => bundleFileName(Date.parse(when), 'standard');

beforeEach(async () => {
  await fs.unlink(bundleDir());
});

afterEach(() => {
  fs.stat.mockImplementation(statFile);
});

describe('listing the saved bundles', () => {
  it('rejects when the folder cannot be read, rather than calling it empty', async () => {
    // No folder yet is still no bundles: nothing was ever saved, and that is not a failure.
    await expect(listBundles()).resolves.toEqual([]);

    await save(nameAt('2026-09-14T09:00:00'));
    fs.ls.mockRejectedValueOnce(new Error('EACCES'));
    await expect(listBundles()).rejects.toThrow('EACCES');
  });

  it('rejects when it cannot tell whether the folder is there', async () => {
    fs.exists.mockRejectedValueOnce(new Error('EIO'));
    await expect(listBundles()).rejects.toThrow('EIO');
  });

  it('keeps a bundle whose size cannot be read, with the size unknown', async () => {
    const readable = nameAt('2026-09-14T09:00:00');
    const unreadable = nameAt('2026-09-14T10:00:00');
    await save(readable);
    await save(unreadable);
    fs.stat.mockImplementation(async (path: string) => {
      if (path.endsWith(unreadable)) {
        throw new Error('EACCES');
      }
      return statFile(path);
    });

    const bundles = await listBundles();

    expect(bundles.map(b => b.name)).toEqual([readable, unreadable]);
    expect(bundles[0].bytes).toEqual(expect.any(Number));
    expect(bundles[1]).toEqual({
      name: unreadable,
      path: `${bundleDir()}/${unreadable}`,
      bytes: null,
      at: null,
    });
  });

  it('orders a bundle with no readable time by the minute its name was stopped in', async () => {
    // Oldest first is what keeps the rows still when a save ends (constitution V), so a bundle with no
    // time of its own still needs a place in that order, and its name carries the minute it stopped.
    const nine = nameAt('2026-09-14T09:00:00');
    const ten = nameAt('2026-09-14T10:00:00');
    const eleven = nameAt('2026-09-14T11:00:00');
    for (const name of [eleven, ten, nine]) {
      await save(name);
    }
    fs.stat.mockImplementation(async (path: string) => {
      if (path.endsWith(ten)) {
        throw new Error('EACCES');
      }
      return {
        ...(await statFile(path)),
        lastModified: Date.parse(
          path.endsWith(nine) ? '2026-09-14T09:00:30' : '2026-09-14T11:00:30',
        ),
      };
    });

    expect((await listBundles()).map(b => b.name)).toEqual([nine, ten, eleven]);
  });

  it('refuses to report every bundle deleted when the folder could not be read', async () => {
    const name = nameAt('2026-09-14T09:00:00');
    await save(name);
    fs.ls.mockRejectedValueOnce(new Error('EACCES'));

    await expect(deleteAllBundles()).rejects.toThrow('EACCES');
    expect((await listBundles()).map(b => b.name)).toEqual([name]);
  });

  it('gives up on a folder that does not answer in time, and only on one that does not', async () => {
    // A read of the app's own documents folder answers in milliseconds. One that never answered left the
    // Debug screen's saved files a blank row for as long as the screen stayed open (2026-09-15).
    const name = nameAt('2026-09-14T09:00:00');
    await save(name);
    jest.useFakeTimers();
    try {
      // Answered in time: listed, and no timer left behind to reject a read that already answered.
      await expect(listBundles()).resolves.toEqual([expect.objectContaining({ name })]);
      expect(jest.getTimerCount()).toBe(0);

      fs.ls.mockImplementationOnce(() => new Promise<string[]>(() => {}));
      let outcome: unknown = 'pending';
      void listBundles().then(
        () => {
          outcome = 'answered';
        },
        (error: unknown) => {
          outcome = error;
        },
      );
      await jest.advanceTimersByTimeAsync(LIST_TIMEOUT_MS - 1);
      expect(outcome).toBe('pending');
      await jest.advanceTimersByTimeAsync(1);
      expect(outcome).toBeInstanceOf(BundleListTimeoutError);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('deleting a saved bundle', () => {
  it('rejects when the file is still there after the delete, and not when it is already gone', async () => {
    const name = nameAt('2026-09-14T09:00:00');
    const path = `${bundleDir()}/${name}`;
    await save(name);
    fs.unlink.mockRejectedValueOnce(new Error('EACCES'));
    await expect(deleteBundle(path)).rejects.toThrow('EACCES');
    expect((await listBundles()).map(b => b.name)).toEqual([name]);

    // Gone already - deleted from somewhere else, or twice - is what a delete is for.
    await fs.unlink(path);
    fs.unlink.mockRejectedValueOnce(new Error('ENOENT'));
    await expect(deleteBundle(path)).resolves.toBeUndefined();
  });

  it('deletes every bundle it can before saying one would not go', async () => {
    const stuck = nameAt('2026-09-14T09:00:00');
    const other = nameAt('2026-09-14T10:00:00');
    await save(stuck);
    await save(other);
    fs.unlink.mockImplementationOnce(async (path: string) => {
      throw new Error(`EACCES ${path}`);
    });

    await expect(deleteAllBundles()).rejects.toThrow(`EACCES ${bundleDir()}/${stuck}`);
    expect((await listBundles()).map(b => b.name)).toEqual([stuck]);
  });
});
