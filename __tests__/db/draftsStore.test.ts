import {
  InMemoryDraftsStore,
  type DraftRecord,
} from '../../src/services/db/draftsStore';

function draft(over: Partial<DraftRecord> = {}): DraftRecord {
  return {
    id: 'd1',
    boxId: 'box1',
    recipientBoxId: null,
    recipientLabel: null,
    recipientAddress: null,
    recipientDbType: null,
    subject: '',
    body: '',
    updatedAt: 1,
    ...over,
  };
}

describe('InMemoryDraftsStore', () => {
  it("lists a box's drafts newest first, scoped to the box", async () => {
    const s = new InMemoryDraftsStore();
    await s.save(draft({ id: 'a', updatedAt: 1 }));
    await s.save(draft({ id: 'b', updatedAt: 3 }));
    await s.save(draft({ id: 'c', boxId: 'other', updatedAt: 5 }));
    expect((await s.list('box1')).map(d => d.id)).toEqual(['b', 'a']);
  });

  it('upserts by id', async () => {
    const s = new InMemoryDraftsStore();
    await s.save(draft({ id: 'a', subject: 'first' }));
    await s.save(draft({ id: 'a', subject: 'second', updatedAt: 2 }));
    expect(await s.list('box1')).toHaveLength(1);
    expect((await s.get('a'))?.subject).toBe('second');
  });

  it('round-trips the typed message body', async () => {
    const s = new InMemoryDraftsStore();
    await s.save(
      draft({ id: 'a', subject: 'Ahoj', body: 'Dobrý den,\nposílám.' }),
    );
    expect((await s.get('a'))?.body).toBe('Dobrý den,\nposílám.');
  });

  it('removes a draft', async () => {
    const s = new InMemoryDraftsStore();
    await s.save(draft({ id: 'a' }));
    await s.remove('a');
    expect(await s.get('a')).toBeNull();
  });

  it("clears a box's drafts only", async () => {
    const s = new InMemoryDraftsStore();
    await s.save(draft({ id: 'a', boxId: 'box1' }));
    await s.save(draft({ id: 'b', boxId: 'box2' }));
    await s.clearBox('box1');
    expect(await s.list('box1')).toEqual([]);
    expect(await s.list('box2')).toHaveLength(1);
  });
});
