// VoDZ downloads on the wire (018 T015).
//
// The enclosures and the signed original of a large-volume message are the only ISDS calls that do not
// go through `isdsTransport`: they stream to disk through react-native-blob-util. Until 2026-09-15 they
// carried no box session, always went to `ws2`, and rode RN's shared cookie jar - so an OTP or Mobile
// Key box's large message was fetched with whichever session the last login had left in it.
//
// The assertions are therefore about what is handed to blob-util, the last point JS controls: the URL,
// the headers, and the config that asks the native side to keep the jar out. What the native side then
// does with that config cannot run under jest, so the last suite pins the option to the patch that
// implements it on both platforms.

import { readFileSync } from 'fs';
import { join } from 'path';
import {
  vodzAttachmentDownloader,
  type VodzDownloadArgs,
} from '../../src/services/files/vodzAttachmentDownloader';
import { basicAuthHeader } from '../../src/services/isds/httpClient';
import { attachmentMessageDir } from '../../src/services/files/attachmentFileStore';

interface WireRequest {
  config: Record<string, unknown>;
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string;
}

interface WireAnswer {
  status: number;
  text: string;
  /** Every URL the request went through, as blob-util reports it. Defaults to the request's own. */
  redirects?: string[];
  headers?: Record<string, string>;
}

/** Every request handed to blob-util, and how the fake server answers it. */
const mockWire: {
  requests: WireRequest[];
  answer: (req: WireRequest) => WireAnswer;
  /** Holds a request's answer back until the promise returned settles; null answers at once. */
  hold: (req: WireRequest) => Promise<void> | null;
} = { requests: [], answer: () => ({ status: 500, text: '' }), hold: () => null };
/** The disk, as latin1 strings (one character per byte). */
const mockDisk = new Map<string, string>();
/**
 * A disk that stops taking writes - full, or pulled away mid-decode - and one that refuses to move a
 * file whose path ends with one of `move`: a rename refused, the storage gone between decode and move.
 */
const mockFaults: { append: boolean; move: string[] } = { append: false, move: [] };
const mockLatin1FromBase64 = (b64: string): string =>
  Buffer.from(b64, 'base64').toString('latin1');

jest.mock('react-native-blob-util', () => ({
  __esModule: true,
  default: {
    fs: {
      dirs: { CacheDir: '/cache', DocumentDir: '/docs' },
      exists: async (path: string) =>
        mockDisk.has(path) || [...mockDisk.keys()].some(k => k.startsWith(`${path}/`)),
      mkdir: async () => {},
      unlink: async (path: string) => {
        mockDisk.delete(path);
      },
      stat: async (path: string) => {
        const content = mockDisk.get(path);
        if (content == null) {
          throw new Error(`ENOENT: ${path}`);
        }
        return { size: content.length };
      },
      slice: async (src: string, dest: string, start: number, end: number) => {
        mockDisk.set(dest, (mockDisk.get(src) ?? '').slice(start, end));
      },
      readFile: async (path: string, encoding: string) => {
        const content = mockDisk.get(path);
        if (content == null) {
          throw new Error(`ENOENT: ${path}`);
        }
        return encoding === 'ascii' ? [...content].map(c => c.charCodeAt(0) & 0xff) : content;
      },
      appendFile: async (path: string, data: string, encoding: string) => {
        if (mockFaults.append) {
          throw new Error('ENOSPC: no space left on device');
        }
        const bytes = encoding === 'base64' ? mockLatin1FromBase64(data) : data;
        mockDisk.set(path, (mockDisk.get(path) ?? '') + bytes);
      },
      mv: async (from: string, to: string) => {
        if (mockFaults.move.some(suffix => from.endsWith(suffix))) {
          throw new Error(`mv failed: ${from}`);
        }
        // Neither platform moves a file that is not there, and iOS will not move onto one that is.
        if (!mockDisk.has(from) || mockDisk.has(to)) {
          throw new Error(`mv refused: ${from} -> ${to}`);
        }
        mockDisk.set(to, mockDisk.get(from) ?? '');
        mockDisk.delete(from);
      },
    },
    config: (config: Record<string, unknown>) => ({
      fetch: (method: string, url: string, headers: Record<string, string>, body: string) => {
        const req = { config, method, url, headers, body };
        mockWire.requests.push(req);
        const answer = mockWire.answer(req);
        const target = String(config.path);
        const task = (mockWire.hold(req) ?? Promise.resolve()).then(() => {
          mockDisk.set(target, answer.text);
          return {
            path: () => target,
            info: () => ({
              status: answer.status,
              redirects: answer.redirects ?? [url],
              headers: answer.headers ?? {},
            }),
          };
        });
        return Object.assign(task, { cancel: () => {} });
      },
    }),
  },
}));

