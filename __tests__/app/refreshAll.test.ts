// One box's failure is that box's, and nobody else's (002 FR-017, 024 FR-003).
//
// Refresh-all ran every box under one `Promise.all`. A box whose database write threw rejected the
// whole thing: the boxes still being fetched lost their "načítá se…" mark while they were still out,
// the accounts were never re-read, and the rejection went to callers that had started the refresh with
// `void`. These run the per-box half (`refreshAll.ts`) over fakes that fail one box at a time; the
// shell's half is driven through the mounted shell in `crossBoxRefreshing.test.tsx`.

import { refreshBox, refreshBoxes, type RefreshAllDeps } from '../../src/app/refreshAll';
import type {
  MessagesOutcome,
} from '../../src/features/messages/state/messagesController';
import type {
  DataBoxAccount,
  MessageEnvelope,
  SyncFailure,
} from '../../src/services/isds/types';
import { BoxWork } from '../../src/features/messages/state/boxWork';

const account = (boxId: string, over: Partial<DataBoxAccount> = {}): DataBoxAccount => ({
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
  ...over,
});

const LOADED: MessagesOutcome = { kind: 'loaded', messages: [], downloaded: [], syncedAt: 0 };

/** What the fake database was asked to store, per box. */
interface Written {
  synced: string[];
  credit: string[];
  flags: [string, SyncFailure][];
}

function world(over: Partial<RefreshAllDeps> = {}): RefreshAllDeps & { written: Written } {
  const written: Written = { synced: [], credit: [], flags: [] };
  return {
    written,
    listReceived: async () => LOADED,
    getCredit: async () => 120,
    recordSync: async (boxId: string, _messages: MessageEnvelope[]) => {
      written.synced.push(boxId);
    },
    recordCredit: async boxId => {
      written.credit.push(boxId);
    },
    recordSyncFailure: async (boxId, flag) => {
      written.flags.push([boxId, flag]);
    },
    ...over,
  };
}

const signal = () => new AbortController().signal;

describe('a refresh where one box fails', () => {
  it('flags only the box whose counts would not record, and records every other box', async () => {
    const deps = world();
    const recordSync = deps.recordSync;
    deps.recordSync = async (boxId, messages) => {
      if (boxId === 'broken') {
        throw new Error('disk I/O error');
      }
      await recordSync(boxId, messages);
    };
    const flags = await refreshBoxes(
      [account('a'), account('broken'), account('b')],
      {},
      deps,
      signal(),
    );
    expect(flags).toEqual({ broken: 'error' });
    expect(deps.written.synced.sort()).toEqual(['a', 'b']);
    // The flag is stored too, so the switcher still shows it after a restart.
    expect(deps.written.flags).toEqual([['broken', 'error']]);
  });

  it('resolves only when every box is done, even after one has already failed', async () => {
    let releaseSlow!: (outcome: MessagesOutcome) => void;
    const slowListing = new Promise<MessagesOutcome>(resolve => {
      releaseSlow = resolve;
    });
    const deps = world({
      listReceived: async a => (a.boxId === 'slow' ? slowListing : LOADED),
      recordSync: async boxId => {
        if (boxId === 'broken') {
          throw new Error('disk I/O error');
        }
      },
    });
    let settled = false;
    const refresh = refreshBoxes([account('broken'), account('slow')], {}, deps, signal()).then(
      flags => {
        settled = true;
        return flags;
      },
    );
    // Long enough for `broken` to have failed several times over.
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(settled).toBe(false);

    releaseSlow(LOADED);
    await expect(refresh).resolves.toEqual({ broken: 'error' });
  });

  it('never rejects, whatever throws', async () => {
    const boom = async () => {
      throw new Error('boom');
    };
    const deps = world({
      listReceived: boom,
      recordSyncFailure: boom,
    });
    await expect(refreshBoxes([account('a'), account('b')], {}, deps, signal())).resolves.toEqual({
      a: 'error',
      b: 'error',
    });
  });
});

