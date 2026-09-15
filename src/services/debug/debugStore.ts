// The bundles on disk: list them, hand one to the OS, delete one.
//
// "Hand one to the OS" is the entire distribution mechanism: the system share sheet, which on iOS is
// blob-util's options menu and on Android the app's own `ShareFile` module (ACTION_SEND). The app
// never learns where the file went; it does not get a destination, a result, or a callback that says
// "sent". That is the design. The user picks the recipient in a sheet the app does not draw and
// cannot read.
//
// NO NETWORK CODE HERE EITHER. See the note at the top of `debugBundle.ts`.

import { NativeModules, Platform } from 'react-native';
import RNBlobUtil from 'react-native-blob-util';
import { bundleDir } from './debugBundle';

export interface SavedBundle {
  name: string;
  path: string;
  /**
   * Null when the file's size could not be read. The bundle is listed anyway: it is still on the phone,
   * still shareable and still deletable, and a list that left it out hid a file that may hold the
   * user's mail from the one screen that can delete it.
   */
  bytes: number | null;
  /** Epoch ms, from the file's own mtime; null when that could not be read. */
  at: number | null;
}

/**
 * How long a read of the bundle folder may take before it counts as failed.
 *
 * The folder is the app's own documents directory, and reading it is a handful of native calls - is it
 * there, what is in it, how big is each file - that answer in milliseconds. A read that has not answered
 * in five seconds is not slow, it is stuck, and until 2026-09-15 a stuck one left the Debug screen's
 * saved files a blank row for as long as the screen stayed open, with nothing to try again with
 * (constitution II). Five seconds is three orders of magnitude above an answer, and short enough that
 * the person looking at the blank row is told and handed "Zkusit znovu".
 */
export const LIST_TIMEOUT_MS = 5_000;

/** A read of the bundle folder that did not answer within the time it was given. */
export class BundleListTimeoutError extends Error {
  constructor(ms: number) {
    super(`The debug bundle folder did not answer within ${ms} ms`);
    this.name = 'BundleListTimeoutError';
  }
}

/**
 * Oldest first, so a bundle saved while the Debug screen is open joins the END of its list and the
 * files already listed stay where they are (constitution V). A save ends at a moment nobody picks;
 * newest first put its file in the first row and pushed every row below it down, under a finger that
 * may have been on its way to "Sdílet" on the file before. A missing directory means no bundles, which
 * is not an error.
 *
 * A directory that could not be read IS an error, and this rejects with it (constitution II). Until
 * 2026-09-15 any failure here returned no bundles, so the Debug screen said "Zatím tu nic není." over a
 * folder that had files in it - and offered nothing to try again with, because there was nothing wrong
 * as far as it could tell. A read that does not answer within `timeoutMs` rejects too, with
 * `BundleListTimeoutError`; if the folder answers after that, the answer is dropped; the caller has
 * already been told the read failed, and asks again to see the folder.
 */
