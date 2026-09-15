// Picking attachments (005 T006): a cap before any bytes are read, then a chunked read the person can
// watch and stop.
//
// The picker used to call `readFile(path, 'base64')` on every picked file: one native call per file,
// no size check until Send, nothing to show while it ran and no way to stop it. Everything here is
// about what replaced that - and about the one property that is invisible when it breaks: the chunks
// the native reader hands over must join into EXACTLY the file's base64, or a document goes out
// corrupt while looking attached.
//
// The native side is faked the way both platforms behave (react-native-blob-util 0.24): every buffer
// is base64-encoded ON ITS OWN, one `data` event per buffer, then `end` - and iOS sends `end` even
// after an `error`.

import RNBlobUtil from 'react-native-blob-util';
import { keepLocalCopy, pick } from '@react-native-documents/picker';
import {
  pickDocuments,
  type PickOutcome,
  type ReadProgress,
} from '../../src/services/files/attachmentPicker';
import { READ_CHUNK_BYTES } from '../../src/services/files/base64Stream';
import { VODZ_MAX_BYTES } from '../../src/features/messages/state/costModel';

jest.mock('@react-native-documents/picker', () => ({
  pick: jest.fn(),
  keepLocalCopy: jest.fn(),
  errorCodes: { OPERATION_CANCELED: 'OPERATION_CANCELED' },
  isErrorWithCode: (e: unknown) => typeof e === 'object' && e != null && 'code' in e,
}));

const MB = 1024 * 1024;

/** The app's cache as the native side sees it once a file is copied: path → bytes. */
const disk = new Map<string, Buffer>();
/** Sizes `stat` reports without a real buffer behind them (a 100 MB file is not worth allocating). */
const statSize = new Map<string, number>();

/** Varied bytes - not all zero, so a misaligned join cannot pass by accident. */
function bytesOf(length: number): Buffer {
  const out = Buffer.alloc(length);
  let x = 0x2545f491;
  for (let i = 0; i < length; i++) {
    x = (x * 1103515245 + 12345) >>> 0;
    out[i] = x >>> 24;
  }
  return out;
}

const tick = () => new Promise<void>(resolve => setTimeout(resolve, 0));

interface Handlers {
  data: (chunk: string | number[]) => void;
  end: () => void;
  error: (err: unknown) => void;
}

/** How a fake stream behaves once opened. */
type Script = (h: Handlers, bytes: Buffer, bufferSize: number) => void | Promise<void>;

/** What both native readers do: encode each buffer on its own, one event per buffer, then `end`. */
const nativeLike: Script = async (h, bytes, size) => {
  for (let i = 0; i < bytes.length; i += size) {
    await tick();
    h.data(bytes.subarray(i, i + size).toString('base64'));
  }
  await tick();
  h.end();
};

let script: Script = nativeLike;

const readStream = jest.fn(async (path: string, _encoding: string, bufferSize: number) => {
  const h: Handlers = { data: () => {}, end: () => {}, error: () => {} };
  return {
    path,
    encoding: 'base64',
    bufferSize,
    tick: 10,
    closed: false,
    open: () => {
      const bytes = disk.get(path);
      if (bytes == null) {
        // Both native readers answer a path that names no file with an `error` event (iOS: then `end`).
        void tick().then(() => {
          h.error(new Error(`ENOENT: ${path}`));
          h.end();
        });
        return;
      }
      void script(h, bytes, bufferSize);
    },
    onData: (fn: Handlers['data']) => {
      h.data = fn;
    },
    onEnd: (fn: Handlers['end']) => {
      h.end = fn;
    },
    onError: (fn: Handlers['error']) => {
      h.error = fn;
    },
  };
});
// The shared mock has no streams; this suite is the only one that reads one.
RNBlobUtil.fs.readStream = readStream as unknown as typeof RNBlobUtil.fs.readStream;

interface PickedFile {
  name: string;
  bytes: Buffer;
  /** What the picker claims. `undefined` = the real length; `null` = the picker does not know. */
  reported?: number | null;
}

function pickerReturns(files: readonly PickedFile[]) {
  for (const f of files) {
    disk.set(`/cache/${f.name}`, f.bytes);
  }
  jest.mocked(pick).mockResolvedValue(
    files.map(f => ({
      uri: `content://picked/${f.name}`,
      name: f.name,
      type: 'application/pdf',
      nativeType: 'application/pdf',
      size: f.reported === undefined ? f.bytes.length : f.reported,
      error: null,
      isVirtual: false,
      convertibleToMimeTypes: null,
      hasRequestedType: true,
    })) as unknown as Awaited<ReturnType<typeof pick>>,
  );
}

