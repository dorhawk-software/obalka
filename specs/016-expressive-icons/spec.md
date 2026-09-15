# Feature Specification: Expressive iconography — give the app a voice

**Feature Branch**: `016-expressive-icons`
**Created**: 2026-08-17
**Status**: **Implemented 2026-08-17** (13/15 — T013's device walk is partial; T014 superseded by 010's decision). **Design-led**: the scale, the rule, the budget and the placements are in
[`design-system.md`](./design-system.md). The visual answer comes from Claude Design
([`design-prompts.md`](./design-prompts.md)); this spec fixes the rules that answer must satisfy and
what "done" means, so the port is a port and not a second design pass.
**Input**: User description: "use huge icons to deliberately sprinkle some icons here and there, the
app seems a little too tame for now"

## Why

The 009 redesign made the app calm, warm and legible, and it succeeded. What it did not give it is a
**focal point that is not text**. Every glyph in the app is a 13–22px Lucide stroke at roughly the same
weight, so no screen is ever loud on purpose and nothing announces what it is at a glance.

The design already contains the instinct, once: the **44px gold numeral** beside "Vyžaduje pozornost"
is oversized, confident, and makes that one block feel designed rather than assembled. Nothing else in
the app does anything like it. This feature makes that a deliberate, bounded system instead of a
one-off.

**This is not licence to decorate.** The app carries legal mail, and a large glyph next to a message is
read as a statement about that message. The whole risk of this feature is that character gets bought
with a false or misleading impression — which is the same defect the app has now shipped twice (a
lock-screen promise it did not keep, a "Doručeno fikcí" pill on messages never served by fiction). The
requirements below exist to buy the character somewhere else.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - An empty screen that says something (Priority: P1)

Someone opens a box with no messages, or a search that found nothing, and meets a screen that looks
composed and intentional rather than a small grey outline over two lines of text.

**Why this priority**: the highest visual payoff for the lowest risk in the whole feature. There is no
content on screen for a big glyph to be misread against, and today's empty states are the tamest thing
in the app — a 48px glyph in border-grey. It is also self-contained: it ships without touching a single
screen that displays real mail.

**Independent Test**: open a box with an empty folder and run a search with no results, at 1.0× and
1.5× font scale, in light and dark.

**Acceptance Scenarios**:

1. **Given** a folder with no messages, **When** it is shown, **Then** the empty state renders at the
   design's hero tier, correct in both themes.
2. **Given** a screen reader is running, **When** it reaches the empty state, **Then** it announces the
   headline and hint and **does not announce the glyph** — which carries no information the words do
   not.
3. **Given** 1.5× font scale, **When** the empty state is shown, **Then** nothing clips, overlaps or
   scrolls horizontally.

---

### User Story 2 - Anchors in long text screens (Priority: P2)

Someone scrolling Settings, the FAQ, or a message detail gets glyph anchors at the section breaks, so
the screen has a rhythm and a place for the eye to land.

**Why this priority**: real improvement to the app's least-designed surfaces, and still low-risk —
group headers describe sections, not legal states. Lower than US1 only because these screens have
content competing for attention, so the design has more to get right.

**Independent Test**: scroll Settings, the FAQ and a message detail end to end in both themes and both
font scales.

**Acceptance Scenarios**:

1. **Given** a settings or FAQ group header, **When** it is shown, **Then** its glyph is at the
   design's feature tier and matches the section it labels.
2. **Given** any single screen, **When** it is shown, **Then** it displays **at most one** hero-tier
   glyph — the budget the design sets, so nothing becomes wallpaper.

---

### User Story 3 - Moments with no data on screen (Priority: P3)

Welcome, the lock screen, and the "message sent" confirmation carry the app's character where there is
nothing else to say.

**Why this priority**: the best place for confidence and the least often seen. Deliberately last: it is
the closest this feature comes to the send flow, and a send confirmation is a factual claim about
something legally consequential — the glyph may celebrate what the text already states and nothing more.

**Independent Test**: launch onto Welcome, lock and unlock the app, and send a message on a czebox box.

**Acceptance Scenarios**:

1. **Given** the app has no boxes, **When** Welcome is shown, **Then** it carries the design's hero
   treatment.
2. **Given** a message has just been sent, **When** the confirmation is shown, **Then** any glyph
   states only what the copy states — that the message was submitted — and never implies delivery,
   acceptance, or that anybody has read it.

---

### Edge Cases

