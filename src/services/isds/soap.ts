// SOAP 1.1 envelope build + parse for ISDS (feature 001). Pure - unit-testable, no I/O.
// Operations and namespace come from the vendored db_access.wsdl (namespace v20, empty soapAction).

import { XMLParser } from 'fast-xml-parser';
import type {
  BigAttachmentRef,
  MessageAttachment,
  MessageDetail,
  MessageEnvelope,
  OutgoingDocument,
  OwnerInfo,
  Recipient,
  RecipientDbType,
} from './types';

export const ISDS_NS = 'http://isds.czechpoint.cz/v20';
const SOAP_NS = 'http://schemas.xmlsoap.org/soap/envelope/';

/** ISDS db status code for "OK / done". */
export const STATUS_OK = '0000';

/**
 * dmStatusCode 1281 - "Zvolená služba není určena pro tento typ zprávy." Returned by the ordinary
 * downloads (SignedSentMessageDownload, SignedMessageDownload, MessageDownload) for a large-volume
 * (VoDZ, >20 MB) message, which only the large-volume download service can serve, and by that service
 * for a message that is not one (bulletin 2175 §3.8). It routes a download to the VoDZ path.
 */
export const STATUS_WRONG_SERVICE_FOR_TYPE = '1281';

/**
 * dmStatusCode 1299 - returned by `DownloadAttachment` when there is no enclosure at the requested
 * `attNum` (i.e. we have walked past the last one). Confirmed live on czebox (attNum=1 on a
 * single-enclosure message). Used as the loop terminator when downloading VoDZ enclosures.
 */
export const STATUS_VODZ_NO_SUCH_ATTACHMENT = '1299';

/**
 * dmStatusCode 1219 - the one code ISDS documents for a message it has deleted. "Je-li zpráva již
 * smazaná (po 90 dnech po doručení nebo 3 letech po dodání), skončí pokus chybou 1219. Nemá smysl
 * opakovat v tomto případě pokusy o stažení" - written for MessageDownload and SignedMessageDownload
 * (WS_manipulace_s_datovymi_zpravami v3.0, 14. 12. 2023, §2.6.1 and §2.6.3); SignedBigMessageDownload
 * and SignedSentBigMessageDownload are "shodná" with their ordinary services (§2.6.4, §2.6.6), and
 * EraseMessage answers 1219 for a message "není nalezena mezi došlými či odeslanými zprávami". No
 * other code in that document means deleted or nonexistent, so no other code may record a message as
 * gone (004 research R8).
 */
export const STATUS_MESSAGE_DELETED = '1219';

/** Wrap an operation body in a SOAP 1.1 envelope (prefix `p` = the ISDS v20 namespace). */
export function buildEnvelope(operation: string, innerXml = ''): string {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    `<soapenv:Envelope xmlns:soapenv="${SOAP_NS}" xmlns:p="${ISDS_NS}">` +
    `<soapenv:Body><p:${operation}>${innerXml}</p:${operation}></soapenv:Body>` +
    '</soapenv:Envelope>'
  );
}

// Both ops take the dummy input (tDummyInput → dbDummy); ISDS ignores the value.
export const buildGetOwnerInfoFromLogin = (): string =>
  buildEnvelope('GetOwnerInfoFromLogin', '<p:dbDummy></p:dbDummy>');
export const buildGetPasswordInfo = (): string =>
  buildEnvelope('GetPasswordInfo', '<p:dbDummy></p:dbDummy>');
// The OTP login (as/processLogin) is driven by a SOAP DummyOperation request (per libdatovka).
export const buildDummyOperation = (): string =>
  buildEnvelope('DummyOperation');

/** dmStatusFilter bitmask for "all message states" (libdatovka MESSAGESTATE_ANY = 0x3FF). */
export const DM_STATUS_FILTER_ALL = '1023';

/**
 * GetListOfReceivedMessages request. The nillable date/org-unit filters are sent as xsi:nil; we ask
 * for all states and a page. Element order follows the XSD sequence (tListOfFReceivedInput).
 */
