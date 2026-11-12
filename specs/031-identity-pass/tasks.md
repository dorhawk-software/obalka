# Tasks: The identity pass

**Feature**: `031-identity-pass` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)
**Canvas**: <https://claude.ai/artifact/NXmjzrevs3JuX9N7H71QbL>

## Phase 0: The canvas's own leftovers

- [x] T001 Board titles carried variant labels after the pick: "Icon set - A plane / B offset print" is now
  "Icon set - offset print", "Inbox A - the envelope front" is "Inbox - the envelope front" (title and
  `<title>`). Canvas version 19, 2026-11-12.

## Phase 1: The inventory, from the code (2026-11-12)

Built from `src/app/AppNavigator.tsx`, `src/app/`, `src/features/*/screens`, the native launch and icon
resources and the notification code; today's screens captured on the clean `Obalka_Demo` AVD with the
demo archive. Each line is graded against the canvas and `visual-craft.md`:

- **M** matches: compared from a capture or a board, and already holds the identity.
- **N** not seen: nobody has looked at it in the identity yet. Never graded "matches" from the code
  alone (practices 1.3.1, "An inventory that misses nothing"); each goes on a board or is captured.
- **D** drifts: the agreed canvas or a rule below says exactly what changes; build it.
- **X** misses the identity: needs a redraw on the canvas first (board R1-R8 in plan.md).

A line is checked when it is "matches" walked in both themes and both languages, or "fixed" built and
captured. Rules referred to by the lines:

- **(icons)** a Lucide glyph that speaks about post becomes its offset glyph; plain controls stay Lucide.
- **(avatar)** a box avatar takes the envelope silhouette; a sender tile's sealed flap means unread.
- **(cards)** resting cards and buttons: tone or hairline, the owner's pick Q3 (plan.md).
- **(rm)** every motion yields to Reduce Motion.

### The proof (practices 1.3.1, "An inventory that misses nothing")

Re-checked 2026-11-12, after the owner asked where the modals were. The first list (I01-I83) was
written by reading; it missed whole kinds of surface and graded 15 lines "matches" without a picture.

- **Sweep.** All 88 UI files (`git ls-files 'src/**/*.tsx'` without tests) map to lines below; every
  string group in `src/i18n/strings.ts` (cs and en) maps to its screen's lines.
- **Counts, equal to the code.** `<Dialog`: 22 uses in 10 files, one line each (I84-I105).
  `BottomSheet`: 4 (Language, What's new, Term picker, Sender). Own `Modal`s: 4 (box switcher, box
  menu, alias editor, paid-send confirmation). `Alert.alert`: 0. Snackbar texts: drafts and backup
  (I60.1-I60.2). Banners and strips: inbox strips, fiction, test environment, debug recording,
  "alerts off", deadline suggestion.
- **Second inventory.** A fresh agent built one from the code without seeing this list (216 items,
  eight headings). Compared line by line on 2026-11-12: everything it had that this list lacked is
  now a line below (I84-I139 and the splits marked with a dot). What it lacked is not in the code
  yet: the agreed motion (I67-I70) and the typesetting found on the boards (I82, I83).

### Shell and first run

- [ ] I01 iOS launch screen (`LaunchScreen.storyboard`, logo 96 on paper, both appearances) - **M**: the
  logo is the envelope mark (captured 2026-11-12, `cap/00`).
- [ ] I02 Android launch (no splash theme; the system splash shows the adaptive icon on #2563A6) - **N**.
- [ ] I02.1 Before the settings load: a blank view on the paper colour (`App.tsx` 178-186) - **N**.
- [ ] I03 JS `LaunchScreen` (loading: logo 84 + name + platform spinner; failed: retry) - **X**: a generic
  spinner where the product waits. R8.
- [ ] I04 `Welcome` (logo tile 120, Hero title, add box, restore, language, FAQ) - **X**: the envelope's
  biggest moment has no object. R1.
- [ ] I05 FAQ overlay and `FaqScreen` (accordion cards, Overline groups) - **D** (cards).
- [ ] I06 `TelemetryConsent` (first run after the first box; two cards, two buttons) - **D** (cards).
- [ ] I07 `BackupScreen` first run (restore) - see I45.
- [ ] I08 `AddBoxForm` - **D** (cards); the busy spinner is R8.
  - [ ] I08.1 Method step: three radio cards, Advanced (chevron, no animation), environment segmented,
    the "i" help, FAQ link, Continue.
  - [ ] I08.2 Credentials step: method chip, login name, password or code with the eye, Mobile Key
    help, the OTP suggestion, alias, submit, busy, blocked (login name, password).
- [ ] I09 `OtpForm` (code field, sending/sent notice, resend, blocked) - **N**.
- [ ] I09.1 Android's SMS User Consent sheet over the code field (the system's) - **N**: seen in place.
- [ ] I10 Mobile Key waiting (brand tile 84, phone glyph, pulse ring loop 1800 ms) - **X**: a generic
  pulse. R8.
