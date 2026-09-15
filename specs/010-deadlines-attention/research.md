# Phase 0 Research: Deadlines & Attention (cycle 1)

Cycle 1 = US1 (attention group) + US2 (user reminders). The spec carries no `NEEDS CLARIFICATION` for
this cycle — Q1–Q3 were resolved in the 2026-08-16 clarification round and Q4–Q6 belong to cycle 2.
What remained genuinely unknown was **how to schedule a local notification without giving the app back
capabilities 014 deliberately removed**, which is the subject of D1–D3 below.

---

## D1 — Notification library: re-add `@notifee/react-native`

**Decision**: re-add it, at the version 014 removed (`^9.1.8`).

**Rationale**: it is the library the app used until two days ago, so the integration is known rather
than guessed, and `notifee.createTriggerNotification` with a `TimestampTrigger` is exactly the shape a
reminder needs — the OS holds the timer, not the app. Its removal in 014 was not because it was the
wrong library; it was because nothing was left that could legitimately fire a notification.

**Alternatives considered**:
- *`react-native-push-notification`* — effectively unmaintained; no reason to trade a known-good
  integration for it.
- *`expo-notifications`* — needs the Expo module system, which the project evaluated and rejected
  outright (see the standing decision on not adopting Expo).
- *No library, in-app chips only* — was on the table in the clarification round and rejected: a
  reminder that only appears when you open the app is not a reminder.

---

## D2 — Schedule with WorkManager, NOT AlarmManager (no exact-alarm permission)

**Decision**: create trigger notifications **without** the `alarmManager` option.

**Rationale**: Notifee offers two Android backends.

| | Backend | Precision | Permission |
|---|---|---|---|
| default | WorkManager | approximate — batched with device conditions | none |
| `alarmManager: true` | AlarmManager | exact to the timestamp | **`SCHEDULE_EXACT_ALARM`** on Android 12+ |

A deadline reminder does not need second precision: "your termín is tomorrow", delivered at 09:00 or
09:20, is the same reminder. Exact alarms would buy nothing and cost a permission that Google restricts
to alarm-clock and calendar apps, which this is not — and an app that asks for a restricted permission
it does not need is exactly the pattern 014 spent a day removing.

**Alternatives considered**: `alarmManager: { allowWhileIdle: true }` for Doze reliability. Rejected
for the same reason; a reminder arriving late from Doze is acceptable, a restricted permission is not.

---

## D3 — Which permissions actually come back, and the FR-010 conflict

**Finding**: the spec's FR-010 as written forbids `RECEIVE_BOOT_COMPLETED` outright. That is very
likely unachievable, and for a benign reason: **androidx.work declares it in its own manifest**, so it
merges into the APK whether or not the app asks. WorkManager needs it to restore its queue after a
reboot — which is also what makes a reminder survive a restart.

**Decision**: keep the *intent* of FR-010 and fix its wording. The rule that matters is that the app
regains **no background ISDS capability** — no scheduler that can reach the network, no headless task,
no sync. A permission arriving through a library's manifest merge, in service of a device-local timer,
does not breach that. Any permission that does appear must be traceable to the reminder mechanism and
recorded.

**Verification is empirical, not assumed**: after the dependency is added, run

```sh
aapt2 dump permissions android/app/build/outputs/apk/debug/app-debug.apk
```

and diff against the current set. This is the same check that proved the 014 removal, and it is a task
in cycle 1 rather than an afterthought. If `POST_NOTIFICATIONS` returns, that is expected and
correct — the app will send notifications again. If anything network- or sync-shaped appears, stop.

### T001 — permission baseline (captured 2026-08-17, `main` build)

```
INTERNET, VIBRATE, USE_BIOMETRIC, USE_FINGERPRINT, WAKE_LOCK,
ACCESS_NETWORK_STATE, ACCESS_WIFI_STATE, WRITE_EXTERNAL_STORAGE,
READ_EXTERNAL_STORAGE, DOWNLOAD_WITHOUT_NOTIFICATION, SYSTEM_ALERT_WINDOW,
com.obalkadatovaschranka.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION
```

Our own `AndroidManifest.xml` declares only **INTERNET** and **VIBRATE**; everything else arrives
through a library's manifest merge. `WAKE_LOCK`, `WRITE/READ_EXTERNAL_STORAGE` and
`DOWNLOAD_WITHOUT_NOTIFICATION` come from `react-native-blob-util` (attachment downloads).

**Absent, and expected to stay absent until T014**: `POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED`,
`SCHEDULE_EXACT_ALARM`.

> **Use an explicit aapt2 path.** `~/Android/Sdk/build-tools/*/aapt2` globs to three installed
> versions, so the shell runs the first with the rest as arguments; it exits 255 and prints nothing
> useful. That is not hypothetical — it is how 014 came to report a permission check that never ran
> (see the correction in `specs/014-no-background-sync/plan.md`). Resolve one path:
>
> ```sh
> AAPT=$(ls -d ~/Android/Sdk/build-tools/*/ | tail -1)aapt2
> "$AAPT" dump permissions android/app/build/outputs/apk/debug/app-debug.apk
> ```

