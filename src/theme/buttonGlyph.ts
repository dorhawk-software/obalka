// Every action carries the family's glyph (practices: "A drawn icon set", check-ui icon; the owner's
// "every action, escapes marked", 031 T050.7, 2026-11-16). A button names its offset glyph, or brings
// a plain control's own (the eye), or says why it has none - so a new button without one fails tsc.

import type { ReactNode } from 'react';
import type { OffsetGlyphName } from './offsetIcons';

/**
 * Why a button carries no glyph: a way out (its words say what stays), a step on (Pokračovat, Hotovo),
 * or one of two answers that must weigh the same (consent: no guilt).
 */
export type Bare = 'way out' | 'step' | 'equal answer';

export type ButtonGlyph =
  | { readonly glyph: OffsetGlyphName; readonly icon?: never; readonly bare?: never }
  | { readonly icon: ReactNode; readonly glyph?: never; readonly bare?: never }
  | { readonly bare: Bare; readonly glyph?: never; readonly icon?: never };
