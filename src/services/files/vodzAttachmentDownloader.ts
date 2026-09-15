// VoDZ (large-volume) attachment downloader.
//
// A >20 MB sent message's enclosures can only be fetched via the VoDZ `DownloadAttachment` op (ws2
// `/DS/vodz`), ONE enclosure at a time. The response embeds the file as inline base64 inside a ~35 MB
// SOAP XML - far too big to hold in JS (it OOMs the 192 MB Android heap; confirmed on-device). So we
// STREAM: react-native-blob-util writes the response straight to a temp file, then we slice out the
// `<dmEncodedContent>` region and base64-decode it to the final file in small chunks. Peak memory is
// one chunk, so even a 100 MB enclosure stays flat - no `largeHeap`, no native module needed.
//
// Every request here carries ITS box's credentials and nothing else (018 T015): HTTP Basic on `ws2`
// for a password box, the box's own session cookie at the portal's `/apps/DS/vodz` for an OTP or
// Mobile Key box - the same split `isdsTransport` applies to every other WS call. What the transport
// gets from `useJar: false`, blob-util has no option for, so the patch adds one (`omitCookies`, below).
//
// Device-only (RNBlobUtil); behind an interface so the controller can use a fake in tests.

import RNBlobUtil, { type ReactNativeBlobUtilConfig } from 'react-native-blob-util';
import type { AuthMethod, Host, MessageAttachment } from '../isds/types';
import { alignBase64Chunk } from './base64Stream';
import {
  attachmentMessageDir,
  signedOriginalFileName,
} from './attachmentFileStore';
import { basicAuthHeader } from '../isds/httpClient';
import { redirectedToSignIn } from '../isds/signInRedirect';
import { appsVodzUrl, vdzWsUrl } from '../isds/endpoints';
import {
  STATUS_MESSAGE_DELETED,
  STATUS_OK,
  STATUS_VODZ_NO_SUCH_ATTACHMENT,
  buildDownloadAttachment,
  buildSignedBigMessageDownload,
} from '../isds/soap';
import {
  streamSignedZfo,
  type SignedZfoStreamResult,
  type ZfoStreamIo,
} from './signedZfoStream';
import { moveIntoPlace, type PlaceFs } from './moveIntoPlace';

export interface VodzDownloadArgs {
  host: Host;
  /** Password boxes authenticate with HTTP Basic; OTP and Mobile Key boxes with their own session. */
  authMethod: AuthMethod;
  loginName: string;
  password: string | null;
  /**
   * THIS box's ISDS session as a `Cookie:` header value (018), read from the vault at call time. Null
   * for a password box. Required rather than optional: a download that forgot it would go out wearing
   * whatever session the shared native jar held, which is the exposure 018 exists to prevent.
   */
  sessionCookie: string | null;
  boxId: string;
  messageId: string;
  signal: AbortSignal;
  /**
   * Bytes of the current enclosure's response written to disk so far (the large >20 MB sent-message
   * path). ISDS sends no Content-Length, so there's no total - this is a climbing byte count. The
   * response is base64-wrapped, so the decoded file size ≈ bytes × 0.75.
   */
  onProgress?: (receivedBytes: number) => void;
}

export interface VodzEnclosureArgs extends VodzDownloadArgs {
  /**
   * The first enclosure to ask for (`attNum`, from 0). Every enclosure below it is already in the
   * archive from an earlier walk that stopped part-way: it is never requested and its file is never
   * written again. Absent for a first download.
   */
  from?: number;
}

/** Why an enclosure walk stopped before ISDS said there were no more. */
export type VodzWalkStop = 'authFault' | 'gone' | 'serverFault';

export type VodzDownloadResult =
  /** Every enclosure from `from` on, up to ISDS answering past the last one. */
  | { type: 'attachments'; attachments: MessageAttachment[] }
  /**
   * The walk stopped after at least one enclosure arrived (constitution IV). `attachments` are the ones
   * that did, from `from` on and in order, each complete on disk; `missingFrom` is the first that did not.
   * How many follow it ISDS says only by answering past the last one, which this walk never reached.
   */
  | {
      type: 'partial';
      attachments: MessageAttachment[];
      missingFrom: number;
      stopped: VodzWalkStop;
    }
  | { type: 'authFault' }
  /** ISDS answered `1219` for the first enclosure asked for: it has deleted the message. */
  | { type: 'gone' }
  | { type: 'serverFault' };

