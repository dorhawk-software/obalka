// Presenting an ISDS address (feature 015). Pure - no I/O, no rendering, no formatting opinions.
//
// ISDS hands the address over as ONE pre-composed string: `Nová 1/777, 60200 Brno, CZ`. The
// structured fields (`adStreet`, `adZipCode`, `adCity`, …) do exist in ISDS, but on `FindDataBox2`,
// which this app deliberately does not use - it requires a `dbType` and misbehaves on czebox. So the
// only structure available is the one ISDS already put in the string: its commas.
//
// THE BOUNDARY THIS MODULE EXISTS TO HOLD. Breaking a line at a comma someone else wrote is
// presentation. Re-ordering the parts, labelling them ("Ulice:", "Město:"), expanding `CZ` to
// "Česká republika", or dropping a part that does not fit an expected shape would all be the app
// restating an official register entry in its own words - Principle VI, and the reason this is a
// tested function rather than a `.split(',')` at a call site.
//
// The split is deliberately shallow: first part, then everything else verbatim. It does not try to
// identify which part is the town, because it cannot know - a four-part address with a district in
// the middle is real, and a rule clever enough to find the town would be a rule capable of being
// wrong about it.

/** How an address should be laid out. Total: every input produces one of these. */
export type AddressParts =
  /** Two lines. `line2` carries the post code and town, so it takes the visual weight. */
  | { kind: 'parts'; line1: string; line2: string }
  /** The shape was not recognised - show the whole thing, wrapped, unaltered. */
  | { kind: 'whole'; text: string }
  /** ISDS returned no address. NOT the same as an empty one. */
  | { kind: 'none' };

/**
 * Lay out one ISDS address string.
 *
 * `line1` is the first comma-separated part (the street, in every shape seen in the register);
 * `line2` is everything after it, re-joined in its original order - so a district stays where ISDS
 * put it and a country code is never dropped. Round-tripping `line1 + ', ' + line2` reproduces the
 * input, which is the invariant that keeps this honest.
 */
export function addressParts(
  raw: string | null | undefined,
): AddressParts {
  if (typeof raw !== 'string') {
    return { kind: 'none' }; // the wire is XML; a caller can hand us anything (Principle II)
  }
  const parts = raw
    .split(',')
    .map(p => p.trim())
    .filter(p => p.length > 0);
  if (parts.length === 0) {
    return { kind: 'none' };
  }
  if (parts.length === 1) {
    return { kind: 'whole', text: parts[0] };
  }
  return { kind: 'parts', line1: parts[0], line2: parts.slice(1).join(', ') };
}

/** The minimum a result needs for same-name detection. */
interface NamedResult {
  name: string;
}

/**
 * Flag results whose owner name is shared by another result IN THE SAME SET.
 *
 * This is a fact about the search results, not about a person - which is what makes it safe to
 * assert (FR-004a). It exists because the user has to NOTICE that two rows carry the same name
 * before it occurs to them to compare the addresses, and with a dozen results that noticing is
 * exactly what fails.
 *
 * Compared case-insensitively and trimmed: the register is typed by many hands, and "Jan Novak" and
 * "jan novak " are the same collision as far as a reader scanning a list is concerned.
 */
export function markSameName<T extends NamedResult>(
  results: readonly T[],
): (T & { sameName: boolean })[] {
  const counts = new Map<string, number>();
  for (const r of results) {
    const key = normalizeName(r.name);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return results.map(r => ({
    ...r,
    sameName: (counts.get(normalizeName(r.name)) ?? 0) > 1,
  }));
}

function normalizeName(name: unknown): string {
  return typeof name === 'string' ? name.trim().toLowerCase() : '';
}
