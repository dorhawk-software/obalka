// Streaming a large-volume message's signed original to disk (004 amendment, 2026-09-14).
//
// A VoDZ's .zfo can be larger than a gigabyte (bulletin 2175 §3.1), and `SignedBigMessageDownload`
// returns it as base64 inside a single SOAP response. Held in JS it would take the app down, so it is
// never read whole: the response goes to a temp file natively, `<dmSignature>`'s opening tag is found
// in the first few kilobytes and its closing tag in the last few, and the body between them is decoded
// into the .zfo a slice at a time - the technique the VoDZ enclosures have used since 005, confirmed on
// czebox.
//
// The native calls sit behind `ZfoStreamIo` so the part that decides things - the HTTP and ISDS
// status, where the body is, and never leaving a half-written file under the real name - is tested
// without a device.

import type { SignedOriginal } from '../isds/types';
import {
  STATUS_MESSAGE_DELETED,
  STATUS_OK,
  STATUS_WRONG_SERVICE_FOR_TYPE,
} from '../isds/soap';
import { redirectedToSignIn, type AnswerTrail } from '../isds/signInRedirect';
import { moveIntoPlace } from './moveIntoPlace';

export interface ZfoStreamIo {
  /**
   * POST `body` and write the response to `toPath` as it arrives. Resolves the HTTP status, and the
   * URLs and headers that show whether the portal redirected the request to its sign-in page.
   */
  fetchToFile(
    url: string,
    headers: Record<string, string>,
    body: string,
    toPath: string,
  ): Promise<AnswerTrail>;
  size(path: string): Promise<number>;
  /** Bytes [start, end) as a latin1 string (one character per byte) - only ever a few kilobytes. */
  readLatin1(path: string, start: number, end: number): Promise<string>;
  /** Decode the base64 in bytes [start, end) of `src` and append it to `out`, a slice at a time. */
  decodeBase64Region(src: string, start: number, end: number, out: string): Promise<void>;
  ensureDir(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  /** Neither platform's move writes over a file: iOS refuses, Android deletes the destination first. */
  move(from: string, to: string): Promise<void>;
  remove(path: string): Promise<void>;
}

export interface SignedZfoRequest {
  url: string;
  headers: Record<string, string>;
  body: string;
  /** The message's attachment directory. */
  dir: string;
  fileName: string;
  /**
   * Whether the request rides a box's session cookie (OTP, Mobile Key) rather than HTTP Basic. Required,
   * so a caller cannot forget it: it decides whether an answer with no XML in it is a lost session.
   */
  usesCookie: boolean;
  /** Whether the user has cancelled - a cancel is passed on, never turned into a fault. */
  cancelled: () => boolean;
}

export type SignedZfoStreamResult =
  | { type: 'zfo'; original: SignedOriginal }
  | { type: 'authFault' }
  /** ISDS answered `1219`: it has deleted the message. The only answer that may record it as gone. */
  | { type: 'gone' }
  /** ISDS answered with another status than `0000` - an answer, unlike a broken transfer, but no verdict. */
  | { type: 'refused' }
  | { type: 'serverFault' };

/** Enough to hold the SOAP envelope's opening and `<dmSignature>`. */
const HEAD_BYTES = 8192;
/** Enough to hold `</dmSignature>` and the `dmStatus` that follows it. */
const TAIL_BYTES = 4096;

/** A `tStatus` code in a response's tail, or null. */
function statusCodeIn(text: string): string | null {
  const found = /<(?:[\w.-]+:)?dmStatusCode>\s*([^<\s]*)/.exec(text);
  return found ? found[1] : null;
}

/** Where the base64 body of `dmSignature` lies in the file, from its head and tail. */
export function signatureBody(
  head: string,
  tail: string,
  tailStart: number,
): { start: number; end: number } | null {
  const open = /<(?:[\w.-]+:)?dmSignature(?:\s[^>]*)?>/.exec(head);
  const close = /<\/(?:[\w.-]+:)?dmSignature>/.exec(tail);
  if (open == null || close == null) {
    return null;
  }
  const start = open.index + open[0].length;
  const end = tailStart + close.index;
  // A body that starts with markup is an MTOM reference, not base64 - decoding it would write garbage.
  if (end <= start || head.charAt(start) === '<') {
    return null;
  }
  return { start, end };
}

export async function streamSignedZfo(
  io: ZfoStreamIo,
  req: SignedZfoRequest,
): Promise<SignedZfoStreamResult> {
  const final = `${req.dir}/${req.fileName}`;
  const part = `${final}.part`;
  const response = `${req.dir}/.resp-zfo.tmp`;
  try {
    await io.ensureDir(req.dir);
    await io.remove(response).catch(() => undefined); // a stale one from an interrupted run
    const answer = await io.fetchToFile(req.url, req.headers, req.body, response);
    const status = answer.status;
    if (status === 401 || status === 403) {
      return { type: 'authFault' };
    }
    // The portal sends a cookie request without a session to its sign-in page, and blob-util follows
    // the redirect: the page lands in the file as a 200 with markup in it, which the rule below cannot
    // see (018 FR-006, `signInRedirect.ts`).
    if (req.usesCookie && redirectedToSignIn(answer)) {
      return { type: 'authFault' };
    }
    if (status !== 200) {
      return { type: 'serverFault' };
    }
    const size = await io.size(response);
    const tailStart = Math.max(0, size - TAIL_BYTES);
    const tail = await io.readLatin1(response, tailStart, size);
    // A dead session cookie gets HTTP 200 and a few bytes of whitespace, no envelope at all (018
    // FR-006, captured on `/apps/DS/dz`). The whole answer is in the tail then, so "no XML" is certain,
    // not guessed from a slice. A password box gets a real 401 instead, so this stays a fault there.
    if (req.usesCookie && tailStart === 0 && !tail.includes('<')) {
      return { type: 'authFault' };
    }
    const code = statusCodeIn(tail);
    if (code === STATUS_MESSAGE_DELETED) {
      return { type: 'gone' };
    }
    if (code !== STATUS_OK) {
      // No status at all is a response cut short - not ISDS saying no. Nor is 1281: this service is
      // only asked after the ordinary one called the message a VoDZ, so "not a VoDZ" here is the two
      // services disagreeing about routing, and a refusal past 90 days would record the message gone.
      return code == null || code === STATUS_WRONG_SERVICE_FOR_TYPE
        ? { type: 'serverFault' }
        : { type: 'refused' };
    }
    const head = await io.readLatin1(response, 0, Math.min(size, HEAD_BYTES));
    const body = signatureBody(head, tail, tailStart);
    if (body == null) {
      return { type: 'serverFault' };
    }
    await io.remove(part).catch(() => undefined);
    await io.decodeBase64Region(response, body.start, body.end, part);
    // Into place only once the whole file is written. A half-written original under the real name
    // would be offered to the user as the document ISDS sealed. The copy already there is moved aside,
    // never removed first (2026-09-24): a second download of one message can replace the original the
    // first has just recorded, and a move that failed after a removal lost both (`moveIntoPlace`).
    await moveIntoPlace(io, part, final);
    return {
      type: 'zfo',
      original: { fileName: req.fileName, localPath: final, size: await io.size(final) },
    };
  } catch (e) {
    if (req.cancelled()) {
      throw e; // the user left - the caller stops, it does not report a failure
    }
    return { type: 'serverFault' };
  } finally {
    await io.remove(response).catch(() => undefined);
    await io.remove(part).catch(() => undefined);
  }
}
