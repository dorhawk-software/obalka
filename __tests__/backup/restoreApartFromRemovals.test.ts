// A restore kept apart from box removals (006, 001 T037).
//
// A removal asks the store before each purge whether its box is listed, and a restore could bring the
// box back right after that question: the purge then cleared what the restore had just written. A
// removal started during a restore could likewise clear a box the restore was still writing documents
// for. The backup screen's restore and a phone transfer's save now wait for the removals queued before
// them, and a removal asked for meanwhile waits for them. These drive the app's own wiring (`deps.ts`),
// where the removal queue the shell uses and the backup controller the screens use are built.

import { backupController, removalQueue } from '../../src/features/accounts/deps';
import { BackupController } from '../../src/features/backup/state/backupController';

function held() {
  let release!: () => void;
  const promise = new Promise<void>(resolve => {
    release = resolve;
  });
  return { promise, release };
}

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

afterEach(async () => {
  await removalQueue.idle();
  // A write through `runRestore` schedules an automatic backup, which has no business running here.
  backupController.cancelPending();
  jest.restoreAllMocks();
});

describe('a restore and a box removal', () => {
  it('a transfer’s save waits for a removal still running', async () => {
    const log: string[] = [];
    const removal = held();
    void removalQueue.run('a', async () => {
      log.push('removal:start');
      await removal.promise;
      log.push('removal:end');
    }, () => {});
    const saving = backupController.runRestore(async () => {
      log.push('save');
      return 'saved';
    });
    await flush();
    expect(log).toEqual(['removal:start']);

    removal.release();
    await expect(saving).resolves.toBe('saved');
    expect(log).toEqual(['removal:start', 'removal:end', 'save']);
  });

  it('a removal asked for during a transfer’s save waits for the save to end', async () => {
    const log: string[] = [];
    const save = held();
    const saving = backupController.runRestore(async () => {
      log.push('save:start');
      await save.promise;
      log.push('save:end');
    });
    await flush();
    const removing = removalQueue.run('a', async () => {
      log.push('removal');
    }, () => {});
    await flush();
    expect(log).toEqual(['save:start']);

    save.release();
    await saving;
    await removing;
    expect(log).toEqual(['save:start', 'save:end', 'removal']);
  });

  it('the backup screen’s restore waits for a removal still running', async () => {
    const restored = { restored: true } as unknown as Awaited<ReturnType<BackupController['restore']>>;
    const restore = jest.spyOn(BackupController.prototype, 'restore').mockResolvedValue(restored);
    const removal = held();
    void removalQueue.run('a', () => removal.promise, () => {});
    const manifest = {} as Parameters<BackupController['restore']>[0];
    const restoring = backupController.restore(manifest, 'passphrase', 'prompt');
    await flush();
    expect(restore).not.toHaveBeenCalled();

    removal.release();
    await expect(restoring).resolves.toBe(restored);
    expect(restore).toHaveBeenCalledWith(manifest, 'passphrase', 'prompt');
  });
});
