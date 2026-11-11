// ISDS's rules for a new password (030 FR-003), as the Data Boxes help states them.

import {
  isAcceptablePassword,
  passwordRules,
} from '../../src/features/accounts/state/passwordRules';

const LOGIN = 'abc123';

describe('passwordRules', () => {
  it('accepts a password that meets every rule', () => {
    expect(isAcceptablePassword('Kocka-Leze 7 Dirou', LOGIN)).toBe(true);
    expect(Object.values(passwordRules('Kocka-Leze 7 Dirou', LOGIN)).every(Boolean)).toBe(true);
  });

  it.each([
    ['Ab1defg', 'length'],
    [`Ab1${'x'.repeat(62)}`, 'length'],
    ['ab1defgh', 'upper'],
    ['AB1DEFGH', 'lower'],
    ['Abcdefgh', 'digit'],
    ['Abcdefg1č', 'allowed'],
    ['Abcdefg1^', 'allowed'],
    ['Abc123defG', 'noLogin'],
    ['ABC123defg', 'noLogin'],
    ['Abcdefg111', 'noTriple'],
    ['Abcdeeefg1', 'noTriple'],
    ['12345Abcdef', 'noWeakStart'],
    ['QwertY12xy', 'noWeakStart'],
    ['asdfgH12xy', 'noWeakStart'],
  ])('refuses %j for %s', (password, rule) => {
    const verdicts = passwordRules(password, LOGIN);
    expect(verdicts[rule as keyof typeof verdicts]).toBe(false);
    expect(isAcceptablePassword(password, LOGIN)).toBe(false);
  });

  it('allows every special character ISDS lists, space included', () => {
    expect(passwordRules('Aa1 !#$%&()*+,-.:=?@[]_{|}~', LOGIN).allowed).toBe(true);
  });

  it('lets 8 and 64 characters through', () => {
    expect(passwordRules('Abcdef12', LOGIN).length).toBe(true);
    expect(passwordRules(`Ab1${'xy'.repeat(30)}z`, LOGIN).length).toBe(true);
  });

  it('accepts the shape of the password set on the test box on 2026-11-11', () => {
    // Not that password - one of the same make: mixed case, digits, ! and @.
    expect(isAcceptablePassword('k8Tq!mWzR2@bn5Xp', '7bi62r')).toBe(true);
  });
});
