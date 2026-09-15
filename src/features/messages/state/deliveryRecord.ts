// How the app presents delivery facts. PURE: an envelope in, a shape out. No formatting opinions, no
// theme, no clock.
//
// Mostly the received message's delivery record - the "Doručenka" (feature 017) - plus one rule at the
// bottom that the SENT rail shares, because "never print the same timestamp twice" is a rule about
// honesty rather than about either screen.
//
// WHY THIS IS A RECORD AND NOT A TIMELINE. The sent side draws a rail because a sent message is a
// journey still moving - steps ahead of it have not happened yet. A received message is the opposite:
// merely listing an inbox is what legally serves it, so by the time the app can render one, its
// journey is over. The design named the result after the thing it actually is - a *doručenka*, the
// Czech proof-of-delivery record - rather than after the component it resembles.
//
// Four rules here exist only to stop the app claiming more than ISDS said:
//
//   * A step appears only for something that HAPPENED. Nothing is greyed in as "still coming" (013
//     established that a greyed step reads as a promise), and no step borrows another's timestamp.
//   * "Read" is NOT a step. Opening a message changes nothing legally - service already happened -
//     so putting it on the rail would draw it as part of the legal journey. It is a footnote.
//   * The missing read timestamp is ISDS's silence, not ours, and the note says so. A blank where a
//     time should be reads as the app losing something.
//   * A state the app does not recognise says nothing about SERVICE. Its arrival still shows - that
//     time is ISDS's own field, never read off the state - but no service step is drawn from a value
//     the app cannot interpret; see `isReceivedState`.

import type { MessageEnvelope } from '../../../services/isds/types';
import {
  MESSAGE_STATE,
  messageStateKind,
  type MessageStateKind,
} from './messageState';
import { reportFailure } from '../../../services/telemetry/telemetry';

export type StepKind = 'delivered' | 'accepted' | 'fiction' | 'merged';

export interface RecordStep {
  kind: StepKind;
  /** i18n key for the step's label. */
  labelKey: string;
  /** Already formatted by the caller - see `deliveryRecord`'s signature. */
  time: string;
  /** i18n key for the explanatory line under the step, when it needs one. */
  noteKey?: string;
}

export interface DeliveryRecord {
  /** i18n key for the header band - names fiction when that is what happened. */
  headKey: string;
  steps: RecordStep[];
  /** True when delivery and service collapsed into one step. */
  merged: boolean;
  /** The message has been opened - rendered as a note, never as a step. */
  showRead: boolean;
  /** What became of the message afterwards. Off the rail: these are not delivery events. */
  annotations: ('erased' | 'vault')[];
}

const usable = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v);

/**
 * Whether `state` is one a RECEIVED message can be in, and so one the record may read service from
 * (017 T012).
 *
 * Bounded at both ends, and to whole numbers, for the reason `messageStateKind` gives for its own
 * bound: `dmMessageStatus` is documented as 1–10, so anything else means a garbled envelope, and a
 * garbled envelope must never be read as a legally significant outcome. This builder used to read
 * "served" as `state >= 5`, which turned a 99 carrying two timestamps into Dodáno + Doručeno.
 *
 * The floor is 4, not 1: 1–3 happen before a message reaches any box, so a received message showing
 * one is as unrecognisable here as a 99.
 *
 * Unrecognised degrades to ARRIVAL, not to nothing - the received side's weakest step, as `sent` is
 * `messageStateKind`'s. Only the service step needs the state: sign-in and fiction can be told apart
 * by nothing else, so it cannot be drawn without guessing. The arrival step never came from the state
 * - it is `dmDeliveryTime`, and a message in the user's own box has arrived - and hiding it would
 * hide real facts. Both stores save state 0 for a received detail cached with no list row
 * (`cacheDetail`), a restored backup row without a state becomes 0, and since 017 the detail screen
 * shows the delivery time nowhere but this card.
 */
function isReceivedState(state: number): boolean {
  return (
    Number.isInteger(state) &&
    state >= MESSAGE_STATE.delivered &&
    state <= MESSAGE_STATE.inVault
  );
}

/**
 * Build the record.
 *
 * `fmt` is injected rather than imported, and that is the whole reason this signature looks the way
 * it does. The MERGE RULE is defined against what the user sees:
 *
 *   > delivered and accepted collapse into one step iff their RENDERED times are identical.
 *
 * Keyed to the string, not the epoch. The defect being fixed is *printing the same fact twice*, so
 * the test for it is *would we print the same thing twice* - any threshold in milliseconds could
 * disagree with the screen. Two instants twenty seconds apart render as one minute, and there the
 * merged note ("the box was signed in, so it was served as soon as it arrived") is true anyway; if
 * the display ever gains seconds, the rule follows it instead of quietly becoming wrong.
 */
