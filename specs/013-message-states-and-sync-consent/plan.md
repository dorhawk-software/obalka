# Implementation Plan: Message states & background-sync consent

**Spec**: [spec.md](./spec.md) · **Built**: 2026-07-26 · **Retrospective**, written 2026-08-16.

The two documents written *during* the feature carry the detail and are not duplicated here:

- **[`design-prompts.md`](./design-prompts.md)** — the hand-off to Claude Design: §0 shared context,
  §1 visual vocabulary, §2 timeline with failure branches, §3 splitting sync, §4 the consent moment,
  §5 the delivery-receipt notification, §6 relocating the fikce countdown.
- **[`port-notes.md`](./port-notes.md)** — what the design chose, the **six places the port diverged**,
  the on-device pass, and the verification that was owed (since resolved).

This file records the shape of the work and the decisions that were not the design's to make.

## Constitution Check

| Principle | Effect |
|---|---|
| I — Never Block the UI Thread | Unaffected. |
| II — Crash-Resilient by Contract | `messageStateKind` is total, including out-of-range input, which degrades to `sent` rather than throwing. |
| III — Privacy First, On-Device Only | The consent screen existed to keep a legally significant act from happening without the user's knowledge. Superseded by 014, which removed the act. |
| IV — The Local Archive | Unaffected here. |
| V — Modern, Accessible, Consistent | All visuals came from Claude Design; tones added to `chipTone.ts` rather than hand-tuned per screen. The on-device pass found three a11y/layout defects the automated gate missed (below). |
| VI — Honest Scope | The feature exists because the app was making a false statement about a legal fact. |
| VII — Verify Against the Test Environment | Emulator + a live czebox box; the countdown was confirmed against real ISDS data. |

## Workflow: design-first, deliberately

Per the user's standing instruction, screens are **designed by Claude Design, never invented in code**.
013 followed 012 Phase D: write the hand-off, send it, diff what returns, port it, record the
divergences. `design-prompts.md` states the trade-off it accepted — the hand-off was front-run so design
and spec work could overlap. The spec never caught up, which is what this file and `spec.md` fix.

The design returned §1–§5 and answered §6 as well. The `.dc.html` came back +17 023 characters across
24 hunks.

**One operational finding worth keeping**: `Obalka Redesign.dc.html` is now 260 189 characters and
DesignSync's `get_file` caps at **256 KiB**, so the fetched copy truncates mid-`render()`. Everything
load-bearing survived — all markup, both `STR` tables, and the `SENT_KIND` / `stateVisual` /
`decorateSent` / `decorate` logic — but the file needs splitting, or a range-capable read, before the
next round loses something real.

## What the port had to decide on its own

Six divergences, each argued in `port-notes.md`. The two with the widest blast radius:

**Fields ISDS does not give us.** The design's mock data carries `stampedAt`, `failedAt` and `erasedAt`.
`MessageEnvelope` has only `deliveryTime`, `acceptanceTime` and `state`. Rather than fabricate a
timestamp — 009's standing rule — the stop step shows an em-dash and the annotations show no date.

**Copy NOT taken from the design.** The design's `downloadFullNote` still read *"Tím se zpráva považuje
za doručenou"*. That claim is false and had already been corrected in 012 (§17/3 — the *list* serves the
message; the download has no legal effect). The shipped, corrected wording was kept and the design's
reverted string ignored. Same for the design's FAQ answer i1, which says a message is served by signing
in *and opening it*; opening is not required.

A design is authoritative about *how it looks*, not about what the law says. Both divergences are of
that kind.

## Technical decisions

**D1 — One state function, two call sites.** `messageState.ts` replaced `sentStatus.ts` entirely. The
list row and the detail previously each had their own copy of the mapping and one used the "read"
threshold, which is how state 8 came to read as *Doručeno*. They now share `messageStatus()`.

**D2 — `stop` is the only inverted treatment in the app.** Ink and paper swapped, so a terminal failure
reads as a full stop rather than as another coloured status — and does not borrow the fikce red, which
means "hurry" rather than "broken".

**D3 — Out-of-range states degrade to `sent`.** A value outside 1–10 means a garbled envelope; the safe
answer is "in transit", never "delivered". Caught by the module's own test during development.

**D4 — The received-sync guard rail wrapped the call, not the notification.** `if (!deps.received)
continue;` sat around `listReceived` itself, so "off" meant the delivering call was never reached rather
than its notification being suppressed. *(Removed with the pass in 014, but the principle carried
forward: 014's `BackgroundSyncDeps` stopped offering `listReceived` at the type level.)*

**D5 — `syncInterval` was not migrated into `syncReceived`.** A user who had hourly sync on never
consented in the informed sense the new screen asked for — it was the default. Carrying it forward would
have upgraded them into an ongoing legal act. Cadence carried; consent did not.

## On-device pass (2026-07-26)

Three defects, none of which tsc, eslint or 359 unit tests could see. Detail in `port-notes.md`:

1. A `color: 'transparent'` placeholder in the locked notification preview **rendered as a visible
   em-dash** and was read aloud by the screen reader. Replaced with a genuinely empty fixed slot.
2. At **1.5× font scale** the consent screen's decline button ellipsized to *"Nechat vypn…"* — precisely
   the button the design says must never look like the lesser option. Added a stacking breakpoint.
3. **Every `Toggle` was unlabelled** in the accessibility tree; the switch is a sibling of its row
   title, so nothing associated them. `label` became a required prop.

The third is the one worth remembering: it was a pre-existing defect this feature merely revealed, and
it affected the app-lock toggle too.

## Verification

- Gate at merge: tsc 0, eslint 0 errors, **359 tests**.
- Live czebox: the sent-side fikce countdown fired on a real message for the first time.
- Migration: an install with `syncInterval: hourly` came up received-sync **off**, cadence preserved.

## Follow-ups this feature generated

- **A false iOS lock-screen privacy claim** (fixed `1009abe`) — `notifeeNotifier.ts` had no iOS branch
  at all, so the shipped promise was untrue there.
- **Notification switches that were stored and never read** (fixed in 014's first pass).
- **The Provozní řád verification** listed as owed here was completed on 2026-08-14, and its answer
  removed a third of this feature. See [`014`](../014-no-background-sync/spec.md).
