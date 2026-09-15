// On-device deadline scanning (010 US3, cycle 2). Pure: text in, at most one suggestion out.
//
// The governing decision is Q5, and it is a decision about being WRONG rather than about being
// clever: a wrong legal deadline is worse than no deadline. A document routinely carries a hearing
// date, a validity date and an issue date, so "the latest future date" would confidently present the
// wrong one. Only a date anchored to a cue - "do", "nejpozději", "ve lhůtě", "termín" - is ever
// suggested, and where the document says two DIFFERENT things, the app says nothing rather than
// picking a side.

import { scanForDeadline } from '../../src/features/messages/state/deadlineScan';

/** 1 June 2026, local - every fixture is written relative to this. */
const NOW = new Date(2026, 5, 1).getTime();
const day = (y: number, m: number, d: number) => new Date(y, m, d).getTime();

const found = (text: string) => scanForDeadline(text, NOW);

describe('scanForDeadline - what it accepts', () => {
  it('reads the standard Czech deadline phrasing', () => {
    const r = found('Odvolání lze podat do 8. 7. 2026 u zdejšího úřadu.');
    expect(r.kind).toBe('found');
    expect(r.kind === 'found' && r.date).toBe(day(2026, 6, 8));
  });

  it('reads it without spaces, as authorities often write it', () => {
    expect(found('Uhraďte do 8.7.2026.').kind).toBe('found');
  });

  it('reads a leading-zero form', () => {
    const r = found('nejpozději do 08. 07. 2026');
    expect(r.kind === 'found' && r.date).toBe(day(2026, 6, 8));
  });

  it('reads a spelled-out Czech month', () => {
    const r = found('ve lhůtě do 8. července 2026');
    expect(r.kind === 'found' && r.date).toBe(day(2026, 6, 8));
  });

  it('accepts the other cue words', () => {
    for (const cue of [
      'nejpozději 8. 7. 2026',
      've lhůtě 8. 7. 2026',
      'termín 8. 7. 2026',
      'lhůta končí 8. 7. 2026',
    ]) {
      expect(found(cue).kind).toBe('found');
    }
  });

  it('keeps the surrounding phrase, so the user can check the app read it right', () => {
    const r = found('Odvolání lze podat do 8. 7. 2026 u zdejšího úřadu.');
    expect(r.kind === 'found' && r.snippet).toMatch(/do 8\. 7\. 2026/);
  });
});

describe('scanForDeadline - what it refuses', () => {
  it('says nothing when no cue anchors the date', () => {
    // A date is not a deadline. This is the entire difference between this feature and a date-finder.
    expect(found('Jednání se konalo 8. 7. 2026.').kind).toBe('none');
  });

  it('is not fooled by "do" as an ordinary preposition', () => {
    // "do" is one of the commonest Czech words; only a date right after it counts.
    expect(found('Dopis byl odeslán do Prahy. Vydáno 8. 7. 2026.').kind).toBe(
      'none',
    );
  });

  it('says nothing when the document gives two DIFFERENT cue-anchored dates', () => {
    // Ambiguous by construction. Picking one silently hides the other, and picking the earlier one
    // is still picking. The app is not entitled to decide which deadline the user is bound by.
    const r = found('Uhraďte do 8. 7. 2026, odvolání podejte do 20. 8. 2026.');
    expect(r.kind).toBe('none');
  });

  it('is untroubled by the SAME date stated twice', () => {
    // Real decisions repeat the deadline in the operative part and again in the instruction.
    const r = found('Uhraďte do 8. 7. 2026. Splatnost do 8. 7. 2026.');
    expect(r.kind).toBe('found');
  });

  it('ignores a deadline that has already passed', () => {
    // A reminder for a past date cannot fire, and offering one implies there is still time.
    expect(found('Uhraďte do 8. 7. 2020.').kind).toBe('none');
  });

  it('rejects an impossible date rather than rolling it over', () => {
    expect(found('do 31. 2. 2027').kind).toBe('none');
    expect(found('do 45. 13. 2027').kind).toBe('none');
  });

  it('says nothing about an empty or junk document', () => {
    expect(found('').kind).toBe('none');
    expect(found('   \n\t ').kind).toBe('none');
    expect(scanForDeadline(null as unknown as string, NOW).kind).toBe('none');
  });

  it('never throws, whatever the extractor hands it (Principle II)', () => {
    expect(() => scanForDeadline('do 1. 1.', NOW)).not.toThrow();
    expect(() => scanForDeadline('do ..2026', NOW)).not.toThrow();
    expect(() =>
      scanForDeadline('do 8. 7. 2026'.repeat(5000), NOW),
    ).not.toThrow();
  });
});
