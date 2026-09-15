import { draftsBus } from '../../src/features/messages/state/draftsBus';

describe('draftsBus', () => {
  it('notifies subscribers on emit and stops after unsubscribe', () => {
    let calls = 0;
    const unsubscribe = draftsBus.subscribe(() => {
      calls += 1;
    });
    draftsBus.emit();
    draftsBus.emit();
    expect(calls).toBe(2);

    unsubscribe();
    draftsBus.emit();
    expect(calls).toBe(2); // no longer notified
  });

  it('supports multiple independent subscribers', () => {
    let a = 0;
    let b = 0;
    const un1 = draftsBus.subscribe(() => (a += 1));
    const un2 = draftsBus.subscribe(() => (b += 1));
    draftsBus.emit();
    expect([a, b]).toEqual([1, 1]);
    un1();
    un2();
  });
});