const PORTAL_VODZ = 'https://www.datovka.gov.cz/apps/DS/vodz';
const TEST_PORTAL_VODZ = 'https://www.datovka-test.gov.cz/apps/DS/vodz';
const WS2_VODZ = 'https://ws2.datovka.gov.cz/DS/vodz';

const envelope = (inner: string): string =>
  '<?xml version="1.0" encoding="UTF-8"?>' +
  '<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/"><SOAP-ENV:Body>' +
  inner +
  '</SOAP-ENV:Body></SOAP-ENV:Envelope>';
const status = (code: string): string =>
  `<q:dmStatus><q:dmStatusCode>${code}</q:dmStatusCode><q:dmStatusMessage>x</q:dmStatusMessage></q:dmStatus>`;

/** `DownloadAttachmentResponse` carrying one enclosure inline, as bulletin 2175 §3.6.2 shows it. */
const enclosure = (name: string, content: string): string =>
  envelope(
    '<q:DownloadAttachmentResponse xmlns:q="http://isds.czechpoint.cz/v20">' +
      `<q:dmFile xmlns:p="http://isds.czechpoint.cz/v20" dmFileMetaType="main" dmFileDescr="${name}" dmMimeType="application/pdf">` +
      `<p:dmEncodedContent>${Buffer.from(content, 'latin1').toString('base64')}</p:dmEncodedContent></q:dmFile>` +
      status('0000') +
      '</q:DownloadAttachmentResponse>',
  );
const refusal = (op: string, code: string): string =>
  envelope(`<q:${op}Response xmlns:q="http://isds.czechpoint.cz/v20">${status(code)}</q:${op}Response>`);
const bigOriginal = (op: string, bytes: string): string =>
  envelope(
    `<q:${op}Response xmlns:q="http://isds.czechpoint.cz/v20">` +
      `<q:dmSignature>${Buffer.from(bytes, 'latin1').toString('base64')}</q:dmSignature>` +
      status('0000') +
      `</q:${op}Response>`,
  );

/** A server holding `count` enclosures: 1299 past the last, as czebox answers. */
const holding = (count: number) => (req: WireRequest) => {
  const attNum = Number(/<p:attNum>(\d+)<\/p:attNum>/.exec(req.body)?.[1] ?? -1);
  return attNum < count
    ? { status: 200, text: enclosure(`priloha-${attNum}.pdf`, `obsah ${attNum}`) }
    : { status: 200, text: refusal('DownloadAttachment', '1299') };
};

const args = (over: Partial<VodzDownloadArgs> = {}): VodzDownloadArgs => ({
  host: 'production',
  authMethod: 'otp_totp',
  loginName: 'boxA',
  password: null,
  sessionCookie: 'IPCZ-X-COOKIE=AAA',
  boxId: 'b1',
  messageId: '9',
  signal: new AbortController().signal,
  ...over,
});

const attNumOf = (req: WireRequest) => /<p:attNum>(\d+)<\/p:attNum>/.exec(req.body)?.[1];