export function buildGetListOfReceivedMessages(
  opts: { statusFilter?: string; offset?: number; limit?: number } = {},
): string {
  const {
    statusFilter = DM_STATUS_FILTER_ALL,
    offset = 1,
    limit = 1000,
  } = opts;
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    `<soapenv:Envelope xmlns:soapenv="${SOAP_NS}" xmlns:p="${ISDS_NS}" ` +
    'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
    '<soapenv:Body><p:GetListOfReceivedMessages>' +
    '<p:dmFromTime xsi:nil="true"/>' +
    '<p:dmToTime xsi:nil="true"/>' +
    '<p:dmRecipientOrgUnitNum xsi:nil="true"/>' +
    `<p:dmStatusFilter>${statusFilter}</p:dmStatusFilter>` +
    `<p:dmOffset>${offset}</p:dmOffset>` +
    `<p:dmLimit>${limit}</p:dmLimit>` +
    '</p:GetListOfReceivedMessages></soapenv:Body></soapenv:Envelope>'
  );
}

/**
 * GetListOfSentMessages request (dmInfo `/DS/dx`, feature 005). Same shape as the received list but
 * with `dmSenderOrgUnitNum` (xsi:nil) - used to reconcile a possibly-sent message after an ambiguous
 * timeout (no double-charge). The response (`GetListOfSentMessagesResponse`) is parsed by `parseMessageList`.
 */
export function buildGetListOfSentMessages(
  opts: { statusFilter?: string; offset?: number; limit?: number } = {},
): string {
  const {
    statusFilter = DM_STATUS_FILTER_ALL,
    offset = 1,
    limit = 1000,
  } = opts;
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    `<soapenv:Envelope xmlns:soapenv="${SOAP_NS}" xmlns:p="${ISDS_NS}" ` +
    'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
    '<soapenv:Body><p:GetListOfSentMessages>' +
    '<p:dmFromTime xsi:nil="true"/>' +
    '<p:dmToTime xsi:nil="true"/>' +
    '<p:dmSenderOrgUnitNum xsi:nil="true"/>' +
    `<p:dmStatusFilter>${statusFilter}</p:dmStatusFilter>` +
    `<p:dmOffset>${offset}</p:dmOffset>` +
    `<p:dmLimit>${limit}</p:dmLimit>` +
    '</p:GetListOfSentMessages></soapenv:Body></soapenv:Envelope>'
  );
}

/**
 * MessageDownload request (dmOperations service, `/DS/dz`). Input is `tIDMessInput` → a single
 * `dmID`; the response carries the full envelope plus every file's base64 content. Used for the
 * message detail + attachment download.
 */
export function buildMessageDownload(dmID: string): string {
  return buildEnvelope('MessageDownload', `<p:dmID>${dmID}</p:dmID>`);
}

/**
 * SignedMessageDownload request (dmOperations, `/DS/dz`, 004 amendment). The same input, endpoint and
 * authentication as MessageDownload; the answer is `dmSignature` - the message as the operator sealed
 * it, the .zfo - instead of the bare XML. Received messages are downloaded this way so the archive
 * keeps the original and not only what it said.
 */
export function buildSignedMessageDownload(dmID: string): string {
  return buildEnvelope('SignedMessageDownload', `<p:dmID>${dmID}</p:dmID>`);
}

/**
 * MarkMessageAsDownloaded request (dmInfo service, `/DS/dx`). Input is `tIDMessInput` → a single
 * `dmID`; marks the message as read/downloaded (dmMessageStatus → 7) server-side. Used to mark a
 * message read when its detail is opened (we no longer auto-download, which used to mark it).
 */
export function buildMarkMessageAsDownloaded(dmID: string): string {
  return buildEnvelope('MarkMessageAsDownloaded', `<p:dmID>${dmID}</p:dmID>`);
}

