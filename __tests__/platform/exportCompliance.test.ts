// Export compliance, answered once (owner, 2026-11-10; docs/release-ci.md).
//
// Every build uploaded to App Store Connect waits on "does the app use encryption?" until the app
// answers it itself. Obálka uses only standard algorithms (SQLCipher, AES-256-GCM, XChaCha20-Poly1305,
// Argon2id, and croc's PAKE over P-256 with AES-GCM), protecting the user's own data - exempt. A
// regenerated Info.plist would silently drop the key, and every TestFlight build would stop at the
// question again.

import { readFileSync } from 'fs';
import { join } from 'path';

const INFO_PLIST = readFileSync(join(__dirname, '../../ios/ObalkaDatovaSchranka/Info.plist'), 'utf8');

describe('the iOS export-compliance answer', () => {
  it('declares no non-exempt encryption', () => {
    expect(INFO_PLIST).toMatch(/<key>ITSAppUsesNonExemptEncryption<\/key>\s*<false\/>/);
  });
});