/** What a download leaves in a message's directory only while it runs. */
const scratch = () =>
  [...mockDisk.keys()].filter(
    path => path.endsWith('.part') || path.endsWith('.tmp') || path.endsWith('.old'),
  );

/** Holds the answer to the next request until `release` is called; every later request answers at once. */
const holdNext = () => {
  let release: () => void = () => {};
  const gate = new Promise<void>(resolve => {
    release = resolve;
  });
  let used = false;
  mockWire.hold = () => {
    if (used) {
      return null;
    }
    used = true;
    return gate;
  };
  return { release: () => release() };
};

/** Lets every step a download can take without an answer from the server run. */
const settle = async () => {
  for (let turn = 0; turn < 5; turn++) {
    await new Promise(resolve => setImmediate(resolve));
  }
};

beforeEach(() => {
  mockWire.requests = [];
  mockWire.answer = () => ({ status: 500, text: '' });
  mockWire.hold = () => null;
  mockDisk.clear();
  mockFaults.append = false;
  mockFaults.move = [];
});

describe('a VoDZ enclosure download carries its own box session, and only that', () => {
  it.each(['otp_totp', 'mobile_key'] as const)(
    'a %s box fetches every enclosure from the portal with its own cookie, the shared jar kept out',
    async authMethod => {
      mockWire.answer = holding(2);
      const result = await vodzAttachmentDownloader.download(args({ authMethod }));
      expect(result).toMatchObject({ type: 'attachments', attachments: [{}, {}] });
      expect(
        mockWire.requests.map(r => [
          attNumOf(r),
          r.method,
          r.url,
          r.headers.Cookie,
          r.headers.Authorization,
          r.config.omitCookies,
        ]),
      ).toEqual([
        ['0', 'POST', PORTAL_VODZ, 'IPCZ-X-COOKIE=AAA', undefined, true],
        ['1', 'POST', PORTAL_VODZ, 'IPCZ-X-COOKIE=AAA', undefined, true],
        ['2', 'POST', PORTAL_VODZ, 'IPCZ-X-COOKIE=AAA', undefined, true],
      ]);
    },
  );

  it('keeps HTTP Basic on ws2 for a password box, sends no cookie, and still keeps the jar out', async () => {
    mockWire.answer = holding(1);
    const result = await vodzAttachmentDownloader.download(
      args({ authMethod: 'password', password: 'pw', sessionCookie: null }),
    );
    expect(result).toMatchObject({ type: 'attachments', attachments: [{ name: 'priloha-0.pdf' }] });
    expect(mockWire.requests).toHaveLength(2);
    for (const req of mockWire.requests) {
      expect(req.url).toBe(WS2_VODZ);
      expect(req.headers.Authorization).toBe(basicAuthHeader('boxA', 'pw'));
      expect(req.headers.Cookie).toBeUndefined();
      // A password box's request must not pick up a cookie box's session from the jar either.
      expect(req.config.omitCookies).toBe(true);
    }
  });

  it('keeps two boxes apart across consecutive downloads, each on its own environment', async () => {
    mockWire.answer = holding(1);
    await vodzAttachmentDownloader.download(args());
    await vodzAttachmentDownloader.download(
      args({ host: 'czebox', boxId: 'b2', sessionCookie: 'IPCZ-X-COOKIE=BBB' }),
    );
    expect(mockWire.requests.map(r => [r.url, r.headers.Cookie])).toEqual([
      [PORTAL_VODZ, 'IPCZ-X-COOKIE=AAA'],
      [PORTAL_VODZ, 'IPCZ-X-COOKIE=AAA'],
      [TEST_PORTAL_VODZ, 'IPCZ-X-COOKIE=BBB'],
      [TEST_PORTAL_VODZ, 'IPCZ-X-COOKIE=BBB'],
    ]);
  });

  it('refuses a cookie box with no session before anything reaches the network', async () => {
    mockWire.answer = holding(1);
    const noSession = args({ sessionCookie: null });
    expect(await vodzAttachmentDownloader.download(noSession)).toEqual({ type: 'authFault' });
    expect(
      await vodzAttachmentDownloader.downloadSignedZfo({ ...noSession, sent: true }),
    ).toEqual({ type: 'authFault' });
    expect(mockWire.requests).toEqual([]);
  });

  it('reads a cookie box’s 200 with no XML at all as a lost session, and a password box’s as a fault', async () => {
    // ISDS answers a dead session cookie with HTTP 200 and whitespace (018 FR-006).
    mockWire.answer = () => ({ status: 200, text: '\n   \n     \n   \n' });
    expect(await vodzAttachmentDownloader.download(args())).toEqual({ type: 'authFault' });
    expect(
      await vodzAttachmentDownloader.download(
        args({ authMethod: 'password', password: 'pw', sessionCookie: null }),
      ),
    ).toEqual({ type: 'serverFault' });
  });

  it('reads 1219 on the first enclosure as a deletion, and any other refusal as a failure to retry', async () => {
    mockWire.answer = () => ({ status: 200, text: refusal('DownloadAttachment', '1219') });
    expect(await vodzAttachmentDownloader.download(args())).toEqual({ type: 'gone' });
    // 3013: "Práce s Velkoobjemovou datovou zprávou je dočasně pozastavena, zkuste operaci opakovat později."
    mockWire.answer = () => ({ status: 200, text: refusal('DownloadAttachment', '3013') });
    expect(await vodzAttachmentDownloader.download(args())).toEqual({ type: 'serverFault' });
  });
});

