# Phase 1 Quickstart: device acceptance for cycle 1

Run against the **Android emulator with a czebox box** (Principle VII). Nothing here needs a production
mailbox. Two of these checks cannot be done by the unit tests and are the reason this file exists.

## Setup

1. Add a czebox box (`Pokročilé → Testovací`; a test credential fails with a misleading OTP hint if the
   form is left on production).
2. Ensure the inbox holds at least one **unread** message (`state` 6) and one **read** one (state 7).

## US1 — the attention group

| # | Step | Expect |
|---|---|---|
| 1.1 | Open the inbox | "Vyžaduje pozornost" shows the unread messages (up to 3), every reminder-bearing message and every fiction-served message |
| 1.2 | Open an unread message, go back | It has left the group (now state 7) |
| 1.3 | Read every message | **No group header at all** — not an empty section (FR-002) |
| 1.4 | Set a reminder on an already-read message | It appears in the group with its blue chip |
| 1.5 | Two dated messages, different dates | Soonest first; undated unread below them |

## US2 — reminders

| # | Step | Expect |
|---|---|---|
| 2.1 | Message detail → "Termín" → "Za týden" | Blue chip with the date; the row joins the group |
| 2.2 | Reopen the picker | The current date is shown as selected, not blank |
| 2.3 | Change it to a custom date | Chip updates; **one** reminder, not two (one per message) |
| 2.4 | Remove it | Chip gone, row leaves the group |
| 2.5 | Kill the app, reopen | The reminder is still there (SQLite, not memory) |

## The checks the unit tests cannot make

### 3.1 — Permissions: exactly what came back, and nothing else

```sh
AAPT=$(ls -d ~/Android/Sdk/build-tools/*/ | tail -1)aapt2
"$AAPT" dump permissions android/app/build/outputs/apk/debug/app-debug.apk
```

Resolve ONE aapt2 path, as above: the bare `~/Android/Sdk/build-tools/*/aapt2` glob matches every
installed version, exits 255 and prints nothing useful (research D3).

**Expect +2 against the T001 baseline**: `POST_NOTIFICATIONS` (the app sends notifications again) and
`RECEIVE_BOOT_COMPLETED` (from `androidx.work`). `SCHEDULE_EXACT_ALARM`, `FOREGROUND_SERVICE`,
`ACCESS_NOTIFICATION_POLICY` and `BROADCAST_CLOSE_SYSTEM_DIALOGS` must be **absent**: notifee's AAR
declares them and `android/app/src/main/AndroidManifest.xml` removes them with `tools:node="remove"`,
so if one appears, that block was lost (research T027).

**Stop and escalate** if anything network- or sync-shaped appears.

*Amended 2026-09-14:* this step first expected only `POST_NOTIFICATIONS`, allowed
`RECEIVE_BOOT_COMPLETED` as a maybe, and read `SCHEDULE_EXACT_ALARM` as proof of an `alarmManager`
trigger. T027 measured otherwise: the library declares it whatever the code does.

### 3.2 — The notification actually fires

Do not wait a day, and do not move the clock: WorkManager jobs run on elapsed realtime, so a wall-clock
jump does not fire them. Set a reminder, find its two jobs with `adb shell dumpsys jobscheduler`, and
fire each with `adb shell cmd jobscheduler run -f <package> <jobId>` (tasks T030). Then check:

- the **day-before** notification reads "zítra", the **on-day** one reads "dnes";
- tapping either opens that message;
- with notification permission **denied**, the chip and group membership still work (FR-006) — this is
  the one that regressions will hit first, because it is the path nobody demos.

### 3.3 — Reboot survival (answered 2026-08-17: survives)

Research could not settle this from Notifee's documentation, so it was measured, not assumed.

1. Set a reminder and note its two jobs in `adb shell dumpsys jobscheduler`. *(This first said "a few
   minutes out", which cannot be set: both timers fire at 09:00, research D4.)*
2. `adb reboot`, wait for boot, **do not open the app**.
3. Check `adb shell dumpsys jobscheduler`.

**Expected**: both jobs reappear in `dumpsys jobscheduler` after boot without opening the app.
**Known gap**: reinstalling the app clears the jobs while the rows survive (research T031). The
re-arm-on-launch fallback this step once prescribed for a "no" was not needed and was not built.

### 3.4 — No layout jump

At 1.0× and 1.5× font scale, adding and removing a chip must not move the rows around it (Principle V).
013 shipped this defect twice; measure with `uiautomator dump` and compare bounds, do not eyeball it.

## US3 — the on-device scan (cycle 2)

Needs a received message with a **PDF attachment whose text states one deadline** ("…do 8. 7. 2026…").
A czebox box can be sent one from the portal; failing that, send one to a test box from another box.

### 4.1 — Off means off

With **Nastavení → Termíny v přílohách** OFF, open the message and press *Stáhnout přílohy*. No card
appears, and no scan indicator flashes on the way. Confirm in the Metro/adb log that pdf.js was never
loaded — this is the check that the toggle is real and not merely hiding a scan that ran anyway.

### 4.2 — On, and the suggestion appears

Turn the toggle on, download again. The card appears under the *Termín* row showing the date, the
phrase it was read from and the file name, and it says the estimate was made on this phone.

### 4.3 — Accept

Press *Uložit termín*. The *Termín* row fills in, the card goes, and the inbox row joins **Vyžaduje
pozornost** with the blue chip — an accepted estimate is an ordinary reminder (US3 scenario 2), so its
two notifications are scheduled like any other.

### 4.4 — Dismiss is permanent

On a second message, press *Skrýt*. The card goes. Download again → it does not come back. Force-stop
the app, reopen, download again → still gone. (A dismissal survives a relaunch because it is stored,
not held in state.)

### 4.5 — The app stays usable while it reads

With a large PDF (10+ pages), the screen must stay responsive during the scan: scroll it while the
indicator is up. The parser yields between pages and stops at a page cap precisely so this holds
(Principle I).
