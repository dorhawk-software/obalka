// Reading a message out of its signed original (004 amendment, 2026-09-14).
//
// The received folder now downloads the SIGNED message, so this reader sits on the most-used path in
// the app, and nobody could check it against czebox when it was written. The fixtures are built from
// the schema (`helpers/signedFixtures.ts`) and wrapped in real CMS DER: ISDS's chunked eContent, a
// character or a base64 quartet cut between two segments, the `dmXMLContent` branch of a file, and the
// three roots the reader accepts. The other half matters as much: what it cannot read with confidence
// comes back null, which the transport turns into the unsigned download instead of a broken message.
//
// The sent-folder cases that lived in `soap.test.ts` until then are here too, unchanged in substance.

import {
  cutSignature,
  decodeBase64Async,
  parseSignedMessage,
  parseSignedMessageBytes,
} from '../../src/services/isds/signedMessage';
import {
  cat,
  der,
  ID_DATA_OID,
  messageXml,
  noise,
  signedData,
  toBase64,
  utf8,
  type EContentForm,
} from '../helpers/signedFixtures';

const PDF = Buffer.from('%PDF-1.7\n1 0 obj << /Type /Catalog >> endobj\n').toString('base64');
const SCAN = Buffer.from(noise(5000, 21)).toString('base64');
const SUBJECT = 'Výzva k doplnění podání – přiznání k dani z nemovitých věcí';

const received = (): string =>
  messageXml({
    id: '1234567',
    subject: SUBJECT,
    files: [
      { name: 'Výzva.pdf', base64: PDF },
      {
        name: 'formular.xml',
        mimeType: 'text/xml',
        metaType: 'enclosure',
        xml: '<f:Podani xmlns:f="urn:fs"><f:Castka>1 250 Kč</f:Castka></f:Podani>',
      },
      { name: 'Příloha č. 1 – sken.pdf', metaType: 'enclosure', base64: SCAN },
    ],
  });

