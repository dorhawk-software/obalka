// The changelog (spec 029, scripts/changelog.mjs).
//
// One hand-written section per release becomes the GitHub release, three store fields and the app's own
// What's new, in Czech and in English. So what is tested here is mostly what it must REFUSE: a release
// described in one language only, a kind nobody can translate, an entry without its point, and the two
// files drifting apart - each of which would reach people as a wrong or missing sentence.

import { readFileSync } from 'node:fs';
import {
  FILES,
  GENERATED,
  KINDS,
  PLAY_LIMIT,
  count,
  dated,
  generated,
  mismatches,
  notes,
  parse,
  storeText,
} from '../../scripts/changelog.mjs';
import { STRINGS_FOR_TEST } from '../../src/i18n/strings';
import { CHANGE_KINDS } from '../../src/content/changelog.generated';

const CS = `# Co je nového

Úvod.

<!-- komentář
     na více řádků -->

## Unreleased

### Opraveno

- **Hledání najde i přílohy.** Dřív hledalo jen
  v předmětech.

## 0.2.0 (2026-11-20)

### Nové

- **Připomínka lhůty.** Nastavíte ji u zprávy.
- **Tmavý vzhled.**

### Pod kapotou

- **Aktualizované knihovny.**

## 0.1.0 (2026-11-12)

### Nové

- **První vydání.**
`;

const EN = `# What's new

## Unreleased

### Fixed

- **Search finds attachments too.** It used to look at subjects only.

## 0.2.0 (2026-11-20)

### New

- **A deadline reminder.** Set it on a message.
- **Dark appearance.**

### Underneath

- **Libraries brought up to date.**

## 0.1.0 (2026-11-12)

### New

- **The first release.**
`;

describe('reading a changelog', () => {
  it('reads releases newest first, Unreleased on top, with each entry split into its point and the rest', () => {
    const cs = parse(CS, 'cs');
    expect(cs.map(r => r.version)).toEqual(['Unreleased', '0.2.0', '0.1.0']);
    expect(cs[0].date).toBeNull();
    expect(cs[0].changes.fixed).toEqual([
      { lead: 'Hledání najde i přílohy.', body: 'Dřív hledalo jen v předmětech.' },
    ]);
    expect(cs[1].changes.new?.[1]).toEqual({ lead: 'Tmavý vzhled.', body: '' });
    expect(count(cs[1])).toBe(3);
  });

  it('allows an empty Unreleased, which the release then refuses', () => {
    const releases = parse('## Unreleased\n\n## 0.1.0 (2026-11-12)\n\n### Nové\n\n- **První.**\n', 'cs');
    expect(count(releases[0])).toBe(0);
  });

  it.each([
    ['no Unreleased', '## 0.1.0 (2026-11-12)\n\n### Nové\n\n- **A.**\n', /"## Unreleased" is missing/],
    ['Unreleased under a release', '## 0.1.0 (2026-11-12)\n\n## Unreleased\n', /comes first/],
    ['a heading without a date', '## Unreleased\n\n## 0.1.0\n', /release heading reads/],
    ['a kind from the other language', '## Unreleased\n\n### New\n\n- **A.**\n', /"New" is not a kind/],
    ['an entry without its point in bold', '## Unreleased\n\n### Nové\n\n- Něco.\n', /in bold/],
    ['an entry outside a kind', '## Unreleased\n\n- **A.**\n', /under a kind/],
    ['kinds out of order', '## Unreleased\n\n### Opraveno\n\n- **A.**\n\n### Nové\n\n- **B.**\n', /in this order/],
    ['a kind twice', '## Unreleased\n\n### Nové\n\n- **A.**\n\n### Nové\n\n- **B.**\n', /twice/],
    ['an empty kind', '## Unreleased\n\n### Nové\n\n### Opraveno\n\n- **A.**\n', /nothing under it/],
    ['loose text in a release', '## Unreleased\n\nNěco navíc.\n', /only kinds/],
    ['an older release above a newer one', '## Unreleased\n\n## 0.1.0 (2026-11-12)\n\n### Nové\n\n- **A.**\n\n## 0.2.0 (2026-11-20)\n\n### Nové\n\n- **B.**\n', /newest first/],
  ])('refuses %s', (_, text, why) => {
    expect(() => parse(text, 'cs')).toThrow(why);
  });
});

