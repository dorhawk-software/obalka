// A party's name as ISDS writes it, split into what a person reads first and what can wait (031, the
// owner 2026-11-13: "the podnikající fyzická osoba is less important than the name").
//
// ISDS names a self-employed person's box "Ondřej Šimon - podnikající fyzická osoba": the person and
// the box's legal form in one string. Printed as one, the form takes the name's weight and, on the
// envelope's 120, three lines of it. The name leads; the form goes to a quieter line, short ("PFO"),
// and in full on a tap and to a screen reader - it is not dropped, only ranked.
//
// Only the suffix seen from ISDS is split: a guessed pattern would cut a real name that happens to
// contain a dash ("Nováková - Dvořáková").

import type { BoxType } from '../../../services/isds/types';

/** The legal forms ISDS appends to a holder's name, each as the box type it is. */
const FORM_SUFFIXES: readonly { readonly words: string; readonly type: BoxType }[] = [
  { words: 'podnikající fyzická osoba', type: 'PFO' },
];

export interface PartyName {
  /** The person or body: what a reader looks for. */
  readonly name: string;
  /** The legal form ISDS appended, or null when there was none. */
  readonly form: BoxType | null;
}

/** "Ondřej Šimon - podnikající fyzická osoba" → { name: "Ondřej Šimon", form: "PFO" }. */
export function partyName(raw: string | null | undefined): PartyName {
  const whole = (raw ?? '').trim();
  for (const { words, type } of FORM_SUFFIXES) {
    const match = new RegExp(`^(.+?)\\s*[-–—,]\\s*${words}$`, 'iu').exec(whole);
    if (match) {
      return { name: match[1].trim(), form: type };
    }
  }
  return { name: whole, form: null };
}