type CopyResult = Awaited<ReturnType<typeof keepLocalCopy>>;

/**
 * A successful copy, answered the way both native pickers answer it: a PERCENT-ENCODED file URI
 * (Android `Uri.fromFile(…).toString()`, iOS `URL.absoluteString`), not a path.
 */
function copied(fileName: string): CopyResult {
  return [
    {
      status: 'success',
      sourceUri: `content://picked/${fileName}`,
      localUri: `file:///cache/${encodeURIComponent(fileName)}`,
    },
  ];
}

/** Pick with a fresh signal, recording every progress report. */
function start(attachedBytes = 0) {
  const ctrl = new AbortController();
  const progress: ReadProgress[] = [];
  const outcome = pickDocuments({
    attachedBytes,
    signal: ctrl.signal,
    onProgress: p => progress.push(p),
  });
  return { ctrl, progress, outcome };
}

beforeEach(() => {
  jest.clearAllMocks();
  disk.clear();
  statSize.clear();
  script = nativeLike;
  jest
    .mocked(keepLocalCopy)
    .mockImplementation(async ({ files: [file] }) => copied(file.fileName));
  jest.mocked(RNBlobUtil.fs.stat).mockImplementation(async (path: string) => {
    const size = statSize.get(path) ?? disk.get(path)?.length;
    // Like the native stat: a path that names no file is an error, not a 0-byte file.
    if (size == null) {
      throw new Error(`ENOENT: ${path}`);
    }
    return { size } as Awaited<ReturnType<typeof RNBlobUtil.fs.stat>>;
  });
});

describe('the cap - refused before a byte is read', () => {
  it('refuses a pick that would take the message over the ISDS limit, without copying or reading', async () => {
    pickerReturns([{ name: 'video.mp4', bytes: bytesOf(10), reported: 41 * MB }]);
    const { progress, outcome } = start(60 * MB);

    expect(await outcome).toEqual({
      kind: 'tooLarge',
      messageBytes: 101 * MB,
      limitBytes: VODZ_MAX_BYTES,
    });
    expect(keepLocalCopy).not.toHaveBeenCalled();
    expect(readStream).not.toHaveBeenCalled();
    // Nothing started, so nothing to watch: the screen never flashes a progress row for a refusal.
    expect(progress).toEqual([]);
  });

  it('counts the message, not the file: the same pick fits a message with room, up to the limit itself', async () => {
    // The picker's claim lands exactly ON the limit (allowed); the copy's real size is what is read.
    pickerReturns([{ name: 'a.pdf', bytes: bytesOf(10), reported: 41 * MB }]);
    const { outcome } = start(VODZ_MAX_BYTES - 41 * MB);
    const out = await outcome;
    expect(out.kind).toBe('picked');
  });

  it('checks the real size on disk when the picker does not know it, and removes the copy it refuses', async () => {
    pickerReturns([{ name: 'cloud.pdf', bytes: bytesOf(10), reported: null }]);
    statSize.set('/cache/cloud.pdf', VODZ_MAX_BYTES + 1);
    const { outcome } = start(0);

    expect(await outcome).toEqual({
      kind: 'tooLarge',
      messageBytes: VODZ_MAX_BYTES + 1,
      limitBytes: VODZ_MAX_BYTES,
    });
    expect(readStream).not.toHaveBeenCalled();
    expect(RNBlobUtil.fs.unlink).toHaveBeenCalledWith('/cache/cloud.pdf');
  });
});

