# Not now

What was decided not to do yet, or is still owed, and why. `specs/` stays the record of each
milestone; this is the one list of what they left open (the practices' `common/not-now.md`). Each
entry: **what (date).** Why. What brings it back, or the plan. Where it came from. "Decided: left as
it is" marks a limitation kept on purpose. Done items leave the list.

# Part A: collected from the specs and the constitution (2026-11-12)

## Walks that need a person, a real box or hardware

- **The 001 quickstart, end to end (2026-09-08).** Each flow was walked, never the script as
  written. Needs a person with the test credentials.
  ([001/tasks.md](../../specs/001-accounts-secure-login/tasks.md) T046)
- **The 005 quickstart on czebox, a large (VoDZ) send included (2026-09-14).** Rides along: the sent
  message opening from the success screen (T018). The paid send needs PDZ credit the test box lacks.
  ([005/tasks.md](../../specs/005-sending-messages/tasks.md) T031)
- **A paid VoDZ send, and streaming its upload (2026-06-16).** Not exercised. The chunked read still
  ends as one base64 string in memory; stream from `localPath` instead.
  ([005/tasks.md](../../specs/005-sending-messages/tasks.md), phase B0 note)
- **A real ISDS SMS on the code screen during a re-authentication (2026-08-19).** Only someone with
  the box's credentials can run it. ([021/tasks.md](../../specs/021-sms-one-time/tasks.md) T010)
- **Automatic download on czebox (2026-09-26).** Received and sent; the message stays unread in ISDS
  after a signed download (not measured).
  ([026/tasks.md](../../specs/026-attachment-downloads/tasks.md) T018)
- **The password-change walk's last step (2026-11-11).** The change worked on build 5; a
  notification itself is still to be seen. ([030/tasks.md](../../specs/030-password-change/tasks.md)
  T011)
- **The changelog across two versions, and on the first real release (2026-11-10).** Needs two
  releases with sections; then check the texts where they land.
  ([029/tasks.md](../../specs/029-changelog/tasks.md) T013, T014)
- **Attention group §1.1–1.2 and the scan on a large PDF (2026-09-14).** Needs an unread message in
  a test box, and a 10+ page document. ([010/tasks.md](../../specs/010-deadlines-attention/tasks.md)
  T029, T044 §4.5)
- **Three hero states and the emblem (2026-08-17).** Unreachable on the test device: they need an
  empty folder or a load failure. ([016/tasks.md](../../specs/016-expressive-icons/tasks.md) T013)
- **The cross-box line's still-refreshing clause and a reminder-only line (2026-09-15).** The demo
  archive doesn't produce them. ([024/spec.md](../../specs/024-cross-box-attention/spec.md), device
  walk)
- **Switching the sender in compose (2026-10-03).** Every emulator box needed a sign-in; covered by
  tests only. ([027/tasks.md](../../specs/027-sender-and-box-colours/tasks.md))

## Built, but not yet met ISDS

- **Signed originals (.zfo) and the VoDZ resume (2026-09-14/15).** No signed download has been
  called against a real box. Walks 1–12 are listed in the spec.
  ([004/spec.md](../../specs/004-local-archive-search/spec.md), "Device walks owed";
  [constitution](../../.specify/memory/constitution.md) IV, as built)
- **VoDZ downloads on the box's own session (2026-09-15).** The portal's `/apps/DS/vodz` route and
  the patched `omitCookies` have met no real session. Owed on Android and iOS, with two cookie
  boxes. ([018/tasks.md](../../specs/018-per-box-session/tasks.md) T015)
- **The shared cookie jar after each kind of sign-in (2026-09-15).** Refused, cancelled and resent
  sign-ins were fixed in code; nobody has looked at the jar on a device.
  ([018/tasks.md](../../specs/018-per-box-session/tasks.md) T007)

## Device walks owed after the reviews and audits

- **The double-tap audit (2026-09-23).** Guarded in code and tests. Owed: resend SMS and Mobile Key
  (001), attachment viewers (002), send and paid confirm (005), backup switch (006), the transfer's
  buttons and scan (025). ([001](../../specs/001-accounts-secure-login/tasks.md),
  [002](../../specs/002-messages-and-resilience/spec.md),
  [005](../../specs/005-sending-messages/tasks.md),
  [006](../../specs/006-encrypted-cloud-backup/tasks.md),
  [025](../../specs/025-phone-to-phone-transfer/tasks.md), amendments 2026-09-23)