export function deliveryRecord(
  envelope: MessageEnvelope,
  fmt: (ms: number | null) => string,
): DeliveryRecord {
  const empty: DeliveryRecord = {
    headKey: 'recv.head',
    steps: [],
    merged: false,
    showRead: false,
    annotations: [],
  };
  try {
    if (!envelope) {
      return empty;
    }
    const state = typeof envelope.state === 'number' ? envelope.state : 0;
    // "Served" is asked of 013's state model, not of `state >= 5`. That threshold counted 8
    // (undeliverable) as served - the very mistake 013 was written to remove - and every garbled
    // value above 5 with it. A recipient is never shown 8, but if one arrives it keeps the arrival row
    // and nothing after it, which is what the sent rail draws for it too. An unrecognised state is not
    // forced onto the rail (spec edge case): it keeps its arrival and loses everything that would
    // have to be read off the state - service, the merged row, the fiction header.
    const kind: MessageStateKind = isReceivedState(state)
      ? messageStateKind(state)
      : 'delivered';
    const byFiction = kind === 'fiction';
    const served = byFiction || kind === 'accepted';

    const deliveredAt = usable(envelope.deliveryTime)
      ? envelope.deliveryTime
      : null;
    const acceptedAt = usable(envelope.acceptanceTime)
      ? envelope.acceptanceTime
      : null;

    const steps: RecordStep[] = [];
    let merged = false;

    if (deliveredAt != null && acceptedAt != null && served) {
      if (fmt(deliveredAt) === fmt(acceptedAt) && !byFiction) {
        // One moment, one row. Fiction is never merged: it is served ten days LATER by definition,
        // and a merged row would erase the very gap that makes it fiction.
        merged = true;
        steps.push({
          kind: 'merged',
          labelKey: 'recv.merged',
          time: fmt(deliveredAt),
          noteKey: 'recv.merged.note',
        });
      } else {
        steps.push({
          kind: 'delivered',
          labelKey: 'detail.delivered',
          time: fmt(deliveredAt),
        });
        steps.push(
          byFiction
            ? {
                kind: 'fiction',
                labelKey: 'status.byFiction',
                time: fmt(acceptedAt),
                noteKey: 'recv.fiction.note',
              }
            : {
                kind: 'accepted',
                labelKey: 'detail.accepted',
                time: fmt(acceptedAt),
              },
        );
      }
    } else {
      // Whatever we actually know, and nothing more. A message delivered but not yet served shows
      // one row; a message whose delivery time is missing does not get a row with a borrowed time.
      if (deliveredAt != null) {
        steps.push({
          kind: 'delivered',
          labelKey: 'detail.delivered',
          time: fmt(deliveredAt),
        });
      }
      if (acceptedAt != null && served) {
        steps.push(
          byFiction
            ? {
                kind: 'fiction',
                labelKey: 'status.byFiction',
                time: fmt(acceptedAt),
                noteKey: 'recv.fiction.note',
              }
            : {
                kind: 'accepted',
                labelKey: 'detail.accepted',
                time: fmt(acceptedAt),
              },
        );
      }
    }

    const annotations: ('erased' | 'vault')[] = [];
    if (state === MESSAGE_STATE.contentErased) {
      annotations.push('erased');
    }
    if (state === MESSAGE_STATE.inVault) {
      annotations.push('vault');
    }

    return {
      headKey: byFiction ? 'recv.head.fiction' : 'recv.head',
      steps,
      merged,
      // `read` is a state, not an event: ISDS reports that it happened and never when.
      showRead: state === MESSAGE_STATE.read,
      annotations,
    };
  } catch (e) {
    reportFailure('isds.deliveryRecord', e, { stage: 'parse' });
    return empty; // a delivery record must never take the message screen down with it
  }
}

/**
 * The step's ISDS state kind, which selects its glyph.
 *
 * Shared with the SENT rail via `DeliveryStateIcon`, deliberately: "dodáno" and "doručeno" are
 * different events and must not wear the same mark - a bare check for arrival, a filled disc for
 * service. Drawing both the same was this feature's first bug, caught on the device.
 *
 * A merged step reports the strongest state actually reached, which is service.
 */
export function stepStateKind(kind: StepKind): MessageStateKind {
  switch (kind) {
    case 'delivered':
      return 'delivered';
    case 'fiction':
      return 'fiction';
    case 'accepted':
    case 'merged':
      return 'accepted';
  }
}

/**
 * Collapse a leading pair of steps that would print the SAME time under two labels.
 *
 * For the SENT rail (017 T011). "Odesláno" and "Dodáno" there are not two measurements that happen to
 * coincide - they are **one** ISDS field (`dmDeliveryTime`) rendered twice, because ISDS reports no
 * separate submission time at all. Printing it under two labels implies the app knows two moments,
 * and it does not.
 *
 * Only collapses when BOTH steps have happened. While a message is still on its way, "Odesláno" done
 * and "Dodáno" ahead of it is a real progression and must stay two rows.
 *
 * Generic over the step shape so the sent rail can keep its own richer type.
 */
export function mergeSameTimeHead<
  T extends { kind: string; labelKey: string; time: number | null | undefined; done: boolean; noteKey?: string },
>(steps: T[], fmt: (ms: number | null) => string, merged: { labelKey: string; noteKey: string }): T[] {
  try {
    const [a, b] = steps;
    if (
      steps.length < 2 ||
      !a?.done ||
      !b?.done ||
      a.time == null ||
      b.time == null ||
      fmt(a.time) !== fmt(b.time)
    ) {
      return steps;
    }
    // Keep the SECOND step's kind: it carries the stronger state (delivered), and its glyph is the
    // one that says the message got somewhere.
    return [
      { ...b, labelKey: merged.labelKey, noteKey: merged.noteKey },
      ...steps.slice(2),
    ];
  } catch (e) {
    reportFailure('isds.deliveryRecord', e, { stage: 'parse' });
    return steps;
  }
}
