// Removing a box, end to end (001 T037, 018 T010).
//
// It lived inline in `AppShell.handleRemove`, which is not mountable in a test, so the one rule that
// is about the app rather than the box - what happens when the LAST box goes - had nowhere to be
// checked and was never built. Here it is plain orchestration over injected pieces, like the
// controllers it calls.

import type { AppLock } from '../../../services/appLock/appLock';
import type { DataBoxAccount } from '../../../services/isds/types';
import type { FailureContext, Op } from '../../../services/telemetry/telemetry';
import type { BoxWork } from '../../messages/state/boxWork';
import type { AccountsController } from './accountsController';
import type { UnfinishedRemovals } from './unfinishedRemovals';

/** The steps of a removal - what a failure is reported as (`removalFailureReport`). */
export type RemovalStep =
  | 'row'
  | 'secrets'
  | 'archive'
  | 'reminders'
  | 'scanDismissals'
  | 'list'
  | 'lock'
  | 'marker';

/** One thing held for a box outside its row and its secrets, cleared after them. */
export interface RemovalPurge {
  readonly step: 'archive' | 'reminders' | 'scanDismissals';
  readonly run: (boxId: string) => Promise<void>;
}

export interface RemovalFailure {
  readonly step: RemovalStep;
  readonly error: unknown;
}

export interface RemoveBoxDeps {
  /** The row (`removeRow`), then both Keychain items (`forgetSecrets`). */
  accounts: Pick<AccountsController, 'removeRow' | 'forgetSecrets' | 'listAccounts'>;
  /** Everything else kept per box - archive and its files, reminders, scan dismissals - in this order. */
  purges: readonly RemovalPurge[];
  appLock: Pick<AppLock, 'forget'>;
  /** Persists the app-lock toggle (`SettingsProvider.setAppLock`). */
  setAppLock: (enabled: boolean) => void;
  /**
   * The mark a later launch finishes an unfinished removal from (`unfinishedRemovals.ts`). The shell
   * always passes it, and its tests check that it does; a test about the other steps may leave it out.
   */
  unfinished?: Pick<UnfinishedRemovals, 'add' | 'remove'>;
  /**
   * Told as soon as the box's row is known to be gone, before anything else of it is cleared. The
   * screen can let go of the box then: nothing in the app can reach it any more, and with the LAST
   * box the screen used to stay empty for as long as the archive and its files took to delete.
   */
  onRowGone?: (boxId: string) => void;
  /**
   * The box's work under way (`BoxWork`): stopped when the removal starts - its calls aborted and its
   * writes refused - and let go when the removal ends. A sync already out for the box wrote what ISDS
   * returned back into the archive after it was cleared. The shell always passes it, and its tests
   * check that it does.
   */
  work?: Pick<BoxWork, 'stop' | 'resume'>;
}

/** What a removal actually did - never a rejection, because the caller has to show it. */
export type RemoveBoxResult =
  | {
      readonly kind: 'removed';
      readonly remaining: DataBoxAccount[];
      /** Only ever the mark's own failures, which leave nothing of the box behind but are reported. */
      readonly failures: readonly RemovalFailure[];
    }
  | {
      readonly kind: 'failed';
      /** Whether the row is known to be gone - also when the store could not be listed afterwards. */
      readonly rowGone: boolean;
      /** What the store holds afterwards, or null when it could not even be listed. */
      readonly remaining: DataBoxAccount[] | null;
      /** Every step that failed, in the order they ran; later steps still ran where it was safe. */
      readonly failures: readonly RemovalFailure[];
    }
  | {
      /** The box is listed again - added again, or restored - so nothing more of it was touched. */
      readonly kind: 'listed';
      readonly remaining: DataBoxAccount[];
      readonly failures: readonly RemovalFailure[];
    };

/**
 * Remove one box and everything held for it; resolves with what is left, and never rejects.
 *
 * It used to reject, and the shell started it without waiting: a failure became an unhandled
 * rejection, nobody was told, and the switcher kept listing a box whose row was already gone until
 * the next refresh. Resolving with the outcome makes the caller deal with it.
 *
 * When none remain, the app lock is reset too - the vault key deleted in the Keychain AND the lock
 * switched off in settings (001 T037, T028). The lock gates box content, and with no box left there
 * is nothing behind it: removing every box is how an app gets handed to someone else, and it must not
 * keep the previous owner's biometric gate in front of the Welcome screen. The key goes rather than
 * moving back to the ungated item because every secret it sealed went with its box; the next box
 * starts a fresh one. Asked of the store AFTER the removal rather than counted beforehand, so the
 * decision is made on what is actually left.
 *
 * Once the row is gone, every later step runs even when one before it FAILS. Nothing in the app can
 * reach the box any more, so a Keychain that will not delete the secret must not also leave the
 * archive, its downloaded files, the reminders and their notifications behind - and on the next launch
 * the Welcome screen must not sit behind the old biometric gate. While the row is still listed nothing
 * else is touched: deleting the archive of a box the app still shows would lose it silently
 * (constitution IV). When the store cannot even be listed after a failed row delete, that is unknown,
 * and unknown is treated as still listed.
 *
 * The box is marked before its row goes (`unfinished`) and the mark is cleared only once every step
 * went, or once the box turns out to be listed after all. What a failure, a closed dialog or a killed
 * process leaves behind is finished from that mark by `resumeRemoval`.
 */