export interface VodzSignedZfoArgs extends VodzDownloadArgs {
  /** `SignedSentBigMessageDownload` for a sent message, `SignedBigMessageDownload` for a received one. */
  sent: boolean;
}

export type VodzSignedZfoResult = SignedZfoStreamResult;

export interface VodzAttachmentDownloader {
  /**
   * Download a VoDZ message's enclosures to files, from `args.from` on. NEVER throws except on
   * cancellation.
   */
  download(args: VodzEnclosureArgs): Promise<VodzDownloadResult>;
  /**
   * Stream a VoDZ message's signed original into its .zfo file (004 amendment) - never through the JS
   * heap, because it can exceed a gigabyte. NEVER throws except on cancellation.
   */
  downloadSignedZfo(args: VodzSignedZfoArgs): Promise<VodzSignedZfoResult>;
}

/** Where a box's VoDZ request goes and what it carries. */
export interface VodzRequest {
  url: string;
  headers: Record<string, string>;
  /** Rides a session cookie (so a 200 with no XML is a lost session) rather than HTTP Basic. */
  usesCookie: boolean;
}

const SOAP_HEADERS: Record<string, string> = {
  'Content-Type': 'text/xml; charset=utf-8',
  SOAPAction: '""',
};
const DOWNLOAD_TIMEOUT_MS = 180_000; // a VoDZ enclosure can be up to ~100 MB
const MAX_ENCLOSURES = 64; // safety cap on the attNum walk (well above any real message)
const HEAD_BYTES = 8192; // enough to hold the dmFile open tag + <dmEncodedContent>
const TAIL_BYTES = 4096; // enough to hold </dmEncodedContent> + dmStatus at EOF
const DECODE_CHUNK = 1_500_000; // base64 chars decoded per pass (kept a multiple of 4 via the carry)

/**
 * The URL and headers of a box's VoDZ download, or null when a cookie box has no session to send.
 *
 * Null is refused before anything reaches the network, as `isdsTransport.missingSession` refuses the
 * ordinary calls: an anonymous request to the portal comes back as a login redirect, not a 401, and
 * would reach the user as a failed download instead of "sign in again". A password box without a
 * password still goes out, without Basic, and gets the 401 the transport's calls get.
 *
 * Why the portal and not `ws2` for a cookie box is recorded at `appsVodzUrl`; the send (018 T006)
 * already goes there.
 */
export function vodzRequest(
  args: Pick<VodzDownloadArgs, 'host' | 'authMethod' | 'loginName' | 'password' | 'sessionCookie'>,
): VodzRequest | null {
  const headers: Record<string, string> = { ...SOAP_HEADERS };
  if (args.authMethod === 'password') {
    if (args.password != null) {
      headers.Authorization = basicAuthHeader(args.loginName, args.password);
    }
    return { url: vdzWsUrl(args.host), headers, usesCookie: false };
  }
  if (!args.sessionCookie) {
    return null;
  }
  headers.Cookie = args.sessionCookie;
  return { url: appsVodzUrl(args.host), headers, usesCookie: true };
}

/** A blob-util config with `omitCookies`, which only the project's patch of the library reads. */
export type NoJarConfig = ReactNativeBlobUtilConfig & { omitCookies: true };

/**
 * The config of every VoDZ request: the response goes to `path`, and RN's shared cookie jar stays out.
 *
 * `omitCookies` is added by `patches/react-native-blob-util+0.24.9.patch`, because blob-util has no
 * way to keep the jar out and uses it on both platforms. On Android it installs RN's jar on the OkHttp
 * client every request inherits, and OkHttp's bridge REPLACES an explicit `Cookie:` header with the
 * jar's cookies whenever the jar holds any for the host - so the box's own cookie would lose to
 * whichever session the last login left. On iOS the session reads the shared `NSHTTPCookieStorage`
 * and writes every response's cookies back into it. With the option set, the patched Android request
 * uses `CookieJar.NO_COOKIES` and the iOS one has no cookie storage and never stores a cookie.
 */
function noJarConfig(path: string): NoJarConfig {
  return { path, timeout: DOWNLOAD_TIMEOUT_MS, omitCookies: true };
}

