// Removing a box, end to end (001 T037).
//
// Removing the last box returned to Welcome with the app lock still armed and still switched on: a
// biometric gate in front of an app with nothing left in it, for whoever set it up next. The removal
// sequence lived inline in `AppShell.handleRemove`, which cannot be mounted here, so nothing could
// check it. It is `removeBox` now, and these run it over the real AccountsController with in-memory
// stores. What the shell does with its result is driven through the mounted shell in
// `__tests__/app/boxRemoval.test.tsx`.

import {
  removalFailureReport,
  removeBox,
  resumeRemoval,
  settleRemoval,
  type RemoveBoxDeps,
} from '../../src/features/accounts/state/removeBox';
import { unfinishedRemovals } from '../../src/features/accounts/state/unfinishedRemovals';
import { AccountsController } from '../../src/features/accounts/state/accountsController';
import { InMemoryAccountsStore } from '../../src/services/db/accountsStore';
import { InMemorySecureStore } from '../../src/services/secureStore/secureStore';
import {
  InMemoryVaultKeyStorage,
  Vault,
} from '../../src/services/secureStore/vault';
import type { DataBoxAccount, OwnerInfo } from '../../src/services/isds/types';

const owner = (boxId: string): OwnerInfo => ({
  boxId,
  label: boxId,
  dbType: null,
  passwordExpiresAt: null,
});

const add = (controller: AccountsController, boxId: string) =>
  controller.addAccount({
    loginName: `login-${boxId}`,
    password: 'pw',
    method: 'password',
    host: 'czebox',
    ownerInfo: owner(boxId),
  });

async function setup(boxIds: readonly string[]) {
  const secureStore = new InMemorySecureStore();
  const store = new InMemoryAccountsStore();
  let n = 0;
  const controller = new AccountsController({
    accounts: store,
    secureStore,
    genId: () => `id${++n}`,
  });
  for (const boxId of boxIds) {
    await add(controller, boxId);
  }
  // The user had switched the lock on: the vault key behind the gate, and on in settings.
  const lock = await lockedOnVault();
  const setAppLock = jest.fn();
  const purged: string[] = [];
  // The mark lives in the same settings table as everything else on a phone.
  const marks = unfinishedRemovals(store);
  const deps: RemoveBoxDeps = {
    accounts: controller,
    purges: [
      {
        step: 'archive',
        run: async id => {
          purged.push(`archive:${id}`);
        },
      },
      {
        step: 'reminders',
        run: async id => {
          purged.push(`reminders:${id}`);
        },
      },
    ],
    appLock: lock,
    setAppLock,
    unfinished: marks,
  };
  return { controller, secureStore, lock, setAppLock, purged, marks, deps };
}

/** A vault with the lock switched on: its key behind the gate, the setting on. */
async function lockedOnVault() {
  const storage = new InMemoryVaultKeyStorage();
  let setting = false;
  const vault = new Vault({
    storage,
    lockSetting: {
      read: async () => setting,
      write: async on => {
        setting = on;
      },
    },
  });
  await vault.useKey();
  await vault.enable('unlock');
  return {
    vault,
    storage,
    /** Armed = a vault key still exists anywhere, or the setting still says on. */
    get armed() {
      return storage.gated !== null || storage.plain !== null || setting;
    },
    forget: () => vault.forget(),
  };
}

const boxIds = (accounts: readonly DataBoxAccount[] | null) => accounts?.map(a => a.boxId);

