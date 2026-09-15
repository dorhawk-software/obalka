# Tasks: SMS one-time code, without typing it (021)

**Scope**: Android only. iOS already offers the code from `textContentType="oneTimeCode"`, which the
field has carried since 001.

- [x] T001 `src/services/sms/otpFromSms.ts` — the extraction rule, pure and OS-free: prefer a number
  the sentence points at (`je`, `kod`, `code`, …), reject digits inside a longer number, and return
  **nothing** when two candidates are equally plausible. Same discipline as `deadlineScan.ts`, for a
  sharper reason: a wrong code spends one of a small number of attempts and can lock the box.
- [x] T002 `android/…/sms/SmsUserConsentModule.kt` + package + registration in `MainApplication`.
  Starts a five-minute watch, hands the SYSTEM's consent intent to the user, and emits one message —
  once — if they agree. Unregisters on stop, on decline, on background, and on destroy.
- [x] T003 `com.google.android.gms:play-services-auth-api-phone` in `android/app/build.gradle`.
- [x] T004 `src/services/sms/smsUserConsent.ts` — the guarded JS face. Resolves the native module per
  call (never captured at import), and hands the caller **digits only**; the message text does not
  leave the module.
- [x] T005 Wire it into `OtpForm` — the one screen where the code is entered, shared by add-box and
  re-auth. Starts on mount, stops on unmount; a code that arrives never overwrites what the user has
  already typed; nothing is auto-submitted (FR-005).
- [x] T006 Tests: the real ISDS message as a fixture, the ambiguous cases, and the wrapper's two
  guarantees (no native module → silent no-op; only digits reach the caller).
- [x] T007 Device walk. **Done 2026-08-19** on the emulator with `adb emu sms send`, carrying the real
  ISDS wording. The consent prompt appears naming the app and showing the message; **Allow** delivers
  it and the code reaches JavaScript (`40982360`, then `33334444`); **Deny** does nothing at all.
  Driven through a temporary harness in `AppShell`, since reaching the code screen for real needs ISDS
  credentials and a live SMS; the harness is removed.
  **The walk found one defect that no test would have.** SMS User Consent grants access to ONE
  message, so after any result — allowed or declined — the watch is over. A second message was never
  offered: a declined prompt could not be retried, and a code from *"Poslat kód znovu"* (a button
  sitting right there on the screen) would never appear. The module now re-arms after every result and
  on resume, and stops only when JS says so. Confirmed: decline → nothing; next SMS → prompted again.
- [x] T008 Permission delta: the release APK declares **no** SMS permission of any kind (SC-002), and
  the list is byte-identical to the one before this feature.
- [x] T009 Update `specs/README.md`. **Done 2026-08-19** — the row was added with the feature.
- [x] T011 Open the code screen when the code is REQUESTED, not when ISDS answers (user report from an
  iPhone, 2026-08-19 — see the amendment in `spec.md`). **Walked on the emulator:** submitting an SMS
  sign-in shows the code screen instantly with *"Žádáme o jednorázový kód…"* rather than claiming the
  SMS was sent; `dumpsys input_method` confirms the keyboard is up, so the field is focused and, on
  iOS, the code suggestion has somewhere to appear. The risk this change carried — being stranded on
  the code screen when the credentials are wrong — was checked with a deliberately bad sign-in: the
  flow leaves for *"Nesprávné přihlašovací jméno nebo heslo."* as it always did.
- [ ] T010 The real end-to-end: an actual ISDS SMS on the code screen during a re-authentication. Only
  the user can run this — it needs their credentials and a real code.
