// Box removals run one at a time, and adding a box waits for them (001 T037).

import { RemovalQueue } from '../../src/features/accounts/state/removalQueue';

function held() {
  let release!: () => void;
  const promise = new Promise<void>(resolve => {
    release = resolve;
  });
  return { promise, release };
}

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

describe('the removal queue', () => {
  it('runs one removal at a time, in the order asked', async () => {
    const queue = new RemovalQueue();
    const log: string[] = [];
    const first = held();
    void queue.run('a', async () => {
      log.push('a:start');
      await first.promise;
      log.push('a:end');
    }, () => {});
    void queue.run('b', async () => {
      log.push('b:start');
    }, () => {});
    await flush();
    expect(log).toEqual(['a:start']);
    first.release();
    await queue.idle();
    expect(log).toEqual(['a:start', 'a:end', 'b:start']);
  });

  it('treats the same box asked for again while it is queued as the same removal', async () => {
    const queue = new RemovalQueue();
    const work = jest.fn(async () => {});
    const gate = held();
    void queue.run('x', () => gate.promise, () => {});
    void queue.run('a', work, () => {});
    void queue.run('a', work, () => {});
    gate.release();
    await queue.idle();
    expect(work).toHaveBeenCalledTimes(1);
  });

  it('hands a failure to its handler, never rejects, and keeps running what is queued after it', async () => {
    const queue = new RemovalQueue();
    const onError = jest.fn();
    const after = jest.fn(async () => {});
    await expect(
      queue.run('a', async () => {
        throw new Error('boom');
      }, onError),
    ).resolves.toBeUndefined();
    await queue.run('b', after, () => {});
    expect(onError).toHaveBeenCalledWith(new Error('boom'));
    expect(after).toHaveBeenCalledTimes(1);
  });

  it('is idle only once every removal is done, including one queued while it waited', async () => {
    const queue = new RemovalQueue();
    const first = held();
    const second = held();
    let idle = false;
    void queue.run('a', () => first.promise, () => {});
    void queue.idle().then(() => {
      idle = true;
    });
    void queue.run('b', () => second.promise, () => {});
    first.release();
    await flush();
    expect(idle).toBe(false);
    second.release();
    await flush();
    await flush();
    expect(idle).toBe(true);
  });

  it('is idle at once with nothing queued', async () => {
    await expect(new RemovalQueue().idle()).resolves.toBeUndefined();
  });
});

// A restore - the backup screen's, or a phone transfer's save - and a removal must never run at once
// (006, 001 T037). A removal asks before each purge whether its box is listed, so a restore that
// brought the box back just after that question lost what it had written to the purge; and a removal
// started during a restore could clear a box the restore was still writing.
describe('work kept apart from removals', () => {
  it('waits for every removal queued before it, including one queued while it waited', async () => {
    const queue = new RemovalQueue();
    const log: string[] = [];
    const first = held();
    const second = held();
    void queue.run('a', async () => {
      log.push('a:start');
      await first.promise;
      log.push('a:end');
    }, () => {});
    const restoring = queue.runApart(async () => {
      log.push('restore');
      return 'restored';
    });
    void queue.run('b', async () => {
      log.push('b:start');
      await second.promise;
      log.push('b:end');
    }, () => {});
    await flush();
    expect(log).toEqual(['a:start']);

    first.release();
    await flush();
    expect(log).toEqual(['a:start', 'a:end', 'b:start']);
    second.release();
    await expect(restoring).resolves.toBe('restored');
    expect(log).toEqual(['a:start', 'a:end', 'b:start', 'b:end', 'restore']);
  });

  it('holds a removal asked for while it runs until it has ended', async () => {
    const queue = new RemovalQueue();
    const log: string[] = [];
    const restore = held();
    const restoring = queue.runApart(async () => {
      log.push('restore:start');
      await restore.promise;
      log.push('restore:end');
    });
    await flush();
    const removing = queue.run('a', async () => {
      log.push('removal');
    }, () => {});
    await flush();
    expect(log).toEqual(['restore:start']);

    restore.release();
    await restoring;
    await removing;
    expect(log).toEqual(['restore:start', 'restore:end', 'removal']);
  });

  it('rejects as its work does, and the removals held behind it still run', async () => {
    const queue = new RemovalQueue();
    const restore = held();
    const removal = jest.fn(async () => {});
    const restoring = queue.runApart(async () => {
      await restore.promise;
      throw new Error('wrong passphrase');
    });
    await flush();
    const removing = queue.run('a', removal, () => {});
    restore.release();
    await expect(restoring).rejects.toThrow('wrong passphrase');
    await removing;
    expect(removal).toHaveBeenCalledTimes(1);
  });
});