describe('removing a box', () => {
  it('resets the app lock when it was the last box - disarmed AND switched off', async () => {
    const { lock, setAppLock, deps } = await setup(['only']);
    const result = await removeBox('only', deps);
    expect(result).toEqual({ kind: 'removed', remaining: [], failures: [] });
    // Both halves, the two the Settings toggle takes: a disarmed token with the setting still on
    // would ask for a fingerprint it can never accept, and the reverse keeps the gate armed.
    expect(lock.armed).toBe(false);
    expect(setAppLock).toHaveBeenCalledTimes(1);
    expect(setAppLock).toHaveBeenCalledWith(false);
  });

  it('decides the lock, and what the screen shows, on what is left AFTER the purges', async () => {
    // The purges take a while - the box's downloaded files go with its archive - and the store can
    // change under them. Listed before them, a last box removed meanwhile was missed, the lock stayed
    // armed over an app with no box, and the screen was handed a box that was already gone.
    const { controller, lock, setAppLock, deps } = await setup(['a', 'b']);
    const meanwhile: RemoveBoxDeps = {
      ...deps,
      purges: [{ step: 'archive', run: () => controller.removeAccount('b') }, ...deps.purges],
    };
    const result = await removeBox('a', meanwhile);
    expect(result).toEqual({ kind: 'removed', remaining: [], failures: [] });
    expect(lock.armed).toBe(false);
    expect(setAppLock).toHaveBeenCalledWith(false);
  });

  it('leaves the lock alone while another box remains', async () => {
    const { lock, setAppLock, deps } = await setup(['a', 'b']);
    const result = await removeBox('a', deps);
    expect(result.kind).toBe('removed');
    expect(boxIds(result.remaining)).toEqual(['b']);
    expect(lock.armed).toBe(true);
    expect(setAppLock).not.toHaveBeenCalled();
  });

  it('decides on what is actually left - a removal that failed resets nothing', async () => {
    const { controller, lock, setAppLock, purged, deps } = await setup(['only']);
    // The row could not be deleted, so the box is still there - and so is its lock.
    const failing: RemoveBoxDeps = {
      ...deps,
      accounts: {
        removeRow: async () => {
          throw new Error('db locked');
        },
        forgetSecrets: id => controller.forgetSecrets(id),
        listAccounts: () => controller.listAccounts(),
      },
    };
    const result = await removeBox('only', failing);
    expect(result).toMatchObject({
      kind: 'failed',
      rowGone: false,
      failures: [{ step: 'row', error: new Error('db locked') }],
    });
    expect(boxIds(result.remaining)).toEqual(['only']);
    expect(lock.armed).toBe(true);
    expect(setAppLock).not.toHaveBeenCalled();
    // A box the app still lists keeps its archive: deleting it now would lose it without a word.
    expect(purged).toEqual([]);
  });

  it('finishes the rest when the row delete threw with the row already gone', async () => {
    // The store's own bookkeeping runs after the DELETE, so the call can fail after the row went.
    const { controller, purged, deps } = await setup(['a', 'b']);
    const result = await removeBox('a', {
      ...deps,
      accounts: {
        removeRow: async id => {
          await controller.removeRow(id);
          throw new Error('active box write failed');
        },
        forgetSecrets: id => controller.forgetSecrets(id),
        listAccounts: () => controller.listAccounts(),
      },
    });
    expect(result).toMatchObject({ kind: 'failed', rowGone: true, failures: [{ step: 'row' }] });
    expect(purged).toEqual(['archive:a', 'reminders:a']);
  });

  it('still resets the lock when the last row is gone but the Keychain refuses the secret', async () => {
    // The row goes BEFORE the secret. When that delete throws there is no box left, and stopping at
    // the error kept the previous owner's biometric gate armed in front of the next launch's Welcome.
    const secureStore = new InMemorySecureStore();
    const controller = new AccountsController({
      accounts: new InMemoryAccountsStore(),
      secureStore: {
        savePassword: (boxId, password) => secureStore.savePassword(boxId, password),
        readPassword: boxId => secureStore.readPassword(boxId),
        saveSession: (boxId, cookie) => secureStore.saveSession(boxId, cookie),
        readSession: boxId => secureStore.readSession(boxId),
        deleteBox: async () => {
          throw new Error('keychain down');
        },
      },
    });
    await add(controller, 'only');
    const { lock, setAppLock, purged, deps } = await setup([]);
    const result = await removeBox('only', { ...deps, accounts: controller });
    expect(result).toEqual({
      kind: 'failed',
      rowGone: true,
      remaining: [],
      failures: [{ step: 'secrets', error: new Error('keychain down') }],
    });
    expect(await controller.listAccounts()).toEqual([]);
    expect(lock.armed).toBe(false);
    expect(setAppLock).toHaveBeenCalledWith(false);
    // …and the rest of the box still goes. Nothing can reach its archive, its files or its reminders
    // now, and stopping at the Keychain left every one of them on the device.
    expect(purged).toEqual(['archive:only', 'reminders:only']);
  });

  it('still resets the lock, and runs the later purges, when a purge fails after the last row is gone', async () => {
    const { lock, setAppLock, purged, deps } = await setup(['only']);
    const purgeFails: RemoveBoxDeps = {
      ...deps,
      purges: [
        {
          step: 'archive',
          run: async () => {
            throw new Error('archive busy');
          },
        },
        ...deps.purges.filter(p => p.step !== 'archive'),
      ],
    };
    const result = await removeBox('only', purgeFails);
    expect(result).toEqual({
      kind: 'failed',
      rowGone: true,
      remaining: [],
      failures: [{ step: 'archive', error: new Error('archive busy') }],
    });
    expect(lock.armed).toBe(false);
    expect(setAppLock).toHaveBeenCalledWith(false);
    // One stubborn step must not strand the reminders, whose notifications would fire at nothing.
    expect(purged).toEqual(['reminders:only']);
  });

  it('reports the removal’s own error even when the store cannot be listed afterwards', async () => {
    const { lock, setAppLock, purged, deps } = await setup(['only']);
    const broken: RemoveBoxDeps = {
      ...deps,
      accounts: {
        removeRow: async () => {
          throw new Error('db locked');
        },
        forgetSecrets: async () => {},
        listAccounts: async () => {
          throw new Error('db gone');
        },
      },
    };
    const result = await removeBox('only', broken);
    expect(result).toEqual({
      kind: 'failed',
      rowGone: false,
      remaining: null,
      failures: [
        { step: 'row', error: new Error('db locked') },
        { step: 'list', error: new Error('db gone') },
      ],
    });
    expect(lock.armed).toBe(true);
    expect(setAppLock).not.toHaveBeenCalled();
    // Unknown is treated as still listed: nothing held for the box is touched.
    expect(purged).toEqual([]);
  });

  it('deletes the secrets once the row went, and clears nothing it cannot check, when the store cannot be listed', async () => {
    // It used to run every purge on regardless. A store that cannot say whether the box is listed
    // cannot say whether a restore has just brought it back either; the mark stays, and the rest is
    // finished once the store answers.
    const { controller, secureStore, lock, purged, marks, deps } = await setup(['only']);
    const unlistable: RemoveBoxDeps = {
      ...deps,
      accounts: {
        removeRow: id => controller.removeRow(id),
        forgetSecrets: id => controller.forgetSecrets(id),
        listAccounts: async () => {
          throw new Error('db gone');
        },
      },
    };
    const result = await removeBox('only', unlistable);
    expect(result).toEqual({
      kind: 'failed',
      rowGone: true,
      remaining: null,
      failures: [{ step: 'list', error: new Error('db gone') }],
    });
    expect(await secureStore.readPassword('only')).toEqual({ status: 'absent' });
    expect(purged).toEqual([]);
    // Whether any box is left is unknown, so the lock is not reset on a guess.
    expect(lock.armed).toBe(true);
    expect(await marks.list()).toEqual(['only']);
  });

  it('resolves with the failure when the lock will not reset, rather than rejecting', async () => {
    const { setAppLock, deps } = await setup(['only']);
    const stuck: RemoveBoxDeps = {
      ...deps,
      appLock: {
        forget: async () => {
          throw new Error('keychain busy');
        },
      },
    };
    const result = await removeBox('only', stuck);
    expect(result).toEqual({
      kind: 'failed',
      rowGone: true,
      remaining: [],
      failures: [{ step: 'lock', error: new Error('keychain busy') }],
    });
    // The setting is not switched off over a key that is still there.
    expect(setAppLock).not.toHaveBeenCalled();
  });

  it('purges everything else held for the box, in order, and only for that box', async () => {
    const { secureStore, purged, deps } = await setup(['a', 'b']);
    await removeBox('a', deps);
    expect(purged).toEqual(['archive:a', 'reminders:a']);
    expect(await secureStore.readPassword('a')).toEqual({ status: 'absent' });
    expect(await secureStore.readPassword('b')).toEqual({ status: 'found', value: 'pw' });
  });

  it('says when the row is gone, before anything else of the box is cleared', async () => {
    const { deps } = await setup(['a', 'b']);
    const seen: string[] = [];
    await removeBox('a', {
      ...deps,
      onRowGone: id => seen.push(`rowGone:${id}`),
      purges: [{ step: 'archive', run: async id => void seen.push(`archive:${id}`) }],
    });
    expect(seen).toEqual(['rowGone:a', 'archive:a']);
  });
});

