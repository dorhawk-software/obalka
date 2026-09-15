// The shell's notices, oldest first (`shellNotices.ts`).

import {
  withoutRemovalNotice,
  withRemovalNotice,
  type ShellNotice,
} from '../../src/app/shellNotices';

const removal = (boxId: string, notice: 'kept' | 'incomplete' | 'unknown'): ShellNotice => ({
  kind: 'removal',
  boxId,
  name: boxId.toUpperCase(),
  notice,
});

const alias = (boxId: string): ShellNotice => ({
  kind: 'alias',
  boxId,
  name: boxId.toUpperCase(),
  alias: 'Doma',
});

describe('queueing a removal notice', () => {
  it('puts it behind every notice already waiting', () => {
    // One slot let the second failure replace the first.
    const queue = withRemovalNotice([removal('a', 'incomplete')], {
      kind: 'removal',
      boxId: 'b',
      name: 'B',
      notice: 'kept',
    });
    expect(queue).toEqual([removal('a', 'incomplete'), removal('b', 'kept')]);
  });

  it('replaces an older notice about the same box where it stood', () => {
    const queue = withRemovalNotice(
      [removal('a', 'kept'), alias('a'), removal('b', 'kept')],
      { kind: 'removal', boxId: 'a', name: 'A', notice: 'incomplete' },
    );
    expect(queue).toEqual([removal('a', 'incomplete'), alias('a'), removal('b', 'kept')]);
  });
});

describe('dropping a removal notice', () => {
  it('drops only that box’s removal notice', () => {
    expect(
      withoutRemovalNotice([removal('a', 'kept'), alias('a'), removal('b', 'unknown')], 'a'),
    ).toEqual([alias('a'), removal('b', 'unknown')]);
  });

  it('hands back the same queue when there is nothing to drop', () => {
    const queue = [removal('b', 'kept')];
    expect(withoutRemovalNotice(queue, 'a')).toBe(queue);
  });
});
