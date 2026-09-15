// The use-cases the Settings screen calls (006).
//
// The rules under test are the ones that decide whether a user is actually protected: enabling makes
// a backup or stays off, status is read from the target rather than from a remembered flag, and a
// restore adopts the key it just used so the new phone is not silently unbacked-up.

import {
  BackupAbortedError,
  BackupController,
  BackupCancelledError,
  BackupLockUnavailableError,
  BackupRestoreHeldError,
  MAX_KEEP,
  adoptRestoredKeys,
} from '../../src/features/backup/state/backupController';
import { restoreErrorText } from '../../src/app/settings/BackupScreen';
import { t } from '../../src/i18n/strings';
import {
  BackupPromptDeclinedError,
  type BackupSecretStore,
} from '../../src/services/backup/backupSecret';
import * as telemetry from '../../src/services/telemetry/telemetry';
import type { PortableIo } from '../../src/services/backup/portableIo';
import { PortableFormatError, unpackPortable } from '../../src/services/backup/portable';
import { BackupAuthError } from '../../src/services/backup/envelope';
import type { SyncTarget } from '../../src/services/backup/backupService';
import type { BackupManifest } from '../../src/services/backup/schema';
import { InMemoryAccountsStore } from '../../src/services/db/accountsStore';
import { InMemoryMessagesStore } from '../../src/services/db/messagesStore';
import { InMemoryDraftsStore } from '../../src/services/db/draftsStore';
import { InMemoryRemindersStore } from '../../src/services/db/remindersStore';
import { backupSink, backupSource, documentDetails } from '../../src/services/backup/stores';
import type { DataBoxAccount, MessageDetail } from '../../src/services/isds/types';

const FAST = { m: 256, t: 1, p: 1 };

const account: DataBoxAccount = {
  id: 'acc_abc123',
  boxId: 'abc123',
  loginName: 'novak',
  label: 'Jan Novak',
  dbType: 'FO',
  alias: null,
  authMethod: 'otp_totp',
  host: 'production',
  secretRef: 'ref',
  sessionValidUntil: null,
  passwordExpiresAt: null,
  lastSyncedAt: null,
  messageCount: null,
  unreadCount: null,
  pdzCreditCzk: null,
  syncError: null,
  createdAt: 1,
  updatedAt: 1,
};

/** A Keychain that records what it holds, without any OS gate. */
function fakeSecret(): BackupSecretStore & {
  stored: string | null;
  /** The app-usable copy. Separate so an "upgraded from an older install" phone can be modelled. */
  usable: string | null;
  deny: boolean;
  locked: boolean;
} {
  return {
    stored: null,
    usable: null,
    deny: false,
    /** Whether the phone has a screen lock. Real phones mostly do; some do not. */
    locked: true,
    async canProtect() {
      return this.locked;
    },
    async save(passphrase) {
      this.stored = passphrase;
      this.usable = passphrase;
    },
    async reveal() {
      return this.deny ? null : this.stored;
    },
    /** The app's own copy: no gate, so `deny` (a declined prompt) does not apply to it. */
    async forUse() {
      return this.usable;
    },
    async has() {
      return this.stored !== null || this.usable !== null;
    },
    async clear() {
      this.stored = null;
      this.usable = null;
    },
  };
}

function memoryTarget(): SyncTarget & { archives: Map<string, Uint8Array>; fail: boolean } {
  const manifests: BackupManifest[] = [];
  return {
    archives: new Map(),
    fail: false,
    async listManifests() {
      return [...manifests];
    },
    async putBackup(manifest, archive) {
      if (this.fail) {
        throw new Error('no space left on device');
      }
      manifests.push(manifest);
      this.archives.set(manifest.archiveName, archive);
    },
    async getArchive(name) {
      const found = this.archives.get(name);
      if (!found) {
        throw new Error(`missing ${name}`);
      }
      return found;
    },
    async deleteBackup(name) {
      this.archives.delete(name);
      const at = manifests.findIndex(m => m.archiveName === name);
      if (at >= 0) {
        manifests.splice(at, 1);
      }
    },
  };
}

/** The settings table, in memory. */
function fakeSettings() {
  const values = new Map<string, string>();
  return {
    values,
    async getSetting(key: string) {
      return values.get(key) ?? null;
    },
    async setSetting(key: string, value: string) {
      values.set(key, value);
    },
  };
}

function build(now = () => 1_000) {
  const stores = {
    accounts: new InMemoryAccountsStore(),
    messages: new InMemoryMessagesStore(),
    drafts: new InMemoryDraftsStore(),
    reminders: new InMemoryRemindersStore(),
  };
  const secret = fakeSecret();
  const target = memoryTarget();
  const settings = fakeSettings();
  const io = fakeIo();
  const controller = new BackupController({
    source: backupSource(stores),
    sink: backupSink(stores, fn => fn()),
    secret,
    target,
    settings,
    appVersion: '1.4.0',
    now,
    kdf: FAST,
    portableIo: io,
  });
  return { stores, secret, target, settings, controller, io };
}

/** A document picker that never opens: records what was saved, answers with what was set. */
function fakeIo(): PortableIo & {
  saved: { fileName: string; bytes: Uint8Array } | null;
  cancelSave: boolean;
  toOpen: Uint8Array | null;
} {
  return {
    saved: null,
    cancelSave: false,
    toOpen: null,
    async save(fileName, bytes) {
      if (this.cancelSave) {
        return false;
      }
      this.saved = { fileName, bytes };
      return true;
    },
    async open() {
      return this.toOpen;
    },
  };
}