describe('the mark an unfinished removal is finished from', () => {
  it('is written before the row goes, and cleared once everything went', async () => {
    const { controller, marks, deps } = await setup(['a', 'b']);
    let listedWhenMarked: boolean | null = null;
    const result = await removeBox('a', {
      ...deps,
      unfinished: {
        add: async id => {
          listedWhenMarked = (await controller.listAccounts()).some(a => a.boxId === id);
          await marks.add(id);
        },
        remove: id => marks.remove(id),
      },
    });
    expect(result.kind).toBe('removed');
    // Before, so a removal killed halfway through still has something to be found by.
    expect(listedWhenMarked).toBe(true);
    expect(await marks.list()).toEqual([]);
  });

  it('stays when a step after the row failed', async () => {
    const { marks, deps } = await setup(['a', 'b']);
    await removeBox('a', {
      ...deps,
      accounts: {
        ...deps.accounts,
        removeRow: id => deps.accounts.removeRow(id),
        forgetSecrets: async () => {
          throw new Error('keychain down');
        },
        listAccounts: () => deps.accounts.listAccounts(),
      },
    });
    expect(await marks.list()).toEqual(['a']);
  });

  it('goes when the row would not delete - the box is still here, with Odebrat', async () => {
    const { controller, marks, deps } = await setup(['a']);
    await removeBox('a', {
      ...deps,
      accounts: {
        removeRow: async () => {
          throw new Error('db locked');
        },
        forgetSecrets: id => controller.forgetSecrets(id),
        listAccounts: () => controller.listAccounts(),
      },
    });
    expect(await marks.list()).toEqual([]);
  });

  it('stays when the store cannot say whether the row went', async () => {
    const { marks, deps } = await setup(['a']);
    await removeBox('a', {
      ...deps,
      accounts: {
        removeRow: async () => {
          throw new Error('db locked');
        },
        forgetSecrets: async () => {},
        listAccounts: async () => {
          throw new Error('db gone');
        },
      },
    });
    expect(await marks.list()).toEqual(['a']);
  });

  it('does not stop a removal when it will not write, and is reported with it', async () => {
    const { purged, deps } = await setup(['a', 'b']);
    const result = await removeBox('a', {
      ...deps,
      unfinished: {
        add: async () => {
          throw new Error('settings locked');
        },
        remove: async () => {},
      },
    });
    expect(result).toEqual({
      kind: 'removed',
      remaining: [expect.objectContaining({ boxId: 'b' })],
      failures: [{ step: 'marker', error: new Error('settings locked') }],
    });
    expect(purged).toEqual(['archive:a', 'reminders:a']);
  });
});

