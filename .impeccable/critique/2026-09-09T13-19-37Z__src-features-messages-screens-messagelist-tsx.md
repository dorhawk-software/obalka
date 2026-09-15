---
target_identity: "file:src/features/messages/screens/MessageList.tsx"
target_fingerprint: "sha256:63b33b5d2128342489b45feee7c229d04e5a2006e201f1d77b95ee67b90c2021"
target_path: src/features/messages/screens/MessageList.tsx
timestamp: 2026-09-09T13-19-37Z
slug: src-features-messages-screens-messagelist-tsx
---

> **Historical — resolved since.** A 2026-09-09 critique of the inbox. Its priority issues have been
> fixed, and the code cites this critique where it does: the fiction countdown tones are drawn
> (`fictionCountdownTone` in `messageState.ts`), the attention block is capped (`MAX_UNREAD_SHOWN` in
> `attention.ts`), the list states its freshness (`freshnessLabel`), the inbox links the FAQ where it uses
> its vocabulary, re-auth with nothing cached has its own empty state, and drafts stay reachable while
> loading or in error. Read it as a record, not as a list of open defects.
# Critique — the inbox (MessageList)

Method: dual-agent — Assessment A (design review) and Assessment B (evidence) ran as two isolated
parallel sub-agents; neither saw the other's output before synthesis.

## Design Health Score — 26/40 (Acceptable)

| # | Heuristic | Score | Key issue |
|---|-----------|:--:|---|
| 1 | Visibility of system status | 3 | `syncedAt` is computed, returned and dropped; the screen never says how fresh the list is, in an app with no background sync |
| 2 | Match system / real world | 3 | "fikce" is unexplained at the point of use; the FAQ that explains it is unreachable from here |
| 3 | User control and freedom | 2 | Nothing can be done to an attention item but open it, one at a time, online; drafts are unreachable in `loading` and `error` |
| 4 | Consistency and standards | 3 | Internally strong; gold carries six meanings on this one screen |
| 5 | Error prevention | 3 | Excellent degradation everywhere; the one legally irreversible act (pull-to-refresh serves the user's mail) has no friction and no mention |
| 6 | Recognition rather than recall | 2 | One numeral counts four incommensurable feeds; five sent-side delivery glyphs have no on-screen legend |
| 7 | Flexibility and efficiency | 2 | No filter, unread-only, sort, swipe action or multi-select; the constitution's promised density mode does not exist |
| 8 | Aesthetic and minimalist design | 3 | Coherent paper system; worst case stacks header + tile + segment + sync bar + a gold strip + stale strip + drafts before row one |
| 9 | Error recovery | 3 | Best-reasoned area in the file; `reauth` with no cache still renders a full-viewport void |
| 10 | Help and documentation | 2 | `src/content/faq.ts` is excellent and deep-linkable, and nothing on the inbox links to it |
| **Total** | | **26/40** | **Acceptable — significant work needed** |

Scored against the state *after* the three defects the critique found in the audit's own work were
fixed (commit d88e1c2): the ~32dp recovery targets, the strips' broken reading order at large text
sizes, and the self-clipping ellipsis.

## Design Specificity Verdict — split, and the split is the finding

**Authored for this product at the level of vocabulary and refusals; category-generic at the level
of composition.** The state modules are extraordinarily product-specific — `messageState.ts` refuses
to classify an unknown ISDS status because that would be "claiming a legally significant outcome
from a value we do not recognise"; `fikce.ts` computes Europe/Prague by hand rather than trusting
ICU data to ship in a given Hermes build, because "a legal deadline should not depend on which JS
engine variant shipped"; `deadlineScan.ts` declines to suggest anything when a document states two
cue-anchored dates. None of that could be lifted into another mail app.

The screen that renders them is a well-executed generic mail inbox: header, segmented folders, date
sections, avatar + sender + date + subject rows, compose FAB. **The specificity lives one layer below
where the user can see it.**

**Deterministic scan: inapplicable, not clean.** `impeccable detect --json` returned `[]` (exit 0) on
the target and on the whole directory. A control experiment settles what that means: the same
defects — 9px text, 1.2:1 contrast, a 12×12 target — produce **4 findings** in an `.html` probe and
**0** in a `.tsx` one. The engine reads HTML/CSS. No config or inline suppression is involved. The
`[]` carries zero information about this file.

**Visual overlays: not applicable.** The browser injection flow does not apply to a React Native
target. Evidence came instead from live device captures on a Pixel API 36 emulator, verified current
by pixel-diffing a fresh capture against the set (only the status-bar clock differed) and by grepping
the running Metro bundle for identifiers that exist only in the commit under review.

## Priority issues

**[P1] Gold means six things on this screen.** DESIGN.md's own One Job Rule says gold means unread
"and almost nothing else". Here it is: the unread dot, the compose FAB, the attention numeral, the
fiction pill, the reauth strip, the password-expiry strip, and the Testovací pill. The two
*actionable* items — "your sign-in expired" and "your password expires" — are the same tone as the
two *informational* ones. Worse, `chipTone.ts` reserves red for urgency, so the most severe
received-side status is drawn in the second-least-severe tone by construction. → `/impeccable colorize`

**[P1] `fikceRed` and `fikceAmber` are declared and never drawn.** The design system specifies an
escalation at ≤3 and ≤7 days; zero uses exist outside `chipTone.ts`. The only live countdown renders
`statusFiction` gold at every distance, so "fikce za 9 dní" and "fikce dnes" are the same colour.
Either wire them up or delete the claim. → `/impeccable colorize`

**[P1] "Vyžaduje pozornost" is an unread list wearing an urgency name, and it is uncapped.** FR-001
admits every unread message and nothing caps the section, so on a first sync or after a fortnight
away the block *is* the inbox and the date sections below are empty. `attention.ts` states the exact
principle this violates — "An attention section that is usually empty teaches people to skip the one
that is not" — and the inverse is what ships. The sub-line is a static legend, not a reason. → `/impeccable distill`

**[P2] The screen never says how fresh it is.** `syncedAt` is computed and returned by
`messagesStore.ts:186` and ignored; four comments still describe the "Aktualizováno…" line that
consumed it. In an app that syncs only on user action, freshness is the user's responsibility and
the app declines to state it. → `/impeccable harden`

**[P2] The vocabulary is unexplained where it is used.** `src/content/faq.ts` is excellent, legally
sourced, and deep-linkable — `FaqScreen` already accepts a `focus` param. Only Settings and Backup
pass one. A user who sees "lhůta už běží" cannot find out what lhůta. → `/impeccable clarify`

**[P2] Two states fall through.** `reauth` with no cached messages renders header + strip + a
full-viewport void (`sections` empty and `ListEmptyComponent` explicitly `null`). And drafts are
only the `SectionList`'s header component, so in `loading` and `error` a user holding unsent drafts
loses their only route to them — exactly when the network is failing. → `/impeccable harden`

**[P3] Nothing can be done to an attention item offline.** `markRead` only flips local state when
ISDS confirms, so reading eight messages on the metro leaves the count at eight. → `/impeccable harden`

## Fixed during this critique

- Both recovery actions were ~32dp targets; the previous commit's message claimed otherwise.
- The recovery strips destroyed their own reading order at 1.8× — the date split either side of the
  action button.
- Truncating text clipped its own ellipsis and collided with its neighbour.
- DESIGN.md's type-floor claim was false by a factor of thirty-eight.

## Open, not fixed

The `fontScale` guard only scans for vertical cropping, so it could not have caught any of the
horizontal defects above. A guard for "truncating text with no floor against a fixed-width sibling"
is the missing half.