// The portal's other lost-session answer (018 FR-006, amended 2026-09-15): `/apps/DS/vodz` redirects a
// request without a session to `as/login?...&status=NCOO` (018 T006), and blob-util follows it. The
// page then sat in the response file as a 200 with markup and read as a fault - "try again" in place of
// the re-auth strip.
describe('a cookie box the portal turns away to its sign-in page', () => {
  const SIGN_IN = 'https://www.datovka.gov.cz/as/login?status=NCOO';
  /** Illustrative, not a capture: no sign-in page body has been recorded, and none is read. */
  const SIGN_IN_PAGE =
    '<!DOCTYPE html><html lang="cs"><head><title>Přihlášení</title></head><body><form/></body></html>';
  const followed = (req: WireRequest): WireAnswer => ({
    status: 200,
    text: SIGN_IN_PAGE,
    redirects: [req.url, SIGN_IN],
  });

  it.each(['otp_totp', 'mobile_key'] as const)(
    'a %s box reads a followed redirect on an enclosure as a lost session, not a failure to retry',
    async authMethod => {
      mockWire.answer = followed;
      expect(await vodzAttachmentDownloader.download(args({ authMethod }))).toEqual({
        type: 'authFault',
      });
    },
  );

  it('reads it the same way on the signed original, and writes no file', async () => {
    mockWire.answer = followed;
    for (const sent of [false, true]) {
      expect(await vodzAttachmentDownloader.downloadSignedZfo({ ...args(), sent })).toEqual({
        type: 'authFault',
      });
    }
    expect([...mockDisk.keys()].filter(path => path.endsWith('.zfo'))).toEqual([]);
  });

  it('reads a redirect that came back unfollowed the same way', async () => {
    mockWire.answer = () => ({ status: 302, text: '', headers: { Location: '/as/login?status=NCOO' } });
    expect(await vodzAttachmentDownloader.download(args())).toEqual({ type: 'authFault' });
    expect(await vodzAttachmentDownloader.downloadSignedZfo({ ...args(), sent: false })).toEqual({
      type: 'authFault',
    });
  });

  it('leaves the same page a fault for a password box, which has no session to renew', async () => {
    mockWire.answer = followed;
    // The same answer to a cookie box is a lost session; to a password box it is only a fault.
    expect(await vodzAttachmentDownloader.download(args())).toEqual({ type: 'authFault' });
    const password = args({ authMethod: 'password', password: 'pw', sessionCookie: null });
    expect(await vodzAttachmentDownloader.download(password)).toEqual({ type: 'serverFault' });
    expect(await vodzAttachmentDownloader.downloadSignedZfo({ ...password, sent: false })).toEqual({
      type: 'serverFault',
    });
  });
});

