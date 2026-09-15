# Feature Specification: Phone to phone, with a code phrase

**Feature Branch**: `025-phone-to-phone-transfer`
**Created**: 2026-09-13
**Status**: Implemented on Android and walked between two hosts in both directions (2026-09-13), after the feasibility spike (T001–T003) passed. 19/23 tasks done; T007 (iOS permission delta) and T019 (the two-phone walk) partial. Open: T004 (SC-003, `OnlyLocal` proven between two phones on one Wi-Fi) and T022 (the iOS framework; SC-004, SC-005), which the owner deferred on 2026-09-14: transfer ships on Android only for now, and iOS follows after publishing, on GitHub's macOS runners and a real iPhone. *Amended 2026-09-14:* not met as written: FR-009/SC-002 (amended by T005/T014). Met since 2026-09-14, in code and tests and not yet walked on a device: US1 scenario 1 (the sending phone counts boxes, messages and documents beside the size), US1 scenario 3 (completion reports documents too), US3 scenario 2 (the relayed line names the relay) and the backgrounded-mid-transfer edge case (T021). The same pass found that the receiving phone had never restored Tier 2 documents at all, and fixed it (T014). *Amended 2026-09-15 (review follow-ups, in code and tests, not walked on a device):* saving what arrived is no longer cancellable and nothing starts or sweeps while it runs (FR-012, T021); each native run has its own stop flag (T021); the display stays on while a transfer is live on Android, iOS with T022 (FR-014); the receiving phone keeps the recovery key and document key that arrived (T014); documents are copied and read back a slice at a time (T014). Reviewing that pass the same day found and fixed three more, in code and tests: every offer and receive now stages into a directory of its own, because a stopped run's cleanup, which lands as the next run starts, swept the next run's files (T021); a screen opened again during a save says how the save ended (T021); and switching backups on no longer replaces or clears the key a transfer kept, while the backup screen reads its status again when it comes back into view (T014). An edge-case pass the same day, in code and tests and not walked on a device: a save now runs as one of the backup controller's runs, so no automatic backup starts beside it (T021); a save that ends with no transfer screen open is said on the backup screen, or on the transfer screen opened again (T021); and a declined screen-lock prompt while keeping the keys is traced as a decision rather than reported as a failure (T014). Reviewing that pass the same day found and fixed three more, in code and tests: a send takes the newest backup when it starts, so an automatic backup made while the screen is open no longer fails it (T021); the outcome dialog waits for a dialog already open, and a transfer screen on its way out leaves the outcome to the backup screen (T021); and the backup screen's own restore no longer reports a password it could not keep as a failed restore (T014, 006 T030). A backup polish pass the same day, in code and tests and not walked on a device: a save that has ended schedules an automatic backup, so a phone that kept the key that arrived no longer shows backups on with no backup of what arrived (T021, 006 T030). Task counts unchanged. *Amended 2026-09-24 (owner: "design and build iOS too", before the first release):* the deferral of T022 is reversed. The iOS half is built in code, tests and workflows and has not yet been built by CI or walked on an iPhone; the Go archives are now built by pinned scripts that every release runs (T024), croc no longer resolves its relay when the library loads (T025), and the workflows are T026 and the iPhone walk T027. See the amendment at the end. 21/27 tasks done. *Amended 2026-09-26 by [026](../026-attachment-downloads/spec.md) (owner: the transfer must send a backup that already exists, not prepare one):* the sending phone picks one of its stored backups and exactly that one goes, with only the document objects its manifest lists; the 2026-09-15 rule "a send takes the newest backup when it starts" is withdrawn, and a chosen backup deleted in the meantime ends the send with its own sentence.
**Input**: *"There is some library… It works by connecting to a relay and creating a readable onetime
pass phrase from the sender which the receiver inputs and the transmission just works… I would like to
implement this functionality into the app to sync data from one Obalka to another."* — user request,
2026-09-13. Identified as [croc](https://github.com/schollz/croc); the relay was accepted on the
condition that its use is stated on screen.

## Why

Moving an archive to a new phone works today and nobody would call it pleasant. The user exports the
backup to a file (006 T014), moves that file themselves — cable, cloud drive, messaging app, whichever
they trust — imports it on the other phone, and then types a twenty-character recovery key. Every step
is sound and the sum of them is a chore, which matters because the moment this is needed is the moment
somebody has just replaced a lost phone.

What this feature adds is one sentence: **the old phone shows a code phrase, the new phone types or
scans it, and the archive arrives.**

## What already exists, and what this actually is

This is a **new transport for a payload that is already built**, not a new sync engine. Everything the
transfer would carry exists and is tested:

| Already built | Where |
| --- | --- |
| The sealed archive and its framing | `services/backup/portable.ts`, `envelope.ts` |
| The manifest, read before the bytes, so an unreadable transfer is refused early | `schema.ts`, `migrate.ts` |
| The additive merge — a restore never deletes, never replaces something with nothing | `restore.ts` |
| Tier 2 documents, content-addressed so a re-run skips what already landed | `documents.ts`, `contentId.ts` |
| Progress and cooperative cancel | `progress.ts` |

So the work is: get bytes from A to B, and hand them to `unpackPortable()` on arrival. The
receiving side is `importBackup()`, which already exists and is already walked.

**This is deliberately not continuous sync.** 006 deferred that ("US3 continuous sync — needs 014's
background argument made explicitly"), and nothing here re-opens it. This is a transfer the user
starts, watches, and finishes.

## The library, and what it rules out

croc: Go, MIT, a code phrase, PAKE so the relay only ever sees ciphertext, resumable, p2p with relay
fallback. The alternatives were considered and rejected in `research.md`; the short version:

- **There is no JavaScript route.** The [JS port of magic-wormhole](https://github.com/bakkot/magic-wormhole-js)
  never implemented file transfer and is unmaintained, and the Rust-to-WASM route is dead because
  Hermes has no WebAssembly. Any advice that starts "just use the npm package" does not apply here.
- **Reimplementing the protocol in TypeScript is not on the table.** SPAKE2 on top of `@noble` is
  achievable and is exactly the kind of thing that looks finished and is not. The failure mode is a
  channel that appears encrypted and is not, discovered by nobody.
- So this needs **gomobile**: a Go archive (`.aar` on Android, `.xcframework` on iOS) behind a
  TurboModule. That is a bigger native dependency than anything this app carries, and the spike
  exists to price it before it is bought.

## The relay, decided

croc is p2p with relay fallback. On the same Wi-Fi the bytes may never leave the network; when they
cannot go direct they cross croc's default public relay (`croc.schollz.com` / `croc6.schollz.com` as
of the pinned croc v10.7.0, taken from `models.DEFAULT_RELAY` in `native/transfer/transfer.go`), which
PAKE reduces to a party that sees ciphertext, sizes and timing.

The user's decision, 2026-09-13: **the relay is allowed, and its use is stated on screen.** This does
not breach Principle III — "we never transmit government mail or credentials to any server **we
operate**" — because we operate none of it, and the archive is sealed before it is offered. It is
still the first socket this app opens to anything that is not ISDS, and the interface says so rather
than leaving the user to find out from a network trace.

## What travels, and what must not

**Travels**: the manifest, the sealed archive, the Tier 2 document objects, and — over this channel
only — the recovery key.

The recovery key is the interesting one. Sending the sealed archive without it would leave the user
typing twenty characters at the end of a transfer whose whole promise was that it just works. The
channel is PAKE-authenticated end to end from a one-time phrase the user carried between two screens
in their own hands, which is precisely the thing PAKE channels exist to be trusted with. The cost is
stated plainly in FR-010: the code phrase's entropy is what protects the key, so it is generated by
this app rather than taken from a library default.

**Does not travel**: ISDS credentials and session cookies. They are not in the snapshot and never have
been (006 FR-007), so the new phone signs in to each box afterwards exactly as it does after any
restore. This feature does not change that, and the receiving screen says so before it finishes.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — I move my archive to my new phone (Priority: P1)

**Given** both phones have the app, **When** the old one offers a code phrase and I type it into the
new one, **Then** my messages, drafts, reminders, settings and documents are on the new phone.

**Acceptance Scenarios**:
1. **Given** I start a transfer on the old phone, **Then** it shows a code phrase and what it is about
   to send — a count and a size — before anything moves. *Met 2026-09-14 (T015 amendment): under the
   phrase, "K odeslání: 3 schránky, 19 zpráv, 9 příloh, celkem 7,2 MB". Boxes and messages are counted
   from this phone's archive, documents from the manifest's `documentCount` — counts stay out of the
   manifest (006 FR-011). The limit: the archive is counted as it is now, while the backup that travels
   is the archive as it last settled, so with automatic backups off the two can differ.*
2. **Given** I type the phrase on the new phone, **Then** it shows what it is about to receive and
   asks me to confirm, and nothing is written until I do.
3. **Given** the transfer completes, **Then** the new phone reports counts I can check against the old
   one: boxes, messages, documents. *Met 2026-09-14: "Obnoveno: 1 schránka, 3 zprávy, 9 příloh." in the
   same words and order as the sending phone, followed by how many documents did not land. Before this
   the report left documents out, and the receiving phone restored none (T014 amendment).*
4. **Given** the new phone already has some of these messages, **Then** they are merged, never
   replaced — the restore rules are the existing ones, unchanged.
5. **Given** the transfer finishes, **Then** the new phone tells me the boxes still need signing in to.

### User Story 2 — It goes wrong halfway (Priority: P1)

**Given** a transfer is interrupted — the app is backgrounded, the network drops, a phone is locked —
**When** I start it again with a fresh phrase, **Then** ~~it continues rather than starting over~~ it
starts again cleanly, and nothing is duplicated on the receiving phone *(amended 2026-09-13, T005/T014)*.

**Acceptance Scenarios**:
1. **Given** half the documents arrived, **When** the transfer is re-run with a fresh phrase, **Then**
   every object is sent again but the ones already stored are not written twice *(amended 2026-09-13,
   T005, T014; was: "the ones already stored are not sent again")*.
2. **Given** the archive was interrupted mid-write, **Then** nothing half-written is left where the app
   would later believe it complete.
3. **Given** I cancel, **Then** the receiving phone's archive is exactly as it was. *Amended
   2026-09-15:* a cancel is offered until the arrival is confirmed. Once saving begins it is not, and
   the screen says why: see FR-012.

### User Story 3 — I want to know where my mail went (Priority: P2)

**Given** a transfer falls back to the relay, **When** it does, **Then** the screen says so while it is
happening, and says what the relay can and cannot see.

**Acceptance Scenarios**:
1. **Given** the transfer goes direct, **Then** the screen says it stayed on the local network.
2. **Given** it falls back, **Then** the screen names the relay and says it sees sizes and timing, never
   content. *Met 2026-09-14 (T016 amendment): the relayed line names `croc.schollz.com`, and
   `croc6.schollz.com` for IPv6, which croc tries first — `TRANSFER_RELAY`, pinned to croc v10.7.0 by
   `__tests__/transfer/relayHost.test.ts`.*
3. **Given** I am on a metered connection and the archive is large, **Then** I am told the size and
   asked before it starts.

### Edge Cases
- **The phrase is mistyped.** PAKE gives the attacker — and the fat-fingered user — exactly one guess
  per attempt. The screen must say "that phrase did not match" and offer a fresh one, never "the
  transfer failed".
- **Two transfers at once.** A phrase is one-time; a second receiver arriving on a spent phrase is
  refused.
- **Versions differ.** The manifest is read first, so a phone running an older build refuses a newer
  archive with the existing "update the app" sentence rather than half-importing it (006 FR-010).
- **A gigabyte archive over a relay.** Refused without an explicit confirmation that names the size.
- **The app is backgrounded mid-transfer.** 014 says this app does no background work; a transfer that
  cannot continue must ~~pause~~ stop and say so, not pretend *(amended 2026-09-14, T021: a paused
  transfer could never be picked up again, because the phrase is one-time — T005)*. **Built 2026-09-14
  (T021):** an offer or a receive in flight stops through the cancel path when the app reaches the
  background, or when the screen is left, and the screen says why when the user comes back. The stop
  goes straight to the native module (`Transport.cancel`), because Android runs no JS timers in the
  background. Android reports the display timing out the same way as leaving the app, so a long
  transfer nobody touches stops as well. The sentence says so. ~~Keeping the screen on is still
  open (T021).~~ *Amended 2026-09-15:* the display is kept on while a transfer is live (an offer, a
  receive, and saving what arrived) through `FLAG_KEEP_SCREEN_ON` on Android, so the display timing
  out no longer stops one; leaving the app still does. ~~iOS has no native module yet (T022).~~
  *Amended 2026-09-24 (T022):* on iOS the idle timer is switched off instead, and each run holds a
  background task so the stop issued as the app backgrounds can finish rather than freeze halfway.
- **One phone has no Tier 2 and the other does.** The document objects simply are not in the payload,
  and the receiver reports them missing rather than silently dropping them — the counters for that
  already exist (`DocumentRestoreReport.missing`).

## Requirements *(mandatory)*

- **FR-001**: The transfer MUST carry only bytes that are already sealed. Plaintext archive content
  MUST NOT be handed to the transport under any circumstance.
- **FR-002**: The receiving phone MUST decide compatibility from the manifest BEFORE accepting the
  archive, reusing `compatibilityOf` rather than a second implementation.
- **FR-003**: The import MUST go through the existing `unpackPortable` → `restoreBackup` path. This
  feature adds no second restore implementation, because the merge rules are where an archive gets
  destroyed.
- **FR-004**: Nothing MAY be written to the receiving archive until the user has seen what is coming
  and confirmed it.
- **FR-005**: The code phrase MUST be one-time. A spent phrase MUST NOT admit a second receiver.
- **FR-006**: A failed phrase MUST be reported as a phrase that did not match, distinctly from a
  transport failure — the two have different remedies and collapsing them sends the user hunting for
  the wrong problem.
- **FR-007**: The screen MUST state whether the transfer went direct or through the relay, while it is
  happening, and MUST say what the relay can observe.
- **FR-008**: The size MUST be shown before the transfer starts, and a large transfer over a metered
  connection MUST be confirmed explicitly.
- **FR-009** *(amended 2026-09-13, T005/T014)*: ~~The transfer MUST be resumable, and MUST NOT re-send
  a document object the receiver already holds.~~ A re-run MUST NOT duplicate anything on the
  receiver's disk (the content-addressed store recognises objects it already holds). Cross-wire dedup
  is not possible over a one-way croc transfer, so a re-run re-sends every object, and a transfer
  killed with its process is started again with a fresh phrase rather than resumed.
- **FR-010**: The code phrase MUST be generated by this app with stated entropy, not taken from a
  library default. The phrase is what protects the recovery key in transit, and a default chosen for
  convenience on a laptop is not a decision this app gets to inherit.
- **FR-011**: ISDS credentials and session cookies MUST NOT travel, and the receiving screen MUST say
  the boxes need signing in to.
- **FR-012**: Cancelling MUST leave the receiving archive exactly as it was (Principle IV).
  *Amended 2026-09-15:* this is why saving what arrived cannot be cancelled. The restore writes the
  rows in one transaction and the documents after it commits, so a stop between the two would leave
  messages without their documents. The cancel belongs to the question before the save; during it
  the screen offers none and says so, and no other transfer may start or sweep the files it reads.
- **FR-013**: The native module MUST fail soft. A build where the Go archive is missing or will not
  load MUST hide the feature, not crash the screen — the same rule `bulkCipher.ts` follows.
- **FR-014**: The transfer MUST NOT run in the background (014). It is foreground work the user is
  watching. *Met 2026-09-14 (T021).* *Amended 2026-09-15:* the display is kept on while a transfer is
  live, so a transfer longer than the screen timeout is not stopped by the display going off
  (Android; iOS with T022, built 2026-09-24).

## Success Criteria *(mandatory)*

- **SC-001**: An archive with Tier 2 documents moves between two phones with no cable, no file, and no
  typed recovery key, and the receiving phone's counts match the sending phone's.
- **SC-002** *(amended 2026-09-13, T014)*: ~~An interrupted transfer, re-run, sends measurably less
  than the first attempt.~~ An interrupted transfer, re-run, leaves no duplicate objects and no
  half-written archive on the receiving phone. Sending less on a re-run is not achievable over a
  one-way croc transfer.
- **SC-003**: On the same Wi-Fi, a packet capture shows no traffic to any relay host.
- **SC-004**: The permission and entitlement delta on both platforms is recorded the way 010 T027 did,
  before the feature is called done.
- **SC-005**: The binary cost is stated: APK and IPA size before and after.

## Open, and deliberately so

- ~~**Whether this is worth its binary cost at all.**~~ Answered 2026-09-13 by T003: +7.75 MB on
  Android (arm64 release), ~8 MB estimated on iOS until a call site exists; continue.
- ~~**iOS background-transfer limits.** A transfer that cannot survive the app being backgrounded is a
  worse experience on iOS than Android, and FR-014 forbids the usual workaround.~~ *Answered 2026-09-24
  (T022):* the same on both platforms - the transfer stops when the app is backgrounded (FR-014) and the
  display is kept on so it is not backgrounded by a timeout. iOS gets background time only to finish the
  stop cleanly.
- ~~**Which end starts.**~~ Decided 2026-09-13 with the UI (T015): the old phone offers the phrase
  and the new phone enters it. Receiving-initiated transfer is deferred (`tasks.md`, Deferred).

## Amendment 2026-09-24 — the transfer on iOS (T022)

The owner, 2026-09-24: "design and build iOS too", before the first release, reversing the 2026-09-14
deferral. Built in code, tests and workflows the same day (tasks T022, T024-T027); nothing here has been
built by CI or run on an iPhone yet. The decisions, and why:

1. **Go to iOS: `gomobile bind -target=ios`, device only.** One arm64 slice in
   `Obalkatransfer.xcframework`, built on the macOS runner by `scripts/build-transfer-xcframework.sh`
   (gomobile drives Xcode, so not on Linux), with the minimum iOS read from the Xcode project. No
   simulator slice by default: this app does not build for the simulator at all (VisionCamera names
   CoreVideo constants the simulator SDK lacks, see `ci.yml`), so it would be built for nothing; the
   script takes `ios,iossimulator` for the day that changes. The framework is gitignored, like the `.aar`.
2. **Linked through a local pod, not the Xcode project.** `ios/ObalkaTransferModule/` holds the podspec,
   the module source and (when built) the framework. CocoaPods picks the device slice, puts its headers
   on the module's search path and links it; the same by hand is a set of `project.pbxproj` entries.
   The pod also links what the Go runtime calls and a static archive does not carry: `libresolv` (`net`)
   and Security + CoreFoundation (`crypto/x509`).
3. **The same module on both platforms.** An Objective-C legacy bridge module, the kind Android's is,
   with its contract to the letter; `__tests__/transfer/nativeModuleContract.test.ts` reads both and the
   TypeScript interface and holds them together. `nativeTransport.ts` lost its platform check and
   nothing else.
4. **Fail soft by compiling out (FR-013).** Android loads its Go class reflectively; iOS cannot link a
   static framework that is not there, so the pod defines `OBALKA_TRANSFER_LINKED` only when the
   framework exists at `pod install`, and the module is compiled under it. Without it there is no
   `ObalkaTransfer` module, the transport says unavailable, and Welcome offers "Obnovit ze zálohy" - as
   on a developer's Mac with no Go. CI, the sideload build and a release build the framework first and
   fail without it (T026).
5. **Backgrounding (FR-014 unchanged).** The screen stops a run when the app reaches `background`, as on
   Android. iOS suspends an app seconds later, which could freeze the stop halfway - croc's sockets, the
   promise, and the JavaScript sweep of the staged archive and recovery key. So each run holds a
   `beginBackgroundTask` from start to end; the time is used to finish stopping, never to go on, and if
   iOS ends it first the module stops the run itself. The display is kept on with `idleTimerDisabled`,
   so auto-lock does not background a long transfer.
6. **The local network.** Read from croc v10.7.0 and Apple's TN3179. The receiving phone first meets the
   sender through the relay, is told the sender's local addresses, and connects to them directly: an
   outgoing TCP connection to a local address, which needs the Local Network privilege, so iOS asks at
   the first transfer - hence `NSLocalNetworkUsageDescription`. The sending phone's side, croc's local
   relay listening for that connection, is not subject to it ("listening for and accepting incoming TCP
   connections" is exempt). If the user refuses, the direct connection fails and the bytes go through
   the relay, which the route line reports as observed (FR-007). TN3179 also warns that iOS may refuse
   the operation that raised the prompt before the user has answered it, so the very first transfer on
   an iPhone may go through the relay even when the answer is yes; the next one goes direct.
7. **No multicast entitlement.** croc also looks for the other phone by UDP multicast
   (`schollz/peerdiscovery`), and iOS allows multicast only with `com.apple.developer.networking.multicast`,
   a restricted entitlement Apple grants on request. Not requested: without it the discovery fails
   quietly and croc finds the peer through the relay as in point 6 (the receiver tries each local
   address it is told for half a second, then stays on the relay). The consequence is `OnlyLocal`, which relies on discovery alone and so cannot
   find a peer on an iPhone; the app never sets it (`onlyLocal` is not wired), and SC-003/T004 is an
   Android measurement.
8. **ATS is unaffected.** App Transport Security governs the URL Loading System; croc opens its own TCP
   sockets from Go and speaks no HTTP.
9. **No new privacy-manifest entry.** Listed from a darwin/arm64 build of the wrapper, the Go runtime's
   libc imports that Apple asks reasons for are the `stat` family (file timestamps, C617.1) and
   `mach_absolute_time` (system boot time, 35F9.1), both declared already in `PrivacyInfo.xcprivacy`.
10. **Export compliance.** croc's crypto is standard - a PAKE over P-256 (`schollz/pake`), PBKDF2-SHA256
    and AES-256-GCM from Go's standard library - noted in `docs/release-ci.md` beside the app's own.
11. **Found on the way: croc resolved its relay at every iOS launch** - T025, patched out; the relay is
    resolved when a transfer connects, on both platforms.
12. **Where the build lives.** In this repository for now, self-contained (the Go module, `prepare.sh`,
    one script per platform) so that it can move to `dorhawk-software/obalka-transfer` with its own
    releases later, as planned (`docs/release-ci.md`).

SC-004 for iOS, from the code: no entitlement, one usage string (T007). SC-005 is owed from the first CI
build (T022, T027).