- [ ] I11 Sign-in `ErrorView` and `OtpSuggestion` (retry with `depth.sm`) - **D** (cards); R8.
- [ ] I12 `ReauthForm` (avatar, method cards, field) - **D** (avatar, icons: Zámek).
- [ ] I13 `ChangePasswordForm` (avatar 46, three fields, ten rules and the history rule, busy) - **D**
  (avatar, icons).
  - [ ] I13.1 Its error banner: wrong password (with the portal), refused, network, timeout, not
    saved, server fault - **N**: R8.
  - [ ] I13.2 Its done state (check, until a date or no expiry, "everywhere", close) - **X**: R8.

### Messages

- [ ] I14 Inbox header, one box (avatar 36, name, identity line, search, segmented) - **D**: board
  "Inbox - the envelope front" (flap band, window switcher, segmented on blue).
- [ ] I15 Inbox header, all boxes (Layers tile, subtitle) - **X**: R5.
- [ ] I16 Inbox strips: reauth, password expiry, unified missing, stale, offline - **X**: not drawn under
  the envelope header. R5.
- [ ] I17 Attention block and its rows - **D**: board Inbox (sheets with the second envelope's edge,
  flap tiles, fiction chip with the offset glyph).
- [ ] I18 Received rows and month sections - **D**: board Inbox (day numeral, small sender tile, offset
  attachment and reminder glyphs).
- [ ] I19 Sent rows (delivery state per row) - **X**: no board. R5.
- [ ] I20 List loading (6 skeleton rows) and the 3 px sync bar - **X**: under the new header. R5.
- [ ] I21 List error (CloudOff hero 132, reason, retry) - **X**: R4.
- [ ] I22 Empty received - **D**: board "Empty inbox - the inside of the envelope".
- [ ] I23 Empty sent (paper-plane hero) - **X**: R4.
- [ ] I24 Empty, needs a new sign-in (CloudOff hero, "Zprávy zatím nejsou k dispozici") - **X**: R4.
- [ ] I25 Cross-box line ("Jinde: …") - **D**: board Inbox ("V ostatních schránkách …", Schránky glyph).
- [ ] I26 Freshness line at the list's end - **D**: board Empty ("Naposledy dnes ve 14:02").
- [ ] I27 Drafts entry above the list - **X**: R5.
- [ ] I28 Compose FAB (gold extended, pencil) - **D**: the blank stamp, board Inbox.
- [ ] I29 Message detail, received - **D**: boards "Message - the envelope it came in" and "Message - dark".
- [ ] I30 Message detail, sent (recipient card, delivery timeline) - **X**: R7.
- [ ] I31 Detail loading skeleton and error - **X**: R7.
- [ ] I32 Fiction banner - **D**: board Message (gold band with "Připomenout").
- [ ] I33 Delivery record (Doručenka card, dotted rail) - **D**: the slip, board Message.
- [ ] I34 Term card, "alerts off" line, deadline suggestion (scan) - **X**: not on a board. R7.
- [ ] I35 Attachments: none, unavailable, downloading, not downloaded, missing, corrupt, opening, saved -
  **D** for the saved row (board Message); **X** for the other states, R7.
- [ ] I36 Signed original (ZFO) row - **D**: board Message (Pečeť glyph in a well).
- [ ] I37 Test-environment banner (`StatusStrip` test tone, flask) - **X**: the airmail strip. R7.
- [ ] I38 Compose - **X**: the envelope you are sending (R2, agreed A).
  - [ ] I38.1 Sender gate (no box can send; dimmed placeholders).
  - [ ] I38.2 Sender card and the change; recipient card, its type and the change.
  - [ ] I38.3 Recipient search: searching, error, none, results, the same-name hint, the hint.
  - [ ] I38.4 The stamp: free, paid, credit short with "buy credit".
  - [ ] I38.5 Subject, text and its hint (the text becomes a PDF).
  - [ ] I38.6 Attachments: rows with remove, reading with its progress and cancel, the dashed add.
  - [ ] I38.7 Footer: errors (too large, attach, PDF, sign in again, send), send busy.
- [ ] I39 Compose sent state (emblem, ID, Done, Open sent) - **D**: board "Sent - the stamp is cancelled".
- [ ] I40 Paid-send confirmation (modal, credit card tile) - **X**: R2.
- [ ] I41 Draft rows (swipe to discard, snackbar Undo) - **X**: R2 (Koncept glyph).
- [ ] I42 Search: hint, skeleton, no results, results - **X**: R4 (hint, no results), rows as I18.

### Settings and the rest