- **A Keychain that fails after a JS reload (2026-09-24).** The launch screen should offer its
  retry, not go blank. ([001/tasks.md](../../specs/001-accounts-secure-login/tasks.md), amendment
  2026-09-24)
- **The 2026-09-24 backup changes.** A backup file loaded on a phone with no boxes; the recovery-key
  QR without ML Kit; nothing in iCloud or Android backups; a restored inbox saying "Zatím
  neaktualizováno". ([006/tasks.md](../../specs/006-encrypted-cloud-backup/tasks.md), amendments
  2026-09-24)
- **The 2026-09-24 transfer changes.** Welcome to transfer on a fresh install; QR codes read without
  ML Kit, on Android and then iOS.
  ([025/tasks.md](../../specs/025-phone-to-phone-transfer/tasks.md), amendments 2026-09-24)
- **The 2026-09-15 review fixes, in code and tests only.** Box removal resuming and the refusal's
  timing (001 T037, T041); the backup and transfer screens' passes (006, 025).
  ([001/spec.md](../../specs/001-accounts-secure-login/spec.md),
  [006/tasks.md](../../specs/006-encrypted-cloud-backup/tasks.md),
  [025/tasks.md](../../specs/025-phone-to-phone-transfer/tasks.md))
- **The debug screen's eleven "not yet seen on a device" notes (2026-09-15).** Largest text size,
  TalkBack and VoiceOver announcements, a delete the phone refuses.
  ([023/spec.md](../../specs/023-debug-bundle/spec.md))

## Phone to phone

- **Two phones on one Wi-Fi, with a packet capture (2026-09-13).** Proves `OnlyLocal` reaches no
  relay (SC-003), the claim the privacy copy makes. Needs two phones.
  ([025/tasks.md](../../specs/025-phone-to-phone-transfer/tasks.md) T004, T019)
- **The rest of the iPhone walk (2026-11-10).** Still owed: the local-network prompt refused once,
  the display kept on through a long transfer, the new screen-lock prompt title, the IPA size
  (SC-005). ([025/tasks.md](../../specs/025-phone-to-phone-transfer/tasks.md) T007, T022, T027)
- **Receiving-initiated transfer (2026-09-13).** The old phone offers the phrase. Better when the
  old phone is the damaged one; back if that case comes up.
  ([025/tasks.md](../../specs/025-phone-to-phone-transfer/tasks.md), Deferred)
- **A self-hosted relay. Decided: left as it is (2026-09-13).** A relay the project runs breaks
  006's commitment; one the user runs serves nobody who needs this.
  ([025/tasks.md](../../specs/025-phone-to-phone-transfer/tasks.md), Deferred)

## Backup and archive

- **Google Drive and iCloud targets (2026-09-14, the owner).** Need a Google OAuth client and
  Google's review; a paid Apple membership and the iCloud entitlement. With them comes config sync
  across devices (US2). ([006/tasks.md](../../specs/006-encrypted-cloud-backup/tasks.md) T015–T017)
- **Continuous archive sync (US3).** Needs 014's background argument made explicitly, and a conflict
  rule for an append-mostly archive. ([006/spec.md](../../specs/006-encrypted-cloud-backup/spec.md)
  US3, Open / Deferred)
- **Cross-ecosystem sync. Decided: left as it is.** It needs a neutral server the project committed
  not to run. ([006/spec.md](../../specs/006-encrypted-cloud-backup/spec.md), Open / Deferred)
- **Key rotation or a passphrase change without re-uploading.** Open since the spec.
  ([006/spec.md](../../specs/006-encrypted-cloud-backup/spec.md), Open / Deferred)
- **A restore waiting for a removal shows no waiting state (2026-09-24).** The button says it's
  working. A waiting state needs the run published earlier, without hiding a running backup.
  ([006/tasks.md](../../specs/006-encrypted-cloud-backup/tasks.md) T008)
- **A backup whose documents aren't in the store is held after a restore (2026-09-24).** Costs
  space, loses nothing. Which kind a backup is for is the owner's call.
  ([006/tasks.md](../../specs/006-encrypted-cloud-backup/tasks.md) T030)
