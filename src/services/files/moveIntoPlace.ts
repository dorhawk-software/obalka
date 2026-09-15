// Putting a finished file under the name the archive points at, never holding neither copy.
//
// Shared since 2026-09-24 by the three places that replace a document on disk: a large message's
// enclosures (`vodzAttachmentDownloader.ts`), its signed original (`signedZfoStream.ts`) and a restore's
// documents (`backup/documents.ts`). Each had its own copy, and each copy had the same two gaps.

/** The three file operations it needs. */
export interface PlaceFs {
  exists(path: string): Promise<boolean>;
  /** Neither platform's move writes over a file: iOS refuses, Android deletes the destination first. */
  move(from: string, to: string): Promise<void>;
  remove(path: string): Promise<void>;
}

/**
 * Move `part` - whole and checked - to `final`.
 *
 * The copy already under the name is moved aside to `<final>.old` first, put back if the new one does
 * not go in, and removed only once it has. If putting it back fails as well, it stays aside: nothing here
 * removes the only copy.
 *
 * Two cases the first version left (review, 2026-09-24):
 *
 *   - Nothing read an aside copy back. A process killed between the two moves, or a put-back that
 *     failed, left the only copy under `.old` and nothing under the name. So first of all, a name with
 *     nothing under it and a copy aside gets that copy back, and the replacement goes on from there as
 *     from any held copy.
 *   - A stale `.old` that will not delete. On iOS the move aside then refuses a destination that exists,
 *     every time, and that document could never be replaced again. The copy under the name then goes
 *     aside under a name of its own (`.old-<ms>`), used only by this call and removed once the new one is
 *     in. The stale `.old` is left alone rather than forced: it is removed only after it is found to be
 *     older than a copy under the name, and a removal that failed once is not a reason to try harder.
 *     What this costs: a process killed between the moves in that case leaves the copy under the unique
 *     name, which the recovery above does not look for - on disk, never deleted, but not put back by
 *     itself. That needs a stale aside that cannot be deleted and a kill in the same moment.
 */
export async function moveIntoPlace(
  fs: PlaceFs,
  part: string,
  final: string,
  now: () => number = Date.now,
): Promise<void> {
  const aside = `${final}.old`;
  if (!(await fs.exists(final)) && (await fs.exists(aside))) {
    // The last replacement stopped between its moves. Best effort: if it cannot go back, the new copy
    // still goes in below, and the old one stays aside, untouched.
    await fs.move(aside, final).catch(() => undefined);
  }
  const held = await fs.exists(final);
  let putAside: string | null = null;
  if (held) {
    // One left aside by an earlier run is older than the copy under the name.
    await fs.remove(aside).catch(() => undefined);
    putAside = (await fs.exists(aside)) ? `${aside}-${now()}` : aside;
    await fs.move(final, putAside);
  }
  try {
    await fs.move(part, final);
  } catch (e) {
    if (putAside != null) {
      await fs.remove(final).catch(() => undefined); // iOS will not move onto anything left there
      await fs.move(putAside, final).catch(() => undefined);
    }
    throw e;
  }
  if (putAside != null) {
    await fs.remove(putAside).catch(() => undefined);
  }
}
