// What's new (spec 029): after an update, once, a sheet says what changed since the version this phone
// had, in the changelog's own words and the app's language, built in (`changelog.generated.ts`, from
// CHANGELOG.md and CHANGELOG.en.md - nothing is fetched). Settings → O aplikaci → Co je nového shows
// every release at any time.
//
// The decision is kept apart from the screens so it can be tested on its own: which releases a person
// has not seen, and whether any of them is worth interrupting them for.

import type { ChangelogRelease } from '../../content/changelog.generated';

/** `a` is newer than `b` (plain 1.2.3 versions; anything else is never newer). */
export function isNewerVersion(a: string, b: string): boolean {
  const parse = (v: string) => (/^\d+\.\d+\.\d+$/.test(v) ? v.split('.').map(Number) : null);
  const x = parse(a);
  const y = parse(b);
  if (!x || !y) {
    return false;
  }
  for (let i = 0; i < 3; i++) {
    if (x[i] !== y[i]) {
      return x[i] > y[i];
    }
  }
  return false;
}

/** The releases after `seen`, up to and including `current`, newest first. */
export function releasesSince(
  releases: readonly ChangelogRelease[],
  current: string,
  seen: string,
): ChangelogRelease[] {
  return releases.filter(
    r => isNewerVersion(r.version, seen) && !isNewerVersion(r.version, current),
  );
}

/** How many changes the releases hold, counting only what a person would notice. */
export function noticeableChanges(releases: readonly ChangelogRelease[]): number {
  return releases.reduce(
    (n, r) =>
      n +
      Object.entries(r.changes)
        .filter(([kind]) => kind !== 'underneath')
        .reduce((m, [, list]) => m + (list?.length ?? 0), 0),
    0,
  );
}

export type WhatsNewDecision =
  /** Nothing to say. `remember`: write `current` as seen (a first launch, or an update already told). */
  | { readonly show: false; readonly remember: boolean }
  /** Show these releases, then remember `current`. */
  | { readonly show: true; readonly releases: ChangelogRelease[]; readonly since: string };

/**
 * What to do at launch, given the version this phone last saw (`null`: none kept).
 *
 * None kept is a fresh install - or a phone a transfer or a restore has just filled, since the seen
 * version stays on the phone that saw it (`DEVICE_LOCAL_SETTINGS`). Either way this person has not
 * used an older Obálka HERE, so there is nothing new to them: remember the version, say nothing.
 * The same version, or an older one (a developer build over a release): nothing, and nothing written,
 * so the newer version they saw is kept. A newer one whose changes are all underneath: remember it
 * quietly - an update to what the app is built on is no reason to interrupt anyone.
 */
export function decideWhatsNew(
  releases: readonly ChangelogRelease[],
  current: string,
  seen: string | null,
): WhatsNewDecision {
  if (seen == null || seen === '') {
    return { show: false, remember: true };
  }
  if (!isNewerVersion(current, seen)) {
    return { show: false, remember: false };
  }
  const since = releasesSince(releases, current, seen);
  if (noticeableChanges(since) === 0) {
    return { show: false, remember: true };
  }
  return { show: true, releases: since, since: seen };
}

/** "2026-11-12" as the app writes a date: "12.11.2026" (the message list's form). */
export function releaseDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}