- [ ] I43 `SettingsScreen` (appearance, language with flags, lock, attachments and Wi-Fi, scan and how,
  diagnostics and Debug, backup, About: version, what's new, FAQ, licences, privacy, source) - **D**
  (cards, icons in wells: Zámek, Archiv, Přenos, Upozornění, Nastavení). R3 shows it.
- [ ] I44 FAQ entries and the delivery legend - **D** (cards; the legend's state glyphs follow I33).
- [ ] I45 `BackupScreen` - **X** for the key and QR: a slip on the security tint (R6). The rest:
  - [ ] I45.1 Backup: the toggle (loading skeleton), last, never, a running stage with its count and
    progress bar, verify, back up now - **N**: R9.
  - [ ] I45.2 Scope: documents toggle, measuring, the mode chip, auto, where, how - **N**: R9.
  - [ ] I45.3 Advanced: auto, keep, the keep-count segmented control - **D** (cards).
  - [ ] I45.4 Restore list: loading, none, rows (documents chip, size and version, too new,
    unsupported, documents missing, held), swipe to delete or its menu under Reduce Motion - **N**: R9.
  - [ ] I45.5 An opened row: key input, scan, start, delete, use the stored key - **N**: R9.
  - [ ] I45.6 File export and import; restored, notice, error; Continue - **N**: R9.
  - [ ] I45.7 First run (restore only, its own snackbars) - **N**: R9.
- [ ] I46 `TransferScreen` - **X** for the code phrase and QR: a slip (R6). The rest:
  - [ ] I46.1 Not available here (the card) - **N**: R9.
  - [ ] I46.2 Send: pick a backup (none: a link to create one), the option group, the note, send -
    **N**: R9.
  - [ ] I46.3 Receive: the description, the hint, scan, the phrase field, start - **N**: R9.
  - [ ] I46.4 Running: stage lines (preparing, connecting, waiting, receiving, applying, received),
    progress or waiting bar, cancel, keep open, the route - **N**: R8 (waiting).
  - [ ] I46.5 Ends: error, done, done with a route, Continue, stopped by going to the background -
    **N**: R8.
  - [ ] I46.6 First run, receive only - **N**: R9.
- [ ] I47 `DebugScreen` (level, start/stop/saving, counter, files: loading, failed, empty, rows with
  share and delete) - **N** (cards).
- [ ] I48 Licences (logo 40, search, no results, groups), licence group, licence text - **N** (cards).
- [ ] I49 What's new sheet and Changelog - **D**: the sheet (I53). R9.
- [ ] I50 Lock screen (brand tile 104, lock glyph, unlock, failure slot, reset link) - **D**: board
  "Lock - sealed" (tint, sealed envelope, wax seal).
- [ ] I51 QR code scanner (viewfinder, hint, cancel; camera denied; no camera) - **N**.

### Sheets, dialogs, menus

Re-graded 2026-11-12, after the owner asked where the modals were: the first grading called the chrome
here "matches" from the code alone, without a drawing. With Cards B agreed (sheets with weight) every
surface below changes too, and the owner has seen none of them in the identity. All go on board **R9**
(round 2).

- [ ] I52 `Dialog`, the anatomy (scrim .45, card max 420, radius 20, scrolling, actions in a row or
  stacked above two, primary / danger / neutral, icon) - **D**: the sheet weight from Cards B; its fade
  ignores Reduce Motion (I73). R9. Each use is a line, I84-I105.
- [ ] I53 `BottomSheet` (Language, What's new, Term picker, Sender) - **D**: the grabber, the sheet's
  surface and shadow from Cards B. R9.
- [ ] I54 Box switcher sheet, `BoxRow`, `UnifiedRow` - **D** (avatar, Schránky glyph). R5 shows it.
- [ ] I55 Box overflow menu (rename, change password, remove) - **D**: the menu's surface. R9.
- [ ] I56 `AliasEditor` (avatar preview, colour swatches) - **D** (avatar). R9.
- [ ] I57 `TermPicker` - **D** (icons: Připomínka). R9.
- [ ] I58 Sender sheet - **D** (avatar). R9.
- [ ] I59 Language sheet - **D**: the sheet (I53). R9.

### Transient surfaces

- [ ] I60 Snackbar (ink pill, gold action, 4.5 s, 10 s with a screen reader; enters 220 ms, no exit
  animation) - **N**: R9.
- [ ] I60.1 Draft snackbars: saved, discarded, Undo - **N**: R9.
- [ ] I60.2 Backup snackbars: exported, imported, verified, verify failed, prune or settings failed, "not
  stopped" - **N**: R9.
- [ ] I61 Shell notices (removal, alias - dialogs) - **D**: the dialog (I52). R9.
- [ ] I62 Debug recording strip (takes the top inset on every screen) - **N**.
- [ ] I63 Notifications: deadline reminder and password nudge (small icon `ic_notification`, colour
  #2A5C9A) - **D**: the accent becomes the envelope's #2563A6; the glyph is the envelope already.
- [ ] I64 `ic_notification_alert.xml`, referenced nowhere - **D**: delete.
- [ ] I65 App icons (iOS set, Android adaptive on #2563A6) - **N**: envelope and flap; check the flap at
  the smallest size.
- [ ] I65.1 No dark or tinted iOS icon and no Android monochrome (themed) layer - **X**: the envelope
  drawn for each; a board in R8.
- [ ] I66 Privacy covers (iOS launch storyboard, Android cover below API 33) - **N**.

### Motion

- [ ] I67 Opening a message: the letter rises out of its envelope (280 ms) - **X** build, board Motion.
- [ ] I68 Sending: the postmark lands when ISDS accepts (haptic) - **X** build, board Motion.
- [ ] I69 Unlocking: the seal breaks, the flap opens (cold start; later the flap only) - **X** build,
  board Motion; replaces today's 250 ms panel fade and 260 + 240 ms cover fade.
- [ ] I70 The window film's glint (tilt, `useAnimatedSensor`, only on screen) - **X** build, board Motion.
- [ ] I71 Edge swipe back (160 ms settle) - **N**: follows the finger; its settle ignores Reduce Motion.
- [ ] I71.1 Native-stack push and pop between screens - **N**: the platform's own; checked under
  Reduce Motion on both.
- [ ] I72 Sheets' slide-in (240 ms), the overflow menu, drag to dismiss - **N**: the slides honour
  Reduce Motion, the drag's settle (180/160 ms) does not.
- [ ] I73 `Dialog`, sheet scrims and `AliasEditor` use `Modal animationType="fade"` - **D** (rm): no
  animation under Reduce Motion.
- [ ] I74 The paid-send confirmation slides (`animationType="slide"`) - **D** (rm); R2 may replace it.
- [ ] I75 Skeleton pulse, waiting bar, sync bar - **N**: loop only while work runs. Under Reduce Motion
  the waiting bar is an empty track and the stage line beside it carries the meaning: shown on R8.
- [ ] I76 Platform spinners in 11 places - **X**: R8 decides where an object waits instead.
- [ ] I77 Press dip, refusal shake, FAB press, segmented slide, radio fill - **N**.
- [ ] I77.1 Haptics: 31 call sites (selection, light, medium, success, warning, error) - **N**: listed
  against the motion rule (a thump where paper lands).

### Icons and leftovers

- [ ] I78 The offset icon family in `src/theme/` and the map from today's Lucide wrappers (Mail, Send,
  Pencil, Search, Paperclip, ShieldCheck, Timer, Layers, Archive, Download, File and the custom
  settings glyph) - **D** build.
- [ ] I79 Hero glyphs at 132 (Mail, Send, Search, CloudOff, stroke 1.25) - **X**: R4.
- [ ] I80 `BrandHeader.tsx`, imported nowhere, with a stale TODO - **D**: delete.
- [ ] I81 Every touched screen walked in English (the longest Czech strings are on the boards).

### Typesetting (found while drawing round 1)

- [ ] I82 Czech one-letter prepositions and conjunctions (v, k, s, z, o, u, a, i) end a line today
  ("nastavení v / tomto telefonu", "až o / ně požádáte") - **X**: a no-break space after them in the cs
  strings, held by a test over `strings.ts`. The canvas boards already set it.
- [ ] I83 A number and its unit break apart ("4,2 / MB" under Záloha) - **X**: `formatBytes` and the
  size strings join them with a no-break space.

### Every dialog, by its title (22, equal to the code)

All **N**: R9 draws the anatomy once with the longest of each kind; each line is walked in both themes
and both languages when built.

- [ ] I84 `box.removeFailed.title` - kept, incomplete, unknown; close, retry (`AppShell`).
- [ ] I85 `box.aliasFailed.title` (`AppShell`).
- [ ] I86 `notif.passwordAsk.title`, the nudge before the OS asks (`AppShell`).
- [ ] I87 `vault.lost.title` - every box asks to sign in again (`VaultLostNotice`).
- [ ] I88 `lock.reset.title` - cancel, danger confirm (`LockGate`).
- [ ] I89 `box.removeTitle` - keep, danger delete with the bin (`RemoveBoxDialog`).
- [ ] I90 `detail.attachments` - no viewer, cannot open (`MessageDetail`).
- [ ] I91 `detail.original.heading` - cannot open the signed original (`SignedOriginalSection`).
- [ ] I92 `lock.unavailable.title` (`SettingsScreen`).
- [ ] I93 `lock.disableFailed.title` (`SettingsScreen`).
- [ ] I94 `settings.autoDownload.ask.title` with its option group (`SettingsScreen`).
- [ ] I95 Debug: delete a recording, titled with the file name (`DebugScreen`).
- [ ] I96 Backup: leave while working - restore, verify, default; background, cancel, stay.
- [ ] I97 `backup.off.title`.
- [ ] I98 `backup.prune.title`.
- [ ] I99 `backup.docs.ask.title` / `backup.docs.change.title` with the document mode choice.
- [ ] I100 `backup.delete.title` with the backup's date.
- [ ] I101 `backup.noLock.title`.
- [ ] I102 `transfer.outcome.title` (on the backup screen).
- [ ] I103 `backup.restore.outcome.title`.
- [ ] I104 `transfer.metered.title` - cancel, transfer anyway.
- [ ] I105 `transfer.got.title` - what came, too new, unsupported.

### Controls and shared pieces (each with its states: rest, pressed, focus, selected, disabled, busy)

All **N** unless a board shows them; R9 shows the ones no agreed board has.

- [ ] I106 `Toggle` (48 x 28, disabled .6, not animated).
- [ ] I107 `SegmentedControl` (height 34, 200 ms slide, the unseen dot) - inbox board shows it on blue;
  the backup and sign-in uses are on paper.
- [ ] I108 `OptionGroup` radios (check 140 ms).
- [ ] I109 Buttons: primary, outline, link, danger; busy and blocked (warning haptic, shake).
- [ ] I110 Text fields: rest, focus, error, the password eye, the dark keyboard.
- [ ] I111 `ScreenHeader` (min 54, back 44, two-line title, slot, hairline).
- [ ] I112 `ProgressBar` (6 px, determinate) and `WaitingBar`; MessageDetail draws its own copy of the
  bar - **D**: one drawing (visual-craft, "One object, one drawing").
- [ ] I113 `Skeleton` rows.
- [ ] I114 `EmptyState` and the hero glyphs (I79).
- [ ] I115 `DashedOutline` (add a box, add an attachment, the sender gate).
- [ ] I116 `DottedRail` (delivery steps).
- [ ] I117 Chips and tags: every `chipTone` (fiction red and amber, user blue, cost free and paid, the
  four delivery states, info, danger soft, estimate soft, stop), the test tag, the box pill, the
  documents chip, the saved badge.
- [ ] I118 `QrCode` with the Obálka plate.
- [ ] I119 Flags (cs, en) in the language picker and sheet.
- [ ] I120 `BoxPill`, `CrossBoxLine` (dots, +N), `DeliveryStateIcon` (sent, delivered, accepted or
  fiction, stop).
- [ ] I121 Unread badge (99+, min 20) and the sync-error badge on a box avatar.
- [ ] I122 Pull to refresh (both lists and the error state).
- [ ] I123 `ContinueButton` after a restore (backup, transfer, What's new).
- [ ] I124 The Mobile Key brand tile, the logo at 40 / 84 / 120 (the lock tile, `BrandLockIcon`, became
  the sealed envelope in T034).

### What the system draws around the app

- [ ] I125 Biometric and passcode prompts and their titles (`lock.prompt`, `backup.prompt.*`,
  `transfer.prompt.keepKey`) - **N**: the words follow the Lock board ("Obálka je zapečetěná").
- [ ] I126 Notification permission: asked from the nudge (I86), the first reminder, and "alerts off" -
  **N**.
- [ ] I127 Camera permission: asked when the scanner opens, with no word before it - **X**: the mobile
  practice "Explain before the permission prompt"; behaviour, not now (owner, 2026-11-12, not-now.md).
- [ ] I128 Notifications: Android channels, the iOS hidden-body placeholder, the reminder and password
  texts - **N** (I63 is the colour).
- [ ] I129 Opening an attachment: Android's chooser, iOS Quick Look, a ZFO's save sheet - **N**.
- [ ] I130 File pickers and save sheets (backup export and import, compose attachments) - **N**.
- [ ] I131 Sharing a debug recording - **N**.
- [ ] I132 The PDF the app makes from typed text ("Textová zpráva.pdf", system font 14) - **X**: what the
  authority receives from Obálka; R9 shows it as printed matter.
- [ ] I133 External links: the ISDS portal (password, sign in again, buy credit), privacy, source, the
  OS settings - **N**.
- [ ] I134 Notification taps and cold start into a message or the password screen - **N**.

### Platform variants

- [ ] I135 Largest text size: fixed heights that may clip (segmented 34, FAB 54, badges 20/11, avatar
  monograms, the deadline suggestion's min height, the lock's failure slot 17) - **N**: walked at the
  largest size on both platforms.
- [ ] I136 Touch targets under 48: the box menu's trigger (38), header back (44) - **N**.
- [ ] I137 Language: the app starts in Czech whatever the device says; dates are Czech in English too;
  the iOS permission texts are Czech only - **N**: walked in English; the gaps are behaviour, not
  now (owner, 2026-11-12, not-now.md).
- [ ] I138 Orientation and size: iPhone only and portrait; Android tablets (600 dp and up) may rotate;
  content stops at 720 - **N**: walked on a tablet AVD in landscape.
- [ ] I139 No error boundary: a render error shows nothing - **X**: behaviour, not now (owner, 2026-11-12,
  not-now.md); the fallback screen, once built, gets a board.

### Fixed on the way (behaviour, the owner's call on 2026-11-12)

- [x] I140 Seven places left a dialog or sheet open as the app went to the background, drawn over the
  lock screen on return (an RN Modal sits above the lock cover): the Settings, Transfer and Debug
  dialogs, the attachment and signed-original dialogs, the paid-send confirmation, the sender sheet.
  Each now closes, or (a transfer that arrived) waits while covered. Held by
  `__tests__/security/modalsCloseOnBackground.test.ts` (red on the 7 first) and
  `__tests__/app/modalsLeaveWithTheApp.test.tsx`.

### Leftovers found by the second inventory

- [ ] I80.1 Unused: `useIsWideWindow`; icons Bell, Paperclip, Menu, Send, Sun, Moon, Refresh, SyncOn;
  tokens `accentSun`, `accentMoon`, `accentDevice` - **D**: delete with I78.

## Phase 2: Redraws, round 1 (on the canvas)

- [x] T010 R1 Welcome - variants.
- [x] T011 R2 Compose and the stamp - variants.
- [x] T012 R3 Cards: tone or hairline, shown on Settings - variants.
- [x] T013 R4 Empty, error and search states - variants.
- [x] T014 R5 The inbox's other states: all boxes, strips, sent rows, drafts, loading, the switcher.
- [x] T015 R6 Slips: the recovery key and the transfer code. The phrase keeps the code's tight
  dashes (025 T027: a middle dot "is not on any keyboard").
- [x] T016 R7 The sent message, the detail's other states, the airmail strip. The sent message
  reuses the agreed Sent board's envelope one to one (196 tall, so the rings clear the window).
- [x] T017 "Before you show anything" on every new board; ask the owner (at most four questions).
  Picked 2026-11-12, each the recommendation: Welcome A, Compose A (the envelope you are sending), Cards B
  (sheets with weight, no hairline), Empty states A (the envelope in a pose).
- [x] T018 Strip the losing variants and their labels after the picks (canvas version 21).

## Phase 3: Foundations (agreed on 2026-11-11, no open choice)

- [x] T020 Tokens in `src/theme/` and DESIGN.md: envelope, envelope inside, flap, icon planes, the
  window's inset shadow and film, the sheet and envelope shadows, perforations, tint, airmail.
  `contrast.test.ts` pairs for every new foreground/background. Done 2026-11-12: colours in `theme.ts`,
  geometry in `print.ts`, shadows as `objectShadow`/`objectFilter` in `depth.ts`, DESIGN.md › The
  printed objects; measured: the dark window is 2.47:1 on the envelope, as the agreed board draws it
  (not a 1.4.11 failure: its words identify it), pinned in the test.
- [x] T021 The offset icon family (`src/theme/offsetIcons.tsx`), one drawing per glyph from the canvas's
  `<symbol>` source; plane colour from the theme; tests that every glyph renders in both themes.
  Done 2026-11-12: the 20 glyphs of the board, 85 tests (plane colour and 1.3 offset, ink stroke 1.75
  with round ends, the gold plane, hidden from assistive technology); a plane printed on register
  fails 40 of them. Not yet used by a screen: each screen takes its glyphs in Phase 4.
- [x] T022 The objects, one source file each: `Envelope` (with the avatar form), `Window`, `SecurityTint`,
  `Postmark`, `Stamp`, `Slip`, `AirmailStrip`. Done 2026-11-12 in `src/theme/objects/`, 40 tests in
  `objects.test.tsx`, both themes. The holes are placed where the canvas's CSS mask cuts them
  (`perforation.ts`), including the inner ring of half-holes the agreed Main stamp shows (rendered at 3x
  to check). Where the build differs from the boards' markup, and why:
  - the window's film is react-native-svg's native blur, not the pre-rendered PNG the Main board's
    "Buildable today" note suggests: the same drawing, and no asset per window size;
  - the slip's 1 pt edge is drawn as the same shape one point lower, not a second `drop-shadow`: iOS
    keeps only the last of a chain (so `objectFilter('dark', 'slip')` is now none);
  - the avatar tile is one drawing at 42 scaled to 40 ("one object, one drawing"); the board's 40 pt box
    tile drew its fold separately, up to 1.2 pt away;
  - the postmark is the Detail board's drawing. The Sent board's postmark (larger, no waves, the
    cancellation across the stamp) is that drawing at 1.13x with its waves off, the waves drawn on the
    stamp in `cancel-ink` (settled in T033);
  - the envelope's flap poses (the inbox header's front, Welcome, Lock, the open envelope with its
    lining) come with their screens (T030, T031, T034, R1).
  New tokens: `envelopeFold`, `flapFrame`, `windowGlint` (DESIGN.md › The printed objects). No screen
  uses the objects yet; each is checked against its board by screenshot when its screen is built.

## Phase 4: Build the agreed boards, one to one

- [x] T030 Inbox (I14, I17, I18, I25, I28). Done 2026-11-12 in four commits: the header (the envelope's
  front, the box in its window), the rows (`InboxRows.tsx`: the attention block's sheets and the register
  by day, new `Day` role), the line about the other boxes, and the compose stamp (`Fab.tsx`). Checked on
  the `Obalka_Demo` emulator in both themes against board InboxA, rendered at 3x. Where the build differs
  from the board, and why:
  - the second envelope's edge is drawn under a sheet only when the message was delivered by fiction:
    every board draws it there and nowhere else;
  - the fiction chip keeps its "?" (it opens the answer in the FAQ) and the code's words, "lhůta už
    běží"; the month is the Title role (21), the board's 20 is not a step of the type scale;
  - the register shows a clip, not the board's clip and count: ISDS lists only the attachments' total
    size until a message is downloaded;
  - the line about the other boxes says "Jinde:" instead of "V ostatních schránkách" when not even one
    whole clause fits after the longer words (on the 411 dp emulator it cut "naposledy 2 nepřečt…");
  - the stamp's frame is a stroke in its drawing, not a View border: Android drew the translucent border
    twice as wide;
  - the compose stamp keeps the app's safe-area rule (22 above the safe area) rather than the board's
    30 from the screen's edge.
- [x] T031 Empty inbox (I22, I26). Done 2026-11-12: `OpenEnvelope` (the open pose of the envelope:
  the flap up and shaded, the inside printed with the lining, the front pocket), `EmptyObject` (the
  object, the title, the explanation, a quiet note) and `freshnessText`, the same words under the
  envelope and at the list's end ("Naposledy dnes ve 14:02", with "v" or "ve" as Czech takes the hour).
  Checked on the `Obalka_Demo` emulator in both themes. Where the build differs from the board:
  - the envelope sits 60 below the header and the title 36 below it, not the board's 56 / 34: the owner
    moved every empty state to these steps of the scale (2026-11-12), and the Empty and R4Empty boards
    were moved with it;
  - the list's end lost its hairline: the register's rows have none since T030;
  - `strings.ts` was split (`messageListStrings.ts`) rather than trimmed to make room.
- [x] T032 Message, light and dark (I29, I32, I33, I35 saved row, I36). Done 2026-11-12 in four commits:
  the envelope it came in (`DetailEnvelope.tsx`: the sender on the envelope, the postmark, the recipient in
  the window, the subject on the sheet sliding out), the fiction band with "Připomenout"
  (`FictionBanner.tsx`), the delivery record as a slip (`RecordRing`, a ring per step) and the
  attachments as sheets of paper with the signed original in their list (`DocSheet`). Checked on the
  `Obalka_Demo` emulator in both themes against boards Message and Message - dark, rendered from the
  canvas. Where the build differs from the board, and why:
  - the header has no "Archivovat" or "Další akce": the app has neither (plan.md, leftovers);
  - off the scale, rounded (owner, 2026-11-12): the sheet's top corners 4 -> 8, the band's gap 9 -> 10,
    the attachments 20 below the record -> 18; the subject is Display (26), the sender Heading (17);
  - the sheet says the attachment count only: the board's "Č. j." is not in the data model;
  - the band gives the year when it is not this one (29.08.2025), or last August's fiction reads as
    this August's; its glyph keeps the family's 1.75 line (board 2);
  - the gold tones' dark pair is the canvas's gold ink on gold soft (#F0C452 on #33290F) for all three
    gold tones, and the slip's dark header takes it too (board #E8A100);
  - not on a board: a service someone signed in for is the inner ring filled with the check cut out;
    its note and the merged step's are written in the board's style; the read note and the erased /
    vault notes stay under the steps, without hairlines;
  - the record's header takes the row's width: Android cut its last word ("DORUČENKA ·");
  - the file type is printed at 11, not 8.5: nothing anyone reads is under 11 (practices);
  - "Celá zpráva uložena v archivu" stays only as the warning it can be: each file says "v archivu";
  - the signed original lost its own heading and joined the list; its caption is the board's words;
  - "Stáhnout" saves a copy through the system's save sheet, the way the signed original already left
    the phone where no app opens a .zfo; tapping the row still opens the file;
  - the term card (I34) and the other attachment states (I35) are R7's, unchanged.
- [x] T033 Sent result (I39). Checked on Obalka_Demo in both themes, free and paid, against the board.
  Where the build differs from the board, and why:
  - the stamp's face is 76 wide, not 64 (the stamp 96, not 84): Android draws "ZDARMA" 51 and "PLACENÁ"
    56 wide, and the board's face leaves them 48, so "ZDARMA" broke as "ZDARM / A". The cancellation
    has one more 12 wide wave so it still crosses the stamp; the postmark stays where the board puts it,
    its edge under the stamp's;
  - rounded to the scale: the window's padding 9 to 10, gaps 1 to 2, the stamp's padding 7 to 8, the
    slip's margin 22 to 24; the stamp's value is Title (21; board 22), the sender's name Subheading,
    the buttons BodyStrong (15; board 16);
  - the steps after "Odesláno" are filled in from the sent list's answer when it comes (delivered,
    accepted, or accepted by fiction with the gold clock); until then they are dashed rings, "zatím ne";
  - the screen has no header: "Hotovo" is the way back, as on the board.
- [x] T034 Lock (I50). Checked on Obalka_Demo in both themes, with the failure line and the reset link
  showing, against the board. Where the build differs from the board, and why:
  - the board's words replace the old ones: "Obálka je zapečetěná" and "Zprávy i přihlášení jsou pod
    zámkem." ("Obálka is sealed", "Your messages and sign-ins are under lock."); the system prompt's
    reason stays "Odemknout Obálku";
  - the hint "Otisk prstu · obličej · kód zařízení" is gone, as on the board; its slot held the reset
    link, which now sits under the failure line - both below everything the board places, so neither
    moves anything; the failure line is laid out always, invisible until an attempt fails;
  - the envelope's drawing starts 168/844 of the way down the screen, as on the board, and the screen
    scrolls only when the largest text sizes need it;
  - rounded to the scale: the gap under the envelope 40 to 36 (`hero`); the button's label BodyStrong
    (15; board 16);
  - not on a board: the dark shadow, black where the light one is blue;
  - the button's glyph is what the phone itself unlocks with: the board's face on iOS, a fingerprint on
    Android (owner, 2026-11-12), drawn here in the face's viewfinder at its 1.8 line - two ridges, all
    a 20 pt glyph keeps apart at that weight. For the canvas: the board shows only the iOS face;
  - the brand lock tile (`BrandLockIcon`, `ICON_TIER.lock`) is gone, replaced by the sealed envelope;
  - not yet seen on iOS: the seal's face is React Native's own radial gradient, seen on Android; under
    it is `seal-shade`, should a platform not draw the gradient.
- [ ] T035 Motion: I67-I70, each with its Reduce Motion form.
- [ ] T036 Capture each built screen in demo mode, both themes, and compare with its board.

## Phase 5: Round 2 on the canvas

- [x] T040 R8 Sign-in and the Mobile Key wait, the launch, the SMS code, a refused sign-in, the password
  change's error and done states, a transfer running and done, the app icons (I03, I08-I13, I46.4-5,
  I65.1, I76).
- [x] T041 R9 Every question as one anatomy (a destructive one, one with no danger, a notice with a
  retry, dark), the language, reminder and sender sheets, the box menu, the alias editor, What's new,
  the snackbar (I49, I52-I61, I84-I105); each sheet's Reduce Motion form in its label.
- [x] T043 R10 Backup and transfer, every state: running, the restore list, an opened backup, first
  run, send, nothing to send and the iPhone card, receive, stopped by going away (I45.1-I45.7,
  I46.1-I46.6). Derived, for review.
- [x] T042 Asked the owner on 2026-11-12, each the recommendation: Q1 a screen that waits shows its object
  still and one waiting bar (busy buttons keep their small spinner); Q2 every question is the bottom
  sheet of the paid send; Q3 the dark iOS icon is the app's envelope, blue and gold, on a dark ground.
  Losers stripped (canvas version 23).

## Phase 5b: Round 3 on the canvas - every surface still without a board

The owner checked rounds 1 and 2 on 2026-11-12 and agreed R5-R7 and R10 as drawn; round 3 draws
everything else, so no screen is built before its board is agreed.

- [x] T044 R11 The sign-in forms and the first run: the method step (Pokročilé closed and open), the
  password and Mobile Key credentials, signing in, after a refusal, a sign-in error, Přihlásit znovu,
  the whole password change with its ten rules, the crash-report question (both themes), the FAQ and
  its delivery legend.
- [x] T045 R12 Compose's other states (no sender, nothing typed and the drafts, searching / none /
  error, short credit, reading an attachment, sending, a footer error) and the PDF made from the
  typed text.
- [x] T046 R13 The whole Settings (both themes), Debug (idle, recording, saved), Licences (list, a
  group, a text, no results), the QR scanner (live both themes, no access, no camera), the privacy
  covers (iOS both themes, Android 12 and older).
- [x] T047 R14 The inbox strips (re-auth with offline, the password expiring and expired, the merged
  view missing a box, debug recording, dark), every attachment state with the reminder, alerts-off
  line and found date, and one sheet of every shared part in both themes.
- [x] T048 Asked the owner on 2026-11-12, each the recommendation: Q1 the recipient is searched in the
  envelope's window; Q2 the PDF from the typed text is a Czech letter on A4; Q3 a sign-in method is
  chosen in one card of choices; Q4 the scanner shows a window to aim through. Losers stripped (canvas
  version 25). The derived states of R11-R14 wait for the owner's review.
- [x] T049 The owner reviewed R11-R14 on 2026-11-12 and agreed them, after one change: the debug strip
  on the inbox sits on the flap (below). Every board on the canvas is now agreed (canvas version 27).

Fixes found while drawing, built with their screens: the scanner's hint is unreadable in dark mode
(surfaceAlt on black); the undeliverable delivery glyph takes surfaceAlt and nearly vanishes on the
paper; the attachment download shows a still 40 % stub where the one waiting bar belongs. On the
inbox the debug-recording strip sits on the envelope's flap under the status bar (the flap grows by
the strip's height), so the envelope still reaches the top; today it pushes the whole header down.

## Phase 6: Build round 1 and round 2; Phase 7: close

- [ ] T050 impeccable critique of the built app (two isolated reviewers), fixes, re-audit with the owner.
- [ ] T051 Canvas shows only agreed designs and matches the build; DESIGN.md records the objects, the
  families and weights, each component's anatomy and the rejected variants.
- [ ] T052 Delete `docs/engineering/identity-pass.md` in the last commit.