/** Escape XML special characters in user-supplied text (a recipient query is free-form). */
function escapeXml(s: string): string {
  return s.replace(
    /[<>&'"]/g,
    c =>
      ((
        {
          '<': '&lt;',
          '>': '&gt;',
          '&': '&amp;',
          "'": '&apos;',
          '"': '&quot;',
        } as Record<string, string>
      )[c]),
  );
}

/**
 * ISDSSearch3 request (db_search service, `/DS/df`, feature 005) - the FULLTEXT search the web portal
 * uses for "Nová zpráva → Adresát". One field, all box types: `searchType=GENERAL` (by name) +
 * `searchScope=ALL`. (The structured `FindDataBox2` requires a `dbType` - czebox `dbStatusCode 1101`
 * "Nutno specifikovat typ schránky" - so it's reserved for an optional later "advanced search".)
 */
export function buildISDSSearch3(
  query: string,
  opts: {
    searchType?: string;
    searchScope?: string;
    page?: number;
    pageSize?: number;
  } = {},
): string {
  const {
    searchType = 'GENERAL',
    searchScope = 'ALL',
    page = 0,
    pageSize = 50,
  } = opts;
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    `<soapenv:Envelope xmlns:soapenv="${SOAP_NS}" xmlns:p="${ISDS_NS}">` +
    '<soapenv:Body><p:ISDSSearch3>' +
    `<p:searchText>${escapeXml(query.trim())}</p:searchText>` +
    `<p:searchType>${searchType}</p:searchType>` +
    `<p:searchScope>${searchScope}</p:searchScope>` +
    `<p:page>${page}</p:page>` +
    `<p:pageSize>${pageSize}</p:pageSize>` +
    '<p:highlighting>false</p:highlighting>' +
    '</p:ISDSSearch3></soapenv:Body></soapenv:Envelope>'
  );
}

/**
 * CreateMessage request (dmOperations service, `/DS/dz`, feature 005). Input `tMessageCreateInput` =
 * `dmEnvelope` (the create-only envelope `gMessageEnvelopeSub`: 18 ordered fields - only
 * `dbIDRecipient` + `dmAnnotation` carry values, the rest are `xsi:nil`) + `dmFiles` (≥1 `dmFile`, the
 * first `dmFileMetaType="main"`, content as base64 `dmEncodedContent`). DZ-vs-paid-PDZ is decided by
 * the recipient box type, not a flag here. VALIDATED on czebox: a free send to an OVM (with an
 * attachment) is accepted and returns a `dmID`. (The paid PDZ path is not yet send-validated.)
 */
// The create-only message envelope (`gMessageEnvelopeSub` / `tBigMessEnvelope` share this ordered
// prefix): only dbIDRecipient + dmAnnotation carry values, every other field is xsi:nil. Used by both
// CreateMessage and CreateBigMessage (the big envelope's optional trailing dmOVM/dmPublishOwnID are
// omitted - both nillable/optional).
function buildSendEnvelopeFields(
  recipientBoxId: string,
  subject: string,
): string {
  const nil = (name: string) => `<p:${name} xsi:nil="true"/>`;
  return (
    nil('dmSenderOrgUnit') +
    nil('dmSenderOrgUnitNum') +
    `<p:dbIDRecipient>${escapeXml(recipientBoxId)}</p:dbIDRecipient>` +
    nil('dmRecipientOrgUnit') +
    nil('dmRecipientOrgUnitNum') +
    nil('dmToHands') +
    `<p:dmAnnotation>${escapeXml(subject)}</p:dmAnnotation>` +
    nil('dmRecipientRefNumber') +
    nil('dmSenderRefNumber') +
    nil('dmRecipientIdent') +
    nil('dmSenderIdent') +
    nil('dmLegalTitleLaw') +
    nil('dmLegalTitleYear') +
    nil('dmLegalTitleSect') +
    nil('dmLegalTitlePar') +
    nil('dmLegalTitlePoint') +
    nil('dmPersonalDelivery') +
    nil('dmAllowSubstDelivery')
  );
}

/** One inline `dmFile` (base64 content) - used by CreateMessage and the inline part of CreateBigMessage. */
function buildInlineDmFile(f: OutgoingDocument): string {
  return (
    `<p:dmFile dmMimeType="${escapeXml(f.mimeType)}" ` +
    `dmFileMetaType="${f.isMain ? 'main' : 'enclosure'}" ` +
    `dmFileDescr="${escapeXml(f.fileName)}">` +
    `<p:dmEncodedContent>${f.contentBase64}</p:dmEncodedContent>` +
    '</p:dmFile>'
  );
}