describe('reading the message out of a signed original', () => {
  it.each<EContentForm>(['chunked', 'primitive', 'nested', 'indefinite'])(
    'reads a received message from a SignedData whose content is %s',
    async form => {
      const detail = await parseSignedMessageBytes(signedData(received(), form));
      expect(detail).toMatchObject({
        id: '1234567',
        subject: SUBJECT,
        sender: 'Finanční úřad pro Jihomoravský kraj',
        senderAddress: 'Náměstí Svobody 4, 602 00 Brno',
        recipient: 'Jan Novák',
        recipientAddress: 'Nová 1, 612 00 Brno',
        deliveryTime: Date.parse('2026-09-01T09:15:00.000+02:00'),
        acceptanceTime: Date.parse('2026-09-01T10:02:00.000+02:00'),
      });
      // In order, the XML file included: a `dmXMLContent` enclosure carries no base64, and it must not
      // shift the bodies of the files around it.
      expect(detail?.attachments).toEqual([
        { name: 'Výzva.pdf', mimeType: 'application/pdf', metaType: 'main', contentBase64: PDF },
        { name: 'formular.xml', mimeType: 'text/xml', metaType: 'enclosure', contentBase64: '' },
        {
          name: 'Příloha č. 1 – sken.pdf',
          mimeType: 'application/pdf',
          metaType: 'enclosure',
          contentBase64: SCAN,
        },
      ]);
    },
  );

  it('joins a character that a segment boundary cut in two', async () => {
    const bytes = utf8(received());
    // The first two-byte letter in the document is the "č" of the sender; cut straight after its lead.
    const lead = bytes.indexOf(0xc4);
    const detail = await parseSignedMessageBytes(
      signedData(bytes, 'chunked', { segment: lead + 1 }),
    );
    expect(detail?.sender).toBe('Finanční úřad pro Jihomoravský kraj');
  });

  it('keeps a document byte-exact when every few bytes are a segment boundary', async () => {
    const detail = await parseSignedMessageBytes(
      signedData(received(), 'chunked', { segment: 7 }),
    );
    expect(detail?.attachments[2].contentBase64).toBe(SCAN);
  });

  it('steps over an id-data marker that is not the content', async () => {
    const detail = await parseSignedMessageBytes(
      signedData(received(), 'chunked', { markerFirst: true }),
    );
    expect(detail?.id).toBe('1234567');
  });

  it('reads a sent message as czebox returned it: no prolog, the SentMessage namespace', async () => {
    // The diacritics guard the UTF-8 decode - a real file was "Textová zpráva.PDF", which a latin1 read
    // turns into "TextovÃ¡ zprÃ¡va.PDF".
    const xml = messageXml({
      id: '42',
      subject: 'Předmět žádosti',
      namespace: 'http://isds.czechpoint.cz/v20/SentMessage',
      files: [{ name: 'Textová zpráva.PDF', base64: 'SGVsbG8=' }],
    });
    const detail = await parseSignedMessage(toBase64(signedData(xml)));
    expect(detail).toMatchObject({ id: '42', subject: 'Předmět žádosti' });
    expect(detail?.attachments[0]).toMatchObject({
      name: 'Textová zpráva.PDF',
      contentBase64: 'SGVsbG8=',
    });
  });

  it('reads the XML from a blob with no SignedData around it, prolog or not', async () => {
    // The shape the sent-folder tests pinned before 004: a DER-looking header, the XML, trailing bytes.
    for (const prolog of [false, true]) {
      const blob = cat(
        Uint8Array.of(0x30, 0x82, 0x01, 0x00),
        utf8(messageXml({ id: '7', prolog })),
        Uint8Array.of(0x00, 0x01, 0x02, 0x03),
      );
      expect((await parseSignedMessageBytes(blob))?.id).toBe('7');
    }
  });

  it.each(['returnedMessage', 'dm'] as const)(
    'accepts %s as the root when there is no response wrapper',
    async root => {
      const detail = await parseSignedMessageBytes(signedData(messageXml({ id: '99', root })));
      expect(detail?.id).toBe('99');
      expect(detail?.attachments[0].contentBase64).toBe('JVBERi0xLjcK');
    },
  );

  it('takes a body back even when its element carries an attribute', async () => {
    const xml = messageXml({
      files: [{ name: 'a.pdf', base64: PDF, contentAttribute: 'xmime:contentType="application/pdf"' }],
    });
    expect((await parseSignedMessageBytes(signedData(xml)))?.attachments[0].contentBase64).toBe(
      PDF,
    );
  });

  it('hands back line-wrapped base64 whole, for the file store to strip', async () => {
    const wrapped = SCAN.replace(/(.{76})/g, '$1\r\n');
    const detail = await parseSignedMessageBytes(
      signedData(messageXml({ files: [{ name: 'a.pdf', base64: wrapped }] })),
    );
    expect(detail?.attachments[0].contentBase64.replace(/\s+/g, '')).toBe(SCAN);
  });

  it('reads a 3 MB document exactly, yielding to the UI while it does', async () => {
    const big = Buffer.from(noise(3 * 1024 * 1024, 5)).toString('base64');
    const xml = messageXml({ files: [{ name: 'velky-sken.pdf', base64: big }] });
    const signature = toBase64(signedData(xml));
    const timers = jest.spyOn(global, 'setTimeout');
    try {
      const detail = await parseSignedMessage(signature);
      expect(detail?.attachments[0].contentBase64).toBe(big);
      // Constitution I: cut into slices with a macrotask between them, never one long call.
      expect(timers).toHaveBeenCalled();
    } finally {
      timers.mockRestore();
    }
  });
});

