// Cost model for sending (feature 005) - the spec's "critical, easy-to-miss part".
//
// Pure TypeScript, no I/O: classifies a send as free (to an OVM → ordinary data message) vs paid
// (to a private box → Poštovní datová zpráva / PDZ), and picks a price tier + whether the payload
// must go on the large-volume `CreateBigMessage` track. Kept pure so it is exhaustively unit-tested
// with no network (see __tests__/messages/costModel.test.ts).
//
// The CZK figures + thresholds are OBSERVED/approximate (research §5: Fyzická→DPFO ≈ 10 CZK, a large
// message ≈ 30 CZK) and live in this one place so a tariff change is a one-line edit. The exact tier
// boundary and the ordinary→big size limit are confirmed against czebox during implementation
// (research §4/§5); the UI always labels the price "přibližně" and the live balance is authoritative.

import type {
  CostEstimate,
  RecipientDbType,
} from '../../../services/isds/types';

/** Approximate PDZ price by tier, CZK (research §5 - confirm against the operator price list). */
export const PRICE_CZK: { normal: number; large: number } = {
  normal: 10,
  large: 30,
};

/** Total attachment size at/above which the higher ("large") price tier applies. TODO: confirm tariff. */
export const LARGE_TIER_THRESHOLD_BYTES = 1 * 1024 * 1024; // ~1 MB (approx; research §5)

/** Total size above which a message must use `CreateBigMessage` (VoDZ). TODO: confirm against czebox. */
export const BIG_MESSAGE_THRESHOLD_BYTES = 20 * 1024 * 1024; // ~20 MB ordinary-message limit (research §4)

/** Hard ceiling: above this even VoDZ can't carry it → genuinely unsupported (operating rules 2024-01-01). */
export const VODZ_MAX_BYTES = 100 * 1024 * 1024; // 100 MB max large-volume message

/** Minimal shape the cost model needs from an attachment (just its size). */
export interface SizedAttachment {
  sizeBytes: number;
}

/** A send to an OVM is free; every private box type is a paid PDZ. */
export function isPaidRecipient(dbType: RecipientDbType): boolean {
  return dbType !== 'OVM';
}

/** Sum of attachment sizes in bytes (0 for a body-only message). */
export function totalAttachmentBytes(
  attachments: readonly SizedAttachment[],
): number {
  return attachments.reduce((sum, a) => sum + Math.max(0, a.sizeBytes), 0);
}

/**
 * Classify the cost of sending `attachments` to a recipient of `dbType`. Pure - never touches the
 * network. Free (OVM) sends have `tier: 'none'` and `approxCzk: null`; paid (private) sends get a
 * `normal`/`large` tier + approximate CZK. Size routing is independent of price: `bigMessage` (over
 * the ordinary ~20 MB limit) ⇒ the VoDZ `CreateBigMessage` track; `oversize` (over the 100 MB VoDZ
 * max) ⇒ genuinely unsupported.
 */
export function classifyCost(
  dbType: RecipientDbType,
  attachments: readonly SizedAttachment[],
): CostEstimate {
  const bytes = totalAttachmentBytes(attachments);
  const bigMessage = bytes > BIG_MESSAGE_THRESHOLD_BYTES;
  const oversize = bytes > VODZ_MAX_BYTES;

  if (!isPaidRecipient(dbType)) {
    return { paid: false, tier: 'none', approxCzk: null, bigMessage, oversize };
  }

  const large = bytes >= LARGE_TIER_THRESHOLD_BYTES;
  return {
    paid: true,
    tier: large ? 'large' : 'normal',
    approxCzk: large ? PRICE_CZK.large : PRICE_CZK.normal,
    bigMessage,
    oversize,
  };
}