describe('the chunked read', () => {
  it('joins the chunks into exactly the file’s own base64, reading in multiple-of-3 buffers', async () => {
    // Two full chunks and a 2-byte tail: the tail is the one chunk that carries padding.
    const bytes = bytesOf(READ_CHUNK_BYTES * 2 + 2);
    pickerReturns([{ name: 'scan.pdf', bytes }]);
    const out = (await start().outcome) as Extract<PickOutcome, { kind: 'picked' }>;

    expect(readStream).toHaveBeenCalledWith(
      '/cache/scan.pdf',
      'base64',
      READ_CHUNK_BYTES,
      expect.any(Number),
    );
    expect(out.kind).toBe('picked');
    expect(out.documents).toHaveLength(1);
    const [doc] = out.documents;
    expect(doc.contentBase64).toBe(bytes.toString('base64'));
    expect(Buffer.from(doc.contentBase64, 'base64').equals(bytes)).toBe(true);
    expect(doc).toMatchObject({
      fileName: 'scan.pdf',
      mimeType: 'application/pdf',
      sizeBytes: bytes.length,
      isMain: false,
      localPath: '/cache/scan.pdf',
    });
  });

  it('reads a copy whose name has spaces and diacritics - the picker’s URI is percent-encoded', async () => {
    // A Czech file name, as people name their documents. The copy is on disk under its real name; the
    // picker reports it as `file:///cache/Smlouva%20o%20d%C3%ADlo%20%C4%8D.%202.pdf`.
    const name = 'Smlouva o dílo č. 2.pdf';
    const bytes = bytesOf(READ_CHUNK_BYTES + 1);
    pickerReturns([{ name, bytes }]);
    const out = (await start().outcome) as Extract<PickOutcome, { kind: 'picked' }>;

    expect(out.kind).toBe('picked');
    expect(RNBlobUtil.fs.stat).toHaveBeenCalledWith(`/cache/${name}`);
    expect(readStream).toHaveBeenCalledWith(
      `/cache/${name}`,
      'base64',
      READ_CHUNK_BYTES,
      expect.any(Number),
    );
    expect(out.documents[0]).toMatchObject({
      fileName: name,
      sizeBytes: bytes.length,
      localPath: `/cache/${name}`,
    });
    expect(out.documents[0].contentBase64).toBe(bytes.toString('base64'));
  });

  it('removes a copy whose URI will not decode, and fails the pick (2026-09-15)', async () => {
    // The decode ran before the copy was listed for cleanup, so its throw left the copy in the cache.
    const name = 'bad%E0%A4%A.pdf';
    pickerReturns([{ name, bytes: bytesOf(10) }]);
    jest.mocked(keepLocalCopy).mockResolvedValue([
      { status: 'success', sourceUri: `content://picked/${name}`, localUri: `file:///cache/${name}` },
    ] as CopyResult);

    expect(await start().outcome).toEqual({ kind: 'failed' });
    expect(readStream).not.toHaveBeenCalled();
    expect(RNBlobUtil.fs.unlink).toHaveBeenCalledWith(`/cache/${name}`);
  });

  it('reports real progress per chunk, across every file in the pick', async () => {
    const a = bytesOf(READ_CHUNK_BYTES + 5);
    const b = bytesOf(7);
    pickerReturns([
      { name: 'a.pdf', bytes: a },
      { name: 'b.pdf', bytes: b },
    ]);
    const { progress, outcome } = start();
    const out = await outcome;
    const total = a.length + b.length;

    expect(out.kind).toBe('picked');
    expect(progress).toEqual([
      { stage: 'copying', readBytes: 0, totalBytes: total },
      { stage: 'reading', readBytes: 0, totalBytes: total },
      { stage: 'reading', readBytes: READ_CHUNK_BYTES, totalBytes: total },
      { stage: 'reading', readBytes: a.length, totalBytes: total },
      { stage: 'reading', readBytes: total, totalBytes: total },
    ]);
  });

  it('never joins padding into the middle: a short read fails instead of attaching a corrupt document', async () => {
    pickerReturns([{ name: 'short.pdf', bytes: bytesOf(12) }]);
    // A 4-byte read ("…==") followed by more data - base64 no decoder would turn back into the file.
    script = async (h, bytes) => {
      await tick();
      h.data(bytes.subarray(0, 4).toString('base64'));
      await tick();
      h.data(bytes.subarray(4).toString('base64'));
      await tick();
      h.end();
    };
    expect(await start().outcome).toEqual({ kind: 'failed' });
    expect(RNBlobUtil.fs.unlink).toHaveBeenCalledWith('/cache/short.pdf');
  });

  it('fails rather than attach a file the stream did not carry whole', async () => {
    pickerReturns([{ name: 'cut.pdf', bytes: bytesOf(READ_CHUNK_BYTES + 3) }]);
    script = async (h, bytes, size) => {
      await tick();
      h.data(bytes.subarray(0, size).toString('base64'));
      await tick();
      h.end(); // …and the rest never came
    };
    expect(await start().outcome).toEqual({ kind: 'failed' });
  });

  it('fails on a read error and removes the copies; iOS’s `end` after the error changes nothing', async () => {
    pickerReturns([{ name: 'gone.pdf', bytes: bytesOf(30) }]);
    script = async h => {
      await tick();
      h.error(new Error('EIO'));
      h.end();
    };
    expect(await start().outcome).toEqual({ kind: 'failed' });
    expect(RNBlobUtil.fs.unlink).toHaveBeenCalledWith('/cache/gone.pdf');
  });

  it('fails the whole pick when one copy fails, instead of silently attaching the rest', async () => {
    pickerReturns([
      { name: 'ok.pdf', bytes: bytesOf(30) },
      { name: 'broken.pdf', bytes: bytesOf(30) },
    ]);
    jest.mocked(keepLocalCopy).mockImplementation(async ({ files: [file] }) =>
      file.fileName === 'broken.pdf'
        ? ([
            { status: 'error', sourceUri: file.uri, copyError: 'no access' },
          ] as CopyResult)
        : copied(file.fileName),
    );
    expect(await start().outcome).toEqual({ kind: 'failed' });
    expect(readStream).not.toHaveBeenCalled();
    expect(RNBlobUtil.fs.unlink).toHaveBeenCalledWith('/cache/ok.pdf');
  });
});

