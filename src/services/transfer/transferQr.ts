// The transfer phrase as a QR code (025).
//
// Typing `N3WQ-kruh-lano-klobouk-pivo` into a phone is the last piece of friction this feature was
// meant to remove, and the phrase is longer than the recovery key it replaces. So the sending phone
// shows it as a code and the receiving phone reads it.
//
// This mirrors `keyQr.ts` exactly, and deliberately: same prefix idea, same alphanumeric trick, same
// reason. Three choices carry over, and one is new.
//
//   * A PREFIX, and a DIFFERENT one. `OBALKAT:` rather than `OBALKA:`, so a scanner can tell a
//     transfer phrase from a recovery key. They are both secrets this app shows on a screen, they
//     are both scanned by the same camera, and feeding one into the other's field would report
//     "wrong password" for something that was never a password. The prefix is what makes that a
//     clean refusal instead of a confusing failure.
//   * ALPHANUMERIC MODE. The phrase is lowercase words, and QR's alphanumeric charset is uppercase
//     only - so the payload is upper-cased on the way in and `parseCodePhrase` lower-cases it on the
//     way out, which it already did for people typing in capitals. That keeps the symbol small
//     enough to scan across a table instead of forcing byte mode and a much denser code.
//   * ERROR CORRECTION H, because `QrCode` knocks a hole in the middle for the logo and the modules
//     it covers have to be reconstructable rather than lost.
//
// NEW HERE: this code is worth less than the recovery key's, and only for a minute. A transfer
// phrase is one-time and dies with the rendezvous, so a photograph of it after the fact is worthless
// - which is the opposite of the recovery key, where a photograph is the whole archive forever.

import { parseCodePhrase } from './codePhrase';

export const TRANSFER_QR_PREFIX = 'OBALKAT:';

/** What the sending phone displays. */
export function encodeTransferQr(phrase: string): string {
  // Upper-cased for QR's alphanumeric charset; the parser is case-insensitive by design.
  return `${TRANSFER_QR_PREFIX}${phrase.toUpperCase()}`;
}

/**
 * Read a scanned code.
 *
 * Returns the canonical phrase, or null when this is not one of ours. The prefix is REQUIRED: a
 * camera pointed at a table sees bus timetables, Wi-Fi codes and payment QRs, and accepting a bare
 * string would make every one of them a candidate phrase - and PAKE gives exactly one guess per
 * attempt, so a wrong candidate is not free.
 */
export function parseTransferQr(scanned: string): string | null {
  const text = scanned.trim();
  if (!text.toUpperCase().startsWith(TRANSFER_QR_PREFIX)) {
    return null;
  }
  return parseCodePhrase(text.slice(TRANSFER_QR_PREFIX.length));
}
