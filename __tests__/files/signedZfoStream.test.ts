// Streaming a large-volume message's signed original to disk (004 amendment, 2026-09-14).
//
// The blob-util half cannot run under jest. Everything that DECIDES something can: which answers are
// a session problem and which a refusal, where the body of `dmSignature` lies in a response that is
// only ever read at its two ends, and - the one that protects the archive - that a half-written
// original never sits under the real name, least of all over one that was already there.

import {
  signatureBody,
  streamSignedZfo,
  type SignedZfoRequest,
  type ZfoStreamIo,
} from '../../src/services/files/signedZfoStream';
import { noise } from '../helpers/signedFixtures';

/** A disk of latin1 strings and a server that answers once - and how the answer was reached. */
function memoryIo(answer: {
  status: number;
  text: string;
  urls?: string[];
  headers?: Record<string, string>;
}) {
  const files = new Map<string, string>();
  let failDecode = false;
  let failFetch: Error | null = null;
  /** Moves out of these paths fail, as a full or failing disk makes them. */
  const failMovesFrom = new Set<string>();
  /** Removals of these paths fail, as a file iOS will not let go of does. */
  const failRemovesOf = new Set<string>();
  const io: ZfoStreamIo = {
    fetchToFile: async (_url, _headers, _body, toPath) => {
      if (failFetch) {
        throw failFetch;
      }
      files.set(toPath, answer.text);
      return { status: answer.status, urls: answer.urls, headers: answer.headers };
    },
    size: async path => {
      const content = files.get(path);
      if (content == null) {
        throw new Error(`ENOENT: ${path}`);
      }
      return content.length;
    },
    readLatin1: async (path, start, end) => (files.get(path) ?? '').slice(start, end),
    decodeBase64Region: async (src, start, end, out) => {
      if (failDecode) {
        throw new Error('no space left on device');
      }
      const b64 = (files.get(src) ?? '').slice(start, end).replace(/[^A-Za-z0-9+/=]/g, '');
      files.set(out, (files.get(out) ?? '') + Buffer.from(b64, 'base64').toString('latin1'));
    },
    ensureDir: async () => {},
    exists: async path => files.has(path),
    move: async (from, to) => {
      const content = files.get(from);
      if (content == null) {
        throw new Error(`ENOENT: ${from}`);
      }
      if (failMovesFrom.has(from)) {
        throw new Error(`EIO: ${from}`);
      }
      // As iOS does: a move never writes over a file.
      if (files.has(to)) {
        throw new Error(`EEXIST: ${to}`);
      }
      files.set(to, content);
      files.delete(from);
    },
    remove: async path => {
      if (failRemovesOf.has(path)) {
        throw new Error(`EPERM: ${path}`);
      }
      files.delete(path);
    },
  };
  return {
    io,
    files,
    breakDecoding: () => {
      failDecode = true;
    },
    breakFetch: (e: Error) => {
      failFetch = e;
    },
    breakMovesFrom: (path: string) => {
      failMovesFrom.add(path);
    },
    breakRemovesOf: (path: string) => {
      failRemovesOf.add(path);
    },
  };
}

const DIR = '/docs/attachments/b1/9';
const FINAL = `${DIR}/DZ_9.zfo`;

const request = (over: Partial<SignedZfoRequest> = {}): SignedZfoRequest => ({
  url: 'https://ws2.datovka-test.gov.cz/DS/vodz',
  headers: {},
  body: '<p:SignedBigMessageDownload/>',
  dir: DIR,
  fileName: 'DZ_9.zfo',
  usesCookie: false,
  cancelled: () => false,
  ...over,
});

/** `SignedBigMessageDownloadResponse`, as `dmBaseTypes.xsd` defines it. */
const bigResponse = (signature: string | null, code = '0000'): string =>
  '<?xml version="1.0" encoding="UTF-8"?>' +
  '<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/"><SOAP-ENV:Body>' +
  '<p:SignedBigMessageDownloadResponse xmlns:p="http://isds.czechpoint.cz/v20">' +
  (signature == null ? '<p:dmSignature/>' : `<p:dmSignature>${signature}</p:dmSignature>`) +
  `<p:dmStatus><p:dmStatusCode>${code}</p:dmStatusCode>` +
  '<p:dmStatusMessage>Provedeno úspěšně.</p:dmStatusMessage></p:dmStatus>' +
  '</p:SignedBigMessageDownloadResponse></SOAP-ENV:Body></SOAP-ENV:Envelope>';

/** Well past the head and tail the stream reads, so the body is found from its two ends. */
const ORIGINAL = Buffer.from(noise(60_000, 4));
const SIGNATURE = ORIGINAL.toString('base64').replace(/(.{76})/g, '$1\n');

const scratch = (files: Map<string, string>) =>
  [...files.keys()].filter(k => k.endsWith('.part') || k.endsWith('.tmp'));

