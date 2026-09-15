# Feature Specification: A blocked button says why

**Feature Branch**: `019-blocked-button-feedback`
**Created**: 2026-08-17
**Status**: Implemented and walked on a device 2026-08-17.
**Input**: User, after failing to sign back in: *"i did not even notice the heslo input, i completely
skimmed over it — the button should (or all buttons to be precise) provide feedback that they are
disabled, which would force the user to look elsewhere"*

## Why

On the re-auth screen the primary action is disabled until a password is typed. The user selected
"SMS kód", pressed **Přihlásit se**, and nothing happened — no movement, no sound, no message. The
password field was directly above and had been skimmed over.

The app knew exactly what was missing and said nothing. `PressScale` passes `disabled` straight to
the `Pressable`, so the touch is swallowed before any handler runs: the app cannot even tell that
someone tried. A silent refusal is indistinguishable from a broken button, and the person most likely
to hit it is the one who has already missed the field it depends on.

**Not every disabled button is refusing.** Half the disabled states in this app mean *busy* — a send
in flight, a download running, the lock unlocking. Those already answer with a spinner, and shaking
at someone for pressing again would be nonsense. The distinction is the feature:

| State | Means | A press should |
|---|---|---|
| **blocked** | a requirement is unmet | say so, and point at what is missing |
| **busy** | the action is already running | stay quiet — the spinner is the answer |

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Pressing a blocked button tells me what is missing (Priority: P1)

Someone presses a primary action whose requirement is unmet. The button reacts — a refusal they can
feel and see — and the thing that is missing takes focus.

**Acceptance Scenarios**:

1. **Given** a form whose requirement is unmet, **When** the primary action is pressed, **Then** it
   gives a refusal (a short movement and a warning haptic) rather than absorbing the press.
2. **Given** that press, **Then** the control that is missing input takes focus, so attention lands
   where the answer is.
3. **Given** Reduce Motion is on, **Then** there is no movement, and the refusal is still felt and
   still moves focus.
4. **Given** a screen reader, **Then** the button announces that it is unavailable **and why**.

---

### User Story 2 - A busy button stays quiet (Priority: P2)

Someone presses a button whose action is already running. Nothing happens — no shake, no buzz.

**Acceptance Scenarios**:

1. **Given** an in-flight action, **When** its button is pressed, **Then** there is no refusal
   feedback and no duplicate submission.

---

### Edge Cases

- A button that is **both** blocked and busy → busy wins; the user is not scolded for a race.
- Rapid repeated presses → no haptic storm.
- The blocking control is **off-screen** → focusing it must bring it into view.
- Reduce Motion, and devices with no haptic engine (the haptics wrapper already no-ops).

## Requirements *(mandatory)*

- **FR-001**: A primary action blocked by an unmet requirement MUST respond to a press.
- **FR-002**: That response MUST include a non-visual channel (haptic) and a visual one (movement),
  so it lands whether or not the user is looking at the button.
- **FR-003**: It MUST move focus to the control that is blocking, bringing it on-screen if needed.
- **FR-004**: A button disabled because its action is **in flight** MUST NOT give refusal feedback.
- **FR-005**: Assistive technology MUST hear both that the control is unavailable and the reason.
- **FR-006**: MUST honour Reduce Motion; the refusal survives without the movement.
- **FR-007**: MUST NOT shift layout (Principle V) — the feedback occupies no new space.
- **FR-008**: Reasons MUST be cs + en, Czech first.
- **FR-009**: A blocked press MUST NEVER submit.

## Success Criteria *(mandatory)*

- **SC-001**: Pressing a blocked primary action produces an observable response in **100%** of cases;
  today it is 0%.
- **SC-002**: **Zero** refusal feedback fires for a busy button.
- **SC-003**: Zero layout shift attributable to the feedback.
- **SC-004**: The reported case — re-auth with an empty password — moves focus to the password field.

## Assumptions

- **The reason is a short phrase, not a paragraph**, and lives on the field, not in a new banner.
- **Focus is the payload.** A shake alone says "no" but not "where"; focusing the input opens the
  keyboard and points at the answer, which is what the user actually asked for.
- **Restrained by default.** This is a government mail client; the refusal is a nudge, not a bounce.

## Non-goals

- Removing disabled states, or a global form-validation framework.
- Changing when buttons are disabled.
