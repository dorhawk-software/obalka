# Specification Quality Checklist: Addressee address

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-17
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

Two items were fixed during validation rather than being waved through:

1. **Field names leaked into the requirements.** An earlier draft wrote FR-003 as "display
   `dbAddress` verbatim" and FR-007/008 in terms of `dmSenderAddress` / `dmRecipientAddress`. Those
   are wire-format details and belong in the plan, not the spec. The requirements now state the
   behaviour ("exactly as ISDS composed it", "the sender's address when one is stored"); the field
   names survive only in the Assumptions section, where naming the source is the point.

2. **"No address" was under-specified.** The first draft said only that a missing address must not
   break the screen. That leaves "show *Adresa neuvedena*" as a legal reading — which would state
   something about the addressee that the app does not know. FR-004 now forbids a placeholder
   outright, and the Edge Cases section says why. *(Superseded 2026-08-17: after the design came back
   FR-004 was amended — the app may state that ISDS returned no address, "Adresa neuvedena", visually
   subordinate, and still never claims anything about the person.)*

**Zero [NEEDS CLARIFICATION] markers**, deliberately. The three candidates all resolved to a
defensible default recorded in Assumptions instead: list rows are out of scope (the user asked for
the detail), searching *by* address is a separate feature, and IČO/OVM identifiers do not help the
reported case (two private individuals have neither). None of them changes the shape of the work, so
none is worth blocking on.

One judgement call worth flagging to the reviewer rather than hiding in the prose: **FR-005** (the
picked recipient keeps showing its address on the compose screen) was not literally requested. It is
included because the reported failure is picking the wrong person, and the confirmation step is the
last place that is still recoverable. If that is unwanted it can be dropped without touching anything
else.
