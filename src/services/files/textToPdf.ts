// Text → PDF (feature 005). An accessibility convenience that mirrors the ISDS web portal: the user
// types a plain-text message and we turn it into a "Textová zpráva.pdf" attachment, so they don't
// have to create a PDF themselves (ISDS messages must carry a document, not just a subject).
//
// Rendering goes through the OS PDF engine (react-native-html-to-pdf) so Czech diacritics, wrapping,
// and pagination are correct and done natively (off the JS thread - Principle I). We ask for base64 so
// the result drops straight into an OutgoingDocument like a picked file.

import { generatePDF } from 'react-native-html-to-pdf';
import type { OutgoingDocument } from '../isds/types';

/** The attachment name the portal uses (and users recognise). */
export const TEXT_MESSAGE_FILENAME = 'Textová zpráva.pdf';

/** Escape the user's text so it can't break the HTML wrapper (newlines are kept via `pre-wrap`). */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Approximate decoded byte size of a base64 string (drives the cost tier; a text PDF is tiny). */
function base64Bytes(b64: string): number {
  if (b64.length === 0) {
    return 0;
  }
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.max(0, (b64.length * 3) / 4 - padding);
}

/**
 * Render `text` to a PDF and return it as a ready, "main" {@link OutgoingDocument}. Throws if the
 * native renderer fails (the caller surfaces a localized error). Whitespace-only text is rejected.
 */
export async function textToPdf(text: string): Promise<OutgoingDocument> {
  const trimmed = text.trim();
  if (trimmed === '') {
    throw new Error('empty text');
  }
  const html =
    '<!DOCTYPE html><html><head><meta charset="utf-8"/></head>' +
    '<body style="font-family: -apple-system, Roboto, Arial, sans-serif; ' +
    'font-size: 14px; line-height: 1.5; white-space: pre-wrap; word-wrap: break-word;">' +
    escapeHtml(trimmed) +
    '</body></html>';

  const result = await generatePDF({
    html,
    fileName: 'textova-zprava',
    base64: true,
    padding: 36, // ~0.5in margins
  });
  if (!result.base64) {
    throw new Error('PDF generation returned no content');
  }
  return {
    fileName: TEXT_MESSAGE_FILENAME,
    mimeType: 'application/pdf',
    sizeBytes: base64Bytes(result.base64),
    contentBase64: result.base64,
    isMain: true,
    localPath: result.filePath
      ? result.filePath.replace(/^file:\/\//, '')
      : undefined,
  };
}
