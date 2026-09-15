// Assembles the real login dependencies for the app (feature 001).
//
// Uses the device-capable transport (FetchHttpClient → IsdsHttpTransport → IsdsAuthService) and the
// persistent device stores: encrypted SQLite for metadata (T007) and, for secrets, Keychain items
// sealed under the vault key (T008, T028), so accounts survive an app restart, and with the app lock
// on neither a password nor a session can be read while the app is locked.

import { FetchHttpClient } from '../../services/isds/httpClient';
import { NativeCookieJar } from '../../services/isds/cookieJar';
import { IsdsHttpTransport } from '../../services/isds/isdsTransport';
import { AccountsStore } from '../../services/db/accountsStore';
import { SqliteAccountsStore } from '../../services/db/sqliteAccountsStore';
import { SqliteMessagesStore } from '../../services/db/messagesStore';
import { SqliteDraftsStore } from '../../services/db/draftsStore';
import { SqliteRemindersStore } from '../../services/db/remindersStore';
import { RemindersController } from '../messages/state/remindersController';
import { ScanController } from '../messages/state/scanController';
import {
  APP_LOCK_KEY,
  HANDSHAKE_OPEN_KEY,
  SCAN_ATTACHMENTS_KEY,
} from '../../app/settings/settingsKeys';
import { extractPdfText } from '../../services/scan/pdfText';
import { NotifeeNotifier } from '../../services/notifications/notifeeNotifier';
import { KeychainSecretItems } from '../../services/secureStore/keychainSecureStore';
import { VaultSecureStore } from '../../services/secureStore/vaultSecureStore';
import { Vault } from '../../services/secureStore/vault';
import { KeychainVaultKeyStorage } from '../../services/secureStore/keychainVaultKeyStorage';
import type { AppLock } from '../../services/appLock/appLock';
import { vodzAttachmentDownloader } from '../../services/files/vodzAttachmentDownloader';
import { sliceSource } from '../../services/files/sliceSource';
import {
  fileUri,
  localCopyCleanupPath,
  localCopyPath,
} from '../../services/files/localCopyPath';
import {
  ATTACHMENTS_ROOT,
  attachmentFileStore,
  attachmentMessageDir,
} from '../../services/files/attachmentFileStore';
import { excludeFromDeviceBackup } from '../../services/files/deviceBackupExclusion';
import { bundleDir } from '../../services/debug/debugBundle';
import RNBlobUtil from 'react-native-blob-util';
import { errorCodes, isErrorWithCode, keepLocalCopy, pick, saveDocuments } from '@react-native-documents/picker';
import { PORTABLE_MIME, type PortableIo } from '../../services/backup/portableIo';
import type { BackupFs } from '../../services/backup/fileTarget';
import type { DocumentSource } from '../../services/backup/documents';
import { TransferController } from '../transfer/state/transferController';
import { nativeTransport } from '../../services/transfer/nativeTransport';
import { yieldToScheduler } from '../../services/text/textCodec';
import {
  backupSource,
  backupSink,
  documentDetails,
  type BackupStores,
} from '../../services/backup/stores';
import { fileSyncTarget } from '../../services/backup/fileTarget';
import { backupSecretStore } from '../../services/backup/backupSecret';
import { BackupController } from '../backup/state/backupController';
import { getDbFilePath, withTransaction } from '../../services/db/database';
import { APP_VERSION } from '../../app/appInfo';
import type { Host } from '../../services/isds/types';
import { MessagesController } from '../messages/state/messagesController';
import { AttachmentPrefetcher } from '../messages/state/attachmentPrefetch';
import { readAutoDownload } from '../messages/state/autoDownloadSettings';
import { isMetered } from '../../services/transfer/connection';
import { BoxWork } from '../messages/state/boxWork';
import { SendController } from '../messages/state/sendController';
import type { ProgressFn } from '../../services/backup/progress';
import { AccountsController } from './state/accountsController';
import { RemovalQueue } from './state/removalQueue';
import { IsdsAuthService } from './state/authService';
import { UseLoginControllerDeps } from './state/useLoginController';
import { reportFailure } from '../../services/telemetry/telemetry';

