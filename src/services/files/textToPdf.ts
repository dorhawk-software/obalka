// Text → PDF (feature 005). An accessibility convenience that mirrors the ISDS web portal: the user
// types a plain-text message and we turn it into a "Textová zpráva.pdf" attachment, so they don't
// have to create a PDF themselves (ISDS messages must carry a document, not just a subject).
//
// What the authority opens is a Czech letter on A4 (031, board R12, picked 2026-11-12): 25 mm at the
// sides and 20 at the top and bottom, the usual order - the sender with the app's mark at the right,
// the recipient, the date, the subject in bold, the text - in the app's faces, the same on both
// platforms, and one quiet line at the foot. Until 2026-11-15 it was the bare text on US Letter in the
// system font, with no sender, recipient, date or subject. The place before the date ("V Praze") is
// not printed: the app does not know where the sender writes from.
//
// Rendering goes through the OS PDF engine (react-native-html-to-pdf) so Czech diacritics, wrapping,
// and pagination are correct and done natively (off the JS thread - Principle I). We ask for base64 so
// the result drops straight into an OutgoingDocument like a picked file.

import { Platform } from 'react-native';
import { generatePDF } from 'react-native-html-to-pdf';
import type { DataBoxAccount, OutgoingDocument } from '../isds/types';
import { lightTheme } from '../../theme/theme';
import { MARK_PATHS } from '../../theme/ObalkaMark';
import { getActiveLocale, t } from '../../i18n/strings';

/** The attachment name the portal uses (and users recognise). */
export const TEXT_MESSAGE_FILENAME = 'Textová zpráva.pdf';

/** What the letter says around the text. */
export interface Letter {
  /** The box it is sent from, under its name in the switcher. */
  readonly sender: Pick<DataBoxAccount, 'alias' | 'label' | 'boxId'>;
  readonly recipient: { readonly name: string; readonly address: string | null; readonly boxId: string };
  readonly subject: string;
  readonly text: string;
  /** When it is written; the letter's date. Now, unless a test says otherwise. */
  readonly writtenAt?: number;
}

/** A4 in points, whole: the Android renderer takes integers. */
const A4 = { width: 595, height: 842 };
/** R12: 25 mm at the sides, 20 at the top and bottom (42.6 and 34.2 drawn at 60 %), in points. */
const MARGIN = { side: 71, edge: 57 };

/**
 * CSS pixels per point. Android prints as a browser does, 96 px to the inch; iOS lays the page out in
 * the web view's own points, one to one.
 */
const PX_PER_PT = Platform.OS === 'ios' ? 1 : 96 / 72;
const pt = (n: number) => `${Math.round(n * PX_PER_PT * 100) / 100}px`;

/**
 * Where the renderer finds the app's font files: iOS loads the page from the app bundle, where
 * `UIAppFonts` puts them; Android from the APK's assets, given as the base URL.
 */
const FONT_DIR = Platform.OS === 'ios' ? '' : 'fonts/';
const ANDROID_ASSETS = 'file:///android_asset/';

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