// Constitution IV (2026-09-15). A walk that stopped after some enclosures arrived used to return them as
// the whole message: the missing ones were recorded nowhere, and the message looked complete.
describe('an enclosure walk that stops part-way', () => {
  /** A server holding four enclosures that answers `stop` in place of enclosure `at`. */
  const stoppingAt =
    (at: number, stop: WireAnswer) =>
    (req: WireRequest): WireAnswer =>
      Number(attNumOf(req)) === at ? stop : holding(4)(req);

  it.each([
    ['a server fault', { status: 500, text: '' }, 'serverFault'],
    // 3013: "Práce s Velkoobjemovou datovou zprávou je dočasně pozastavena, zkuste operaci opakovat později."
    ['a paused large-volume service (3013)', { status: 200, text: refusal('DownloadAttachment', '3013') }, 'serverFault'],
    ['ISDS reporting a deletion half-way (1219)', { status: 200, text: refusal('DownloadAttachment', '1219') }, 'gone'],
    ['a lost session', { status: 200, text: '  \n  ' }, 'authFault'],
  ])('keeps what arrived before %s, and says which enclosure is the first missing', async (_why, stop, stopped) => {
    mockWire.answer = stoppingAt(2, stop);
    const result = await vodzAttachmentDownloader.download(args());
    expect(result).toMatchObject({
      type: 'partial',
      missingFrom: 2,
      stopped,
      attachments: [{ name: 'priloha-0.pdf' }, { name: 'priloha-1.pdf' }],
    });
    // Nothing asked for past the stop, both files whole on disk, no scratch left behind.
    expect(mockWire.requests.map(attNumOf)).toEqual(['0', '1', '2']);
    const paths = result.type === 'partial' ? result.attachments.map(a => a.localPath ?? '') : [];
    expect(paths.map(path => mockDisk.get(path))).toEqual(['obsah 0', 'obsah 1']);
    expect(scratch()).toEqual([]);
  });

  it('resumes at the first missing enclosure, never asking for or writing one the archive holds', async () => {
    const dir = attachmentMessageDir('b1', '9');
    mockDisk.set(`${dir}/0_priloha-0.pdf`, 'held 0');
    mockDisk.set(`${dir}/1_priloha-1.pdf`, 'held 1');
    mockWire.answer = holding(4);
    const result = await vodzAttachmentDownloader.download({ ...args(), from: 2 });
    expect(result).toMatchObject({
      type: 'attachments',
      attachments: [{ name: 'priloha-2.pdf' }, { name: 'priloha-3.pdf' }],
    });
    expect(result).not.toMatchObject({ attachments: [{ name: 'priloha-0.pdf' }] });
    expect(mockWire.requests.map(attNumOf)).toEqual(['2', '3', '4']);
    expect(mockDisk.get(`${dir}/0_priloha-0.pdf`)).toBe('held 0');
    expect(mockDisk.get(`${dir}/1_priloha-1.pdf`)).toBe('held 1');

    // ISDS answering 1219 to the first enclosure a resumed walk asks for is the same answer it is on a
    // first walk: nothing arrived in it, so the controller decides what it means.
    mockWire.requests = [];
    mockWire.answer = () => ({ status: 200, text: refusal('DownloadAttachment', '1219') });
    expect(await vodzAttachmentDownloader.download({ ...args(), from: 2 })).toEqual({ type: 'gone' });
    expect(mockWire.requests.map(attNumOf)).toEqual(['2']);
  });

  it('never removes a file already in place for a decode that fails', async () => {
    const dir = attachmentMessageDir('b1', '9');
    mockDisk.set(`${dir}/0_priloha-0.pdf`, 'the copy from last week');
    mockWire.answer = holding(1);
    mockFaults.append = true;
    expect(await vodzAttachmentDownloader.download(args())).toEqual({ type: 'serverFault' });
    expect(mockDisk.get(`${dir}/0_priloha-0.pdf`)).toBe('the copy from last week');
    expect(scratch()).toEqual([]);
  });

  it('keeps the copy already in place when the finished file cannot be moved over it', async () => {
    // Until 2026-09-15 the copy under the name was unlinked before the move, and the `.part` removed
    // after a move that failed: a refused rename left the enclosure on neither path.
    const path = `${attachmentMessageDir('b1', '9')}/0_priloha-0.pdf`;
    mockDisk.set(path, 'the copy from last week');
    mockWire.answer = holding(1);
    mockFaults.move = ['.part'];
    expect(await vodzAttachmentDownloader.download(args())).toEqual({ type: 'serverFault' });
    expect(mockDisk.get(path)).toBe('the copy from last week');
    expect(scratch()).toEqual([]);

    // The next download that can move it replaces the copy, and leaves nothing beside it.
    mockFaults.move = [];
    expect(await vodzAttachmentDownloader.download(args())).toMatchObject({ type: 'attachments' });
    expect(mockDisk.get(path)).toBe('obsah 0');
    expect(scratch()).toEqual([]);
  });

  it('leaves that copy aside, never removed, when it cannot be put back either', async () => {
    const path = `${attachmentMessageDir('b1', '9')}/0_priloha-0.pdf`;
    mockDisk.set(path, 'the copy from last week');
    mockWire.answer = holding(1);
    mockFaults.move = ['.part', '.old'];
    expect(await vodzAttachmentDownloader.download(args())).toEqual({ type: 'serverFault' });
    expect(mockDisk.get(`${path}.old`)).toBe('the copy from last week');

    // A later download that goes through puts the new copy in and clears what was left aside.
    mockFaults.move = [];
    expect(await vodzAttachmentDownloader.download(args())).toMatchObject({ type: 'attachments' });
    expect(mockDisk.get(path)).toBe('obsah 0');
    expect(scratch()).toEqual([]);
  });

  it('never calls a walk that ran into its safety cap complete', async () => {
    mockWire.answer = holding(1000);
    expect(await vodzAttachmentDownloader.download(args())).toMatchObject({
      type: 'partial',
      missingFrom: 64,
      stopped: 'serverFault',
    });
  });
});

