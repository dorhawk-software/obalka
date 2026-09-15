import {
  classifyFailure,
  needsSignIn,
} from '../../src/features/messages/state/messagesController';
import type { AuthMethod, DataBoxAccount } from '../../src/services/isds/types';

const account = (authMethod: AuthMethod): DataBoxAccount => ({
  id: 'a',
  boxId: 'box1',
  loginName: 'u',
  label: 'ACME',
  dbType: null,
  alias: null,
  authMethod,
  host: 'czebox',
  secretRef: 'box1',
  sessionValidUntil: null,
  passwordExpiresAt: null,
  lastSyncedAt: null,
  messageCount: null,
  unreadCount: null,
  pdzCreditCzk: null,
  syncError: null,
  createdAt: 1,
  updatedAt: 1,
});

describe('classifyFailure', () => {
  it('a clean 401 (reauth outcome) is always reauth, regardless of method', () => {
    expect(classifyFailure(account('password'), { kind: 'reauth' })).toBe('reauth');
    expect(classifyFailure(account('otp_totp'), { kind: 'reauth' })).toBe('reauth');
  });

  it('OTP box: a server error (expired session) becomes reauth', () => {
    expect(
      classifyFailure(account('otp_totp'), { kind: 'error', messageKey: 'messages.error.load' }),
    ).toBe('reauth');
  });

  it('OTP box: a transient network/timeout error stays a retryable error', () => {
    expect(
      classifyFailure(account('otp_totp'), { kind: 'error', messageKey: 'messages.error.network' }),
    ).toBe('error');
    expect(
      classifyFailure(account('otp_totp'), { kind: 'error', messageKey: 'messages.error.timeout' }),
    ).toBe('error');
  });

  it('password box: any non-401 error is a retryable error (no session to renew)', () => {
    expect(
      classifyFailure(account('password'), { kind: 'error', messageKey: 'messages.error.load' }),
    ).toBe('error');
    expect(
      classifyFailure(account('password'), { kind: 'error', messageKey: 'messages.error.network' }),
    ).toBe('error');
  });
});

// 001 FR-009. The refresh that finds a password box refused after its stored expiry date is the one
// that decides what the box row says and whether refresh-all keeps trying - so it has to tell an
// expired password from a wrong one, with the only evidence the app has: the date.
describe('classifyFailure: a password box refused after its password expired', () => {
  const NOW = new Date(2026, 8, 14, 9, 0).getTime();
  const DAY = 86_400_000;
  const withExpiry = (
    authMethod: AuthMethod,
    passwordExpiresAt: number | null,
  ): DataBoxAccount => ({ ...account(authMethod), passwordExpiresAt });

  it('is passwordExpired, not reauth, once the stored date has passed', () => {
    expect(classifyFailure(withExpiry('password', NOW - DAY), { kind: 'reauth' }, NOW)).toBe(
      'passwordExpired',
    );
    // The moment it ran out already counts.
    expect(classifyFailure(withExpiry('password', NOW), { kind: 'reauth' }, NOW)).toBe(
      'passwordExpired',
    );
  });

  it('stays reauth while the date is ahead, or when ISDS never gave one', () => {
    expect(classifyFailure(withExpiry('password', NOW + DAY), { kind: 'reauth' }, NOW)).toBe(
      'reauth',
    );
    expect(classifyFailure(withExpiry('password', null), { kind: 'reauth' }, NOW)).toBe('reauth');
  });

  it.each(['otp_totp', 'mobile_key'] as const)(
    'leaves a %s box on reauth, whatever date its row carries',
    method => {
      expect(classifyFailure(withExpiry(method, NOW - DAY), { kind: 'reauth' }, NOW)).toBe(
        'reauth',
      );
    },
  );

  it('does not call a server error an expired password - nothing was refused', () => {
    expect(
      classifyFailure(
        withExpiry('password', NOW - DAY),
        { kind: 'error', messageKey: 'messages.error.load' },
        NOW,
      ),
    ).toBe('error');
  });
});

describe('needsSignIn', () => {
  it('holds back exactly the failures only the user can clear', () => {
    // Refresh-all skips these rather than send ISDS a sign-in it has already refused.
    expect(needsSignIn('reauth')).toBe(true);
    expect(needsSignIn('passwordExpired')).toBe(true);
    expect(needsSignIn('error')).toBe(false);
    expect(needsSignIn(null)).toBe(false);
    expect(needsSignIn(undefined)).toBe(false);
  });
});