describe('streaming a VoDZ original to disk', () => {
  it('writes exactly the bytes ISDS signed, under the original s name, and leaves no scratch files', async () => {
    const { io, files } = memoryIo({ status: 200, text: bigResponse(SIGNATURE) });
    const result = await streamSignedZfo(io, request());
    expect(result).toEqual({
      type: 'zfo',
      original: { fileName: 'DZ_9.zfo', localPath: FINAL, size: ORIGINAL.length },
    });
    expect(Buffer.from(files.get(FINAL) as string, 'latin1').equals(ORIGINAL)).toBe(true);
    expect(scratch(files)).toEqual([]);
  });

  it('calls a 401 what it is - the session - and keeps nothing', async () => {
    const { io, files } = memoryIo({ status: 401, text: '' });
    expect(await streamSignedZfo(io, request())).toEqual({ type: 'authFault' });
    expect([...files.keys()]).toEqual([]);
  });

  it('reads 1219, and only 1219, as ISDS having deleted the message, writing no file', async () => {
    // The one code ISDS documents for a deleted message (004 research R8); only it may record the
    // message as gone. Until 2026-09-15 every non-0000 answer came back the same way, so a VoDZ service
    // paused under load (3013, "zkuste operaci opakovat později") recorded past 90 days lost a message
    // for good.
    const answers: Record<string, string> = {};
    for (const code of ['1219', '3013', '1222', '1211']) {
      const { io, files } = memoryIo({ status: 200, text: bigResponse(null, code) });
      answers[code] = (await streamSignedZfo(io, request())).type;
      expect(files.has(FINAL)).toBe(false);
    }
    expect(answers).toEqual({ '1219': 'gone', '3013': 'refused', '1222': 'refused', '1211': 'refused' });
  });

  it('calls a cookie box’s 200 with no XML at all a lost session, and a password box’s a fault', async () => {
    // ISDS answers a dead session cookie with HTTP 200 and whitespace (018 FR-006).
    const dead = '\n    \n      \n    \n';
    const cookie = memoryIo({ status: 200, text: dead });
    expect(await streamSignedZfo(cookie.io, request({ usesCookie: true }))).toEqual({
      type: 'authFault',
    });
    const basic = memoryIo({ status: 200, text: dead });
    expect(await streamSignedZfo(basic.io, request({ usesCookie: false }))).toEqual({
      type: 'serverFault',
    });
  });

  // The portal's other lost-session answer (018 FR-006, amended 2026-09-15): a request without a session
  // is sent to `as/login`, and blob-util follows the redirect, so the page lands in the response file as
  // a 200 with markup in it - which the "no XML" rule above cannot see.
  describe('a cookie request the portal turned away to its sign-in page', () => {
    const PORTAL = 'https://www.datovka.gov.cz/apps/DS/vodz';
    const SIGN_IN = 'https://www.datovka.gov.cz/as/login?status=NCOO';
    /** Illustrative, not a capture: no sign-in page body has been recorded, and none is read. */
    const PAGE = '<!DOCTYPE html><html><head><title>Přihlášení</title></head><body></body></html>';

    it('is a lost session when the redirect was followed, and writes no file', async () => {
      const { io, files } = memoryIo({ status: 200, text: PAGE, urls: [PORTAL, SIGN_IN] });
      expect(await streamSignedZfo(io, request({ usesCookie: true }))).toEqual({
        type: 'authFault',
      });
      expect(files.has(FINAL)).toBe(false);
      expect(scratch(files)).toEqual([]);
    });

    it('is a lost session when the redirect came back unfollowed', async () => {
      const { io } = memoryIo({
        status: 302,
        text: '',
        headers: { Location: '/as/login?status=NCOO' },
      });
      expect(await streamSignedZfo(io, request({ usesCookie: true }))).toEqual({
        type: 'authFault',
      });
    });

    it('is a lost session only for a cookie request, and only on the sign-in page', async () => {
      const cookie = memoryIo({ status: 200, text: PAGE, urls: [PORTAL, SIGN_IN] });
      expect(await streamSignedZfo(cookie.io, request({ usesCookie: true }))).toEqual({
        type: 'authFault',
      });
      // A password request has no session to renew: the same page there stays a fault.
      const basic = memoryIo({ status: 200, text: PAGE, urls: [PORTAL, SIGN_IN] });
      expect(await streamSignedZfo(basic.io, request({ usesCookie: false }))).toEqual({
        type: 'serverFault',
      });
      const elsewhere = memoryIo({ status: 200, text: PAGE, urls: [PORTAL] });
      expect(await streamSignedZfo(elsewhere.io, request({ usesCookie: true }))).toEqual({
        type: 'serverFault',
      });
    });
  });

  it('calls 1281 from the large-volume service a fault, never a refusal', async () => {
    // It is asked only after the ordinary service called the message a VoDZ. "Not a VoDZ" back is the
    // two services disagreeing, and a refusal past 90 days would record the message as gone.
    const { io, files } = memoryIo({ status: 200, text: bigResponse(null, '1281') });
    expect(await streamSignedZfo(io, request())).toEqual({ type: 'serverFault' });
    expect(files.has(FINAL)).toBe(false);
  });

  it('calls a response cut off before its status a fault, not a refusal', async () => {
    // Only an answer from ISDS may lead to a message being recorded as gone.
    const cut = bigResponse(SIGNATURE).slice(0, 30_000);
    const { io, files } = memoryIo({ status: 200, text: cut });
    expect(await streamSignedZfo(io, request())).toEqual({ type: 'serverFault' });
    expect(files.has(FINAL)).toBe(false);
  });

  it('refuses a successful answer that carries no signature', async () => {
    const { io, files } = memoryIo({ status: 200, text: bigResponse(null) });
    expect(await streamSignedZfo(io, request())).toEqual({ type: 'serverFault' });
    expect(files.has(FINAL)).toBe(false);
  });

  it('never replaces an original already in place with one that failed to write', async () => {
    const { io, files, breakDecoding } = memoryIo({ status: 200, text: bigResponse(SIGNATURE) });
    files.set(FINAL, 'the original from last month');
    breakDecoding();
    expect(await streamSignedZfo(io, request())).toEqual({ type: 'serverFault' });
    expect(files.get(FINAL)).toBe('the original from last month');
    expect(scratch(files)).toEqual([]);
  });

  it('replaces an original already in place once the new one is whole, leaving nothing aside', async () => {
    const { io, files } = memoryIo({ status: 200, text: bigResponse(SIGNATURE) });
    files.set(FINAL, 'the original from last month');
    expect((await streamSignedZfo(io, request())).type).toBe('zfo');
    expect(Buffer.from(files.get(FINAL) as string, 'latin1').equals(ORIGINAL)).toBe(true);
    expect([...files.keys()]).toEqual([FINAL]);
  });

  // 2026-09-24. The copy under the name was removed before the new one was moved in, so a move that
  // failed lost both: the old one gone, the new one removed with the scratch files. Two downloads of
  // one message queue behind each other, and the second can replace the original the first recorded.
  it('keeps the original already in place when the new one cannot be moved over it', async () => {
    const { io, files, breakMovesFrom } = memoryIo({ status: 200, text: bigResponse(SIGNATURE) });
    files.set(FINAL, 'the original from last month');
    breakMovesFrom(`${FINAL}.part`);
    expect(await streamSignedZfo(io, request())).toEqual({ type: 'serverFault' });
    expect(files.get(FINAL)).toBe('the original from last month');
    expect([...files.keys()]).toEqual([FINAL]);
  });

  it('leaves that copy aside, never removed, when it cannot be put back either', async () => {
    const { io, files, breakMovesFrom } = memoryIo({ status: 200, text: bigResponse(SIGNATURE) });
    files.set(FINAL, 'the original from last month');
    breakMovesFrom(`${FINAL}.part`);
    breakMovesFrom(`${FINAL}.old`);
    expect(await streamSignedZfo(io, request())).toEqual({ type: 'serverFault' });
    expect(files.get(`${FINAL}.old`)).toBe('the original from last month');
  });

  // Review, 2026-09-24: nothing read an aside copy back, and a stale one that will not delete made the
  // original impossible to replace on iOS, whose move refuses a destination that exists.
  it('puts back a copy a stopped replacement left aside, even when the new one cannot go in', async () => {
    const { io, files, breakMovesFrom } = memoryIo({ status: 200, text: bigResponse(SIGNATURE) });
    files.set(`${FINAL}.old`, 'the original from last month');
    breakMovesFrom(`${FINAL}.part`);
    expect(await streamSignedZfo(io, request())).toEqual({ type: 'serverFault' });
    expect(files.get(FINAL)).toBe('the original from last month');
    expect([...files.keys()]).toEqual([FINAL]);
  });

  it('replaces the original even when a stale copy aside will not delete', async () => {
    const { io, files, breakRemovesOf } = memoryIo({ status: 200, text: bigResponse(SIGNATURE) });
    files.set(FINAL, 'the original from last month');
    files.set(`${FINAL}.old`, 'an older one still aside');
    breakRemovesOf(`${FINAL}.old`);
    expect((await streamSignedZfo(io, request())).type).toBe('zfo');
    expect(Buffer.from(files.get(FINAL) as string, 'latin1').equals(ORIGINAL)).toBe(true);
    // The stale one is left as it was; the copy set aside for this replacement is gone.
    expect([...files.keys()].sort()).toEqual([FINAL, `${FINAL}.old`]);
  });

  it('passes a cancel on rather than calling it a failure, and still cleans up', async () => {
    const { io, files, breakFetch } = memoryIo({ status: 200, text: '' });
    breakFetch(new Error('cancelled'));
    await expect(streamSignedZfo(io, request({ cancelled: () => true }))).rejects.toThrow(
      'cancelled',
    );
    expect(scratch(files)).toEqual([]);
  });
});

describe('finding the signature body', () => {
  it('will not decode an MTOM reference as if it were base64', () => {
    const head = '<p:dmSignature><xop:Include href="cid:zfo"/></p:dmSignature><p:dmStatus>';
    expect(signatureBody(head, head, 0)).toBeNull();
  });

  it('measures the body in bytes of the file, across the head and the tail', () => {
    const head = '<env><p:dmSignature>QUJD';
    const tail = 'RA==</p:dmSignature><p:dmStatus>';
    expect(signatureBody(head, tail, 1000)).toEqual({ start: 20, end: 1004 });
  });
});
