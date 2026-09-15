// Signed-message fixtures (004 amendment). NOT a test suite (lives under __tests__/helpers/).
//
// Built from the vendored schema rather than copied from a response. `dmBaseTypes.xsd` gives the
// element order of `tReturnedMessage` and `gMessageEnvelope`, the attributes of `tFilesArray`'s
// `dmFile`, the `dmEncodedContent` / `dmXMLContent` choice of `tFile`, and `tSignedMessDownOutput`
// for the SOAP answer. The CMS around the XML is real DER: a ContentInfo holding a SignedData whose
// signer info repeats the id-data OID as its content-type attribute, the way a real seal does. Nothing
// here came off a real box.

import { encodeUtf8 } from '../../src/services/text/textCodec';

export function cat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

export const utf8 = (text: string): Uint8Array => encodeUtf8(text);
export const toBase64 = (bytes: Uint8Array): string => Buffer.from(bytes).toString('base64');

function lengthBytes(n: number): Uint8Array {
  if (n < 0x80) {
    return Uint8Array.of(n);
  }
  const out: number[] = [];
  for (let v = n; v > 0; v = Math.floor(v / 256)) {
    out.unshift(v & 0xff);
  }
  return Uint8Array.of(0x80 | out.length, ...out);
}

/** A definite-length DER element. */
export const der = (tag: number, body: Uint8Array): Uint8Array =>
  cat(Uint8Array.of(tag), lengthBytes(body.length), body);

/** A BER indefinite-length element, closed by two zero bytes. */
export const indefinite = (tag: number, ...children: Uint8Array[]): Uint8Array =>
  cat(Uint8Array.of(tag, 0x80), ...children, Uint8Array.of(0, 0));

const oid = (...arcs: number[]): Uint8Array => der(0x06, Uint8Array.from(arcs));
export const ID_DATA_OID = oid(0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x07, 0x01);
const SIGNED_DATA_OID = oid(0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x07, 0x02);
const SHA256_OID = oid(0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01);
const CONTENT_TYPE_OID = oid(0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x09, 0x03);
const NULL = Uint8Array.of(0x05, 0x00);

/** Deterministic filler for certificates and signatures - it contains `<`, `0x04` and zeros. */
export function noise(size: number, seed = 7): Uint8Array {
  const out = new Uint8Array(size);
  let x = seed;
  for (let i = 0; i < size; i++) {
    x = (x * 1103515245 + 12345) % 2147483648;
    out[i] = x & 0xff;
  }
  return out;
}

/** How the eContent OCTET STRING is encoded. `chunked` is what ISDS writes: ~1 KB segments. */
export type EContentForm = 'primitive' | 'chunked' | 'nested' | 'indefinite';

export function octets(content: Uint8Array, form: EContentForm, segment = 1000): Uint8Array {
  const segments: Uint8Array[] = [];
  for (let i = 0; i < content.length; i += segment) {
    segments.push(der(0x04, content.subarray(i, i + segment)));
  }
  switch (form) {
    case 'primitive':
      return der(0x04, content);
    case 'chunked':
      return der(0x24, cat(...segments));
    case 'nested': {
      const half = Math.ceil(segments.length / 2);
      return der(0x24, cat(der(0x24, cat(...segments.slice(0, half))), ...segments.slice(half)));
    }
    case 'indefinite':
      return indefinite(0x24, ...segments);
  }
}

/**
 * A ContentInfo → SignedData around the message XML: the structure of a real .zfo.
 *
 * `markerFirst` puts an id-data OID that is NOT the content ahead of the real one, which is the trap
 * a byte search for the OID has to step over.
 */
export function signedData(
  xml: string | Uint8Array,
  form: EContentForm = 'chunked',
  opts: { markerFirst?: boolean; segment?: number } = {},
): Uint8Array {
  const content = typeof xml === 'string' ? utf8(xml) : xml;
  const digestAlgorithms = der(
    0x31,
    cat(
      der(0x30, cat(SHA256_OID, NULL)),
      opts.markerFirst ? der(0x30, cat(ID_DATA_OID, NULL)) : new Uint8Array(0),
    ),
  );
  const body = octets(content, form, opts.segment);
  const eContent = form === 'indefinite' ? indefinite(0xa0, body) : der(0xa0, body);
  const encapContentInfo = der(0x30, cat(ID_DATA_OID, eContent));
  const certificates = der(0xa0, der(0x30, noise(900)));
  const signedAttrs = der(0xa0, der(0x30, cat(CONTENT_TYPE_OID, der(0x31, ID_DATA_OID))));
  const signerInfo = der(
    0x30,
    cat(
      der(0x02, Uint8Array.of(1)),
      der(0x30, noise(40, 3)),
      signedAttrs,
      der(0x30, SHA256_OID),
      der(0x04, noise(256, 11)),
    ),
  );
  const signed = der(
    0x30,
    cat(der(0x02, Uint8Array.of(3)), digestAlgorithms, encapContentInfo, certificates, der(0x31, signerInfo)),
  );
  return der(0x30, cat(SIGNED_DATA_OID, der(0xa0, signed)));
}

export interface FixtureFile {
  name: string;
  mimeType?: string;
  metaType?: string;
  /** `dmEncodedContent`. */
  base64?: string;
  /** `dmXMLContent` instead - the other branch of `tFile`'s choice. */
  xml?: string;
  /** Put an attribute on `dmEncodedContent`, as an MTOM-aware writer might. */
  contentAttribute?: string;
}

