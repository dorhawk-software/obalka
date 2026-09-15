// The PDZ credit shown on the cost card (feature 020). Pure.
//
// One rule carries this file: **unknown is not zero**. The app learns the balance from ISDS on a
// refresh, and until it has, it does not know. Printing `0 Kč` for "we have not asked" states
// something false about the user's money - and would tell someone with credit that they have none.

import {
  creditState,
  formatCzk,
} from '../../src/features/messages/state/credit';

/** Czech typography separates thousands, and value from unit, with a NON-BREAKING space. Spelled as
 *  an escape here so an assertion failure is readable - the character itself looks like a space. */
const NB = '\u00A0';

describe('formatCzk', () => {
  it('groups thousands and keeps whole koruny', () => {
    expect(formatCzk(1234)).toBe(`1${NB}234${NB}Kč`);
    expect(formatCzk(0)).toBe(`0${NB}Kč`);
  });

  it('rounds to whole koruny - ISDS gives a decimal balance', () => {
    expect(formatCzk(99.6)).toBe(`100${NB}Kč`);
  });
});

describe('creditState', () => {
  it('is UNKNOWN when the balance has never been learned', () => {
    // Not "zero". The distinction is the whole point of this module.
    expect(creditState(null, 10).kind).toBe('unknown');
    expect(creditState(undefined, 10).kind).toBe('unknown');
  });

  it('is a real zero when the box genuinely has nothing', () => {
    const s = creditState(0, 10);
    expect(s.kind).toBe('short');
    expect(s.kind === 'short' && s.balance).toBe(`0${NB}Kč`);
  });

  it('flags a balance that will not cover the price', () => {
    const s = creditState(4, 10);
    expect(s.kind).toBe('short');
  });

  it('is fine when the balance covers the price', () => {
    const s = creditState(120, 10);
    expect(s.kind).toBe('ok');
    expect(s.kind === 'ok' && s.balance).toBe(`120${NB}Kč`);
  });

  it('treats exactly-enough as enough', () => {
    expect(creditState(10, 10).kind).toBe('ok');
  });

  it('does not judge affordability when the price is unknown', () => {
    // The estimate is approximate and can be absent; with no price there is nothing to compare
    // against, so the balance is reported and no claim is made about it.
    const s = creditState(50, null);
    expect(s.kind).toBe('ok');
  });

  it('never throws on nonsense', () => {
    expect(creditState(Number.NaN, 10).kind).toBe('unknown');
    expect(creditState('x' as unknown as number, 10).kind).toBe('unknown');
  });
});