### T027 result (2026-08-17) — six permissions arrived, four were removed

Re-adding notifee added **six**, not the one D3 anticipated:

| Permission | Source | Kept? |
|---|---|---|
| `POST_NOTIFICATIONS` | notifee | **yes** — the app sends notifications again |
| `RECEIVE_BOOT_COMPLETED` | `androidx.work:work-runtime` (notifee merges the same) | **yes** — exactly as D3 predicted, and it is what lets a reminder survive a reboot |
| `SCHEDULE_EXACT_ALARM` | `app.notifee:core` | **removed** |
| `FOREGROUND_SERVICE` | `app.notifee:core` | **removed** |
| `ACCESS_NOTIFICATION_POLICY` | `app.notifee:core` | **removed** |
| `BROADCAST_CLOSE_SYSTEM_DIALOGS` | `app.notifee:core` | **removed** |

Notifee's AAR declares every permission any of its code paths might need, regardless of which the app
uses. We use exactly one — a WorkManager-backed timestamp trigger — so the other four are stripped
with `tools:node="remove"` in `android/app/src/main/AndroidManifest.xml`.

`SCHEDULE_EXACT_ALARM` is the one that mattered: Google restricts it to alarm-clock and calendar apps
and requires a Play policy declaration. Shipping it would have had an app for reading government mail
claiming to be an alarm clock — the permission-list equivalent of the false lock-screen promise 013
shipped. Removing it is safe *because* D2 chose WorkManager, and a test asserts `alarmManager` is
never passed, so the code path behind that permission is unreachable.

**This also corrects D3's framing.** D3 argued a permission arriving via manifest merge is acceptable
if it serves a device-local timer. True for `RECEIVE_BOOT_COMPLETED` — and not a licence to accept
whatever a library declares. The rule is: keep what the app's own code paths need, remove the rest,
and record which is which.

Final delta from the T001 baseline: **+2, −0.**

### T031 result (2026-08-17) — reboot survival: **YES**, measured

The open risk below is now closed. Two reminder triggers were scheduled (`JOB #u0a219/6` and `/7`),
the emulator was rebooted with `adb reboot`, and the app was **not** opened afterwards. Both jobs were
present again in `dumpsys jobscheduler` after boot completed.

Worth stating plainly, because it is the one thing here that runs unbidden: the app's **process was
started by the system at boot** (it had a live pid before anything touched it). That is WorkManager's
boot receiver restoring its queue — which is exactly what `RECEIVE_BOOT_COMPLETED` is for, and why
T027 kept that permission rather than stripping it with the other four.

It does **not** breach 014. Nothing in that path reaches the network: it re-registers local timers and
stops. The FAQ's claim — *"Na pozadí nekontroluje nic: ani nové zprávy, ani osud těch, které jste
odeslali"* — remains literally true, since nothing is checked and no sign-in occurs. What the FAQ did
lack was any mention that the app now sends notifications at all; a user who has just been told
"Zítra máte termín" would have found "the app never tells you anything by itself" hard to square with
it. A fourth paragraph was added to that entry naming the exception and saying what it is: an alarm
clock on the phone, which asks the data box nothing and knows nothing about new mail.

**The re-arm-on-launch fallback is therefore not needed** and was not built. The deterministic IDs
(D5/C2) still make it a safe addition if a future device disagrees.

One case the reboot test does not cover, found while testing: **reinstalling the app clears the
scheduled jobs** (the reminder rows survive in SQLite, but their timers do not). That is normal for a
sideloaded debug build and would affect users only across an app update. It is the exact case the
re-arm-on-launch fallback would fix, and it is cheap — noted here rather than acted on, because the
correct trigger for building it is evidence that store updates drop the jobs too.

**Open risk, carried deliberately** *(now closed — see T031 above)*: whether a WorkManager-backed trigger survives a reboot is not
stated in Notifee's own documentation and was not resolvable from it. The plan therefore does **not**
promise reboot survival. It is a device test in `quickstart.md`, and if the answer is no, the fallback
is re-arming reminders from the local table on app launch — which loses only the case where the phone
reboots *and* the app is never opened before the reminder date.

---

## D4 — Reminder time of day: 09:00 **device-local**

**Decision**: fire at 09:00 in the device's own timezone, not Europe/Prague.

**Rationale**: this is the opposite of the fikce deadline and the contrast is deliberate. A fikce date
is a *Czech legal fact* and is computed in Czech civil time (`fikce.ts`). A reminder is *the user's own
note to themselves* — a user in Berlin who sets a reminder for the 22nd means their 22nd. Using Prague
time for a personal reminder would be a category error dressed up as consistency.

**Alternatives considered**: letting the user pick a time. Rejected for cycle 1 — the clarification
round chose date-only storage, and a time field is the kind of thing that is easy to add later and
impossible to remove.

---

## D5 — Deterministic notification IDs, so storage stays date-only

**Decision**: derive both notification IDs from the reminder's identity —
`rem:{boxId}:{messageId}:d1` (day before) and `rem:{boxId}:{messageId}:d0` (on the day) — rather than
storing the IDs Notifee returns. *(Suffixes corrected 2026-09-14 to match contract C2 and the code.)*

