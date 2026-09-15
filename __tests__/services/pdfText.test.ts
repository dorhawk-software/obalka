// PDF text extraction (010 US3, cycle 2).
//
// The parser is injected, so these tests exercise OUR logic - the page cap, the yielding, and above
// all the guarantee that a document the app cannot read produces "no text" rather than a crash. A
// scanned-image decision, an encrypted attachment and a corrupt download are all normal inputs here.
//
// The real parser is proven separately against a hand-built PDF (see the extractor's header); what
// cannot be proven in Node is Hermes, which is why the `Promise.withResolvers` polyfill exists.

import {
  extractPdfText,
  type PdfjsLike,
} from '../../src/services/scan/pdfText';

const fakePdfjs = (pages: string[]): PdfjsLike =>
  ({
    getDocument: () => ({
      promise: Promise.resolve({
        numPages: pages.length,
        getPage: async (n: number) => ({
          getTextContent: async () => ({
            items: pages[n - 1].split(' ').map(str => ({ str })),
          }),
        }),
        destroy: async () => {},
      }),
    }),
  }) as unknown as PdfjsLike;

const run = (pages: string[], maxPages?: number) =>
  extractPdfText(new Uint8Array([1, 2, 3]), {
    loadPdfjs: async () => fakePdfjs(pages),
    maxPages,
  });

describe('extractPdfText', () => {
  it('joins the text of every page', async () => {
    expect(await run(['Uhraďte do', '8. 7. 2026'])).toBe(
      'Uhraďte do\n8. 7. 2026',
    );
  });

  it('stops at the page cap rather than freezing the app', async () => {
    // Principle I: RN's JS is single-threaded, so a 300-page annex parsed greedily is an
    // unresponsive app holding someone's legal mail.
    const many = Array.from({ length: 50 }, (_, i) => `page${i}`);
    const text = await run(many, 3);
    expect(text).toBe('page0\npage1\npage2');
  });

  it('returns null for a document with no text layer - a scanned decision', async () => {
    // Q6 ruled out OCR, so this is a normal outcome and must not look like a failure.
    expect(await run(['', '   '])).toBeNull();
  });

  it('returns null - never throws - when the parser rejects', async () => {
    const out = await extractPdfText(new Uint8Array([0]), {
      loadPdfjs: async () => {
        throw new Error('encrypted');
      },
    });
    expect(out).toBeNull();
  });

  it('returns null when the document itself fails to open', async () => {
    const broken = {
      getDocument: () => ({ promise: Promise.reject(new Error('corrupt')) }),
    } as unknown as PdfjsLike;
    await expect(
      extractPdfText(new Uint8Array([0]), { loadPdfjs: async () => broken }),
    ).resolves.toBeNull();
  });

  it('survives a page that throws midway', async () => {
    const flaky = {
      getDocument: () => ({
        promise: Promise.resolve({
          numPages: 2,
          getPage: async (n: number) => {
            if (n === 2) {
              throw new Error('bad page');
            }
            return { getTextContent: async () => ({ items: [{ str: 'ok' }] }) };
          },
        }),
      }),
    } as unknown as PdfjsLike;
    await expect(
      extractPdfText(new Uint8Array([0]), { loadPdfjs: async () => flaky }),
    ).resolves.toBeNull();
  });

  it('polyfills Promise.withResolvers, which Hermes lacks', async () => {
    // pdf.js 4+ calls it. Without this the feature throws on device while every Node test passes -
    // the worst shape of bug, in an opt-in feature few people would report.
    const P = Promise as unknown as { withResolvers?: unknown };
    const original = P.withResolvers;
    delete P.withResolvers;
    try {
      await run(['x']);
      expect(typeof P.withResolvers).toBe('function');
      const { promise, resolve } = (
        P.withResolvers as <T>() => {
          promise: Promise<T>;
          resolve: (v: T) => void;
        }
      )<string>();
      resolve('works');
      await expect(promise).resolves.toBe('works');
    } finally {
      if (original) {
        P.withResolvers = original;
      }
    }
  });
});