export async function removeBox(
  boxId: string,
  deps: RemoveBoxDeps,
): Promise<RemoveBoxResult> {
  // First of all, before the mark and the row: a sync of the box that answers while the removal runs
  // must write nothing, and one writing already is waited for before the archive is cleared.
  deps.work?.stop(boxId);
  try {
    return await removeListedBox(boxId, deps);
  } finally {
    deps.work?.resume(boxId);
  }
}

async function removeListedBox(
  boxId: string,
  deps: RemoveBoxDeps,
): Promise<RemoveBoxResult> {
  const failures: RemovalFailure[] = [];
  // Before the row, not after a step fails: a removal the OS kills halfway through leaves nothing
  // else to find it by. A box that is still listed at the next launch only loses its mark.
  await mark(deps, 'add', boxId, failures);
  let rowGone = false;
  let listedAfterRow: DataBoxAccount[] | null = null;
  try {
    await deps.accounts.removeRow(boxId);
    rowGone = true;
  } catch (e) {
    record(failures, 'row', e);
    // The row delete can throw with the row already gone (the store's active-box bookkeeping runs
    // after it). Only the store can say which; a store that cannot say counts as still listed.
    listedAfterRow = await listOrNull(deps, failures);
    rowGone = listedAfterRow !== null && !isListed(listedAfterRow, boxId);
  }
  if (rowGone) {
    return finishRemoval(boxId, deps, failures);
  }
  const remaining = listedAfterRow ?? (await listOrNull(deps, failures));
  if (remaining !== null && isListed(remaining, boxId)) {
    // The box is still here, and Odebrat with it: there is nothing to finish later.
    await mark(deps, 'remove', boxId, failures);
  }
  return { kind: 'failed', rowGone: false, remaining, failures };
}

/**
 * Finish a removal that did not finish, from its mark (`unfinishedRemovals.ts`): at the next launch,
 * and when the dialog saying it did not finish is closed. Never rejects.
 *
 * NEVER touches a box that is listed: one added again or restored since keeps everything it has, and
 * only its mark goes. The row delete is not repeated for the same reason - a box that is listed again
 * is a new row, not the one the user removed. Unlisted, the rest runs exactly as in `removeBox`.
 */
export async function resumeRemoval(
  boxId: string,
  deps: RemoveBoxDeps,
): Promise<RemoveBoxResult> {
  const failures: RemovalFailure[] = [];
  const listed = await listOrNull(deps, failures);
  if (listed === null) {
    return { kind: 'failed', rowGone: false, remaining: null, failures };
  }
  if (isListed(listed, boxId)) {
    await mark(deps, 'remove', boxId, failures);
    return { kind: 'listed', remaining: listed, failures };
  }
  // Stopped only once the box is known not to be listed: a box listed again syncs like any other, and
  // nothing lists it again meanwhile - adding a box and a restore both wait for this to end.
  deps.work?.stop(boxId);
  try {
    return await finishRemoval(boxId, deps, failures);
  } finally {
    deps.work?.resume(boxId);
  }
}

/** Everything after the row, for a box whose row is known to be gone. */
async function finishRemoval(
  boxId: string,
  deps: RemoveBoxDeps,
  failures: RemovalFailure[],
): Promise<RemoveBoxResult> {
  deps.onRowGone?.(boxId);
  // Straight after the row: its absence was just established, and a sealed password must not outlive
  // its box a moment longer than it has to.
  try {
    await deps.accounts.forgetSecrets(boxId);
  } catch (e) {
    record(failures, 'secrets', e);
  }
  for (const purge of deps.purges) {
    // Asked before every purge rather than once: they take a while - a box's downloaded files go with
    // its archive - and a restore can bring the box back meanwhile. From then on it is that restore's
    // box, and clearing its archive would lose what the restore just wrote (constitution IV). A store
    // that cannot say stops here too; the mark stays, and the rest is finished later.
    const listed = await listOrNull(deps, failures);
    if (listed === null) {
      return { kind: 'failed', rowGone: true, remaining: null, failures };
    }
    if (isListed(listed, boxId)) {
      await mark(deps, 'remove', boxId, failures);
      return { kind: 'listed', remaining: listed, failures };
    }
    try {
      await purge.run(boxId);
    } catch (e) {
      record(failures, purge.step, e);
    }
  }
  // What is left is read AFTER the purges. A list read before them was handed to the screen, and
  // decided the lock, after something else had changed the store: another box removed meanwhile came
  // back on screen, and the last box going was missed.
  const remaining = await listOrNull(deps, failures);
  if (remaining === null) {
    return { kind: 'failed', rowGone: true, remaining: null, failures };
  }
  if (isListed(remaining, boxId)) {
    await mark(deps, 'remove', boxId, failures);
    return { kind: 'listed', remaining, failures };
  }
  if (remaining.length === 0) {
    try {
      await deps.appLock.forget();
      deps.setAppLock(false);
    } catch (e) {
      record(failures, 'lock', e);
    }
  }
  if (failures.some(f => f.step !== 'marker')) {
    return { kind: 'failed', rowGone: true, remaining, failures };
  }
  await mark(deps, 'remove', boxId, failures);
  return { kind: 'removed', remaining, failures };
}