**Rationale**: the clarification round settled on storing only the date. Deterministic IDs honour that:
cancelling on removal, on message deletion, or on box removal needs no stored handle, and a
reschedule is just "cancel both, create both". It also makes the scheduler idempotent, which matters
because re-arming on launch (D3's fallback) would otherwise duplicate notifications.

**Alternatives considered**: storing `notificationId` on the reminder row, as the original spec's Key
Entities suggested. Rejected — it adds a column that can drift out of sync with the OS.

---

## D6 — Storage: a new `reminders` table, not a column on `messages`

**Decision**: a new table keyed `(boxId, messageId)`, added via the existing migration runner.

**Rationale**: reminders must survive what messages do not. ISDS erases message content after 90 days
(state 9) and the archive keeps its own copy; a reminder is the user's data and outlives both. A
separate table also means `clearBox` can drop reminders explicitly rather than by cascade, and it keeps
`messages` — which is rewritten wholesale by every list sync — free of user-owned state.

**Alternatives considered**: a `reminderDate` column on `messages`. Rejected: `cacheList` upserts that
table on every sync and a stray column there is one careless `INSERT OR REPLACE` away from silent data
loss.

---

## Cycle 2 (US3) — D7: getting text out of a PDF, on device

**The problem.** The project has **no PDF text-extraction capability**. `react-native-html-to-pdf`
writes PDFs; nothing reads them. ISDS attachments are overwhelmingly PDFs, so without this the
feature scans almost nothing. This is cycle 2's only real technical risk — the date rules are pure
functions and carry none.

**Constraints that rule options out before performance is even discussed:**

- **Principle III** — the text must never leave the device, so any cloud extraction API is out
  regardless of quality.
- **Principle I** — extraction must not block the UI thread. React Native's JS is single-threaded, so
  a synchronous parse of a large document freezes the app.
- **Principle II** — a malformed or encrypted PDF must yield "no dates", never a crash. ISDS
  attachments include documents produced by every authority in the country.

**Options.**

| Option | Verdict |
|---|---|
| `pdfjs-dist` (Mozilla), text layer only via `getTextContent()` | **Chosen, then replaced by unpdf's build of pdf.js** (see "Superseded" below). Pure JS, no native code, no new platform build. Rendering needs a canvas; **text extraction does not** — which is the whole reason it fits here. |
| A native module (Android PDFBox / iOS PDFKit) | Better performance and robustness, but two native implementations to write and maintain for a feature that is opt-in and secondary. Revisit if the JS route proves too slow on real documents. |
| OCR (ML Kit / Tesseract) | Ruled out by Q6. Large dependency, battery cost, and the least reliable input feeding a *legal deadline*. |
| Ship nothing; scan plain text only | Honest but nearly useless: almost no ISDS attachment is plain text. |

**Version pin — and the correction that overturned it.**

The first decision here was "pin to a 3.x `legacy` build", because `pdf.js` 4+ calls
`Promise.withResolvers`, which **Hermes does not implement** — a runtime failure, not a build one, in
an opt-in feature few people would report.

**That was wrong, and `npm audit` caught it on install.** Every 3.x release is inside the range of
**GHSA-wgrm-67xf-hhpq — arbitrary JavaScript execution from a malicious PDF** (pdfjs-dist ≤ 4.7.76).
The input here is attachments sent by anyone who knows the user's box ID, which is a *published*
identifier: as untrusted as input gets, arriving inside an app that holds legal mail. Pinning to a
known-vulnerable parser to avoid a six-line polyfill is the wrong trade by a wide margin.

**Decision: `pdfjs-dist@^6.2.108` (zero advisories) plus a `Promise.withResolvers` polyfill**, applied
before the parser is imported. Confirmed on install: no `canvas` dependency is pulled in, so there is
still no native code. Proven end-to-end against a hand-built one-page PDF in Node — the extractor
returned exactly `Uhradte do 8. 7. 2026.`, which the scanner then reads.

**Superseded 2026-08-19 (T044):** `pdfjs-dist` did not load under Hermes in either of its builds. The
parser is unpdf's DOM-less build of pdf.js (`unpdf/dist/pdfjs.mjs`, loaded lazily by `require` in
`src/services/scan/pdfText.ts`). `src/services/scan/hermesShims.ts` shims `Promise.withResolvers`,
`TextDecoder`/`TextEncoder`, `structuredClone` and `ReadableStream`. `isEvalSupported: false` /
`disableFontFace: true` still apply.

**Defence in depth regardless of version**: `isEvalSupported: false` and `disableFontFace: true` turn
off the eval-based font path that the advisory class exploits. A parser fed hostile government mail
should not be one CVE away from executing it.

**Not blocking the thread.** Extraction runs after a user-initiated download, not during render, and
must yield between pages. If a document is large enough that yielding is not enough, the honest
answer is to stop and suggest nothing — a scan is a convenience, and no convenience justifies an
unresponsive app holding someone's legal mail.

**Verification note.** The scanner's *rules* are unit-testable without any of this, and are built
first for exactly that reason: the feature's correctness — which date, and whether to suggest at all —
does not depend on how the text arrived.
