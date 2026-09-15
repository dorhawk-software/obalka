// Refresh-all holds back every box only the user can repair (001 FR-009).
//
// A box whose password ISDS has refused is skipped rather than refreshed: sending the same password
// again cannot work, and ISDS locks an account after repeated refused sign-ins. `needsSignIn` names
// those failures and is tested beside `classifyFailure`; this pins that refresh-all actually asks it,
// for the fetch AND for the "načítá se…" mark. An expired password is the newer of the two, and a skip
// still written as `=== 'reauth'` would quietly re-send it on every launch.
//
// These used to read the rule out of `AppShell.tsx`'s source, and missed a second copy of it there:
// the loading mark was decided by `!== 'reauth'`, so a box whose password had expired was marked as
// being refreshed by a refresh that never fetched it. The per-box half is `refreshAll.ts` now, so
// these run it.

import {
  boxesToFetch,
  refreshBox,
  refreshBoxes,
  type RefreshAllDeps,
} from '../../src/app/refreshAll';
import type { DataBoxAccount, SyncFailure } from '../../src/services/isds/types';

const account = (boxId: string): DataBoxAccount => ({
  id: boxId,
  boxId,
  loginName: 'user',
  label: boxId,
  dbType: null,
  alias: null,
  authMethod: 'password',
  host: 'czebox',
  secretRef: 'ref',
  sessionValidUntil: null,
  passwordExpiresAt: null,
  lastSyncedAt: null,
  messageCount: null,
  unreadCount: null,
  pdzCreditCzk: null,
  syncError: null,
  createdAt: 0,
  updatedAt: 0,
});

/** A fake ISDS that answers every listing at once, and remembers which boxes it was asked about. */
function isds(): RefreshAllDeps & { listed: string[] } {
  const listed: string[] = [];
  return {
    listed,
    listReceived: async a => {
      listed.push(a.boxId);
      return { kind: 'loaded', messages: [], downloaded: [], syncedAt: 0 };
    },
    getCredit: async () => null,
    recordSync: async () => {},
    recordCredit: async () => {},
    recordSyncFailure: async () => {},
  };
}

const signal = () => new AbortController().signal;

describe('refresh-all skips the boxes needsSignIn names', () => {
  it.each(['reauth', 'passwordExpired'] as const)(
    'sends nothing for a box flagged %s, and keeps the flag it skipped on',
    async flag => {
      const deps = isds();
      expect(await refreshBox(account('b1'), flag, deps, signal())).toBe(flag);
      expect(deps.listed).toEqual([]);
    },
  );

  it('still refreshes a box whose last refresh merely failed', async () => {
    const deps = isds();
    expect(await refreshBox(account('b1'), 'error', deps, signal())).toBeNull();
    expect(deps.listed).toEqual(['b1']);
  });

  it('marks as loading only the boxes it fetches - never one whose password expired', async () => {
    const accounts = ['ok', 'expired', 'signIn', 'flaky'].map(account);
    const known: Record<string, SyncFailure> = {
      expired: 'passwordExpired',
      signIn: 'reauth',
      flaky: 'error',
    };
    expect(boxesToFetch(accounts, known)).toEqual(['ok', 'flaky']);

    // The mark and the fetch are one rule: exactly the marked boxes are asked about.
    const deps = isds();
    const flags = await refreshBoxes(accounts, known, deps, signal());
    expect(deps.listed.sort()).toEqual(['flaky', 'ok']);
    expect(flags).toEqual({ expired: 'passwordExpired', signIn: 'reauth' });
  });
});
