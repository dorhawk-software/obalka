// What ISDS accepts as a new password (030 FR-003). Pure.
//
// From the Data Boxes help (datovka.gov.cz, "První seznámení a přihlášení", 1.1), which cites decree
// 194/2009 Sb.: 8 to 64 characters, at least one capital letter, one small letter and one digit, only
// letters a-z/A-Z, digits and a fixed set of special characters, not containing the login name, no
// character three or more times in a row, not starting with 12345, qwert or asdfg. One more rule - a
// password used before is refused - only ISDS can check; its own message says so when it does.
//
// The app checks these so the person learns before sending, not after. ISDS has the final word: a rule
// it adds later reaches the person as ISDS's own refusal, never as a password the app silently lets
// through as fine.

/** One rule, in the order the change screen lists them. */
export type PasswordRule =
  | 'length'
  | 'upper'
  | 'lower'
  | 'digit'
  | 'allowed'
  | 'noLogin'
  | 'noTriple'
  | 'noWeakStart';

export const PASSWORD_RULES: readonly PasswordRule[] = [
  'length',
  'upper',
  'lower',
  'digit',
  'allowed',
  'noLogin',
  'noTriple',
  'noWeakStart',
];

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 64;

/** Letters without diacritics, digits, and ISDS's special characters, space included. */
const ALLOWED = /^[A-Za-z0-9 !#$%&()*+,\-.:=?@[\]_{|}~]*$/;
const WEAK_START = /^(12345|qwert|asdfg)/i;

/** Every rule's verdict for `password`, given the box's login name. */
export function passwordRules(
  password: string,
  loginName: string,
): Record<PasswordRule, boolean> {
  const login = loginName.trim().toLowerCase();
  return {
    length: password.length >= PASSWORD_MIN && password.length <= PASSWORD_MAX,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    digit: /[0-9]/.test(password),
    // An empty field has broken nothing yet; `length` is what it fails.
    allowed: ALLOWED.test(password),
    noLogin: login === '' || !password.toLowerCase().includes(login),
    noTriple: !/(.)\1\1/.test(password),
    noWeakStart: !WEAK_START.test(password),
  };
}

/** True when `password` meets every rule the app can check. */
export function isAcceptablePassword(password: string, loginName: string): boolean {
  const verdicts = passwordRules(password, loginName);
  return PASSWORD_RULES.every(rule => verdicts[rule]);
}
