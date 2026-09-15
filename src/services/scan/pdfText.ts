// Extracting a PDF's text layer, on device (010 US3, cycle 2).
//
// The only part of scanning that touches a document. It exists behind an opt-in toggle and runs after
// a user-initiated download; nothing here reaches the network, and the text never leaves the phone.
//
// THREE THINGS HERE ARE LOAD-BEARING, and none of them are obvious:
//
// 1. **`isEvalSupported: false`.** pdf.js has shipped an arbitrary-JS-execution hole from a crafted
//    PDF (GHSA-wgrm-67xf-hhpq). This app parses documents sent by anyone who knows the user's box ID,
//    which is a published identifier - so the input is unambiguously untrusted. The version here is a
//    fixed one, and this flag (plus `disableFontFace`) turns off the eval-based font path anyway,
//    because a parser fed hostile government mail should not be one CVE away from executing it.
//
// 2. **Four globals are polyfilled** in `hermesShims.ts`: `Promise.withResolvers`, `TextDecoder`,
//    `TextEncoder` and `structuredClone`. Every one exists in Node and none in Hermes - exactly the
//    shape of bug a green test suite hides, and every one of them was found by running this on a
//    phone.
//
// 3. **The build is `unpdf`'s, not `pdfjs-dist`'s.** unpdf ships pdf.js compiled for environments
//    with no DOM: `pdfjs-dist`'s own builds do not load under Hermes at all - the `legacy` one dies
//    inside a core-js `DOMException` polyfill, the modern one on ES2025 iterator helpers, and both
//    then want `DOMMatrix` from the canvas layer that text extraction never uses.
//
// 4. **The load is lazy, and by `require`.** pdf.js is over a megabyte of JavaScript; someone who
//    never turns scanning on should never pay for evaluating it. See `loadPdfjs` for why `import()`
//    is wrong here specifically.
//
// The UI thread: React Native's JS is single-threaded, so a large document WILL make the app
// unresponsive if parsed greedily (Principle I). This yields between pages and stops at a page cap.
// A scan is a convenience; no convenience justifies freezing an app that is holding someone's legal
// mail, so where the cap is hit the honest outcome is less text - and therefore, usually, no
// suggestion at all.

import { installHermesShims } from './hermesShims';

/**
 * Load the parser - with `require`, deliberately, not `import()`.
 *
 * `await import()` is what a lazy load looks like in modern JavaScript, and under Metro it is
 * something else entirely: it compiles to an ASYNC BUNDLE, fetched from the dev server at call time.
 * On the device that failed with **"Could not load bundle"**, and the failure was invisible - the
 * scan reported "this document has no text layer", which is a legitimate outcome for an image-only
 * PDF, so the feature looked like it worked and simply never found anything.
 *
 * `require()` inside a function is bundled inline and evaluated on first call: laziness that costs
 * nothing at startup and needs no network. The type assertion is the price; it is contained here.
 */
function loadPdfjs(): PdfjsLike {
  // The DEEP path, not the package's own `unpdf/pdfjs` subpath, and deliberately so: that subpath
  // publishes only an `import` condition, and this has to be a `require` (see above). Metro warns
  // that the file is not listed in `exports` and falls back to file-based resolution, which works.
  // Anyone "fixing" the warning by switching to `unpdf/pdfjs` will break the scan.
  return require('unpdf/dist/pdfjs.mjs') as PdfjsLike;
}

/** Pages are read in order; a deadline in a 40-page annex is not worth freezing the app for. */
const MAX_PAGES = 12;

export interface PdfTextOptions {
  /** Overridable for tests; production passes nothing. */
  maxPages?: number;
  /** Injected in tests so the parser itself need not be loaded. */
  loadPdfjs?: () => Promise<PdfjsLike>;
}

/** The sliver of the pdf.js API this module uses. */
export interface PdfjsLike {
  getDocument(args: {
    data: Uint8Array;
    isEvalSupported: boolean;
    disableFontFace: boolean;
    useSystemFonts: boolean;
  }): { promise: Promise<PdfDocLike> };
}
interface PdfDocLike {
  numPages: number;
  getPage(n: number): Promise<{
    getTextContent(): Promise<{ items: { str?: unknown }[] }>;
  }>;
  destroy?(): Promise<void> | void;
}

/** Give the UI thread a chance between pages. */
const yieldToUi = () => new Promise<void>(r => setTimeout(r, 0));

/**
 * The document's text layer, or null when there is none to read.
 *
 * Returns null - never throws - for an encrypted, corrupt, or image-only PDF. A scanned decision has
 * no text layer at all, and that is a normal outcome rather than an error (Q6 ruled out OCR).
 */
export async function extractPdfText(
  bytes: Uint8Array,
  opts: PdfTextOptions = {},
): Promise<string | null> {
  const maxPages = opts.maxPages ?? MAX_PAGES;
  let doc: PdfDocLike | undefined;
  try {
    // Before the parser, whichever parser it is: an injected one in tests is still pdf.js's API and
    // still runs on Hermes in production.
    installHermesShims();
    const pdfjs = opts.loadPdfjs ? await opts.loadPdfjs() : loadPdfjs();

    doc = await pdfjs.getDocument({
      data: bytes,
      isEvalSupported: false, // see note 1
      disableFontFace: true,
      useSystemFonts: false,
    }).promise;

    const pages = Math.min(doc.numPages, maxPages);
    const out: string[] = [];
    for (let n = 1; n <= pages; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      out.push(
        content.items
          .map(i => (typeof i.str === 'string' ? i.str : ''))
          .join(' '),
      );
      await yieldToUi();
    }
    const text = out.join('\n').trim();
    return text === '' ? null : text;
  } catch {
    return null; // encrypted, corrupt, image-only - all "no text", none of them a crash
  } finally {
    try {
      await doc?.destroy?.();
    } catch {
      // best-effort teardown
    }
  }
}