describe('finishing an unfinished removal', () => {
  /** A removal that took the row and stopped there - the Keychain refused, and the app was closed. */
  async function leftBehind(boxIdsOnPhone: readonly string[], removed: string) {
    const phone = await setup(boxIdsOnPhone);
    await phone.marks.add(removed);
    await phone.controller.removeRow(removed);
    return phone;
  }

  it('finishes what stayed of a box that is no longer listed, and clears its mark', async () => {
    const { secureStore, purged, marks, lock, deps } = await leftBehind(['a', 'b'], 'a');
    const result = await resumeRemoval('a', deps);
    expect(result).toMatchObject({ kind: 'removed', failures: [] });
    expect(boxIds(result.remaining)).toEqual(['b']);
    expect(await secureStore.readPassword('a')).toEqual({ status: 'absent' });
    expect(await secureStore.readPassword('b')).toEqual({ status: 'found', value: 'pw' });
    expect(purged).toEqual(['archive:a', 'reminders:a']);
    expect(await marks.list()).toEqual([]);
    expect(lock.armed).toBe(true);
  });

  it('resets the app lock when the box it finishes was the last', async () => {
    const { lock, setAppLock, deps } = await leftBehind(['only'], 'only');
    await resumeRemoval('only', deps);
    expect(lock.armed).toBe(false);
    expect(setAppLock).toHaveBeenCalledWith(false);
  });

  it('never touches a box that is listed again, and only drops its mark', async () => {
    // Added again, or restored from a backup, since the removal that did not finish.
    const { controller, secureStore, purged, marks, lock, setAppLock, deps } =
      await leftBehind(['a'], 'a');
    await add(controller, 'a');
    const result = await resumeRemoval('a', deps);
    expect(result).toMatchObject({ kind: 'listed', failures: [] });
    expect(boxIds(result.remaining)).toEqual(['a']);
    expect(await secureStore.readPassword('a')).toEqual({ status: 'found', value: 'pw' });
    expect(purged).toEqual([]);
    expect(await marks.list()).toEqual([]);
    expect(lock.armed).toBe(true);
    expect(setAppLock).not.toHaveBeenCalled();
  });

  it('stops as soon as the box is listed again partway through', async () => {
    // A restore brings the box back while its old archive is still being cleared.
    const { controller, secureStore, purged, marks, deps } = await leftBehind(['b'], 'a');
    const result = await resumeRemoval('a', {
      ...deps,
      purges: [
        {
          step: 'archive',
          run: async id => {
            purged.push(`archive:${id}`);
            await add(controller, id);
          },
        },
        ...deps.purges.filter(p => p.step !== 'archive'),
      ],
    });
    expect(result.kind).toBe('listed');
    expect(purged).toEqual(['archive:a']);
    expect(await secureStore.readPassword('a')).toEqual({ status: 'found', value: 'pw' });
    expect(await marks.list()).toEqual([]);
  });

  it('keeps the mark, and touches nothing, while the store cannot be read', async () => {
    const { controller, purged, marks, deps } = await leftBehind(['b'], 'a');
    const result = await resumeRemoval('a', {
      ...deps,
      accounts: {
        removeRow: id => controller.removeRow(id),
        forgetSecrets: id => controller.forgetSecrets(id),
        listAccounts: async () => {
          throw new Error('db gone');
        },
      },
    });
    expect(result).toEqual({
      kind: 'failed',
      rowGone: false,
      remaining: null,
      failures: [{ step: 'list', error: new Error('db gone') }],
    });
    expect(purged).toEqual([]);
    expect(await marks.list()).toEqual(['a']);
  });

  it('never deletes a row, even one listed by the time it runs', async () => {
    const { controller, deps } = await leftBehind(['b'], 'a');
    // A box listed again is a new row - somebody's re-added or restored box, not the removed one.
    const removeRow = jest.fn((id: string) => controller.removeRow(id));
    await resumeRemoval('a', {
      ...deps,
      accounts: {
        removeRow,
        forgetSecrets: id => controller.forgetSecrets(id),
        listAccounts: () => controller.listAccounts(),
      },
    });
    expect(removeRow).not.toHaveBeenCalled();
  });
});