describe('cancel', () => {
  it('resolves at once mid-read, drops the partial read, and ignores the chunks still arriving', async () => {
    const bytes = bytesOf(READ_CHUNK_BYTES * 3);
    pickerReturns([{ name: 'big.pdf', bytes }]);
    let releaseRest: () => void = () => {};
    const rest = new Promise<void>(resolve => {
      releaseRest = resolve;
    });
    let sentRest = false;
    // The native loop cannot be stopped: it sends one chunk, and the rest only once the test says so.
    script = async (h, all, size) => {
      await tick();
      h.data(all.subarray(0, size).toString('base64'));
      await rest;
      for (let i = size; i < all.length; i += size) {
        h.data(all.subarray(i, i + size).toString('base64'));
      }
      h.end();
      sentRest = true;
    };
    const { ctrl, progress, outcome } = start();
    await waitUntil(() => progress.some(p => p.readBytes === READ_CHUNK_BYTES));

    ctrl.abort();
    // Not waiting for the rest of a file nobody wants any more.
    const settled = await Promise.race([
      outcome,
      new Promise(resolve => setTimeout(() => resolve('still waiting'), 200)),
    ]);
    expect(settled).toEqual({ kind: 'cancelled' });
    expect(RNBlobUtil.fs.unlink).toHaveBeenCalledWith('/cache/big.pdf');

    const reports = progress.length;
    releaseRest();
    await waitUntil(() => sentRest);
    expect(progress).toHaveLength(reports);
  });

  it('cancelled while the files are still copying, it never opens a read', async () => {
    pickerReturns([{ name: 'slow.pdf', bytes: bytesOf(30) }]);
    let finishCopy: () => void = () => {};
    jest.mocked(keepLocalCopy).mockImplementation(
      ({ files: [file] }) =>
        new Promise<CopyResult>(resolve => {
          finishCopy = () => resolve(copied(file.fileName));
        }),
    );
    const { ctrl, progress, outcome } = start();
    await waitUntil(() => progress.length > 0);
    expect(progress).toEqual([{ stage: 'copying', readBytes: 0, totalBytes: 30 }]);

    ctrl.abort();
    finishCopy();
    expect(await outcome).toEqual({ kind: 'cancelled' });
    expect(readStream).not.toHaveBeenCalled();
    expect(RNBlobUtil.fs.unlink).toHaveBeenCalledWith('/cache/slow.pdf');
  });
});

describe('the picker itself', () => {
  it('treats closing the picker as a choice, not a failure', async () => {
    jest.mocked(pick).mockRejectedValue({ code: 'OPERATION_CANCELED' });
    expect(await start().outcome).toEqual({ kind: 'dismissed' });
  });

  it('turns a picker error into a failure it can put into words, never a throw', async () => {
    jest.mocked(pick).mockRejectedValue(new Error('picker unavailable'));
    expect(await start().outcome).toEqual({ kind: 'failed' });
  });
});

async function waitUntil(condition: () => boolean): Promise<void> {
  for (let i = 0; i < 500 && !condition(); i++) {
    await tick();
  }
  expect(condition()).toBe(true);
}
