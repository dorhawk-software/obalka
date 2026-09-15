import {
  FAQ,
  FAQ_DISCLAIMER,
  FAQ_ORDER,
  type FaqId,
} from '../../src/content/faq';

// The FAQ makes claims about the law and about the app's own behaviour, so the failure modes worth
// guarding are not rendering bugs - they are a missing translation, an answer that quietly empties
// out, and (the one that matters most) an answer drifting into describing something the app does not
// actually do. Constitution VI. The last of those cannot be fully automated; what CAN be pinned is
// that the specific claims we know to be wrong never come back.

const LOCALES = ['cs', 'en'] as const;
const ALL_IDS = [...FAQ_ORDER.app, ...FAQ_ORDER.isds];

const answersOf = (locale: (typeof LOCALES)[number]) =>
  ALL_IDS.map((id) => FAQ[locale][id].answer.join(' '));

describe('the attachment-scan answer (010 US3)', () => {
  // This answer exists because the Settings row was cut down to two lines. Whatever the row stops
  // saying, THIS has to say - otherwise trimming the row simply deleted the disclosure.
  it('states the things the Settings row no longer does', () => {
    const cs = FAQ.cs.attachmentScan.answer.join(' ');
    expect(cs).toMatch(/vypnut/i); // off by default, and off means nothing is read
    expect(cs).toMatch(/pdf\.js/); // which library
    expect(cs).toMatch(/OCR/); // and its limit: no OCR, so no scanned documents
    expect(cs).toMatch(/nejpozději/); // the cue words it keys on
    expect(cs).toMatch(/splatnosti/);
    expect(cs).toMatch(/12 stran/); // the page cap
    expect(cs).toMatch(/Stáhnout přílohy/); // only after a download the user asked for
    expect(cs).toMatch(/ověřte/i); // and that the date is an estimate to check
  });

  it('says in both languages that nothing leaves the phone', () => {
    expect(FAQ.cs.attachmentScan.answer.join(' ')).toMatch(
      /neopouští telefon|nikam se neodesílá/,
    );
    expect(FAQ.en.attachmentScan.answer.join(' ')).toMatch(
      /never leaves the phone|never sent anywhere/,
    );
  });

  it('promises no OCR, which the app deliberately does not do', () => {
    for (const locale of LOCALES) {
      const text = FAQ[locale].attachmentScan.answer.join(' ');
      expect(text).not.toMatch(/rozpozná text z obrázk|reads scanned/i);
    }
  });
});

