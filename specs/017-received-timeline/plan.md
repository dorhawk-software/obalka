# Implementation Plan: The received delivery record

**Branch**: `017-received-timeline` | **Date**: 2026-08-17 | **Spec**: [spec.md](./spec.md)
**Design**: [design-system.md](./design-system.md)

## Summary

Replace the grey caption under a received message's sender with the *Doručenka* card the design
returned: a titled header, one or two delivery steps, an optional read footnote, and optional
post-delivery annotations. Pure presentation over data already in the archive.

## Technical Context

**Dependencies**: none new. **Storage**: none new. **Network**: none.
**Testing**: the record's shape is a pure function of the envelope → unit tests, plus render tests.

## Constitution Check

| Principle | Status |
|---|---|
| I — UI thread | ✅ synchronous derivation from an envelope already in memory |
| II — Crash-resilient | ✅ the builder is total; a garbled time yields fewer steps, an unrecognised state yields its arrival alone (tasks T012), never a throw |
| III — Privacy | ✅ nothing leaves the device |
| IV — Archive sacred | ✅ read-only |
| V — Accessible, Czech-first | ✅ cs + en; metrics from the design; verified at 1.5× and in dark |
| VI — Honest scope | ⚠️ the whole point — see below |
| VII — Test environment | ✅ walked on a device 2026-08-17 on the production box, which carries both the merged and the two-step case (tasks T009); not walked on czebox |

**Principle VI carries this feature.** Three of its rules exist only to stop the app implying more
than ISDS said:

1. No step may be shown for something that has not happened (013's rule: a greyed step reads as
   "still coming").
2. "Read" is not part of the legal journey and must not be drawn as though it were.
3. The missing read timestamp is **ISDS's** silence. The app says so rather than leaving a blank that
   looks like its own failure.

## The one decision the design does not make

`dRec`'s logic sits past `get_file`'s 256 KiB cap, so **the merge rule is ours**:

> Merge the delivered and accepted steps **iff their rendered timestamps are identical**.

Keyed to the rendered string rather than to the raw epoch, and deliberately:

- The defect is *printing the same fact twice*, so the test for it is *would we print the same thing
  twice*. Anything else can disagree with what the user sees.
- Two instants 20 seconds apart render identically at minute granularity — and in that case the
  merged note ("the box was signed in when it arrived") is **true**, so merging is not a lie.
- If the display granularity ever changes, the rule follows it automatically instead of quietly
  becoming wrong.

## Structure

```
src/features/messages/state/deliveryRecord.ts    # NEW — pure builder, the shape of the record
src/features/messages/screens/DeliveryRecord.tsx # NEW — the card
src/features/messages/screens/MessageDetail.tsx  # caption removed, card added
src/i18n/strings.ts                              # 6 new strings, cs + en
__tests__/messages/deliveryRecord.test.ts        # NEW
```

The builder takes the **already-formatted times** as an argument rather than importing the formatter,
so the merge rule is testable without a locale or a clock.

## Complexity Tracking

Nothing to justify.
