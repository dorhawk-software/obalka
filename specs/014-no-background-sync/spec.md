# Feature Specification: No background sync — the app makes no ISDS call you did not ask for

**Feature Branches**: `014-no-received-background-fetch`, `014b-remove-background-sync`
**Created**: 2026-08-16
**Status**: **Implemented and shipped 2026-08-14 — this spec is RETROSPECTIVE**
**Input**: User decision across two turns: "lets remove the received messages automatic fetch and add a
section to faq describing why this background job is not implemented", then "oki lets remove it
altogether for now".

> **Amended by 010 (2026-08-17).** FR-002, SC-002, the Key Entities note and the Out of Scope entry on
> reminders describe the app as 014 left it on 2026-08-14. 010's user-set reminders have since
> re-introduced `@notifee/react-native`, the `Notifier` interface (reminders only,
> `src/services/notifications/notifications.ts`), `NotificationPayload`
> (`src/app/notifications/deepLink.ts`), a WorkManager timer that the OS restores at boot
> (`RECEIVE_BOOT_COMPLETED`), a notification-tap handler registered in `index.js`, and
> `POST_NOTIFICATIONS`. None of it calls ISDS or learns about mail. FR-001 and FR-003 stand. FR-002 now
> reads: nothing that can run while the app is closed may make an ISDS call or react to mail arriving.

> **This document was written after the code, not before it.** The project's rule (`specs/README.md`,
> "Going forward") is that new features run the full spec-kit loop so `plan.md`/`tasks.md` are written
> first and stay meaningful. 014 did not: it began as a compliance question inside 013's follow-up work
> and was decided and implemented conversationally over one session. The record existed only in commit
> messages, the FAQ and the constitution until this file. It is written in the spec format so the
> feature is discoverable alongside the others, and labelled retrospective so nobody mistakes it for a
> plan that was followed.

## Problem / Why

**The app was signing in to the user's data box on a timer, and it was not allowed to.**

Feature 003 introduced background sync; 013 split it in two and gated the received half behind a consent
screen. Both rested on an assumption that turned out to be wrong, and which nothing in the repo could
check until the operating rules were actually in hand.

On 2026-08-14 the **Provozní řád ISDS of 26 June 2026** was archived into the repo
(`docs/isds-provozni-rad-2026-06-26.md`). Two of its passages settle this feature:

**§II, "Napojení aplikací třetích stran"** — confirming 013's premise:

> *"Přihlášení do datové schránky majitele a doručování zpráv ve smyslu § 17 odst. 3 Zákona způsobuje
> **výhradně** stažení seznamu došlých zpráv – GetListOfReceivedMessages."*

Fetching the received list **is** legal service. Polling it on a timer serves every message waiting in
the box: deadlines start running, and ISDS retention drops from at least three years to 90 days.

**§17, "Dodržování přiměřenosti"** — which 013 recorded as an unverified claim and this feature
confirmed:

> *"Aplikace instalované na lokální stanici (jednotlivý počítač) se **musí** do datové schránky
> přihlašovat pomocí **manuálního příkazu uživatele** (např. stisknutím tlačítka pro výběr a odesílání
> zpráv). Serverové aplikace … se mohou do datové schránky přihlašovat automatizovaně…"*

This is the load-bearing one, and it is **about signing in, not about delivery**. A phone app is an
application installed on a local station, not a server application. Every ISDS call authenticates.
Therefore the rule reaches the *sent* side too — the side 013 had reasoned was safe because it is
legally inert. Legally inert and rule-compliant are different properties; the sent-side poll was the
first and rule-breaking without ever delivering anything.

The operator's own monitoring names both halves of what the app was doing. §17 lists five watched load
categories, two of which are **"Stahování seznamů zpráv"** and **"Stahování dodejek či doručenek"**.

### What actually forced the decision

Not the risk. Enforcement is graduated and explicitly non-punitive: a system message first, then a
3-second delay per request past a daily threshold, then rejection of concurrent requests, with
*"Cílem omezujícího režimu není zablokování práce, ale zpomalení na 'normální' úroveň."* Client-portal
access is never affected. The app is unreleased; only the author's own boxes were ever exposed.

What forced it was **Constitution VI (Honest Scope)**. The FAQ entry shipped in the first half of this
feature quotes §17 as the reason the app does not check for incoming mail. Continuing to poll the outbox
on a timer would have made the app's own help text a half-truth. A compliance gap the user cannot see is
smaller than a false statement they can read.

## Clarifications

### Session 2026-08-14

- Q: Does the sent-side poll break the same rule? → A: **Yes.** §17 governs signing in; the §17(3)
  narrowing governs delivery. "Legally inert" does not make an automated sign-in permissible.
- Q: Remove the received side only, or both? → A: **Both**, in two steps. The received side first
  (with the FAQ entry), then the sent side once the contradiction with our own FAQ was clear.
