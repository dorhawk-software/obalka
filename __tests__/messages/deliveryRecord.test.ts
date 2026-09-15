// The received delivery record - "Doručenka" (feature 017). Pure: an envelope in, a shape out.
//
// Everything here is a Principle VI rule wearing a test's clothes. The block reports how a legally
// delivered document reached someone, so each assertion below is really the same question: does the
// app say more than ISDS told it?
//
// The formatter is injected rather than imported, which is the point of the whole signature: the
// merge rule is defined against what the user SEES, so a test can drive it without a locale or a
// clock.

import {
  deliveryRecord,
  mergeSameTimeHead,
  stepStateKind,
} from '../../src/features/messages/state/deliveryRecord';
import { MESSAGE_STATE } from '../../src/features/messages/state/messageState';
import type { MessageEnvelope } from '../../src/services/isds/types';

/** Minute-granularity formatter, matching what the detail screen renders. */
const fmt = (ms: number | null) =>
  ms == null ? '—' : new Date(ms).toISOString().slice(0, 16).replace('T', ' ');

const envelope = (over: Partial<MessageEnvelope>): MessageEnvelope => ({
  id: 'm1',
  subject: 'Předmět',
  sender: 'Úřad',
  senderAddress: null,
  recipient: null,
  recipientAddress: null,
  recipientBoxId: null,
  deliveryTime: Date.UTC(2026, 5, 12, 14, 58),
  acceptanceTime: Date.UTC(2026, 5, 14, 9, 15),
  state: MESSAGE_STATE.servedBySignIn,
  attachmentSize: null,
  ...over,
});