// 2026-09-15. Two downloads of one message ran side by side, decoding the same enclosure into the same
// `.part` and `.resp-N.tmp` and removing each other's. One detail screen can start two: a second press
// before its busy state renders, or a download after coming back while the one leaving cancelled is
// still decoding.
describe('two downloads of one message at once', () => {
  const file = `${attachmentMessageDir('b1', '9')}/0_priloha-0.pdf`;
  const sessionAndAttNum = (req: WireRequest) => `${req.headers.Cookie}:${attNumOf(req)}`;

  it('lets the second wait for the first, and both end with the file whole', async () => {
    mockWire.answer = holding(1);
    const gate = holdNext();
    const first = vodzAttachmentDownloader.download(args());
    await settle();
    const second = vodzAttachmentDownloader.download(args());
    // Another box's message with the same number is a different directory, and waits for nobody.
    const other = vodzAttachmentDownloader.download(
      args({ boxId: 'b2', sessionCookie: 'IPCZ-X-COOKIE=BBB' }),
    );
    expect(await other).toMatchObject({ type: 'attachments', attachments: [{ name: 'priloha-0.pdf' }] });
    expect(mockWire.requests.map(sessionAndAttNum)).toEqual([
      'IPCZ-X-COOKIE=AAA:0',
      'IPCZ-X-COOKIE=BBB:0',
      'IPCZ-X-COOKIE=BBB:1',
    ]);

    gate.release();
    for (const result of await Promise.all([first, second])) {
      expect(result).toMatchObject({ type: 'attachments', attachments: [{ localPath: file }] });
    }
    // The first to its end, then the second from its start.
    expect(mockWire.requests.map(sessionAndAttNum).slice(3)).toEqual([
      'IPCZ-X-COOKIE=AAA:1',
      'IPCZ-X-COOKIE=AAA:0',
      'IPCZ-X-COOKIE=AAA:1',
    ]);
    expect(mockDisk.get(file)).toBe('obsah 0');
    expect(scratch()).toEqual([]);
  });

  it('lets the signed original of the message wait for its enclosures too', async () => {
    mockWire.answer = req =>
      req.body.includes('<p:SignedBigMessageDownload>')
        ? { status: 200, text: bigOriginal('SignedBigMessageDownload', 'ZFO bytes') }
        : holding(1)(req);
    const gate = holdNext();
    const walk = vodzAttachmentDownloader.download(args());
    await settle();
    const original = vodzAttachmentDownloader.downloadSignedZfo({ ...args(), sent: false });
    await settle();
    expect(mockWire.requests.map(attNumOf)).toEqual(['0']);

    gate.release();
    expect(await walk).toMatchObject({ type: 'attachments' });
    expect(await original).toMatchObject({ type: 'zfo' });
    expect(mockWire.requests.map(req => attNumOf(req) ?? 'original')).toEqual(['0', '1', 'original']);
  });

  it('lets a download cancelled while it waits go at once, holding up nobody behind it', async () => {
    mockWire.answer = holding(1);
    const gate = holdNext();
    const first = vodzAttachmentDownloader.download(args());
    await settle();
    const leaving = new AbortController();
    const cancelled = vodzAttachmentDownloader.download(args({ signal: leaving.signal }));
    const third = vodzAttachmentDownloader.download(args());
    leaving.abort();
    await expect(cancelled).rejects.toMatchObject({ name: 'AbortError' });
    // The third still waits: the first is still out.
    await settle();
    expect(mockWire.requests.map(attNumOf)).toEqual(['0']);

    gate.release();
    expect(await first).toMatchObject({ type: 'attachments' });
    expect(await third).toMatchObject({ type: 'attachments' });
    expect(mockWire.requests.map(attNumOf)).toEqual(['0', '1', '0', '1']);
  });

  it('asks for no further enclosure once cancelled, even when the cancel came after an answer', async () => {
    // A cancel reached only a request still out. One that came while an enclosure was decoding let the
    // walk ask for every enclosure left, for a screen that had gone - and would hold up the next download.
    mockWire.answer = holding(3);
    const leaving = new AbortController();
    const gate = holdNext();
    const walk = vodzAttachmentDownloader.download(args({ signal: leaving.signal }));
    await settle();
    leaving.abort();
    gate.release();
    await expect(walk).rejects.toMatchObject({ name: 'AbortError' });
    expect(mockWire.requests.map(attNumOf)).toEqual(['0']);

    expect(await vodzAttachmentDownloader.download(args())).toMatchObject({
      type: 'attachments',
      attachments: [{}, {}, {}],
    });
  });
});

