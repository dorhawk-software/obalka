# Specification Quality Checklist: Expressive iconography

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

**This is a design-led feature, and the spec is shaped accordingly.** It does not say which screens get
a big glyph or how big — that is what Claude Design is being asked for. What it does is fix the rules
the answer has to satisfy, so that when the design comes back the port is a port. Writing the
placements here first would have been inventing the design in prose and then arguing with it later.

Two items were tightened during validation:

1. **SC-001 was unmeasurable.** It first read "the app feels less tame", which is a mood, not a
   criterion. It now asks whether someone can *name a screen* that changed for the better — still
   subjective, which is honest for a visual feature, but at least answerable and falsifiable.

2. **The ordering was appetite-driven.** The first draft led with the loudest opportunities. It now
   orders the stories by **risk**: empty states first (nothing on screen can be misread), long-text
   anchors second, and anything within sight of legal state last and most constrained. That is also
   why FR-004 exists as its own requirement instead of a line in the edge cases.

**Zero [NEEDS CLARIFICATION] markers.** The obvious candidate — "which screens?" — is not a question
for the user, it is the deliverable being commissioned from the designer. Asking it here would stall
the feature on a question the process is already designed to answer.

Worth flagging to the reviewer: **FR-004 and the Non-goals will veto good-looking design work.** If the
design comes back with a hero glyph on a message row or beside a delivery state, it does not ship there
even if it is the best thing in the file. That is a deliberate constraint, and the point at which this
feature is most likely to feel unnecessarily strict.
