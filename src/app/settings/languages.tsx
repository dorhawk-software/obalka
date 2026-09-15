// The languages the app speaks: THE list, and the only one.
//
// Settings and the first-run Welcome both offer the choice, and both map this list rather than naming
// languages of their own, so a language added here appears in both with the same flag and name. The
// `Locale` type is derived from it too, which is what makes adding one (Ukrainian is the likely next)
// a single entry here plus its strings table in `i18n/strings.ts` - TypeScript then refuses to build
// until that table exists, and nothing else has to be found by hand.
//
// Each name is the language's own ("Čeština", "English"), in every locale: it is read by somebody
// looking for their language, who may not read the one on screen.

import type { ReactNode } from 'react';
import { FlagCz, FlagEn } from '../../theme/artwork';

interface Language {
  /** The code the choice is stored under and the strings are keyed by. */
  readonly code: string;
  /** The language's name in itself. */
  readonly name: string;
  /** Its drawn 28×20 flag chip. */
  readonly flag: ReactNode;
}

// Drawn flag chips (design) - NOT the regional-indicator emoji, which most Android builds render as
// bare "CZ" / "GB" letters.
export const LANGUAGES = [
  { code: 'cs', name: 'Čeština', flag: <FlagCz /> },
  { code: 'en', name: 'English', flag: <FlagEn /> },
] as const satisfies readonly Language[];

/** A language the app speaks. */
export type Locale = (typeof LANGUAGES)[number]['code'];

/** Whether a stored value names a language this build speaks. Anything else is read as no choice. */
export function isLocale(value: unknown): value is Locale {
  return LANGUAGES.some(l => l.code === value);
}
