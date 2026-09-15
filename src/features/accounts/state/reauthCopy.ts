// Which "sign in again" sentence a box gets (audit, 2026-09-09).
//
// The app had one: "Platnost přihlášení vypršela" - your SESSION expired. For a password box there is
// no session to expire: `httpClient` sends HTTP Basic on every single call, and the messages
// controller says so in its own comments. What actually happened is that the credentials stopped
// working - most often because ISDS forces a password change every 90 days, which this app nags the
// user about on the very same screen.
//
// The right string already existed (`box.reauth.credentials`) and was rendered nowhere: someone knew
// the difference and never wired it through. This is that wire.
//
// A third sentence since 2026-09-14 (001 FR-009): the password has EXPIRED and must be changed on the
// portal first. How the app can tell, and why it is only an inference, is `mustChangePassword` in
// `passwordExpiry.ts`.

import type { DataBoxAccount } from '../../../services/isds/types';
import {
  mustChangePassword,
  refusedForExpiredPassword,
} from './passwordExpiry';

/**
 * True when the box authenticates by sending credentials on every request, so a 401 means the
 * credentials are wrong - not that a session ended.
 */
export function hasNoSession(account: Pick<DataBoxAccount, 'authMethod'>): boolean {
  return account.authMethod === 'password';
}

/**
 * The expired-password sentence for each place that shows a credentials one.
 *
 * A table rather than a suffix appended to the key, for the reason `reauthKey` spells out below: a
 * computed key that does not exist renders as the raw key on screen. Every key here is written out,
 * so grep and `__tests__/accounts/reauthCopy.test.ts` can check it.
 */
const PASSWORD_EXPIRED_KEY: Readonly<Record<string, string>> = {
  'box.reauth.credentials': 'box.reauth.passwordExpired',
  'messages.reauth.credentials': 'messages.reauth.passwordExpired',
  'send.reauth.credentials': 'send.reauth.passwordExpired',
  'reauth.intro.credentials': 'reauth.intro.passwordExpired',
};

/**
 * Pick between the wordings.
 *
 * Both keys are written out at the call site rather than derived by concatenation. That is
 * deliberate: a computed key that does not exist renders as the raw key on screen - the app has
 * shipped a button reading "COMMON.CANCEL" exactly that way - and the static-key guard cannot see a
 * template literal. Spelled out, both keys are checkable by grep and by
 * `__tests__/i18n/keysExist.test.ts`.
 *
 * Takes the whole account rather than a boolean so a call site cannot pass the wrong flag: the
 * question is always "which kind of box is this?" - and, since FR-009, "has its password run out?".
 * Every call site renders this only after an auth fault, which is what makes the date meaningful.
 * `now` defaults to the clock for the screens that have no minute tick of their own.
 */
export function reauthKey(
  account: Pick<DataBoxAccount, 'authMethod' | 'passwordExpiresAt'>,
  whenSession: string,
  whenCredentials: string,
  now: number = Date.now(),
): string {
  return pick(account, mustChangePassword(account, now), whenSession, whenCredentials);
}

/**
 * `reauthKey` for the inbox strip and the re-auth screen: the verdict stored with the refusal - the one
 * the switcher row shows - wins, and `now` decides only for a box with nothing stored. Both pass the
 * moment of the refusal there when they know it, so they cannot disagree. See
 * `refusedForExpiredPassword`.
 */
export function storedReauthKey(
  account: Pick<DataBoxAccount, 'authMethod' | 'passwordExpiresAt' | 'syncError'>,
  whenSession: string,
  whenCredentials: string,
  now: number,
): string {
  return pick(
    account,
    refusedForExpiredPassword(account, now),
    whenSession,
    whenCredentials,
  );
}

function pick(
  account: Pick<DataBoxAccount, 'authMethod'>,
  passwordExpired: boolean,
  whenSession: string,
  whenCredentials: string,
): string {
  if (!hasNoSession(account)) {
    return whenSession;
  }
  if (passwordExpired) {
    return PASSWORD_EXPIRED_KEY[whenCredentials] ?? whenCredentials;
  }
  return whenCredentials;
}
