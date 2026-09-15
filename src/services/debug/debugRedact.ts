// The one thing a debug bundle may never contain, at any level, ever: a credential.
//
// This module is the inverse of `telemetry/scrub.ts`, and the difference is worth being precise
// about because the two look superficially similar and are built on opposite principles.
//
// `scrub.ts` is an ALLOW-LIST, because a telemetry event leaves the phone automatically and the leak
// that matters is the one nobody thought of. It throws away almost everything, and that is what makes
// a hard bug unfixable from a Sentry report alone.
//
// A debug bundle is not that. It is a file, on the user's own phone, holding the user's own data,
// which does nothing until they hand it to somebody. The user can open it. Nothing about keeping
// their own mail on their own device needs our permission, so a bundle is allowed to be RICH, and at
// the Full level it deliberately carries the SOAP envelopes an allow-list would have destroyed.
//
// Credentials are the exception, and they are a DENY-LIST precisely because they have known shapes:
// a `Authorization:` header, a `Cookie:`, a `<dbPassword>`, an OTP. Every one of them is a fixed
// string this codebase itself writes, so we know exactly what to look for.
//
// WHY THEY ARE DIFFERENT FROM MAIL. Principle III: "We never transmit government mail or credentials
// to any server we operate." The bundle satisfies the first half by agency: the user releases their
// own mail, knowingly, to a recipient they choose. The second half has no such escape, because
// consent requires understanding, and nobody can meaningfully consent to sharing a password they
// cannot see inside a five-megabyte log. So Full mode means "my mail". It never means "my password".

const HIDDEN = '[credential removed]';

/**
 * Credential shapes, every one of them a string this codebase writes itself.
 *
 * Ordered longest-context first so a broader rule cannot eat the anchor a narrower one needs.
 */
const CREDENTIAL_SHAPES: readonly [RegExp, string][] = [
  // HTTP Basic - `basicAuthHeader()` in isds/httpClient.ts. The base64 IS the password.
  [/(Authorization\s*[:=]\s*)(?:Basic|Bearer|Digest)\s+\S+/gi, `$1${HIDDEN}`],
  // The ISDS session. `IPCZ-X-COOKIE` is a live session: whoever holds it is signed in as the user.
  [/((?:Set-)?Cookie\s*[:=]\s*)[^\r\n]+/gi, `$1${HIDDEN}`],
  [/\b(IPCZ-X-COOKIE|JSESSIONID|S-COOKIE)=\S+/gi, `$1=${HIDDEN}`],
  // SOAP and JSON credential fields, in the spellings this app and ISDS actually use.
  [
    /<((?:\w+:)?(?:dbPassword|password|heslo|otpCode|dbOTPCode|secret|token))>[\s\S]*?<\/\1>/gi,
    `<$1>${HIDDEN}</$1>`,
  ],
  [
    /("(?:password|passwd|pwd|secret|token|otp|code|pin|passphrase|recoveryKey|authorization|cookie)"\s*:\s*)"(?:[^"\\]|\\.)*"/gi,
    `$1"${HIDDEN}"`,
  ],
  // `password=…` / `otp: …` in a query string, a log line or a thrown message.
  [
    /\b(password|passwd|pwd|secret|token|otp|otpCode|pin|passphrase|recoveryKey)\s*[:=]\s*[^\s&,;"'}\]]+/gi,
    `$1=${HIDDEN}`,
  ],
  // The recovery key, which is the backup's whole security, and the QR payload that carries it.
  // The exact shape from `backup/recoveryKey.ts`: 20 symbols in 5 groups of 4, over an alphabet that
  // drops I, L, O and U. Anchored to that alphabet and that length rather than "a dashed string", so
  // it cannot swallow a message id or a fault code that happens to have dashes in it.
  [/\b(?:OBALKA:)?[0-9A-HJKMNP-TV-Z]{4}(?:-[0-9A-HJKMNP-TV-Z]{4}){4}\b/g, HIDDEN],
];

/**
 * Remove every credential shape from a piece of text.
 *
 * Runs on every recorded entry at BOTH levels, before it reaches the buffer - never at export time.
 * Recording it and cleaning it later would mean a credential sitting in memory for the length of a
 * debug session, retrievable by anything that can read the heap.
 */
export function stripCredentials(text: string): string {
  let out = text;
  for (const [pattern, replacement] of CREDENTIAL_SHAPES) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

/**
 * The same, over a structure: every string value, however deep, plus the keys themselves.
 *
 * A key whose NAME says credential is emptied regardless of what its value looks like - `{password:
 * 12345}` is a number and would survive every rule above.
 */
const CREDENTIAL_KEY =
  /^(password|passwd|pwd|secret|token|otp|otpcode|pin|passphrase|recoverykey|authorization|cookie|sessioncookie|credentials?|auth)$/i;

export function stripCredentialsDeep(value: unknown, depth = 0): unknown {
  if (depth > 12) {
    return '[too deep]'; // a cycle, or a structure nobody is going to read anyway
  }
  if (typeof value === 'string') {
    return stripCredentials(value);
  }
  if (Array.isArray(value)) {
    return value.map(v => stripCredentialsDeep(v, depth + 1));
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      out[key] = CREDENTIAL_KEY.test(key) ? HIDDEN : stripCredentialsDeep(v, depth + 1);
    }
    return out;
  }
  return value;
}
