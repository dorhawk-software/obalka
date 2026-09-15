// Reading a data message out of its signed original (004 amendment, 2026-09-14).
//
// `SignedMessageDownload` and `SignedSentMessageDownload` answer with `dmSignature`: a CMS SignedData
// - the operator's CAdES seal - whose encapsulated content is the message as XML. Decoded, that blob
// IS the .zfo file, and the archive keeps it as it came. This module reads the message detail out of
// the same bytes.
//
// It used to be a few synchronous lines in `soap.ts`, written for the sent folder: the whole signature
// through `atob` into a latin1 string, UTF-8 rebuilt one character at a time, and every attachment's
// base64 handed to the XML parser. The received folder is where 20 MB decisions arrive, and there
// that is the JS thread held for as long as the message is large (constitution I). So this works on
// bytes, in slices:
//
//   1. base64 → bytes a megabyte at a time, yielding in between;
//   2. the CMS eContent found on the bytes - one primitive OCTET STRING, or ISDS's constructed one of
//      ~1 KB segments, joined into one buffer;
//   3. every <dmEncodedContent> body cut out of the XML by byte range. What is left - the envelope,
//      the file metadata, the hash - is kilobytes, and only that is decoded and parsed;
//   4. each body turned back into its base64 string from its own byte range, by placeholder.
//
// Anything it does not recognise resolves to null rather than to a guess. The caller decides what
// null means, and for a received message it means "download it the unsigned way", never "unopenable".

import type { MessageDetail } from './types';
import { parseMessageDownload, parseXmlWithAttrs } from './soap';
import { alignBase64Chunk } from '../files/base64Stream';
import { decodeUtf8Async, yieldToScheduler } from '../text/textCodec';

type AnyNode = Record<string, unknown>;

/** Base64 characters decoded per pass. */
const BASE64_SLICE = 1 << 20;
/** Bytes per `String.fromCharCode.apply` - well under any engine's argument limit. */
const CHAR_CODE_SLICE = 8192;
/** How many of those between two yields: about a megabyte of base64. */
const SLICES_PER_YIELD = 128;
/**
 * How far into the blob the eContent marker may sit.
 *
 * A SignedData lists its encapsulated content before the certificates and the signer infos, behind
 * only a version and a short set of digest algorithms, so the marker is a few dozen bytes in. The
 * bound keeps a blob that has none from being scanned to the end, and it matters for a second reason:
 * the signer infos repeat the same OID as the content-type attribute, and that one is not the content.
 */
const ECONTENT_WINDOW = 64 * 1024;
/** Likewise the message's opening tag, which is where the content starts. */
const ROOT_WINDOW = 64 * 1024;
/** Constructed OCTET STRINGs nested deeper than this are not something ISDS writes. */
const MAX_NESTING = 8;

/** OID 1.2.840.113549.1.7.1 (id-data), DER-encoded - the content type of the message itself. */
const ID_DATA = Uint8Array.of(0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x07, 0x01);
const TAG_OCTET_STRING = 0x04;
const TAG_OCTET_STRING_CONSTRUCTED = 0x24;
const TAG_ECONTENT = 0xa0;

const LT = 0x3c;
const GT = 0x3e;
const SLASH = 0x2f;
const COLON = 0x3a;

/** Roots, most specific first: the response wraps dmReturnedMessage, which wraps dmDm. */
const ROOTS = ['MessageDownloadResponse', 'dmReturnedMessage', 'dmDm'].map(asciiBytes);
const ENCODED_CONTENT = asciiBytes('dmEncodedContent');

/** Stands in for a body that was cut out. `-` is not a base64 character, so no real body is one. */
const placeholder = (k: number): string => `ZFO-BODY-${k}`;
const PLACEHOLDER = /^ZFO-BODY-(\d+)$/;

interface Range {
  start: number;
  end: number;
}

