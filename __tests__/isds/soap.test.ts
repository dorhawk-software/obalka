import {
  ISDS_NS,
  STATUS_OK,
  buildCreateBigMessage,
  buildGetOwnerInfoFromLogin,
  buildMarkMessageAsDownloaded,
  buildSignedBigMessageDownload,
  buildSignedMessageDownload,
  buildSignedSentMessageDownload,
  parseCreateBigMessage,
  parseSoapBody,
  readPasswordExpiry,
  readStatusCode,
  toOwnerInfo,
} from '../../src/services/isds/soap';
import type { BigAttachmentRef } from '../../src/services/isds/types';
import { ownerInfoResponse, passwordInfoResponse } from '../helpers/fakeHttp';

describe('SOAP build', () => {
  it('wraps GetOwnerInfoFromLogin in a v20 SOAP envelope with the dummy input', () => {
    const xml = buildGetOwnerInfoFromLogin();
    expect(xml).toContain(`xmlns:p="${ISDS_NS}"`);
    expect(xml).toContain('<p:GetOwnerInfoFromLogin>');
    expect(xml).toContain('<p:dbDummy>');
    expect(xml).toContain('soapenv:Envelope');
  });

  it('wraps MarkMessageAsDownloaded with the dmID', () => {
    const xml = buildMarkMessageAsDownloaded('12345');
    expect(xml).toContain('<p:MarkMessageAsDownloaded>');
    expect(xml).toContain('<p:dmID>12345</p:dmID>');
  });
});

describe('SOAP build - CreateBigMessage (VoDZ / US3)', () => {
  const ext = (over: Partial<BigAttachmentRef> = {}): BigAttachmentRef => ({
    attId: 'att-1',
    isMain: true,
    hash1: 'aaa',
    hash1Alg: 'SHA-1',
    hash2: 'bbb',
    hash2Alg: 'SHA-256',
    ...over,
  });

  it('builds a CreateBigMessage with the recipient + subject envelope and a dmExtFile by id+hashes', () => {
    const xml = buildCreateBigMessage('recipient9', 'Velká zásilka', [ext()]);
    expect(xml).toContain('<p:CreateBigMessage>');
    expect(xml).toContain('<p:dbIDRecipient>recipient9</p:dbIDRecipient>');
    expect(xml).toContain('<p:dmAnnotation>Velká zásilka</p:dmAnnotation>');
    // external file referenced by id + two DIFFERENT-algorithm hashes, no content
    expect(xml).toContain('dmFileMetaType="main"');
    expect(xml).toContain('dmAttID="att-1"');
    expect(xml).toContain('dmAttHash1="aaa" dmAttHash1Alg="SHA-1"');
    expect(xml).toContain('dmAttHash2="bbb" dmAttHash2Alg="SHA-256"');
    expect(xml).not.toContain('dmEncodedContent'); // ext files carry no inline content
  });

  it('marks only the first file main; later ext files are enclosures', () => {
    const xml = buildCreateBigMessage('r', 's', [
      ext({ attId: 'a', isMain: true }),
      ext({ attId: 'b', isMain: false }),
    ]);
    expect(xml).toContain('dmAttID="a"');
    expect(xml).toContain('dmFileMetaType="enclosure"');
  });

  it('can include optional small inline dmFile(s) alongside the external files', () => {
    const xml = buildCreateBigMessage(
      'r',
      's',
      [ext({ isMain: true })],
      [
        {
          fileName: 'note.txt',
          mimeType: 'text/plain',
          sizeBytes: 10,
          contentBase64: 'QUJD',
          isMain: false,
        },
      ],
    );
    expect(xml).toContain('dmAttID="att-1"');
    expect(xml).toContain('dmFileDescr="note.txt"');
    expect(xml).toContain('<p:dmEncodedContent>QUJD</p:dmEncodedContent>');
  });

  it('escapes XML in the subject and attachment id', () => {
    const xml = buildCreateBigMessage('r', 'A & B <x>', [
      ext({ attId: 'a"b' }),
    ]);
    expect(xml).toContain(
      '<p:dmAnnotation>A &amp; B &lt;x&gt;</p:dmAnnotation>',
    );
    expect(xml).toContain('dmAttID="a&quot;b"');
  });

  it('parses a CreateBigMessageResponse → the new dmID (null when absent)', () => {
    const body = parseSoapBody(
      `<?xml version="1.0"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">` +
        `<soapenv:Body><p:CreateBigMessageResponse xmlns:p="${ISDS_NS}">` +
        `<p:dmID>987654</p:dmID><p:dmStatus><p:dmStatusCode>0000</p:dmStatusCode></p:dmStatus>` +
        `</p:CreateBigMessageResponse></soapenv:Body></soapenv:Envelope>`,
    );
    expect(parseCreateBigMessage(body)).toBe('987654');
    expect(parseCreateBigMessage({})).toBeNull();
  });
});

