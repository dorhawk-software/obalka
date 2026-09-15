// App build info shown in Settings → About. Keep `APP_VERSION` in sync with package.json on release
// (kept as a plain constant so we don't bundle the whole package.json into the app).
import type { Locale } from '../i18n/strings';

export const APP_VERSION = '0.0.1';

/** The public source repository (the app is MIT - see LICENSE). */
export const REPOSITORY_URL = 'https://github.com/dorhawk-software/obalka';
/**
 * Shown beside the row; the bare host+path reads better than the full URL at 13px.
 *
 * DERIVED, not typed out again. These two were separate literals naming the same repository, which
 * is a label that can disagree with the link it sits next to - the kind of drift nobody notices,
 * because the row keeps looking fine while pointing somewhere else.
 */
export const REPOSITORY_LABEL = REPOSITORY_URL.replace(/^https:\/\//, '');

/**
 * The privacy policy's file at the repository root, per app language (owner decision 2026-09-24):
 * Czech in PRIVACY.md, English in PRIVACY.en.md, the same split as README.md / README.en.md.
 *
 * `__tests__/app/privacyPolicy.test.tsx` checks the files exist beside the README. Until the owner
 * confirms the text and adds them (pending since 2026-09-24) it lists them as awaiting their text;
 * emptying that list in the same change makes it the real gate.
 */
export const PRIVACY_POLICY_FILES: Readonly<Record<Locale, string>> = {
  cs: 'PRIVACY.md',
  en: 'PRIVACY.en.md',
};

/** The policy as it reads on the default branch - linked, never bundled, so it can change without a release. */
export function privacyPolicyUrl(locale: Locale): string {
  return `${REPOSITORY_URL}/blob/main/${PRIVACY_POLICY_FILES[locale]}`;
}
