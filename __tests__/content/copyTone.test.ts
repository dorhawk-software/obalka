// The app does not boast (022).
//
// Reported by the user about one string - "Vaše státní pošta - KONEČNĚ přehledně…" - with the reason
// that lands the point: it "seems like the original application datovka.cz would be a complete
// disaster and there is FINALLY a good thing out there". That word says nothing about this app. It is
// a claim about every other way a person has handled their state mail, and it is not ours to make.
//
// This suite exists because tone drifts back one string at a time and review does not reliably catch
// it. The patterns are deliberately narrow: each one is a construction that cannot be rescued by
// context, rather than a word that merely looks promotional.

import { FAQ, FAQ_DISCLAIMER, type FaqId, FAQ_ORDER } from '../../src/content/faq';
import { cs as loginCs, en as loginEn } from '../../src/i18n/loginMessages';
import { STRINGS_FOR_TEST } from '../../src/i18n/strings';

interface Banned {
  readonly pattern: RegExp;
  /** Why this construction is banned - read this before adding an exception. */
  readonly why: string;
}

// NOTE ON `\b`, which cost this suite its first real bug: JavaScript's word boundary is ASCII-only,
// so `/\bkonečně\b/` can NEVER match - `ě` is not a word character, and the boundary after it
// requires a word character next. Every Czech pattern here therefore stands without boundaries; the
// words are distinctive enough not to need them. Caught by deliberately putting "konečně" back and
// watching the pattern test pass while the exact-tagline test failed.
const BANNED: readonly Banned[] = [
  {
    // The reported one. In both languages it works by comparison with an unnamed predecessor.
    pattern: /konečně|\bfinally\b|\bat last\b/i,
    why: 'claims the alternatives were bad (FR-001)',
  },
  {
    pattern: /nejlepší|nejmodernější|revoluč|\bthe best\b|\brevolutionary\b/i,
    why: 'claims superiority (FR-001)',
  },
  {
    pattern: /na rozdíl od|\bunlike (other|most|any) \w+/i,
    why: 'compares the app to others (FR-001)',
  },
  {
    // "We would rather X than Y" is the app awarding itself a virtue. Say what it does instead.
    pattern: /raději .{0,40}než|we (would|'d) rather\b/i,
    why: 'claims a virtue where a plain statement would do (FR-002)',
  },
  {
    pattern: /za vašimi zády|behind your back/i,
    why: 'implies other apps do it (FR-002)',
  },
  {
    // A label helps someone notice; it cannot make a mistake impossible.
    pattern: /nemohlo dojít k záměně|can never be mistaken|nikdy nemůže/i,
    why: 'promises an outcome the app cannot guarantee (FR-003)',
  },
];

/** Every user-facing string in the app, labelled so a failure names the file and key. */
function allCopy(): { where: string; text: string }[] {
  const out: { where: string; text: string }[] = [];
  for (const locale of ['cs', 'en'] as const) {
    for (const [key, value] of Object.entries(STRINGS_FOR_TEST[locale])) {
      out.push({ where: `strings.${locale}.${key}`, text: value });
    }
    const login = locale === 'cs' ? loginCs : loginEn;
    for (const [key, value] of Object.entries(login)) {
      out.push({ where: `loginMessages.${locale}.${key}`, text: value });
    }
    for (const id of [...FAQ_ORDER.app, ...FAQ_ORDER.isds] as FaqId[]) {
      const entry = FAQ[locale][id];
      out.push({ where: `faq.${locale}.${id}.question`, text: entry.question });
      entry.answer.forEach((p, i) => {
        out.push({ where: `faq.${locale}.${id}.answer[${i}]`, text: p });
      });
    }
    out.push({
      where: `faq.${locale}.disclaimer`,
      text: FAQ_DISCLAIMER[locale],
    });
  }
  return out;
}

describe('the app does not boast', () => {
  it('has copy to check in both languages', () => {
    // Guards the guard: a refactor that stops exporting the strings would make every assertion below
    // pass on an empty list.
    const copy = allCopy();
    expect(copy.length).toBeGreaterThan(400);
    expect(copy.filter(c => c.where.startsWith('strings.en')).length).toBeGreaterThan(150);
    expect(copy.some(c => c.where === 'strings.cs.welcome.tagline')).toBe(true);
  });

  it.each(BANNED)('never $why', ({ pattern, why }) => {
    const offenders = allCopy()
      .filter(c => pattern.test(c.text))
      .map(c => `${c.where}: "${c.text}"`);
    expect(offenders).toEqual([]);
    expect(why).toBeTruthy();
  });

  it('keeps the tagline the user asked for, in both languages', () => {
    expect(STRINGS_FOR_TEST.cs['welcome.tagline']).toBe(
      'Vaše státní pošta: přehledně, bezpečně a bez stresu.',
    );
    expect(STRINGS_FOR_TEST.en['welcome.tagline']).toBe(
      'Your government mail: clear, secure and stress-free.',
    );
  });

  // FR-004: cs and en are one voice. A tone fix applied to one and not the other is still a bug.
  it('says the same things in both languages', () => {
    const csKeys = Object.keys(STRINGS_FOR_TEST.cs).sort();
    const enKeys = Object.keys(STRINGS_FOR_TEST.en).sort();
    // Plural forms legitimately differ (cs has one/few/many, en one/other).
    const withoutPlurals = (keys: string[]) =>
      keys.filter(k => !/\.(one|few|many|other)$/.test(k));
    expect(withoutPlurals(enKeys)).toEqual(withoutPlurals(csKeys));
  });
});

// A promise about WHERE the backup goes is not a matter of tone, but it fails the same way: one
// string drifts, nobody rereads the neighbours, and the app ends up contradicting itself. The
// toggle said "switch it on and the archive stops living on this phone alone" while `backup.where`,
// two cards below on the same screen, said backups are saved on this phone and the cloud is not
// built. Reported by the user, who pointed out the obvious: after switching it on, it is still on
// your phone.
describe('the backup does not claim to leave the phone', () => {
  /** Only the copy that describes the backup feature; the FAQ answers it honestly at length. */
  const backupKeys = (locale: 'cs' | 'en') =>
    Object.entries(STRINGS_FOR_TEST[locale]).filter(([k]) =>
      k.startsWith('backup.'),
    );

  it('never says the archive stops being only on this phone', () => {
    const claims = [
      /už nebude jen v tomto (telefonu|zařízení)/i,
      /stops living on this (phone|device) alone/i,
      /no longer (only|just) on this (phone|device)/i,
    ];
    for (const locale of ['cs', 'en'] as const) {
      for (const [key, text] of backupKeys(locale)) {
        for (const claim of claims) {
          expect({ key, locale, text }).toMatchObject({
            text: expect.not.stringMatching(claim),
          });
        }
      }
    }
  });

  it('still says plainly where a backup is written', () => {
    // The honest statement has to survive too - deleting it would "fix" the contradiction by
    // saying nothing, which is how a vague app is built.
    expect(STRINGS_FOR_TEST.cs['backup.where']).toMatch(/do tohoto telefonu/i);
    expect(STRINGS_FOR_TEST.en['backup.where']).toMatch(/on this phone/i);
  });
});