- Q: Keep background sync as an informed opt-out, as the received side already worked? → A: **No.**
  It was never the user's to consent to — consent does not make a locally-installed application into a
  server application.
- Q: Keep the notification stack parked for future use? → A: **No.** Nothing could fire a notification
  once the sync was gone; unused native modules would keep declaring permissions the app cannot use.
  Local reminders a user sets themselves (spec 010) remain permissible and would re-introduce a
  notification library when actually built — a device timer makes no ISDS call.

## User Scenarios & Testing

### User Story 1 — My mail is served only when I ask (Priority: P1)

A user opens the app, reads their inbox, and closes it. Between that moment and the next time they open
it, the app performs no ISDS call whatsoever. No message is served, no deadline starts, and nothing
about their legal position changes while the app sits on the home screen.

**Why this priority**: This is the whole feature. It is also the only user story with legal consequences
— every other line here is a consequence of it.

**Independent Test**: Fully testable by asserting that no code path reachable without a user action
calls `GetListOfReceivedMessages`. `__tests__/messages/messageListDelivery.test.tsx` does this at the
component level; the absence of a scheduler does it structurally.

**Acceptance Scenarios**:

1. **Given** the app is closed, **When** any amount of time passes, **Then** no ISDS request is made
   and no message changes state.
2. **Given** the app is open on the inbox, **When** the user taps the box switcher, **Then** no new
   sync is triggered (the pre-014 bug: it fired a delivering call on every switcher open and every
   screen focus).
3. **Given** the user pulls to refresh, **When** the sync completes, **Then** the received list is
   fetched — because that is a manual command, which is exactly what the rule permits.

---

### User Story 2 — The app tells me why it cannot notify me (Priority: P1)

A user looks for "notify me when post arrives", does not find it, and can discover in one step why it is
absent — including that it is a rule rather than a missing feature, and what the sanctioned alternative
is.

**Why this priority**: Equal-first with US1 under Constitution VI. An absence with no explanation reads
as a defect or an oversight, and this one will be looked for: every competing product has it.

**Independent Test**: Open Časté dotazy → *"Proč mi aplikace sama nedá vědět, co je nového?"*. It is
static content, testable offline.

**Acceptance Scenarios**:

1. ~~**Given** the settings screen, **When** the user reads the sync section, **Then** it states that new
   messages are not fetched in the background and points to the FAQ.~~ *(Not how 014 ended; see
   FR-005.)*
2. **Given** the FAQ entry, **When** the user reads it, **Then** it explains both halves — incoming mail
   (fetching it *is* delivery) and sent-message outcomes (still an automatic sign-in) — and names the
   state's own e-mail / SMS / Mobilní klíč notifications as the way to learn about new post.

---

### User Story 3 — No control that does nothing (Priority: P2)

A user finds no switch, screen, or permission prompt for a capability the app does not have.

**Why this priority**: Lower than the two above because it is invisible when done right, but it is what
keeps the app honest at the level of the OS: an app that requests notification permission it can never
use is making a claim with the permission dialog.

**Independent Test**: `aapt2 dump permissions` on the built APK; inspect Nastavení for orphaned rows.

**Acceptance Scenarios**:

1. **Given** the built APK, **When** its permissions are dumped, **Then** `POST_NOTIFICATIONS`,
   `RECEIVE_BOOT_COMPLETED` are absent. (`WAKE_LOCK` is not in scope — see the correction below.)
2. **Given** an install upgraded from a version that had notification channels, **When** the user opens
   the OS notification settings, **Then** no orphaned Obálka channel is listed.
3. **Given** the settings screen, **When** the user looks for a notifications row or a cadence picker,
   **Then** neither exists.

### Edge Cases

- **An install carrying `syncReceived: '1'` or `syncSent: '1'` from a previous version.** The rows stay
  in `app_settings` and are simply never read again. Nothing can act on them, so a stale "on" is inert.
  Deleting them was considered and rejected: a migration that drops user data can go wrong, and there is
  no gain.
- **A box whose session expires while nothing is polling.** Re-auth detection moved onto the sent pass
  in the first half of this feature, then disappeared with it. The box now surfaces its re-auth state
  when the user next opens the app — the same moment they would have acted on a notification anyway.
- **A message purged by ISDS between two manual syncs.** Handled by the adjacent fix in `ef338ff`: the
  list renders the local archive, not the server response, so a message older than 90 days stays
  visible instead of vanishing.

## Requirements

### Functional Requirements

- **FR-001**: The app MUST NOT call any ISDS web service except as the direct result of a user action
  (opening the app, opening a box or folder, pull-to-refresh, or an explicit send/download).
- **FR-002**: The app MUST NOT schedule, register, or retain any mechanism capable of running while it
  is closed — no background fetch, no headless task, no boot receiver.
- **FR-003**: The app MUST NOT offer any setting that enables background synchronisation, including one
  defaulted to off. The capability is not the user's to grant.
