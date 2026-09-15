// Which attachments a scan opens, and in what order (010 US3).
//
// The selection rules are where a plausible-looking scan quietly goes wrong: reading a detached
// signature and finding its timestamp, or merging two documents' dates into a choice the scanner
// deliberately refuses to make.

import {
  scanAttachmentsForDeadline,
  scannableAttachments,
} from '../../src/services/scan/attachmentScan';
import type { MessageAttachment } from '../../src/services/isds/types';

const NOW = new Date(2026, 5, 1).getTime();

const att = (over: Partial<MessageAttachment>): MessageAttachment => ({
  name: 'a.pdf',
  mimeType: 'application/pdf',
  metaType: 'enclosure',
  contentBase64: '',
  localPath: '/disk/a.pdf',
  ...over,
});

/** Deps whose extracted text depends on WHICH file was read. */
function byFile(texts: Record<string, string | null>) {
  let current = '';
  return {
    async readBytes(p: string) {
      current = p;
      return new Uint8Array([1]);
    },
    async extractText() {
      return texts[current] ?? null;
    },
    now: () => NOW,
  };
}

describe('choosing what to scan', () => {
  it('skips a signature, a non-PDF, and anything not on disk', () => {
    const picked = scannableAttachments([
      att({
        name: 'sig.p7s',
        mimeType: 'application/pkcs7-signature',
        metaType: 'signature',
      }),
      att({ name: 'foto.jpg', mimeType: 'image/jpeg' }), // Q6: no OCR, so an image is not a candidate
      att({ name: 'nestazeno.pdf', localPath: undefined }),
      att({ name: 'ok.pdf' }),
    ]);
    expect(picked.map(a => a.name)).toEqual(['ok.pdf']);
  });

  it('reads the main document first, whatever order ISDS listed it in', () => {
    const picked = scannableAttachments([
      att({ name: 'priloha.pdf' }),
      att({ name: 'rozhodnuti.pdf', metaType: 'main' }),
    ]);
    expect(picked[0].name).toBe('rozhodnuti.pdf');
  });

  it('stops after four documents', () => {
    const picked = scannableAttachments(
      Array.from({ length: 9 }, (_, i) =>
        att({ name: `p${i}.pdf`, localPath: `/disk/p${i}.pdf` }),
      ),
    );
    expect(picked).toHaveLength(4);
  });

  it('accepts a PDF whose mime type ISDS got wrong, by extension', () => {
    const picked = scannableAttachments([
      att({ name: 'rozhodnuti.PDF', mimeType: 'application/octet-stream' }),
    ]);
    expect(picked).toHaveLength(1);
  });

  it('never reads a signed message, however it is labelled (004)', () => {
    // A forwarded .zfo sent as an attachment, with the sender's guess at a type. Its dates are ISDS's
    // own timestamps, and it is the size of everything it seals.
    const picked = scannableAttachments([
      att({ name: 'DZ_1234567.zfo', mimeType: 'application/pdf' }),
      att({
        name: 'preposlana-zprava.pdf',
        mimeType: 'application/vnd.software602.filler.form-xml-zip',
      }),
      att({ name: 'ok.pdf' }),
    ]);
    expect(picked.map(a => a.name)).toEqual(['ok.pdf']);
  });
});

describe('scanning', () => {
  it('takes the first document that states an unambiguous deadline', async () => {
    const found = await scanAttachmentsForDeadline(
      [
        att({ name: 'rozhodnuti.pdf', metaType: 'main', localPath: '/disk/1' }),
        att({ name: 'pruvodka.pdf', localPath: '/disk/2' }),
      ],
      byFile({
        '/disk/1': 'Odvolání lze podat do 8. 7. 2026.',
        '/disk/2': 'Uhraďte do 1. 9. 2026.',
      }),
    );
    expect(found?.date).toBe(new Date(2026, 6, 8).getTime());
    expect(found?.fileName).toBe('rozhodnuti.pdf');
  });

  // The scanner refuses to choose between two dates in ONE document; scanning several documents must
  // not smuggle that choice back in. The ambiguous document yields nothing, and the next one answers.
  it('moves on from an ambiguous document rather than picking one of its dates', async () => {
    const found = await scanAttachmentsForDeadline(
      [
        att({ name: 'nejasne.pdf', metaType: 'main', localPath: '/disk/1' }),
        att({ name: 'jasne.pdf', localPath: '/disk/2' }),
      ],
      byFile({
        '/disk/1': 'Uhraďte do 8. 7. 2026, nejpozději však do 20. 8. 2026.',
        '/disk/2': 'Lhůta končí do 1. 9. 2026.',
      }),
    );
    expect(found?.fileName).toBe('jasne.pdf');
  });

  it('survives an attachment that cannot be read', async () => {
    const found = await scanAttachmentsForDeadline(
      [
        att({ name: 'rozbite.pdf', metaType: 'main', localPath: '/disk/1' }),
        att({ name: 'ok.pdf', localPath: '/disk/2' }),
      ],
      {
        async readBytes(p: string) {
          if (p === '/disk/1') {
            throw new Error('EIO');
          }
          return new Uint8Array([1]);
        },
        async extractText() {
          return 'Termín do 8. 7. 2026.';
        },
        now: () => NOW,
      },
    );
    expect(found?.fileName).toBe('ok.pdf');
  });

  it('returns null when there is nothing scannable at all', async () => {
    expect(
      await scanAttachmentsForDeadline(
        [att({ mimeType: 'image/png', name: 'x.png' })],
        byFile({}),
      ),
    ).toBeNull();
  });
});
