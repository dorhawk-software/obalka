# 023 - Debug mode: a log bundle the user hands over themselves

**Status**: Implemented 2026-09-10. ~~Not yet walked on a device: the share sheet and the file write are the two things a unit test cannot prove.~~ **Walked on the Android emulator 2026-09-15** (see "Device walk, 2026-09-15" below): the file write worked, and the share sheet did not - Android sharing never worked until that day's fix. **2026-09-14:** the two gaps recorded that day are closed in code and tests - recording is now marked outside the Debug screen (FR-007), and building a bundle no longer holds the JS thread (Constitution I). Neither change has been walked on a device yet - both noted below. **2026-09-15:** three review follow-ups closed in code and tests - a finished save no longer moves the notice, the controls or the saved files on the Debug screen (Principle V; the saved files after a second review that day), the recording strip and the TestEnvBanner are one on-scale `StatusStrip`, and a save stopped while another is still compressing is shown to wait for it (Constitution I). None of the three has been walked on a device yet. **2026-09-15, edge cases:** four more closed in code and tests - the recording counter can no longer move anything under it as its words grow (Principle V), the saved files tell a folder that could not be read from an empty one and keep a file whose size could not be read (Principle II), the notice is announced to screen readers, and the Debug screen's own spacing and captions are on DESIGN.md's scales, with the message detail's header gap made one step whatever strip is above it. None of the four has been walked on a device yet; the walks are listed under II and V. A review the same day closed two more in code and tests: the counter and its reserve now break into lines the way the reserve's proof assumes on Android too, and a bundle that could not be deleted is reported instead of left in place without a word (Principle II). Neither has been walked on a device yet. **2026-09-15, screen polish:** three more closed in code and tests - the app's dialog, which asks before a bundle is deleted, keeps its buttons on the screen at the largest text sizes (Principle II); a read of the saved files that fails again says so in new words and is announced, a read that never answers ends after five seconds in the "could not be read" state with "Zkusit znovu", and a retry still reading shows as busy (Principle II); and the settings furniture the Debug screen shares with the Settings, Backup and Transfer screens is on DESIGN.md's scales, keeping the values DESIGN.md records for it (Principle V; corrected the same day: a section also keeps the 9 and 22 the design draws). None of the three has been walked on a device yet; the walks are listed under II and V. A review the same day closed two more in code and tests: a failed read of the saved files no longer cuts off a notice VoiceOver is still reading, and "Zkusit znovu" stays busy while any read of the folder is out, not only its own (Principle II). Neither has been walked on a device yet. **2026-09-15, files and design:** two more closed in code and tests - a button whose action is running, the save and "Zkusit znovu" among them, is heard by a screen reader as busy, no longer as unavailable (Principle II), and a section's gap and margin are the design's 9 and 22 again, with the furniture's tests asserting what renders instead of reading source text (Principle V). Neither has been walked on a device yet; the walks are listed under II and V.

## Why

A Sentry report is deliberately lossy. `scrub.ts` is an allow-list: context keys (`ALLOWED_KEYS`,
plus per-section `ALLOWED_CONTEXTS`), the exception class, a scrubbed message, and nothing else.
That is the right design for something that transmits automatically, and it is exactly what makes a
hard bug unfixable from a report alone. The envelope
that failed to parse, the sequence of calls that led there, the SOAP fault detail, which box and
which message: all of it is gone by design, and no amount of staring at the dashboard brings it back.

So there needs to be a second channel with a completely different trust model:

| | Telemetry (Sentry, `src/services/telemetry/`) | Debug bundle (this) |
|---|---|---|
| Who decides | consent toggle, once | the user, per bundle, every time |
| When it leaves | automatically on a crash | only when the user shares it |
| How it leaves | our SDK, over the network | the OS share sheet, to whoever they pick |
| What it holds | an allow-list | the diagnosis, and optionally the mail |
| Where it lives | Sentry | a file on their phone they can open and read |

The distinction that makes this safe is not redaction, it is **agency**. A telemetry event leaves a
phone without anyone looking at it. A debug bundle is a file, on the user's own device, holding the
user's own data, which does nothing at all until they deliberately hand it to someone.

## Scope

**FR-001** A Debug mode with an explicit start and an explicit stop. While it is on, the app records
a structured event trail in memory. Nothing is recorded when it is off.

**FR-002** Two levels, chosen when recording starts:
  * **Standard** - the diagnosis: operations, timings, HTTP status and endpoint, SOAP fault codes,
    ISDS `dmStatusCode`, stack traces, schema version, device and OS. No message content.
  * **Full** - everything Standard has, plus the SOAP request and response bodies and message
    metadata. This is the level for "the standard bundle was not enough", and the screen says so.

**FR-003** Credentials are removed at BOTH levels, without exception and with no way to turn it off:
passwords, HTTP Basic headers, session cookies, OTP codes, the backup passphrase and recovery key.
Principle III's second clause is absolute, and the user cannot meaningfully consent to sharing a
password they cannot see inside a 5 MB log. Full mode means "my mail", never "my credentials".

**FR-004** Stopping writes a `.zip` into the app's own documents directory. It contains a
`manifest.json` (app version, platform, OS, level, time range, entry count) and the trail as NDJSON.
Both are plain text: a bundle the user cannot open is a bundle they cannot consent to sharing.

**FR-005** The app NEVER uploads a bundle. There is no network code in this feature. Sharing is the
OS share sheet and nothing else, started by the user, from a list of bundles they can also delete.
A test enforces the absence, structurally, rather than trusting the claim.

**FR-006** The recorder is bounded: a ring buffer with a hard cap on entries and bytes, so leaving
Debug mode on cannot exhaust memory or fill the disk. The oldest entries are dropped first.