- **The FR-017 decision rests on every listing calling `onArchiveChanged` (checked 2026-09-24).** If
  the list's caching stops calling it, decide again.
  ([006/tasks.md](../../specs/006-encrypted-cloud-backup/tasks.md) T030)
- **The seal is kept, not checked (2026-09-14).** `AuthenticateMessage` and re-stamping aren't used.
  ([004/spec.md](../../specs/004-local-archive-search/spec.md), Not done)
- **A VoDZ download the user cancels records nothing. Decided: left as it is (2026-09-15).**
  Recording would write to a box after the user left it, maybe mid-removal.
  ([004/spec.md](../../specs/004-local-archive-search/spec.md), Not done)
- **Two smaller resume edges (2026-09-15, 2026-09-24).** A held file gone from the device isn't
  fetched by the resume; the full download brings it back. A kill beside a stale `.old` leaves the
  copy under a unique name, not put back.
  ([004/spec.md](../../specs/004-local-archive-search/spec.md), Not done)

## Accounts and sign-in

- **The Keychain's AES-CBC items before upgrading react-native-keychain (2026-09-24).** A release
  dropping AES-CBC would lose the vault key. Migrate such items first; the plan is in the task.
  ([001/tasks.md](../../specs/001-accounts-secure-login/tasks.md) T049)
- **Keys outside the lock's gate (2026-09-15).** The database key and the backup passphrase's
  app-usable copy are device-bound, not gated. A killed sign-in's cookie is now emptied at the next
  launch (018). ([constitution](../../.specify/memory/constitution.md) III, known gaps)
- **Password-manager autofill of the ISDS website login.** Field hints shipped. Web-credential
  association needs files on the operator's domains, which the project doesn't control.
  ([001/spec.md](../../specs/001-accounts-secure-login/spec.md), Deferred: password-manager
  autofill)
- **An in-app PIN. Decided: left as it is (2026-09-08).** The fallback is the device passcode; its
  OS screen title can't be branded. ([001/tasks.md](../../specs/001-accounts-secure-login/tasks.md)
  T027, [001/spec.md](../../specs/001-accounts-secure-login/spec.md))
- **NIA, BankID and mojeID sign-in.** Portal-only, not in the public API. The spike is deferred and
  unnumbered. ([constitution](../../.specify/memory/constitution.md) VI,
  [specs/README.md](../../specs/README.md))

## Messages, sending and the inbox

- **Read state from other clients (2026-06-13).** Deferred. If built, reconcile only on a user
  action, as 014 FR-001 lists them; never on a timer.
  ([002/spec.md](../../specs/002-messages-and-resilience/spec.md), Deferred: cross-client
  read-state)
- **Recipient recents and favourites; a richer delivery timeline.** Out of v1.x scope.
  ([005/spec.md](../../specs/005-sending-messages/spec.md), Still deferred)
- **User-orderable boxes; a branded pull-to-refresh.** Ordering needs a `position` column, UX
  research and a call on drag versus move buttons. The pull needs a custom scroll; only if wanted.
  ([007/spec.md](../../specs/007-appearance-and-settings/spec.md), Deferred / TODO)
- **No migration deleting the abandoned sync settings rows, and no replacement for ISDS
  notifications. Decided: left as it is (2026-08-16).** See plan D2; `RegisterForNotifications` needs
  certificate access the project lacks. ([014/tasks.md](../../specs/014-no-background-sync/tasks.md))
- **The credit's age isn't shown. Decided: left as it is (2026-08-17).** It is refreshed when a paid
  recipient is picked. Revisit if a stale figure ever misleads.
  ([020/tasks.md](../../specs/020-pdz-credit/tasks.md), Not done, deliberately)

# Part B: from the practices adoption audit (2026-11-12)

Obálka's own harness gaps, to be fixed as the next pieces of work.

## Releases

- **A failed `git push --atomic` becomes a phantom `+2` rebuild on re-run.** Plan: refuse when main
  is ahead of origin, and check the tag for real (`tagExists` is hard-coded false).
  (`scripts/release.mjs`)
- **No wait for green CI on the tagged commit.** Plan: the release command waits for the commit's CI
  and refuses a red one.
- **No rehearsal.** Plan: `--dry-run` in `release.mjs`, and a `workflow_dispatch` run of
  `release.yml` that publishes nothing.
