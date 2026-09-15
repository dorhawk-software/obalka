// Importing a backup from a file whose name a person chose (006 T014).
//
// The picker copies the chosen file into the cache and answers with a PERCENT-ENCODED `file://` URI
// on both platforms (Android `Uri.fromFile(…).toString()`, iOS `URL.absoluteString`). The import used
// to strip only the scheme, so a backup renamed to "Záloha Obálky 15. září 2026.obalka" was read from
// `…/Z%C3%A1loha%20Ob%C3%A1lky…`, which names no file: the import failed with a generic "could not be
// read", and the copy of the archive stayed in the cache. The attachment picker had already been
// fixed for the same URI; this runs the REAL `portableIo` from the app's wiring, so a second copy of
// the scheme-stripping cannot come back unnoticed.
//
// The native side is the shared in-memory blob-util mock: a path that names no file is ENOENT, the
// way the real `readFile` behaves.

import RNBlobUtil from 'react-native-blob-util';
import { keepLocalCopy, pick, saveDocuments } from '@react-native-documents/picker';
import { portableIo } from '../../src/features/accounts/deps';

type Picked = Awaited<ReturnType<typeof pick>>;
type CopyResult = Awaited<ReturnType<typeof keepLocalCopy>>;

/** Varied bytes, so a read that returned the wrong file cannot match by accident. */
function archiveBytes(length: number): Uint8Array {
  const out = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    out[i] = (i * 31 + 7) % 256;
  }
  return out;
}

/** The system picker returning one file, and its cache copy answered with `localUri`. */
function pickerCopies(name: string, localUri: string) {
  const sourceUri = `content://com.android.providers.downloads.documents/document/42`;
  jest.mocked(pick).mockResolvedValue([
    {
      uri: sourceUri,
      name,
      type: 'application/octet-stream',
      nativeType: 'application/octet-stream',
      size: 0,
      error: null,
      isVirtual: false,
      convertibleToMimeTypes: null,
      hasRequestedType: true,
    },
  ] as unknown as Picked);
  jest
    .mocked(keepLocalCopy)
    .mockResolvedValue([{ status: 'success', sourceUri, localUri }] as CopyResult);
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('importing a backup file (portableIo.open)', () => {
  it('reads a backup whose Czech file name has spaces and diacritics', async () => {
    const name = 'Záloha Obálky 15. září 2026.obalka';
    const path = `/cache/${name}`;
    const bytes = archiveBytes(3 * 8192 + 5);
    await RNBlobUtil.fs.writeFile(path, Buffer.from(bytes).toString('base64'), 'base64');
    // Written out literally, as the native picker answers it - not derived from `name` in the test.
    pickerCopies(
      name,
      'file:///cache/Z%C3%A1loha%20Ob%C3%A1lky%2015.%20z%C3%A1%C5%99%C3%AD%202026.obalka',
    );

    const read = await portableIo.open();

    expect(read).not.toBeNull();
    expect(Buffer.from(read as Uint8Array).equals(Buffer.from(bytes))).toBe(true);
    expect(RNBlobUtil.fs.readFile).toHaveBeenCalledWith(path, 'base64');
  });

  it('removes the cache copy under its real name once it is read', async () => {
    const name = 'moje záloha.obalka';
    const path = `/cache/${name}`;
    await RNBlobUtil.fs.writeFile(path, Buffer.from(archiveBytes(10)).toString('base64'), 'base64');
    pickerCopies(name, 'file:///cache/moje%20z%C3%A1loha.obalka');

    await portableIo.open();

    // The copy is the user's archive; left behind, it sits in the cache where nobody will look.
    expect(RNBlobUtil.fs.unlink).toHaveBeenCalledWith(path);
    expect(await RNBlobUtil.fs.exists(path)).toBe(false);
  });

  it('decodes a percent sign in the name once, not twice', async () => {
    // The picker writes a literal "%" as `%25`. Stripping the scheme leaves `%25` in the path, and
    // decoding a second time reads "% h" as a broken escape and throws - both fail this import.
    const name = 'Záloha 100% hotová.obalka';
    const path = `/cache/${name}`;
    const bytes = archiveBytes(100);
    await RNBlobUtil.fs.writeFile(path, Buffer.from(bytes).toString('base64'), 'base64');
    pickerCopies(name, 'file:///cache/Z%C3%A1loha%20100%25%20hotov%C3%A1.obalka');

    const read = await portableIo.open();

    expect(Buffer.from(read as Uint8Array).equals(Buffer.from(bytes))).toBe(true);
  });
});

describe('a copy whose URI will not decode (2026-09-15)', () => {
  it('still removes the cache copy, and still fails the import', async () => {
    // The decode ran before the `try` whose `finally` removes the copy, so a malformed escape threw
    // past the cleanup and left the copy of the archive in the cache.
    const path = '/cache/bad%E0%A4%A.obalka';
    await RNBlobUtil.fs.writeFile(path, Buffer.from(archiveBytes(10)).toString('base64'), 'base64');
    pickerCopies('bad.obalka', `file://${path}`);

    await expect(portableIo.open()).rejects.toThrow(URIError);

    expect(await RNBlobUtil.fs.exists(path)).toBe(false);
  });
});

describe('exporting a backup file (portableIo.save, 2026-09-15)', () => {
  it('hands the sheet a percent-encoded URI, and removes what it staged', async () => {
    // The staged path was pasted after `file://`, so a name with "#" or "%" could not be saved.
    const name = 'Záloha #3 100%.obalka';

    expect(await portableIo.save(name, archiveBytes(40))).toBe(true);

    expect(saveDocuments).toHaveBeenCalledTimes(1);
    expect(jest.mocked(saveDocuments).mock.calls[0][0]).toMatchObject({
      sourceUris: ['file:///cache/Z%C3%A1loha%20%233%20100%25.obalka'],
      fileName: name,
      copy: true,
    });
    expect(await RNBlobUtil.fs.exists(`/cache/${name}`)).toBe(false);
  });
});