describe('FAQ content', () => {
  it('orders every entry into exactly one group', () => {
    expect(new Set(ALL_IDS).size).toBe(ALL_IDS.length);
    const known = new Set<FaqId>(ALL_IDS);
    for (const locale of LOCALES) {
      expect(new Set(Object.keys(FAQ[locale]) as FaqId[])).toEqual(known);
    }
  });

  it('answers every entry in both languages', () => {
    for (const locale of LOCALES) {
      for (const id of ALL_IDS) {
        const entry = FAQ[locale][id];
        expect(entry.question.trim().length).toBeGreaterThan(8);
        expect(entry.answer.length).toBeGreaterThan(0);
        for (const paragraph of entry.answer) {
          expect(paragraph.trim().length).toBeGreaterThan(30);
        }
      }
    }
  });

  it('never leaves a placeholder in shipped copy', () => {
    for (const locale of LOCALES) {
      for (const text of answersOf(locale)) {
        expect(text).not.toMatch(/TODO|TBD|lorem ipsum|xxx/i);
      }
    }
  });

  it('covers every topic FR-003 requires', () => {
    expect(FAQ_ORDER.app).toEqual(
      expect.arrayContaining(['addBox', 'loginMethods', 'reauth', 'attachments', 'archive']),
    );
    expect(FAQ_ORDER.isds).toEqual(
      expect.arrayContaining(['deliveredVsServed', 'fiction', 'retention', 'testEnv']),
    );
  });

  it('carries the not-legal-advice notice in both languages', () => {
    expect(FAQ_DISCLAIMER.cs).toMatch(/právní poradenství/i);
    expect(FAQ_DISCLAIMER.en).toMatch(/not legal advice/i);
  });

  // --- the claims we got wrong before, pinned so they cannot return ---------

  it('does not claim that downloading a message causes legal delivery', () => {
    // The design's copy - and the app's own download-button string - used to say exactly this. Per
    // §17(3) of Act 300/2008 in the Provozní řád, fetching the received list is what serves a message.
    expect(FAQ.cs.attachments.answer.join(' ')).not.toMatch(
      /stažení[^.]*považuje se za doručen|stažení[^.]*je[^.]*doručení/i,
    );
    expect(FAQ.en.attachments.answer.join(' ')).not.toMatch(
      /download\w*[^.]*counts?\s+(legally\s+)?as\s+delivery/i,
    );
  });

  it('attributes legal delivery to signing in, not to opening a message', () => {
    expect(FAQ.cs.deliveredVsServed.answer.join(' ')).toMatch(/přihlášení/i);
    expect(FAQ.en.deliveredVsServed.answer.join(' ')).toMatch(/signing in/i);
  });

  it('does not promise backup - feature 006 is not built', () => {
    // The design's archive answer offered "optionally backed up". Welcome.tsx deliberately omits the
    // restore button for the same reason; the FAQ must not reintroduce the promise.
    expect(FAQ.cs.archive.answer.join(' ')).not.toMatch(/zálo(ha|hov|žit)/i);
    expect(FAQ.en.archive.answer.join(' ')).not.toMatch(/back(ed)?\s*-?\s*up|backup/i);
  });

  it('does not send people to Settings to add a box', () => {
    // Add-box lives in the box switcher only (BoxSwitcherSheet.tsx); Settings has no such entry.
    expect(FAQ.cs.addBox.answer.join(' ')).not.toMatch(/v Nastavení/i);
    expect(FAQ.en.addBox.answer.join(' ')).not.toMatch(/in Settings/i);
  });

  it('names the sign-in methods that ship, and the ones that do not', () => {
    const cs = FAQ.cs.loginMethods.answer.join(' ');
    const en = FAQ.en.loginMethods.answer.join(' ');
    // offered today
    expect(cs).toMatch(/Mobilní klíč/);
    expect(en).toMatch(/Mobile Key/);
    // not exposed to third-party apps - named explicitly rather than vaguely "unsupported"
    for (const unavailable of [/Identita občana/, /Bankovní identita/, /mojeID/]) {
      expect(cs).toMatch(unavailable);
    }
    for (const unavailable of [/Identita občana/, /Bank iD/, /mojeID/]) {
      expect(en).toMatch(unavailable);
    }
    // and it must be clear whose limitation that is
    // The FACT - ISDS is the one withholding it - not one particular word order.
    expect(cs).toMatch(/aplikacím třetích stran (je )?nezpřístupňuje|nezpřístupňuje (je )?aplikacím třetích stran/i);
    expect(en).toMatch(/does not expose them to third-party apps/i);
  });

  it('states the 10-day fiction period and the 90-day retention', () => {
    expect(FAQ.cs.fiction.answer.join(' ')).toMatch(/10 dnech/);
    expect(FAQ.en.fiction.answer.join(' ')).toMatch(/10 days/);
    expect(FAQ.cs.retention.answer.join(' ')).toMatch(/90 dnů/);
    expect(FAQ.en.retention.answer.join(' ')).toMatch(/90 days/);
  });
});

// The FAQ said downloaded attachments live "v šifrovaném archivu" / "in the encrypted archive".
// `services/files/attachmentFileStore.ts` says otherwise in its own header: attachment CONTENT is
// plain files in private storage, and app-level file encryption is a deferred feature. Only the
// database is SQLCipher. A user reading the old wording concluded their legal documents were
// encrypted by this app; they are protected by the phone, which is a different promise.
describe('what the FAQ claims about encryption', () => {
  const paragraphs = (id: 'attachments' | 'archive') =>
    (['cs', 'en'] as const).flatMap(locale => FAQ[locale][id].answer);

  it('does not put attachment FILES inside the encrypted archive', () => {
    // The banned SHAPE, not mere co-occurrence: naming attachments and then placing them in
    // something encrypted. Mentioning both in one paragraph is fine - and necessary - as long as the
    // sentence separates them, which is the whole correction.
    const placesAttachmentsInsideEncryption = [
      /příloh\w*[^.]{0,90}\bv šifrovan/i,
      /attachments?[^.]{0,90}\bin the encrypted/i,
    ];
    for (const text of [...paragraphs('attachments'), ...paragraphs('archive')]) {
      for (const pattern of placesAttachmentsInsideEncryption) {
        expect({ text, claims: pattern.test(text) }).toEqual({ text, claims: false });
      }
    }
  });

  it('says where the attachment files actually are', () => {
    // Deleting the false claim is only half the fix; a user still needs to know what does protect
    // them. Both languages must name the private storage and the phone's own protection.
    const attachments = paragraphs('attachments').join(' ');
    expect(attachments).toMatch(/soukromém úložišti/);
    // The FACT - the PHONE's encryption protects them, not the app's.
    expect(attachments).toMatch(/šifrování (samotného )?telefonu, ne aplikace/);
    expect(attachments).toMatch(/private storage/);
    expect(attachments).toMatch(/phone[’']s (own )?encryption, not the app/);
  });

  it('still says the database itself is encrypted, because it is', () => {
    // Over-correcting would be its own lie: the SQLCipher database is real.
    const archive = paragraphs('archive').join(' ');
    expect(archive).toMatch(/šifrované databázi/);
    expect(archive).toMatch(/encrypted database/);
  });
});
