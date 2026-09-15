// The work under way for each box, which removing the box stops (001 T037, 002 FR-015).
//
// A sync already out for a box when its removal started wrote what ISDS returned back into the
// archive after the removal had cleared it. `BoxWork` keeps three rules for every caller: a removal
// aborts the box's calls, a write for a box being removed or no longer listed is refused, and clearing
// a box waits for the writes of it already under way. The races against a real removal are in
// `__tests__/accounts/removalVsSync.test.ts`.

import { BoxGoneError, BoxWork } from '../../src/features/messages/state/boxWork';
import * as telemetry from '../../src/services/telemetry/telemetry';

function held<T = void>() {
  let release!: (value: T) => void;
  const promise = new Promise<T>(resolve => {
    release = resolve;
  });
  return { promise, release };
}

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

describe('the calls of a box', () => {
  it('are aborted when its removal starts, and no other box’s are', async () => {
    const work = new BoxWork();
    const gate = held();
    const signals: Record<string, AbortSignal> = {};
    const calls = ['a', 'b'].map(boxId =>
      work.run(boxId, undefined, async signal => {
        signals[boxId] = signal;
        await gate.promise;
      }),
    );
    work.stop('a');
    expect(signals.a.aborted).toBe(true);
    expect(signals.b.aborted).toBe(false);
    gate.release();
    await Promise.all(calls);
  });

  it('start aborted while the removal runs, and not once it has ended', async () => {
    const work = new BoxWork();
    work.stop('a');
    await expect(work.run('a', undefined, async signal => signal.aborted)).resolves.toBe(true);
    work.resume('a');
    await expect(work.run('a', undefined, async signal => signal.aborted)).resolves.toBe(false);
  });

  it('still abort with the caller’s own signal', async () => {
    const work = new BoxWork();
    const outer = new AbortController();
    const gate = held();
    let inner: AbortSignal | null = null;
    const call = work.run('a', outer.signal, async signal => {
      inner = signal;
      await gate.promise;
    });
    outer.abort();
    expect(inner!.aborted).toBe(true);
    gate.release();
    await call;
  });
});

describe('a write of a box', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('is refused while the box is being removed, and writes nothing', async () => {
    const work = new BoxWork(async () => true);
    const write = jest.fn(async () => {});
    work.stop('a');
    await expect(work.write('a', write)).rejects.toBeInstanceOf(BoxGoneError);
    expect(write).not.toHaveBeenCalled();
    // Another box writes as ever.
    await expect(work.write('b', write)).resolves.toBeUndefined();
    expect(write).toHaveBeenCalledTimes(1);
  });

  it('is refused for a box the store no longer lists - by then its removal has ended', async () => {
    const work = new BoxWork(async boxId => boxId === 'b');
    const write = jest.fn(async () => {});
    await expect(work.write('a', write)).rejects.toBeInstanceOf(BoxGoneError);
    await expect(work.write('b', write)).resolves.toBeUndefined();
    expect(write).toHaveBeenCalledTimes(1);
  });

  it('is refused when the store cannot say whether the box is listed, and the store is reported', async () => {
    const reported = jest.spyOn(telemetry, 'reportFailure').mockImplementation(() => {});
    const broken = new Error('database disk image is malformed');
    const work = new BoxWork(async () => {
      throw broken;
    });
    const write = jest.fn(async () => {});
    await expect(work.write('a', write)).rejects.toBeInstanceOf(BoxGoneError);
    expect(write).not.toHaveBeenCalled();
    expect(reported).toHaveBeenCalledWith('db.read', broken, { stage: 'persist' });
  });

  it('is refused when the removal starts while the store is being asked', async () => {
    const answer = held<boolean>();
    const work = new BoxWork(() => answer.promise);
    const write = jest.fn(async () => {});
    const writing = work.write('a', write);
    work.stop('a');
    answer.release(true);
    await expect(writing).rejects.toBeInstanceOf(BoxGoneError);
    expect(write).not.toHaveBeenCalled();
  });
});

describe('clearing a box', () => {
  it('waits for a write that got in before the removal, so the write never lands after it', async () => {
    const work = new BoxWork(async () => true);
    const log: string[] = [];
    const gate = held();
    const writing = work.write('a', async () => {
      log.push('write:start');
      await gate.promise;
      log.push('write:end');
    });
    await flush();
    work.stop('a');
    const cleared = work.settled('a').then(() => {
      log.push('clear');
    });
    await flush();
    expect(log).toEqual(['write:start']);

    gate.release();
    await Promise.all([writing, cleared]);
    expect(log).toEqual(['write:start', 'write:end', 'clear']);
  });

  it('goes at once with no write under way, and after a write that failed', async () => {
    const work = new BoxWork(async () => true);
    await expect(work.settled('a')).resolves.toBeUndefined();
    await expect(
      work.write('a', async () => {
        throw new Error('disk full');
      }),
    ).rejects.toThrow('disk full');
    await expect(work.settled('a')).resolves.toBeUndefined();
  });
});
