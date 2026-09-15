// Maps ISDS `X-Response-message-code` values (language-independent) to our own localized message
// keys, so the app shows its own copy regardless of UI language. Unknown codes fall back to the
// server's already-localized `X-Response-message-text` (Czech) at the call site.

const CODE_TO_KEY: Record<string, string> = {
  'authentication.info.totpSended': 'login.otp.notice.smsSent',
};

/** The app message key for a known ISDS response code, or null to fall back to the server text. */
export function serverNoticeKey(code: string | undefined): string | null {
  return code ? CODE_TO_KEY[code] ?? null : null;
}