export function buildCreateMessage(
  recipientBoxId: string,
  subject: string,
  files: readonly OutgoingDocument[],
): string {
  const envelope = buildSendEnvelopeFields(recipientBoxId, subject);
  const dmFiles = files.map(buildInlineDmFile).join('');
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    `<soapenv:Envelope xmlns:soapenv="${SOAP_NS}" xmlns:p="${ISDS_NS}" ` +
    'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
    '<soapenv:Body><p:CreateMessage>' +
    `<p:dmEnvelope>${envelope}</p:dmEnvelope>` +
    `<p:dmFiles>${dmFiles}</p:dmFiles>` +
    '</p:CreateMessage></soapenv:Body></soapenv:Envelope>'
  );
}

/**
 * CreateBigMessage request (VoDZ service, `ws2` `/vdz_ws/`, feature 005 US3). Input `tBigMessageInput` =
 * `dmEnvelope` (`tBigMessEnvelope` - same ordered prefix as CreateMessage) + `dmFiles` with:
 *   - ≥1 **`dmExtFile`** (REQUIRED): a large file already uploaded via `UploadAttachment`, referenced by
 *     `dmAttID` + two DIFFERENT-algorithm hashes (`dmAttHash1`/`dmAttHash1Alg`, `dmAttHash2`/`dmAttHash2Alg`).
 *     Carries NO content (the upload did). The first file is `dmFileMetaType="main"`.
 *   - optional **`dmFile`** (0..n): small INLINE files, identical to CreateMessage's `dmFile`.
 * Response `tBigMessageOutput` = `dmID` + `dmStatus`, parsed by {@link parseCreateBigMessage}.
 *
 * NOTE: the `dmExtFile` content/upload + the exact required hash pair must be confirmed against czebox
 * (contract `isds-bigmessage.md`, B0) before the live path is trusted; this builder follows the XSD.
 */
export function buildCreateBigMessage(
  recipientBoxId: string,
  subject: string,
  extFiles: readonly BigAttachmentRef[],
  inlineFiles: readonly OutgoingDocument[] = [],
): string {
  const envelope = buildSendEnvelopeFields(recipientBoxId, subject);
  const dmExtFiles = extFiles
    .map(
      e =>
        `<p:dmExtFile dmFileMetaType="${e.isMain ? 'main' : 'enclosure'}" ` +
        `dmAttID="${escapeXml(e.attId)}" ` +
        `dmAttHash1="${escapeXml(e.hash1)}" dmAttHash1Alg="${escapeXml(
          e.hash1Alg,
        )}" ` +
        `dmAttHash2="${escapeXml(e.hash2)}" dmAttHash2Alg="${escapeXml(
          e.hash2Alg,
        )}"/>`,
    )
    .join('');
  const dmFiles = inlineFiles.map(buildInlineDmFile).join('');
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    `<soapenv:Envelope xmlns:soapenv="${SOAP_NS}" xmlns:p="${ISDS_NS}" ` +
    'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
    '<soapenv:Body><p:CreateBigMessage>' +
    `<p:dmEnvelope>${envelope}</p:dmEnvelope>` +
    `<p:dmFiles>${dmExtFiles}${dmFiles}</p:dmFiles>` +
    '</p:CreateBigMessage></soapenv:Body></soapenv:Envelope>'
  );
}

/**
 * UploadAttachment request (VoDZ service, `ws2` `/vdz_ws/`, feature 005 US3). Uploads ONE file's
 * base64 content (`dmFile` with `dmMimeType`/`dmFileDescr` + `dmEncodedContent`); the response returns
 * the server-computed `dmAttID` + two hashes (parsed by {@link parseUploadAttachment}), which then go
 * into `CreateBigMessage`'s `dmExtFile`. The client does NOT compute hashes - the server does.
 */