const RESERVED = /[\\/:*?"<>|]/g;
function safeFileName(name: string, fallback: string): string {
  return name.replace(RESERVED, '_').trim() || fallback;
}
/** Path segments come from box/message ids - keep them filesystem-safe. */
/** Build a byte-accurate latin1 string from a slice (ascii read → number[] of byte values). */
async function readSliceLatin1(
  path: string,
  start: number,
  end: number,
): Promise<string> {
  const tmp = `${RNBlobUtil.fs.dirs.CacheDir}/vodz_sl_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2)}`;
  await RNBlobUtil.fs.slice(path, tmp, start, end);
  try {
    const bytes = (await RNBlobUtil.fs.readFile(tmp, 'ascii')) as number[];
    let out = '';
    for (let i = 0; i < bytes.length; i += 8192) {
      out += String.fromCharCode(...bytes.slice(i, i + 8192));
    }
    return out;
  } finally {
    await RNBlobUtil.fs.unlink(tmp).catch(() => {});
  }
}

/** Decode the latin1 byte-string of an XML attribute value back to UTF-8 (diacritics in filenames). */
function latin1ToUtf8(s: string): string {
  let out = '';
  const n = s.length;
  let i = 0;
  while (i < n) {
    const b = s.charCodeAt(i) & 0xff;
    if (b < 0x80) {
      out += s[i];
      i += 1;
    } else if (b >= 0xc0 && b < 0xe0 && i + 1 < n) {
      out += String.fromCharCode(((b & 0x1f) << 6) | (s.charCodeAt(i + 1) & 0x3f));
      i += 2;
    } else if (b >= 0xe0 && b < 0xf0 && i + 2 < n) {
      out += String.fromCharCode(
        ((b & 0x0f) << 12) |
          ((s.charCodeAt(i + 1) & 0x3f) << 6) |
          (s.charCodeAt(i + 2) & 0x3f),
      );
      i += 3;
    } else if (b >= 0xf0 && i + 3 < n) {
      let cp =
        ((b & 0x07) << 18) |
        ((s.charCodeAt(i + 1) & 0x3f) << 12) |
        ((s.charCodeAt(i + 2) & 0x3f) << 6) |
        (s.charCodeAt(i + 3) & 0x3f);
      cp -= 0x10000;
      out += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
      i += 4;
    } else {
      out += s[i];
      i += 1;
    }
  }
  return out;
}

function tagValue(text: string, tag: string): string | null {
  const m = new RegExp(`<(?:\\w+:)?${tag}>\\s*([^<\\s]*)`).exec(text);
  return m ? m[1] : null;
}
function xmlAttr(text: string, name: string): string {
  const m = new RegExp(`${name}="([^"]*)"`).exec(text);
  return m ? m[1] : '';
}

/** Slice [start,end) of `src` in chunks, strip non-base64, decode + append the bytes to `out`. */
async function decodeRegionToFile(
  src: string,
  start: number,
  end: number,
  out: string,
): Promise<void> {
  const tmp = `${RNBlobUtil.fs.dirs.CacheDir}/vodz_dec_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2)}`;
  let pos = start;
  let carry = '';
  try {
    while (pos < end) {
      const chunkEnd = Math.min(pos + DECODE_CHUNK, end);
      await RNBlobUtil.fs.slice(src, tmp, pos, chunkEnd);
      // The content region is pure base64 (ASCII), so a utf8 read is byte-accurate here.
      const raw = (await RNBlobUtil.fs.readFile(tmp, 'utf8')) as string;
      const aligned = alignBase64Chunk(carry, raw);
      carry = aligned.carry;
      if (aligned.emit.length > 0) {
        await RNBlobUtil.fs.appendFile(out, aligned.emit, 'base64');
      }
      pos = chunkEnd;
    }
    if (carry.length > 0) {
      await RNBlobUtil.fs.appendFile(out, carry, 'base64');
    }
  } finally {
    await RNBlobUtil.fs.unlink(tmp).catch(() => {});
  }
}

/**
 * blob-util's file operations, for `moveIntoPlace`. Neither platform's `mv` writes over a file, and until
 * 2026-09-15 the copy already under an enclosure's name was unlinked before the new one was moved in.
 */
const blobFs: PlaceFs = {
  exists: path => RNBlobUtil.fs.exists(path),
  move: async (from, to) => {
    await RNBlobUtil.fs.mv(from, to);
  },
  remove: path => RNBlobUtil.fs.unlink(path),
};

type OneResult =
  | { type: 'enclosure'; attachment: MessageAttachment }
  | { type: 'endOfList' }
  | { type: 'authFault' }
  | { type: 'gone' }
  | { type: 'fault' };

/**
 * The device side of `streamSignedZfo` (004 amendment): blob-util for the request and the same slice
 * helpers the enclosures use, so a VoDZ original reaches disk exactly the way an enclosure does.
 */
function rnbuZfoIo(
  signal: AbortSignal,
  onProgress?: (receivedBytes: number) => void,
): ZfoStreamIo {
  return {
    fetchToFile: async (url, headers, body, toPath) => {
      const task = RNBlobUtil.config(noJarConfig(toPath)).fetch('POST', url, headers, body);
      // No Content-Length from ISDS here either: progress is the response file growing on disk.
      let poll: ReturnType<typeof setInterval> | undefined;
      if (onProgress) {
        poll = setInterval(() => {
          RNBlobUtil.fs
            .stat(toPath)
            .then(s => onProgress(Number(s.size)))
            .catch(() => {});
        }, 300);
      }
      const onAbort = () => {
        task.cancel();
      };
      signal.addEventListener('abort', onAbort);
      try {
        const info = (await task).info();
        return { status: info.status, urls: info.redirects, headers: info.headers };
      } finally {
        if (poll != null) {
          clearInterval(poll);
        }
        signal.removeEventListener('abort', onAbort);
      }
    },
    size: async path => Number((await RNBlobUtil.fs.stat(path)).size),
    readLatin1: readSliceLatin1,
    decodeBase64Region: decodeRegionToFile,
    ensureDir: async path => {
      if (!(await RNBlobUtil.fs.exists(path))) {
        await RNBlobUtil.fs.mkdir(path);
      }
    },
    exists: path => RNBlobUtil.fs.exists(path),
    move: async (from, to) => {
      await RNBlobUtil.fs.mv(from, to);
    },
    remove: path => RNBlobUtil.fs.unlink(path),
  };
}

/** What a download that was cancelled rejects with - the name `messagesController.mapError` reads. */
function cancelledError(): Error {
  const error = new Error('The large-volume download was cancelled.');
  error.name = 'AbortError';
  return error;
}

/** Resolves once `ahead` has settled, or at once when `signal` is aborted, whichever comes first. */
function turnOrCancel(ahead: Promise<void>, signal: AbortSignal): Promise<void> {
  return new Promise(resolve => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const onAbort = () => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    };
    signal.addEventListener('abort', onAbort);
    void ahead.then(onAbort);
  });
}