/** "12. 11. 2026" in Czech, "12 November 2026" in English. */
function letterDate(epochMs: number): string {
  const d = new Date(epochMs);
  if (getActiveLocale() === 'cs') {
    return `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`;
  }
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** ISDS gives an address as one line, its parts split by commas: a line each, as on an envelope. */
function addressLines(address: string | null): string[] {
  return (address ?? '')
    .split(',')
    .map(part => part.trim())
    .filter(part => part !== '');
}

/** The letter's page, every value from R12 at full size (the board draws it at 60 %). */
export function letterHtml(letter: Letter): string {
  const paper = lightTheme;
  const e = escapeHtml;
  const to = [e(letter.recipient.name), ...addressLines(letter.recipient.address).map(e)].join('<br>');
  const subject = letter.subject.trim();
  const fontFace = (family: string, file: string, weight: number) =>
    `@font-face{font-family:'${family}';src:url('${FONT_DIR}${file}');font-weight:${weight}}`;
  const css = [
    fontFace('Public Sans', 'PublicSans-Regular.ttf', 400),
    fontFace('Bricolage Grotesque', 'BricolageGrotesque-Bold.ttf', 700),
    // iOS takes the margins as the printable rect; Android prints the page box, so the page has them.
    Platform.OS === 'ios' ? '@page{size:A4;margin:0}' : `@page{size:A4;margin:${MARGIN.edge}pt ${MARGIN.side}pt}`,
    'html,body{margin:0;padding:0}',
    `body{font-family:'Public Sans',sans-serif;color:${paper.text};font-size:${pt(10.5)};line-height:1.45}`,
    // As tall as the page's text area, so the foot line sits at its bottom; a longer letter runs on and
    // the line follows its last words.
    `.page{display:flex;flex-direction:column;min-height:${pt(A4.height - 2 * MARGIN.edge - 2)}}`,
    `.head{display:flex;justify-content:space-between;align-items:flex-start;color:${paper.textMuted};font-size:${pt(8.5)}}`,
    `.mark{width:${pt(26.5)};height:${pt(26.5)};flex-shrink:0}`,
    `.to{margin-top:${pt(42)}}`,
    `.muted{color:${paper.textMuted}}`,
    `.date{margin-top:${pt(34)};text-align:right;color:${paper.textMuted}}`,
    `.subject{margin-top:${pt(22)};font-family:'Bricolage Grotesque',sans-serif;font-weight:700;font-size:${pt(12.5)}}`,
    `.text{margin-top:${pt(14)};white-space:pre-wrap;overflow-wrap:break-word}`,
    `.foot{margin-top:auto;padding-top:${pt(24)}}`,
    `.foot div{border-top:${pt(1.25)} solid ${paper.border};padding-top:${pt(6)};color:${paper.textFaint};font-size:${pt(7.5)}}`,
  ].join('');
  const mark =
    `<svg class="mark" viewBox="0 0 1024 1024" aria-hidden="true">` +
    `<path fill="${paper.envelope}" d="${MARK_PATHS.body}"/><path fill="${paper.flap}" d="${MARK_PATHS.flap}"/></svg>`;
  return (
    `<!DOCTYPE html><html lang="${getActiveLocale()}"><head><meta charset="utf-8"/><style>${css}</style></head>` +
    '<body><div class="page">' +
    `<div class="head"><span>${e(letter.sender.alias ?? letter.sender.label)}<br>${e(t('send.letter.boxId', { id: letter.sender.boxId }))}</span>${mark}</div>` +
    `<div class="to">${to}<br><span class="muted">${e(t('send.letter.boxId', { id: letter.recipient.boxId }))}</span></div>` +
    `<div class="date">${e(letterDate(letter.writtenAt ?? Date.now()))}</div>` +
    (subject === '' ? '' : `<div class="subject">${e(subject)}</div>`) +
    `<div class="text">${e(letter.text.trim())}</div>` +
    `<div class="foot"><div>${e(t('send.letter.footer'))}</div></div>` +
    '</div></body></html>'
  );
}

/**
 * Render the letter to a PDF and return it as a ready, "main" {@link OutgoingDocument}. Throws if the
 * native renderer fails (the caller surfaces a localized error). Whitespace-only text is rejected.
 */
export async function textToPdf(letter: Letter): Promise<OutgoingDocument> {
  if (letter.text.trim() === '') {
    throw new Error('empty text');
  }
  const result = await generatePDF({
    html: letterHtml(letter),
    fileName: 'textova-zprava',
    base64: true,
    width: A4.width,
    height: A4.height,
    paddingTop: MARGIN.edge,
    paddingBottom: MARGIN.edge,
    paddingLeft: MARGIN.side,
    paddingRight: MARGIN.side,
    baseURL: Platform.OS === 'android' ? ANDROID_ASSETS : undefined,
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