- **A hero glyph beside real mail.** If the design places one anywhere near a message row, a delivery
  state or a deadline, it must correspond to something the text already says. If it cannot, the glyph
  does not ship there — however good it looks.
- **Screen readers.** A large decorative glyph that gets announced turns a visual flourish into noise
  for the people least able to skip it.
- **1.5× font scale and small screens.** A hero glyph plus scaled text is the most likely thing in this
  feature to overflow.
- **Dark mode.** Big shapes make contrast errors big too; a tint that reads as a subtle watermark on
  paper can read as a smear on near-black.
- **A glyph that arrives late** (e.g. after data loads) and pushes content down — forbidden outright.
- **Repetition.** The same hero glyph on several screens in a row stops being emphasis and becomes
  wallpaper, which is the failure mode of "sprinkle some icons".

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST have a **named icon scale** with a stated purpose per tier, defined once and
  reused — not per-screen sizes chosen by eye. (Principle V: metrics come from the scale.)
- **FR-002**: Every oversized glyph MUST come from the scale, and from the icon family the app already
  uses. No new icon family, illustrations, or mascot art.
- **FR-003**: A glyph MUST NOT be the only carrier of any information. Anything it communicates MUST
  also be in text.
- **FR-004**: A glyph placed near a message, a delivery state or a deadline MUST correspond to a fact
  the adjacent text already states. It MUST NOT introduce, imply or intensify a claim about legal
  status. (Principle VI.)
- **FR-005**: Purely decorative glyphs MUST be hidden from assistive technology.
- **FR-006**: No glyph may appear, resize or move asynchronously in a way that shifts surrounding
  content. Space is reserved up front. (Principle V.)
- **FR-007**: All new visuals MUST work in light and dark themes, and MUST meet WCAG AA wherever they
  carry meaning. A purely decorative tint MAY fall below AA only if nothing depends on seeing it.
- **FR-008**: The layout MUST hold at 1.0× and 1.5× system font scale with no clipping, overlap or
  horizontal scrolling.
- **FR-009**: Any motion MUST honour Reduce Motion, with a still version that loses nothing.
- **FR-010**: A stated **budget** MUST limit how many hero-tier glyphs can be visible at once (the
  design proposes the number; at most one per screen is the working assumption).
- **FR-011**: Any new copy MUST be Czech-first, cs + en.
- **FR-012**: The implementation MUST match the design file, which is the source of truth — code is
  corrected to the design, never the reverse.

### Key Entities

- **Icon tier**: a named size band with a purpose, a default treatment (colour/tint/knockout) and a
  rule for when it applies.
- **Expressive moment**: a specific screen or state that has been chosen to carry a tier above inline —
  with a recorded reason, and, just as importantly, a record of the moments deliberately left tame.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Someone who used the app before and after can name, unprompted, at least one screen that
  now feels designed rather than assembled.
- **SC-002**: **100%** of oversized glyphs come from the named scale; **zero** one-off sizes.
- **SC-003**: **Zero** glyphs communicate anything not also present in text — verified by reading every
  changed screen with the glyphs mentally removed and confirming nothing is lost.
- **SC-004**: **Zero** decorative glyphs are announced by a screen reader.
- **SC-005**: **Zero** layout shifts attributable to a glyph, measured rather than eyeballed (dump the
  same screen at first paint and after settle; bounds identical), at 1.0× and 1.5×.
- **SC-006**: No screen exceeds the hero budget.
- **SC-007**: Every changed screen passes in **both** themes at **both** font scales.

## Assumptions

- **The design decides where and how big.** This spec deliberately does not choose the moments; it
  bounds them. `design-prompts.md` asks Claude Design for the scale, the placements, the rule for when
  not to use one, and the rationale — including which moments were left alone.
- **Scope is presentation only.** No new data, no new ISDS call, no new permission, no behaviour change.
- **The Lucide set stays.** "Huge icons" means the existing glyphs used at a much larger size, possibly
  tinted or knocked out — not a new visual vocabulary.
- **The 44px attention numeral is the precedent**, not an exception to be removed. If the design's new
  scale supersedes it, that is a deliberate replacement and gets said out loud.
- **Priority order is by risk, not by appetite.** Empty states first because nothing can be misread
  there; anything adjacent to legal state is last and most constrained.

## Non-goals

- A new icon family, custom illustration, or a mascot.
- Changing the palette, typography or component metrics.
- Animated or "delightful" motion for its own sake.
- Oversized glyphs on message rows in a list — a scanning surface, where character costs legibility.
- Anything that makes a screen say more than it knows.
