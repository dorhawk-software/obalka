import { generatePDF } from 'react-native-html-to-pdf';
import {
  textToPdf,
  TEXT_MESSAGE_FILENAME,
} from '../../src/services/files/textToPdf';

const mockGenerate = generatePDF as jest.Mock;

describe('textToPdf', () => {
  beforeEach(() => mockGenerate.mockClear());

  it('renders text to a "main" PDF OutgoingDocument named "Textová zpráva.pdf"', async () => {
    const doc = await textToPdf('Dobrý den, posílám zprávu.');
    expect(doc).toMatchObject({
      fileName: TEXT_MESSAGE_FILENAME,
      mimeType: 'application/pdf',
      isMain: true,
    });
    expect(doc.contentBase64.length).toBeGreaterThan(0);
    expect(doc.sizeBytes).toBeGreaterThan(0);
  });

  it('escapes HTML in the text and keeps the OS renderer off the JS thread (base64 request)', async () => {
    await textToPdf('<b>A</b> & "B"');
    const opts = mockGenerate.mock.calls[0][0];
    expect(opts.base64).toBe(true);
    expect(opts.html).toContain('&lt;b&gt;A&lt;/b&gt; &amp; &quot;B&quot;');
    expect(opts.html).not.toContain('<b>A</b>'); // raw tag must not leak into the document
  });

  it('strips a file:// prefix from the returned path (kept for the VoDZ upload track)', async () => {
    mockGenerate.mockResolvedValueOnce({
      filePath: 'file:///cache/textova-zprava.pdf',
      base64: 'JVBERi0=',
    });
    const doc = await textToPdf('x');
    expect(doc.localPath).toBe('/cache/textova-zprava.pdf');
  });

  it('rejects whitespace-only text without calling the renderer', async () => {
    await expect(textToPdf('   \n  ')).rejects.toThrow();
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it('throws if the renderer returns no content (caller shows a localized error)', async () => {
    mockGenerate.mockResolvedValueOnce({ filePath: '/cache/x.pdf' });
    await expect(textToPdf('hello')).rejects.toThrow();
  });
});