describe('one box', () => {
  it('keeps a refusal flag for this session when the flag itself cannot be stored', async () => {
    // The strip and the refresh-all skip still need it now; only the restart would lose it.
    const deps = world({
      listReceived: async () => ({ kind: 'reauth' }),
      recordSyncFailure: async () => {
        throw new Error('database is locked');
      },
    });
    expect(await refreshBox(account('a'), undefined, deps, signal())).toBe('reauth');
  });

  it('stores the flag `classifyFailure` gives a refusal', async () => {
    const deps = world({
      listReceived: async () => ({ kind: 'reauth' }),
    });
    const expired = account('a', { passwordExpiresAt: Date.now() - 86_400_000 });
    expect(await refreshBox(expired, undefined, deps, signal())).toBe('passwordExpired');
    expect(deps.written.flags).toEqual([['a', 'passwordExpired']]);
  });

  it('treats a listing that throws as a refresh of that box that failed', async () => {
    const deps = world({
      listReceived: async () => {
        throw new TypeError('undefined is not a function');
      },
    });
    expect(await refreshBox(account('a'), undefined, deps, signal())).toBe('error');
    expect(deps.written.flags).toEqual([['a', 'error']]);
  });

  it('does not fail a refresh over the credit, which is best-effort', async () => {
    const deps = world({
      recordCredit: async () => {
        throw new Error('disk full');
      },
    });
    expect(await refreshBox(account('a'), undefined, deps, signal())).toBeNull();
    expect(deps.written.synced).toEqual(['a']);
    expect(deps.written.flags).toEqual([]);
  });
});

// A box removed while a refresh is out for it (001 T037). The shell runs each box under a signal its
// removal aborts (`forBox`, over `BoxWork`), and a call stopped that way is not the box failing:
// flagged, a box whose removal then kept its row would have been sent to sign in again, and skipped by
// every refresh until it was.
describe('a box removed while it is being refreshed', () => {
  function answerLater() {
    let answer!: () => void;
    const answered = new Promise<void>(resolve => {
      answer = resolve;
    });
    return { answered, answer };
  }

  const turn = () => new Promise(resolve => setTimeout(resolve, 0));

  it('is neither flagged nor credited, and the box that stays is refreshed as ever', async () => {
    const work = new BoxWork();
    const later = answerLater();
    const signals: Record<string, AbortSignal> = {};
    const deps = world({
      listReceived: async (a, s) => {
        signals[a.boxId] = s;
        if (a.boxId !== 'gone') {
          return LOADED;
        }
        await later.answered;
        // What `MessagesController` answers for a call its box's removal stopped.
        return { kind: 'error', messageKey: 'messages.error.load' };
      },
      forBox: (boxId, s, run) => work.run(boxId, s, run),
    });
    const refreshing = refreshBoxes([account('gone'), account('b')], {}, deps, signal());
    await turn();

    work.stop('gone');
    expect(signals.gone.aborted).toBe(true);
    expect(signals.b.aborted).toBe(false);
    later.answer();
    await expect(refreshing).resolves.toEqual({});
    expect(deps.written.flags).toEqual([]);
    expect(deps.written.synced).toEqual(['b']);
    expect(deps.written.credit).toEqual(['b']);
  });

  it('flags nothing for a listing that throws once it was stopped', async () => {
    const work = new BoxWork();
    const later = answerLater();
    const deps = world({
      listReceived: async () => {
        await later.answered;
        throw Object.assign(new Error('Aborted'), { name: 'AbortError' });
      },
      forBox: (boxId, s, run) => work.run(boxId, s, run),
    });
    const refreshing = refreshBoxes([account('gone')], {}, deps, signal());
    await turn();

    work.stop('gone');
    later.answer();
    await expect(refreshing).resolves.toEqual({});
    expect(deps.written.flags).toEqual([]);
  });

  it('does not record the credit its removal stopped as the box’s balance', async () => {
    const work = new BoxWork();
    const later = answerLater();
    const deps = world({
      getCredit: async a => {
        if (a.boxId !== 'gone') {
          return 120;
        }
        await later.answered;
        // A credit call that did not get through answers null (`MessagesController.getCredit`).
        return null;
      },
      forBox: (boxId, s, run) => work.run(boxId, s, run),
    });
    const refreshing = refreshBoxes([account('gone'), account('b')], {}, deps, signal());
    await turn();

    work.stop('gone');
    later.answer();
    await expect(refreshing).resolves.toEqual({});
    expect(deps.written.credit).toEqual(['b']);
  });
});