export function buildUploadAttachment(file: OutgoingDocument): string {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    `<soapenv:Envelope xmlns:soapenv="${SOAP_NS}" xmlns:p="${ISDS_NS}">` +
    '<soapenv:Body><p:UploadAttachment>' +
    `<p:dmFile dmMimeType="${escapeXml(file.mimeType)}" ` +
    `dmFileDescr="${escapeXml(file.fileName)}">` +
    `<p:dmEncodedContent>${file.contentBase64}</p:dmEncodedContent>` +
    '</p:dmFile>' +
    '</p:UploadAttachment></soapenv:Body></soapenv:Envelope>'
  );
}

/**
 * DataBoxCreditInfo request (db_search service, `/DS/df`, feature 005) - the sender box's PDZ credit.
 * Input `tDBCreditInfoInput`: `dbID` + nillable `ciFromDate`/`ciTodate` (note the lowercase `d` -
 * that's the real element name). We only need the current balance, so the dates are xsi:nil.
 */
export function buildDataBoxCreditInfo(dbID: string): string {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    `<soapenv:Envelope xmlns:soapenv="${SOAP_NS}" xmlns:p="${ISDS_NS}" ` +
    'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
    '<soapenv:Body><p:DataBoxCreditInfo>' +
    `<p:dbID>${escapeXml(dbID)}</p:dbID>` +
    '<p:ciFromDate xsi:nil="true"/>' +
    '<p:ciTodate xsi:nil="true"/>' +
    '</p:DataBoxCreditInfo></soapenv:Body></soapenv:Envelope>'
  );
}

const parser = new XMLParser({
  ignoreAttributes: true,
  removeNSPrefix: true, // navigate by local name regardless of soapenv:/p: prefixes
  parseTagValue: false, // keep values as strings (ids, codes)
  trimValues: true,
});

type AnyNode = Record<string, unknown>;

/** Parse a SOAP response and return its Body contents (namespace-stripped), or {} on failure. */
export function parseSoapBody(xml: string): AnyNode {
  const doc = parser.parse(xml) as AnyNode;
  const env = (doc?.Envelope ?? {}) as AnyNode;
  return (env?.Body ?? {}) as AnyNode;
}

/** Read the `dbStatus/dbStatusCode` from a response element, or undefined if absent. */
export function readStatusCode(
  responseNode: AnyNode | undefined,
): string | undefined {
  const status = responseNode?.dbStatus as AnyNode | undefined;
  const code = status?.dbStatusCode;
  return code == null ? undefined : String(code);
}

/**
 * Read the password expiry from a GetPasswordInfo response as epoch ms, or null if absent/invalid.
 * `pswExpDate` is an ISO dateTime; OTP/certificate accounts have no expiry (returns null).
 */
export function readPasswordExpiry(body: AnyNode): number | null {
  const resp = body.GetPasswordInfoResponse as AnyNode | undefined;
  const raw = resp?.pswExpDate;
  if (raw == null || raw === '') {
    return null;
  }
  const ms = Date.parse(String(raw));
  return Number.isNaN(ms) ? null : ms;
}

/** Map an ISDS `dbOwnerInfo` node to the lean app `OwnerInfo`. */
export function toOwnerInfo(
  dbOwnerInfo: AnyNode | undefined,
  passwordExpiresAt: number | null,
): OwnerInfo {
  const o = dbOwnerInfo ?? {};
  const boxId = o.dbID == null ? '' : String(o.dbID);
  const fullName = [o.pnFirstName, o.pnLastName]
    .filter(Boolean)
    .join(' ')
    .trim();
  const label = (o.firmName as string) || fullName || boxId;
  const dbType = o.dbType == null ? null : normalizeDbType(o.dbType);
  return { boxId, label, dbType, passwordExpiresAt };
}

/** Read `dmStatus/dmStatusCode` (the message-service status element), or undefined if absent. */
export function readDmStatusCode(
  responseNode: AnyNode | undefined,
): string | undefined {
  const status = responseNode?.dmStatus as AnyNode | undefined;
  const code = status?.dmStatusCode;
  return code == null ? undefined : String(code);
}

