// Scanning a downloaded message's attachments for a deadline, on device (010 US3, cycle 2).
//
// This is the layer between "the user pressed Stáhnout přílohy" and `scanForDeadline`: it decides
// WHICH files are worth reading and stops at the first document that states a deadline.
//
// Why the first hit wins rather than the best of all hits. `scanForDeadline` refuses to guess when a
// single document names two candidate deadlines - an ambiguous document produces no suggestion at
// all (Q5). Merging the dates found across several attachments would quietly undo that rule: a
// decision naming one deadline plus a covering letter naming another would become "two dates, pick
// one", which is precisely the judgement the scanner was built not to make. So each document is
// scanned on its own terms and the first that yields an unambiguous date is the suggestion.
//
// Order matters, and it is ISDS's own: `metaType === 'main'` is the document the message is about,
// and it is listed first. Signatures and the ZFO envelope are skipped outright - they are machine
// artefacts, and their timestamps are not deadlines.

import { ZFO_MIME_TYPE, type MessageAttachment } from '../isds/types';
import {
  scanForDeadline,
  type DeadlineScan,
} from '../../features/messages/state/deadlineScan';
import { reportFailure } from '../telemetry/telemetry';

/**
 * A signed data message (.zfo) - never read, whatever it claims to be.
 *
 * The message's own original is kept apart from its attachments and never reaches the scan (004
 * amendment), but a message can also carry one AS an attachment, labelled however its sender pleased.
 * Its dates are ISDS's timestamps rather than anybody's deadline, and it is as large as everything it
 * seals - a parse of it on the JS thread for nothing.
 */
function isSignedMessage(a: MessageAttachment): boolean {
  return /\.zfo$/i.test(a.name ?? '') || a.mimeType?.toLowerCase() === ZFO_MIME_TYPE;
}

/** A deadline read out of one attachment. */
export interface ScanSuggestion {
  /** Midnight local on the detected day. */
  date: number;
  /** The phrase it was read from - shown to the user, who is the one who can check it. */
  snippet: string;
  /** Which attachment it came from, for the same reason. */
  fileName: string;
}

export interface AttachmentScanDeps {
  /** The decoded file, or null when it is gone from disk. */
  readBytes(localPath: string): Promise<Uint8Array | null>;
  /** The document's text layer, or null when there is none (image-only, encrypted, corrupt). */
  extractText(bytes: Uint8Array): Promise<string | null>;
  now(): number;
}

/** Only text-bearing documents on disk. Q6 ruled out OCR, so an image is not a candidate. */
function isScannable(a: MessageAttachment): boolean {
  if (!a.localPath) {
    return false; // never downloaded, or its file was deleted - nothing to read
  }
  if (a.metaType === 'signature' || isSignedMessage(a)) {
    return false;
  }
  return (
    a.mimeType?.toLowerCase() === 'application/pdf' ||
    /\.pdf$/i.test(a.name ?? '')
  );
}

/**
 * How many documents one scan will open.
 *
 * A message may carry dozens of enclosures, and each one costs a file read plus a parse on the JS
 * thread (Principle I). The deadline a person is looking for is in the decision, not in the fifth
 * annex.
 */
const MAX_FILES = 4;

/** The candidate documents, in the order they will be read. */
export function scannableAttachments(
  attachments: readonly MessageAttachment[],
): MessageAttachment[] {
  const eligible = attachments.filter(isScannable);
  // ISDS lists the main document first; keep that, but be explicit rather than trusting the order.
  const main = eligible.filter(a => a.metaType === 'main');
  const rest = eligible.filter(a => a.metaType !== 'main');
  return [...main, ...rest].slice(0, MAX_FILES);
}

/**
 * The deadline this message's attachments state, or null.
 *
 * Never throws: every failure mode here (a missing file, an unreadable PDF, a document that names no
 * date or names two) is "no suggestion", which is a normal outcome. A scan that cannot read the
 * document must leave the user exactly where they were.
 */
export async function scanAttachmentsForDeadline(
  attachments: readonly MessageAttachment[],
  deps: AttachmentScanDeps,
): Promise<ScanSuggestion | null> {
  for (const a of scannableAttachments(attachments)) {
    try {
      const bytes = await deps.readBytes(a.localPath as string);
      if (!bytes || bytes.length === 0) {
        continue;
      }
      const text = await deps.extractText(bytes);
      if (!text) {
        continue;
      }
      const found: DeadlineScan = scanForDeadline(text, deps.now());
      if (found.kind === 'found') {
        return { date: found.date, snippet: found.snippet, fileName: a.name };
      }
    } catch (e) {
      reportFailure('scan.attachment', e, { stage: 'parse' });
      continue; // one unreadable attachment must not stop the others
    }
  }
  return null;
}