describe('what the screen shows after a removal', () => {
  const box = (boxId: string) => ({ boxId }) as DataBoxAccount;

  it('moves off the active box once it is gone', () => {
    expect(
      settleRemoval({ kind: 'removed', remaining: [box('b')], failures: [] }, 'a', 'a', [
        box('a'),
        box('b'),
      ]),
    ).toEqual({
      accounts: [box('b')],
      gone: true,
      active: 'b',
      toWelcome: false,
      notice: null,
    });
  });

  it('stays on the box the user is on when another one goes', () => {
    const settled = settleRemoval(
      { kind: 'removed', remaining: [box('b')], failures: [] },
      'a',
      'b',
      [box('a'), box('b')],
    );
    expect(settled.active).toBeUndefined();
    expect(settled.notice).toBeNull();
  });

  it('goes back to Welcome when no box is left', () => {
    expect(
      settleRemoval({ kind: 'removed', remaining: [], failures: [] }, 'a', 'a', [box('a')]),
    ).toMatchObject({
      active: null,
      toWelcome: true,
      notice: null,
    });
  });

  it('says the box is still here when its row would not delete, and changes nothing else', () => {
    const settled = settleRemoval(
      {
        kind: 'failed',
        rowGone: false,
        remaining: [box('a'), box('b')],
        failures: [{ step: 'row', error: new Error('db locked') }],
      },
      'a',
      'a',
      [box('a'), box('b')],
    );
    expect(settled).toEqual({
      accounts: [box('a'), box('b')],
      gone: false,
      active: undefined,
      toWelcome: false,
      notice: 'kept',
    });
  });

  it('shows the box as gone when a later step failed, and says the removal did not finish', () => {
    const settled = settleRemoval(
      {
        kind: 'failed',
        rowGone: true,
        remaining: [box('b')],
        failures: [{ step: 'archive', error: new Error('archive busy') }],
      },
      'a',
      'a',
      [box('a'), box('b')],
    );
    expect(settled).toEqual({
      accounts: [box('b')],
      gone: true,
      active: 'b',
      toWelcome: false,
      notice: 'incomplete',
    });
  });

  it('still reaches Welcome when the last row went and a later step failed', () => {
    expect(
      settleRemoval(
        {
          kind: 'failed',
          rowGone: true,
          remaining: [],
          failures: [{ step: 'secrets', error: new Error('keychain down') }],
        },
        'a',
        'a',
        [box('a')],
      ),
    ).toMatchObject({ toWelcome: true, active: null, notice: 'incomplete' });
  });

  it('takes a box whose row is gone off the screen even when the store cannot be listed afterwards', () => {
    // It kept the whole old list, so the removed box stayed on screen - and active - until a refresh.
    expect(
      settleRemoval(
        {
          kind: 'failed',
          rowGone: true,
          remaining: null,
          failures: [{ step: 'list', error: new Error('db gone') }],
        },
        'a',
        'a',
        [box('a'), box('b')],
      ),
    ).toEqual({
      accounts: [box('b')],
      gone: true,
      active: 'b',
      toWelcome: false,
      notice: 'incomplete',
    });
  });

  it('reaches Welcome that way when it was the last box on screen', () => {
    expect(
      settleRemoval(
        {
          kind: 'failed',
          rowGone: true,
          remaining: null,
          failures: [{ step: 'list', error: new Error('db gone') }],
        },
        'a',
        'a',
        [box('a')],
      ),
    ).toMatchObject({ accounts: [], gone: true, active: null, toWelcome: true });
  });

  it('keeps everything on screen as it was when the store cannot be read and the row may still be there', () => {
    expect(
      settleRemoval(
        {
          kind: 'failed',
          rowGone: false,
          remaining: null,
          failures: [{ step: 'row', error: new Error('db gone') }],
        },
        'a',
        'a',
        [box('a'), box('b')],
      ),
    ).toEqual({
      accounts: null,
      gone: false,
      active: undefined,
      toWelcome: false,
      notice: 'unknown',
    });
  });

  it('says nothing, and moves nobody, for a box that is listed again', () => {
    expect(
      settleRemoval({ kind: 'listed', remaining: [box('a')], failures: [] }, 'a', 'a', [box('a')]),
    ).toEqual({
      accounts: [box('a')],
      gone: false,
      active: undefined,
      toWelcome: false,
      notice: null,
    });
  });
});

describe('reporting a step that failed', () => {
  it('names the Keychain as the Keychain, and every other step as what it wrote', () => {
    // Every failure went out as a database write, the Keychain's included.
    expect(removalFailureReport('secrets')).toEqual({ op: 'keychain.write', stage: 'native' });
    expect(removalFailureReport('row')).toEqual({ op: 'db.write', stage: 'persist' });
    expect(removalFailureReport('archive')).toEqual({ op: 'db.write', stage: 'persist' });
    expect(removalFailureReport('reminders')).toEqual({ op: 'db.write', stage: 'persist' });
    expect(removalFailureReport('scanDismissals')).toEqual({ op: 'settings.write', stage: 'persist' });
    expect(removalFailureReport('marker')).toEqual({ op: 'settings.write', stage: 'persist' });
    expect(removalFailureReport('list')).toEqual({ op: 'db.read', stage: 'persist' });
    expect(removalFailureReport('lock')).toEqual({ op: 'appLock.arm', stage: 'native' });
  });
});
