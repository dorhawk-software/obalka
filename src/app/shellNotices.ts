// What the shell has to tell the user, oldest first (`AppShell`'s `notices`), shown one dialog at a
// time.
//
// It was one slot. The switcher closes before a removal settles, so a second box can be removed while
// the first is still going, and the second failure replaced the first notice - with it the only prompt
// to finish a box already gone from the app.

import type { RemovalNotice } from '../features/accounts/state/removeBox';

export type ShellNotice =
  | {
      readonly kind: 'removal';
      readonly boxId: string;
      /** The box's display name, captured before its row went; null if it was never listed. */
      readonly name: string | null;
      readonly notice: RemovalNotice;
    }
  | {
      /** A new box name that would not save; its retry saves the same name again. */
      readonly kind: 'alias';
      readonly boxId: string;
      readonly name: string | null;
      readonly alias: string | null;
    };

type RemovalShellNotice = Extract<ShellNotice, { kind: 'removal' }>;

const aboutRemovalOf = (boxId: string) => (n: ShellNotice) =>
  n.kind === 'removal' && n.boxId === boxId;

/**
 * The queue with this removal's notice: in place of an older one about the same box - a retry that
 * failed again says so where it already stood - and otherwise last, behind every notice before it.
 */
export function withRemovalNotice(
  queue: readonly ShellNotice[],
  notice: RemovalShellNotice,
): readonly ShellNotice[] {
  const at = queue.findIndex(aboutRemovalOf(notice.boxId));
  if (at === -1) {
    return [...queue, notice];
  }
  return queue.map((n, i) => (i === at ? notice : n));
}

/**
 * The queue without the removal notice about this box, which went through after all. Every other
 * notice stays: a removal of another box that went through must not take down one that did not.
 * The same array when there was nothing to drop, so nothing re-renders for it.
 */
export function withoutRemovalNotice(
  queue: readonly ShellNotice[],
  boxId: string,
): readonly ShellNotice[] {
  const about = aboutRemovalOf(boxId);
  return queue.some(about) ? queue.filter(n => !about(n)) : queue;
}