class RnbuVodzAttachmentDownloader implements VodzAttachmentDownloader {
  /**
   * The last download queued on each message's directory, so the next one waits for it (`inTurn`).
   *
   * Until 2026-09-15 two downloads of one message ran side by side, decoding the same enclosure into the
   * same `.part` and the same `.resp-N.tmp` - and each removing the other's. Two detail screens for one
   * message cannot be on the stack (`MessageDetail` navigates nowhere, and a notification resets to the
   * inbox first), but one screen can start two: a second press before the busy state has rendered, or a
   * download started after leaving and coming back while the walk the leaving cancelled is still
   * decoding, since a cancel stops only a request that is still out.
   */
  private readonly lanes = new Map<string, Promise<void>>();

  /**
   * Run `run` once every download queued before it on `dir` has settled. The enclosures and the signed
   * original share a lane: they write into the same directory, and two originals would share a `.part`.
   * A download cancelled while it waits rejects at once and holds up nobody behind it.
   */
  private async inTurn<T>(dir: string, signal: AbortSignal, run: () => Promise<T>): Promise<T> {
    const ahead = this.lanes.get(dir) ?? Promise.resolve();
    let finished: () => void = () => {};
    const mine = new Promise<void>(resolve => {
      finished = resolve;
    });
    // The next one waits for this one AND for everything ahead of it: a download cancelled while it
    // waits finishes at once, and the one behind it must still not start before the one still running.
    const last = ahead.then(() => mine);
    this.lanes.set(dir, last);
    void last.then(() => {
      if (this.lanes.get(dir) === last) {
        this.lanes.delete(dir);
      }
    });
    try {
      await turnOrCancel(ahead, signal);
      if (signal.aborted) {
        throw cancelledError();
      }
      return await run();
    } finally {
      finished();
    }
  }