// Module-level singletons: the encrypted DB (metadata) + Keychain (secrets) persist across restarts.
const accountsStore = new SqliteAccountsStore();
const messagesStore = new SqliteMessagesStore();
/**
 * The vault key (001 T028): one key seals every box secret, and with the app lock on it sits behind
 * the biometric gate, so unlocking the app is reading it. The lock setting it follows lives in the
 * same encrypted DB as every other setting.
 */
const vault = new Vault({
  storage: new KeychainVaultKeyStorage(),
  lockSetting: {
    read: async () => (await accountsStore.getSetting(APP_LOCK_KEY)) === '1',
    write: on => accountsStore.setSetting(APP_LOCK_KEY, on ? '1' : '0'),
  },
});
/**
 * Box passwords and session cookies, each sealed in its own Keychain item. Every controller reads
 * them from here at call time, which is what makes every ISDS call wait while the app is locked.
 */
const secureStore = new VaultSecureStore({
  vault,
  items: new KeychainSecretItems(),
  boxIds: async () => (await accountsStore.list()).map(a => a.boxId),
  // The cookies 018 kept in the accounts table, moved out once (research R6b, Migration).
  legacySessions: accountsStore,
});
// The REAL cookie jar: without it every login captures nothing and every box reports an expired
// session forever (018). Required by the constructor precisely so this cannot be forgotten again.
/**
 * Whether a sign-in has a handshake open in the shared jar, kept in the settings table (018 FR-003,
 * 2026-09-24). A write that fails is reported and never holds a sign-in up: at worst one launch empties
 * a jar for nothing, or one leftover handshake waits for the next sign-in, as before the mark.
 */
const handshakeMark = {
  open: () => writeHandshakeMark('1'),
  close: () => writeHandshakeMark('0'),
  isOpen: async () =>
    (await accountsStore.getSetting(HANDSHAKE_OPEN_KEY).catch(() => null)) === '1',
};

async function writeHandshakeMark(value: '0' | '1'): Promise<void> {
  try {
    await accountsStore.setSetting(HANDSHAKE_OPEN_KEY, value);
  } catch (e) {
    reportFailure('settings.write', e, { stage: 'persist' });
  }
}

const transport = new IsdsHttpTransport(
  new FetchHttpClient(),
  new NativeCookieJar(),
  handshakeMark,
);

/**
 * Empty the shared cookie jar of a sign-in the last run of the app left unfinished (018 FR-003,
 * 2026-09-24). For the app root to call once at launch.
 *
 * Every sign-in empties the jar when it ends, however it ends - but a process killed mid-sign-in ends
 * nothing, and the native store outlives the process and stays readable while the app is locked, so
 * its half-finished handshake stayed until the next sign-in started. Nothing is in flight at launch,
 * and nothing but a sign-in reads the jar, so there is nothing here to break.
 *
 * Only when the handshake mark says a sign-in left one (review, the same day): emptying the jar loads
 * Android's WebView cookie store, which every cold start paid for, and a phone without a working
 * WebView reported the failure on every launch. A response that lands after its sign-in was cancelled
 * is not noted - the cancel emptied the jar and closed the mark - and waits for the next sign-in.
 * Never rejects.
 */
export async function endSignInsLeftOver(): Promise<void> {
  if (await handshakeMark.isOpen()) {
    await transport.abandonLogin();
  }
}

export const accountsController = new AccountsController({
  accounts: accountsStore,
  secureStore,
});

/**
 * Box removals, one at a time, and the restores kept apart from them (`RemovalQueue`). The app's rather
 * than the shell's since a restore waits for it too: the backup controller below, and through it a
 * phone transfer's save.
 */
export const removalQueue = new RemovalQueue();

/**
 * The work under way per box, which removing a box stops (`BoxWork`). A write of a box's archive or
 * files asks the store whether the box is still listed.
 */
export const boxWork = new BoxWork(async boxId =>
  (await accountsStore.list()).some(a => a.boxId === boxId),
);

/** App-level key/value settings (theme mode, language) - persisted in the same encrypted DB. */
export const settingsStore: Pick<
  AccountsStore,
  'getSetting' | 'setSetting' | 'removeSettingsWithPrefix'
> = accountsStore;

/** Biometric app-lock gate - the vault, whose key is what the gate protects. */
export const appLock: AppLock = vault;

/**
 * What the app root needs of the sealed store: starting the one-time migration at launch, and hearing
 * when stored secrets turned out to be sealed under a key the phone no longer has.
 */