const V20 = 'http://isds.czechpoint.cz/v20';

function fileXml(p: string, f: FixtureFile): string {
  const body =
    f.xml != null
      ? `<${p}:dmXMLContent>${f.xml}</${p}:dmXMLContent>`
      : `<${p}:dmEncodedContent${f.contentAttribute ? ` ${f.contentAttribute}` : ''}>${f.base64 ?? ''}</${p}:dmEncodedContent>`;
  return (
    `<${p}:dmFile dmMimeType="${f.mimeType ?? 'application/pdf'}" dmFileMetaType="${f.metaType ?? 'main'}" ` +
    `dmFileGuid="guid-${f.name.length}" dmFileDescr="${f.name}">${body}</${p}:dmFile>`
  );
}

/**
 * The message XML inside a ZFO, in `tReturnedMessage` order.
 *
 * `root` cuts it at one of the three roots the reader accepts; `namespace` is `…/v20/SentMessage` for a
 * sent message, which is what czebox returned in 005.
 */
export function messageXml(
  opts: {
    id?: string;
    subject?: string;
    sender?: string;
    files?: FixtureFile[];
    namespace?: string;
    prolog?: boolean;
    root?: 'response' | 'returnedMessage' | 'dm';
  } = {},
): string {
  const p = 'q';
  const ns = `xmlns:${p}="${opts.namespace ?? V20}" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"`;
  const nil = (name: string) => `<${p}:${name} xsi:nil="true"/>`;
  const el = (name: string, value: string) => `<${p}:${name}>${value}</${p}:${name}>`;
  const files = opts.files ?? [{ name: 'Rozhodnutí.pdf', base64: 'JVBERi0xLjcK' }];
  const dm =
    el('dmID', opts.id ?? '1234567') +
    el('dbIDSender', 'abc1234') +
    el('dmSender', opts.sender ?? 'Finanční úřad pro Jihomoravský kraj') +
    el('dmSenderAddress', 'Náměstí Svobody 4, 602 00 Brno') +
    el('dmSenderType', '10') +
    el('dmRecipient', 'Jan Novák') +
    el('dmRecipientAddress', 'Nová 1, 612 00 Brno') +
    el('dmAmbiguousRecipient', 'false') +
    nil('dmSenderOrgUnit') +
    nil('dmSenderOrgUnitNum') +
    el('dbIDRecipient', 'xyz9876') +
    nil('dmRecipientOrgUnit') +
    nil('dmRecipientOrgUnitNum') +
    nil('dmToHands') +
    el('dmAnnotation', opts.subject ?? 'Výzva k doplnění podání') +
    nil('dmRecipientRefNumber') +
    el('dmSenderRefNumber', 'FU/123/2026') +
    nil('dmRecipientIdent') +
    nil('dmSenderIdent') +
    el('dmLegalTitleLaw', '280') +
    el('dmLegalTitleYear', '2009') +
    nil('dmLegalTitleSect') +
    nil('dmLegalTitlePar') +
    nil('dmLegalTitlePoint') +
    el('dmPersonalDelivery', 'false') +
    el('dmAllowSubstDelivery', 'true') +
    el('dmFiles', files.map(f => fileXml(p, f)).join(''));
  const dmDm = `<${p}:dmDm${opts.root === 'dm' ? ` ${ns}` : ''}>${dm}</${p}:dmDm>`;
  const returned =
    `<${p}:dmReturnedMessage dmType="V"${opts.root === 'returnedMessage' ? ` ${ns}` : ''}>` +
    dmDm +
    `<${p}:dmHash algorithm="SHA-256">q83vEjRWeJA9LjI3NWMwZDg=</${p}:dmHash>` +
    el('dmQTimestamp', 'MIIDdTADAgEAMIIDbAYJKoZIhvcNAQcCoIIDXTCCA1kCAQMxDzANBglghkgBZQMEAgEFAA==') +
    el('dmDeliveryTime', '2026-09-01T09:15:00.000+02:00') +
    el('dmAcceptanceTime', '2026-09-01T10:02:00.000+02:00') +
    el('dmMessageStatus', '6') +
    el('dmAttachmentSize', '2') +
    `</${p}:dmReturnedMessage>`;
  const prolog = opts.prolog ? '<?xml version="1.0" encoding="UTF-8"?>' : '';
  if (opts.root === 'dm') {
    return prolog + dmDm;
  }
  if (opts.root === 'returnedMessage') {
    return prolog + returned;
  }
  return `${prolog}<${p}:MessageDownloadResponse ${ns}>${returned}</${p}:MessageDownloadResponse>`;
}

/** The SOAP answer of `SignedMessageDownload` / `SignedSentMessageDownload` (`tSignedMessDownOutput`). */
export function signedDownloadResponse(
  signature: string | null,
  opts: { sent?: boolean; statusCode?: string } = {},
): string {
  const op = opts.sent ? 'SignedSentMessageDownloadResponse' : 'SignedMessageDownloadResponse';
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/"><SOAP-ENV:Body>' +
    `<p:${op} xmlns:p="${V20}">` +
    (signature == null ? '' : `<p:dmSignature>${signature}</p:dmSignature>`) +
    `<p:dmStatus><p:dmStatusCode>${opts.statusCode ?? '0000'}</p:dmStatusCode>` +
    '<p:dmStatusMessage>Provedeno úspěšně.</p:dmStatusMessage></p:dmStatus>' +
    `</p:${op}></SOAP-ENV:Body></SOAP-ENV:Envelope>`
  );
}
