// What the attachment area claims, and when it is entitled to (audit, 2026-09-09).
//
// Two sentences were unconditional and both had reachable states where they were false:
//
//   * "Na právní doručení to nemá vliv - to nastalo už přihlášením ke schránce." Rendered on SENT
//     messages too (the download block is shared by both folders), where this user's sign-in served
//     nothing to anybody, and on messages served by FICTION, where the same scroll says at the top
//     "doručeno fikcí · bez vašeho přihlášení".
//   * "Celá zpráva uložena v archivu", in green, above the amber card saying some attachments are no
//     longer on the device. Reached by restoring a backup: the backup carries the message rows and
//     deliberately not the attachment bytes.

import {
  attachmentsNotice,
  downloadNoteKey,
  savedBadgeKey,
} from '../../src/features/messages/screens/MessageDetail';
import { STRINGS_FOR_TEST, t } from '../../src/i18n/strings';

describe('the note under the download button', () => {
  it('does not claim your sign-in served a SENT message', () => {
    const key = downloadNoteKey({ isSent: true, servedByFiction: false });
    expect(key).toBe('detail.attachments.downloadFullNote.sent');
    expect(t(key)).not.toMatch(/přihlášením ke schránce/);
  });

  it('credits FICTION when that is what served the message', () => {
    const key = downloadNoteKey({ isSent: false, servedByFiction: true });
    expect(t(key)).toMatch(/fikcí/);
    expect(t(key)).not.toMatch(/přihlášením ke schránce/);
  });

  it('keeps the sign-in wording for an ordinary received message', () => {
    expect(downloadNoteKey({ isSent: false, servedByFiction: false })).toBe(
      'detail.attachments.downloadFullNote',
    );
    expect(t('detail.attachments.downloadFullNote')).toMatch(/přihlášením ke schránce/);
  });

  it('has all three, in both languages', () => {
    for (const key of [
      'detail.attachments.downloadFullNote',
      'detail.attachments.downloadFullNote.sent',
      'detail.attachments.downloadFullNote.fiction',
    ]) {
      for (const locale of ['cs', 'en'] as const) {
        expect({ locale, key, text: STRINGS_FOR_TEST[locale][key] }).toEqual({
          locale,
          key,
          text: expect.any(String),
        });
      }
    }
  });
});

describe('the saved badge', () => {
  it('does not say the whole message is saved when files are missing', () => {
    expect(savedBadgeKey(true)).toBe('detail.attachments.partlySaved');
    expect(t(savedBadgeKey(true))).not.toMatch(/Celá zpráva/);
  });

  it('still says so when everything is there', () => {
    expect(t(savedBadgeKey(false))).toBe(t('detail.attachments.fullSaved'));
  });
});

// A large-volume message whose enclosures stopped arriving part-way (2026-09-15). Every file it holds is
// on the device, so the rule above - "are the files there?" - called it whole.
describe('the notice over the attachment rows', () => {
  const none = { incomplete: false, anyBlocked: false, unavailable: false };

  it('says enclosures are missing even when every file held is on the device', () => {
    expect(attachmentsNotice({ ...none, incomplete: true })).toBe('incomplete');
  });

  it('offers the enclosures that never arrived before files gone from the device', () => {
    // The first fetches only what is missing; the second is the full download, offered once whole.
    expect(attachmentsNotice({ ...none, incomplete: true, anyBlocked: true })).toBe('incomplete');
  });

  it('offers nothing once ISDS has deleted the message', () => {
    expect(attachmentsNotice({ incomplete: true, anyBlocked: false, unavailable: true })).toBe(
      'unavailable',
    );
    expect(attachmentsNotice({ incomplete: false, anyBlocked: true, unavailable: true })).toBe(
      'unavailable',
    );
  });

  it('says nothing about a message that is whole and on the device, deleted from ISDS or not', () => {
    expect(attachmentsNotice(none)).toBeNull();
    expect(attachmentsNotice({ ...none, unavailable: true })).toBeNull();
    expect(attachmentsNotice({ ...none, anyBlocked: true })).toBe('someMissing');
  });
});
