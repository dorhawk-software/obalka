// The language the app speaks right now; `t()` and the number formats read it live.
//
// Its own module so that `typeset.ts` and the formats can read it: `strings.ts` imports `typeset.ts`,
// and the other way round would be a cycle. Written only by the SettingsProvider, when it applies a
// stored language and when one is chosen - never from a render (see `SettingsProvider`).

import type { Locale } from '../app/settings/languages';

let activeLocale: Locale = 'cs';

export function setActiveLocale(next: Locale): void {
  activeLocale = next;
}

export function getActiveLocale(): Locale {
  return activeLocale;
}