type EContent =
  | { kind: 'content'; bytes: Uint8Array }
  /** No SignedData marker at all - read the blob as it is. */
  | { kind: 'notCms' }
  /** A SignedData whose content does not decode. Reading around it would corrupt the attachments. */
  | { kind: 'malformed' };

/**
 * The message inside a `dmSignature` (base64), or null when it cannot be read with confidence.
 *
 * Throws only on base64 the decoder rejects, so the caller can report the real error.
 */
export async function parseSignedMessage(signatureBase64: string): Promise<MessageDetail | null> {
  return parseSignedMessageBytes(await decodeBase64Async(signatureBase64));
}

/** The same, from bytes already decoded. */
export async function parseSignedMessageBytes(bytes: Uint8Array): Promise<MessageDetail | null> {
  const content = eContentOf(bytes);
  if (content.kind === 'malformed') {
    return null;
  }
  const source = content.kind === 'content' ? content.bytes : bytes;
  const root = locateRoot(source);
  if (root == null) {
    return null;
  }
  const { xml, bodies } = await skeletonOf(source, root);
  const detail = detailOf(parseXmlWithAttrs(xml));
  if (detail == null || detail.id === '') {
    return null;
  }
  const attachments = [];
  for (const attachment of detail.attachments) {
    const cut = PLACEHOLDER.exec(attachment.contentBase64);
    const body = cut ? bodies[Number(cut[1])] : undefined;
    attachments.push(
      cut ? { ...attachment, contentBase64: body ? await asciiOf(source, body) : '' } : attachment,
    );
  }
  return { ...detail, attachments };
}

/** How far into a signed download's SOAP answer `<dmSignature>` may open: the envelope, no more. */
const SIGNATURE_OPEN_WINDOW = 64 * 1024;
const SIGNATURE_OPEN = /<([A-Za-z_][\w.-]*:)?dmSignature(?:\s[^>]*)?(\/?)>/;
/** A line break written as a character reference - the one thing a serializer may put in base64. */
const LINE_BREAK_REFERENCE = /&#(?:13|10|x0*[dDaA]);/g;

/**
 * A signed download's SOAP answer split in two: the base64 of `dmSignature`, and everything else.
 *
 * The answer to `SignedMessageDownload` is the whole message as one text node - 27 MB of base64 for a
 * 20 MB message. Handed to fast-xml-parser, which walks its input a character at a time in JS, that
 * node alone held the JS thread for 2.5 s under V8 with its JIT and 4 s without one (measured in Node
 * on 2026-09-14; Hermes interprets), before a byte of the message had been read (constitution I). So
 * the body is cut out by native string search, and only the envelope around it - the status - goes
 * to the parser.
 *
 * `signature` is null when the element is absent, empty, cut short, or not base64 at all: an MTOM
 * reference in place of the data. A response cut short also gives no skeleton, so it reads as no
 * answer rather than as a status.
 */
export function cutSignature(xml: string): { skeleton: string; signature: string | null } {
  const open = SIGNATURE_OPEN.exec(xml.slice(0, SIGNATURE_OPEN_WINDOW));
  if (open == null || open[2] === '/') {
    return { skeleton: xml, signature: null };
  }
  const start = open.index + open[0].length;
  const end = xml.indexOf(`</${open[1] ?? ''}dmSignature>`, start);
  if (end < 0) {
    return { skeleton: '', signature: null };
  }
  const skeleton = xml.slice(0, start) + xml.slice(end);
  let body = xml.slice(start, end).trim();
  if (body.startsWith('<![CDATA[') && body.endsWith(']]>')) {
    body = body.slice('<![CDATA['.length, -']]>'.length).trim();
  }
  if (body.includes('<')) {
    return { skeleton, signature: null };
  }
  if (body.includes('&')) {
    body = body.replace(LINE_BREAK_REFERENCE, '');
  }
  return { skeleton, signature: body === '' ? null : body };
}