export const vaultSecrets: Pick<
  VaultSecureStore,
  'prepare' | 'subscribeLost' | 'acknowledgeLost'
> = secureStore;

/** Loads + offline-caches messages for a box (password boxes Basic-auth; OTP boxes use the cookie). */
export const messagesController = new MessagesController({
  transport,
  secureStore,
  messagesStore,
  vodzDownloader: vodzAttachmentDownloader,
  attachmentFiles: attachmentFileStore,
  host: 'czebox',
  // Keeps the backup current without anyone pressing anything (006 FR-017). Late-bound because
  // `backupController` is built further down this file - and fire-and-forget, so a backup can never
  // slow down or break a sync.
  onArchiveChanged: () => backupController.archiveChanged(),
  // Automatic attachment download follows a listing the user started (026). Late-bound for the same
  // reason as the backup above.
  onListed: account => attachmentPrefetcher.afterListing(account),
  // A sync or download that answers after its box's removal started writes nothing (001 T037).
  work: boxWork,
});

/** Recipient lookup + cost estimation for composing a message (feature 005). */
export const sendController = new SendController({
  transport,
  secureStore,
  host: 'czebox',
});

/**
 * Encrypted backup (006). The filesystem seam is blob-util; everything above it is platform-free, so
 * the same service works against a file today and a cloud target later.
 */
/**
 * Bytes converted between one yield and the next.
 *
 * 8 KiB was already the stack-safety limit for `String.fromCharCode(...)`; it doubles as a sensible
 * slice for keeping the UI alive, and a 2 MB archive is ~256 of them.
 */
const BINARY_CHUNK = 8192;

export const backupFs: BackupFs = {
  /**
   * Idempotent, and it has to be, because two callers reach it at once.
   *
   * The backup screen asks for the status and the restore list in the same breath, and both list the
   * backup directory. `exists` then `mkdir` is a race: on a phone that has never made a backup, both
   * saw "not there" and both created it, and blob-util's `mkdir` THROWS when the directory already
   * exists - so the loser rejected and took the screen's whole refresh with it. The switch then read
   * "off" and the list read "no backups", on a first visit where neither was known yet. Existing is
   * the desired state, not a failure.
   */
  ensureDir: async path => {
    if (await RNBlobUtil.fs.exists(path)) {
      return;
    }
    try {
      await RNBlobUtil.fs.mkdir(path);
    } catch (e) {
      if (!(await RNBlobUtil.fs.exists(path))) {
        throw e;
      }
    }
  },
  list: path => RNBlobUtil.fs.ls(path),
  readText: path => RNBlobUtil.fs.readFile(path, 'utf8') as Promise<string>,
  writeText: (path, text) => RNBlobUtil.fs.writeFile(path, text, 'utf8').then(() => undefined),
  readBytes: async path => {
    const b64 = (await RNBlobUtil.fs.readFile(path, 'base64')) as string;
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += BINARY_CHUNK) {
      const end = Math.min(i + BINARY_CHUNK, bin.length);
      for (let j = i; j < end; j++) {
        out[j] = bin.charCodeAt(j);
      }
      if (end < bin.length) {
        await yieldToScheduler();
      }
    }
    return out;
  },
  // A megabyte at a time (025 review, 2026-09-15): blob-util has no random-access read and its
  // `readStream` pushes without backpressure, but `fs.slice` copies a byte range natively, and a
  // scratch file of one slice is cheap. The documents a restore reads back and a transfer copies go
  // through this rather than `readBytes`, because one of them can be a 100 MB enclosure.
  open: async path => {
    if (!(await RNBlobUtil.fs.exists(path))) {
      // Worded the way a missing object is recognised, so a document that never travelled is counted
      // as missing rather than as failed (`documents.ts`).
      throw new Error(`no such file: ${path}`);
    }
    const size = Number((await RNBlobUtil.fs.stat(path)).size);
    return sliceSource(size, DOCUMENT_CHUNK, async (start, end) => {
      const scratch = `${RNBlobUtil.fs.dirs.CacheDir}/document-slice-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}`;
      try {
        await RNBlobUtil.fs.slice(path, scratch, start, end);
        return await backupFs.readBytes(scratch);
      } finally {
        await RNBlobUtil.fs.unlink(scratch).catch(() => undefined);
      }
    });
  },
  writeBytes: async (path, bytes) => {
    // Chunked for two different reasons, and only one of them was here before: `String.fromCharCode
    // (...bytes)` on a multi-megabyte array overflows the stack, AND a straight loop over an archive
    // holds the JS thread for as long as it takes. The archive is as big as the user's mailbox, and
    // since backups became automatic this runs unattended after a sync - so the loop yields.
    const parts: string[] = [];
    for (let i = 0; i < bytes.length; i += BINARY_CHUNK) {
      parts.push(String.fromCharCode(...bytes.subarray(i, i + BINARY_CHUNK)));
      if (i + BINARY_CHUNK < bytes.length) {
        await yieldToScheduler();
      }
    }
    await RNBlobUtil.fs.writeFile(path, btoa(parts.join('')), 'base64');
  },
  // Appends the same base64-chunked way `writeBytes` writes, so a sealed document reaches disk a
  // chunk at a time instead of being assembled in memory first.
  appendBytes: async (path, bytes) => {
    const parts: string[] = [];
    for (let i = 0; i < bytes.length; i += BINARY_CHUNK) {
      parts.push(String.fromCharCode(...bytes.subarray(i, i + BINARY_CHUNK)));
      if (i + BINARY_CHUNK < bytes.length) {
        await yieldToScheduler();
      }
    }
    await RNBlobUtil.fs.appendFile(path, btoa(parts.join('')), 'base64');
  },
  exists: path => RNBlobUtil.fs.exists(path),
  // A rename, not a copy: a sealed document is moved into place under its content-id name once it
  // is complete, and copying it there would put the whole file back through memory (see `BackupFs`).
  move: (from, to) => RNBlobUtil.fs.mv(from, to).then(() => undefined),
  remove: path => RNBlobUtil.fs.unlink(path),
};

