# Feature Specification: SMS one-time code, without typing it

**Feature Branch**: `021-sms-one-time`
**Created**: 2026-08-19
**Status**: Implemented 2026-08-19 and walked on the emulator (SMS User Consent), with the same-day amendment that opens the code screen when the code is requested. 10/11 tasks done. Open: T010, a real ISDS SMS during re-authentication, which only the user can run.
**Input**: *"for the sms otp i want to implement functionality that the code would be automatically
read from sms on the device"* — user request, 2026-08-19.

## Why

Every OTP box in this app signs in with an eight-digit code that Česká pošta sends by SMS. Today the
user leaves the app, opens Messages, reads eight digits, comes back, and types them — under a clock,
because the code expires. The field already carries the passive hints (`textContentType="oneTimeCode"`
on iOS, `autoComplete="sms-otp"` on Android), and on Android those are a suggestion the keyboard *may*
offer. This feature makes it something the app actually does.

## The message, and what it rules out

ISDS sends exactly this, and we do not control a character of it:

> `Dobry den. Autentizacni kod pro pristup k ISDS je 35124603. Ceska posta, s.p.`

That one fact decides the design, and it eliminates the approach most guides recommend first:

- **Android SMS Retriever API is impossible here.** It requires an 11-character hash of the app's
  signing key to be appended to the message body, and the message is composed by Česká pošta. No
  amount of app-side work can add it. Any advice recommending it — including the generic "how do I
  autofill an OTP in React Native" answer — does not apply to ISDS.
- **Reading the SMS inbox is not on the table.** `READ_SMS` would give this app every message on the
  phone, forever, to save one paste. Principle III, and Google Play would be right to ask why.
- **SMS User Consent API** is what remains, and it is the right shape anyway: the system shows a
  one-tap prompt naming the sender, the app receives **only that one message**, only if the user
  agrees, and only within five minutes of asking. No permission is declared, and nothing is read that
  the user did not just approve.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — The code fills itself in (Priority: P1)

**Given** I am on the code screen and an ISDS SMS arrives, **When** the system asks whether this app
may read that one message and I agree, **Then** the code appears in the field.

**Acceptance Scenarios**:
1. **Given** the code screen is open, **When** the SMS arrives, **Then** a system consent prompt
   appears; agreeing fills the field with the eight digits and nothing else.
2. **Given** I decline the prompt, **Then** nothing happens — the field stays as it was and I can type.
3. **Given** Google Play services are absent (a de-Googled phone), **Then** the screen behaves exactly
   as it does today. No error, no explanation of a feature that cannot run there.
4. **Given** I leave the code screen, **Then** the app stops listening. It never listens anywhere else.
5. **Given** the message is not an ISDS code (a bank, a friend), **Then** no code is offered — the app
   would rather do nothing than paste someone else's digits into a login field.

### Edge Cases
- Two numbers in the message (`ISDS` is not one, but a future wording might carry a reference number)
  — a message that does not clearly state ONE code yields nothing, as with the deadline scanner.
- The user types the code manually while the listener is running — their typing wins; a code that
  arrives afterwards does not overwrite what they entered.
- The consent dialog is answered after the user has already submitted — the screen has moved on and
  the result is dropped.
- iOS: this feature is Android-only. iOS already offers the code above the keyboard from
  `textContentType="oneTimeCode"`, which is the platform's own equivalent and needs no code.

## Amendment, 2026-08-19 — the screen has to be up before the SMS is

The first iPhone test failed, and the user diagnosed it from the outside: *"when i hit to send me sms
otp, it stays and is blocked on the screen, and only after i receive the sms text … i am forwarded to
the text input, but i receive the text right away"*.

That is the whole bug. The app blocked on the credentials form while ISDS was asked for a code, and
the SMS arrived during that wait — so the code screen appeared **after** the message. Both platforms
lose in that order, for different reasons:

- **iOS** offers a one-time code in the QuickType bar above a **focused** `oneTimeCode` field. During
  the wait there is no such field on screen at all.
- **Android** is worse: this feature's own SMS User Consent watch starts when the code screen mounts,
  so a message that lands before that is never offered — no prompt, no code, no explanation. FR-003
  said "listening starts when the code screen appears", and that requirement was the defect.

So the code screen now opens the moment an OTP sign-in is submitted, with the request still in
flight. **FR-003 is amended**: listening starts when the code screen appears, and the code screen
appears when the user asks for a code — not when ISDS gets round to answering.

Two things follow, and both are Principle VI in miniature:

- **FR-008** *(new)*: while the request is in flight the screen MUST NOT say a code was sent. It says
  it is asking for one, and only reports the SMS once ISDS has confirmed it.
- **FR-009** *(new)*: submitting is refused while there is nowhere to send the code, and says why
  (019's rule) rather than silently doing nothing.

## Requirements *(mandatory)*

- **FR-001**: The app MUST NOT declare any SMS permission. Not `READ_SMS`, not `RECEIVE_SMS`.
- **FR-002**: The app MUST only ever receive a message the user has just consented to, one at a time.
- **FR-003**: Listening MUST start when the code screen appears and stop when it disappears — the app
  is never listening for SMS in the background or on any other screen.
- **FR-004**: Extraction MUST be deterministic and testable in isolation from the OS: given the message
  text, either exactly one code or nothing.
- **FR-005**: The extracted code MUST be placed in the field, NOT submitted automatically. A misread
  code that submits itself spends one of a small number of attempts and can lock the box; a misread
  code sitting in a field is something the user can see and correct.
- **FR-006**: Where the API is unavailable — no Play services, an OS that refuses, an error of any
  kind — the screen MUST behave exactly as it does now.
- **FR-007**: The message text MUST NOT be logged, stored, or leave the device. Only the digits reach
  JavaScript state, and only for as long as the screen is open.

## Success Criteria *(mandatory)*

- **SC-001**: On a device receiving the real ISDS message, the code reaches the field without the user
  leaving the app.
- **SC-002**: The built APK declares no SMS permission (checked the way 010 T027 checked notifee's).
- **SC-003**: With the module absent or failing, the code screen is unchanged.

## Non-goals

- iOS work: the platform already does this with a prop the field has carried since 001.
- Auto-submit (FR-005).
- Reading historical messages, or any message the user did not consent to.