function toEpoch(raw: unknown): number | null {
  if (raw == null || raw === '') {
    return null;
  }
  const ms = Date.parse(String(raw));
  return Number.isNaN(ms) ? null : ms;
}

function str(raw: unknown): string | null {
  // Some ISDS fields can arrive as a structured element (an object) rather than flat text; show
  // nothing rather than "[object Object]".
  if (raw == null || raw === '' || typeof raw === 'object') {
    return null;
  }
  return String(raw);
}

/** Map one ISDS `dmRecord` (tRecord) to the lean app `MessageEnvelope`. */
export function toMessageEnvelope(rec: AnyNode): MessageEnvelope {
  return {
    id: rec.dmID == null ? '' : String(rec.dmID),
    subject: str(rec.dmAnnotation) ?? '',
    sender: str(rec.dmSender) ?? '',
    senderAddress: str(rec.dmSenderAddress),
    recipient: str(rec.dmRecipient),
    recipientAddress: str(rec.dmRecipientAddress),
    recipientBoxId: str(rec.dbIDRecipient),
    deliveryTime: toEpoch(rec.dmDeliveryTime),
    acceptanceTime: toEpoch(rec.dmAcceptanceTime),
    state: rec.dmMessageStatus == null ? 0 : Number(rec.dmMessageStatus),
    attachmentSize:
      rec.dmAttachmentSize == null ? null : Number(rec.dmAttachmentSize),
  };
}

/**
 * Parse a GetListOfReceivedMessages (or Sent) response body into envelopes, newest first. Tolerates
 * the single-record case (fast-xml-parser yields an object, not an array) and an empty/absent list.
 */
export function parseMessageList(body: AnyNode): MessageEnvelope[] {
  const resp = (body.GetListOfReceivedMessagesResponse ??
    body.GetListOfSentMessagesResponse) as AnyNode | undefined;
  const records = (resp?.dmRecords as AnyNode | undefined)?.dmRecord;
  const list = Array.isArray(records) ? records : records ? [records] : [];
  return list
    .map(r => toMessageEnvelope(r as AnyNode))
    .sort((a, b) => (b.deliveryTime ?? 0) - (a.deliveryTime ?? 0));
}

/** Collapse the many ISDS `dbType` sub-codes (OVM_REQ, PFO_ADVOK, …) to our four-way recipient type. */
export function normalizeDbType(raw: unknown): RecipientDbType {
  const t = String(raw ?? '').toUpperCase();
  if (t.startsWith('OVM')) {
    return 'OVM';
  }
  if (t.startsWith('PFO')) {
    return 'PFO';
  }
  if (t.startsWith('PO')) {
    return 'PO';
  }
  return 'FO';
}

/** Map one ISDSSearch3 `dbResult` (tdbResult2) to a lean app `Recipient`. */
function toRecipientFromSearch(r: AnyNode): Recipient {
  const boxId = r.dbID == null ? '' : String(r.dbID);
  const name = str(r.dbName) ?? boxId;
  const place = str(r.dbAddress);
  // dbSendOptions ∈ {DZ, ALL, PDZ, NONE, DISABLED}: PDZ/ALL ⇒ the box accepts a paid commercial (PDZ)
  // message. (OVM boxes take a free DZ regardless; the cost model keys off dbType.)
  const send = String(r.dbSendOptions ?? '').toUpperCase();
  return {
    boxId,
    name,
    // Kept apart from the name since 015. Joined into one string they rendered on one clipped line,
    // and the address - always last - was what got cut, which is precisely the half that tells two
    // people of the same name apart.
    address: place ?? null,
    dbType: normalizeDbType(r.dbType),
    acceptsPdz: send === 'PDZ' || send === 'ALL',
  };
}

/** Parse an ISDSSearch3 (fulltext) response body into recipient hits (tolerates 0/1/many results). */
export function parseISDSSearch3(body: AnyNode): Recipient[] {
  const resp = body.ISDSSearch3Response as AnyNode | undefined;
  const results = (resp?.dbResults as AnyNode | undefined)?.dbResult;
  const list = Array.isArray(results) ? results : results ? [results] : [];
  return list
    .map(r => toRecipientFromSearch(r as AnyNode))
    .filter(r => r.boxId !== '');
}