describe('deliveryRecord', () => {
  it('shows two steps when delivery and service happened at different times', () => {
    const r = deliveryRecord(envelope({}), fmt);
    expect(r.steps.map(s => s.kind)).toEqual(['delivered', 'accepted']);
    expect(r.steps[0].time).not.toBe(r.steps[1].time);
    expect(r.merged).toBe(false);
  });

  it('MERGES into one step when the two render identically - never the same time twice', () => {
    // The real case: the box was signed in, so ISDS served the message the moment it arrived.
    const at = Date.UTC(2026, 5, 12, 14, 58);
    const r = deliveryRecord(
      envelope({ deliveryTime: at, acceptanceTime: at }),
      fmt,
    );
    expect(r.steps).toHaveLength(1);
    expect(r.merged).toBe(true);
    expect(r.steps[0].kind).toBe('merged');
    expect(r.steps[0].noteKey).toBe('recv.merged.note');
  });

  it('merges when the instants differ but the RENDERED times do not', () => {
    // 20 seconds apart, one minute on screen. Printing both would show the same string twice, and
    // the merged note ("signed in when it arrived") is true here anyway.
    const r = deliveryRecord(
      envelope({
        deliveryTime: Date.UTC(2026, 5, 12, 14, 58, 5),
        acceptanceTime: Date.UTC(2026, 5, 12, 14, 58, 25),
      }),
      fmt,
    );
    expect(r.steps).toHaveLength(1);
  });

  it('does NOT merge when a second-level formatter tells them apart', () => {
    // The rule follows the display. A finer formatter means the user can see the difference, so the
    // record shows both - no separate constant to keep in sync.
    const precise = (ms: number | null) =>
      ms == null ? '—' : new Date(ms).toISOString();
    const r = deliveryRecord(
      envelope({
        deliveryTime: Date.UTC(2026, 5, 12, 14, 58, 5),
        acceptanceTime: Date.UTC(2026, 5, 12, 14, 58, 25),
      }),
      precise,
    );
    expect(r.steps).toHaveLength(2);
  });

  it('names fiction in the header and gives the step its own kind and note', () => {
    const r = deliveryRecord(
      envelope({ state: MESSAGE_STATE.servedByFiction }),
      fmt,
    );
    expect(r.headKey).toBe('recv.head.fiction');
    expect(r.steps[1].kind).toBe('fiction');
    expect(r.steps[1].noteKey).toBe('recv.fiction.note');
  });

  it('shows ONLY what happened when the message is not yet served', () => {
    // 013's rule: a greyed-in step reads as "still coming". Nothing is coming that we know of.
    const r = deliveryRecord(
      envelope({ state: MESSAGE_STATE.delivered, acceptanceTime: null }),
      fmt,
    );
    expect(r.steps).toHaveLength(1);
    expect(r.steps[0].kind).toBe('delivered');
  });

  it('treats "read" as a note, never as a step', () => {
    const r = deliveryRecord(envelope({ state: MESSAGE_STATE.read }), fmt);
    expect(r.showRead).toBe(true);
    expect(r.steps.map(s => s.kind)).not.toContain('read');
  });

  it('says nothing about reading when it has not been read', () => {
    expect(deliveryRecord(envelope({}), fmt).showRead).toBe(false);
  });

  it('puts erasure and the vault in annotations, off the rail', () => {
    const erased = deliveryRecord(
      envelope({ state: MESSAGE_STATE.contentErased }),
      fmt,
    );
    expect(erased.annotations).toEqual(['erased']);
    expect(erased.steps.map(s => s.kind)).not.toContain('erased');

    const vault = deliveryRecord(envelope({ state: MESSAGE_STATE.inVault }), fmt);
    expect(vault.annotations).toEqual(['vault']);
  });

  it('still reports the delivery steps for an archived message', () => {
    // Content erased at 90 days does not un-deliver it; the receipt outlives the document.
    const r = deliveryRecord(
      envelope({ state: MESSAGE_STATE.contentErased }),
      fmt,
    );
    expect(r.steps.length).toBeGreaterThan(0);
  });

  it('never throws on garbage (Principle II)', () => {
    expect(() =>
      deliveryRecord(
        envelope({
          deliveryTime: Number.NaN,
          acceptanceTime: null,
          state: 99,
        }),
        fmt,
      ),
    ).not.toThrow();
    expect(() =>
      deliveryRecord(null as unknown as MessageEnvelope, fmt),
    ).not.toThrow();
  });

  it('does NOT force an unrecognised state onto the rail, even with both timestamps (017 T012)', () => {
    // The spec's edge case. The old builder read "served" as `state >= 5`, so a garbled 99 carrying
    // two real-looking times came out as Dodáno + Doručeno - a legal outcome claimed from a value the
    // app does not know. The garbage test above never caught it: it had no acceptance time and only
    // asked that nothing threw. The arrival stays: its time is ISDS's own field, not the state's.
    const deliveredAt = Date.UTC(2026, 5, 12, 14, 58);
    const r = deliveryRecord(
      envelope({
        state: 99,
        deliveryTime: deliveredAt,
        acceptanceTime: Date.UTC(2026, 5, 14, 9, 15),
      }),
      fmt,
    );
    expect(r.steps).toEqual([
      {
        kind: 'delivered',
        labelKey: 'detail.delivered',
        time: fmt(deliveredAt),
      },
    ]);
    expect(r.merged).toBe(false);
    expect(r.headKey).toBe('recv.head');
    expect(r.showRead).toBe(false);
    expect(r.annotations).toEqual([]);
  });

  it('does not merge an unrecognised state either, when the two times coincide', () => {
    // The merged row is a claim of service too ("signed in when it arrived"), so it is held to the
    // same bound as the two-step shape.
    const at = Date.UTC(2026, 5, 12, 14, 58);
    const r = deliveryRecord(
      envelope({ state: 99, deliveryTime: at, acceptanceTime: at }),
      fmt,
    );
    expect(r.steps.map(s => s.kind)).toEqual(['delivered']);
    expect(r.merged).toBe(false);
  });

  it('does not fall back to the acceptance time when an unrecognised state has no arrival', () => {
    // With no usable delivery time, nothing on the envelope stands without its state - so the record
    // is empty, and the card, which hides an empty record, draws nothing.
    const r = deliveryRecord(envelope({ state: 99, deliveryTime: null }), fmt);
    expect(r.steps).toEqual([]);
  });

  it.each([
    ['just above the range', 11],
    ['far out of range', 1000],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['a fraction between fiction and sign-in', 5.5],
    ['a fraction past sign-in', 6.5],
  ])('draws no service step for %s', (_label, state) => {
    // Every one of these cleared the old `state >= 5` gate and was drawn as served.
    const r = deliveryRecord(envelope({ state }), fmt);
    expect(r.steps.map(s => s.kind)).toEqual(['delivered']);
    expect(r.headKey).toBe('recv.head');
  });

  it.each([
    ['zero (what the stores save for a received detail with no list row)', 0],
    ['negative', -1],
    ['NaN (a non-numeric status on the wire)', Number.NaN],
    ['a sender-only state (1, submitted)', MESSAGE_STATE.submitted],
    ['a sender-only state (3, failed the antivirus check)', MESSAGE_STATE.antivirusFailed],
  ])('keeps the arrival for %s', (_label, state) => {
    // A guard against over-correcting. These never reached the old `state >= 5` gate and always drew
    // arrival alone; a bound that hid them would take the delivery time off a real message. State 0
    // is not hypothetical - `cacheDetail` saves it when a detail arrives before any list row.
    const r = deliveryRecord(envelope({ state }), fmt);
    expect(r.steps.map(s => s.kind)).toEqual(['delivered']);
  });

  it('never draws an undeliverable message (8) as served', () => {
    // 8 sits inside the range, so it is recognised - but it is a STOP, and `state >= 5` used to call
    // it served. It keeps what the sent rail also shows for it: arrival, and nothing after.
    const r = deliveryRecord(
      envelope({ state: MESSAGE_STATE.undeliverable }),
      fmt,
    );
    expect(r.steps.map(s => s.kind)).toEqual(['delivered']);
    expect(r.merged).toBe(false);
  });

  it('keeps every state a recipient can actually see on the rail', () => {
    // The bound must not cost a real message its record: 4 is arrival alone, 5 is fiction, and 6, 7,
    // 9, 10 were all served by a sign-in.
    const kinds = (state: number) =>
      deliveryRecord(envelope({ state }), fmt).steps.map(s => s.kind);
    expect(kinds(MESSAGE_STATE.delivered)).toEqual(['delivered']);
    expect(kinds(MESSAGE_STATE.servedByFiction)).toEqual(['delivered', 'fiction']);
    expect(kinds(MESSAGE_STATE.servedBySignIn)).toEqual(['delivered', 'accepted']);
    expect(kinds(MESSAGE_STATE.read)).toEqual(['delivered', 'accepted']);
    expect(kinds(MESSAGE_STATE.contentErased)).toEqual(['delivered', 'accepted']);
    expect(kinds(MESSAGE_STATE.inVault)).toEqual(['delivered', 'accepted']);
  });

  it('drops a step whose time is unusable rather than borrowing another one', () => {
    const r = deliveryRecord(
      envelope({ deliveryTime: null, acceptanceTime: Date.UTC(2026, 5, 14) }),
      fmt,
    );
    expect(r.steps.every(s => s.kind !== 'delivered')).toBe(true);
  });
});

