// Settings that stay on the phone they were written on (006, 025, 001 T028).
//
// A snapshot kept every setting but `activeBoxId`, and a restore wrote back whatever a payload held.
// Two keys made that wrong. `appLock`: the lock follows the vault key, a Keychain item no backup or
// transfer carries, so "on" restored onto another phone put a lock screen in front of it whose unlock
// moved that phone's own key behind a prompt nobody had switched on. And the marker of an unfinished
// box removal, which restored with an archive could send a box the backup brought back to be cleared.
// And `telemetry`, the diagnostics answer: a "yes" from the other phone overwrote this phone's "no".
// These run the real snapshot and the real restore over the real in-memory stores.

import {
  APP_LOCK_KEY,
  DEVICE_LOCAL_SETTINGS,
  isDeviceLocalSetting,
  TELEMETRY_KEY,
  UNFINISHED_REMOVALS_KEY,
} from '../../src/app/settings/settingsKeys';
import { buildPayload } from '../../src/services/backup/snapshot';
import { restorePayload } from '../../src/services/backup/restore';
import { backupSink, backupSource } from '../../src/services/backup/stores';
import { BACKUP_SCHEMA_VERSION, type BackupPayload } from '../../src/services/backup/schema';
import { InMemoryAccountsStore } from '../../src/services/db/accountsStore';
import { InMemoryMessagesStore } from '../../src/services/db/messagesStore';
import { InMemoryDraftsStore } from '../../src/services/db/draftsStore';
import { InMemoryRemindersStore } from '../../src/services/db/remindersStore';
import {
  InMemoryVaultKeyStorage,
  Vault,
  VaultUnavailableError,
} from '../../src/services/secureStore/vault';

function phone() {
  return {
    accounts: new InMemoryAccountsStore(),
    messages: new InMemoryMessagesStore(),
    drafts: new InMemoryDraftsStore(),
    reminders: new InMemoryRemindersStore(),
  };
}

/** A payload as an app from before this list would have written it: every setting in it. */
const oldPayload = (settings: Record<string, string>): BackupPayload => ({
  schemaVersion: BACKUP_SCHEMA_VERSION,
  accounts: [],
  messages: [],
  drafts: [],
  reminders: [],
  settings,
  documents: [],
  documentKey: null,
});

describe('the device-local settings', () => {
  it('are the box this phone had open, its merged view, its app lock, its unfinished removals, its diagnostics answer, its backup holds, its open sign-in handshake and its automatic download', () => {
    expect([...DEVICE_LOCAL_SETTINGS].sort()).toEqual(
      [
        'attachments.autoDownload',
        'attachments.autoDownloadSince',
        'attachments.autoDownloadWifiOnly',
        'activeBoxId',
        'appLock',
        'backup.held',
        'isds.handshakeOpen',
        'telemetry',
        'unifiedInbox',
        'unfinishedRemovals',
      ].sort(),
    );
    expect(isDeviceLocalSetting(APP_LOCK_KEY)).toBe(true);
    expect(isDeviceLocalSetting('themeMode')).toBe(false);
    // Per-box rows share a prefix with nothing on the list, and a prefix is not a match.
    expect(isDeviceLocalSetting('appLockExtra')).toBe(false);
  });

  it('are left out of a snapshot, while every other setting goes in', async () => {
    const stores = phone();
    for (const [key, value] of Object.entries({
      themeMode: 'dark',
      locale: 'en',
      'scanDismiss:abc:1': '1',
      'backup.automatic': '1',
      activeBoxId: 'abc',
      unifiedInbox: '1',
      appLock: '1',
      unfinishedRemovals: '["gone"]',
      telemetry: '1',
    })) {
      await stores.accounts.setSetting(key, value);
    }
    const payload = await buildPayload(backupSource(stores));
    expect(payload.settings).toEqual({
      'backup.automatic': '1',
      locale: 'en',
      'scanDismiss:abc:1': '1',
      themeMode: 'dark',
    });
  });

  it('are skipped by a restore of a backup that still carries them', async () => {
    const stores = phone();
    const report = await restorePayload(
      oldPayload({
        themeMode: 'dark',
        activeBoxId: 'abc',
        unifiedInbox: '1',
        appLock: '1',
        [UNFINISHED_REMOVALS_KEY]: '["abc"]',
        telemetry: '1',
      }),
      backupSink(stores, fn => fn()),
    );
    expect(await stores.accounts.allSettings()).toEqual({ themeMode: 'dark' });
    // The count is what the restore screen reports, so it counts what was written.
    expect(report.settingsRestored).toBe(1);
  });

  it('keeps what this phone already had for them', async () => {
    const stores = phone();
    await stores.accounts.setSetting(APP_LOCK_KEY, '1');
    await stores.accounts.setSetting(UNFINISHED_REMOVALS_KEY, '["here"]');
    await restorePayload(
      oldPayload({ appLock: '0', unfinishedRemovals: '[]' }),
      backupSink(stores, fn => fn()),
    );
    expect(await stores.accounts.getSetting(APP_LOCK_KEY)).toBe('1');
    expect(await stores.accounts.getSetting(UNFINISHED_REMOVALS_KEY)).toBe('["here"]');
  });

  it('keep the diagnostics answer given on this phone when the backup says yes', async () => {
    // By the time a restore or a transfer can run, this phone has answered the question - both are
    // reached from a box's screens, behind it. Restored, the other phone's "yes" replaced the "no" here,
    // and reports went out from the next launch with nobody having agreed to it on this phone.
    const stores = phone();
    await stores.accounts.setSetting(TELEMETRY_KEY, '0');
    await restorePayload(oldPayload({ telemetry: '1' }), backupSink(stores, fn => fn()));
    expect(await stores.accounts.getSetting(TELEMETRY_KEY)).toBe('0');
  });

  it('do not arm the app lock on a phone whose vault key did not travel', async () => {
    const stores = phone();
    const storage = new InMemoryVaultKeyStorage();
    const vault = new Vault({
      storage,
      lockSetting: {
        read: async () => (await stores.accounts.getSetting(APP_LOCK_KEY)) === '1',
        write: on => stores.accounts.setSetting(APP_LOCK_KEY, on ? '1' : '0'),
      },
    });
    // The backup was made on a phone with the lock on.
    await restorePayload(oldPayload({ appLock: '1' }), backupSink(stores, fn => fn()));

    // A secret read on this phone: with the lock armed it waits for an unlock that nothing asks for,
    // and gives up here instead of hanging the test.
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 200);
    let outcome: 'key' | 'waiting';
    try {
      await vault.useKey(abort.signal);
      outcome = 'key';
    } catch (e) {
      expect(e).toBeInstanceOf(VaultUnavailableError);
      outcome = 'waiting';
    } finally {
      clearTimeout(timer);
    }
    expect(outcome).toBe('key');
    expect(storage.prompts).toBe(0);
    expect(storage.gated).toBeNull();
  });
});
