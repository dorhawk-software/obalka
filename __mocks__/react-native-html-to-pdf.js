// Manual jest mock — the real module binds a native TurboModule that doesn't exist under jest.
// Returns a tiny fake PDF so the text-to-PDF service is unit-testable and screens can mount.
const generatePDF = jest.fn(async ({ fileName }) => ({
  filePath: `/cache/${fileName || 'document'}.pdf`,
  base64: 'JVBERi0xLjQK', // "%PDF-1.4\n"
  numberOfPages: 1,
}));

module.exports = { __esModule: true, generatePDF };