- **Verify runs after the tag is public.** Plan: run it before the push.
- **The Sentry release has no build or dist, so rebuilds merge.** Plan: dist = build.
- **In-app What's new is keyed by version.** Testers of a rebuild miss entries folded into it. Plan:
  key by version and build.
- **Apple's 4000-character limits are unchecked.** What's New and What to Test. Plan: check the
  length in `changelog.mjs`.
- **GitHub marks 1.x releases as full releases while the app is in beta.** Plan: mark them
  pre-release until the beta ends.
- **"The App Store version follows the newest release, never submitted before the owner walked the
  build" lives only in agent memory.** Plan: write it into `docs/release-ci.md`.

## CI

- **Third-party actions pinned by tag.** `r0adkll/upload-google-play`, `astral-sh/setup-uv`,
  `aquasecurity/trivy-action`. Plan: pin by commit.
- **The Trivy canary installs another, unpinned Trivy via `curl | sh` from main.** Plan: one pinned
  Trivy for both.
- **The ASC key and Sentry token sit in the env of the archive step.** Plan: give them only to the
  steps that upload.
- **No Gradle or CocoaPods cache; `pod install --repo-update` every run.** Podfile.lock and
  Gemfile.lock aren't committed; pod doesn't run through `bundle exec`. Plan: commit both locks,
  cache, `bundle exec pod install`.
- **Push builds never build the Android app, a Release configuration or the Hermes bundle.** Plan:
  add the cheapest of these to the push job.
- **`release.yml` lacks the Sentry preflight.** Plan: run the same check as `ci.yml` before
  building.
- **The Xcode pin block is pasted into three workflows.** Plan: one shared step or script.
- **Local Xcode 27, CI Xcode 26.3.** Plan: decide the version and write it down; build locally with
  CI's when it matters.
- **Stale texts.** `docs/release-ci.md`'s status line; ci.yml's single-commit concurrency comment;
  `docs/sideload-ios.md` says change `runs-on`; `docs/store/listing.md` cites a missing `asc.py
  verify`; `docs/aso.md` disagrees with it. Plan: correct each; one store doc, the other points to
  it.
- **`tools/asc.py` hard-codes App Store Connect identifiers and a password manager item name as
  defaults.** Plan: move them to config or env.
- **`asc.py` and `store_screens.py` have no tests.** Plan: tests for the parts that build requests
  and texts.

## Tests

- **No coverage measured.** Plan: measure, then set floors per area in `.practices/coverage-floors`.
- **SQL never runs in tests.** The op-sqlite mock returns empty rows. Plan: a SQLite runner against
  the same SQL.
- **No global network guard in jest.** Plan: fail any test that opens a connection.
- **Harness bugs worked around by splitting files.** A second AppShell stops answering presses; the
  backup-screen suites; jest's "worker failed to exit gracefully". Plan: find the leaked state.
- **The 30 s global timeout hides slow tests.** Plan: lower it, and give the few slow ones their
  own.
- **`DEMO_DATA` is a hand-flipped constant with no guard test.** Plan: a test that it is off in what
  ships.
- **The golden backup fixtures' source refs were lost in the history squash.** Plan: record how each
  was made beside it.

## Code and lint

- **16 files over 700 lines.** In `.practices/size-allowlist`, which only shrinks. Plan: split them
  as they're touched.
- **Module boundaries aren't enforced; services import features and app.** Plan:
  `no-restricted-imports` per layer.
- **`src/services/logging/logger.ts` is unused.** Plan: remove it, or use it.
- **patch-package patches have no why or remove-when.** Cookies, argon2, unpdf's 1.3 MB patch; no
  `--error-on-fail`. Plan: a note per patch and the flag.
- **The GPLv3 ban isn't checked by a script.** Plan: check licences in `verify`.
- **Go: no govulncheck, gofmt or staticcheck.** Nothing compares `go-modules.json` with `go.mod`.
  Plan: add all four to CI and `verify`.
- **The attributions fingerprint ignores the lockfile.** Plan: include it.
- **`eslint-comments/require-description` isn't on; three bare disables.** Plan: enable it and give
  the three a reason.
