// Keys for the app's key/value settings table, where more than one module needs the same one.
//
// `scanAttachments` is read in two places that must never disagree - the Settings toggle writes it,
// and `ScanController` refuses to scan unless it reads back exactly "1" (010 FR-011). A typo in
// either would silently mean "scanning is off forever" or, worse, "scanning is on without a toggle".

export const SCAN_ATTACHMENTS_KEY = 'scanAttachments';

/**
 * Whether diagnostic reports may leave the phone.
 *
 * Read by the Settings toggle and by `App` at startup, which must agree - the toggle decides, and
 * startup has to honour that decision before the first line of app code can fail. Defaults to ON
 * while the app is unpublished, because the only person running it is the person debugging it;
 * that default is a one-line decision to revisit before release.
 */
export const TELEMETRY_KEY = 'telemetry';

/**
 * Whether the app lock is on.
 *
 * Read by the Settings provider for the UI and by the vault (001 T028), which keeps its key behind the
 * biometric gate exactly when this reads "1". The two must never disagree about the key's place.
 */
export const APP_LOCK_KEY = 'appLock';

/** Which box this phone had open last (011, `activeBox.ts`). */
export const ACTIVE_BOX_KEY = 'activeBoxId';

/** Whether this phone was last showing the merged view rather than one box (024, `activeBox.ts`). */
export const UNIFIED_INBOX_KEY = 'unifiedInbox';

/** The boxes whose removal did not finish on this phone (`unfinishedRemovals.ts`). */
export const UNFINISHED_REMOVALS_KEY = 'unfinishedRemovals';

/**
 * The backups in this phone's store that retention must not delete, as a JSON list of archive names
 * (006 T030, 2026-09-15). See `BackupController.restore` for when a backup is added and when it leaves.
 */
export const BACKUP_HELD_KEY = 'backup.held';

/**
 * "1" while a sign-in has a handshake open in the shared cookie jar, "0" once the jar is emptied (018
 * FR-003, 2026-09-24). Set by `IsdsHttpTransport` as a sign-in starts to ride the jar and cleared
 * whenever it empties it, so a launch that finds it set knows the last run was killed mid-sign-in and
 * empties the jar then - and only then: emptying it loads Android's WebView cookie store, which a
 * launch should not pay for, or report failing, on every start.
 */
export const HANDSHAKE_OPEN_KEY = 'isds.handshakeOpen';

/**
 * Automatic attachment download (026 US4): on/off, from when ("new messages only" stores the moment the
 * switch went on; empty means every message in the archive), and whether it waits for Wi-Fi.
 *
 * Read by the Settings screen and by `AttachmentPrefetcher`, through `autoDownloadSettings.ts`.
 */
export const AUTO_DOWNLOAD_KEY = 'attachments.autoDownload';
export const AUTO_DOWNLOAD_SINCE_KEY = 'attachments.autoDownloadSince';
export const AUTO_DOWNLOAD_WIFI_KEY = 'attachments.autoDownloadWifiOnly';

/**
 * Settings that describe THIS install, and are therefore never carried to another one: a backup leaves
 * them out and a restore or a phone transfer skips them, also when an older backup still has them.
 *
 * One list, so the two halves cannot disagree, and each entry has a reason it would be wrong elsewhere:
 *
 * - `activeBoxId` and `unifiedInbox` - where this phone was last looking. Restored onto another
 *   device they state something that was never true there.
 * - `appLock` - the lock follows the vault KEY (001 T028), and the key is a Keychain item of this
 *   phone that no backup or transfer carries. Restored as "on", it armed a gate on a phone whose key
 *   had not travelled: the next launch showed the lock screen, and its unlock moved that phone's own
 *   key behind a biometric prompt nobody had switched on there.
 * - `unfinishedRemovals` - leftovers of a removal on THIS phone. Restored with an archive, a marker
 *   could send a box the backup brought back to be cleared.
 * - `telemetry` - the diagnostics answer given on THIS phone (`TelemetryConsent`). The consent is to
 *   what the SDK stores and sends from this device, and this phone has always answered it by the time
 *   a restore or a transfer can run - both are reached from a box's screens, behind the question.
 *   Restored, a "yes" given on another phone overwrote a "no" given here, and reports went out from
 *   the next launch on without anyone having agreed to it on this phone.
 * - `backup.held` - the backups in THIS phone's store that retention must keep, because a restore from
 *   them could not bring every document back. Carried in a backup, restoring it wrote the holds of the
 *   day that backup was made over today's, and a restore of a backup made with nothing held let go of
 *   the one backup still holding a document.
 * - `isds.handshakeOpen` - whether THIS phone's cookie jar holds a half-finished sign-in. Carried, it
 *   would empty a jar on another phone for nothing, or leave one unemptied.
 * - the three `attachments.autoDownload…` keys (026 FR-005) - whether THIS phone spends its storage and
 *   its data on attachments. Restored onto another phone, a "yes" would start downloading there on the
 *   first refresh without anyone having asked for it on that phone, and "since" is a moment that
 *   phone's `firstSeenAt` stamps were never measured against.
 */
export const DEVICE_LOCAL_SETTINGS: readonly string[] = [
  ACTIVE_BOX_KEY,
  UNIFIED_INBOX_KEY,
  APP_LOCK_KEY,
  UNFINISHED_REMOVALS_KEY,
  TELEMETRY_KEY,
  BACKUP_HELD_KEY,
  HANDSHAKE_OPEN_KEY,
  AUTO_DOWNLOAD_KEY,
  AUTO_DOWNLOAD_SINCE_KEY,
  AUTO_DOWNLOAD_WIFI_KEY,
];

/** Whether a setting stays on this install (`DEVICE_LOCAL_SETTINGS`). */
export function isDeviceLocalSetting(key: string): boolean {
  return DEVICE_LOCAL_SETTINGS.includes(key);
}
