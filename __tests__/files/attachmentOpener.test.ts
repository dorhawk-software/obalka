// Handing a message's signed original to the user (004 amendment, 2026-09-14).
//
// The existing open path first - on iOS it already turns a .zfo into the share sheet - and the system
// save sheet where Android has no app for the type, because "no app can open this" is the wrong answer
// for a file whose whole point is to be kept or passed on.

import { saveDocuments } from '@react-native-documents/picker';
import {
  NoViewerError,
  attachmentOpener,
  openSignedOriginal,
  type AttachmentOpener,
} from '../../src/services/files/attachmentOpener';
import { localCopyPath } from '../../src/services/files/localCopyPath';

const ZFO = 'application/vnd.software602.filler.form-xml-zip';
const original = {
  fileName: 'DZ_1234567.zfo',
  localPath: '/docs/attachments/box1/1234567/DZ_1234567.zfo',
  size: 2048,
};

function opener(open: () => Promise<void>, saved = true) {
  const fake: AttachmentOpener = {
    open: jest.fn(open),
    save: jest.fn(async () => saved),
  };
  return fake;
}

describe('opening a signed original', () => {
  it('opens the file on disk as a .zfo where an app can, and saves nothing', async () => {
    const fake = opener(async () => {});
    expect(await openSignedOriginal(fake, original)).toBe('opened');
    expect(fake.open).toHaveBeenCalledWith(
      expect.objectContaining({ localPath: original.localPath, mimeType: ZFO, name: 'DZ_1234567.zfo' }),
    );
    expect(fake.save).not.toHaveBeenCalled();
  });

  it('hands it to the save sheet where no app can open it', async () => {
    const fake = opener(async () => {
      throw new NoViewerError();
    });
    expect(await openSignedOriginal(fake, original)).toBe('saved');
    expect(fake.save).toHaveBeenCalledWith(original.localPath, 'DZ_1234567.zfo', ZFO);
  });

  it('says so when the user dismissed the sheet', async () => {
    const fake = opener(async () => {
      throw new NoViewerError();
    }, false);
    expect(await openSignedOriginal(fake, original)).toBe('dismissed');
  });

  it('passes any other failure on, for the screen to say', async () => {
    const fake = opener(async () => {
      throw new Error('disk gone');
    });
    await expect(openSignedOriginal(fake, original)).rejects.toThrow('disk gone');
    expect(fake.save).not.toHaveBeenCalled();
  });
});

describe('saving through the system sheet (2026-09-15)', () => {
  // The real opener, with the picker's jest mock standing in for the native sheet, which PARSES the URI.
  // With the path pasted in raw, "#3 100%.pdf" became a fragment on Android and a nil URL on iOS.
  beforeEach(() => {
    jest.mocked(saveDocuments).mockClear();
  });

  it('hands the sheet a percent-encoded URI for a name with a hash, a percent sign and diacritics', async () => {
    const path = '/docs/attachments/box1/42/Rozhodnutí #3 100%.pdf';

    expect(await attachmentOpener.save(path, 'Rozhodnutí #3 100%.pdf', 'application/pdf')).toBe(
      true,
    );

    expect(saveDocuments).toHaveBeenCalledTimes(1);
    const options = jest.mocked(saveDocuments).mock.calls[0][0];
    expect(options.sourceUris).toEqual([
      'file:///docs/attachments/box1/42/Rozhodnut%C3%AD%20%233%20100%25.pdf',
    ]);
    // And it names the file that was asked for, not a shorter one.
    expect(localCopyPath(options.sourceUris[0])).toBe(path);
    expect(options).toMatchObject({ fileName: 'Rozhodnutí #3 100%.pdf', copy: true });
  });
});
