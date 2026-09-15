// Keeping the app's data out of the phone's own backup on iOS (owner decision, 2026-09-24).
//
// The keys that open the archive never leave this phone, so what an iCloud or computer backup would
// carry readably is the plain files: attachments, signed originals, debug ZIPs and backup files, all
// under `Documents`, which iOS backs up by default. The launch step marks each app data location
// excluded (`NSURLIsExcludedFromBackupKey`, through blob-util). Android does the same in its manifest
// - `__tests__/security/androidBackupRules.test.ts` - so here it must do nothing.
//
// What a unit test can hold on to is which paths are marked, on which platform, and that a failure is
// reported without taking launch down. Whether a backup really leaves them out is the device's to
// show: Settings > [name] > iCloud > Manage Storage > Backups lists the app's size.

import { Platform } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';
import RNBlobUtil from 'react-native-blob-util';
import { excludeFromDeviceBackup } from '../../src/services/files/deviceBackupExclusion';
import { excludeAppDataFromDeviceBackup } from '../../src/features/accounts/deps';
import { reportFailure } from '../../src/services/telemetry/telemetry';
import App from '../../App';

jest.mock('../../src/services/telemetry/telemetry', () => ({
  ...jest.requireActual('../../src/services/telemetry/telemetry'),
  reportFailure: jest.fn(),
}));

const blob = RNBlobUtil as unknown as {
  fs: {
    dirs: { DocumentDir: string };
    mkdir: jest.Mock;
    writeFile: (path: string, data: string) => Promise<void>;
    unlink: (path: string) => Promise<void>;
  };
  ios: { excludeFromBackupKey: jest.Mock };
};
const report = reportFailure as jest.Mock;
const originalOS = Platform.OS;

function setOS(os: string) {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true, writable: true });
}

/** Every path marked, in order. */
function marked(): string[] {
  return blob.ios.excludeFromBackupKey.mock.calls.map(call => call[0] as string);
}

beforeEach(() => {
  setOS('ios');
  blob.ios.excludeFromBackupKey.mockReset().mockResolvedValue(undefined);
  blob.fs.mkdir.mockClear();
  report.mockClear();
});

afterEach(async () => {
  setOS(originalOS);
  for (const file of ['/library/obalka.db', '/library/obalka.db-wal']) {
    await blob.fs.unlink(file);
  }
});

describe('the launch step on iOS', () => {
  it('marks Documents and every data directory of the app in it', async () => {
    await excludeAppDataFromDeviceBackup();

    // `Documents` itself, which the app never deletes, then attachments + signed originals, backup
    // files and debug ZIPs - the directories whose files are readable without this phone's keys.
    expect(marked().slice(0, 4)).toEqual([
      '/docs',
      '/docs/attachments',
      '/docs/backups',
      '/docs/debug',
    ]);
  });

  it('marks the database where op-sqlite put it, with the sidecars that exist', async () => {
    await blob.fs.writeFile('/library/obalka.db', 'x');
    await blob.fs.writeFile('/library/obalka.db-wal', 'x');

    await excludeAppDataFromDeviceBackup();

    // No -shm on this "disk": a file that is not there is not an error, and is not marked.
    expect(marked().slice(4)).toEqual(['/library/obalka.db', '/library/obalka.db-wal']);
    expect(report).not.toHaveBeenCalled();
  });

  it('creates a directory that is not there yet before marking it', async () => {
    // A phone that has never made a backup has no `backups` - and nothing to carry the mark.
    await excludeAppDataFromDeviceBackup();

    const made = blob.fs.mkdir.mock.calls.map(call => call[0] as string);
    expect(made).toEqual(expect.arrayContaining(['/docs/backups', '/docs/debug']));
    const mkdirAt = blob.fs.mkdir.mock.invocationCallOrder[
      made.indexOf('/docs/backups')
    ];
    const markAt = blob.ios.excludeFromBackupKey.mock.invocationCallOrder[
      marked().indexOf('/docs/backups')
    ];
    expect(mkdirAt).toBeLessThan(markAt);
  });
});

describe('the app', () => {
  it('runs the step at launch, without waiting for anything on screen', async () => {
    await render(<App />);

    await waitFor(() => expect(marked()).toContain('/docs/attachments'));
  });
});

describe('on Android', () => {
  it('does nothing - the manifest keeps the app out of backup and transfer', async () => {
    setOS('android');

    await excludeAppDataFromDeviceBackup();

    expect(blob.ios.excludeFromBackupKey).not.toHaveBeenCalled();
    expect(blob.fs.mkdir).not.toHaveBeenCalled();
  });
});

describe('a failure', () => {
  const locations = (databaseFile: () => Promise<string>) => ({
    directories: ['/docs', '/docs/attachments', '/docs/backups'],
    databaseFile,
  });

  it('is reported, and the other locations are still marked', async () => {
    blob.ios.excludeFromBackupKey.mockImplementation(async (path: string) => {
      if (path === '/docs/attachments') {
        throw new Error('EUNSPECIFIED');
      }
    });
    await blob.fs.writeFile('/library/obalka.db', 'x');

    await expect(
      excludeFromDeviceBackup(locations(async () => '/library/obalka.db')),
    ).resolves.toBeUndefined();

    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith('file.excludeFromBackup', expect.any(Error), {
      stage: 'native',
    });
    expect(marked()).toEqual([
      '/docs',
      '/docs/attachments',
      '/docs/backups',
      '/library/obalka.db',
    ]);
  });

  it('of the database opening is reported, and the directories are marked anyway', async () => {
    await expect(
      excludeFromDeviceBackup(
        locations(async () => {
          throw new Error('keychain unavailable');
        }),
      ),
    ).resolves.toBeUndefined();

    expect(marked()).toEqual(['/docs', '/docs/attachments', '/docs/backups']);
    expect(report).toHaveBeenCalledWith('file.excludeFromBackup', expect.any(Error), {
      stage: 'persist',
    });
  });

  it('of a directory that cannot be made is reported, and launch carries on', async () => {
    blob.fs.mkdir.mockRejectedValueOnce(new Error('ENOSPC'));

    await expect(
      excludeFromDeviceBackup(locations(async () => '/library/obalka.db')),
    ).resolves.toBeUndefined();

    expect(report).toHaveBeenCalledTimes(1);
    // The one that could not be made is not marked; the others are.
    expect(marked()).toHaveLength(2);
  });
});
