// "Platnost přihlášení vypršela" - for a box that has no session (audit, 2026-09-09).
//
// Password boxes send HTTP Basic on every call; there is nothing to expire. A 401 there means the
// credentials stopped working, which most often happens because ISDS forces a password change every
// 90 days - the very thing this app nags about on the same screen. Telling that user their "session
// expired" points them at the wrong explanation for a problem they must fix in the ISDS portal.
//
// The correct string already existed and was rendered nowhere, which is its own kind of evidence.

import {
  hasNoSession,
  reauthKey,
  storedReauthKey,
} from '../../src/features/accounts/state/reauthCopy';
import { STRINGS_FOR_TEST, t } from '../../src/i18n/strings';
import type { DataBoxAccount } from '../../src/services/isds/types';

const box = (
  authMethod: DataBoxAccount['authMethod'],
  passwordExpiresAt: number | null = null,
) => ({ authMethod, passwordExpiresAt });

describe('which sign-in-again wording a box gets', () => {
  it('says the CREDENTIALS are invalid for password boxes', () => {
    expect(hasNoSession(box('password'))).toBe(true);
    expect(
      reauthKey(box('password'), 'messages.reauth', 'messages.reauth.credentials'),
    ).toBe('messages.reauth.credentials');
  });

  it.each(['otp_totp', 'mobile_key'] as const)(
    'keeps the session wording for %s, which really does have one',
    method => {
      expect(hasNoSession(box(method))).toBe(false);
      expect(
        reauthKey(box(method), 'messages.reauth', 'messages.reauth.credentials'),
      ).toBe('messages.reauth');
    },
  );

  /** Every place that shows one of these, and the pair it shows. */
  const PAIRS: [string, string][] = [
    ['box.reauth.session', 'box.reauth.credentials'],
    ['messages.reauth', 'messages.reauth.credentials'],
    ['send.reauth', 'send.reauth.credentials'],
    ['reauth.intro', 'reauth.intro.credentials'],
  ];

  it('has both wordings, in both languages, for every place that shows one', () => {
    // A key that does not exist renders as the key. This app has shipped a button reading
    // "COMMON.CANCEL" for exactly that reason, and a key picked at runtime is invisible to the
    // static guard - so the pairs are checked here by name.
    for (const keys of PAIRS) {
      for (const key of keys) {
        for (const locale of ['cs', 'en'] as const) {
          expect({ locale, key, text: STRINGS_FOR_TEST[locale][key] }).toEqual({
            locale,
            key,
            text: expect.any(String),
          });
        }
      }
    }
  });

  it('does not say "session" or "expired" in the credential wording', () => {
    // The whole point: a different fact, in different words. If these ever converge, the branch is
    // pointless and someone should notice.
    for (const [session, credentials] of PAIRS) {
      expect(t(credentials)).not.toMatch(/vypršel|expired/i);
      expect(t(credentials)).not.toBe(t(session));
    }
  });
});

// 001 FR-009. A password box refused AFTER the expiry date ISDS gave at its last sign-in has not got
// a wrong password but an expired one, and "the credentials are no longer valid" sends the user to
// retype something that cannot work until it is changed on the portal.
describe('a password box refused after its stored expiry date', () => {
  const NOW = new Date(2026, 8, 14, 9, 0).getTime();
  const DAY = 86_400_000;
  /** Every place that shows a credentials sentence, and the expired sentence it becomes. */
  const EXPIRED: [string, string, string][] = [
    ['box.reauth.session', 'box.reauth.credentials', 'box.reauth.passwordExpired'],
    ['messages.reauth', 'messages.reauth.credentials', 'messages.reauth.passwordExpired'],
    ['send.reauth', 'send.reauth.credentials', 'send.reauth.passwordExpired'],
    ['reauth.intro', 'reauth.intro.credentials', 'reauth.intro.passwordExpired'],
  ];

  it.each(EXPIRED)(
    '%s: says the password expired once the date has passed',
    (session, credentials, expired) => {
      expect(reauthKey(box('password', NOW - DAY), session, credentials, NOW)).toBe(expired);
    },
  );

  it('keeps the credentials wording while the date is ahead, or was never given', () => {
    for (const [session, credentials] of EXPIRED) {
      expect(reauthKey(box('password', NOW + DAY), session, credentials, NOW)).toBe(
        credentials,
      );
      expect(reauthKey(box('password', null), session, credentials, NOW)).toBe(credentials);
    }
  });

  it.each(['otp_totp', 'mobile_key'] as const)(
    'keeps the session wording for %s, whatever date its row carries',
    method => {
      for (const [session, credentials] of EXPIRED) {
        expect(reauthKey(box(method, NOW - DAY), session, credentials, NOW)).toBe(session);
      }
    },
  );

  it('has the expired wording in both languages, and it names the portal', () => {
    for (const [, , expired] of EXPIRED) {
      expect(STRINGS_FOR_TEST.cs[expired]).toMatch(/portálu ISDS/);
      expect(STRINGS_FOR_TEST.en[expired]).toMatch(/ISDS portal/);
    }
  });
});

// The re-auth screen has no refusal moment of its own, so it takes the verdict stored with the
// refusal - the one the switcher row shows - instead of the clock at the moment it renders.
describe('the re-auth screen’s wording', () => {
  const NOW = new Date(2026, 8, 15, 9, 0).getTime();
  const DAY = 86_400_000;
  const stored = (
    authMethod: DataBoxAccount['authMethod'],
    syncError: DataBoxAccount['syncError'],
  ) => ({ ...box(authMethod, NOW - DAY), syncError });

  it('follows the stored refusal rather than the date that has passed since', () => {
    expect(
      storedReauthKey(stored('password', 'reauth'), 'reauth.intro', 'reauth.intro.credentials', NOW),
    ).toBe('reauth.intro.credentials');
    expect(
      storedReauthKey(
        stored('password', 'passwordExpired'),
        'reauth.intro',
        'reauth.intro.credentials',
        NOW,
      ),
    ).toBe('reauth.intro.passwordExpired');
  });

  it('falls back to the date only when no refusal was stored', () => {
    expect(
      storedReauthKey(stored('password', null), 'reauth.intro', 'reauth.intro.credentials', NOW),
    ).toBe('reauth.intro.passwordExpired');
  });

  it('keeps the session wording for a box that has a session', () => {
    expect(
      storedReauthKey(stored('otp_totp', 'reauth'), 'reauth.intro', 'reauth.intro.credentials', NOW),
    ).toBe('reauth.intro');
  });
});