describe('a VoDZ signed original follows the same rule', () => {
  it.each([
    [false, 'SignedBigMessageDownload'],
    [true, 'SignedSentBigMessageDownload'],
  ])('sent: %s - %s goes to the portal with the box cookie, the jar kept out', async (sent, op) => {
    mockWire.answer = () => ({ status: 200, text: bigOriginal(op, 'ZFO bytes') });
    const result = await vodzAttachmentDownloader.downloadSignedZfo({ ...args(), sent });
    expect(result).toMatchObject({ type: 'zfo', original: { fileName: 'DZ_9.zfo' } });
    expect(mockWire.requests).toHaveLength(1);
    const [req] = mockWire.requests;
    expect([req.url, req.headers.Cookie, req.headers.Authorization, req.config.omitCookies]).toEqual(
      [PORTAL_VODZ, 'IPCZ-X-COOKIE=AAA', undefined, true],
    );
    expect(req.body).toContain(`<p:${op}>`);
    if (result.type === 'zfo') {
      expect(mockDisk.get(result.original.localPath)).toBe('ZFO bytes');
    }
  });

  it('keeps HTTP Basic on ws2 for a password box, with no cookie and the jar kept out', async () => {
    mockWire.answer = () => ({ status: 200, text: bigOriginal('SignedBigMessageDownload', 'Z') });
    await vodzAttachmentDownloader.downloadSignedZfo({
      ...args({ authMethod: 'password', password: 'pw', sessionCookie: null }),
      sent: false,
    });
    const [req] = mockWire.requests;
    expect([req.url, req.headers.Cookie, req.headers.Authorization, req.config.omitCookies]).toEqual(
      [WS2_VODZ, undefined, basicAuthHeader('boxA', 'pw'), true],
    );
  });

  it('reads 1219 as a deletion and a dead cookie session as one', async () => {
    mockWire.answer = () => ({ status: 200, text: refusal('SignedBigMessageDownload', '1219') });
    expect(await vodzAttachmentDownloader.downloadSignedZfo({ ...args(), sent: false })).toEqual({
      type: 'gone',
    });
    mockWire.answer = () => ({ status: 200, text: '  \n  ' });
    expect(await vodzAttachmentDownloader.downloadSignedZfo({ ...args(), sent: false })).toEqual({
      type: 'authFault',
    });
  });
});