function isListed(accounts: readonly DataBoxAccount[], boxId: string): boolean {
  return accounts.some(a => a.boxId === boxId);
}

/** The store's list, or null when it will not read - recorded once however often it is asked. */
async function listOrNull(
  deps: RemoveBoxDeps,
  failures: RemovalFailure[],
): Promise<DataBoxAccount[] | null> {
  try {
    return await deps.accounts.listAccounts();
  } catch (e) {
    record(failures, 'list', e);
    return null;
  }
}

async function mark(
  deps: RemoveBoxDeps,
  op: 'add' | 'remove',
  boxId: string,
  failures: RemovalFailure[],
): Promise<void> {
  if (!deps.unfinished) {
    return;
  }
  try {
    await deps.unfinished[op](boxId);
  } catch (e) {
    record(failures, 'marker', e);
  }
}

/** The first failure of each step: a store that will not read, asked three times, is one fault. */
function record(failures: RemovalFailure[], step: RemovalStep, error: unknown): void {
  if (!failures.some(f => f.step === step)) {
    failures.push({ step, error });
  }
}

/**
 * How a failed step is reported.
 *
 * Every failure used to go out as a database write, the Keychain's included, so a report could not say
 * whether a row had stayed or a secret had - and only the second is a sealed password left on a phone
 * with no box to own it.
 */
export function removalFailureReport(step: RemovalStep): {
  readonly op: Op;
  readonly stage: NonNullable<FailureContext['stage']>;
} {
  switch (step) {
    case 'secrets':
      return { op: 'keychain.write', stage: 'native' };
    case 'list':
      return { op: 'db.read', stage: 'persist' };
    case 'scanDismissals':
    case 'marker':
      return { op: 'settings.write', stage: 'persist' };
    case 'lock':
      return { op: 'appLock.arm', stage: 'native' };
    case 'row':
    case 'archive':
    case 'reminders':
      return { op: 'db.write', stage: 'persist' };
  }
}

/**
 * What to tell the user about a removal that did not finish.
 *
 * `kept`: the row would not delete, so the box and everything held for it are still here.
 * `incomplete`: the box is gone from the app, but something held for it may still be on the device.
 * `unknown`: the store could not be read afterwards, so the app cannot say which of the two it was.
 */
export type RemovalNotice = 'kept' | 'incomplete' | 'unknown';

/** How the shell applies a removal's result. */
export interface RemovalSettlement {
  /** The boxes to show; null keeps the list on screen as it is, because the store could not be read. */
  readonly accounts: DataBoxAccount[] | null;
  /** The box is no longer listed, so its sync flag goes with it. */
  readonly gone: boolean;
  /** The box to make active: an id, null for none at all, undefined to stay where the user is. */
  readonly active: string | null | undefined;
  /** No box is left: back to the Welcome screen. */
  readonly toWelcome: boolean;
  /** What to tell the user, or null when everything went. */
  readonly notice: RemovalNotice | null;
}

/**
 * Turn a removal's result into what the screen shows - from what the store holds afterwards, never
 * from what was asked for. A failed removal that took the row still moves the user off that box, and
 * one that kept it leaves them where they are.
 *
 * `shown` is the list on screen. It stands in only when the store could not be listed afterwards but
 * the row is known to be gone: the box leaves the screen and every other one stays as it was. Keeping
 * the whole old list there left a removed box on screen, and active, until some later refresh.
 */
export function settleRemoval(
  result: RemoveBoxResult,
  boxId: string,
  activeBoxId: string | null,
  shown: readonly DataBoxAccount[],
): RemovalSettlement {
  if (result.kind === 'listed') {
    return {
      accounts: result.remaining,
      gone: false,
      active: undefined,
      toWelcome: false,
      notice: null,
    };
  }
  let remaining = result.remaining;
  if (remaining === null && result.kind === 'failed' && result.rowGone) {
    remaining = shown.filter(a => a.boxId !== boxId);
  }
  if (remaining === null) {
    return {
      accounts: null,
      gone: false,
      active: undefined,
      toWelcome: false,
      notice: 'unknown',
    };
  }
  const gone = !isListed(remaining, boxId);
  let active: string | null | undefined;
  if (remaining.length === 0) {
    active = null;
  } else if (gone && activeBoxId === boxId) {
    // The active box went: fall back to the first remaining one (and persist it as last-used).
    active = remaining[0].boxId;
  }
  let notice: RemovalNotice | null = null;
  if (result.kind === 'failed') {
    notice = gone ? 'incomplete' : 'kept';
  }
  return {
    accounts: remaining,
    gone,
    active,
    toWelcome: remaining.length === 0,
    notice,
  };
}
