// The ISDS message-state model (013). Replaces the old three-state `sentStatus`, which collapsed
// `dmMessageStatus` 1–3 into "Odesláno" and 5–10 into "Doručeno" - and so reported state 8
// (UNDELIVERABLE) as delivered and left state 3 (failed the antivirus check, never delivered) sitting
// on "Odesláno" forever.
//
// ISDS has ten states. The design maps them onto FIVE treatments, because several states differ only
// in ways a user cannot act on:
//
//   1 podána · 2 orazítkována              → `sent`       in transit; 2 only adds a timestamp
//   3 neprošla antivirovou kontrolou       → `stop`       never delivered to anyone, terminal
//   4 dodána                               → `delivered`  in the box, not yet legally served
//   5 doručena FIKCÍ                       → `fiction`    served by law; nobody signed in
//   6 doručena PŘIHLÁŠENÍM · 7 přečtena    → `accepted`   a person with access signed in
//   8 nedoručitelná                        → `stop`       box made inaccessible, terminal
//   9 obsah smazán · 10 v Datovém trezoru  → `accepted` + an ANNOTATION (the journey already finished)
//
// NOTE the 5/6 order: 5 is fikcí and 6 is přihlášením, NOT the other way round. The previous comment
// here had them swapped. Source in-repo: `docs/isds-ws-news/2179_Info_pro_vyvojare_2020_9.md` §3.2 -
// "Doručeno fikcí (5)" … "Doručeno přihlášením (6)". (Bulletin 2184 contains a typo calling 6
// "doručená fikcí"; 2179 is the one that defines them.)
//
// Which states are reachable is ASYMMETRIC, and the UI depends on it:
//   * As the SENDER we can see 1–6 and 8–10. We never see 7 - since 2019 ISDS deliberately stops
//     reporting "the recipient opened it" to the sender (bulletin 2184), so for us 6 is TERMINAL and
//     nothing downstream should imply a read receipt is coming.
//   * As the RECIPIENT we can see 4–7 and 9–10, never 1–3 or 8 - those happen before, or instead of,
//     the message reaching us.

import type { ChipKind } from '../../../theme/chipTone';

/** `dmMessageStatus` values, named. The wire field is an integer 1–10. */
export const MESSAGE_STATE = {
  submitted: 1,
  stamped: 2,
  antivirusFailed: 3,
  delivered: 4,
  servedByFiction: 5,
  servedBySignIn: 6,
  read: 7,
  undeliverable: 8,
  contentErased: 9,
  inVault: 10,
} as const;

/** Retained for the call sites that only ask "is it at least delivered / at least served". */
export const MESSAGE_STATE_DELIVERED = MESSAGE_STATE.delivered;
export const MESSAGE_STATE_SERVED = MESSAGE_STATE.servedByFiction;

/**
 * The five visual treatments. `stop` is the inverted one - the design gives 3 and 8 a single
 * treatment because the user's next move is identical for both: send it another way.
 */
export type MessageStateKind =
  | 'sent'
  | 'delivered'
  | 'accepted'
  | 'fiction'
  | 'stop';

/** A finished journey can carry a footnote. These are states, but they read as annotations. */
export type MessageAnnotation = 'erased' | 'vault';

export interface MessageStatus {
  kind: MessageStateKind;
  /** i18n key for the chip/step label. */
  labelKey: string;
  /** Chip palette for `chipTone`. */
  tone: ChipKind;
  /**
   * Terminal failure (3 or 8): the journey stopped and will not resume. The timeline must not draw
   * the remaining steps as merely "pending".
   */
  terminal: boolean;
  /** `erased` (9) or `vault` (10) - shown as a footnote, not as the state itself. */
  annotation: MessageAnnotation | null;
}

const TONE: Record<MessageStateKind, ChipKind> = {
  sent: 'statusSent',
  delivered: 'statusDelivered',
  accepted: 'statusRead',
  fiction: 'statusFiction',
  stop: 'statusStop',
};