describe('what it will not guess at', () => {
  it('refuses a SignedData whose content is broken, even though the XML is right there', async () => {
    // Reading around a broken segment would splice DER framing into an attachment's base64: a corrupt
    // document that looks downloaded. The old reader stopped at the first surprise and did exactly that.
    const content = utf8(received());
    const good = der(0x04, content.subarray(0, 1000));
    const broken = der(0x04, content.subarray(1000));
    broken[0] = 0x05;
    const blob = der(0x30, cat(ID_DATA_OID, der(0xa0, der(0x24, cat(good, broken)))));
    expect(await parseSignedMessageBytes(blob)).toBeNull();
  });

  it('refuses a document with no message in it', async () => {
    expect(await parseSignedMessageBytes(signedData('<x>nic</x>'))).toBeNull();
  });

  it('refuses a message that never closes', async () => {
    const xml = received();
    expect(await parseSignedMessageBytes(signedData(xml.slice(0, xml.length / 2)))).toBeNull();
  });

  it('refuses a message without a dmID', async () => {
    expect(await parseSignedMessageBytes(signedData(messageXml({ id: '' })))).toBeNull();
  });

  it('throws on base64 the decoder cannot take, so the caller can report why', async () => {
    await expect(parseSignedMessage('A')).rejects.toThrow();
  });
});

describe('decoding the signature', () => {
  it('matches a whole decode across slices, line breaks and an unpadded tail', async () => {
    const bytes = noise(2_500_001, 9);
    const wrapped = toBase64(bytes).replace(/(.{76})/g, '$1\n');
    expect(Buffer.from(await decodeBase64Async(wrapped)).equals(Buffer.from(bytes))).toBe(true);
    const unpadded = toBase64(Uint8Array.of(1, 2)).replace(/[=]+$/, '');
    expect(Array.from(await decodeBase64Async(unpadded))).toEqual([1, 2]);
  });
});

// Reviewed 2026-09-14: the transport handed the whole SOAP answer - the signature as one text node - to
// fast-xml-parser, which is seconds of the JS thread for a 20 MB message. It now cuts the body out
// first; this is the cut.
describe('cutting the signature out of the SOAP answer', () => {
  const answer = (element: string) =>
    '<?xml version="1.0" encoding="UTF-8"?><SOAP-ENV:Envelope xmlns:SOAP-ENV="x"><SOAP-ENV:Body>' +
    `<q:SignedMessageDownloadResponse xmlns:q="y">${element}` +
    '<q:dmStatus><q:dmStatusCode>0000</q:dmStatusCode></q:dmStatus>' +
    '</q:SignedMessageDownloadResponse></SOAP-ENV:Body></SOAP-ENV:Envelope>';

  it('hands back the body, and an envelope without it that still says the status', () => {
    const { skeleton, signature } = cutSignature(answer(`<q:dmSignature>${SCAN}</q:dmSignature>`));
    expect(signature).toBe(SCAN);
    expect(skeleton).not.toContain(SCAN);
    expect(skeleton).toContain('<q:dmSignature></q:dmSignature><q:dmStatus><q:dmStatusCode>0000');
  });

  it('reads an element with no prefix, with attributes, wrapped in whitespace', () => {
    expect(
      cutSignature(answer(`<dmSignature xmime:contentType="application/octet-stream">\n ${PDF} \n</dmSignature>`))
        .signature,
    ).toBe(PDF);
  });

  it('drops line breaks written as character references, and unwraps CDATA', () => {
    const wrapped = `${SCAN.slice(0, 76)}&#13;&#10;${SCAN.slice(76, 152)}&#xD;&#xA;${SCAN.slice(152)}`;
    expect(cutSignature(answer(`<q:dmSignature>${wrapped}</q:dmSignature>`)).signature).toBe(SCAN);
    expect(cutSignature(answer(`<q:dmSignature><![CDATA[${PDF}]]></q:dmSignature>`)).signature).toBe(PDF);
  });

  it('finds no signature in an empty element, a refusal, or an MTOM reference', () => {
    expect(cutSignature(answer('<q:dmSignature/>')).signature).toBeNull();
    expect(cutSignature(answer('<q:dmSignature></q:dmSignature>')).signature).toBeNull();
    expect(cutSignature(answer('')).signature).toBeNull();
    expect(
      cutSignature(answer('<q:dmSignature><xop:Include href="cid:zfo"/></q:dmSignature>')).signature,
    ).toBeNull();
  });

  it('gives an answer cut off inside the signature no envelope to read a status from', () => {
    const cut = answer(`<q:dmSignature>${SCAN}</q:dmSignature>`).slice(0, 2000);
    expect(cutSignature(cut)).toEqual({ skeleton: '', signature: null });
  });
});