describe('SOAP parse', () => {
  it('reads dbStatusCode from a response', () => {
    const body = parseSoapBody(ownerInfoResponse({ statusCode: STATUS_OK }));
    const resp = body.GetOwnerInfoFromLoginResponse as Record<string, unknown>;
    expect(readStatusCode(resp)).toBe('0000');
  });

  it('keeps status codes as strings (does not coerce "0000" to 0)', () => {
    const body = parseSoapBody(ownerInfoResponse({ statusCode: '0000' }));
    expect(
      readStatusCode(
        body.GetOwnerInfoFromLoginResponse as Record<string, unknown>,
      ),
    ).toBe('0000');
  });

  it('maps dbOwnerInfo to the app OwnerInfo (firmName as label)', () => {
    const body = parseSoapBody(
      ownerInfoResponse({ boxId: 'box1234', firmName: 'Firma s.r.o.' }),
    );
    const resp = body.GetOwnerInfoFromLoginResponse as Record<string, unknown>;
    expect(
      toOwnerInfo(resp.dbOwnerInfo as Record<string, unknown>, null),
    ).toEqual({
      boxId: 'box1234',
      label: 'Firma s.r.o.',
      dbType: null,
      passwordExpiresAt: null,
    });
  });

  it('falls back to person name then boxId for the label', () => {
    expect(
      toOwnerInfo({ dbID: 'b', pnFirstName: 'Jan', pnLastName: 'Novák' }, null),
    ).toEqual({
      boxId: 'b',
      label: 'Jan Novák',
      dbType: null,
      passwordExpiresAt: null,
    });
    expect(toOwnerInfo({ dbID: 'b' }, null).label).toBe('b');
  });

  it('reads password expiry as epoch ms, or null when absent', () => {
    expect(
      readPasswordExpiry(
        parseSoapBody(passwordInfoResponse('2026-09-10T00:00:00')),
      ),
    ).toBe(Date.parse('2026-09-10T00:00:00'));
    expect(
      readPasswordExpiry(parseSoapBody(passwordInfoResponse(''))),
    ).toBeNull();
  });

  // Mirrors the real czebox response: SOAP-ENV prefix, xsi:nil empty firmName, ISO+TZ pswExpDate.
  it('parses the real-world response shape (SOAP-ENV prefix, xsi:nil firmName → name fallback)', () => {
    const real =
      "<?xml version='1.0' encoding='utf-8'?>" +
      '<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/">' +
      '<SOAP-ENV:Body><p:GetOwnerInfoFromLoginResponse xmlns:p="http://isds.czechpoint.cz/v20" ' +
      'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
      '<p:dbOwnerInfo><p:dbID>box1234</p:dbID><p:dbType>FO</p:dbType>' +
      '<p:firmName xsi:nil="true"></p:firmName>' +
      '<p:pnFirstName>Jan</p:pnFirstName><p:pnLastName>Novák</p:pnLastName></p:dbOwnerInfo>' +
      '<p:dbStatus><p:dbStatusCode>0000</p:dbStatusCode>' +
      '<p:dbStatusMessage>Provedeno úspěšně.</p:dbStatusMessage></p:dbStatus>' +
      '</p:GetOwnerInfoFromLoginResponse></SOAP-ENV:Body></SOAP-ENV:Envelope>';
    const resp = parseSoapBody(real).GetOwnerInfoFromLoginResponse as Record<
      string,
      unknown
    >;
    expect(readStatusCode(resp)).toBe(STATUS_OK);
    expect(
      toOwnerInfo(resp.dbOwnerInfo as Record<string, unknown>, null),
    ).toEqual({
      boxId: 'box1234',
      label: 'Jan Novák',
      dbType: 'FO',
      passwordExpiresAt: null,
    });
  });
});

describe('SignedSentMessageDownload (sent attachments)', () => {
  it('wraps the dmID in a v20 SOAP envelope', () => {
    const xml = buildSignedSentMessageDownload('42');
    expect(xml).toContain('<p:SignedSentMessageDownload>');
    expect(xml).toContain('<p:dmID>42</p:dmID>');
  });

  // The parse that used to live here moved with the code to `signedMessage.test.ts` (004 amendment).

  it('asks for a RECEIVED message signed, with the same input MessageDownload takes (004)', () => {
    const xml = buildSignedMessageDownload('42');
    expect(xml).toContain('<p:SignedMessageDownload><p:dmID>42</p:dmID></p:SignedMessageDownload>');
    expect(xml).not.toContain('<p:MessageDownload>');
  });

  it('asks the large-volume service for a VoDZ original, per folder (004)', () => {
    expect(buildSignedBigMessageDownload('7', false)).toContain(
      '<p:SignedBigMessageDownload><p:dmID>7</p:dmID></p:SignedBigMessageDownload>',
    );
    expect(buildSignedBigMessageDownload('7', true)).toContain(
      '<p:SignedSentBigMessageDownload><p:dmID>7</p:dmID></p:SignedSentBigMessageDownload>',
    );
  });
});