- **ESLint 8 legacy config.** Plan: move to ESLint 9's flat config.
- **Prettier is configured but not enforced.** Plan: check it in lint, or drop the config.
- **The `no-void` reason cites `no-floating-promises`, which isn't on.** Plan: enable that rule or
  fix the reason.
- **tsconfig adds `lib: dom`, which types globals Hermes lacks.** It also inherits
  `forceConsistentCasingInFileNames: false`. Plan: drop dom, set it true.
- **The Tamagui any-typed wrapper (`TODO tamagui-types`).** Plan: type it.
- **No measured startup or list performance.** Plan: measure on a device, then hold a budget.
- **`hermesShims.ts` is an undocumented exception to the hermesGlobals rule.** Plan: write why where
  the rule is.

## Docs and process

- **The specs README's status counts are made by hand.** 001's spec says 44/48, its tasks 44/49;
  027 reuses T013. Plan: generate the table and refuse duplicate task ids.
- **Specs cite pre-squash commit hashes that no longer exist.** The README says so. Plan: cite files
  and tests from now on.
- **The owner's name and test box ids in the public repository. Decided: left as it is
  (2026-11-12).** The name in `release.yml`, `docs/release-ci.md` and `ios/ExportOptions.plist` is
  already on every commit; the box ids in 030's (and 010's) tasks are the test environment's and
  lead only to that name. This allows these items only: other personal details stay out of the
  repository.

# Part C: found by the identity pass's second inventory (2026-11-12)

The identity pass (031) changes how the app looks and moves, not what it does; these are behaviour, so
they wait for their own work. The owner decided "not now" on 2026-11-12.

- **The camera is asked for with no word first (2026-11-12).** The QR scanner (transfer, the backup
  key) raises the OS prompt as it opens. The mobile practice "Explain before the permission prompt, and
  ask once" wants a sentence first, as the notification nudge has. Plan: an explanation before the
  first scan, drawn on the canvas with the sheets and dialogs.
  ([031/tasks.md](../../specs/031-identity-pass/tasks.md) I127)
- **English is a second language (2026-11-12).** The app starts in Czech whatever the device says,
  dates are written the Czech way in English too, and the iOS permission texts (camera, Face ID, local
  network) exist only in Czech. Plan: its own spec - the device's language on first run, dates per
  language, an English `.lproj`. ([031/tasks.md](../../specs/031-identity-pass/tasks.md) I137)
- **No error boundary (2026-11-12).** A render error leaves an empty screen with no way on. Plan: a
  boundary at the root with a fallback screen that offers to start again, reported only with consent;
  the screen gets a board on the canvas first. ([031/tasks.md](../../specs/031-identity-pass/tasks.md)
  I139)
- **Android sets Public Sans about 2.5% wider than the boards (2026-11-13, left as it is).** The same
  font file measures the same in Chrome (207.98 against 207.70 px for one line), so the difference is
  Android's text layout, not the app's. A line on a phone can therefore wrap one word earlier than on
  its board ("chyby:" in Settings › Diagnostika). Decided to leave it: tightening letter-spacing per
  platform would draw every other line narrower than the design, and the walks compare everything
  else at full resolution. ([031/tasks.md](../../specs/031-identity-pass/tasks.md) I43)
- **A sent message's stamp is blank (2026-11-13).** Board R7 prints what the send cost ("ZDARMA 0 Kč")
  on the stamp of a sent message opened from Odeslané, but the archive does not know it: ISDS lists no
  price, the app does not read `dmType` (which would tell a paid commercial message from a free one,
  still not the amount), and only the sent result, at the moment of sending, knows `paidCzk`. A stamp
  prints nothing it does not know, so it is blank and cancelled. Plan: keep the cost the sent result
  learns, by message ID, and read `dmType` for the rest; then the stamp prints it.
  ([031/tasks.md](../../specs/031-identity-pass/tasks.md) I30)
- **"č. j." can part across a line in a subject (2026-11-13).** The Czech typesetting (I82) holds a
  one-letter word to the next; a two-part abbreviation such as "č. j." or "sp. zn." in a message's own
  subject can still break after "č." (seen on the demo's "Odpověď na výzvu č. j. …"). Plan: extend
  `typesetCs` to the abbreviations ISDS subjects use, and run subjects through it.
  ([031/tasks.md](../../specs/031-identity-pass/tasks.md) I82)