**FR-007** Recording is visible while it is happening. Debug mode is not a state the user can be in
without knowing, and it does not survive a restart.

**Met in code (2026-09-14); device walk pending.** Recording does not survive a restart
(`debugController.ts`). Until 2026-09-14 the recording state was shown only on the Debug screen
itself, and nothing marked it while the user was elsewhere reproducing the bug, which is what that
screen tells them to do. Now every screen except the Debug screen carries a one-line strip above its
header while a recording runs - a red dot and "Režim ladění zaznamenává" - and tapping it opens the
Debug screen (`src/app/DebugRecordingStrip.tsx`, applied to every route once, through the navigator's
`screenLayout` in `AppNavigator.tsx`). The screens the shell draws outside the navigator frame
themselves, and show the same strip as a label only, because there is no Debug screen to open from
there: the sign-in flow (`LoginFlow.tsx`), Welcome, where removing the last box during a recording
lands (`Welcome.tsx`), and help, which the shell draws over both of them (`FaqScreen.tsx`). A frame
inside another frame adds nothing, so help reached as a navigator route still carries one strip.

* **No layout jump (Principle V).** The strip is a normal-flow element, never an overlay - since
  2026-09-15 drawn by the same `StatusStrip` as the TestEnvBanner, with the same reserved row (below) -
  and the screen under it is handed a top inset of 0, so no header clears
  the status bar twice. It is not drawn on the Debug screen, and a recording starts and stops only
  there, so the strip never appears or disappears on the screen in front of the user: covered screens
  change while they are covered (freeze-on-blur is off - react-native-screens defaults it to
  `freezeEnabled()`, which stays false because the app never calls `enableFreeze()`), and a screen
  opened later has the strip from its first frame. The element tree is the same with or without it,
  and whether a frame is nested is fixed where it is mounted, so the screen under it never remounts.
* **Evidence.** `__tests__/app/debugRecordingStrip.test.tsx`: "marks every screen but the Debug
  screen while recording, and none once it stops", "opens the Debug screen when tapped", "can only
  appear or disappear under the Debug screen, because nothing else starts or stops it" (a structural
  guard that `DebugScreen.tsx` is the only caller of start and stop - it held before the strip existed
  too, and fails when a second caller appears), "hands the screen a spent top inset, so its header does
  not clear the status bar twice", "never remounts the screen under it when recording starts or
  stops", "stays off a screen that asks for it to be hidden", "draws one strip for a screen framed
  twice, and none under a hidden frame", "marks the sign-in flow too, as a label rather than a button
  that could lead nowhere", "marks Welcome, where removing the last box during a recording lands",
  "marks help wherever it is drawn: over the sign-in flow, and once as a navigator route". The strip
  is kept current by the recorder's own announcements: `__tests__/services/debugLog.test.ts` › telling
  the screens.
* **Reviewed 2026-09-14.** The first version of this change left Welcome and the help the shell draws
  over the sign-in flow without the strip, and the review closed both through the nested frame above.
* **Reviewed 2026-09-15 - one strip, on the scale.** The strip was a copy of the TestEnvBanner's
  numbers - 5/14 padding, a 7 gap, a 12/15 label - which sit off DESIGN.md's spacing scale
  (2/4/6/8/10/12/14/18) and below its 13 type step, and the copy added a minimum height the banner did
  not have. Both strips are now `src/theme/StatusStrip.tsx`: 6/14 padding, an 8 gap, 14 dp glyphs, the
  Badge 13/16 label, a 1 px hairline, and one reserved 28 dp row (a `minHeight`, so larger text grows
  it). A strip that is a button is also at least 48 dp tall counting the status-bar inset it clears;
  on a phone with a status bar the inset pays for that, and its row is the banner's. The label is free
  to wrap: pinned to one line as before, "Režim ladění zaznamenává" - 166 dp in Public Sans Bold 13,
  measured from the bundled font - needs about 398 dp for its row at 200 % text, more than a 390 dp
  phone has, and was drawn past both edges. Both strips are 3 dp taller than they were (28 dp rows
  instead of 25). The pattern is recorded in DESIGN.md › Components › Status strips. Evidence:
  `__tests__/theme/statusStrip.test.tsx` › "reads the scales DESIGN.md states, so nothing below passes
  against an empty one" (the spacing scale and the Badge step are read from DESIGN.md itself), "draws
  the test banner with spacing from the scale and the Badge type step", "draws the recording strip
  with spacing from the scale and the Badge type step", "reserves the same row for the test banner and
  the recording strip, button or label", "grows a button to a finger s height only where no status bar
  pays for it", "pins each tone to its tokens", "paints both strips from the light palette", "paints
  both strips from the dark palette", "lets the label wrap rather than run off the screen", "is still
  one element to a screen reader, whatever wraps"; `__tests__/theme/contrast.test.ts` › "status strip
  (test) label reaches AA" and "status strip (chrome) label reaches AA", in both themes, read from the
  component's tone table. Checked by hand at a second review the same day: with the previous
  `TestEnvBanner.tsx` and `DebugRecordingStrip.tsx` swapped back in, eight of the ten
  `statusStrip.test.tsx` tests fail; the two that pass are the DESIGN.md scale reader and the tone
  table, which read nothing of either strip. The same review measured the label widths again from the
  bundled font's advance widths (kerning left out) and got the figures above. Not yet seen on a device:
  the new label size in both themes, and a wrapped label at the largest system text size on Android
  and iOS.