describe('the jar exclusion JS asks for is the one the native patch implements', () => {
  // A misspelt option would be ignored by the native side without a word, and the request would ride
  // the shared jar again while every assertion above still passed. This does not prove what OkHttp or
  // NSURLSession do at run time - that is a device walk (018 T015) - only that both platforms read the
  // option JS sends and act on it where the jar comes in.
  const patch = readFileSync(
    join(__dirname, '..', '..', 'patches', 'react-native-blob-util+0.24.9.patch'),
    'utf8',
  );

  it('sends exactly one option beyond the response path and timeout: omitCookies', async () => {
    mockWire.answer = holding(0);
    await vodzAttachmentDownloader.download(args());
    const extra = Object.keys(mockWire.requests[0].config).filter(
      key => key !== 'path' && key !== 'timeout',
    );
    expect(extra).toEqual(['omitCookies']);
  });

  it('is read on Android, and replaces the shared jar on the request’s OkHttp client', () => {
    expect(patch).toContain('options.hasKey("omitCookies") && options.getBoolean("omitCookies")');
    expect(patch).toContain('+import okhttp3.CookieJar;');
    expect(patch).toContain('+                clientBuilder.cookieJar(CookieJar.NO_COOKIES);');
    expect(patch).toContain('+                if (!this.options.omitCookies) {');
  });

  it('is read on iOS, and takes the shared cookie store out in both directions', () => {
    expect(patch).toContain('+    if ([[options valueForKey:@"omitCookies"] boolValue]) {');
    expect(patch).toContain('+        defaultConfigObject.HTTPCookieStorage = nil;');
    expect(patch).toContain('+        defaultConfigObject.HTTPShouldSetCookies = NO;');
    expect(patch).toContain(
      '+        defaultConfigObject.HTTPCookieAcceptPolicy = NSHTTPCookieAcceptPolicyNever;',
    );
    expect(patch).toContain(
      '+        if (response.URL && ![[self.options valueForKey:@"omitCookies"] boolValue]) {',
    );
  });
});