/**
 * base64 → bytes, a slice at a time.
 *
 * Whitespace is dropped as it goes (XML base64 may be line-wrapped) and every slice is cut at a
 * quartet boundary by the same helper the VoDZ stream uses, so the slices decode exactly as the whole.
 */
export async function decodeBase64Async(b64: string): Promise<Uint8Array> {
  const out = new Uint8Array(Math.ceil(b64.length / 4) * 3);
  let at = 0;
  let carry = '';
  for (let from = 0; from < b64.length; from += BASE64_SLICE) {
    const piece = alignBase64Chunk(carry, b64.slice(from, from + BASE64_SLICE));
    carry = piece.carry;
    at = writeBinary(atob(piece.emit), out, at);
    if (from + BASE64_SLICE < b64.length) {
      await yieldToScheduler();
    }
  }
  if (carry !== '') {
    // An unpadded tail. Padded here so the decoder takes it; a single stray character still throws.
    at = writeBinary(atob(carry.padEnd(Math.ceil(carry.length / 4) * 4, '=')), out, at);
  }
  return out.subarray(0, at);
}

function writeBinary(binary: string, out: Uint8Array, at: number): number {
  for (let i = 0; i < binary.length; i++) {
    out[at + i] = binary.charCodeAt(i);
  }
  return at + binary.length;
}

function asciiBytes(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) {
    out[i] = text.charCodeAt(i);
  }
  return out;
}

/** Where `needle` starts at or after `from`, starting before `limit`, or -1. */
function indexOfBytes(b: Uint8Array, needle: Uint8Array, from: number, limit: number): number {
  // The first byte is found natively; only its hits are compared by hand.
  const window = b.subarray(0, Math.min(limit, b.length));
  for (let i = window.indexOf(needle[0], from); i >= 0; i = window.indexOf(needle[0], i + 1)) {
    if (i + needle.length > b.length) {
      return -1;
    }
    let k = 1;
    while (k < needle.length && b[i + k] === needle[k]) {
      k++;
    }
    if (k === needle.length) {
      return i;
    }
  }
  return -1;
}

/** The last place `needle` starts after `after`, or -1. */
function lastIndexOfBytes(b: Uint8Array, needle: Uint8Array, after: number): number {
  let i = b.length - needle.length;
  while (i > after) {
    // `lastIndexOf` with a negative index counts from the END, so the loop stops before one exists.
    i = b.lastIndexOf(needle[0], i);
    if (i <= after) {
      return -1;
    }
    let k = 1;
    while (k < needle.length && b[i + k] === needle[k]) {
      k++;
    }
    if (k === needle.length) {
      return i;
    }
    i--;
  }
  return -1;
}

/** A DER/BER length at `i`: the value (-1 for the indefinite form) and how many bytes it took. */
function readLength(b: Uint8Array, i: number): { len: number; header: number } | null {
  if (i >= b.length) {
    return null;
  }
  const first = b[i];
  if (first < 0x80) {
    return { len: first, header: 1 };
  }
  const count = first & 0x7f;
  if (count === 0) {
    return { len: -1, header: 1 };
  }
  if (count > 4 || i + count >= b.length) {
    return null;
  }
  let len = 0;
  for (let k = 1; k <= count; k++) {
    len = len * 256 + b[i + k];
  }
  return { len, header: 1 + count };
}

/**
 * Collect the octets of the OCTET STRING at `i` into `parts`; returns the index after it, or -1.
 *
 * Primitive, constructed, constructed inside constructed, and the indefinite-length form ended by two
 * zero bytes. Strict on purpose: the old reader stopped at the first surprise and returned what it
 * had, and a message cut short in the middle of an attachment's base64 is a corrupt file that looks
 * like a downloaded one.
 */
