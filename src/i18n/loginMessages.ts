// Stable message keys for login errors + the Czech-first copy (feature 001, Principle V).
// Keys are stable identifiers used in `LoginOutcome.error.messageKey`; UI resolves them per locale.

import type { LoginErrorCode } from '../services/isds/types';

/** Maps a typed error code to its stable, locale-independent message key. */
export function messageKeyForError(code: LoginErrorCode): string {
  return `login.error.${code}`;
}

/** Czech (primary) copy for every login error key. Every LoginErrorCode MUST have an entry. */
export const cs: Record<string, string> = {
  // The refusal card's title and its way back to the fields (031 board R8).
  'login.refused.title': 'ISDS přihlášení odmítlo',
  'login.refused.edit': 'Upravit jméno nebo heslo',
  // 030 US1: ISDS refuses an expired password exactly like a wrong one (captured 2026-11-11), so a
  // refusal with no stored date to tell them apart names both.
  'login.error.invalidCredentials':
    'ISDS přihlášení odmítlo: jméno nebo heslo je špatně, nebo heslu vypršela platnost - pak ho změňte v portálu ISDS. Po opakovaných pokusech může ISDS přístup zablokovat.',
  'login.error.invalidOrExpiredOtp':
    'Neplatný nebo vypršelý jednorázový kód. Zkuste to znovu.',
  'login.error.smsNotDelivered':
    'SMS s kódem se nepodařilo odeslat. Vyžádejte si nový kód.',
  // Says WHERE, because the app cannot do it: an EXPIRED password cannot be changed through ISDS's
  // web services, only on the portal (001 FR-009, 030).
  // Reached when a password is refused after the expiry date stored at the last sign-in. That is an
  // inference, so the sentence also serves someone who has already changed it and mistyped the new one.
  'login.error.passwordChangeRequired':
    'Heslo bylo odmítnuto a jeho platnost už vypršela. Změňte ho v portálu ISDS a přihlaste se novým heslem. Pokud jste ho už změnili, zkontrolujte, že zadáváte to nové.',
  'login.error.duplicateBox': 'Tato datová schránka už je přidaná.',
  'login.error.network':
    'Nejste připojeni k internetu. Zkontrolujte připojení a zkuste to znovu.',
  'login.error.timeout': 'Spojení vypršelo. Zkuste to prosím znovu.',
  'login.error.serverFault':
    'Služba datových schránek je dočasně nedostupná. Zkuste to později.',
  'login.error.cancelled': 'Přihlášení bylo zrušeno.',
  'login.error.mobileKeyRejected':
    'Přihlášení bylo v aplikaci Mobilní klíč zamítnuto.',
  'login.error.mobileKeyTimeout':
    'Přihlášení nebylo potvrzeno včas. Zkuste to znovu.',
};

/** English fallback copy. */
export const en: Record<string, string> = {
  'login.refused.title': 'ISDS refused the sign-in',
  'login.refused.edit': 'Edit the name or password',
  'login.error.invalidCredentials':
    'ISDS refused the sign-in: the name or password is wrong, or the password has expired - then change it in the ISDS portal. Repeated attempts can get the access blocked.',
  'login.error.invalidOrExpiredOtp':
    'Invalid or expired one-time code. Please try again.',
  'login.error.smsNotDelivered':
    'The SMS code could not be sent. Request a new code.',
  'login.error.passwordChangeRequired':
    'The password was refused, and it has already expired. Change it in the ISDS portal and sign in with the new password. If you have already changed it, check that you are entering the new one.',
  'login.error.duplicateBox': 'This data box is already added.',
  'login.error.network':
    'You are offline. Check your connection and try again.',
  'login.error.timeout': 'The connection timed out. Please try again.',
  'login.error.serverFault':
    'The data-box service is temporarily unavailable. Try again later.',
  'login.error.cancelled': 'Sign-in was cancelled.',
  'login.error.mobileKeyRejected': 'Sign-in was declined in the Mobile Key app.',
  'login.error.mobileKeyTimeout':
    'Sign-in wasn’t confirmed in time. Please try again.',
};
