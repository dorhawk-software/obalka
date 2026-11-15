// The typed text becomes "Textová zpráva.pdf": a Czech letter on A4 since 2026-11-15 (031 I38.5, board
// R12) - sender, recipient, date, subject, text, in the app's faces. Before, it was the bare text on
// US Letter in the system font.

import { generatePDF } from 'react-native-html-to-pdf';
import {
  letterHtml,
  textToPdf,
  TEXT_MESSAGE_FILENAME,
  type Letter,
} from '../../src/services/files/textToPdf';
import { setActiveLocale } from '../../src/i18n/strings';

const mockGenerate = generatePDF as jest.Mock;

const letter = (over: Partial<Letter> = {}): Letter => ({
  sender: { alias: null, label: 'Ondřej Dvořák', boxId: 'k4m9xrt' },
  recipient: { name: 'Finanční úřad pro hl. m. Prahu', address: 'Štěpánská 619/28, 110 00 Praha 1', boxId: '4n8abqx' },
  subject: 'Žádost o prodloužení lhůty',
  text: 'Dobrý den,\n\nžádám o prodloužení lhůty.',
  writtenAt: new Date(2026, 10, 12, 10, 0).getTime(),
  ...over,
});

describe('textToPdf', () => {
  beforeEach(() => mockGenerate.mockClear());
  afterEach(() => setActiveLocale('cs'));

  it('renders the letter to a "main" PDF OutgoingDocument named "Textová zpráva.pdf"', async () => {
    const doc = await textToPdf(letter());
    expect(doc).toMatchObject({
      fileName: TEXT_MESSAGE_FILENAME,
      mimeType: 'application/pdf',
      isMain: true,
    });
    expect(doc.contentBase64.length).toBeGreaterThan(0);
    expect(doc.sizeBytes).toBeGreaterThan(0);
  });

  it('escapes HTML in the text and keeps the OS renderer off the JS thread (base64 request)', async () => {
    await textToPdf(letter({ text: '<b>A</b> & "B"', subject: '<i>S</i>' }));
    const opts = mockGenerate.mock.calls[0][0];
    expect(opts.base64).toBe(true);
    expect(opts.html).toContain('&lt;b&gt;A&lt;/b&gt; &amp; &quot;B&quot;');
    expect(opts.html).not.toContain('<b>A</b>'); // raw tag must not leak into the document
    expect(opts.html).not.toContain('<i>S</i>');
  });

  it('strips a file:// prefix from the returned path (kept for the VoDZ upload track)', async () => {
    mockGenerate.mockResolvedValueOnce({
      filePath: 'file:///cache/textova-zprava.pdf',
      base64: 'JVBERi0=',
    });
    const doc = await textToPdf(letter({ text: 'x' }));
    expect(doc.localPath).toBe('/cache/textova-zprava.pdf');
  });

  it('rejects whitespace-only text without calling the renderer', async () => {
    await expect(textToPdf(letter({ text: '   \n  ' }))).rejects.toThrow();
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it('throws if the renderer returns no content (caller shows a localized error)', async () => {
    mockGenerate.mockResolvedValueOnce({ filePath: '/cache/x.pdf' });
    await expect(textToPdf(letter({ text: 'hello' }))).rejects.toThrow();
  });
});

describe('the letter (R12)', () => {
  afterEach(() => setActiveLocale('cs'));

  it('is A4 with 25 mm at the sides and 20 at the top and bottom', async () => {
    mockGenerate.mockClear();
    await textToPdf(letter());
    expect(mockGenerate.mock.calls[0][0]).toMatchObject({
      width: 595,
      height: 842,
      paddingLeft: 71,
      paddingRight: 71,
      paddingTop: 57,
      paddingBottom: 57,
    });
  });

  it('runs in the Czech order: sender, recipient, date, subject, text, the foot line', () => {
    const html = letterHtml(letter());
    const at = (s: string) => html.indexOf(s);
    const order = [
      'Ondřej Dvořák',
      'ID datové schránky k4m9xrt',
      'Finanční úřad pro hl. m. Prahu',
      'ID datové schránky 4n8abqx',
      '12. 11. 2026',
      'Žádost o prodloužení lhůty',
      'žádám o prodloužení lhůty.',
      // `t` binds the one-letter preposition to its word, as the board does.
      'Odesláno datovou zprávou z\u00A0aplikace Obálka',
    ].map(at);
    expect(order.every(i => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('sets the recipient address a part to a line, as on an envelope', () => {
    expect(letterHtml(letter())).toContain('Finanční úřad pro hl. m. Prahu<br>Štěpánská 619/28<br>110 00 Praha 1<br>');
  });

  it('is set in Public Sans with the subject in Bricolage, from the app\'s own font files', () => {
    const html = letterHtml(letter());
    expect(html).toMatch(/@font-face\{font-family:'Public Sans';src:url\('[^']*PublicSans-Regular\.ttf'\)/);
    expect(html).toMatch(/\.subject\{[^}]*font-family:'Bricolage Grotesque'[^}]*font-weight:700/);
    expect(html).toContain('lang="cs"');
  });

  it('prints the mark beside the sender in the brand colours', () => {
    expect(letterHtml(letter())).toMatch(/<svg class="mark"[^>]*><path fill="#2563A6"/);
  });

  it('leaves the subject out when there is none, rather than an empty bold line', () => {
    expect(letterHtml(letter({ subject: '  ' }))).not.toContain('class="subject"');
  });

  it('speaks the app\'s language around the text', () => {
    setActiveLocale('en');
    const html = letterHtml(letter());
    expect(html).toContain('Data box ID k4m9xrt');
    expect(html).toContain('12 November 2026');
    expect(html).toContain('Sent as a data message from the Obálka app');
  });
});
