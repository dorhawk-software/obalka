// Keep the app's data out of the phone's own backup on iOS - iCloud Backup, a computer backup, and a
// Quick Start move built on them (owner decision, 2026-09-24).
//
// WHY. The archive's SQLCipher key and the vault key are Keychain items stored this-device-only, so a
// copy restored onto another phone cannot be opened there. What such a copy DOES carry readably is
// the plain files: downloaded attachments (.pdf), signed originals (.zfo), debug ZIPs and backup
// files, all under `Documents`, which iOS backs up by default. The app's own encrypted backup (006)
// and its phone-to-phone transfer (025) are the ways an archive moves. Android says the same in its
// manifest and `res/xml`, which needs no code; this is the iOS half.
//
// HOW. `NSURLIsExcludedFromBackupKey`, through react-native-blob-util's `ios.excludeFromBackupKey`,
// on DIRECTORIES. Apple's "Optimizing your app's data for iCloud backup": "To indicate the system can
// exclude a group of related files from iCloud Backup, move those files into a directory and update
// the directory's isExcludedFromBackup resource value." A directory's mark therefore covers files
// written into it later, which is what makes marking once per launch enough.
//
// The same page gives the two limits worth knowing. The mark is guidance - "not a mechanism to
// guarantee those items never appear in a backup or on a restored device". And "certain file
// operations can reset resource values", which is why a FILE's mark does not last: a file replaced by
// a safe-save is a new file. That is the reason files are not marked one by one as they are written,
// and why the step runs at every launch - a directory deleted and made again (none of these is, today)
// would come back unmarked for one run at most, and `Documents` itself, which the app never deletes,
// covers its subdirectories meanwhile.
//
// The database is the exception: op-sqlite keeps it in `Library`, not in a directory of ours, and
// `Library` also holds what iOS keeps for every app, so its three files are marked by name. SQLite
// writes the main file in place, so its mark holds; the -wal and -shm sidecars can be deleted and made
// again when the last connection closes, which is why they are marked after the open, every launch.
// Everything in all three is SQLCipher pages - the archive is unreadable without this phone's key
// either way, and the mark is for the owner's rule rather than for secrecy.
//
// Never blocks the JS thread (each call is a native promise on blob-util's own queue) and never
// breaks launch: every failure is reported and the next location is still tried.

import { Platform } from 'react-native';
import RNBlobUtil from 'react-native-blob-util';
import { reportFailure } from '../telemetry/telemetry';

export interface DeviceBackupLocations {
  /** Made when missing, then marked. A directory's mark covers what is written into it later. */
  directories: readonly string[];
  /** The database file, once it is open. It and its -wal / -shm sidecars are marked where present. */
  databaseFile: () => Promise<string>;
}

/**
 * Created when missing, because a directory that does not exist cannot carry a mark - and a first
 * launch would otherwise leave `backups` unmarked until the launch after its first backup. Existing
 * is the desired state: blob-util's `mkdir` throws when it lost a race to another creator.
 */
async function ensureDir(path: string): Promise<void> {
  const { fs } = RNBlobUtil;
  if (await fs.exists(path)) {
    return;
  }
  try {
    await fs.mkdir(path);
  } catch (e) {
    if (!(await fs.exists(path))) {
      throw e;
    }
  }
}

/**
 * blob-util builds the URL as `"file://" + path` and hands it to `URLWithString`, which answers nil
 * for a path with a space in it - and a nil URL sets nothing and reports no error. The container
 * paths this is given on a phone have no spaces; noted because the failure would be silent.
 */
function markExcluded(path: string): Promise<void> {
  return RNBlobUtil.ios.excludeFromBackupKey(path);
}

/** Mark every app data location excluded from the phone's backup. iOS only; resolves, never rejects. */
export async function excludeFromDeviceBackup(locations: DeviceBackupLocations): Promise<void> {
  if (Platform.OS !== 'ios') {
    // Android: `dataExtractionRules` + `fullBackupContent` in the manifest do this without code.
    return;
  }
  for (const dir of locations.directories) {
    try {
      await ensureDir(dir);
      await markExcluded(dir);
    } catch (e) {
      reportFailure('file.excludeFromBackup', e, { stage: 'native' });
    }
  }

  let db: string;
  try {
    db = await locations.databaseFile();
  } catch (e) {
    // The archive did not open, so there is no file to mark this launch; the next launch tries again.
    reportFailure('file.excludeFromBackup', e, { stage: 'persist' });
    return;
  }
  for (const file of [db, `${db}-wal`, `${db}-shm`]) {
    try {
      if (await RNBlobUtil.fs.exists(file)) {
        await markExcluded(file);
      }
    } catch (e) {
      reportFailure('file.excludeFromBackup', e, { stage: 'native' });
    }
  }
}
