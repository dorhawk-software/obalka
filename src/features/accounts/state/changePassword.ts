// Change a password box's password from the app (030 US2). Never throws.
//
// ISDS checks the current password - the one the person TYPED on the change screen, never the one the
// app has stored - and then the new one. Only when ISDS says it is changed does the app store the new
// password, together with the date ISDS now gives it, through the same `reauthAccount` a sign-in uses:
// the box is from then on signed in with the new password, and the expiry strip and the notifications
// read the new date.
//
// A timeout is the one outcome that cannot be told apart: the request may have reached ISDS and
// changed the password, and the answer was lost. Nothing is stored then, and the copy says what to do
// if the old password stops working.

import {
  TransportNetworkError,
  TransportTimeoutError,
  type PasswordChanger,
} from '../../../services/isds/transport';
import type { DataBoxAccount } from '../../../services/isds/types';
import type { AccountsController } from './accountsController';
import { reportFailure } from '../../../services/telemetry/telemetry';

export type ChangePasswordOutcome =
  | { kind: 'changed'; passwordExpiresAt: number | null }
  | { kind: 'wrongPassword' }
  | { kind: 'refused'; message: string | null }
  | { kind: 'network' }
  | { kind: 'timeout' }
  | { kind: 'serverFault' }
  /** ISDS changed it, and the app could not store it: the person must sign in with the new one. */
  | { kind: 'notSaved' };

export interface ChangePasswordDeps {
  changer: PasswordChanger;
  accounts: Pick<AccountsController, 'reauthAccount'>;
}

export async function changeBoxPassword(
  deps: ChangePasswordDeps,
  account: Pick<DataBoxAccount, 'boxId' | 'host' | 'loginName' | 'dbType'>,
  oldPassword: string,
  newPassword: string,
  signal: AbortSignal,
): Promise<ChangePasswordOutcome> {
  let result;
  try {
    result = await deps.changer.changePassword({
      host: account.host,
      loginName: account.loginName,
      oldPassword,
      newPassword,
      signal,
    });
  } catch (e) {
    if (e instanceof TransportTimeoutError) {
      return { kind: 'timeout' };
    }
    if (e instanceof TransportNetworkError) {
      return { kind: 'network' };
    }
    reportFailure('isds.passwordChange', e);
    return { kind: 'serverFault' };
  }
  switch (result.type) {
    case 'wrongPassword':
      return { kind: 'wrongPassword' };
    case 'refused':
      return { kind: 'refused', message: result.message };
    case 'serverFault':
      return { kind: 'serverFault' };
    case 'changed':
      break;
  }
  try {
    await deps.accounts.reauthAccount(
      account.boxId,
      newPassword,
      'password',
      account.dbType ?? null,
      null,
      result.passwordExpiresAt,
    );
  } catch (e) {
    // The password IS changed on ISDS; the app still holds the old one, which no longer works. The box
    // will ask to sign in again, and the person must use the NEW password there.
    reportFailure('isds.passwordChange', e, { stage: 'persist' });
    return { kind: 'notSaved' };
  }
  return { kind: 'changed', passwordExpiresAt: result.passwordExpiresAt };
}