  async downloadSignedZfo(args: VodzSignedZfoArgs): Promise<VodzSignedZfoResult> {
    const request = vodzRequest(args);
    if (request == null) {
      return { type: 'authFault' }; // no session → say 'sign in again', do not ask ISDS anonymously
    }
    const dir = attachmentMessageDir(args.boxId, args.messageId);
    return this.inTurn(dir, args.signal, () =>
      streamSignedZfo(rnbuZfoIo(args.signal, args.onProgress), {
        url: request.url,
        headers: request.headers,
        usesCookie: request.usesCookie,
        body: buildSignedBigMessageDownload(args.messageId, args.sent),
        dir,
        fileName: signedOriginalFileName(args.messageId),
        cancelled: () => args.signal.aborted,
      }),
    );
  }

  async download(args: VodzEnclosureArgs): Promise<VodzDownloadResult> {
    const request = vodzRequest(args);
    if (request == null) {
      return { type: 'authFault' }; // no session → say 'sign in again', do not ask ISDS anonymously
    }
    const dir = attachmentMessageDir(args.boxId, args.messageId);
    return this.inTurn(dir, args.signal, () => this.walk(request, dir, args));
  }

  private async walk(
    request: VodzRequest,
    dir: string,
    args: VodzEnclosureArgs,
  ): Promise<VodzDownloadResult> {
    if (!(await RNBlobUtil.fs.exists(dir))) {
      await RNBlobUtil.fs.mkdir(dir);
    }

    const from = Math.max(0, args.from ?? 0);
    const attachments: MessageAttachment[] = [];
    for (let attNum = from; attNum < MAX_ENCLOSURES; attNum++) {
      // A cancel reaches only a request still out (`onAbort` in `downloadOne`): one that came after the
      // answer had arrived went on decoding, and the walk then sent the next request with the signal
      // already aborted, whose listener never fires. A walk nobody is waiting for would go on through
      // every enclosure left - and, since 2026-09-15, hold up the next download of the message too.
      if (args.signal.aborted) {
        throw cancelledError();
      }
      const one = await this.downloadOne(
        request,
        args.messageId,
        attNum,
        dir,
        args.signal,
        args.onProgress,
      );
      if (one.type === 'endOfList') {
        return { type: 'attachments', attachments };
      }
      if (one.type === 'enclosure') {
        attachments.push(one.attachment);
        continue;
      }
      const stopped: VodzWalkStop = one.type === 'fault' ? 'serverFault' : one.type;
      if (attachments.length === 0) {
        return { type: stopped };
      }
      // Until 2026-09-15 a walk that stopped here returned what it had as the whole message, and the
      // controller cached it as such: a fault, a paused service (3013) or a deletion reported half-way
      // left a message with enclosures missing looking complete, with nothing offering them again. A
      // deletion reported half-way is still no verdict on a message that has just served an enclosure,
      // and a lost session no reason to drop what already arrived - both are reported as partial too.
      return { type: 'partial', attachments, missingFrom: attNum, stopped };
    }
    // The cap is a guard against a walk that never ends, not ISDS saying it has no more.
    return attachments.length > 0
      ? { type: 'partial', attachments, missingFrom: MAX_ENCLOSURES, stopped: 'serverFault' }
      : { type: 'serverFault' };
  }

