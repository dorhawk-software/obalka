// The box's PDZ credit, as the UI needs it (feature 020). Pure - no I/O, no theme.
//
// THE RULE THIS MODULE EXISTS FOR: **unknown is not zero.**
//
// `pdzCreditCzk` is null until a refresh has successfully asked ISDS. Rendering that as `0 Kč` would
// tell someone who has just bought credit that they have none - a false statement about their money,
// produced by treating "we have not asked" and "you have nothing" as the same value. They are
// different facts and only one of them is ours to state (Principle VI).

/**
 * The non-breaking space Czech typography sets between thousands, and between a value and its unit.
 * Spelled as an escape on purpose: as a literal it is indistinguishable from a plain space in a
 * diff, a review, or a failing assertion - which already cost one baffling "expected '1 234 Kč',
 * received '1 234 Kč'".
 */
const NBSP = '\u00A0';

/** Whole koruny, grouped - ISDS reports a decimal balance nobody wants to read to the haléř. */
export function formatCzk(czk: number): string {
  const whole = Math.round(czk);
  // Narrow no-break space between groups, as Czech typography sets it.
  const grouped = String(Math.abs(whole)).replace(
    /\B(?=(\d{3})+(?!\d))/g,
    NBSP,
  );
  return `${whole < 0 ? '\u2212' : ''}${grouped}${NBSP}Kč`;
}

export type CreditState =
  /** Never learned. Show nothing at all. */
  | { kind: 'unknown' }
  /** Known, and it covers the estimate (or there is no estimate to judge against). */
  | { kind: 'ok'; balance: string }
  /** Known, and it does NOT cover the estimate. Includes a genuine zero. */
  | { kind: 'short'; balance: string };

/**
 * Decide what to say about a box's credit against an estimated price.
 *
 * `priceCzk` may be null: the estimate is approximate and sometimes absent, and with nothing to
 * compare against the app reports the balance and makes no claim about affordability. It never
 * promises a send will succeed - the balance can be stale and the price is approximate - which is
 * why `short` is phrased as a caution at the call site rather than as a refusal.
 */
export function creditState(
  balanceCzk: number | null | undefined,
  priceCzk: number | null | undefined,
): CreditState {
  if (typeof balanceCzk !== 'number' || !Number.isFinite(balanceCzk)) {
    return { kind: 'unknown' };
  }
  const balance = formatCzk(balanceCzk);
  if (typeof priceCzk !== 'number' || !Number.isFinite(priceCzk)) {
    return { kind: 'ok', balance };
  }
  return balanceCzk >= priceCzk ? { kind: 'ok', balance } : { kind: 'short', balance };
}
