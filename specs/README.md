# Specs — status & process note

This directory holds the per-feature specifications. The project is meant to follow the
[GitHub Spec Kit](https://github.com/github/spec-kit) loop
(`specify → clarify → plan → tasks → analyze → implement`), with each feature getting its own
`spec.md`, `plan.md`, `tasks.md`, `research.md`, `data-model.md`, `quickstart.md`, and `contracts/`.

**Commit hashes cited in these specs come from the development history before the repository was
published.** The public history begins with a single commit, so a hash quoted in a `tasks.md` records
where a change was made at the time — it is not a commit you can check out here.

**001, 005, 006, 008–012 and 015–018 ran the loop. 002–004 and 007 did not; 013 and 014 got retrospective
paperwork; 019–026 were built from a spec with partial paperwork (020, 021, 025 and 026 have a `tasks.md`, none has a
`plan.md`).** Those four were captured as
`spec.md` (the "what & why") and then built directly. This file records that honestly so the spec tree
isn't misread as incomplete work — the *code* for the v1 features is implemented and live-validated;
what is missing for those four is the intermediate spec-kit *paperwork* (plan/tasks/etc.), which would
be written-after-the-fact fiction and so was intentionally not back-filled. 013 and 014 DID get
back-filled paperwork, clearly labelled retrospective, because both shipped behaviour the commit log
alone could not explain.

> **Keep this table honest.** It was once wrong for weeks about 005 and 011 — both listed "not built"
> while shipping. Statuses below are counted from each feature's own `tasks.md`, or from its `spec.md` Status
> line where there is no `tasks.md` (re-audited 2026-09-15).

## Per-feature status

The last column says how much of the spec-kit loop a feature ran: ✅ spec → plan → tasks → implement (with
research or a design round where needed); ⚠️ partial or retrospective paperwork; ❌ spec only, then built.

| # | Feature | Artifacts present | Build status | Ran full spec-kit loop? |
|---|---------|-------------------|--------------|--------------------------|
| 001 | Accounts & secure login | spec, **plan, tasks, research, data-model, quickstart, contracts/** | Implemented (**44/49**; 3 superseded, 2 open). **Closed 2026-09-14/15:** T028, the vault key — box passwords and sessions are sealed under a key that sits behind the app lock's biometric gate when the lock is on (the lock stays opt-in, constitution 3.0.0), walked on the Android emulator 2026-09-15; T037, removing the last box resets the lock; T038/T041, a refused password past its stored expiry date is shown as "change it on the portal" (inferred from the date, not from an ISDS code — see FR-009). Box removal was hardened the same days: an unfinished removal resumes, and nothing in flight writes a removed box back. Open: T046, the quickstart walked end to end against czebox by a person with the test credentials; T049 (2026-09-24), before a react-native-keychain upgrade that drops its deprecated AES-CBC storage, no item may still be recorded under it. T005/T027/T035 are superseded | ✅ Yes (the reference) |
| 002 | Messages, attachments & sync resilience | spec, data-model | Implemented. Since 2026-09-14 a received message is downloaded signed (`SignedMessageDownload`), so its original is kept (004 amendment), with the unsigned download as a fallback | ⚠️ Partial (spec + data-model, then direct build) |
| 003 | Reliable sync engine & notifications | spec | Implemented, then **removed by 014** (background sync and its notifications) | ❌ spec-only, then direct build |
| 004 | Local archive & search | spec | Implemented. **Amended 2026-09-14:** the archive keeps each message's signed original (`.zfo`) beside its attachments, carried by backups and phone transfer and saved from the message; not yet exercised against czebox | ❌ spec-only, then direct build |
| 005 | Sending messages | spec, **plan, tasks, research, data-model, quickstart, contracts/** | Implemented (**41/42**). T006 closed 2026-09-14: a pick-time size cap, and a chunked read with progress and cancel. T018 closed 2026-09-13: the sent message opens from the success screen. Only T031 is open: a person at a signed-in test box must run the quickstart, a large (VoDZ) send included; the paid send needs PDZ credit the test box does not have (010 T029) | ✅ Yes |
| 006 | Encrypted cloud backup & cross-device sync | spec, **plan, tasks, research** | **Largely implemented (31/34).** Both tiers (metadata, and documents with signed originals), the file target, automatic backup and retention — which never deletes the only backup still holding a document a restore could not bring back — the recovery-key QR, 025's phone transfer as a second transport, and a golden version-1 backup replayed in tests. Walked on the Android emulator 2026-09-08 and 2026-09-12. **Deferred to future work by the owner (2026-09-14):** the Google Drive and iCloud targets and their permission delta (T015–T017), and so User Story 2 (config sync across devices), which needs one of them | ✅ Yes |
| 007 | Appearance, settings & localization | spec | Implemented; its home layout (drawer, box list) was later replaced by 009 and 011 | ❌ spec-only, then direct build |
| 008 | Sending & navigation UX | spec, **plan, tasks, research, data-model, quickstart, contracts/** | Implemented (27/27) | ✅ Yes |
| 009 | Visual redesign — "paper" theme port | spec, **plan, design-system, design-prompts, design-sync-back, research, data-model, quickstart, contracts/, tasks** | Implemented (48/48) | ✅ Yes |
| 010 | Deadlines & attention (Termíny · fikce · pozornost) | spec, **plan, tasks, research, data-model, quickstart, contracts/** | **Implemented — both cycles, each walked on device** (cycle 1: US1 attention group + US2 reminders, 2026-08-17; cycle 2: US3 on-device attachment scan, 2026-08-19). **44/46** — T029 and T044 partial. Open: two czebox-only steps in T029 (need an unread message) and §4.5, responsiveness on a large document | ✅ Yes — plan and tasks written before any code (plan 2026-08-16) |
| 011 | Inbox-first navigation & box switcher | spec, **plan, tasks, research, data-model, quickstart, contracts/** | Implemented (25/25) | ✅ Yes |
| 012 | About & Help — FAQ and licences | spec, **plan, design-prompts, tasks** | Implemented (42/42) | ✅ Yes (specify → plan → tasks → implement) |
| 013 | Message states & background-sync consent | design-prompts, port-notes, **spec, plan, tasks** | Implemented + walked on device (sync half later removed by 014) | ⚠️ Design-first: hand-off → design → port; spec/plan/tasks written after |
| 014 | No background sync — no ISDS call you did not ask for | spec, plan, tasks | Implemented (Android verified; iOS confirmed by the user 2026-08-16) | ⚠️ **Retrospective**: decided and built conversationally, spec written after |
| 015 | Addressee address (who exactly am I writing to?) | spec, **plan, tasks, design-prompts**, checklists/ | **Implemented + walked on device 2026-08-17** (16/16) | ✅ Yes — specify → design → plan → tasks → implement |
| 016 | Expressive iconography (huge icons, deliberately) | spec, checklists/, **design-prompts, design-system, plan, tasks** | **Implemented 2026-08-17** (13/15). Open: T013, the remaining hero states and the emblem, only partly walked because they are unreachable on the test device. T014 is superseded: 010 decided not to restore the notification primer, so the `feature` tier has no placement | ✅ Yes — specify → design → port |
| 017 | The received delivery record (Doručenka) | **design-prompts, design-system, spec, plan, tasks** | **Implemented + walked on device 2026-08-17** (12/12). T012 closed 2026-09-14: a message state the app does not recognise is kept off the delivery rail | ✅ Yes — design → specify → plan → tasks → implement |
| 018 | Per-box ISDS session isolation | spec, plan, tasks | **Implemented + acceptance passed on two production SMS boxes 2026-08-17** (15/15). Closed 2026-09-14/15: the large-message (VoDZ) send and downloads carry the box's own session (T006, T015), to the portal's `/apps/DS/vodz` for an SMS or Mobile Key box; the shared native jar is emptied whenever a sign-in ends, so removal no longer touches it (T010, amended); sessions are sealed in the Keychain under the vault key (001 T028). **Not yet exercised with a real session:** the portal VoDZ route and `react-native-blob-util`'s patched `omitCookies` | ✅ Yes |
| 019 | A blocked button says why | spec | **Implemented + walked on device 2026-08-17** | ⚠️ Partial — spec, then built (a UX defect reported mid-session) |
| 020 | Show the box's PDZ credit | spec, tasks | **Implemented + walked on device 2026-08-17** | ⚠️ Partial — spec → build (no plan; the data already existed) |
| 021 | SMS one-time code, without typing it | spec, tasks | **Implemented + walked on the emulator 2026-08-19**, plus the 2026-08-19 fix that opens the code screen when the code is REQUESTED rather than when ISDS answers. Android SMS User Consent, no SMS permission; the real end-to-end (an actual ISDS code during re-auth) is the user's to run | ⚠️ Partial — spec → tasks → build, no plan (one screen, one module) |
| 022 | The app does not boast (copy tone audit) | spec | **Implemented 2026-08-19.** Welcome tagline + 3 FAQ strings in both locales; a guard test over every user-facing string | ⚠️ Partial — spec → build (a copy rule, no plan needed) |
| 023 | Debug mode: a log bundle the user hands over themselves | spec | **Implemented 2026-09-10.** Recorder, credential deny-list, zip bundle, Settings screen, FAQ entry, and a structural guard that no network API may appear under `src/services/debug/`. Closed 2026-09-14/15: recording is marked on every screen (FR-007), building a bundle no longer holds the JS thread (Principle I), and the review follow-ups (saved files that could not be read are not shown as empty, no layout jumps, one on-scale status strip). **Walked on the Android emulator 2026-09-15:** the file write worked; the share sheet did not - Android opened the zip instead of sharing it - and was fixed the same day with the app's own ACTION_SEND module, then walked again | ⚠️ Partial - spec, then built (one screen, one service directory) |
| 024 | One inbox, many boxes (cross-box attention) | spec | **Implemented.** The box selector and the attention block read one aggregate, so a badge and a count cannot disagree. Since 2026-09-14 the cross-box line gives the nearest deadline, a still-refreshing state and last-known counts (FR-003, FR-004), and never renders an empty "Jinde:". **Walked on the Android emulator 2026-09-15**, which found the line cut mid-word ("· 2 nen…"); it now shows only the whole clauses that fit, most urgent first, and counts the rest ("· +1"), checked there at normal and 1.3× text. No `tasks.md`: specified from approved mockups and built straight through | ⚠️ Partial — approved mockups → spec → build (no plan, no tasks) |
| 025 | Phone to phone with a code phrase | **spec, research, tasks** | **Built and walked on Android 2026-09-13; iOS built in code 2026-09-24 (21/27).** A [croc](https://github.com/schollz/croc) code phrase or QR moves the sealed archive and its recovery key to another phone; the receiving side is `unpackPortable` → `restoreBackup`. Both directions walked between the emulator and the workstation, Tier 2 documents included. Since 2026-09-14/15, in code and tests: a transfer stops when the app leaves the foreground (T021) and keeps the screen on while it runs; the send shows counts, completion reports documents, and a relayed route names the relay; the receiving phone writes the documents back and adopts the keys; runs are kept apart from backups and box removals. ~~Android only for now (owner decision 2026-09-14).~~ **iOS, 2026-09-24 (owner: before the first release):** the native module, the pinned Go builds that every release now runs for both platforms (T024), croc's relay lookup at load patched out (T025) and the workflows (T026) are in code and tests; not yet built by CI or walked on an iPhone (T022, T026, T027). Still owed: T004 (SC-003, `OnlyLocal` proven between two phones on one Wi-Fi) and T019's two-phone walk. Not met as written: FR-009/SC-002 (amended by T005/T014) | ⚠️ Partial — spec → research/spike → tasks → build (no plan) |
| 026 | Attachments in backups, sending a backup that exists, automatic download | spec, tasks | **Implemented and walked on the Android emulator 2026-09-26 (17/18).** A backup carries no attachments, those on the phone, or all of them (downloading what is missing, only in a backup the person started); each backup says which in the list and the transfer. The phone transfer sends the backup the person picks and only its own documents, instead of the newest backup with every stored object. Automatic download during a refresh the person started, new messages only or every message, Wi-Fi only by default; a download neither delivers nor marks read (Provozní řád ch. 8, WS manual). Open: T018, the czebox walk | ⚠️ Partial — research → approved mockups → spec → tasks → build (no plan) |

"Implemented" reflects each `spec.md`'s own `Status:` line; the v1 features were live-validated on the
emulator and/or czebox + production boxes. **009** re-skinned the implemented features to a new "paper"
design (imported from Claude Design) — built + verified.
**010** built the deadline/attention behaviours that design introduced, and **011** the inbox-first IA +
box-switcher sheet it implied (009 stayed visual-only and deferred the routing change). **012** added the `O aplikaci` FAQ + licence surface and settled the project's own licence (**MIT**) —
the first feature to run the full loop under the "going forward" rule below, and the one that closed a
real compliance gap (two SIL OFL-1.1 typefaces and a vendored SQLCipher were shipping with no notice at
all). It also corrected three factual claims that were already live in the app.

**014** removed background sync entirely, and with it the whole notification surface: the Provozní řád
of 26 June 2026 — archived into `docs/` the same day — requires applications installed on a local
station to sign in only *"pomocí manuálního příkazu uživatele"*, which reaches the sent side too even
though nothing is delivered by it. The app makes no ISDS call the user did not ask for. It also
uncovered a delivering call fired by merely opening the box switcher.

> **Amended by 010 (2026-08-17).** This paragraph used to end "…and runs no code while it is closed".
> That is no longer true and must not be left standing: a deadline reminder is a WorkManager timer, so
> the system starts the app's process at boot to restore the queue and again when a trigger fires.
> **What 014 established is intact** — none of that path touches the network, signs in, or knows
> anything about new mail; it posts a notification the user asked for and stops. But "runs no code
> while closed" was a stronger claim than 014 ever needed to make, and it is now the wrong one.

**010** shipped cycle 1 — the "Vyžaduje pozornost" group and user-set deadline reminders — and, like
012 before it, ran the whole spec-kit loop before any code existed. It re-introduced a
notification library that 014 had removed, which is permissible precisely because a reminder is a
timer on the device; the permission delta was measured rather than assumed (+2, and four permissions
notifee's AAR declares were stripped, `SCHEDULE_EXACT_ALARM` among them). Walking it on the emulator
found three defects in already-shipped code: a false "Doručeno fikcí" claim on messages never served
by fiction, a notification payload nothing consumed, and a crash on every process-death restore that
had nothing to do with reminders at all.

**018** finished work that had looked finished for weeks: `cookieJar.ts` existed, documented the
analysis exactly, and was called by nothing. RN's cookie jar is per DOMAIN while ISDS cookie sessions
are per BOX, so a second OTP box's login overwrote the first's — and the first box's next call could
ride the wrong identity's session. Building it produced four corrections, every one found by using
the app rather than by a test, and the sharpest is worth repeating: the transport's `NoopCookieJar`
**default** meant the app shipped with no jar at all and every box reported "sign-in expired" forever.
A no-op default made a forgotten wire indistinguishable from an absent native module — the same
looks-finished-but-isn't shape the feature existed to remove. It is now a required argument.

**019** came from that session too: the re-auth button was disabled until a password was typed, the
user pressed it with the field empty, and nothing happened at all. A disabled `Pressable` discards
the touch before any handler runs, so the app could not even learn someone had tried. Blocked buttons
now answer — haptic, a short shake, and focus moves to the field that is missing — while BUSY buttons
stay silent, because a spinner is already the answer to a second press.

**017** inverted the usual order deliberately: the prompt went out first and the spec was written
after the design came back. That was the right call — asked for "the timeline the sent side has", the
design declined the framing and returned a *Doručenka*, the Czech legal term for a proof-of-delivery
record, on the grounds that a received message is "a finished journey, not a rail in progress".
Requirements written first would have locked in the worse idea. Two of its answers were better than
the questions: identical timestamps MERGE with a note explaining the coincidence, and "Přečteno"
leaves the rail entirely to become a footnote saying why it has no time.

**015 and 016** both ran with a design commission in the middle of the loop, and both came back with
something the spec had not thought of: for 015, *which half* of an address disambiguates (the town, so
the town takes the weight); for 016, that a hero glyph must never be gold, because gold means delivery
by fiction and decoration must not borrow a tone that carries legal meaning. 016 also declined three of
the six placements it was offered — including the one the prompt's own hard constraint ruled out, which
is the clearest argument for commissioning the work rather than guessing at it.

There is **no separate federated-login feature**, but note that the "no federated login" framing is now
partly wrong: **Mobile Key is available to third-party apps and has been implemented all along** — the
constitution said otherwise until amendment 2.0.0 (2026-08-16). NIA / BankID / mojeID remain
Portal-only and unbuilt; the spike is deferred and unnumbered (Principle VI in the constitution).

## Going forward

**013** came out of a research pass on the ISDS Provozní řád: the app modelled three delivery states
where ISDS has ten, reporting an *undeliverable* message as delivered and leaving an antivirus failure
on "Odesláno" forever, and its single background-sync setting did two incomparable things — one inert,
one that legally serves the user's mail on a timer. It ran design-first (hand-off → Claude Design →
diff → port) rather than through the full loop; `port-notes.md` records the design's decisions and the
six places the port diverged, and its `spec.md`/`plan.md`/`tasks.md` were written retrospectively on
2026-08-16. **Its state model survives; its sync-consent half was removed three weeks later by 014**,
once the Provozní řád showed the capability was never the user's to consent to.

**014** did not run the loop either — it was decided and built conversationally in a single session, and
its spec/plan/tasks were written two days later and are labelled **retrospective** at the top of each
file. That is the second feature in a row to skip the loop, which is worth naming rather than letting it
become the habit: both times the trigger was a compliance finding that arrived mid-session and wanted
acting on immediately.

**010 shipped on 2026-08-17** (cycle 1: the attention group and user-set reminders), followed by
**015** (the addressee's address, which came out of the user hitting a wall sending to one of several
people who share one common name). Both ran the loop properly, and 015 ran it with a design commission in the
middle — specify → prompt Claude Design → plan against what came back → tasks → implement. That middle
step paid for itself: the design worked out
something the spec had not, namely which half of an address does the disambiguating.

The paragraph below is kept as the record of what 010 looked like before it was built. Its diagnosis
was right and its P1 story did have to be replaced.

**010 was the next feature to build, and its spec needed revision before it was planned.** Its P1 story —
an inbox "Vyžaduje pozornost" group with a *fikce* countdown on unopened RECEIVED messages — cannot
work: 013 established that listing the inbox is itself what serves a message (§17/3), so a received row
can never still be counting down, which is why the countdown now lives on SENT messages. 010 was
written 2026-06-30, four weeks before that was known. Its open question Q2 (calendar vs shifted
deadline) was answered on 2026-08-16 — pure calendar days, no working-day shift, argued in `fikce.ts`.
What remains live is **US2, user-set reminders**, which is also the feature that would re-introduce a
notification library — permissible after 014 precisely because a device timer makes no ISDS call.

**010 cycle 2 (2026-08-19) is the strongest argument in this repo for walking a feature on a device.**
The on-device attachment scan passed 575 unit tests and did nothing whatsoever on a phone: Metro could
not bundle pdf.js at all, `await import()` turned into a dev-server fetch that failed, and Hermes has
none of `import.meta`, `TextDecoder`, `structuredClone` or `ReadableStream`. Worst of all, the failure
was SILENT — a parser that cannot load and a document with no text layer are indistinguishable to the
caller, and "no suggestion" is a legitimate outcome, so the feature looked like it worked. `pdfjs-dist`
turned out not to load under Hermes in either of its builds and was replaced by unpdf's DOM-less build;
pdf.js is now credited as a bundled component, since unpdf ships it minified with its Apache-2.0 header
stripped.

**021 (2026-08-19)** exists because the message decides the design. The obvious Android answer — SMS
Retriever, which fills the code with no taps at all — requires an 11-character hash of the app's
signing key inside the SMS body, and the SMS is written by Česká pošta. What is left is SMS User
Consent, which is the better shape anyway: the system asks about ONE named message, the app declares
no SMS permission, and nothing is read that the user did not just approve. Its device walk found the
defect that mattered — consent covers one message, so without re-arming, a declined prompt or a resent
code was never offered again.

**A status audit on 2026-09-08** went through every feature's `tasks.md` against the code, prompted by
001 showing 25 open tasks for a feature the app has been running on since the beginning. Almost all of
it was stale bookkeeping — the work exists under names later features gave it (the app-specific PIN
screen became the OS device passcode; `BoxList` became 011's switcher sheet; re-auth became 018) — and
each entry now carries the evidence rather than a checkbox. Two things came out of it that were not
bookkeeping: **T044**, the missing test that no plaintext secret reaches the database or a log, which
was written the same day; and **T041**, which was a live gap — the app read a box's password-expiry
date from ISDS, stored it, and showed it nowhere, so a password box could quietly stop working on a
date the app already knew. Closed the same day: the inbox now warns a fortnight out and hands off to
the portal, and a re-auth refreshes the date it warns from.

The **a11y and theming passes** (T042/T043) followed, and each found something the other kind of
review would not. Accessibility on the login path was in better shape than expected — every control
already labelled, `PressScale` already announcing its disabled state — but the app had **no**
`accessibilityRole="header"` at all, and the primary buttons capped their own height, which crops a
label at large font scale. Theming was the sharper one: the hardcoded-colour guard from 009 had never
been run by anything, and a contrast measurement of both themes found `theme.ts`'s own promise of
"derived AA dark variants" broken twice — white ink left on a `blue` that had been brightened for the
dark base (**2.65:1** on every primary button in dark mode) and 12px captions at 3.91. Both are fixed
and both are now measured on every run.

What is still open, as of 2026-09-15. No known code gap is left open without a record; what remains
needs a person, hardware, or a decision to build later:

* **Manual acceptance runs that need a person and a real box.** 001 T046 and 005 T031 (the quickstarts
  against czebox, a large attachment included) and 021 T010 (an actual ISDS SMS on the code screen during a
  re-authentication).
* **Built, but not yet exercised against ISDS.** The large-message (VoDZ) calls of an SMS or Mobile Key box
  on the portal's `/apps/DS/vodz` (018), the signed downloads that keep each message's original (004), and
  the expired-password guidance, which assumes ISDS answers an expired password with a 401 (001 FR-009).
* **Needs hardware the project does not have.** 025 T004 and T019's last walk (two phones on one Wi-Fi);
  016 T013 (hero states the test device cannot reach); 010 T029 (an unread message in a test box) and §4.5
  in T044 (the scan on a large PDF); iPhone checks - the reminders' redacted lock-screen category and
  VoiceOver focus inside the overlays.
* **Deferred to future work by the owner (2026-09-14).** 006 T015 / T016 / T017, the Google Drive and
  iCloud targets and their permission delta, and with them User Story 2 (config sync across devices); 025
  ~~T022, phone-to-phone transfer on iOS (Android only for now).~~ Built 2026-09-24 at the owner's
  request; its CI run and iPhone walk are owed (025 T026, T027).
* **Smaller edge cases the 2026-09-15 reviews recorded rather than built** are listed as dated "not done"
  notes in each feature's spec or tasks (for example 004, 006 T030, 018, 023, 025, and `docs/accounts.md`).
  *Swept 2026-09-24:* each one code could close is struck through in place with the files and the test
  that fails without it - the backup screen's silent failures, dialogs over the lock screen, restore holds
  and buttons, a verify's Czech counts, a large message's signed original and a restored document lost
  to a failed move, and a sign-in's cookie left by a killed process - and the stale ones say what closed
  them. What stays open
  there needs a device, ISDS or the owner's call, or says why it was left.

New features should run the **full spec-kit loop** rather than spec-then-build, so `plan.md`/`tasks.md`
are written *before* the code and stay meaningful. Principles are in
[`.specify/memory/constitution.md`](../.specify/memory/constitution.md); this file is the single index.