describe('stepStateKind - the glyph each step wears', () => {
  it('gives arrival and service DIFFERENT marks', () => {
    // Caught on the device: every step was drawing the same filled disc, so "dodáno" and "doručeno"
    // looked like the same event. They are not, and the sent rail has always distinguished them.
    expect(stepStateKind('delivered')).toBe('delivered');
    expect(stepStateKind('accepted')).toBe('accepted');
    expect(stepStateKind('delivered')).not.toBe(stepStateKind('accepted'));
  });

  it('keeps fiction distinct from ordinary service', () => {
    expect(stepStateKind('fiction')).toBe('fiction');
    expect(stepStateKind('fiction')).not.toBe(stepStateKind('accepted'));
  });

  it('marks a merged step by the strongest state it actually reached', () => {
    // It reports arrival AND service in one row; service is the one with legal consequence.
    expect(stepStateKind('merged')).toBe('accepted');
  });
});

describe('mergeSameTimeHead - the SENT rail (017 T011)', () => {
  type Step = {
    kind: string;
    labelKey: string;
    time: number | null;
    done: boolean;
    noteKey?: string;
  };
  const step = (over: Partial<Step> = {}): Step => ({
    kind: 'sent',
    labelKey: 'messages.status.sent',
    time: Date.UTC(2026, 6, 24, 10, 9),
    done: true,
    ...over,
  });
  const M = { labelKey: 'sent.merged', noteKey: 'sent.merged.note' };

  it('collapses Odesláno + Dodáno once BOTH have happened', () => {
    // They are not two measurements that coincide - they are one ISDS field printed twice.
    const out = mergeSameTimeHead(
      [step({}), step({ kind: 'delivered', labelKey: 'detail.delivered' })],
      fmt,
      M,
    );
    expect(out).toHaveLength(1);
    expect(out[0].labelKey).toBe('sent.merged');
    expect(out[0].noteKey).toBe('sent.merged.note');
    // Keeps the stronger state's glyph - the one that says it got somewhere.
    expect(out[0].kind).toBe('delivered');
  });

  it('keeps them apart while the message is still on its way', () => {
    // "Sent, and delivery still ahead" is a real progression, not a duplicated fact.
    const out = mergeSameTimeHead(
      [
        step({}),
        step({ kind: 'delivered', labelKey: 'detail.delivered', done: false }),
      ],
      fmt,
      M,
    );
    expect(out).toHaveLength(2);
  });

  it('keeps them apart when the times genuinely differ', () => {
    const out = mergeSameTimeHead(
      [
        step({}),
        step({
          kind: 'delivered',
          labelKey: 'detail.delivered',
          time: Date.UTC(2026, 6, 24, 13, 12),
        }),
      ],
      fmt,
      M,
    );
    expect(out).toHaveLength(2);
  });

  it('leaves the steps after the pair untouched', () => {
    const out = mergeSameTimeHead(
      [
        step({}),
        step({ kind: 'delivered', labelKey: 'detail.delivered' }),
        step({
          kind: 'accepted',
          labelKey: 'detail.accepted',
          time: Date.UTC(2026, 6, 24, 13, 12),
        }),
      ],
      fmt,
      M,
    );
    expect(out).toHaveLength(2);
    expect(out[1].kind).toBe('accepted');
  });

  it('never merges a step with no time, and never throws', () => {
    const out = mergeSameTimeHead(
      [step({ time: null }), step({ kind: 'delivered', time: null })],
      fmt,
      M,
    );
    expect(out).toHaveLength(2);
    expect(() => mergeSameTimeHead([], fmt, M)).not.toThrow();
  });
});