function readOctets(b: Uint8Array, i: number, parts: Uint8Array[], depth: number): number {
  if (depth > MAX_NESTING || i >= b.length) {
    return -1;
  }
  const tag = b[i];
  const length = readLength(b, i + 1);
  if (length == null) {
    return -1;
  }
  let p = i + 1 + length.header;
  if (tag === TAG_OCTET_STRING) {
    const end = p + length.len;
    if (length.len < 0 || end > b.length) {
      return -1;
    }
    parts.push(b.subarray(p, end));
    return end;
  }
  if (tag !== TAG_OCTET_STRING_CONSTRUCTED) {
    return -1;
  }
  if (length.len >= 0) {
    const end = p + length.len;
    if (end > b.length) {
      return -1;
    }
    while (p < end) {
      p = readOctets(b, p, parts, depth + 1);
      if (p < 0 || p > end) {
        return -1;
      }
    }
    return end;
  }
  for (;;) {
    if (p + 1 >= b.length) {
      return -1;
    }
    if (b[p] === 0 && b[p + 1] === 0) {
      return p + 2;
    }
    p = readOctets(b, p, parts, depth + 1);
    if (p < 0) {
      return -1;
    }
  }
}

function concat(parts: Uint8Array[]): Uint8Array {
  if (parts.length === 1) {
    return parts[0];
  }
  let total = 0;
  for (const part of parts) {
    total += part.length;
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/** The encapsulated content of a SignedData, joined into one buffer. */
function eContentOf(b: Uint8Array): EContent {
  for (let from = 0; ; ) {
    const at = indexOfBytes(b, ID_DATA, from, ECONTENT_WINDOW);
    if (at < 0) {
      return { kind: 'notCms' };
    }
    from = at + 1;
    const tagAt = at + ID_DATA.length;
    if (b[tagAt] !== TAG_ECONTENT) {
      continue; // the content-type attribute, not the content
    }
    const wrapper = readLength(b, tagAt + 1);
    if (wrapper == null) {
      return { kind: 'malformed' };
    }
    const parts: Uint8Array[] = [];
    if (readOctets(b, tagAt + 1 + wrapper.header, parts, 0) < 0) {
      return { kind: 'malformed' };
    }
    return { kind: 'content', bytes: concat(parts) };
  }
}

const isNameByte = (c: number): boolean =>
  (c >= 0x30 && c <= 0x39) || (c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a) || c === 0x2d || c === 0x2e || c === 0x5f;

/**
 * The `<` of the tag whose local name starts at `at`, or -1 when this is an incidental match - text,
 * a longer name, or bytes inside the DER.
 */
function openingTagStart(b: Uint8Array, at: number, nameLength: number): number {
  const after = b[at + nameLength];
  if (!(after === GT || after === SLASH || after === 0x20 || after === 0x09 || after === 0x0a || after === 0x0d)) {
    return -1;
  }
  if (b[at - 1] === LT) {
    return at - 1;
  }
  if (b[at - 1] !== COLON) {
    return -1;
  }
  let i = at - 2;
  while (i >= 0 && at - i < 34 && isNameByte(b[i])) {
    i--;
  }
  return i >= 0 && b[i] === LT && i < at - 2 ? i : -1;
}

/** The message element: from its opening tag to the end of its closing tag. */
function locateRoot(b: Uint8Array): Range | null {
  for (const name of ROOTS) {
    for (let from = 0; ; ) {
      const at = indexOfBytes(b, name, from, ROOT_WINDOW);
      if (at < 0) {
        break;
      }
      from = at + 1;
      const open = openingTagStart(b, at, name.length);
      if (open < 0) {
        continue;
      }
      const qualified = b.subarray(open + 1, at + name.length); // e.g. "q:MessageDownloadResponse"
      const closing = new Uint8Array(qualified.length + 3);
      closing.set([LT, SLASH]);
      closing.set(qualified, 2);
      closing[closing.length - 1] = GT;
      const close = lastIndexOfBytes(b, closing, at);
      if (close < 0) {
        continue;
      }
      return { start: open, end: close + closing.length };
    }
  }
  return null;
}

/** The index of `value` in [from, end), or -1. */
function indexOfByte(b: Uint8Array, value: number, from: number, end: number): number {
  const i = b.indexOf(value, from);
  return i >= 0 && i < end ? i : -1;
}

/** The tag between `lt` and `gt`, when it opens a `dmEncodedContent` (any prefix): its qualified name. */
function encodedContentTag(b: Uint8Array, lt: number, gt: number): string | null {
  let localStart = lt + 1;
  let i = lt + 1;
  while (i < gt && (isNameByte(b[i]) || b[i] === COLON)) {
    if (b[i] === COLON) {
      localStart = i + 1;
    }
    i++;
  }
  if (i === lt + 1 || i - localStart !== ENCODED_CONTENT.length || b[gt - 1] === SLASH) {
    return null;
  }
  for (let k = 0; k < ENCODED_CONTENT.length; k++) {
    if (b[localStart + k] !== ENCODED_CONTENT[k]) {
      return null;
    }
  }
  return String.fromCharCode.apply(null, b.subarray(lt + 1, i) as unknown as number[]);
}

/**
 * The message XML with every attachment body replaced by a placeholder, and where each body was.
 *
 * A body ends at the next `<`, because base64 cannot contain one - so a body of any size is skipped
 * by one native search rather than walked. The opening tag is written back WITHOUT attributes, so the
 * parser always hands back the placeholder as plain text.
 */
async function skeletonOf(b: Uint8Array, root: Range): Promise<{ xml: string; bodies: Range[] }> {
  const bodies: Range[] = [];
  const parts: string[] = [];
  let piece = root.start;
  let p = root.start;
  for (;;) {
    const lt = indexOfByte(b, LT, p, root.end);
    const gt = lt < 0 ? -1 : indexOfByte(b, GT, lt + 1, root.end);
    if (gt < 0) {
      break;
    }
    const tag = encodedContentTag(b, lt, gt);
    const bodyEnd = tag == null ? -1 : indexOfByte(b, LT, gt + 1, root.end);
    if (tag == null || bodyEnd < 0) {
      p = gt + 1;
      continue;
    }
    parts.push(await decodeUtf8Async(b.subarray(piece, lt)), `<${tag}>`, placeholder(bodies.length));
    bodies.push({ start: gt + 1, end: bodyEnd });
    piece = bodyEnd;
    p = bodyEnd;
  }
  parts.push(await decodeUtf8Async(b.subarray(piece, root.end)));
  return { xml: parts.join(''), bodies };
}

/** A body's base64 as a string, from its bytes. ASCII by construction, so no UTF-8 decode is needed. */
async function asciiOf(b: Uint8Array, range: Range): Promise<string> {
  const parts: string[] = [];
  let slices = 0;
  for (let i = range.start; i < range.end; i += CHAR_CODE_SLICE) {
    const end = Math.min(i + CHAR_CODE_SLICE, range.end);
    parts.push(String.fromCharCode.apply(null, b.subarray(i, end) as unknown as number[]));
    slices++;
    if (slices % SLICES_PER_YIELD === 0 && end < range.end) {
      await yieldToScheduler();
    }
  }
  return parts.join('');
}

/** Find the first node (depth-first) that has `key` as a direct child. */
function findNodeWith(obj: unknown, key: string): AnyNode | undefined {
  if (obj == null || typeof obj !== 'object') {
    return undefined;
  }
  const node = obj as AnyNode;
  if (key in node) {
    return node;
  }
  for (const value of Object.values(node)) {
    const found = findNodeWith(value, key);
    if (found) {
      return found;
    }
  }
  return undefined;
}

/** The detail, whichever of the three roots the document was cut at. */
function detailOf(doc: AnyNode): MessageDetail | null {
  const container = findNodeWith(doc, 'dmReturnedMessage');
  if (container) {
    return parseMessageDownload(container);
  }
  // A ZFO that exposes dmDm directly, with no dmReturnedMessage layer.
  const holder = findNodeWith(doc, 'dmDm');
  return holder ? parseMessageDownload({ dmReturnedMessage: holder }) : null;
}