describe('BackupController', () => {
  it('is off, with nothing to restore, before it is enabled', async () => {
    const { controller } = build();
    expect(await controller.status()).toMatchObject({ enabled: false, last: null });
    expect(await controller.list()).toEqual([]);
  });

  it('enabling mints a key and makes the first backup at once', async () => {
    const { controller, secret, target } = build();
    const manifest = await controller.enable('unlock');

    expect(secret.stored).toMatch(/^[0-9A-Z]{4}(-[0-9A-Z]{4}){4}$/);
    expect(target.archives.get(manifest.archiveName)).toBeInstanceOf(Uint8Array);
    expect(await controller.status()).toMatchObject({ enabled: true, last: manifest });
  });

  it('leaves backups OFF when the first backup fails', async () => {
    const { controller, secret, target } = build();
    target.fail = true;

    await expect(controller.enable('unlock')).rejects.toThrow('no space left');
    // The dangerous outcome is a key with no archive: the screen would say "on" forever.
    expect(secret.stored).toBeNull();
    expect((await controller.status()).enabled).toBe(false);
  });

  it('refuses to switch on when the phone has no screen lock, and stores nothing', async () => {
    const { controller, secret, target } = build();
    secret.locked = false;

    await expect(controller.enable('unlock')).rejects.toBeInstanceOf(BackupLockUnavailableError);
    // The fix belongs to the user and is one setting away - so nothing half-made is left behind.
    expect(secret.stored).toBeNull();
    expect(target.archives.size).toBe(0);
  });

  it('reports the NEWEST backup, from the target rather than a remembered date', async () => {
    let clock = 1_000;
    const { controller } = build(() => clock);
    await controller.enable('unlock');
    clock = 9_000;
    const second = await controller.backupNow('unlock');

    const status = await controller.status();
    expect(status.last).toEqual(second);
    expect(status.last?.createdAt).toBe(9_000);
  });

  it('treats a declined prompt as a cancellation, not an error to report', async () => {
    const { controller, secret } = build();
    await controller.enable('unlock');
    secret.deny = true;

    await expect(controller.revealKey('unlock')).rejects.toBeInstanceOf(BackupCancelledError);
    // …and the key is still there: declining is not disabling.
    expect((await controller.status()).enabled).toBe(true);
  });

  it('backing up does not ask for the gate - the user just asked for it', async () => {
    // The prompt guards SHOWING the passphrase. Challenging someone to confirm the button they have
    // already pressed is the kind of friction that gets a feature switched off.
    const { controller, secret } = build();
    await controller.enable('unlock');
    secret.deny = true; // every gated read would fail

    await expect(controller.backupNow('unlock')).resolves.toBeTruthy();
  });

  it('restores on a fresh device and adopts the key it was given', async () => {
    const source = build();
    await source.stores.accounts.add(account);
    const manifest = await source.controller.enable('unlock');
    const key = source.secret.stored as string;

    // A second, empty device - new stores, new (empty) Keychain, same archive.
    const phone = build();
    await phone.target.putBackup(manifest, source.target.archives.get(manifest.archiveName)!);

    const report = await phone.controller.restore(manifest, key, 'unlock');
    expect(report.accountsAdded).toBe(1);
    expect((await phone.stores.accounts.list())[0].boxId).toBe('abc123');
    // Without this, the replacement phone would be restored and unprotected at the same time.
    expect(phone.secret.stored).toBe(key);
    expect((await phone.controller.status()).enabled).toBe(true);
  });

  it('keeps the key this phone already has, and does not ask to store it again', async () => {
    // Android prompts on the WRITE, so a needless save is a needless prompt - and overwriting would
    // orphan every backup this phone had already made.
    const source = build();
    const manifest = await source.controller.enable('unlock');
    const own = source.secret.stored as string;

    // A different clock, so the two archives are distinct files rather than the same name twice.
    const other = build(() => 7_000);
    const theirManifest = await other.controller.enable('unlock');
    const theirKey = other.secret.stored as string;
    await source.target.putBackup(
      theirManifest,
      other.target.archives.get(theirManifest.archiveName)!,
    );

    await source.controller.restore(theirManifest, theirKey, 'unlock');

    expect(source.secret.stored).toBe(own);
    expect(manifest.archiveName).not.toBe(theirManifest.archiveName);
  });

  it('does not keep a key that failed to open the backup', async () => {
    const source = build();
    const manifest = await source.controller.enable('unlock');
    const phone = build();
    await phone.target.putBackup(manifest, source.target.archives.get(manifest.archiveName)!);

    await expect(phone.controller.restore(manifest, 'WRON-GKEY-WRON-GKEY-WRON', 'unlock')).rejects.toThrow();
    expect(phone.secret.stored).toBeNull();
  });

  it('publishes the run while it happens, and clears it after', async () => {
    // The screen reads exactly this. It has to be live (or the bar never moves) and it has to be gone
    // at the end (or the screen shows a backup that finished ten minutes ago as still running).
    const { controller, secret } = build();
    const seenDuringRun: (string | null)[] = [];
    const notified: number[] = [];
    const unsubscribe = controller.subscribe(() => notified.push(1));

    expect(controller.currentRun()).toBeNull();
    await controller.enable('unlock', () => {
      seenDuringRun.push(controller.currentRun()?.kind ?? null);
    });

    expect(seenDuringRun.length).toBeGreaterThan(0);
    expect(seenDuringRun.every(kind => kind === 'backup')).toBe(true);
    expect(notified.length).toBeGreaterThan(0);
    expect(controller.currentRun()).toBeNull();
    expect(secret.stored).not.toBeNull();
    unsubscribe();
  });

  it('cancelling mid-run stops it and leaves no archive', async () => {
    const { controller, target } = build();
    // Enable first, so the cancel lands on a plain "back up now" rather than on setup.
    await controller.enable('unlock');
    const before = target.archives.size;

    await expect(
      controller.backupNow('unlock', progress => {
        if (progress.stage === 'reading' || progress.stage === 'sealing') {
          controller.cancelRun();
        }
      }),
    ).rejects.toBeInstanceOf(BackupAbortedError);

    expect(target.archives.size).toBe(before);
    expect(controller.currentRun()).toBeNull();
    // Cancelling a backup is not turning backups off: the key stays, the switch stays on.
    expect((await controller.status()).enabled).toBe(true);
  });

  it('backs the archive up on its own after a change, once the writing stops', async () => {
    // The switch says the archive keeps itself backed up; this is the part that makes that true.
    jest.useFakeTimers();
    try {
      // A moving clock: archives are named by time, so a fixed one would overwrite rather than add.
      let clock = 1_000;
      const { controller, target } = build(() => (clock += 1_000));
      await controller.enable('unlock');
      const after = target.archives.size;

      // A sync writes in bursts - envelopes, then details, then flags.
      const before = (await controller.status()).last?.createdAt;
      controller.archiveChanged();
      controller.archiveChanged();
      controller.archiveChanged();

      expect((await controller.status()).last?.createdAt).toBe(before); // waits for quiet
      // `runAllTimersAsync`, not a fixed advance: the derivation itself yields on timers, so the
      // backup only finishes if those run too.
      await jest.runAllTimersAsync();

      // ONE backup for the whole burst, not one per write - and with the default retention of one,
      // it REPLACED the previous one rather than piling up beside it.
      const now = await controller.status();
      expect(now.last?.createdAt).toBeGreaterThan(before ?? 0);
      expect(await controller.list()).toHaveLength(1);
      expect(target.archives.size).toBe(after);
    } finally {
      jest.useRealTimers();
    }
  });

  it('does nothing automatic when backups are off', async () => {
    jest.useFakeTimers();
    try {
      const { controller, target } = build();

      controller.archiveChanged();
      await jest.runAllTimersAsync();

      // No key, no backup, and no error either - an archive change is not a request.
      expect(target.archives.size).toBe(0);
      expect(controller.currentRun()).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it('turning it off forgets the key but never the archives', async () => {
    const { controller, target } = build();
    const manifest = await controller.enable('unlock');

    await controller.disable();

    const status = await controller.status();
    expect(status.enabled).toBe(false);
    // Still there - "stop backing up" must not mean "destroy my only copy" (Principle IV).
    expect(status.last).toEqual(manifest);
    expect(target.archives.size).toBe(1);
  });
});

// A second backup asked for while one runs (audit 2026-09-23). The screen guards its buttons with
// state, which lands a render late, so a double tap reaches the controller twice. The second call is
// made here WITHOUT awaiting the first, the way the second press arrives.
describe('a backup asked for twice at once (double tap)', () => {
  it('switching on twice mints and saves ONE key, and the backup opens with it', async () => {
    let clock = 1_000;
    const source = build(() => (clock += 1_000));
    await source.stores.accounts.add(account);
    const save = jest.spyOn(source.secret, 'save');

    const first = source.controller.enable('unlock');
    const second = source.controller.enable('unlock');
    const [a, b] = await Promise.all([first, second]);

    expect(save).toHaveBeenCalledTimes(1);
    // The same backup for both callers - not a second one sealed under a second key.
    expect(b).toBe(a);
    expect(source.target.archives.size).toBe(1);

    // The key the screen shows opens the backup the screen reports: restored on a fresh phone with it.
    const key = source.secret.stored as string;
    const phone = build();
    await phone.target.putBackup(a, source.target.archives.get(a.archiveName)!);
    const report = await phone.controller.restore(a, key, 'unlock');
    phone.controller.cancelPending(); // the automatic backup a restore schedules is not this test's
    expect(report.accountsAdded).toBe(1);
  });

  it('"back up now" twice makes ONE archive, and reports it to both callers', async () => {
    let clock = 1_000;
    const { controller, target } = build(() => (clock += 1_000));
    await controller.enable('unlock');
    const before = await controller.list();
    const put = jest.spyOn(target, 'putBackup');
    const heard: string[] = [];

    const first = controller.backupNow('unlock', () => heard.push('first'));
    const second = controller.backupNow('unlock', () => heard.push('second'));
    const [a, b] = await Promise.all([first, second]);

    expect(put).toHaveBeenCalledTimes(1);
    expect(b).toBe(a);
    // Both callers hear the progress of the one backup that ran.
    expect(heard).toContain('first');
    expect(heard).toContain('second');
    // Retention kept the new backup in place of the old one - it did not spend its one slot on a copy.
    const after = await controller.list();
    expect(after).toHaveLength(1);
    expect(after[0].manifest.archiveName).toBe(a.archiveName);
    expect(after[0].manifest.archiveName).not.toBe(before[0].manifest.archiveName);
  });

  it('"back up now" during switching on joins the first backup instead of queueing another', async () => {
    let clock = 1_000;
    const { controller, target } = build(() => (clock += 1_000));
    const put = jest.spyOn(target, 'putBackup');

    const enabling = controller.enable('unlock');
    const backingUp = controller.backupNow('unlock');
    expect(await backingUp).toBe(await enabling);
    expect(put).toHaveBeenCalledTimes(1);
  });

  it('holds only while the backup runs: the next one, asked for after, is made', async () => {
    let clock = 1_000;
    const { controller, target } = build(() => (clock += 1_000));
    await controller.enable('unlock');
    const put = jest.spyOn(target, 'putBackup');
    const a = await controller.backupNow('unlock');
    const b = await controller.backupNow('unlock');
    expect(put).toHaveBeenCalledTimes(2);
    expect(b.archiveName).not.toBe(a.archiveName);
  });

  it('a failed backup lets go too, and both callers hear the failure', async () => {
    const { controller, target, secret } = build();
    target.fail = true;
    const first = controller.enable('unlock');
    const second = controller.enable('unlock');
    await expect(first).rejects.toThrow('no space left');
    await expect(second).rejects.toThrow('no space left');
    expect(secret.stored).toBeNull();

    target.fail = false;
    await expect(controller.enable('unlock')).resolves.toBeTruthy();
  });
});

describe('the automatic backup and the running one', () => {
  it('waits rather than starting a second run on top of a manual one', async () => {
    jest.useFakeTimers();
    try {
      let clock = 1_000;
      const { controller, target } = build(() => (clock += 1_000));
      await controller.enable('unlock');
      const before = target.archives.size;

      // A change arrives while a backup is already running.
      const manual = controller.backupNow('unlock');
      controller.archiveChanged();
      await jest.runAllTimersAsync();
      const first = await manual;
      await jest.runAllTimersAsync();

      // Two runs happened, one after the other - never two at once - and retention kept the newer.
      const kept = await controller.list();
      expect(kept).toHaveLength(1);
      expect(kept[0].manifest.createdAt).toBeGreaterThan(first.createdAt);
      expect(controller.currentRun()).toBeNull();
      expect(target.archives.size).toBe(before);
    } finally {
      jest.useRealTimers();
    }
  });

  it('can be called off - nothing is scheduled after cancelPending', async () => {
    jest.useFakeTimers();
    try {
      let clock = 1_000;
      const { controller, target } = build(() => (clock += 1_000));
      await controller.enable('unlock');
      const before = target.archives.size;

      controller.archiveChanged();
      controller.cancelPending();
      await jest.runAllTimersAsync();

      expect(target.archives.size).toBe(before);
    } finally {
      jest.useRealTimers();
    }
  });
});

// A backup is a whole copy of the archive. Kept forever, one per refresh, that is a slow way to fill
// a phone with copies of the same messages - which is why the default is ONE and more is deliberate.
describe('a phone set up before the app kept two copies of the key', () => {
  it('still says backups are on', async () => {
    const { controller, secret } = build();
    await controller.enable('unlock');
    secret.usable = null; // the old install: only the gated copy exists

    expect((await controller.status()).enabled).toBe(true);
  });

  it('asks once on the next backup, then never again', async () => {
    const { controller, secret, target } = build(() => Date.now());
    await controller.enable('unlock');
    const before = target.archives.size;
    secret.usable = null;

    await controller.backupNow('unlock');

    // It used the gated copy and wrote the app-usable one, so the NEXT backup is silent.
    expect(secret.usable).toBe(secret.stored);
    expect(target.archives.size).toBeGreaterThanOrEqual(before);

    secret.deny = true; // any further prompt would fail
    await expect(controller.backupNow('unlock')).resolves.toBeTruthy();
  });

  it('does not heal - or prompt - when backups are genuinely off', async () => {
    const { controller, secret } = build();
    await expect(controller.backupNow('unlock')).rejects.toBeInstanceOf(BackupCancelledError);
    expect(secret.stored).toBeNull();
  });
});

describe('how many backups are kept', () => {
  const backupAt = async (
    controller: BackupController,
    clock: { t: number },
  ) => {
    clock.t += 1_000;
    return controller.backupNow('unlock');
  };

  it('keeps exactly one by default, replacing it each time', async () => {
    const clock = { t: 1_000 };
    const { controller } = build(() => clock.t);
    await controller.enable('unlock');
    await backupAt(controller, clock);
    await backupAt(controller, clock);

    const kept = await controller.list();
    expect(kept).toHaveLength(1);
    expect(kept[0].manifest.createdAt).toBe(clock.t);
  });

  it('keeps as many as asked for, and drops the OLDEST past the limit', async () => {
    const clock = { t: 1_000 };
    const { controller } = build(() => clock.t);
    await controller.enable('unlock');
    await controller.setPreferences({ keep: 3 });

    const made = [];
    for (let i = 0; i < 5; i++) {
      made.push(await backupAt(controller, clock));
    }

    const kept = (await controller.list()).map(b => b.manifest.createdAt);
    expect(kept).toHaveLength(3);
    // The three newest, newest first - the two oldest are gone.
    expect(kept).toEqual(made.slice(-3).map(m => m.createdAt).reverse());
  });

  it('never goes below one, whatever it is asked', async () => {
    const clock = { t: 1_000 };
    const { controller } = build(() => clock.t);
    await controller.enable('unlock');

    await controller.setPreferences({ keep: 0 });
    await backupAt(controller, clock);

    // "Keep none" would mean backing up and immediately deleting it: the request is nonsense, and
    // the answer is one, not zero.
    expect(await controller.list()).toHaveLength(1);
  });

  it('caps the limit rather than trusting a stored number', async () => {
    const { controller, settings } = build();
    settings.values.set('backup.keep', '9999');
    expect((await controller.preferences()).keep).toBe(MAX_KEEP);
  });

  it('lowering the limit deletes the excess straight away', async () => {
    const clock = { t: 1_000 };
    const { controller } = build(() => clock.t);
    await controller.enable('unlock');
    await controller.setPreferences({ keep: 5 });
    for (let i = 0; i < 4; i++) {
      await backupAt(controller, clock);
    }
    expect(await controller.list()).toHaveLength(5);

    await controller.setPreferences({ keep: 2 });

    // The user asked for less space to be used; waiting until the next backup to honour that would
    // be a strange answer.
    expect(await controller.list()).toHaveLength(2);
  });

  it('deletes the backup the user picked, not the oldest', async () => {
    const clock = { t: 1_000 };
    const { controller } = build(() => clock.t);
    await controller.enable('unlock');
    await controller.setPreferences({ keep: 3 });
    const first = await backupAt(controller, clock);
    const second = await backupAt(controller, clock);

    await controller.deleteBackup(second.archiveName);

    const kept = (await controller.list()).map(b => b.manifest.archiveName);
    expect(kept).not.toContain(second.archiveName);
    expect(kept).toContain(first.archiveName);
  });

  it('turning automatic off means a change no longer starts anything', async () => {
    jest.useFakeTimers();
    try {
      const clock = { t: 1_000 };
      const { controller } = build(() => (clock.t += 1_000));
      await controller.enable('unlock');
      await controller.setPreferences({ automatic: false });
      const before = (await controller.status()).last?.createdAt;

      controller.archiveChanged();
      await jest.runAllTimersAsync();

      expect((await controller.status()).last?.createdAt).toBe(before);
    } finally {
      jest.useRealTimers();
    }
  });
});

// ── Leaving the phone, and coming back (T014) + opening for real (T013) ──────────────────────────

describe('a backup that leaves the phone', () => {
  it('exports the sealed archive and its manifest as one file', async () => {
    const { controller, io } = build();
    const manifest = await controller.enable('Unlock');

    expect(await controller.exportBackup(manifest)).toBe(true);
    expect(io.saved?.fileName).toMatch(/^obalka-.*\.obalka$/);

    // The file has to be self-sufficient: the manifest travels WITH the archive, because
    // compatibility is judged before anyone is asked for a passphrase.
    const back = unpackPortable(io.saved!.bytes);
    expect(back.manifest).toEqual(manifest);
  });

  it('exports without ever asking for the passphrase', async () => {
    // Export moves sealed bytes. Asking to unlock would be the app demanding a credential for an
    // operation that does not need one, and training the user to type it when asked.
    const { controller, secret, io } = build();
    const manifest = await controller.enable('Unlock');
    secret.deny = true; // any prompt would now throw
    await expect(controller.exportBackup(manifest)).resolves.toBe(true);
    expect(io.saved).not.toBeNull();
  });

  it('reports a dismissed sheet as nothing happening, not as a failure', async () => {
    const { controller, io } = build();
    const manifest = await controller.enable('Unlock');
    io.cancelSave = true;
    await expect(controller.exportBackup(manifest)).resolves.toBe(false);
  });
});

describe('a backup coming back', () => {
  it('joins the list and can then be restored by the ordinary path', async () => {
    // Exported from one "phone"...
    const a = build();
    const manifest = await a.controller.enable('Unlock');
    await a.controller.exportBackup(manifest);
    const file = a.io.saved!.bytes;

    // ...and imported into another, which has never seen it.
    const b = build();
    expect(await b.controller.list()).toHaveLength(0);
    b.io.toOpen = file;

    const imported = await b.controller.importBackup();
    expect(imported).toEqual(manifest);
    const listed = await b.controller.list();
    expect(listed).toHaveLength(1);
    expect(listed[0].manifest.archiveName).toBe(manifest.archiveName);
    expect(listed[0].restorable).toBe(true);
  });

  it('treats a cancelled picker as nothing happening', async () => {
    const { controller, io } = build();
    io.toOpen = null;
    await expect(controller.importBackup()).resolves.toBeNull();
    expect(await controller.list()).toHaveLength(0);
  });

  it('refuses a file that is not one of ours, and says so in a sentence', async () => {
    const { controller, io } = build();
    io.toOpen = new Uint8Array(200).fill(0x41);
    await expect(controller.importBackup()).rejects.toThrow(PortableFormatError);
    expect(await controller.list()).toHaveLength(0);
  });

  it('refuses a damaged file rather than storing a backup that cannot be opened', async () => {
    // The worst outcome would be accepting this: a listed backup, restorable-looking, that fails at
    // the one moment it is needed.
    const a = build();
    const manifest = await a.controller.enable('Unlock');
    await a.controller.exportBackup(manifest);
    const truncated = a.io.saved!.bytes.slice(0, a.io.saved!.bytes.length - 32);

    const b = build();
    b.io.toOpen = truncated;
    await expect(b.controller.importBackup()).rejects.toThrow(PortableFormatError);
    expect(await b.controller.list()).toHaveLength(0);
  });
});

describe('verifying a backup', () => {
  it('decrypts it and reports what is inside', async () => {
    const { controller, stores } = build();
    await stores.accounts.add(account);
    const manifest = await controller.enable('Unlock');

    const report = await controller.verify(manifest, 'Unlock');
    expect(report.accounts).toBe(1);
    expect(report.createdAt).toBe(manifest.createdAt);
  });

  it('fails when the archive is corrupt, which is the whole point', async () => {
    // A check that the file exists would pass here. This one opens it.
    const { controller, target } = build();
    const manifest = await controller.enable('Unlock');
    const archive = target.archives.get(manifest.archiveName)!;
    archive[archive.length - 1] ^= 0xff;

    await expect(controller.verify(manifest, 'Unlock')).rejects.toThrow();
  });

  it('is a cancellation, not an error, when the OS prompt is dismissed', async () => {
    const { controller, secret } = build();
    const manifest = await controller.enable('Unlock');
    secret.deny = true;
    await expect(controller.verify(manifest, 'Unlock')).rejects.toThrow(
      BackupCancelledError,
    );
  });
});

describe('keeping the keys a restore used (006, shared with 025 since 2026-09-15)', () => {
  it('keeps the document key even when storing the passphrase is refused', async () => {
    // Android asks for the screen lock when the passphrase is stored, and that prompt can be declined.
    // The document key needs no prompt. With the passphrase first, a declined prompt lost the document
    // key too, and turning backups on afterwards minted a new one - so the next backup uploaded every
    // document again under names the store did not have.
    const settings = new Map<string, string>();
    const documentKey = 'ab'.repeat(32);
    await expect(
      adoptRestoredKeys(
        {
          secret: {
            has: async () => false,
            save: async () => {
              throw new Error('The prompt was declined.');
            },
          },
          settings: {
            getSetting: async key => settings.get(key) ?? null,
            setSetting: async (key, value) => {
              settings.set(key, value);
            },
          },
        },
        'FKPX-9WQ2-7TDM-4RJH-2CVB',
        documentKey,
        'Unlock',
      ),
    ).rejects.toThrow('declined');
    expect([...settings.values()]).toEqual([documentKey]);
  });
});

describe('switching backups on where a key is already kept (025 review, 2026-09-15)', () => {
  it('backs up under the key a transfer kept, and never replaces or clears it', async () => {
    // A phone-to-phone transfer keeps the key that arrived from a screen of its own, while the backup
    // screen underneath could still show backups as off. Switching them on minted a new key over the
    // one the user holds on paper from the old phone, and a failed first backup then cleared it.
    const kept = 'FKPX-9WQ2-7TDM-4RJH-2CVB';
    const { controller, secret, target } = build();
    await secret.save(kept, 'unlock');

    const made = await controller.enable('unlock');
    expect(secret.stored).toBe(kept);
    expect(target.archives.get(made.archiveName)).toBeInstanceOf(Uint8Array);
    // Made under the kept key: the key on paper opens it.
    expect((await controller.verify(made, 'unlock')).createdAt).toBe(made.createdAt);

    target.fail = true;
    await expect(controller.enable('unlock')).rejects.toThrow('no space left');
    expect(secret.stored).toBe(kept);
  });
});

describe('one run at a time (025 review, 2026-09-15)', () => {
  /** Let pending promises and zero-delay timers run until `ready` holds. */
  async function settleUntil(ready: () => boolean): Promise<void> {
    for (let i = 0; i < 50 && !ready(); i++) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    expect(ready()).toBe(true);
  }

  it('starts no automatic backup beside a transfer s save, and backs up once the save has ended', async () => {
    // A transfer's save went around the run tracking, so a backup scheduled by a sync a moment earlier
    // could start while the transfer was writing the archive, and read it half written.
    jest.useFakeTimers();
    try {
      let clock = 1_000;
      const { controller, target } = build(() => (clock += 1_000));
      await controller.enable('unlock');
      const before = (await controller.status()).last?.createdAt ?? 0;

      let release = () => {};
      const gate = new Promise<void>(resolve => {
        release = resolve;
      });
      const saving = controller.runRestore(async onProgress => {
        onProgress({ stage: 'restoring', done: 0, total: 1, fraction: 0.5 });
        await gate;
        return 'saved';
      });
      // Shown as the restore it is, and as one that cannot be stopped part-way.
      expect(controller.currentRun()).toMatchObject({ kind: 'restore', cancellable: false });

      controller.archiveChanged();
      await jest.advanceTimersByTimeAsync(30_000);
      expect(controller.currentRun()?.kind).toBe('restore');
      expect((await controller.status()).last?.createdAt).toBe(before);

      release();
      await expect(saving).resolves.toBe('saved');
      await jest.runAllTimersAsync();

      // The change that arrived during the save is backed up after it, and retention kept one.
      expect((await controller.status()).last?.createdAt).toBeGreaterThan(before);
      expect(controller.currentRun()).toBeNull();
      expect(target.archives.size).toBe(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('makes a save asked for during a backup wait until that backup has ended', async () => {
    // The other way round was open too: a run started beside a backup that was still reading.
    const phone = build();
    await phone.controller.enable('unlock');
    let release = () => {};
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });
    const source = backupSource(phone.stores);
    const controller = new BackupController({
      source: {
        ...source,
        listAccounts: async () => {
          await gate;
          return source.listAccounts();
        },
      },
      sink: backupSink(phone.stores, fn => fn()),
      secret: phone.secret,
      target: phone.target,
      settings: phone.settings,
      appVersion: '1.4.0',
      now: () => 5_000,
      kdf: FAST,
    });
    const backingUp = controller.backupNow('unlock');
    await settleUntil(() => controller.currentRun()?.kind === 'backup');

    const order: string[] = [];
    const saving = controller.runRestore(async () => {
      order.push(`save during ${controller.currentRun()?.kind}`);
      return 'saved';
    });
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(order).toEqual([]);
    expect(controller.currentRun()?.kind).toBe('backup');

    release();
    await backingUp;
    await expect(saving).resolves.toBe('saved');
    expect(order).toEqual(['save during restore']);
    expect(controller.currentRun()).toBeNull();
  });
});

describe('a restore whose password cannot be kept (2026-09-15)', () => {
  /** A backup made on one phone, put in a fresh phone's store, and the key that opens it. */
  async function freshPhone() {
    const source = build();
    await source.stores.accounts.add(account);
    const manifest = await source.controller.enable('unlock');
    const phone = build();
    await phone.target.putBackup(manifest, source.target.archives.get(manifest.archiveName)!);
    return { phone, manifest, key: source.secret.stored as string };
  }

  it('is still the restore it was, says the password was not kept, and traces a declined prompt', async () => {
    // The keys are kept after the archive is written, and a declined screen lock rejected the whole
    // restore - so the backup screen said "Zálohu se nepodařilo obnovit" over a restore that had worked,
    // and a person would have restored again.
    const traced = jest.spyOn(telemetry, 'trace').mockImplementation(() => undefined);
    const reported = jest.spyOn(telemetry, 'reportFailure').mockImplementation(() => undefined);
    try {
      const declined = await freshPhone();
      declined.phone.secret.save = async () => {
        throw new BackupPromptDeclinedError();
      };
      const report = await declined.phone.controller.restore(
        declined.manifest,
        declined.key,
        'unlock',
      );
      expect(report).toMatchObject({ accountsAdded: 1, keysFailed: true });
      expect((await declined.phone.stores.accounts.list())[0].boxId).toBe('abc123');
      expect((await declined.phone.controller.status()).enabled).toBe(false);
      expect(traced).toHaveBeenCalledWith('backup.restore', {
        stage: 'persist',
        outcome: 'declined',
      });
      expect(reported).not.toHaveBeenCalledWith(
        'backup.restore',
        expect.anything(),
        expect.anything(),
      );

      // A Keystore that broke is a failure worth reporting - and still not a failed restore.
      const broken = new Error('Key permanently invalidated');
      const failing = await freshPhone();
      failing.phone.secret.save = async () => {
        throw broken;
      };
      await expect(
        failing.phone.controller.restore(failing.manifest, failing.key, 'unlock'),
      ).resolves.toMatchObject({ keysFailed: true });
      expect(reported).toHaveBeenCalledWith('backup.restore', broken, { stage: 'persist' });
    } finally {
      traced.mockRestore();
      reported.mockRestore();
    }
  });

  it('says the keys were kept when they were', async () => {
    const { phone, manifest, key } = await freshPhone();
    await expect(phone.controller.restore(manifest, key, 'unlock')).resolves.toMatchObject({
      keysFailed: false,
    });
    expect(phone.secret.stored).toBe(key);
  });
});

/** Let pending promises run, with timers faked, until `ready` holds. */
async function flushUntil(ready: () => boolean): Promise<void> {
  for (let i = 0; i < 50 && !ready(); i++) {
    await jest.advanceTimersByTimeAsync(1);
  }
  expect(ready()).toBe(true);
}

/** A controller over `phone`'s stores and keys whose backups wait at their first read until released. */
function heldAtReading(phone: ReturnType<typeof build>, now: () => number) {
  let release = () => {};
  const gate = new Promise<void>(resolve => {
    release = resolve;
  });
  const source = backupSource(phone.stores);
  const controller = new BackupController({
    source: {
      ...source,
      listAccounts: async () => {
        await gate;
        return source.listAccounts();
      },
    },
    sink: backupSink(phone.stores, fn => fn()),
    secret: phone.secret,
    target: phone.target,
    settings: phone.settings,
    appVersion: '1.4.0',
    now,
    kdf: FAST,
  });
  return { controller, release: () => release() };
}

describe('a stop reaches the run it was meant for, waiting or running (2026-09-15)', () => {
  it('stops a backup asked for during an automatic backup, not only the automatic one', async () => {
    // "Zálohovat nyní" pressed during an automatic backup waits for it. Leaving and choosing "Zrušit
    // zálohu" then stopped the automatic backup, and the waiting backup started with a fresh stop flag
    // and ran to the end, after the person had said stop.
    jest.useFakeTimers();
    const reported = jest.spyOn(telemetry, 'reportFailure').mockImplementation(() => undefined);
    try {
      let clock = 1_000;
      const now = () => (clock += 1_000);
      const phone = build(now);
      await phone.controller.enable('unlock');
      const before = (await phone.controller.list()).map(b => b.manifest.archiveName);
      const { controller, release } = heldAtReading(phone, now);

      controller.archiveChanged();
      await jest.advanceTimersByTimeAsync(8_000);
      await flushUntil(() => controller.currentRun()?.kind === 'backup');

      const manualEnded = controller.backupNow('unlock').then(
        () => 'made',
        (e: unknown) => e,
      );
      await jest.advanceTimersByTimeAsync(10);
      controller.cancelRun();
      release();
      await jest.runAllTimersAsync();

      expect(await manualEnded).toBeInstanceOf(BackupAbortedError);
      expect(controller.currentRun()).toBeNull();
      expect((await controller.list()).map(b => b.manifest.archiveName)).toEqual(before);
      // A stop is the person's decision: the stopped automatic backup is not reported as a failure.
      expect(reported).not.toHaveBeenCalled();

      // The stop was for the runs there were: a backup asked for after it is not stopped by it.
      const later = controller.backupNow('unlock');
      await jest.runAllTimersAsync();
      const made = await later;
      expect((await controller.list()).map(b => b.manifest.archiveName)).toEqual([made.archiveName]);
    } finally {
      reported.mockRestore();
      jest.useRealTimers();
    }
  });
});

describe('a restore is a change to the archive (FR-017, 2026-09-15)', () => {
  it('backs up what a transfer s save wrote once the save has ended, and nothing after a save that failed', async () => {
    // A phone that kept the key arriving with a transfer showed backups on and had no backup at all
    // until something else changed the archive: a save was not counted as a change.
    jest.useFakeTimers();
    try {
      let clock = 1_000;
      const { controller, secret } = build(() => (clock += 1_000));

      await expect(
        controller.runRestore(async () => {
          throw new Error('no space left on device');
        }),
      ).rejects.toThrow('no space left');
      await secret.save('FKPX-9WQ2-7TDM-4RJH-2CVB', 'unlock');
      await jest.runAllTimersAsync();
      expect((await controller.status()).last).toBeNull();

      await controller.runRestore(async () => 'saved');
      expect(await controller.status()).toMatchObject({ enabled: true, last: null });

      // It waits for quiet like any other change, so a sync straight after the save is the same backup.
      await jest.advanceTimersByTimeAsync(7_000);
      expect((await controller.status()).last).toBeNull();
      await jest.runAllTimersAsync();
      expect((await controller.status()).last).not.toBeNull();
      expect(await controller.list()).toHaveLength(1);
      expect(controller.currentRun()).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  /** A phone with backups of documents allowed, one downloaded document, and an object store. */
  async function documentPhone() {
    let clock = 1_000;
    const now = () => (clock += 1_000);
    const phone = build(now);
    const path = '/phone/attachments/abc123/m1/0-rozhodnuti.pdf';
    const enclosure = '/phone/attachments/abc123/m1/1-priloha.pdf';
    const disk = new Map<string, Uint8Array>([
      [path, new Uint8Array(300).map((_, i) => i % 251)],
      [enclosure, new Uint8Array(200).fill(9)],
    ]);
    await phone.stores.accounts.add(account);
    const detail = {
      id: 'm1',
      subject: 'Rozhodnuti',
      sender: 'Urad',
      senderAddress: null,
      recipient: null,
      recipientAddress: null,
      deliveryTime: 1,
      acceptanceTime: 1,
      attachments: [
        {
          name: 'rozhodnuti.pdf',
          mimeType: 'application/pdf',
          metaType: 'main',
          contentBase64: '',
          localPath: path,
          size: 300,
        },
        {
          name: 'priloha.pdf',
          mimeType: 'application/pdf',
          metaType: 'enclosure',
          contentBase64: '',
          localPath: enclosure,
          size: 200,
        },
      ],
    } as MessageDetail;
    await phone.stores.messages.cacheDetail('abc123', detail);
    const pieces = (bytes: Uint8Array) => {
      let at = 0;
      return async (count = 64) => {
        if (at >= bytes.length) {
          return null;
        }
        const piece = bytes.slice(at, at + count);
        at += piece.length;
        return piece;
      };
    };
    const objects = new Map<string, Uint8Array>();
    const target: SyncTarget = Object.assign(phone.target, {
      hasObject: async (name: string) => objects.has(name),
      putObject: async (name: string, pull: () => Promise<Uint8Array | null>) => {
        const parts: number[] = [];
        for (let piece = await pull(); piece; piece = await pull()) {
          parts.push(...piece);
        }
        objects.set(name, Uint8Array.from(parts));
      },
      getObject: async (name: string) => {
        const found = objects.get(name);
        if (!found) {
          throw new Error(`no such file: ${name}`);
        }
        return pieces(found);
      },
    });
    const controller = new BackupController({
      source: backupSource(phone.stores),
      sink: backupSink(phone.stores, fn => fn()),
      secret: phone.secret,
      target,
      settings: phone.settings,
      appVersion: '1.4.0',
      now,
      kdf: FAST,
      documents: {
        source: {
          sizeOf: async p => disk.get(p)?.length ?? null,
          open: async p => pieces(disk.get(p) ?? new Uint8Array(0)),
        },
        fs: {
          ensureDir: async () => undefined,
          writeBytes: async (p, bytes) => {
            disk.set(p, bytes.slice());
          },
          appendBytes: async (p, bytes) => {
            disk.set(p, Uint8Array.from([...(disk.get(p) ?? []), ...bytes]));
          },
          exists: async p => disk.has(p),
          move: async (from, to) => {
            disk.set(to, disk.get(from) ?? new Uint8Array(0));
            disk.delete(from);
          },
          remove: async p => {
            disk.delete(p);
          },
        },
        details: documentDetails(phone.stores),
        messageDir: (boxId, messageId) => `/phone/attachments/${boxId}/${messageId}`,
        randomBytes: n => new Uint8Array(n).fill(7),
      },
    });
    await controller.setPreferences({ documents: true });
    return {
      controller,
      objects,
      secret: phone.secret,
      settings: phone.settings,
      target,
      stores: phone.stores,
    };
  }

  describe('the backup a restore could not bring every document back from (constitution IV, 2026-09-15)', () => {
    /** The archive names retention is holding, as the controller stored them. */
    const heldIn = (settings: { values: Map<string, string> }) =>
      JSON.parse(settings.values.get('backup.held') ?? '[]') as string[];
    const WRONG_KEY = 'AAAA-AAAA-AAAA-AAAA-AAAA';

    it('outlives a retention of one while later backups come and go, until a restore from it brings every document back', async () => {
      // A document the restore could not bring back is still in the backup it came from, in this
      // phone's own store. The automatic backup after the next change replaced that backup under the
      // default retention of one, and with it the only way of getting the document back.
      jest.useFakeTimers();
      try {
        const { controller, objects, secret } = await documentPhone();
        const made = await controller.enable('unlock');
        expect(made.tiers.documents).toBe(true);
        const key = secret.stored as string;
        const stored = new Map(objects);

        objects.clear();
        const partial = await controller.restore(made, key, 'unlock');
        expect(partial.documents).toMatchObject({ restored: 0, missing: 2 });
        expect(partial.held).toBe(true);
        // The restore schedules a backup, and a sync after it schedules another.
        await jest.runAllTimersAsync();
        controller.archiveChanged();
        await jest.runAllTimersAsync();
        const listed = await controller.list();
        expect(listed.map(b => [b.manifest.archiveName === made.archiveName, b.held])).toEqual([
          [false, false],
          [true, true],
        ]);
        const newest = listed[0].manifest;
        expect(newest.createdAt).toBeGreaterThan(made.createdAt);

        for (const [name, bytes] of stored) {
          objects.set(name, bytes);
        }
        const whole = await controller.restore(made, key, 'unlock');
        expect(whole.documents).toMatchObject({ restored: 2, missing: 0, failed: 0 });
        expect(whole.held).toBe(false);
        // Every document is back, so it is an ordinary backup again, and the next backup replaces it.
        await jest.runAllTimersAsync();
        const after = await controller.list();
        expect(after).toHaveLength(1);
        expect(after[0].manifest.createdAt).toBeGreaterThan(newest.createdAt);
        expect(after[0].held).toBe(false);
        expect(controller.currentRun()).toBeNull();
      } finally {
        jest.useRealTimers();
      }
    });

    it('is spared when the limit is lowered, and deleting it is what lets it go', async () => {
      const { controller, objects, secret, settings } = await documentPhone();
      await controller.setPreferences({ keep: 3 });
      const made = await controller.enable('unlock');
      objects.clear();
      await controller.restore(made, secret.stored as string, 'unlock');
      controller.cancelPending();
      await controller.backupNow('unlock');
      const newest = await controller.backupNow('unlock');

      await controller.setPreferences({ keep: 1 });
      expect((await controller.list()).map(b => b.manifest.archiveName)).toEqual([
        newest.archiveName,
        made.archiveName,
      ]);

      await controller.deleteBackup(made.archiveName);
      expect(heldIn(settings)).toEqual([]);
      expect((await controller.list()).map(b => b.manifest.archiveName)).toEqual([newest.archiveName]);
    });

    it('is held before the first row is written, and a hold the restore added goes when it fails before its rows', async () => {
      // The documents come after the rows and can take minutes. An app closed part-way left rows
      // without their documents, and the next sync's backup replaced the backup that has them.
      const { controller, objects, secret, settings } = await documentPhone();
      const made = await controller.enable('unlock');
      const key = secret.stored as string;

      await expect(controller.restore(made, WRONG_KEY, 'unlock')).rejects.toBeInstanceOf(BackupAuthError);
      expect(heldIn(settings)).toEqual([]);

      objects.clear();
      const whileWriting: boolean[] = [];
      await controller.restore(made, key, 'unlock', progress => {
        if (progress.stage === 'restoring') {
          whileWriting.push(heldIn(settings).includes(made.archiveName));
        }
      });
      expect(whileWriting.length).toBeGreaterThan(0);
      expect(whileWriting.every(Boolean)).toBe(true);

      // A hold an earlier restore left is not a failed restore's to drop.
      await expect(controller.restore(made, WRONG_KEY, 'unlock')).rejects.toBeInstanceOf(BackupAuthError);
      expect(heldIn(settings)).toEqual([made.archiveName]);
      controller.cancelPending();
    });

    it('refuses the restore when the hold cannot be stored, before the backup is even read', async () => {
      const { controller, secret, settings, target } = await documentPhone();
      const made = await controller.enable('unlock');
      const failure = new Error('database is locked');
      const write = settings.setSetting;
      settings.setSetting = async (key: string, value: string) => {
        if (key === 'backup.held') {
          throw failure;
        }
        return write(key, value);
      };
      const fetched = jest.spyOn(target, 'getArchive');

      await expect(controller.restore(made, secret.stored as string, 'unlock')).rejects.toBe(failure);
      expect(fetched).not.toHaveBeenCalled();
      expect(controller.currentRun()).toBeNull();
      expect(controller.takeRestoreOutcome()).toEqual({ ok: false, error: failure });
    });

    /** Reads of the held list that answer a moment later with what was stored when asked, as a database does. */
    function slowHeldReads(settings: { getSetting(key: string): Promise<string | null> }) {
      const read = settings.getSetting;
      settings.getSetting = async (key: string) => {
        const value = await read(key);
        if (key === 'backup.held') {
          await new Promise(resolve => setTimeout(resolve, 5));
        }
        return value;
      };
    }

    it('is not written over by a delete letting another backup go at the same moment (review)', async () => {
      // The delete read the list before the restore stored its hold and wrote its own copy after it, so
      // the backup the restore had just held was held no longer, and the next backup could delete it.
      const { controller, objects, secret, settings } = await documentPhone();
      await controller.setPreferences({ keep: 3 });
      const older = await controller.enable('unlock');
      const made = await controller.backupNow('unlock');
      settings.values.set('backup.held', JSON.stringify([older.archiveName]));
      slowHeldReads(settings);
      objects.clear();

      await Promise.all([
        controller.restore(made, secret.stored as string, 'unlock'),
        controller.deleteBackup(older.archiveName),
      ]);
      controller.cancelPending();

      expect(heldIn(settings)).toEqual([made.archiveName]);
      expect((await controller.list()).map(b => [b.manifest.archiveName, b.held])).toEqual([
        [made.archiveName, true],
      ]);
    });

    it('is not deleted by a limit lowered at the same moment as the restore holds it (review)', async () => {
      // Retention read the list before the restore stored its hold and deleted by that older list, so
      // the backup being restored went while it was the one place its documents could come back from.
      const { controller, objects, secret, settings } = await documentPhone();
      await controller.setPreferences({ keep: 3 });
      const older = await controller.enable('unlock');
      const newest = await controller.backupNow('unlock');
      slowHeldReads(settings);
      objects.clear();

      const restored = controller.restore(older, secret.stored as string, 'unlock');
      await Promise.all([restored, controller.setPreferences({ keep: 1 })]);
      controller.cancelPending();

      expect((await restored).held).toBe(true);
      expect((await controller.list()).map(b => [b.manifest.archiveName, b.held])).toEqual([
        [newest.archiveName, false],
        [older.archiveName, true],
      ]);
    });

    it('is held when a document is left with no message to belong to (review)', async () => {
      // Its message went while the documents were written - its box removed, say - so the document is in
      // the backup and not in this archive, and a restore from that backup brings both back.
      const { controller, secret, settings, stores } = await documentPhone();
      const made = await controller.enable('unlock');

      const restored = await controller.restore(made, secret.stored as string, 'unlock', progress => {
        if (progress.stage === 'documents' && progress.done === 0) {
          void stores.messages.clearBox('abc123');
        }
      });
      controller.cancelPending();

      expect(restored.documents).toMatchObject({ restored: 0, missing: 0, failed: 0, orphaned: 2 });
      expect(restored.held).toBe(true);
      expect(heldIn(settings)).toEqual([made.archiveName]);
    });

    it('does not call a backup deleted while it wrote the documents held (2026-09-24)', async () => {
      // A later visit can delete the backup a restore is still writing documents from. The delete lets
      // its hold go, and the restore then ended saying the backup "will not delete itself".
      const { controller, objects, secret, settings, target } = await documentPhone();
      const made = await controller.enable('unlock');
      objects.clear();
      let deleting: Promise<void> = Promise.resolve();
      const read = target.getObject?.bind(target);
      target.getObject = async (name: string) => {
        await deleting; // the documents are read once the delete has gone through
        return (read as NonNullable<typeof read>)(name);
      };

      const restored = await controller.restore(made, secret.stored as string, 'unlock', progress => {
        if (progress.stage === 'documents' && progress.done === 0) {
          deleting = controller.deleteBackup(made.archiveName);
        }
      });
      controller.cancelPending();

      expect(restored.documents).toMatchObject({ restored: 0, missing: 2 });
      expect(await controller.list()).toEqual([]);
      expect(heldIn(settings)).toEqual([]);
      expect(restored.held).toBe(false);
    });

    it('does not call a backup deleted while it wrote the documents held when it then fails (2026-09-24)', async () => {
      const { controller, secret, settings, stores } = await documentPhone();
      const made = await controller.enable('unlock');
      const failure = new Error('database is locked');

      const error = await controller
        .restore(made, secret.stored as string, 'unlock', progress => {
          if (progress.stage === 'documents' && progress.done === 0) {
            stores.messages.getDetail = async () => {
              // The delete goes through before the documents stage fails.
              await controller.deleteBackup(made.archiveName);
              throw failure;
            };
          }
        })
        .catch((e: unknown) => e);
      controller.cancelPending();

      expect(heldIn(settings)).toEqual([]);
      expect(error).toBe(failure);
      expect(restoreErrorText(error)).toBe(t('backup.restore.error'));
    });

    it('says the backup stays held when it fails once its rows are in (2026-09-24)', async () => {
      // Its rows are in and its documents are not, so the backup stays held - and the failure said
      // nothing of it; only the list row did.
      const { controller, secret, settings, stores } = await documentPhone();
      const made = await controller.enable('unlock');
      const failure = new Error('database is locked');

      const restoring = controller.restore(made, secret.stored as string, 'unlock', progress => {
        if (progress.stage === 'documents' && progress.done === 0) {
          stores.messages.getDetail = async () => {
            throw failure;
          };
        }
      });
      const error = await restoring.catch((e: unknown) => e);
      controller.cancelPending();

      expect(error).toBeInstanceOf(BackupRestoreHeldError);
      expect((error as BackupRestoreHeldError).reason).toBe(failure);
      expect(heldIn(settings)).toEqual([made.archiveName]);
      expect(restoreErrorText(error)).toBe(
        `${t('backup.restore.error')} ${t('backup.restore.error.held')}`,
      );
      // A failure before the rows is said as it always was.
      expect(restoreErrorText(failure)).toBe(t('backup.restore.error'));
    });
  });

  it('can be stopped until its rows are in, and then writes its documents to the end', async () => {
    // A stop that reached the documents left the messages restored without them: the rows are
    // committed before the first document is written, and no transaction takes them back, while FR-016
    // says a stopped restore leaves the archive as it was. A transfer's save is not stoppable at all for
    // the same reason (025 FR-012).
    jest.useFakeTimers();
    try {
      const { controller, secret } = await documentPhone();
      const made = await controller.enable('unlock');
      const key = secret.stored as string;

      const early: boolean[] = [];
      await expect(
        controller.restore(made, key, 'unlock', progress => {
          if (progress.stage === 'opening') {
            early.push(controller.cancelRun());
          }
        }),
      ).rejects.toBeInstanceOf(BackupAbortedError);
      // The stop says it was taken, and a stopped restore schedules no backup.
      expect(early.length).toBeGreaterThan(0);
      expect(early.every(value => value)).toBe(true);
      await jest.runAllTimersAsync();
      expect((await controller.list()).map(b => b.manifest.archiveName)).toEqual([made.archiveName]);

      const stoppable: (boolean | undefined)[] = [];
      const taken: boolean[] = [];
      const restored = await controller.restore(made, key, 'unlock', progress => {
        if (progress.stage === 'documents') {
          stoppable.push(controller.currentRun()?.cancellable);
          taken.push(controller.cancelRun());
        }
      });
      expect(restored.documents).toMatchObject({ restored: 2, missing: 0, failed: 0 });
      // Shown as a run that can no longer be stopped, so the backup screen offers no stop it would not keep.
      expect(stoppable.length).toBeGreaterThan(0);
      expect(stoppable.every(value => value === false)).toBe(true);
      // And a stop that comes anyway, from a leave dialog opened before this point, says it was not
      // taken, so the screen can say the restore goes on (2026-09-15, review).
      expect(taken.every(value => !value)).toBe(true);
      controller.cancelPending();
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('an automatic backup whose settings cannot be read (2026-09-15, review)', () => {
  it('reports the failed read rather than letting it escape unhandled', async () => {
    // It runs from a timer that nobody awaits, and a restore now schedules it as well as a sync. Its
    // first step reads the preferences from the database, and that read rejecting escaped every handler.
    jest.useFakeTimers();
    const reported = jest.spyOn(telemetry, 'reportFailure').mockImplementation(() => undefined);
    try {
      let clock = 1_000;
      const { controller, settings } = build(() => (clock += 1_000));
      await controller.enable('unlock');
      const failure = new Error('database is locked');
      settings.getSetting = async () => {
        throw failure;
      };

      controller.archiveChanged();
      await jest.runAllTimersAsync();

      expect(reported).toHaveBeenCalledWith('backup.snapshot', failure, { stage: 'persist' });
      expect(controller.currentRun()).toBeNull();
    } finally {
      reported.mockRestore();
      jest.useRealTimers();
    }
  });
});

describe('retention that cannot tell which backups are held (2026-09-15)', () => {
  it('deletes none of them rather than guessing, and the list claims none it cannot read', async () => {
    const reported = jest.spyOn(telemetry, 'reportFailure').mockImplementation(() => undefined);
    try {
      let clock = 1_000;
      const { controller, settings } = build(() => (clock += 1_000));
      await controller.setPreferences({ keep: 3 });
      await controller.enable('unlock');
      await controller.backupNow('unlock');
      await controller.backupNow('unlock');

      const failure = new Error('database is locked');
      const read = settings.getSetting;
      settings.getSetting = async (key: string) => {
        if (key === 'backup.held') {
          throw failure;
        }
        return read(key);
      };
      await controller.setPreferences({ keep: 1 });
      expect(await controller.list()).toHaveLength(3);
      expect(reported).toHaveBeenCalledWith('backup.snapshot', failure, { stage: 'persist' });

      // A value this code did not write reads as not knowing, too.
      settings.getSetting = read;
      settings.values.set('backup.held', '{"not":"a list"}');
      await controller.backupNow('unlock');
      const listed = await controller.list();
      expect(listed).toHaveLength(4);
      expect(listed.some(b => b.held)).toBe(false);
      expect(reported).toHaveBeenCalledWith('backup.snapshot', expect.any(Error), { stage: 'parse' });
    } finally {
      reported.mockRestore();
    }
  });
});

describe('how a restore ended, for a backup screen that did not see it end (2026-09-15)', () => {
  it('is kept until taken, once, for a restore that ended or failed, and not for one that was stopped', async () => {
    // Leaving the backup screen with "Nechat běžet" unmounted it, and how the restore ended was said
    // nowhere. A transfer's save already kept its outcome for the next screen (025).
    const { controller, secret } = build();
    const made = await controller.enable('unlock');
    const key = secret.stored as string;
    let heard = 0;
    const unsubscribe = controller.subscribeRestoreOutcome(() => {
      heard++;
    });
    try {
      expect(controller.takeRestoreOutcome()).toBeNull();

      const restored = await controller.restore(made, key, 'unlock');
      expect(heard).toBe(1);
      expect(controller.takeRestoreOutcome()).toEqual({ ok: true, restored });
      expect(controller.takeRestoreOutcome()).toBeNull();

      await expect(controller.restore(made, 'AAAA-AAAA-AAAA-AAAA-AAAA', 'unlock')).rejects.toBeInstanceOf(
        BackupAuthError,
      );
      expect(heard).toBe(2);
      expect(controller.takeRestoreOutcome()).toEqual({
        ok: false,
        error: expect.any(BackupAuthError),
      });

      await expect(
        controller.restore(made, key, 'unlock', progress => {
          if (progress.stage === 'opening') {
            controller.cancelRun();
          }
        }),
      ).rejects.toBeInstanceOf(BackupAbortedError);
      expect(heard).toBe(2);
      expect(controller.takeRestoreOutcome()).toBeNull();
    } finally {
      unsubscribe();
      controller.cancelPending();
    }
  });

  it('keeps nothing its screen was there to say, asks as the restore ends, and keeps each other one (review)', async () => {
    // One slot, and a screen that skipped every outcome while its own restore went on: a restore started
    // on a later visit hid how the one an earlier visit left running had ended, and a restore that ended
    // as its screen went back was taken by that screen and said nowhere.
    const { controller, secret } = build();
    const made = await controller.enable('unlock');
    const key = secret.stored as string;
    let heard = 0;
    const unsubscribe = controller.subscribeRestoreOutcome(() => {
      heard++;
    });
    try {
      await controller.restore(made, key, 'unlock', undefined, () => true);
      expect(heard).toBe(0);
      expect(controller.takeRestoreOutcome()).toBeNull();

      // There when it started, gone by the time it ended.
      let there = true;
      const left = await controller.restore(
        made,
        key,
        'unlock',
        () => {
          there = false;
        },
        () => there,
      );
      await expect(
        controller.restore(made, 'AAAA-AAAA-AAAA-AAAA-AAAA', 'unlock', undefined, () => false),
      ).rejects.toBeInstanceOf(BackupAuthError);
      expect(heard).toBe(2);
      expect(controller.takeRestoreOutcome()).toEqual({ ok: true, restored: left });
      expect(controller.takeRestoreOutcome()).toEqual({
        ok: false,
        error: expect.any(BackupAuthError),
      });
      expect(controller.takeRestoreOutcome()).toBeNull();
    } finally {
      unsubscribe();
      controller.cancelPending();
    }
  });
});

describe('a verify is not a restore (2026-09-15)', () => {
  it('runs as a verify, so leaving it does not speak of a backup or a restore', async () => {
    const { controller } = build();
    const made = await controller.enable('unlock');
    const kinds: (string | undefined)[] = [];
    await controller.verify(made, 'unlock', () => {
      kinds.push(controller.currentRun()?.kind);
    });
    expect(kinds.length).toBeGreaterThan(0);
    expect(kinds.every(kind => kind === 'verify')).toBe(true);
  });
});
