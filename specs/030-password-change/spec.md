# Feature Specification: The box's password - told in time, changed in the app

**Feature Branch**: `030-password-change`
**Created**: 2026-11-11
**Status**: Built 2026-11-11 (see `tasks.md`); not yet walked on a device.
**Input**: Owner, 2026-11-11, after a test box stopped signing in: *"confirmed, it is expired password,
can obalka detect this situation, please?"*, *"and could obalka itself support the password update? that
would be great"*, and then: *"improve the copy, add the possibility to update password in the app (a
person must supply the original password again in this process), and the nudge notification that their
password expires soon and they need to change it (if they want to keep access)"*.

## What ISDS does - captured, not assumed

Captured on the test environment on 2026-11-11 with the box `7bi62r`:

- **An expired password is refused exactly like a wrong one.** `GetPasswordInfo` with the expired
  password returned HTTP 401, `WWW-Authenticate: Basic realm="ISDS - DS"` and Apache's stock
  "Authentication required!" page - the same answer the 001 research recorded for a wrong password. No
  status code, no date, no hint. Nothing the app receives can tell the two apart.
- **The date comes from ISDS.** After the password was changed on the portal, the same call answered
  HTTP 200 with `<p:pswExpDate>2027-02-09T09:49:12.000+01:00</p:pswExpDate>` and `dbStatusCode 0000`:
  ninety days on, to the second. `readPasswordExpiry` reads it; the response is a test fixture now.
- **`ChangeISDSPassword` needs the current password to work.** It is an ordinary db_access call at
  `/DS/DsManage`, authenticated with HTTP Basic like every other call of a password box, carrying
  `dbOldPassword` and `dbNewPassword`. A password that has expired fails the Basic sign-in before the
  call is read, so the app can change a password only while it still works. Once it has expired, the
  portal is the only way: it still accepts the old password a few times, to make the person change it.
  The Alis KEO4 manual says the same of its own change button ("Nové heslo je nutné nastavit ještě před
  vypršením platnosti stávajícího hesla").
- **The rules for a new password** (datovka.gov.cz help 1.1, decree 194/2009 Sb.): 8 to 64 characters; at
  least one capital letter, one small letter and one digit; only letters a-z and A-Z, digits and the
  special characters space `! # $ % & ( ) * + , - . : = ? @ [ ] _ { | } ~`; not containing the login
  name; no character three or more times in a row; not starting with `12345`, `qwert` or `asdfg`;
  different from every password used before. The app checks all but the last, which only ISDS knows;
  ISDS has the final word and its own message is shown when it refuses.

## User Scenarios & Testing

### User Story 1 - A refusal says what it may mean (Priority: P1)

1. **Given** a password box ISDS refuses and the app has no expiry date for it (a box being added, or
   one whose date never arrived), **When** the error is shown, **Then** it says the name or the password
   is wrong *or the password has expired*, that an expired one is changed on the ISDS portal, and that
   repeated attempts can get the access blocked - with a link to that environment's portal.
2. **Given** a password box refused before its stored date (the password was most likely changed
   elsewhere), the re-auth screen and the inbox strip say the password was refused - changed elsewhere or
   expired - and the re-auth screen links to the portal too.
3. A refusal after the stored date keeps 001 FR-009's "expired, change it on the portal" wording.

### User Story 2 - Change the password in the app (Priority: P1)

1. **Given** a password box whose password still works, **When** the person opens "Změnit heslo" - from
   the expiry strip, from the box's menu in the switcher, or from the expiry notification - **Then** a
   screen asks for the current password, the new one and the new one again.
2. The new password's rules are listed under its field and each is ticked as it is met. "Změnit heslo"
   stays blocked, and says why, until every rule is met, the two new fields match and the new one differs
   from the current one.
3. On "Změnit heslo" the app sends `ChangeISDSPassword` with the current password the person typed - not
   the stored one - so changing it proves the person knows it.
4. **Success**: the app stores the new password for the box, reads the new expiry date from ISDS with it,
   and says "Heslo je změněné" with the date it now runs to and that it is the password for the portal
   and every other app too. The expiry strip and the notifications move to the new date.
5. **The current password is wrong**: the screen says so and that repeated attempts can block the access;
   the fields stay filled.
6. **ISDS refuses the new password** (a password used before, or a rule the app does not know): ISDS's
   own message is shown; nothing is stored.
7. **No connection / timeout / server fault**: the usual sentences; nothing is stored. A timeout cannot
   say whether ISDS changed it, so it says to try signing in with the new password if the old one stops
   working.
8. Offered only for boxes that sign in with name and password. SMS-code and Mobile Key boxes keep the
   portal link: an SMS box would need a code of its own for the change, a Mobile Key box has no password
   in the app.

### User Story 3 - Told before it runs out (Priority: P1)

1. **Given** a box with a stored expiry date (not a Mobile Key box, which signs in without the
   password), the phone shows a notification 7 days before the date and
   1 day before it, at 09:00 the person's time: "Heslo ke schránce brzy vyprší" with the box's name and
   the date, and that it has to be changed to keep access. Android puts them on a channel of their own
   ("Platnost hesla"), so they can be switched off apart from the reminders.
2. Tapping it opens the change screen for a password box, and the box's inbox (with its strip and portal
   link) for any other.
3. A new date (a sign-in, a re-auth, a change in the app) moves both notifications; a removed box's are
   cancelled; a moment already past is skipped; a box with no date has none.
4. The app asks for notification permission once, the first time it schedules one, after a sign-in the
   person started - never at launch.
5. Nothing here talks to ISDS: the date is the one stored at the person's own last sign-in, and the OS
   holds the timer (014, 010 FR-010 as amended below).

## Requirements

- **FR-001** The copy of US1, in Czech and English, through the existing keys and `reauthCopy.ts`.
- **FR-002** `changePassword` in the ISDS transport: `ChangeISDSPassword` at `/DS/DsManage`, HTTP Basic
  with the typed current password, `useJar: false`. Outcomes: changed (with the new expiry from
  `GetPasswordInfo` under the new password, null when that lookup fails), wrong current password (401),
  refused (non-`0000`, with ISDS's message), server fault; network and timeout throw as elsewhere.
- **FR-003** `passwordRules(password, loginName)` - pure, each rule a key and a verdict, and
  `isAcceptablePassword`.
- **FR-004** `ChangePasswordForm` and a `changePassword` route in the shell beside `reauth`; on success
  the account's secret and date are saved (`reauthAccount`), its failure flag cleared, the inbox
  refreshed.
- **FR-005** Entry points: the expiry strip's action and the switcher menu's "Změnit heslo" for a password
  box; the notification's tap.
- **FR-006** `syncPasswordNudges` - the boxes and their dates in, the notifications scheduled, moved or
  cancelled; called whenever the shell reads the accounts.
- **FR-007** 010 FR-010 amended: the notifier may schedule a second kind of local notification, tied to a
  date ISDS reported at a sign-in the person started. It still takes no account, no transport and no
  sync result, and nothing in it can reach the network.

## Out of scope

- Changing an SMS-code box's password (`ChangePasswordOTP`, its own code round-trip).
- Changing an already expired password: ISDS does not allow it outside the portal.
- Telling an expired password from a wrong one without a stored date: ISDS gives nothing to go on.