/** Parse a CreateMessage response → the new message id (`dmID`), or null if absent. */
export function parseCreateMessage(body: AnyNode): string | null {
  const resp = body.CreateMessageResponse as AnyNode | undefined;
  return resp?.dmID == null ? null : String(resp.dmID);
}

/** Parse a CreateBigMessage response (`tBigMessageOutput`) → the new `dmID`, or null if absent. */
export function parseCreateBigMessage(body: AnyNode): string | null {
  const resp = body.CreateBigMessageResponse as AnyNode | undefined;
  return resp?.dmID == null ? null : String(resp.dmID);
}

/**
 * Parse an UploadAttachmentResponse → the uploaded file's `dmAttID` + the two SERVER-computed hashes
 * (value + `AttHashAlg` algorithm), as a `dmExtFile` reference for CreateBigMessage. Returns null if
 * `dmAttID` is absent. The hash elements carry their algorithm as an attribute, so this MUST be given
 * an attribute-keeping body (`parseSoapBodyWithAttrs`).
 */
export function parseUploadAttachment(
  body: AnyNode,
): Omit<BigAttachmentRef, 'isMain'> | null {
  const resp = body.UploadAttachmentResponse as AnyNode | undefined;
  if (resp?.dmAttID == null) {
    return null;
  }
  // An element with text + an attribute parses to `{ '#text': value, '@_AttHashAlg': alg }`; a plain
  // string when it somehow has no attribute. Tolerate both.
  const readHash = (node: unknown): { value: string; alg: string } => {
    if (node != null && typeof node === 'object') {
      const o = node as AnyNode;
      return {
        value: String(o['#text'] ?? ''),
        alg: String(o['@_AttHashAlg'] ?? ''),
      };
    }
    return { value: node == null ? '' : String(node), alg: '' };
  };
  const h1 = readHash(resp.dmAttHash1);
  const h2 = readHash(resp.dmAttHash2);
  return {
    attId: String(resp.dmAttID),
    hash1: h1.value,
    hash1Alg: h1.alg,
    hash2: h2.value,
    hash2Alg: h2.alg,
  };
}

/**
 * Parse a DataBoxCreditInfo response → the current PDZ credit in CZK. `currentCredit` is an integer in
 * haléře (1/100 CZK); we convert to CZK. Unit confirmed live on czebox 2026-06-17: a known 70 CZK
 * top-up read back as 70 Kč on the box overview.
 */
export function parseDataBoxCreditInfo(body: AnyNode): number {
  const resp = body.DataBoxCreditInfoResponse as AnyNode | undefined;
  const haler = resp?.currentCredit == null ? 0 : Number(resp.currentCredit);
  return Number.isFinite(haler) ? haler / 100 : 0;
}

// A second parser that KEEPS attributes: a downloaded `dmFile`'s metadata (dmFileDescr, dmMimeType,
// dmFileMetaType, dmFileGuid) are XML attributes, not child elements - the shared `parser` above
// drops them (ignoreAttributes:true). The base64 payload is the `<dmEncodedContent>` child element.
const attrParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
  parseTagValue: false,
  trimValues: true,
});

/** Parse a SOAP response keeping attributes; returns its Body contents, or {} on failure. */
export function parseSoapBodyWithAttrs(xml: string): AnyNode {
  const doc = attrParser.parse(xml) as AnyNode;
  const env = (doc?.Envelope ?? {}) as AnyNode;
  return (env?.Body ?? {}) as AnyNode;
}

/** Parse a whole XML document with the attribute-keeping parser - a signed message's inner XML. */
export function parseXmlWithAttrs(xml: string): AnyNode {
  return attrParser.parse(xml) as AnyNode;
}

/** Read a `dmFile`'s attribute, tolerating either the attribute form (@_name) or a child element. */
function fileAttr(file: AnyNode, name: string): string | null {
  return str(file[`@_${name}`] ?? file[name]);
}