/** Where file backups live when no cloud target is chosen. */
export const backupDir = `${RNBlobUtil.fs.dirs.DocumentDir}/backups`;

/**
 * Keep every place the app stores data out of the phone's own backup - iOS; Android does it in the
 * manifest (owner decision, 2026-09-24). Run at every launch; resolves, never rejects.
 *
 * `Documents` itself, which the app never deletes, and each directory of ours inside it: attachments
 * and signed originals, backup files, debug ZIPs. The pre-unification `vodz` directory is left to
 * `Documents`' mark rather than created on phones that never had it. The database is op-sqlite's, in
 * `Library`, and is marked by the path op-sqlite gives. The cache directory needs nothing: iOS never
 * backs up `Library/Caches`.
 */
export function excludeAppDataFromDeviceBackup(): Promise<void> {
  return excludeFromDeviceBackup({
    directories: [RNBlobUtil.fs.dirs.DocumentDir, ATTACHMENTS_ROOT, backupDir, bundleDir()],
    databaseFile: getDbFilePath,
  });
}

/**
 * Where a phone-to-phone transfer stages its bytes (025).
 *
 * The CACHE directory, deliberately: everything here is a copy of something that already exists in
 * the backup store, it is swept after every transfer, and the OS reclaiming it costs nothing.
 */
export const transferDir = `${RNBlobUtil.fs.dirs.CacheDir}/transfer`;

/**
 * Reading this device's attachment files - and signed originals - for Tier 2 (006 T021).
 *
 * `open` hands the bytes out a megabyte at a time, and since 2026-09-14 (004 amendment) it READS them
 * a megabyte at a time too: blob-util has no random-access read and its `readStream` pushes without
 * backpressure, but `fs.slice` copies a byte range natively, and a scratch file of one slice is cheap.
 * The old version read the file whole on the grounds that ISDS caps a message at 20 MB - which a
 * large-volume enclosure (up to 100 MB) already contradicted, and a signed original, larger than the
 * documents it seals, contradicts further. The puller seam is unchanged, so nothing above noticed.
 * The slicing itself is `backupFs.open` since 2026-09-15, which the restore and the transfer share.
 */
export const documentSource: DocumentSource = {
  sizeOf: async path => {
    if (!(await RNBlobUtil.fs.exists(path))) {
      return null; // the detail names a file that is no longer there - a fact, not a failure
    }
    return Number((await RNBlobUtil.fs.stat(path)).size);
  },
  open: path => backupFs.open(path),
};

