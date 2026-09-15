import { attachmentFileStore } from '../../src/services/files/attachmentFileStore';
import type { MessageAttachment } from '../../src/services/isds/types';

function att(over: Partial<MessageAttachment>): MessageAttachment {
  return {
    name: 'a.pdf',
    mimeType: 'application/pdf',
    metaType: 'main',
    contentBase64: '',
    ...over,
  };
}

describe('attachmentFileStore', () => {
  it('persists inline base64 to a file: sets localPath + size, clears base64', async () => {
    const [out] = await attachmentFileStore.persist('box1', 'msg1', [
      att({ name: 'doc.pdf', contentBase64: 'QUJDRA==' }),
    ]);
    expect(out.localPath).toBe('/docs/attachments/box1/msg1/0-doc.pdf');
    expect(out.contentBase64).toBe('');
    expect(out.size).toBeGreaterThan(0);
    expect(await attachmentFileStore.exists(out.localPath as string)).toBe(true);
  });

  it('passes an already-on-disk attachment through, backfilling a missing size', async () => {
    const [written] = await attachmentFileStore.persist('box1', 'msg2', [
      att({ name: 'x.zfo', contentBase64: 'QUJDRA==' }),
    ]);
    // VoDZ-style: localPath set, no size - persist should stat + fill it without rewriting.
    const [out] = await attachmentFileStore.persist('box1', 'msg2', [
      att({ name: 'x.zfo', localPath: written.localPath, size: undefined }),
    ]);
    expect(out.localPath).toBe(written.localPath);
    expect(out.size).toBeGreaterThan(0);
  });

  it('skips an attachment whose base64 the decoder rejects, keeping the rest', async () => {
    const out = await attachmentFileStore.persist('boxBad', 'm', [
      att({ name: 'good.pdf', contentBase64: 'QUJDRA==' }),
      att({ name: 'bad.pdf', contentBase64: 'BAD' }), // mock writeFile throws on 'BAD'
      att({ name: 'good2.pdf', contentBase64: 'QUJDRA==' }),
    ]);
    expect(out).toHaveLength(3); // all still listed - one bad attachment can't drop the others
    expect(out[0].localPath).toBeTruthy();
    expect(out[1].localPath).toBeUndefined(); // skipped: no file, content cleared
    expect(out[1].contentBase64).toBe('');
    expect(out[2].localPath).toBeTruthy();
  });

  it('removeForBox deletes the box files', async () => {
    const [out] = await attachmentFileStore.persist('boxDel', 'm', [
      att({ contentBase64: 'QUJDRA==' }),
    ]);
    expect(await attachmentFileStore.exists(out.localPath as string)).toBe(true);
    await attachmentFileStore.removeForBox('boxDel');
    expect(await attachmentFileStore.exists(out.localPath as string)).toBe(
      false,
    );
  });

  describe('the signed original (004)', () => {
    it('is written beside the attachments, under a name no attachment can have', async () => {
      const zfo = await attachmentFileStore.persistSignedZfo('box1', 'msg9', 'QUJD\r\nRA==');
      expect(zfo).toEqual({
        fileName: 'DZ_msg9.zfo',
        localPath: '/docs/attachments/box1/msg9/DZ_msg9.zfo',
        size: 8, // the line break was stripped before the native decoder saw it
      });
      expect(await attachmentFileStore.exists(zfo?.localPath as string)).toBe(true);
    });

    it('comes back null when it cannot be written, leaving nothing half-written', async () => {
      expect(await attachmentFileStore.persistSignedZfo('box1', 'msgBad', 'BAD')).toBeNull();
      expect(
        await attachmentFileStore.exists('/docs/attachments/box1/msgBad/DZ_msgBad.zfo'),
      ).toBe(false);
    });

    it('goes when the box goes', async () => {
      const zfo = await attachmentFileStore.persistSignedZfo('boxGone', 'm', 'QUJDRA==');
      await attachmentFileStore.removeForBox('boxGone');
      expect(await attachmentFileStore.exists(zfo?.localPath as string)).toBe(false);
    });
  });
});
