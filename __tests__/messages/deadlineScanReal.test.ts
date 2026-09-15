// Adversarial pass over the scanner (010 US3) - phrasing it was NOT designed against.
//
// A scanner that only satisfies its author's own fixtures is worth nothing. These are lifted from how
// Czech authorities actually write, plus the ways this rule could plausibly embarrass the app.

import { scanForDeadline } from '../../src/features/messages/state/deadlineScan';

const NOW = new Date(2026, 5, 1).getTime();
const day = (y: number, m: number, d: number) => new Date(y, m, d).getTime();
const scan = (t: string) => scanForDeadline(t, NOW);

describe('real-world phrasing', () => {
  it('reads a payment order', () => {
    const r = scan(
      'VÝZVA K ÚHRADĚ\n\nČástku 4 500 Kč uhraďte nejpozději do 30. 6. 2026 na účet 123-456/0800.',
    );
    expect(r.kind === 'found' && r.date).toBe(day(2026, 5, 30));
  });

  it('reads an appeal instruction with the issue date also present', () => {
    // The trap: two dates, only one of them a deadline. The issue date must not win.
    const r = scan(
      'V Praze dne 2. 6. 2026\n\nProti tomuto rozhodnutí lze podat odvolání do 17. 6. 2026.',
    );
    expect(r.kind).toBe('found');
    expect(r.kind === 'found' && r.date).toBe(day(2026, 6 - 1, 17));
  });

  it('is not tripped by a file number that looks like a date', () => {
    expect(scan('Č. j.: MSMT-12345/2026-3, vydáno 5. 6. 2026').kind).toBe('none');
  });

  it('does not treat a hearing invitation as a deadline', () => {
    expect(
      scan('Ústní jednání se koná dne 20. 6. 2026 v budově úřadu.').kind,
    ).toBe('none');
  });

  it('handles the deadline being stated last, after unrelated dates', () => {
    const r = scan(
      'Vydáno 2. 6. 2026. Jednání 10. 6. 2026. Vyjádřete se do 25. 6. 2026.',
    );
    expect(r.kind === 'found' && r.date).toBe(day(2026, 5, 25));
  });

  it('survives PDF extraction artefacts - collapsed and broken whitespace', () => {
    // Extracted text rarely has tidy spacing; a scanner that needs it would fire on almost nothing.
    expect(scan('uhraďte  do\n8. 7. 2026').kind).toBe('found');
    expect(scan('nejpozději\tdo\t8.7.2026').kind).toBe('found');
  });

  it('stays silent on a document with no dates at all', () => {
    expect(scan('Sdělujeme, že Vaše podání bylo zaevidováno.').kind).toBe('none');
  });
});