/** Matches `fileSeal`'s chunk, so nothing is re-cut between reading and sealing. */
const DOCUMENT_CHUNK = 1024 * 1024;


/** Compose drafts (feature 005) - saved-but-unsent messages, persisted in the encrypted DB. */
export const draftsStore = new SqliteDraftsStore();
export const remindersStore = new SqliteRemindersStore();
export const remindersController = new RemindersController({
  store: remindersStore,
  notifier: new NotifeeNotifier(),
});

const backupStores: BackupStores = {
  accounts: accountsStore,
  messages: messagesStore,
  drafts: draftsStore,
  reminders: remindersStore,
};

/**
 * Backup + restore (006), wired to files on this device.
 *
 * `fileSyncTarget` is the destination for now; a Drive or iCloud target drops in here without any
 * other file changing, which is what the `SyncTarget` seam was for. The restore runs in ONE SQLite
 * transaction - a half-restored archive is the failure that matters.
 */

/**
 * Moving a backup off the phone and back, over the system document picker.
 *
 * Reuses `backupFs` for the bytes rather than repeating its base64 chunking: that loop exists
 * because `String.fromCharCode(...bytes)` overflows the stack on a multi-megabyte archive and a
 * straight pass holds the JS thread, and an exported backup is exactly as big as the one being
 * written. The picker only ever sees a path.
 */
export const portableIo: PortableIo = {
  save: async (fileName, bytes) => {
    // Staged in the app's own cache first: the picker hands the SYSTEM a source URI to copy, so the
    // file has to exist somewhere readable before the sheet opens. Cleaned up either way, including
    // when the user dismisses the sheet - an unexported backup left in the cache is a decrypted-name
    // copy of their archive sitting where nobody will think to look for it.
    const staged = `${RNBlobUtil.fs.dirs.CacheDir}/${fileName}`;
    await backupFs.writeBytes(staged, bytes);
    try {
      // Encoded, as `attachmentOpener.save` is: the sheet parses the URI, and a name the caller chose
      // may carry a "#" or a "%" that would otherwise end the path or break the parse.
      await saveDocuments({
        sourceUris: [fileUri(staged)],
        fileName,
        mimeType: PORTABLE_MIME,
        copy: true,
      });
      return true;
    } catch (e) {
      if (isErrorWithCode(e) && e.code === errorCodes.OPERATION_CANCELED) {
        return false;
      }
      throw e;
    } finally {
      await backupFs.remove(staged).catch(() => undefined);
    }
  },

  open: async () => {
    let picked;
    try {
      [picked] = await pick({ allowMultiSelection: false });
    } catch (e) {
      if (isErrorWithCode(e) && e.code === errorCodes.OPERATION_CANCELED) {
        return null;
      }
      throw e;
    }
    if (!picked?.uri) {
      return null;
    }
    // A picked URI can be a cloud document this process cannot read directly, so the picker is asked
    // for a local copy first. Removed afterwards: it is a copy of an encrypted archive, but it is
    // still the user's archive and it has no reason to stay in the cache.
    const [copy] = await keepLocalCopy({
      files: [{ uri: picked.uri, fileName: picked.name ?? 'backup' }],
      destination: 'cachesDirectory',
    });
    if (copy.status !== 'success') {
      throw new Error(copy.copyError ?? 'The file could not be read.');
    }
    // Decoded, not just stripped of its scheme: the copy's URI is percent-encoded, and a backup named
    // "Záloha Obálky 15. září.obalka" is otherwise read from a path that names no file.
    //
    // Inside the `try` (2026-09-15): the decode itself throws on a malformed escape, and from outside
    // it that throw skipped the cleanup and left the copy of the archive in the cache.
    const localUri = copy.localUri;
    try {
      return await backupFs.readBytes(localCopyPath(localUri));
    } finally {
      await backupFs.remove(localCopyCleanupPath(localUri)).catch(() => undefined);
    }
  },
};

/**
 * The backup controller, with every restore kept apart from box removals (001 T037, 006).
 *
 * A restore - the backup screen's, and a phone transfer's save, which runs through `runRestore` - waits
 * for the removals queued before it, and a removal asked for while it runs waits for it to end
 * (`RemovalQueue.runApart`). A removal asks before each purge whether its box is listed, so a restore
 * that brought the box back after that question lost what it had written to the purge; and a removal
 * started during a restore could clear a box the restore was still writing documents for.
 */