export function listBundles(timeoutMs: number = LIST_TIMEOUT_MS): Promise<SavedBundle[]> {
  return new Promise<SavedBundle[]>((resolve, reject) => {
    const timer = setTimeout(() => reject(new BundleListTimeoutError(timeoutMs)), timeoutMs);
    readBundles().then(
      bundles => {
        clearTimeout(timer);
        resolve(bundles);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function readBundles(): Promise<SavedBundle[]> {
  const dir = bundleDir();
  if (!(await RNBlobUtil.fs.exists(dir))) {
    return [];
  }
  const names = (await RNBlobUtil.fs.ls(dir)).filter(n => n.endsWith('.zip'));
  const out: SavedBundle[] = [];
  for (const name of names) {
    out.push(await savedBundle(dir, name));
  }
  return out.sort(oldestFirst);
}

/**
 * One bundle, described as far as its stat allows. A stat that fails leaves the size and the time
 * unknown rather than leaving the file out: until 2026-09-15 such a bundle was dropped from the list
 * without a word.
 */
async function savedBundle(dir: string, name: string): Promise<SavedBundle> {
  const path = `${dir}/${name}`;
  try {
    const stat = await RNBlobUtil.fs.stat(path);
    return { name, path, bytes: known(stat.size), at: known(stat.lastModified) };
  } catch {
    return { name, path, bytes: null, at: null };
  }
}

/** A stat field as a number, or null when the platform handed back nothing usable. */
function known(value: unknown): number | null {
  if (value == null || value === '') {
    return null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * The minute a bundle was stopped, read back from its name - `bundleFileName` writes it there so the
 * files sort chronologically. It orders a bundle whose own time could not be read; a bundle named
 * some other way has no minute to give.
 */
const NAME_STAMP = /^obalka-debug-(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})-/;

function sortTime(bundle: SavedBundle): number {
  if (bundle.at != null) {
    return bundle.at;
  }
  const m = NAME_STAMP.exec(bundle.name);
  if (!m) {
    return Number.NEGATIVE_INFINITY;
  }
  const [year, month, day, hour, minute] = m.slice(1).map(Number);
  return new Date(year, month - 1, day, hour, minute).getTime();
}

function oldestFirst(a: SavedBundle, b: SavedBundle): number {
  const ta = sortTime(a);
  const tb = sortTime(b);
  if (ta !== tb) {
    return ta < tb ? -1 : 1;
  }
  if (a.name === b.name) {
    return 0;
  }
  return a.name < b.name ? -1 : 1;
}

/** The app's own Android module that sends a file with ACTION_SEND (`ShareFileModule.kt`). */
interface ShareFileNative {
  shareFile(path: string, mimeType: string, title: string): Promise<void>;
}

/**
 * Offer the bundle to the OS share sheet, titled `title` where the platform shows one.
 *
 * iOS: `presentOptionsMenu` IS the share sheet. Note the inverted legacy aliases documented in
 * `attachmentOpener.ts` - `ios.previewDocument` is this function and `ios.openDocument` is the
 * preview, which is the opposite of what both names suggest. The modern names are used here.
 *
 * Android: ACTION_SEND with the zip's MIME type through the system chooser, so it lists mail,
 * messaging and Drive. Until 2026-09-15 this called blob-util's `actionViewIntent`, which is
 * ACTION_VIEW - "open this zip" - and failed on every phone without a zip viewer; walking the
 * emulator found it, the first time the share sheet was tried on a device. A build without the
 * module says so rather than pretending: the screen turns the rejection into "could not open".
 */
export async function shareBundle(path: string, title: string): Promise<void> {
  if (Platform.OS === 'android') {
    const native = NativeModules.ShareFile as ShareFileNative | undefined;
    if (!native) {
      throw new Error('The ShareFile native module is not in this build');
    }
    await native.shareFile(path, 'application/zip', title);
    return;
  }
  await (RNBlobUtil.ios.presentOptionsMenu(path) as unknown as Promise<void>);
}

/**
 * Delete one bundle. Already gone is the desired state, not a failure; a file still there after the
 * delete is one, and this rejects with it (constitution II). Until 2026-09-15 every failure was
 * swallowed, so "Smazat" on a file the phone would not delete left its row in place without a word -
 * a tap that seemed to miss, over a file that may hold the user's mail.
 */
export async function deleteBundle(path: string): Promise<void> {
  try {
    await RNBlobUtil.fs.unlink(path);
  } catch (error) {
    if (await RNBlobUtil.fs.exists(path)) {
      throw error;
    }
  }
}

/**
 * Delete every bundle. The "leave no trace" button. Rejects when the folder cannot be listed: that
 * nothing is left is not something to report about a folder nobody could read. A bundle that will not
 * go does not keep the others: every one is tried, and then this rejects with the first failure.
 */
export async function deleteAllBundles(): Promise<void> {
  let failure: { readonly error: unknown } | null = null;
  for (const b of await listBundles()) {
    try {
      await deleteBundle(b.path);
    } catch (error) {
      failure ??= { error };
    }
  }
  if (failure) {
    throw failure.error;
  }
}