describe('the two languages', () => {
  it('agree when they hold the same releases, dates, kinds and numbers of entries', () => {
    expect(mismatches(parse(CS, 'cs'), parse(EN, 'en'))).toEqual([]);
  });

  it('disagree over an entry one of them lacks', () => {
    const en = EN.replace('- **Dark appearance.**\n', '');
    expect(mismatches(parse(CS, 'cs'), parse(en, 'en'))).toHaveLength(1);
  });

  it('disagree over a date', () => {
    const en = EN.replace('0.1.0 (2026-11-12)', '0.1.0 (2026-11-13)');
    expect(mismatches(parse(CS, 'cs'), parse(en, 'en'))).toHaveLength(1);
  });

  it('disagree over a release only one of them has', () => {
    const en = EN.slice(0, EN.indexOf('## 0.1.0'));
    expect(mismatches(parse(CS, 'cs'), parse(en, 'en'))).toHaveLength(1);
  });
});

describe('releasing', () => {
  it('turns Unreleased into the version and its date, and opens a new, empty Unreleased', () => {
    const after = parse(dated(CS, '0.3.0', '2026-12-01'), 'cs');
    expect(after.map(r => [r.version, r.date])).toEqual([
      ['Unreleased', null],
      ['0.3.0', '2026-12-01'],
      ['0.2.0', '2026-11-20'],
      ['0.1.0', '2026-11-12'],
    ]);
    expect(count(after[0])).toBe(0);
    expect(after[1].changes.fixed?.[0].lead).toBe('Hledání najde i přílohy.');
  });
});

describe('what the release publishes', () => {
  const cs = parse(CS, 'cs');
  const en = parse(EN, 'en');

  it('gives GitHub both languages, Czech first, in Markdown', () => {
    const text = notes(cs, en, '0.2.0');
    expect(text.indexOf('## Čeština')).toBeLessThan(text.indexOf('## English'));
    expect(text).toContain('### Nové\n\n- **Připomínka lhůty.** Nastavíte ji u zprávy.');
    expect(text).toContain('### Underneath\n\n- **Libraries brought up to date.**');
  });

  it('refuses a version nobody described', () => {
    expect(() => notes(cs, en, '0.9.0')).toThrow(/no "## 0.9.0/);
  });

  it('gives a store plain text, and Google Play the points only', () => {
    expect(storeText(en[1], 'en')).toBe(
      'NEW\n• A deadline reminder. Set it on a message.\n• Dark appearance.\n\nUNDERNEATH\n• Libraries brought up to date.',
    );
    expect(storeText(en[1], 'en', true)).toBe(
      '• A deadline reminder.\n• Dark appearance.\n• Libraries brought up to date.',
    );
  });

  it('builds the app only what was released', () => {
    const source = generated(cs, en);
    expect(source).not.toContain('Hledání najde i přílohy');
    expect(source).toContain('Připomínka lhůty.');
  });
});

describe('the changelog in this repository', () => {
  const cs = parse(readFileSync(FILES.cs, 'utf8'), 'cs');
  const en = parse(readFileSync(FILES.en, 'utf8'), 'en');

  it('reads, in both languages, and the two agree', () => {
    expect(mismatches(cs, en)).toEqual([]);
  });

  it('is what the app has built in', () => {
    expect(readFileSync(GENERATED, 'utf8')).toBe(generated(cs, en));
  });

  it("fits every release's points into Google Play's 500 characters", () => {
    for (const [lang, list] of [['cs', cs], ['en', en]] as const) {
      for (const release of list.slice(1)) {
        expect(storeText(release, lang, true).length).toBeLessThanOrEqual(PLAY_LIMIT);
      }
    }
  });

  it('names its kinds as the app does, in both languages', () => {
    expect(KINDS.map(k => k.key)).toEqual([...CHANGE_KINDS]);
    for (const kind of KINDS) {
      expect(STRINGS_FOR_TEST.cs[`whatsNew.kind.${kind.key}`]).toBe(kind.cs);
      expect(STRINGS_FOR_TEST.en[`whatsNew.kind.${kind.key}`]).toBe(kind.en);
    }
  });
});