class BackupControllerApartFromRemovals extends BackupController {
  restore(
    ...args: Parameters<BackupController['restore']>
  ): ReturnType<BackupController['restore']> {
    return removalQueue.runApart(() => super.restore(...args));
  }

  runRestore<T>(work: (onProgress: ProgressFn) => Promise<T>): Promise<T> {
    return removalQueue.runApart(() => super.runRestore(work));
  }
}

export const backupController: BackupController = new BackupControllerApartFromRemovals({
  source: backupSource(backupStores),
  sink: backupSink(backupStores, withTransaction),
  secret: backupSecretStore,
  target: fileSyncTarget(backupFs, backupDir),
  settings: accountsStore,
  appVersion: APP_VERSION,
  portableIo,
  // The `all` attachment mode (026). Late-bound: the downloader is built just below.
  missing: {
    download: options => attachmentPrefetcher.downloadMissing(options),
    estimate: () => attachmentPrefetcher.estimate(),
  },
  // Tier 2. Present does not mean on: the preference is off by default, and this is only what makes
  // turning it on possible at all (006 T024).
  documents: {
    source: documentSource,
    fs: backupFs,
    details: documentDetails(backupStores),
    messageDir: attachmentMessageDir,
    randomBytes: n => {
      const out = new Uint8Array(n);
      globalThis.crypto.getRandomValues(out);
      return out;
    },
  },
});


/**
 * Downloading the attachments the archive does not hold yet (026): automatically after a listing the
 * user started, and before a backup in the `all` mode that the user started. One message at a time,
 * through the same `getDetail` the detail screen's button uses.
 */
export const attachmentPrefetcher = new AttachmentPrefetcher({
  listAccounts: () => accountsStore.list(),
  listUndownloaded: boxId => messagesStore.listUndownloaded(boxId),
  download: (account, messageId, folder, signal) =>
    messagesController.getDetail(account, messageId, folder, signal),
  autoDownload: () => readAutoDownload(accountsStore),
  backupWantsAll: async () => {
    const preferences = await backupController.preferences();
    return preferences.documents && preferences.documentMode === 'all';
  },
  isMetered,
  holdBackups: () => backupController.holdAutomatic(),
});

/**
 * Moving an archive to another phone (025).
 *
 * `nativeTransport` answers "unavailable" where the Go archive was not built in, and the screen
 * hides the feature rather than offering something that cannot work (FR-013).
 */
export const transferController = new TransferController({
  transport: nativeTransport,
  fs: backupFs,
  workDir: transferDir,
  backupDir,
  target: fileSyncTarget(backupFs, backupDir),
  sink: backupSink(backupStores, withTransaction),
  recoveryKey: () => backupSecretStore.forUse(),
  // Counting what a send carries (US1 scenario 1): the same reads a backup starts with, no more.
  source: backupSource(backupStores),
  // The document restore the backup screen's restore uses, so the documents that travel are written
  // back rather than staged and swept.
  documents: {
    fs: backupFs,
    details: documentDetails(backupStores),
    messageDir: attachmentMessageDir,
  },
  // The keys that arrive are kept the way the backup screen's restore keeps them (006), so this phone
  // backs up under them instead of starting again with keys of its own.
  keys: { secret: backupSecretStore, settings: accountsStore },
  // A save is one of the backup controller's runs, as the backup screen's restore is, so no automatic
  // backup starts while it writes the archive (025 review, 2026-09-15).
  runs: backupController,
});

/**
 * The opt-in on-device deadline scan (010 US3).
 *
 * `extractPdfText` is imported normally, but the PDF PARSER behind it is not: `pdfjs-dist` is loaded
 * by a dynamic import inside `extractPdfText`, which nothing reaches while the toggle is off.
 */
export const scanController = new ScanController({
  settings: accountsStore,
  readBytes: path => attachmentFileStore.readBytes(path),
  extractText: bytes => extractPdfText(bytes),
  enabledKey: SCAN_ATTACHMENTS_KEY,
});

/** Build the deps for the login flow against the given ISDS environment (czebox in dev). */
export function createLoginDeps(host: Host = 'czebox'): UseLoginControllerDeps {
  return {
    authService: new IsdsAuthService({ transport, host }),
    accountsController,
    host,
  };
}