const LABEL: Record<MessageStateKind, string> = {
  sent: 'messages.status.sent',
  delivered: 'detail.delivered',
  accepted: 'detail.accepted',
  fiction: 'status.byFiction',
  stop: 'status.stop',
};

/**
 * The kind alone, for callers that don't need the whole record.
 *
 * The upper bound is deliberate. `dmMessageStatus` is documented as 1–10, and an out-of-range value
 * means we are reading a garbled envelope - in which case the safe answer is "in transit", never
 * "delivered". Claiming a legally significant outcome from a value we do not recognise is the same
 * class of error as the state-8 bug this module was written to fix.
 */
export function messageStateKind(state: number): MessageStateKind {
  if (
    !Number.isFinite(state) ||
    state < MESSAGE_STATE.submitted ||
    state > MESSAGE_STATE.inVault
  ) {
    return 'sent';
  }
  if (
    state === MESSAGE_STATE.antivirusFailed ||
    state === MESSAGE_STATE.undeliverable
  ) {
    return 'stop';
  }
  if (state === MESSAGE_STATE.servedByFiction) {
    return 'fiction';
  }
  if (state >= MESSAGE_STATE.servedBySignIn) {
    // 6, 7, and the two archival states - all of them were served by a sign-in.
    return 'accepted';
  }
  if (state >= MESSAGE_STATE.delivered) {
    return 'delivered';
  }
  return 'sent'; // 1 and 2
}

/**
 * Tone, label and footnote for a message state. Used by BOTH the list row and the detail so the two
 * can never disagree - they previously each had their own copy and one used the "read" threshold.
 *
 * `state` values outside 1–10 (a garbled envelope) degrade to `sent` rather than throwing.
 */
export function messageStatus(state: number): MessageStatus {
  const kind = messageStateKind(state);
  return {
    kind,
    labelKey: LABEL[kind],
    tone: TONE[kind],
    terminal: kind === 'stop',
    annotation:
      state === MESSAGE_STATE.contentErased
        ? 'erased'
        : state === MESSAGE_STATE.inVault
        ? 'vault'
        : null,
  };
}

/**
 * Why the journey stopped - the explanatory line under a terminal timeline. Only states 3 and 8 have
 * one; everything else returns null (there is nothing to explain about a message that arrived).
 */
export function stopReasonKey(state: number): string | null {
  if (state === MESSAGE_STATE.antivirusFailed) {
    return 'status.stop.antivirus';
  }
  if (state === MESSAGE_STATE.undeliverable) {
    return 'status.stop.undeliverable';
  }
  return null;
}

/**
 * Whether a chip is worth drawing on a SENT list row. The design's rule: a chip appears only when the
 * news is not what you would assume from a message you sent - i.e. it was served without anyone
 * reading it, or it never arrived at all. Ordinary progress is carried by the row's glyph alone.
 */
export function showsListChip(state: number): boolean {
  const kind = messageStateKind(state);
  return kind === 'fiction' || kind === 'stop';
}

/**
 * Which tone a SENT-side fiction countdown gets, by how close it is.
 *
 * `chipTone.ts` has declared `fikceRed` (≤3 days) and `fikceAmber` (≤7) since the redesign and
 * NOTHING drew them: every countdown rendered `statusFiction` gold, so "fikce za 9 dní" and "fikce
 * dnes" were the same colour and the one escalation the design system specifies was dead code.
 * Found by the 2026-09-09 critique.
 *
 * Above seven days it stays gold - the same tone the received side uses for an already-served
 * message, which is right: at that distance the news is "this is running", not "hurry".
 */
export function fictionCountdownTone(
  daysRemaining: number,
): 'fikceRed' | 'fikceAmber' | 'statusFiction' {
  if (daysRemaining <= 3) {
    return 'fikceRed';
  }
  if (daysRemaining <= 7) {
    return 'fikceAmber';
  }
  return 'statusFiction';
}