/** Map one attribute-parsed `dmFile` node to a lean `MessageAttachment`. */
function toAttachment(file: AnyNode): MessageAttachment {
  return {
    name: fileAttr(file, 'dmFileDescr') ?? '',
    mimeType: fileAttr(file, 'dmMimeType') ?? 'application/octet-stream',
    metaType: fileAttr(file, 'dmFileMetaType') ?? 'enclosure',
    contentBase64:
      file.dmEncodedContent == null ? '' : String(file.dmEncodedContent),
  };
}

/**
 * Parse a (attribute-aware) MessageDownloadResponse node into a `MessageDetail`. The envelope lives
 * in `dmReturnedMessage.dmDm`; delivery/acceptance times are on the `tReturnedMessage` wrapper; the
 * files are `dmDm.dmFiles.dmFile[]` (normalize the single-file object case to an array).
 */
export function parseMessageDownload(resp: AnyNode | undefined): MessageDetail {
  const rm = (resp?.dmReturnedMessage ?? {}) as AnyNode;
  const dm = (rm.dmDm ?? {}) as AnyNode;
  const filesNode = (dm.dmFiles as AnyNode | undefined)?.dmFile;
  const files = Array.isArray(filesNode)
    ? filesNode
    : filesNode
    ? [filesNode]
    : [];
  return {
    id: dm.dmID == null ? '' : String(dm.dmID),
    subject: str(dm.dmAnnotation) ?? '',
    sender: str(dm.dmSender) ?? '',
    senderAddress: str(dm.dmSenderAddress),
    recipient: str(dm.dmRecipient),
    recipientAddress: str(dm.dmRecipientAddress),
    deliveryTime: toEpoch(rm.dmDeliveryTime),
    acceptanceTime: toEpoch(rm.dmAcceptanceTime),
    attachments: files.map(f => toAttachment(f as AnyNode)),
  };
}

/**
 * SignedSentMessageDownload request (dmOperations, `/DS/dz`). SENT messages can't be fetched with
 * MessageDownload (received-only); this returns the signed message (a CMS/PKCS#7 blob in `dmSignature`)
 * whose signed content is the same operational message XML. `signedMessage.ts` reads the message out of
 * it, and the blob itself is kept as the message's .zfo (004 amendment, 2026-09-14).
 */
export function buildSignedSentMessageDownload(dmID: string): string {
  return buildEnvelope('SignedSentMessageDownload', `<p:dmID>${dmID}</p:dmID>`);
}

/**
 * VoDZ `DownloadAttachment` request (large-volume service, `ws2` `/DS/vodz`). Fetches ONE enclosure
 * (0-based `attNum`, matching the web portal's `encNum`) of a large-volume message - the only path that
 * serves a >20 MB message's files, and the lean one (per-attachment, so it streams to disk rather than
 * loading the whole message). The response carries the file's metadata + base64 in `dmFile`.
 */
export function buildDownloadAttachment(dmID: string, attNum: number): string {
  return buildEnvelope(
    'DownloadAttachment',
    `<p:dmID>${escapeXml(dmID)}</p:dmID><p:attNum>${attNum}</p:attNum>`,
  );
}

/**
 * The signed original of a large-volume (VoDZ) message (`ws2` `/DS/vodz`, 004 amendment).
 *
 * Not interchangeable with the ordinary signed downloads in either direction: those answer a VoDZ with
 * `1281`, and these answer an ordinary message the same way (bulletin 2175 §3.8). The response has the
 * same `dmSignature` + `dmStatus` shape, but a VoDZ ZFO can exceed a gigabyte (§3.1), so it is never
 * parsed in JS - the VoDZ downloader streams it straight into a file.
 */
export function buildSignedBigMessageDownload(dmID: string, sent: boolean): string {
  return buildEnvelope(
    sent ? 'SignedSentBigMessageDownload' : 'SignedBigMessageDownload',
    `<p:dmID>${escapeXml(dmID)}</p:dmID>`,
  );
}
