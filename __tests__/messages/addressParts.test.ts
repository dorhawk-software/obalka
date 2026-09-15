// Splitting an ISDS address for display (feature 015). Pure - no I/O, no rendering.
//
// The split exists because ISDS hands us the address as ONE pre-composed string
// (`Nová 1/777, 60200 Brno, CZ`) and the row has to show all of it, with the town carrying the
// weight - the town is what separates two people of the same name.
//
// What these tests are really guarding is the BOUNDARY: the app may break the line at the commas
// ISDS itself supplied, and may do nothing else. No re-ordering, no relabelling, no expanding, no
// dropping a part it does not recognise. An official register entry restated in the app's own words
// would be a Principle VI violation wearing a formatting costume.

import {
  addressParts,
  markSameName,
} from '../../src/features/messages/state/addressParts';

describe('addressParts', () => {
  it('splits a three-part address, leaving the town in the weighted line', () => {
    expect(addressParts('Nová 1/777, 60200 Brno, CZ')).toEqual({
      kind: 'parts',
      line1: 'Nová 1/777',
      line2: '60200 Brno, CZ',
    });
  });

  it('splits a two-part address the same way', () => {
    expect(addressParts('Vaclavske namesti 1, 11000 Praha')).toEqual({
      kind: 'parts',
      line1: 'Vaclavske namesti 1',
      line2: '11000 Praha',
    });
  });

  it('keeps the parts in ISDS’s order and drops nothing', () => {
    // Four parts: everything after the first stays put, joined back exactly as it came.
    const out = addressParts('Ulice 8, Dolní Čtvrť, 12345 Abertamy, CZ');
    expect(out).toEqual({
      kind: 'parts',
      line1: 'Ulice 8',
      line2: 'Dolní Čtvrť, 12345 Abertamy, CZ',
    });
    // Nothing invented, nothing lost.
    if (out.kind === 'parts') {
      expect(`${out.line1}, ${out.line2}`).toBe(
        'Ulice 8, Dolní Čtvrť, 12345 Abertamy, CZ',
      );
    }
  });

  it('shows an unrecognised shape WHOLE rather than guessing at it', () => {
    expect(addressParts('Bez ulice 42')).toEqual({
      kind: 'whole',
      text: 'Bez ulice 42',
    });
  });

  it('treats a trailing comma as one part, not two', () => {
    expect(addressParts('Křejpského 1526,')).toEqual({
      kind: 'whole',
      text: 'Křejpského 1526',
    });
  });

  it('trims the surrounding whitespace ISDS sometimes sends', () => {
    expect(addressParts('  Ujezd 450 ,  11000 Praha  ')).toEqual({
      kind: 'parts',
      line1: 'Ujezd 450',
      line2: '11000 Praha',
    });
  });

  it('reports nothing at all as `none` - never as an empty address', () => {
    expect(addressParts(null)).toEqual({ kind: 'none' });
    expect(addressParts(undefined)).toEqual({ kind: 'none' });
    expect(addressParts('')).toEqual({ kind: 'none' });
    expect(addressParts('   ')).toEqual({ kind: 'none' });
    expect(addressParts(' , , ')).toEqual({ kind: 'none' });
  });

  it('never throws on a garbled value (Principle II)', () => {
    // The wire is XML; a caller could hand us anything.
    expect(addressParts(42 as unknown as string)).toEqual({ kind: 'none' });
    expect(addressParts({} as unknown as string)).toEqual({ kind: 'none' });
  });
});

describe('markSameName', () => {
  const r = (boxId: string, name: string) => ({ boxId, name });

  it('flags every result sharing a name, and only those', () => {
    const out = markSameName([
      r('a', 'Jan Novak'),
      r('b', 'Petr Novak'),
      r('c', 'Jan Novak'),
      r('d', 'Jan Novak'),
    ]);
    expect(out.map(x => x.sameName)).toEqual([true, false, true, true]);
  });

  it('ignores case and surrounding whitespace - the same person typed twice', () => {
    const out = markSameName([r('a', 'Jan Novak'), r('b', ' jan novak ')]);
    expect(out.map(x => x.sameName)).toEqual([true, true]);
  });

  it('flags nothing when every name is distinct', () => {
    const out = markSameName([r('a', 'Jan Novak'), r('b', 'Petr Novak')]);
    expect(out.every(x => !x.sameName)).toBe(true);
  });

  it('handles an empty list and a single result', () => {
    expect(markSameName([])).toEqual([]);
    expect(markSameName([r('a', 'Jan Novak')])[0].sameName).toBe(false);
  });
});