* **Not covered.** The lock screen covers the strip on purpose; it is back the moment the app is
  unlocked. Sheets and dialogs drawn in a system modal - the box switcher, a box's overflow menu, the
  alias editor, the term picker, the paid-send confirmation and the app's own dialogs - sit above the
  strip while they are open. The launch screen and the diagnostics consent come before the navigator
  in a session (consent cannot be taken back to unanswered), and a recording does not survive a
  restart, so no recording can be running on either. On a phone with a status bar the strip's touch
  area includes the status-bar inset, which is what makes it a full 48 dp target; whether iOS delivers
  a tap in that inset to the app has not been checked on a device, and if it does not, the target is
  the 28 dp row alone (25 dp until 2026-09-15).

## Out of scope

Automatic upload of any kind. Crash-time capture (that is telemetry's job). Remote enablement.
Anything that makes a bundle leave the phone without a human choosing the destination.

## Constitution

* **I** - recording is an array append, and the file write is native. Until 2026-09-14, stopping a
  recording ran fflate `zipSync` at level 9 and a per-character base64 loop in one synchronous stretch
  on the JS thread, over a trail of up to 4 MB. *(Corrected earlier: this first said the zip was off
  the JS thread too.)* **Closed in code (2026-09-14):** `zipBundle` streams the trail through fflate's
  `Zip` and `ZipDeflate` in slices of at most 16 KB and yields to the scheduler after each, and
  `toBase64Async` encodes 48 KB slices with `btoa`, yielding between them (`debugBundle.ts`). fflate's
  own async API is not an option: its browser build, the one Metro bundles, uses a Web Worker, which
  React Native does not have. Measured under `node --jitless` as a stand-in for Hermes, on a shared and
  loaded machine - a proxy, not a device figure: one `zipSync` over a 4.2 MB Full-shaped trail held the
  thread for 2.2 to 7.0 s across runs; in 16 KB slices the median turn took 9-10 ms and the 95th
  percentile 13-15 ms, for an archive 0.02% larger. Because the app now keeps answering while a bundle
  is saved (`debugController.ts`, `DebugScreen.tsx`): a second stop of the same recording is handed
  the write already under way; a recording started meanwhile keeps its own buffer, and stopping it
  stops it, its bundle written once the one before it is on disk; the Debug screen says "Ukládá se…"
  on a busy button, and a Debug screen opened again during a save shows the same and then how the save
  ended. *(Corrected 2026-09-15: this said "both buttons busy". Until that day a disabled "Zahodit
  záznam" stayed beside it through the save, over a recorder that had already stopped; the recording
  controls now go at the stop press - see V.)* Evidence: `__tests__/services/debugBundle.test.ts` › built without holding the JS
  thread (the archive unzips to the same members, byte for byte, as one `zipSync`; the work yields
  while compressing; an entry larger than a slice is sliced; characters stay whole where slices meet;
  a compression error rejects; base64 is exact on both sides of every slice boundary and yields;
  `writeBundle` yields all the way to the write and writes the same archive),
  `__tests__/services/debugController.test.ts` (including "stops a recording started during the last
  save, instead of handing it that save" and "writes a bundle only once the one before it is on
  disk"), and `__tests__/app/debugScreen.test.tsx` › "says it is saving while the bundle is written,
  and a second press does not write it twice", "follows a save still being written when the screen is
  opened again during it". Checked by hand the same day: a sliced bundle passes Info-ZIP `unzip -t`
  and Python's `zipfile`, and its `log.ndjson` extracts byte-identical to the NDJSON it was built from.
* **Reviewed 2026-09-14.** The first version of the non-blocking save handed ANY stop that arrived
  during a save the save already running. Leaving the Debug screen mid-save and opening it again
  showed "Spustit záznam" over that save; a recording started and stopped there kept running behind a
  screen that said it had stopped, and its trail was never written. Both fixed as described above. The
  same review found that bundles are named after the minute they were stopped, so a second recording
  stopped within the same minute was written over the first; it is now saved as `…-2.zip`
  (`writeBundle`; `debugBundle.test.ts` › the file on disk › "never replaces a bundle stopped in the
  same minute").
* **Reviewed 2026-09-15 - one archive at a time, proved where it matters.** The review asked that a
  second save started while one is still compressing be refused or queued, never interleaved. It
  already was, since the review above: the Debug screen refuses it (the button is busy for the whole
  save), and the controller queues it - `stopAndWrite` waits for the save before it ahead of
  `writeBundle`, which is where the archive is built. What was missing was a test at that stage. "writes
  a bundle only once the one before it is on disk" holds the native write, which comes after the
  compression, so a queue that waited only for the write would have passed it while two archives were
  deflated turn about. `__tests__/services/debugController.test.ts` › "never builds two archives at
  once: a save stopped mid-compression waits for the one before it" watches fflate's pushes, stops a
  second recording while the first archive's log has provably taken a slice and not been closed, and
  requires every push of the first archive, and its write, before the second archive's first push.
  Checked by hand 2026-09-15: with the controller's wait removed, the test fails at that ordering. No
  code changed for this.
* **II** - a failure in the recorder can never break the app it is watching. Same rule as telemetry.
  **Closed in code (2026-09-15) - the saved files:** `listBundles` returned no bundles on any error, so
  a folder that could not be read was shown as "Zatím tu nic není." over files that were there, with
  nothing to try again with, and a bundle whose stat failed was dropped from the list without a word -
  a file that may hold the user's mail, hidden from the one screen that deletes it. `listBundles` now
  rejects when the folder cannot be read (a folder that does not exist yet is still no bundles), and
  keeps a bundle whose stat fails with its size and time unknown, ordered by the minute in its name so
  the oldest-first order under V still holds (`debugStore.ts`). `deleteAllBundles` rejects rather than
  report a folder it could not read as cleared. The Debug screen shows the saved files in three states:
  a blank row until the first read answers (an unfinished read is not "empty" either), a localized
  "Uložené soubory se nepodařilo načíst." with "Zkusit znovu", or the list, where a file of unknown size
  says "Velikost se nepodařilo zjistit" and can still be shared and deleted. Only the newest read of the
  folder may set the list, so the read the screen opens with cannot answer after a save's own read and
  take the new file out again (`DebugScreen.tsx`). Evidence: `__tests__/services/debugStore.test.ts` ›
  listing the saved bundles › "rejects when the folder cannot be read, rather than calling it empty",
  "rejects when it cannot tell whether the folder is there", "keeps a bundle whose size cannot be read,
  with the size unknown", "orders a bundle with no readable time by the minute its name was stopped in",
  "refuses to report every bundle deleted when the folder could not be read";
  `__tests__/app/debugScreen.test.tsx` › the saved files › "are not called empty before the folder has
  been read", "say they could not be read, not that there are none, and are read again when asked",
  "list a file whose size could not be read, still to be shared or deleted", "keep the file a save just
  wrote when an older read of the folder answers after it". Checked by hand 2026-09-15: every one of
  these fails against the code before this change (`6380507`), and the last one also fails with only
  the newest-read check removed from the new screen. Not yet seen on a device: the could-not-read row
  (hard to provoke, since the app's own documents folder is normally readable) and a file of unknown
  size.
  **Review, 2026-09-15 - deleting:** `deleteBundle` swallowed every failure of the native delete, so
  "Smazat" on a file the phone would not delete closed the dialog and left the row in place without a
  word - a tap that seemed to miss, over a file that may hold the user's mail. It now rejects when the
  file is still there after the delete; a file already gone is still deleted as far as anyone needs to
  know. The Debug screen puts "Soubor se nepodařilo smazat." in the notice, where a screen reader hears
  it, and reads the folder again either way, so the list shows what is really there
  (`DebugScreen.tsx`). `deleteAllBundles` tries every bundle before it rejects with the first failure,
  rather than keeping the rest because one would not go. Evidence:
  `__tests__/services/debugStore.test.ts` › deleting a saved bundle › "rejects when the file is still
  there after the delete, and not when it is already gone", "deletes every bundle it can before saying
  one would not go"; `__tests__/app/debugScreen.test.tsx` › the saved files › "say a file could not be
  deleted, and go on listing it". Checked by hand 2026-09-15: all three fail with the store and screen
  from before this review (`6b2265d`). Not yet seen on a device: a delete the phone refuses, which is
  hard to provoke in the app's own documents folder.
  **Review, 2026-09-15 - a failed retry, a read that never answers, and the dialog:** three more places
  where the saved files and the delete dialog left a person without an answer. A retry of the folder read
  that failed again put back the very words it had replaced, so nothing on the screen changed, nothing was
  announced, and "Zkusit znovu" looked like a press that had missed. A read that never answered left the
  row blank for as long as the screen stayed open. And the app's dialog - the one that asks before a
  bundle is deleted, and sixteen others - had no scroll and no bound on its words, so at the largest text
  sizes a long title or message pushed its buttons below the bottom of the screen: back and a tap on the
  dim still closed it, but the choice it asked for could not be made.
  `listBundles` now rejects with `BundleListTimeoutError` when the folder has not answered within
  `LIST_TIMEOUT_MS`, five seconds - three orders of magnitude above the milliseconds a listing of the
  app's own documents folder takes - and clears its timer when the read settles first; an answer that
  comes after that is dropped, and the person asks again (`debugStore.ts`). The Debug screen counts the
  failed reads in a row and puts the attempt into the words: "Uložené soubory se nepodařilo načíst." the
  first time, "Uložené soubory se nepodařilo načíst ani na 2. pokus." the next. A read not answered yet
  and a failed one share one row and one caption, an Android live region from the start, so TalkBack reads
  the words when they arrive and each time they change; VoiceOver is told with `announceForAccessibility`,
  on iOS only, as the notice is. While a retry reads, its button is busy: a spinner over the label, which
  keeps its room so nothing beside it rewraps (`DebugScreen.tsx`). The dialog now holds its title,
  subtitle and message in a scroll view that gives up height, every box from the dim down to it can give
  way, and its buttons sit outside the scroll and never give way. The dim keeps the same margin above and
  below, 24 dp past the larger system bar, so a dialog that fits is centred where it always was; the scroll
  does not bounce words that fit, and flashes its indicators once when they do not (`src/theme/Dialog.tsx`).
  At the default text size every dialog is drawn with the metrics it had. Evidence:
  `__tests__/services/debugStore.test.ts` › listing the saved bundles › "gives up on a folder that does not
  answer in time, and only on one that does not"; `__tests__/app/debugScreen.test.tsx` › the saved files ›
  "say so in new words, heard by a screen reader, each time reading them again fails again", "stop waiting
  for a folder that never answers, and say they could not be read", "show a read still running after
  "Zkusit znovu" as busy, and let it go when the read ends"; `__tests__/theme/dialog.test.tsx` › at the
  largest text sizes (Jest's font scale of 2) › "scrolls the words and keeps every button out of the
  scroll", "gives the words the height the buttons leave, and the buttons all of theirs", "keeps the card
  clear of the status bar and the home indicator, centred where it was", "does not bounce words that fit,
  and shows once that words that do not fit go on"; › at the default text size › "is drawn with the
  metrics it had before its message could scroll". Checked by hand 2026-09-15 against the code before this
  change (`5e03e03`): the store test fails on the old store; the three screen tests fail on the old
  screen, strings and store - two at the status caption the old row does not have, one at the missing
  spinner - and a scratch run of the old screen, read through its own testIDs, showed the defects
  themselves: after a failed retry the rendered tree was unchanged and nothing was announced, a read held
  unanswered was still a blank row after 60 s, and a retry still reading had no spinner, only a disabled
  button. The four large-text dialog tests fail against the previous dialog, which has no scroll view, and
  the metrics test passes against it. Jest has no layout engine, so the dialog tests check the contract
  Yoga lays the dialog out by, not where a button lands. Not yet seen on a device: at the largest text
  size on Android (200 %) and on iOS (the largest accessibility size), the Debug screen's delete dialog
  over a long file name, the box-removal dialog, and `backup.leave`, the one dialog with three buttons -
  the buttons on the screen, the words scrolling, the indicators flashing once; the same dialogs unchanged
  at the default size, in both themes; and the busy retry and the "ani na 2. pokus" words as TalkBack and
  VoiceOver read them, which needs a folder read that fails and is hard to provoke in the app's own
  documents folder.
  **Review, 2026-09-15 - the saved files, once more:** two gaps that change left, closed in code and
  tests. The folder is read again straight after the notice about a save or a failed delete is
  announced, and on iOS an announcement cuts off the one before it: a read that failed then was heard
  over the notice, and the person never learnt that their file had been saved. The failure words are
  now queued behind what VoiceOver is saying (`announceForAccessibilityWithOptions` with `queue`);
  TalkBack already queues a polite live region. And "Zkusit znovu" was busy only while the read its own
  press began was out: a save that ended during a retry read the folder again, and the retry's read,
  answering first, handed the button back idle over the newer read. The button is now busy while the
  newest read is out, which `LIST_TIMEOUT_MS` always ends (`DebugScreen.tsx`). The repeated-failure test
  now reads the words from the `debug-saved-failed` row the old screen also draws, so it fails there on
  what the row says rather than on a missing testID, and an Android test pins the live region with
  nothing announced a second time. Evidence: `__tests__/app/debugScreen.test.tsx` › the saved files ›
  "say so in new words, heard by a screen reader, each time reading them again fails again", "change
  their words in a live region on Android, and leave the reading to TalkBack", "stay busy while a newer
  read of the folder is out, not only the one "Zkusit znovu" began"; › a screen reader › "hears on iOS
  that a save ended, and then that the folder could not be read, not one over the other". Checked by
  hand 2026-09-15: the two iOS tests fail against the screen before the queued announcement (`60e0af7`),
  the busy test against the screen before its fix (`122f035`), and all four against the code before the
  screen polish (`5e03e03`); the Android test passes on `60e0af7`, whose live region it pins. **Not
  covered:** a read that fails after one that succeeded - after a save or a delete - draws the failed
  row new rather than changing the words of a live region TalkBack already knows, so on Android it may
  not be read out; VoiceOver is told either way. Not yet seen on a device: a save followed by a failed
  read with VoiceOver on, both sentences heard in order, and the retry staying busy through a save.
  **Review, 2026-09-15 - busy, heard as busy:** `PressScale` had one way to say that a button's action
  was running, `disabled`, and a screen reader said what `disabled` means: unavailable, a button that is
  not coming back, while the save or the read it had started was about to end. It now takes `busy`. A
  busy button still swallows the press and does not dip under the finger, and it is announced busy
  (`accessibilityState.busy`) and not disabled, even where nothing else could be done while it runs;
  `Pressable` announces its own `disabled` as unavailable whatever the state says, so a busy button is
  not handed it. `disabled` stays for a button that cannot be taken now, heard as unavailable, and busy
  wins over it and over a blocked button's refusal (019). The Debug screen's save and "Zkusit znovu" pass
  `busy`, and so does every other button that shows its own action running: "Odemknout", the sign-in,
  code and re-authentication buttons, the message download and both send buttons (`src/theme/PressScale.tsx`
  and its callers). Evidence: `__tests__/theme/pressScale.test.tsx` › a busy button › "stays silent - the
  spinner is the answer - and does not dip under the finger", "is heard as busy, not as unavailable",
  "busy WINS over blocked - nobody is scolded for a race", "is heard as unavailable only when it is:
  disabled and not running"; `__tests__/app/debugScreen.test.tsx` › while recording › "says it is saving while the bundle is
  written, and a second press does not write it twice", "follows a save still being written when the
  screen is opened again during it", › the saved files › "show a read still running after "Zkusit znovu"
  as busy, and let it go when the read ends", "stay busy while a newer read of the folder is out, not only
  the one "Zkusit znovu" began" - the last four asserted disabled until this review. Checked by hand
  2026-09-15: all eight fail against `PressScale` and the Debug screen before it (`7d41e20`); the suites
  of the other callers pass unchanged. ~~**Not covered:** the backup screen's buttons that start a backup
  and a restore still pass `disabled` while their own run shows "Pracuji…", and are heard as unavailable;
  that screen was outside this review.~~ *Closed 2026-09-24:* "Zálohovat nyní" passes `busy` while any
  backup runs, and "Obnovit" while any restore runs (006 T030; `src/app/settings/BackupScreen.tsx`).
  Test: `__tests__/app/backupButtonsBusy.test.tsx` › a button whose own run is going, both failing
  against the screen before the change. Not yet heard on a device: a busy save, "Zkusit znovu" and
  "Odemknout" with TalkBack and with VoiceOver.
* **III** - no backend, no upload, credentials never recorded. The mail in a Full bundle is the
  user's own, on the user's own device, released by the user's own hand.
* **IV** - read-only with respect to the archive. Recording never writes to it.
* **V** - nothing moves when something finishes. **Closed in code (2026-09-15), found by review:**
  when a save ended, the Debug screen drew its notice ("Uloženo: …") for the first time, above the
  saved files, and pushed them down a caption line; on the screen where stop was pressed, the
  recording's status line, hint and disabled "Zahodit záznam" went at that same moment, long after
  the press, and pulled them up. The notice now keeps two caption lines reserved at the reader's text
  size whether or not it has anything to say, and is hidden from screen readers while empty - two lines
  because a saved file's name is 318 dp in Public Sans Medium 12 against the 324 dp a 360 dp phone
  leaves it. The screen reads the recorder's own state (`useDebugRecording`, the hook the strip uses),
  so the recording controls go at the stop press, the mirror of the start press bringing them, rather
  than when the save ends. When a save ends or the share sheet fails to open, only the notice's words
  change (`DebugScreen.tsx`). Evidence: `__tests__/app/debugScreen.test.tsx` › when a save ends ›
  "moves nothing above the saved files" and "moves nothing on a Debug screen opened again while the
  save is still being written" (each compares the layout of every element above the saved files while
  the save runs and after it ends), "holds the notice s two lines at the reader s text size before
  there is anything to say"; and › while recording › "says it is saving while the bundle is written,
  and a second press does not write it twice", which now requires the recording controls gone during
  the save. Checked by hand 2026-09-15: the two layout tests fail against the previous screen with
  only its `debug-controls` testID added, at the layout comparison. Not yet seen on a device.
  **Second review, the same day:** the notice was not the only thing a finished save moved. The saved
  files were listed newest first, so the file a save wrote took the first row and pushed every file
  already listed down a whole row - taller than the notice's line, at the same moment, under the same
  finger. `listBundles` now lists oldest first, so a new file joins the end of the list and the files
  above it stay put (`debugStore.ts`). Evidence: `__tests__/app/debugScreen.test.tsx` › when a save
  ends › "adds the new file after the saved files, so none of them moves", which fails against the
  newest-first order. *(Corrected 2026-09-15: this recorded the recording counter as not covered. It is
  closed - next paragraph.)*
  **Closed in code (2026-09-15) - the recording counter:** "Zaznamenává se · 2 záznamy · 1 kB" is one
  caption line whose words grow while a recording runs - 192 dp in Public Sans Medium 12 at the start,
  238 dp at "4000 záznamů · 1024 kB", against the 308 dp a 360 dp phone leaves it - so at roughly 130 %
  to 160 % text it took a second line part-way through a recording and moved the hint, the discard
  button and everything under them down. Moved to the Caption role's 13 pt (below), the same counters
  measure 208 and 258 dp and the window is about 119 % to 148 %. The row now holds an invisible reserve,
  hidden from screen readers, and lays the live counter over it with absolute positioning, so the live
  words take no room and however they grow nothing else on the screen can move. The reserve is
  "Zaznamenává se · 88888 záznamů · 88888 MB": word for word at least as wide as any counter the recorder
  can reach, because Public Sans' digits are not equally wide (an 8 is 8.5 dp at 13 pt, a 1 is 5.4, so
  "3888" is wider than "4000") and "MB" is wider than "kB". The fifth digit is margin against the
  kerning and hinting the measurement leaves out. The cost: on a 360 dp phone the reserve takes two
  lines from about 108 % text in Czech, so between about 108 % and 148 % a one-line counter sits above
  one empty caption line. The dot sits in a box one caption line tall at the reader's text size, beside
  the first line (`DebugScreen.tsx`). Evidence: `__tests__/app/debugCounterReserve.test.ts` (widths read
  from the bundled `PublicSans-Medium.ttf` by `__tests__/helpers/fontMetrics.ts`, kerning left out) › "is
  word for word at least as wide as any counter the recorder can reach (cs)" and "(en)" - every entry
  count to `MAX_ENTRIES` and every size label under `MAX_BYTES` - "holds the counter s largest figures,
  not only the widest glyphs", "takes as many lines as the longest counter at every text size, on a
  360dp phone" (which also measures the jump: at 130 % the starting counter takes one line and a later
  one two); `__tests__/app/debugScreen.test.tsx` › the recording counter › "lays its growing words over
  room held by the longest counter, taking none of its own", "keeps the dot beside the first line at a
  large text size, however many lines the room takes" (at Jest's font scale of 2). Checked by hand
  2026-09-15: all six fail against the code before this change; a naive reserve of "4444 záznamů · 4444
  kB" fails both word-for-word tests on "4444" and "kB" - the line-count test still passes with it, so
  the word-for-word tests are the ones that guard the reserve, and the line-count test shows the jump.
  Not yet seen on a device: the counter at the largest text size on Android and iOS, with the dot beside
  its first line.
  **Review, 2026-09-15 - the line breaker:** a reserve that is word for word at least as wide takes at
  least as many lines only under a breaker that fills each line while the next word fits, which is the
  breaker the tests measure with. Android does not break text that way by default: React Native's
  `textBreakStrategy` defaults to `highQuality`, which weighs the whole paragraph, and nothing proves it
  gives the reserve as many lines as the counter. iOS leaves the strategy unset, which is plain word
  wrap. Both Texts now name the greedy breaker on both platforms (`textBreakStrategy="simple"`,
  `lineBreakStrategyIOS="none"`), so the measured claim is the one the phone draws. Evidence:
  `__tests__/app/debugScreen.test.tsx` › the recording counter › "breaks the room and the counter into
  lines the way the measurement does, on Android too", which fails against the screen from before this
  review (`6b2265d`). Still measured without kerning: the reserve's fifth digit is the margin for it.
  **Screen readers (2026-09-15):** the notice changed silently. It is now an Android live region
  (`accessibilityLiveRegion="polite"`), so TalkBack reads it when its words change, and on iOS, which has
  no live regions in React Native, it is announced with `AccessibilityInfo.announceForAccessibility` -
  on iOS only, so TalkBack does not hear it twice. It is not announced when it is cleared, nor again
  when the same words are set twice in a row (a second share failure in a row). While empty it stays
  hidden from VoiceOver, where a Text is an element of its own; on Android it is no longer taken out of
  the accessibility tree, because an empty Text there is no focus stop and a view outside the tree gives
  TalkBack nothing to read when its words arrive. Evidence: `__tests__/app/debugScreen.test.tsx` › a
  screen reader › "hears on iOS that a save ended, once, and nothing when the notice is cleared", "is
  left to the live region on Android, so TalkBack does not read the notice twice". Checked by hand
  2026-09-15: both fail against the code before this change, and the Android one fails with the
  announcement made on both platforms. Not yet heard on a device: TalkBack reading "Uloženo: …" once
  when a save ends, and VoiceOver the same.
  **On the scales (2026-09-15):** the Debug screen typed its own numbers - a 9 gap in two places, 20 and
  22 margins, a 1 dp nudge, and 12 pt captions with a 16 line - against DESIGN.md's spacing of
  2/4/6/8/10/12/14/18 and a type scale whose Caption step is 13/17. Its spacing now comes from `space`
  (`src/theme/spacing.ts`, DESIGN.md's front matter as tokens: 8 gaps, 18 margins, a 2 nudge) and every
  note is the Caption role unchanged; the notice's two reserved lines are the 17 dp Caption line, and a
  saved file's name, 345 dp in Public Sans Medium 13, now takes its second line at the default text
  size on a 360 dp phone. The row buttons (share, delete, try again) are one `RowAction`. The message
  detail's header asked `useHeaderTop` for 14 under the TestEnvBanner and got 12 under a bare status bar,
  and 12 under the recording strip, which hands the screen a spent inset instead; both strips reserve one
  row so a screen under either lays out in the same place, and the header now sits `HEADER_GAP` (12,
  spacing `lg`) below whichever is above it (`src/theme/useHeaderTop.ts`). The Debug screen's test suite
  printed React act() warnings from reads of the folder that answered after a test had stopped looking;
  it now waits for the first read before it looks, and lets a held save go inside `act`, and prints
  none. Evidence: `__tests__/app/debugScreen.test.tsx` › on DESIGN.md s scales › "names every spacing on
  the Debug screen from the scale and draws every note at the Caption step" (a source scan against the
  scales read from DESIGN.md), and › when a save ends › "holds the notice s two lines at the reader s
  text size before there is anything to say", now at the 17 dp line; `__tests__/theme/useHeaderTop.test.tsx`
  › "is the same below the status bar, below the test banner and below the recording strip", "takes that
  gap from DESIGN.md s spacing scale"; `__tests__/theme/spacing.test.ts` › "are the steps DESIGN.md names,
  with the values it gives them". Checked by hand 2026-09-15: the scale scan, the notice test and both
  header tests fail against the code before this change. *(Corrected 2026-09-15: this recorded the
  settings furniture the Debug screen sits in as not covered. It is closed - next paragraph.)* The
  intro's 13/19 prose and the 11 dp corners of the row buttons are the same shared settings style, stay
  with it, and were outside that review. Not yet seen on a device: the Debug screen at its new spacing and
  caption size, and the message detail's header under the test banner.
  **Closed in code (2026-09-15) - the settings furniture:** `Section`, `CardRow` and `SubScreen` build the
  Settings, Backup, Transfer and Debug screens, and `SubScreen` also frames help and the licences. They
  typed numbers of their own, and each was checked against DESIGN.md, which records the design. Kept,
  because the design specifies them, and now named after the record they come from: the section label's
  Public Sans Bold 12, uppercase, 0.4 letter-spacing and faint ink - the 009 design's label
  (`specs/009-visual-redesign/design-system.md` §2), which DESIGN.md did not record until this change
  added it under Components › Settings sections - the 13 dp vertical row padding (DESIGN.md › Layout, "Row
  padding is 13 vertical") and the 16 dp sides of settings scroll content (DESIGN.md › Layout). ~~Moved,
  because no record of the design has them and they sit off the spacing scale: `Section`'s 9 dp gap under
  its label is now the `base` step (8) and its 22 dp margin the `gutter` (18), which is what the Debug
  screen already leaves between the same groups.~~ *(Corrected 2026-09-15: kept too - the review after
  this paragraph.)* The row's 14 and 10 and the label row's 6 and 4 were
  already steps, and are named through `space`. `SubScreen`'s bottom was a bare 28, short by the whole
  gesture bar on every phone that has one; it now comes from `useContentBottom`, the one source DESIGN.md
  names for a screen's bottom padding, with the 28 gap Settings itself ends on, and a caller's own bottom
  padding (the licence text's 32) is a gap above the inset too (`src/app/settings/SettingsSection.tsx`,
  `SubScreen.tsx`). What a person sees: ~~each section on the four screens ends 4 dp closer to the next and
  its card sits 1 dp closer to its label, and~~ a sub-screen's last row ends clear of the gesture bar. The
  Claude Design file itself was not opened for this; DESIGN.md and the 009 import record are what was
  checked. Evidence: `__tests__/app/settingsFurniture.test.tsx` › what DESIGN.md says about the furniture
  › "is there to be read, so nothing below passes against a number it does not state"; › a section ›
  ~~"sits its card a `base` step under the label and the next section a `gutter` under it"~~ (corrected
  below), "draws its
  label as the design does, which DESIGN.md records"; › a card row › "pads as DESIGN.md pads a row and a
  card, with a `md` step between what it holds"; › a sub-screen › "ends its content above the home
  indicator, where Settings ends", "takes a screen s own bottom padding as its gap above the home
  indicator, not instead of it"; › on DESIGN.md s scales › ~~"types no spacing of its own in the settings
  furniture"~~ (replaced below). Checked by hand 2026-09-15 against the components before this change (`5e03e03`): six of
  the seven fail - the section spacing, both sub-screen tests and the scan at the components, and the
  DESIGN.md reader and the label test at the record DESIGN.md did not have yet. The card row test passes
  there: the card row's values did not change, and it and the label test pin values that were kept. Not
  yet seen on a device: the Settings, Backup, Transfer and Debug screens ~~at the new section spacing~~, in
  both themes, and the end of a sub-screen above the gesture bar on a phone that has one.
  **Review, 2026-09-15 - a section's 9 and 22, and two tests that read source text:** the pass above
  moved `Section`'s gap from 9 to 8 and its margin from 22 to 18 because no record of the design names
  them, and so moved every section on the Settings, Backup, Transfer and Debug screens. A value no record
  names is unrecorded, not wrong, and a value the design draws is not changed to fit a scale. Both records
  were read again for this pattern: DESIGN.md › Layout gives the spacing rhythm, the gutters and the row
  padding, and › Components › Settings sections the label alone; `specs/009-visual-redesign/design-system.md`
  §2 gives the label, and §3's component metrics name no section spacing. Neither records another number,
  so the gap is 9 and the margin 22 again - what `Section` drew from the first commit until that pass -
  named in `SettingsSection.tsx` as the design's. Two assertions in the furniture's tests read source
  text: the 28 of `useContentBottom(28)` in `SettingsScreen.tsx`, and a scan of `SettingsSection.tsx` and
  `SubScreen.tsx` for typed spacing numbers. Both are rendered now, and no source scan is left: Settings
  itself is rendered with and without a gesture bar, and a sub-screen must end where it ends in both;
  every spacing drawn by a section with an icon and one without, a pressable row and a last row is a step
  or a value DESIGN.md records, with 9 and 22 allowed only on a section's own box; and a sub-screen draws
  no spacing but its content padding. Evidence: `__tests__/app/settingsFurniture.test.tsx` › a section ›
  "sits its card 9 under the label and the next section 22 under it, as the design draws them"; › a
  sub-screen › "ends its content above the home indicator, where Settings ends"; › on DESIGN.md s scales ›
  "draws nothing in a section, card or row but a step or a value DESIGN.md records, past a section s own 9
  and 22", "draws no spacing in a sub-screen but its content padding". Checked by hand 2026-09-15 against
  the furniture before this review (`7d41e20`): the section test and the section scan fail there; the two
  sub-screen tests pass, as the assertions they replace did, because what they check did not change.
  **Not covered:** DESIGN.md still records no number for a section's gap or margin, and the Claude Design
  file was not opened to confirm it draws 9 and 22. Not yet seen on a device: the four screens with their
  sections back at 9 and 22, in both themes.
* **VI** - the screen describes what the bundle contains, in the two languages the app ships. Its
  entry counter said "záznamů" for every number until 2026-09-14; it now takes the form Czech uses for
  the count - 1 záznam, 2 záznamy, 5 záznamů (`__tests__/i18n/czechAgreement.test.ts`, and
  `__tests__/app/debugScreen.test.tsx` › "counts entries in the form Czech uses for that number").

## Device walk, 2026-09-15

On the `Obalka_Demo` emulator (Android, x86_64 debug build over an existing archive): recording started from
the Debug screen, the recording strip showed on Settings and on the inbox and opened the Debug screen when
tapped (FR-007), and "Ukončit a uložit" wrote `obalka-debug-2026-09-15-1847-standard.zip` (800 B), listed
with Sdílet and Smazat. **The file write is walked.**

**Sharing it failed:** "Sdílení se nepodařilo otevřít." `shareBundle` called react-native-blob-util's
`android.actionViewIntent`, which is ACTION_VIEW - "open this zip with an app" - although its comment said
ACTION_SEND. A phone with no zip viewer has nothing to open it with, so sharing had failed on every such
phone since 2026-09-10, and a phone with one would have opened the bundle rather than sent it. No unit test
could see it: the test mocked the call it was checking for.

Fixed the same day. Sharing on Android now goes through the app's own `ShareFileModule`
(`android/app/src/main/java/com/obalkadatovaschranka/share/`): ACTION_SEND with the zip's MIME type through
the system chooser, the file handed over as a content:// URI from the FileProvider react-native-blob-util
already registers, read access granted only to the app the user picks. React Native's `Share` cannot attach
a file on Android and blob-util has no send call, so the module is the smallest way; it has no network code,
and `__tests__/services/debugNoUpload.test.ts` now checks that too, and that `debugStore.ts` no longer calls
`actionViewIntent`. iOS is unchanged (`presentOptionsMenu`, which is the share sheet there). Tests:
`__tests__/services/debugShare.test.ts` (Android sends through the module with its title and never opens the
file; a build without the module rejects so the screen can say so; a refusal from the sheet is passed on; iOS
uses the options menu), which fail with the old `actionViewIntent` call put back. **Walked again after the
fix:** Sdílet opened Android's chooser (`com.android.intentresolver`) for the bundle.

