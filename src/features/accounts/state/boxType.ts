// The box's legal-form label, shown under the box name in the switcher / header / re-auth card
// (design-parity: the design renders "{legal type} · ID {boxId}"). Reuses the existing send.dbType.*
// labels; the type is dropped until `dbType` is captured (login/re-auth) or backfilled on a refresh.
// The "{type} · ID {id}" layout itself lives in the BoxIdentityLine component (it must protect the ID
// from truncation, which a plain string can't).

import { t } from '../../../i18n/strings';
import type { BoxType } from '../../../services/isds/types';

/** Localized legal-form label for a box type (Fyzická osoba / Právnická osoba / …), or null if unknown. */
export function boxTypeLabel(dbType: BoxType | null): string | null {
  return dbType ? t(`send.dbType.${dbType}`) : null;
}

/**
 * The same label, short enough for the chip on a message row.
 *
 * Separate from {@link boxTypeLabel} because the two have different jobs and different budgets: the
 * switcher has a whole line for "Podnikající fyzická osoba", a chip beside a sender's name does not.
 *
 * It is NOT the raw ISDS code, which is what the chip used to render. `FO` and `PFO` are Czech
 * acronyms - fyzická osoba, podnikající fyzická osoba - and every Czech data-box holder reads them
 * without thinking. In English they are three letters of somebody else's language, sitting next to
 * a switcher that says "Individual" on the very same box.
 */
export function boxTypeShort(dbType: BoxType | null): string | null {
  return dbType ? t(`box.type.short.${dbType}`) : null;
}