  private async downloadOne(
    request: VodzRequest,
    dmID: string,
    attNum: number,
    dir: string,
    signal: AbortSignal,
    onProgress?: (receivedBytes: number) => void,
  ): Promise<OneResult> {
    let respPath: string | null = null;
    /** The enclosure being decoded, until it is moved into place - removed if it never is. */
    let partPath: string | null = null;
    // Write the response to a known temp path (not auto fileCache) so we can watch its size grow.
    const respTempPath = `${dir}/.resp-${attNum}.tmp`;
    await RNBlobUtil.fs.unlink(respTempPath).catch(() => {}); // stale temp from a prior aborted run
    // A large enclosure over a slow link needs a timeout well past any default (`noJarConfig`).
    const task = RNBlobUtil.config(noJarConfig(respTempPath)).fetch(
      'POST',
      request.url,
      request.headers,
      buildDownloadAttachment(dmID, attNum),
    );
    // ISDS sends no Content-Length and blob-util's .progress reports 0/-1 for this streamed POST, so
    // we track bytes by polling the response file as it's written to disk (it grows as data arrives).
    let poll: ReturnType<typeof setInterval> | undefined;
    if (onProgress) {
      poll = setInterval(() => {
        RNBlobUtil.fs
          .stat(respTempPath)
          .then(s => onProgress(Number(s.size)))
          .catch(() => {});
      }, 300);
    }
    const onAbort = () => {
      task.cancel();
    };
    signal.addEventListener('abort', onAbort);
    try {
      const res = await task;
      respPath = res.path();
      const info = res.info();
      const status = info.status;
      if (status === 401 || status === 403) {
        return { type: 'authFault' };
      }
      // A stale cookie can be turned away to the portal's sign-in page instead of the documented 200
      // with whitespace, and blob-util follows that redirect, so the page arrives as a 200 WITH markup
      // and read as a fault: "try again", where only signing in again helps (`signInRedirect.ts`).
      // `redirects` lists every URL the request went through, on both platforms.
      if (
        request.usesCookie &&
        redirectedToSignIn({ status, urls: info.redirects, headers: info.headers })
      ) {
        return { type: 'authFault' };
      }
      if (status !== 200) {
        return { type: 'fault' };
      }

      const size = (await RNBlobUtil.fs.stat(respPath)).size;
      // dmStatusCode follows the content, near EOF - read just the tail.
      const tailStart = Math.max(0, size - TAIL_BYTES);
      const tail = await readSliceLatin1(respPath, tailStart, size);
      // A dead session cookie gets HTTP 200 and whitespace, no envelope (018 FR-006) - the same rule
      // as `isdsTransport.sessionLost`, decided on the whole answer, which then fits in the tail.
      if (request.usesCookie && tailStart === 0 && !tail.includes('<')) {
        return { type: 'authFault' };
      }
      const code = tagValue(tail, 'dmStatusCode');
      if (code === STATUS_VODZ_NO_SUCH_ATTACHMENT) {
        return { type: 'endOfList' };
      }
      if (code === STATUS_MESSAGE_DELETED) {
        return { type: 'gone' };
      }
      if (code !== STATUS_OK) {
        return { type: 'fault' };
      }

      // dmFile attrs + the start of the base64 live in the head; the close tag is in the tail.
      const head = await readSliceLatin1(respPath, 0, Math.min(size, HEAD_BYTES));
      const openRe = /<(?:\w+:)?dmEncodedContent>/.exec(head);
      const closeRe = /<\/(?:\w+:)?dmEncodedContent>/.exec(tail);
      if (openRe == null || closeRe == null) {
        return { type: 'fault' }; // no inline content (e.g. dmXMLContent) - not handled
      }
      const contentStart = openRe.index + openRe[0].length;
      const contentEnd = tailStart + closeRe.index;
      if (contentEnd <= contentStart) {
        return { type: 'fault' };
      }

      const name =
        latin1ToUtf8(xmlAttr(head, 'dmFileDescr')) || `priloha-${attNum + 1}`;
      const mimeType = xmlAttr(head, 'dmMimeType') || 'application/octet-stream';
      const metaType = xmlAttr(head, 'dmFileMetaType') || 'enclosure';
      const outPath = `${dir}/${attNum}_${safeFileName(
        name,
        `priloha-${attNum + 1}`,
      )}`;
      // Decoded beside the real name and moved into place only once whole, as the signed original is
      // (`streamSignedZfo`). Written straight to `outPath` after unlinking it, a decode that failed half
      // way - a full disk, a cut connection - took the copy already there with it and left a truncated
      // file under the name the archive points at.
      partPath = `${outPath}.part`;
      await RNBlobUtil.fs.unlink(partPath).catch(() => {});
      await decodeRegionToFile(respPath, contentStart, contentEnd, partPath);
      await moveIntoPlace(blobFs, partPath, outPath);
      partPath = null;

      return {
        type: 'enclosure',
        attachment: { name, mimeType, metaType, contentBase64: '', localPath: outPath },
      };
    } catch (e) {
      if (signal.aborted) {
        throw e; // user cancellation - propagate so the caller aborts the whole walk
      }
      return { type: 'fault' };
    } finally {
      if (poll != null) {
        clearInterval(poll);
      }
      signal.removeEventListener('abort', onAbort);
      if (respPath != null) {
        await RNBlobUtil.fs.unlink(respPath).catch(() => {});
      }
      if (partPath != null) {
        await RNBlobUtil.fs.unlink(partPath).catch(() => {});
      }
    }
  }
}

/** The device VoDZ attachment downloader (singleton). */
export const vodzAttachmentDownloader: VodzAttachmentDownloader =
  new RnbuVodzAttachmentDownloader();