- **FR-004**: The app MUST NOT declare an OS permission it cannot exercise.
- ~~**FR-005**: The settings surface MUST state the absence of background fetching in place of the removed
  controls.~~ *Not how 014 ended:* 014b removed the sync section outright (T015), so Settings carries no
  such line. The absence is explained only by the FAQ entry `noBackgroundFetch`, reached from Nastavení
  → Časté dotazy.
- **FR-006**: The FAQ MUST carry the full reason, covering incoming mail *and* sent-message outcomes,
  with both rules quoted and traceable to the Provozní řád (per 012's FR-018).
- **FR-007**: The app MUST NOT advertise, prime for, or request notification permission for
  notifications it cannot send.
- **FR-008**: Settings rows belonging to removed features MUST become unread rather than being deleted
  from the database.
- **FR-009**: A user-initiated sync MUST still surface everything a background sync would have found —
  delivery receipts, fikce, undeliverable outcomes and re-auth — at the moment the user opens the app.

### Key Entities

None added. This feature is subtractive: it removes `SyncCadence`, `NotifChannels`/`ChannelSwitches`,
`BackgroundSyncDeps`, `Notifier` and `NotificationPayload` from the model.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Zero code paths reach `GetListOfReceivedMessages` without a user action. *(Met — verified
  by test and by the absence of any scheduler.)*
- **SC-002**: The built APK declares none of `POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED`.
  *(Met — **actually** verified 2026-08-17; see the correction below.)* ~~`WAKE_LOCK`~~ was wrongly
  included in this criterion: it comes from `react-native-blob-util` (attachment downloads), was
  present before 014 and remains present. It was never background-sync's to remove. *(Both permissions
  returned with 010's reminders on 2026-08-17; see the amendment above.)*
- **SC-003**: Every claim in the shipped FAQ entry is traceable to a quoted primary source. *(Met — §17
  and §17(3), both from the archived Provozní řád.)*
- **SC-004**: The distributed-component count falls, rather than carrying unused dependencies. *(Met —
  174 → 172 after removing `@notifee/react-native` and `react-native-background-fetch`.)*
- **SC-005**: The full gate stays green with no capability silently lost. *(Met — tsc 0, eslint 0
  errors, 344 tests.)*

## Assumptions

- A phone application is "an application installed on a local station" in the sense of §17, and not a
  "server application". The Provozní řád does not define either term; the reading is that a server
  application is one where ISDS talks to a server brokering requests for client stations, which is
  precisely the architecture Constitution III forbids this app from having.
- Opening the app counts as a manual user command. The rule's own example is pressing a button to fetch
  and send; launching the app is at least as deliberate. Background fetch with the app terminated is
  clearly not, which is the distinction that matters.
- The state's own notification channels (e-mail, SMS, Mobilní klíč — Provozní řád §7) are an adequate
  substitute for new-mail alerts. They are also the only sanctioned one.
- Local reminders a user sets themselves remain permissible and are out of scope here (spec 010).

## Out of Scope

- **Reminders (010).** A device-local timer makes no ISDS call and is unaffected by §17. Building it
  would re-introduce a notification library.
- **The `RegisterForNotifications` / `GetListForNotifications` WS pair**, which would give a reduced
  delivered-list without triggering delivery — it requires certificate-based access (Spisová služba /
  Přístupové rozhraní), not username+password. Recorded in `docs/isds-ws-news/README.md` as out of
  scope for the access type we have.
- **The gov.cz endpoint migration**, tracked separately.

## Correction (2026-08-17): the permission check in this feature never ran

The claim that the rebuilt APK declared none of `POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED` or
`WAKE_LOCK` was reported as verified. It was not. The command used was

```sh
~/Android/Sdk/build-tools/*/aapt2 dump permissions …   # 2>/dev/null, with a `|| echo` fallback
```

Three build-tools versions are installed, so the glob expanded to three paths: the shell ran the first
with the other two as arguments, aapt2 exited **255**, `2>/dev/null` swallowed the error, and the
`|| echo "(none of …)"` fallback printed a reassuring line that was then written up as a measurement.

Re-run properly with a single resolved path, the true state of `main` is:

| Permission | Status |
|---|---|
| `POST_NOTIFICATIONS` | **absent** — correct, removed with notifee |
| `RECEIVE_BOOT_COMPLETED` | **absent** — correct, removed with background-fetch |
| `WAKE_LOCK` | **PRESENT**, from `react-native-blob-util`; unrelated to background sync and never removed by it |

So the feature's substantive claim holds and its third of a sentence did not. The app's own
`AndroidManifest.xml` declares only `INTERNET` and `VIBRATE`; everything else arrives by manifest
merge.

The lesson is not about permissions. **A verification whose failure mode is silence is not a
verification** — `2>/dev/null` plus an `||` fallback turns a broken command into a passing check.
010's T001 records the full baseline and the explicit-path form of the command.
