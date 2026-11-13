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
- [x] I03 JS `LaunchScreen` (loading: logo 84 + name + platform spinner; failed: retry) - **X**: a generic
  spinner where the product waits. R8. Fixed 2026-11-13: the lockup centred over all but the bottom
  120, one `WaitingBar` 120 wide at 84 (spoken "Načítání schránek"), and on a failure the message and
  a compact inline `NeutralButton` at 64 in its place; the outlined retry is gone. Roundings: the bar's
  4 to the one waiting bar's 6 (DESIGN.md); the retry's 46/13/14 to the neutral button's compact
  48/14/15. Walked both states light, dark and in English (forced on, reverted).
- [ ] I04 `Welcome` (logo tile 120, Hero title, add box, restore, language, FAQ) - **X**: the envelope's
  biggest moment has no object. R1.
- [ ] I05 FAQ overlay and `FaqScreen` (accordion cards, Overline groups) - **D** (cards).
- [ ] I06 `TelemetryConsent` (first run after the first box; two cards, two buttons) - **D** (cards).
- [ ] I07 `BackupScreen` first run (restore) - see I45.
- [ ] I08 `AddBoxForm` - **D** (cards); the busy spinner is R8.
  - [x] I08.1 Method step: three radio cards, Advanced (chevron, no animation), environment segmented,
    the "i" help, FAQ link, Continue. Fixed 2026-11-13 to R11 (the owner asked): the methods are one
    `OptionGroup` sheet, a row each, the radio on the right, as Settings' Vzhled; Pokročilé a 13/700
    muted line; the environment sheet keeps its help open under the switch, the "i" a mark beside
    the label; the help link blue at the left with its glyph; the footer tone with no hairline.
    Roundings: the rows' 56 and 11 to the group's 52 and 10; the step's 20 top to 18. Walked light,
    dark and in English, closed and open, a method picked.
  - [x] I08.2 Credentials step: method chip, login name, password or code with the eye, Mobile Key
    help, the OTP suggestion (and re-auth's `OtpSuggestion`, from I11), alias, submit, busy, blocked
    (login name, password). Fixed 2026-11-13 to R11 on the add-box step: the method is a chip as
    small as its words (blue-dark on blue-soft, the info glyph at 15), the field labels muted, 14
    between the groups and 16 at the top, the alias label one muted run. The communication code has
    no eye and shows as typed (R11). After a refused password the suggestion is a sheet: the phone
    glyph in a well, the `subheading` title, the `caption` reasons and two links. Roundings: the
    fields' 15 side padding stays 16. The links are a 44 row each, not the board's 2 apart, so
    neither covers the other (a sync-back item). Walked light, dark and in English (forced on,
    reverted). Re-auth's `OtpSuggestion` went with I12; still open: the busy spinner (I76).
- [x] I09 `OtpForm` (code field, sending/sent notice, resend, blocked) - **N**. Fixed 2026-11-13
  to R8: the Display title at the left, the notice on a blue tone strip with its bell, the field's
  label, eight digit boxes over one hidden field (digits only, eight at most, a paste trimmed), Confirm
  dimmed until all eight are in, the resend a blue link. The boxes share the column's width (the
  owner, over the board's 34s); eight digits confirmed on the owner's own messages. Roundings: the
  boxes' 10 corner to 11, the digit's 17 to the 20 `code` role, Confirm's 16 to 15. Walked light,
  dark, in English, empty, part and whole (forced on, reverted); the walk found the Android group-opacity fade
  and the system face on every Button.
- [ ] I09.1 Android's SMS User Consent sheet over the code field (the system's) - **N**: seen in place.
- [x] I10 Mobile Key waiting (brand tile 84, phone glyph, pulse ring loop 1800 ms) - **X**: a generic
  pulse. R8. Fixed 2026-11-13: `WaitingEnvelope`, the box's envelope (300 by 186, -1.5 degrees, the
  flap shut, the login name in the 200 window) over the title, the line, the 220 waiting bar and the
  faint hint; the cancel bar without its hairline. Roundings: the 48 above the envelope and the 40
  under it to 36; the title's 20/25 to the 21/26 `title` role at 700; the name's 16 to `subheading`;
  the window's 9 and its gap 1 to 10 and 2. Walked light, dark and in English (forced on, reverted).
  The walk found the envelope's folds stopping the padding short of the corners, on every envelope:
  fixed in e519006.
- [x] I11 Sign-in `ErrorView` and `OtpSuggestion` (retry with `depth.sm`) - **D** (cards); R8.
  Fixed 2026-11-13, `ErrorView` split in two. A refusal (wrong name or password, expired password) is
  R8's card on the flow's own header: the lock in its well, the `heading` title, the `small` body,
  the 48 "Upravit jméno nebo heslo" and "Změnit v portálu" with the external-link arrow. Any other
  failure is R11's sealed envelope, the danger `body` 600 reason and the compact neutral Zkusit znovu.
  Both ways back now land on the fields as they were sent, not on the method choice. Roundings: the
  envelope's 120 from the top to 60 and its 32 at the sides to 36; R11's 46 / 13 / 14 button to the
  neutral 48 / 14 / 15. Walked both, light, dark and in English (forced on, reverted).
  `OtpSuggestion` (re-auth only) is R11's "After a refusal" sheet: it moves to I08.2.
- [x] I12 `ReauthForm` (avatar, method cards, field) - **D** (avatar, icons: Zámek). The method cards
  are the add-box step's one sheet since 2026-11-13. Fixed 2026-11-13 to R11:
  - The intro is `small` in body ink with the `smallStrong` link under it, and 14 between the groups.
  - The box is a card, 12/14, holding its own envelope at 46 (R11's 13 corner, the box's 13
    monogram), the name, the identity line, and the offset lock at 20 in muted ink.
  - The field label is muted, the communication code has no eye, and the footer has no hairline.
  - A refused password keeps the form, and what was typed, with the add-box step's suggestion sheet
    under the field: `RefusedSuggestion`, one sheet for both. The centred `OtpSuggestion` and its
    three strings are gone.
  Walked light, dark, the sheet forced on, and Mobile Key in English. The English walk found the
  unmasked code's placeholder wrapping onto a clipped second line (a regression from I08.2). It now
  reads "Code from the portal (not your password)", and a test holds it to 40 characters.
- [x] I13 `ChangePasswordForm` (avatar 46, three fields, ten rules and the history rule, busy) - **D**
  (avatar, icons). Fixed 2026-11-13 to R11:
  - The intro is in body ink, and the box is `BoxSheet`, shared with signing in again.
  - The field labels are muted, and the footer has no hairline.
  - The rules are on a sheet under a muted bold "Nové heslo musí". A met rule is a 20 green disc
    with the check in the surface ink, an open one a 20 ring; a met rule's words go to body ink.
  - The history note sits under the sheet.
  Roundings: a rule's 5 above and below to 4. Walked light, dark and in English, empty and typed.
  The busy spinner stays with I76.
  - [x] I13.1 Its error banner: wrong password (with the portal), refused, network, timeout, not
    saved, server fault - **N**: R8. A danger tone block, 12 corner, 12/14, the words at 14/600 in its
    ink, with no icon and no outline. The wrong-password portal link is in the same ink. Walked
    (timeout, forced on) light, dark and in English. R8 sets the banner under a bare box line; the
    build keeps R11's (newer) sheet above it.
  - [x] I13.2 Its done state (check, until a date or no expiry, "everywhere", close) - **X**: R8. The
    offset lock at 72 in a 132 sunken disc, the `title`, the date in `body`, then "everywhere"
    balanced at 300. Hotovo has no bar under it. Roundings: the disc's 96 from the top to 60, and the
    title's 32 under it to 36. Walked (forced on) light, dark and in English.

### Messages

- [ ] I14 Inbox header, one box (avatar 36, name, identity line, search, segmented) - **D**: board
  "Inbox - the envelope front" (flap band, window switcher, segmented on blue).
- [x] I15 Inbox header, all boxes (Layers tile, subtitle) - **X**: R5. Fixed 2026-11-13: `BoxStackTile`, the
  boxes' envelopes fanned (3 and 8 degrees, the board's 10 corner rounded to 11), the count on the
  front one; "Sloučený archiv · 3 schránky", no unread count (the board's).
- [x] I16 Inbox strips: reauth, password expiry, unified missing, stale, offline - **X**: not drawn under
  the envelope header. R5. Fixed 2026-11-13 (board R14): `InboxStrips.tsx`, a tone
  card inset 16 under the envelope, radius 12, minimum 44, no hairline, the 20 alert glyph, the action
  at 800; an expired password's two actions under the message (the board's 11 padding rounded to 12).
  The stale line is a sunken card, centred, minimum 32, its 10 corner rounded to 11, 8 under a strip.
  Copy stays the app's own (the board: "copy is the app's own"). The debug strip on the flap is I62's.
- [ ] I17 Attention block and its rows - **D**: board Inbox (sheets with the second envelope's edge,
  flap tiles, fiction chip with the offset glyph).
- [ ] I18 Received rows and month sections - **D**: board Inbox (day numeral, small sender tile, offset
  attachment and reminder glyphs).
- [x] I19 Sent rows (delivery state per row) - **X**: no board. R5. Fixed 2026-11-13: the register row
  (`SentRows.tsx`), "Dodáno 11.11." muted / "Doručeno 25.10." green / "Doručeno fikcí" gold with the
  postmark, only with a time ISDS certified; nothing while on its way, "Nedoručitelné" in stop ink.
  The fiction and stop chips and their FAQ link left the row (the state is at its end now); the
  countdown and the erased/vault note stay. Dates padded as everywhere ("03.10.", the board "3.10.").
  In all boxes the box pill is the monogram alone (8 dp sides, the board's 7 rounded), inline after
  the name on every row and sheet; the row's spoken label names the box.
- [x] I20 List loading (6 skeleton rows) and the 3 px sync bar - **X**: under the new header. R5. Fixed
  2026-11-13: `RegisterSkeleton`, five rows of a day block and two lines at the board's widths (no
  month over them: the month is not known yet); `SyncBar`, the one waiting bar, a 3 dp sunken track
  inset 16 and 10 under the strips, one segment a third long sweeping (1.3 s; still with Reduce Motion),
  laid over the list so nothing moves; core Animated on the native driver, not Reanimated (I68). Its
  ends are the 999 step (the board's 2).
- [x] I21 List error (CloudOff hero 132, reason, retry) - **X**: R4. Fixed 2026-11-13: the envelope in a pose (`EnvelopePose`, 220 x 140, tilted 2 degrees, the open envelope's shadow),
  sealed under its gold flap; the reason as before; Zkusit znovu a 52 sunken button (radius 14, 16/700).
  The flap and the creases are clipped to the round corners: the owner saw a blue rim above the flap and
  crease ends past the corners on the device (the board draws the same overshoot - canvas sync-back).
- [ ] I22 Empty received - **D**: board "Empty inbox - the inside of the envelope".
- [x] I23 Empty sent (paper-plane hero) - **X**: R4. Fixed 2026-11-13: the unsent pose, a dashed blank
  stamp and an empty window with dotted address lines; the heading lost its full stop.
- [x] I24 Empty, needs a new sign-in (CloudOff hero, "Zprávy zatím nejsou k dispozici") - **X**: R4.
  Fixed 2026-11-13: the addressed pose (an empty window, no stamp), 24 under the strip, not 60.
- [ ] I25 Cross-box line ("Jinde: …") - **D**: board Inbox ("V ostatních schránkách …", Schránky glyph).
- [ ] I26 Freshness line at the list's end - **D**: board Empty ("Naposledy dnes ve 14:02").
- [x] I27 Drafts entry above the list - **X**: R5. Fixed 2026-11-13: one sheet (`DraftsEntry`), the draft
  glyph in a 36 well.
- [ ] I28 Compose FAB (gold extended, pencil) - **D**: the blank stamp, board Inbox. Its stamp draws a
  frame late on a cold start (I107).
- [ ] I29 Message detail, received - **D**: boards "Message - the envelope it came in" and "Message - dark".
- [x] I30 Message detail, sent (recipient card, delivery timeline) - **X**: R7. Fixed 2026-11-13: the
  Sent board's envelope in `DetailEnvelope` (`sent`): from this box with its ID, the recipient with
  their ID and address in the 236 window (015 US3), the 84 stamp blank and cancelled by the postmark
  (108 at 102 / 20, -6 degrees; the cost is not in the archive - not-now.md), the subject on the sheet;
  then `SentRecordSlip` (the message's ID, rings of 30, "zatím ne", the state's age, why it stopped,
  erased or vault as lines under the steps; a stop is a cross in `danger`); the band tucks it as a
  received one (R15). The header says "Odeslaná zpráva". Walked light and dark beside R7.
  - [x] I30.1 A name before its legal form (the owner, 2026-11-13, on the test box): ISDS's "Jan
    Novák - podnikající fyzická osoba" ran three lines in the sent sender's 120. `partyName` splits
    the suffix ISDS appends (only the one seen, so a name's own dash stays); the envelope leads with
    the name and puts the form short with the ID on the quieter line ("PFO · ID ab12cd3", the owner's
    pick), in full on a tap and to a screen reader; rows, the band and search show the name alone.
    Walked on the owner's test box, light and dark, tapped open.
- [x] I31 Detail loading skeleton and error - **X**: R7. Built 2026-11-13: the skeleton takes the
  envelope, the sheet and the slip; the title is the screen's from the first frame. Captured
  2026-11-13 through the demo probe, light and dark: the skeleton as built; the error was red words
  saying "stáhnout" and "zkuste to znovu" over a back button, mid-screen - it is now the failed
  list's anatomy (R4): the envelope sealed, "Zprávu se nepodařilo otevřít", that the phone's archive
  does not hold it, and "Zpět na seznam" on the inline neutral button (`detailError`); walked in
  Czech and English. The failed list's retry is the same button now (its 16 px label rounds to the
  15 `bodyStrong`).
  - [x] I31.1 Demo states to walk them (owner, 2026-11-13: add them to the demo data): a sent message
    undeliverable (the cross and the reason), one served by fiction, one still on its way; and a way
    to see the skeleton and the error, which no stored message reaches. Built 2026-11-13: three sent
    messages on p7wq2bs; the seed tops up an archive that holds only the demo boxes (by message ID,
    nothing wiped) and refuses any other box; `DEMO_DETAIL_PROBE` (`slow` / `missing`) holds or
    empties the detail's read in a dev build with `DEMO_DATA`. Both committed off, guarded by
    `__tests__/dev/demoData.test.ts` (red with `DEMO_DATA` on). Walked light and dark: the three
    details as R7's slip draws them, and the undeliverable row, whose "Nedoručitelné" was the stop
    chip's paper on the paper - invisible - and is now the stop's ink.
- [ ] I32 Fiction banner - **D**: board Message (gold band with "Připomenout").
- [ ] I33 Delivery record (Doručenka card, dotted rail) - **D**: the slip, board Message.
- [ ] I34 Term card, "alerts off" line, deadline suggestion (scan) - **X**: not on a board. R7.
  2026-11-13: the reminder row matches R7 (56, 8/12, its glyph in a well, 14/600 over 13/500, the
  muted chevron), walked; the "alerts off" line and the scan suggestion are still today's.
- [ ] I35 Attachments: none, unavailable, downloading, not downloaded, missing, corrupt, opening, saved -
  **D** for the saved row (board Message); **X** for the other states, R7. 2026-11-13: not downloaded
  matches R7 (one card, the attach glyph in a well, the blue download inside it at 48 / 13 with the
  offset download glyph, 15/700), walked; the other states are still today's.
- [ ] I36 Signed original (ZFO) row - **D**: board Message (Pečeť glyph in a well).
- [x] I37 Test-environment banner (`StatusStrip` test tone, flask) - **X**: the airmail strip. R7. Fixed
  2026-11-13: `TestEnvBanner` lays the existing `AirmailStrip` over `surface-alt`, the band 28 with 16
  sides, the Badge label in ink taking the row's width (dark cut "prostředí" off before), no glyph or
  hairline; StatusStrip lost its `test` tone. Walked light and dark by forcing it on (no czebox box on
  the demo), reverted.
  - [x] I37.1 Walk it in place, under a czebox box the owner signs in on Obalka_Demo (owner,
    2026-11-13): the header straight under the strip, no second status-bar gap. Walked 2026-11-13 on
    the owner's test box, a sent message, light and dark: the strip takes the status bar (132 px) and
    its band; the header's title sits 79 px under it, as it sits under the bare status bar.
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
  Part built 2026-11-13: the hint and no results draw the archive pose (a stack of three envelopes, a new
  `envelopeBehind` #22508A for the middle one); the field is a paper well with the offset search glyph
  (18, muted), no outline, the placeholder muted, in Public Sans - every `Input` had fallen back to the
  system face (owner's catch). No results is not on the board: it takes the hint's pose. Rounded:
  the no-results top 96 -> 60 (the empty step), the body width 280 -> 300 (the board's). Open: the
  result rows and their skeleton (I18).

### Settings and the rest

- [x] I43 `SettingsScreen` (appearance, language with flags, lock, attachments and Wi-Fi, scan and how,
  diagnostics and Debug, backup, About: version, what's new, FAQ, licences, privacy, source) - **D**
  (cards, icons in wells: Zámek, Archiv, Přenos, Upozornění, Nastavení). R3 shows it. Fixed 2026-11-13
  as R13 draws it (Cards B): cards are sheets with no border; rows 52 / 10 / 14 / 12; wells 40; dividers
  14, or 66 above the Wi-Fi row and "Jak to funguje"; radios a blue ring with a 12 dot; flags 22×15;
  the section label 18 above and 8 under (the first 16). Walked on Obalka_Demo light and dark, cs and en,
  each card cropped at full resolution beside the board's render: rows 139 px both. Found on the walk:
  the dimmed Wi-Fi switch faded child by child on Android, so the blue track showed through the knob;
  the row now fades as one picture, as the board's CSS does. Roundings: none needed, every value is a
  step. Left as it is: Android draws Public Sans about 2.5% wider than Chrome (the same font file
  measures the same in Chrome), so a line can wrap one word earlier than on the board ("chyby:").
- [ ] I44 FAQ entries and the delivery legend - **D** (cards; the legend's state glyphs follow I33).
  2026-11-13: the cards are sheets now (Card), walked dark; the line ticks with R13's rest.
- [ ] I45 `BackupScreen` - **X** for the key and QR: a slip on the security tint (R6). The rest:
  - [x] I45.0 The key and its QR - **X**: R6. Fixed 2026-11-13: `SecureSlip` (the surface-alt panel,
    radius 16, the tint measured to it) holds the key three groups and two in `code` 20/28, the QR plate
    and its hint; the warning and the pair of sunken buttons (48, radius 14) under it, one button at
    52 while hidden. Walked light and dark beside R6: matches but for the 4-module quiet zone, the full
    logo for the board's simplified plate, the label icon (R10) and the known text width.
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
  - [x] I46.0 The phrase and its QR - **X**: R6. Fixed 2026-11-13: the same slip with the overline,
    the phrase three words and two with faint dashes (the board's 22 rounded to the `code` 20), the
    hint, the backup's two meta lines and the QR at 195; the stage, the bar, keep-open, the cancel link
    and the route as plain lines under it (R8's 10 between, the route last). Walked light while
    connecting beside R6.
  - [ ] I46.1 Not available here (the card) - **N**: R9.
  - [ ] I46.2 Send: pick a backup (none: a link to create one), the option group, the note, send -
    **N**: R9.
  - [ ] I46.3 Receive: the description, the hint, scan, the phrase field, start - **N**: R9.
  - [x] I46.4 Running: stage lines (preparing, connecting, waiting, receiving, applying, received),
    progress or waiting bar, cancel, keep open, the route - **N**: R8 (waiting). Fixed 2026-11-13:
    the half the run belongs to as a plain overline (no icon), the bytes in muted 13/17 beside the
    stage while bytes move, and a receive's stage 18 under the overline (8 + 10, as R8). Walked
    forced at 2,6 of 4,2 MB beside R8, light, dark and English.
  - [x] I46.5 Ends: error, done, done with a route, Continue, stopped by going to the background -
    **N**: R8. Fixed 2026-11-13: the end is a screen of its own - the archive stack, what came back
    as the title (36 under, the board's 32), what is still to do in muted 14/20 at 300, the route in
    faint meta, Pokračovat 52 at the foot with no bar; the sending phone's end in the same shape
    ("Odesláno." and what the other phone still needs). A failure is R10's danger block at the top of
    the half it happened in. Walked forced (done, stopped) beside R8 and R10, light, dark and English.
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
- [x] I54 Box switcher sheet, `BoxRow`, `UnifiedRow` - **D** (avatar, Schránky glyph). R5 shows it. Fixed
  2026-11-13: envelope tiles at 40, the merged entry's fanned tile (no summed badge), the check in gold
  ink, the add row filled (sunken, 52, radius 12), the offset settings glyph. Kept against the board,
  both from the owner's own reports: the alert mark on a broken box's tile and "· Poslední známý
  stav" after its state; for the canvas's sync-back.
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
- [ ] I76 Platform spinners in 11 places - **X**: R8 decides where an object waits instead. The Mobile Key wait's
  spinner is gone (I10, 2026-11-13), and the launch's (I03); nine places left.
- [ ] I77 Press dip, refusal shake, FAB press, segmented slide, radio fill - **N**.
- [ ] I77.1 Haptics: 31 call sites (selection, light, medium, success, warning, error) - **N**: listed
  against the motion rule (a thump where paper lands).

### Icons and leftovers

- [ ] I78 The offset icon family in `src/theme/` and the map from today's Lucide wrappers (Mail, Send,
  Pencil, Search, Paperclip, ShieldCheck, Timer, Layers, Archive, Download, File and the custom
  settings glyph) - **D** build.
- [x] I79 Hero glyphs at 132 (Mail, Send, Search, CloudOff, stroke 1.25) - **X**: R4. Fixed 2026-11-13:
  every one is a pose; `HeroIcon`, the hero tier, `heroInk` and the unused `EmptyState` are deleted.
- [ ] I80 `BrandHeader.tsx`, imported nowhere, with a stale TODO - **D**: delete.
- [ ] I81 Every touched screen walked in English (the longest Czech strings are on the boards).

### Typesetting (found while drawing round 1)

- [x] I82 Czech one-letter prepositions and conjunctions (v, k, s, z, o, u, a, i) end a line today
  ("nastavení v / tomto telefonu", "až o / ně požádáte") - **X**: a no-break space after them in the cs
  strings, held by a test over `strings.ts`. The canvas boards already set it. Fixed 2026-11-13: `t()`
  typesets every Czech string after its values are filled in (`typesetCs`, src/i18n/typeset.ts), and the
  FAQ and the in-app changelog do the same; `__tests__/i18n/typeset.test.tsx` reads every cs key, the
  FAQ and a release, proven red with each one turned off. Captured: "v telefonu", "o ně" hold together.
- [x] I83 A number and its unit break apart ("4,2 / MB" under Záloha) - **X**: `formatBytes` and the
  size strings join them with a no-break space. Fixed 2026-11-13: one `formatBytes` (there were five;
  the debug screen's wrote "4.0 MB"), the decimal comma and a no-break space everywhere.

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

- [x] I106 `Toggle` (48 x 28, disabled .6, not animated). Matches R13 2026-11-13: the off track `hs`
  (#DCD2BF / #4A4236) with its inset ring; inside a dimmed row it takes the row's .55 alone (`rowDims`).
- [ ] I107 `SegmentedControl` (height 34, 200 ms slide, the unseen dot) - inbox board shows it on blue;
  the backup and sign-in uses are on paper. Seen 2026-11-13: on a cold start the selected tab's fill
  draws a frame after the labels (it waits for the first layout); the FAB's stamp the same (I28).
- [x] I108 `OptionGroup` radios (check 140 ms). Matches R13 2026-11-13: one card, rows 52, a 22 ring
  (2, `hs`), picked a blue ring with a 12 blue dot growing in over 140 ms; no tint.
- [ ] I109 Buttons: primary, outline, link, danger; busy and blocked (warning haptic, shake).
- [ ] I110 Text fields: rest, focus, error, the password eye, the dark keyboard.
- [x] I111 `ScreenHeader` (min 54, back 44, two-line title, slot, hairline). Fixed 2026-11-13: the
  hairline stays (every board draws it inline on its header), but the archive search ends at its tone
  (`hairline={false}`, R4 - the owner's catch). 561d039 took it off every screen after reading only
  the boards' shared `.hdr` class; put back the same day. Walked on search and add-a-box, light and dark.
- [ ] I112 `ProgressBar` (6 px, determinate) and `WaitingBar`; MessageDetail draws its own copy of the
  bar - **D**: one drawing (visual-craft, "One object, one drawing"). 2026-11-13, R6 walk: both
  tracks are the sunken surface (`--sk` on every board), not the off switch's darker track; the copy
  in MessageDetail is left for R7.
- [ ] I113 `Skeleton` rows.
- [x] I114 `EmptyState` and the hero glyphs (I79). Deleted 2026-11-13 with I79: `EmptyObject` draws
  every empty state.
- [ ] I115 `DashedOutline` (add a box, add an attachment, the sender gate).
- [ ] I116 `DottedRail` (delivery steps).
- [ ] I117 Chips and tags: every `chipTone` (fiction red and amber, user blue, cost free and paid, the
  four delivery states, info, danger soft, estimate soft, stop), the test tag, the box pill, the
  documents chip, the saved badge.
- [x] I118 `QrCode` with the Obálka plate. Fixed 2026-11-13 (R6): ink #211B12 on #FFFDF8, radius 8,
  the logo in its own colours with its tile exactly over the seven omitted modules (a test holds it).
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
  - the edge is drawn under every sheet (the owner, 2026-11-13: "draw under all"); until then it was
    drawn under fiction only, from InboxA's one contrast, and read as a pile;
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
  - I68 sending, done 2026-11-12: the stamp uncancelled for a 120 ms beat (the board names none; without
    it the stamp is never seen whole), the postmark landing at 1.06 to 1 in 140 ms with one firm haptic
    (`haptics.stamp`, impactHeavy - it replaces the success tap the send made before), its waves
    cancelling the stamp, then the envelope rising from the middle of the screen into its place in
    320 ms while the words and the record fade in. The board says the envelope "rises and fades"; the
    Sent board keeps it, so it rises and stays. Reduce Motion: the postmark and the rest crossfade,
    the haptic stays. Walked on Obalka_Demo, both ways. On Android Reanimated dropped the last frames
    of a `transform`, leaving the envelope 44-75 short of its place, so the rise animates `top` and the
    end is rendered as plain values; and a worklet that called an app function crashed the screen,
    which `__tests__/lint/worklets.test.ts` now refuses everywhere. Re-done 2026-11-13, found by the
    T036 capture: the plain end values did not hold - Reanimated's commit hook re-applied its last
    (short) frame over them, so the envelope ended about 40 low on the title and the words stayed
    pale. The moment now runs on core Animated, one clock 0 to 1 on the native driver (460 ms, 140
    with Reduce Motion) with each movement a stretch of it (`theme/motionClock.ts`, shared with the
    opening), its styles left on at their end. Walked on Obalka_Demo: the envelope in its Sent-board
    place, the words at full strength.
  - I69 unlocking, done 2026-11-12: on the first unlock since launch the seal splits with a light tick
    (`haptics.light`), each half tilting 14 and dropping 6 as it fades in 180 ms; the flap turns 180 on
    its fold (perspective 600) in 260 ms, starting halfway through the break - eased out, the halves
    are gone by then and a flap that waited stood still for 3 frames; then the cover dissolves in
    180 ms and the inbox is underneath. Later unlocks: the flap only, 180 ms, no tick. The board says
    "the inbox rises from inside"; the inbox comes up as the cover dissolves, the envelope opened over
    it. A failed scan: the seal nudges ±4 three times with the warning haptic, the refusal a blocked
    button gives. Reduce Motion: no seal, no flap; the old hold for the system's own checkmark
    (260 ms) and a 240 ms crossfade, the tick kept. Replaces the 260 + 240 ms cover fade; the panel's
    250 ms fade-in as the lock appears stays. Walked on Obalka_Demo. The steps are timed from the start, not chained: a sequence
    waited about 100 ms for JS between steps. And Android drew nothing of a view turned about a
    percentage origin (`50% 28.749999999999996%`), so the flap shut and vanished; the fold is in points
    and a test in `lockScreen.test.tsx` holds it.
  - I70 the window film's glint, done 2026-11-12: the glint (the sheen and its two bands) is its own
    layer, drawn 8 wider on each side, and follows the gravity sensor along the phone's width by up to
    8, closing 0.06 of the gap each frame and still once within 0.25. Only sideways: the board names no
    axis, and up-down has no level to measure from (a phone is read held at any angle). The sensor runs
    only while the window's screen is focused and the app in front (`useOnScreen`; on the device it was
    released 2 s after going home and taken again on return); with Reduce Motion the glint lies still.
    It moves by `left`: Android never drew Reanimated's transform here (the shift reached -7.6 and the
    glint stood still). Walked on Obalka_Demo with the emulator's virtual sensor: the band's centre at
    60 / 80 / 94 px tilted right / level / left. Not here: the scroll-out of a window that is still on
    a focused screen; it is a few small layers, and the sensor stops with the screen.
  - I67 opening a message, the opening done 2026-11-12 (owner's picks, 2026-11-12: the agreed Message
    layout, and the app's own transition). Opened from its row, the message fades in (150 ms, the
    native stack's `fade`) instead of the platform's push; the row's sender tile, measured where it was
    tapped, rests there while the message is read, then grows into the envelope in 280 ms, eased out,
    from the sender's colour to the envelope's blue, and the envelope's print takes over as it lands.
    The letter then rises 24 into its place over the envelope's edge in 280 ms, starting at 60 % of
    the flight. The Motion board's sketch has the letter settling over a shrunk envelope; the agreed
    Message board keeps the sheet coming out under the envelope, so it rises into that place. No
    haptic: the selection tick the list gave on opening is gone (the board: "reading is quiet").
    Opened from elsewhere (search, a notification, a sent row: no envelope) it is pushed as before,
    and the letter rises alone. Reduce Motion: the fade only. Walked on Obalka_Demo, cards and the
    register. Three Android findings: taking a native-driven style off the view once settled failed
    Fabric's prop assertion and killed the app, so the styles stay on at their end (a test holds it);
    the letter's own delayed animation waited for JS while the message rendered, 3-4 frames late, so
    one clock on the UI thread drives both, the ease sampled into the interpolation; and styles made
    on each render handed the view new nodes mid-flight, so they are made once. Not yet: iOS (the edge
    swipe-back with the fade must be walked on an iOS build).
  - I67 the tuck, done 2026-11-12: no board drew "scrolling down tucks the envelope into a 54 dp band
    with the window still showing", so board "Message, scrolled" proposed three; the owner chose B, the
    bar becomes the envelope (2026-11-12). As the envelope's last 54 slide under the paper bar, a band
    of its blue comes in over the bar: white chevron, "Odesílatel" and the sender (one line, an
    ellipsis), and the window with the recipient (no box ID, at most 150 wide); the status bar turns
    light while it is in. It follows the finger, no animation of its own, so Reduce Motion leaves it.
    The blue covers the bar over the first 27 and the print comes in over the last 27: one fade put
    the bar's title and the sender over each other (Obalka_Demo). The band grows at the largest text
    sizes instead of clipping the sender (2.0x). Walked on Obalka_Demo at 1.0x (the band's start moved
    up for the look: the demo messages scroll 25 dp) in both themes, and at 2.0x for real, down and
    back. Sent messages have no envelope and so no band.
- [x] T036 Capture each built screen in demo mode, both themes, and compare with its board. Done
  2026-11-13 on Obalka_Demo, light and dark, Czech and English: the inbox, the empty inbox, a message
  (opened, scrolled), the sent result; the lock was captured in T034. The built parts match their
  boards (InboxA, Empty, Detail, DetailDark, Sent); English fits without new wraps. Two bugs found and
  fixed in their own commits: the sent result ended 40 low and pale (I68 above), and an empty box with
  the other boxes' line showed blank paper (the line is a list section). What differs is not built
  yet, and waits for the build of R5-R14 below: the inbox strips (I16, R14), the box switcher and its
  menu (I54 R5, I55 R9), the sent rows (I19, R5), the reminder row (R7); the demo message has no
  reference number, so the board's "Č. j." line does not show.

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
  Raised in I46.4: English byte sizes keep the Czech decimal comma ("2,6 MB of 4,2 MB"); `formatBytes`
  knows one language.
  Raised in I11: R8's refusal card repeats its title as the first words of its body ("ISDS
  přihlášení odmítlo: …"), built as drawn; the error string could lose them.
  Raised by the owner for it (2026-11-13): the second envelope's edge under a sheet delivered by
  fiction read as a pile. Decided the same day, "draw under all": every attention sheet has it, done.
- [ ] T051 Canvas shows only agreed designs and matches the build; DESIGN.md records the objects, the
  families and weights, each component's anatomy and the rejected variants.
  The sync-back, where the build is right and the board is not (collected as they are found):
  - R4: the creases run past the round corners and the sealed flap leaves a blue rim at the top; the
    code clips both to the front (the owner's catch, 2026-11-13). No results has no board: it takes
    the hint's archive pose.
  - R5 switcher: the alert badge and "· Poslední známý stav" after a box's state (I-line above).
  - DetailDark draws the dark slip with a 1 px edge; R6 and R7 (newer) a shadow and no edge, built.
  - R6 QR: a 1.7-module quiet zone; the code keeps the 4 a scanner needs. Its plate is a simplified
    blue tile with a gold triangle; the code draws the logo itself.
  - R6 transfer: 22 under the label and 12/8/4 in the waiting block; R8 (newer) 10, built.
  - R8 puts the route above cancel; constitution V keeps the line that appears late last, built.
  - R8 SMS code: the boxes are 34 wide from the left; the owner wants them across the column, built.
  - R8 launch: a 4 bar; DESIGN.md has one waiting bar, 6, built.
  - R11 Pokročilé open: no Nápověda under the sheet; the build keeps the link on both states.
  - R11 environment: the "i" beside Prostředí is a mark; the help is always open under the switch.
  - R11 After a refusal: the two links 2 apart; two 44 targets cannot be, so the build sets each in
    its own 44 row. The phone also drops the alias field and Nápověda; the build keeps both.
  - R11 fields: no Nápověda under them; the build keeps it, help before sign-in (019).
  - InboxA: the edge only under the fiction sheet; the owner had it drawn under every attention sheet
    (2026-11-13), built.
  - R6 draws no hidden key: the build shows the warning and one 52 button.
  - R6 and R10 draw section labels with no icon; the code keeps them until R10 drops them all. A
    transfer's run has none already, as R6 and R8 draw it.
  - R8 transfer done: drawn for the receiving phone on its first run only. The sending phone ends in
    the same shape ("Odesláno." over what the other phone still needs), and from Settings Pokračovat
    goes back to the form; the button sits 12 above the inset, as the password change's done state,
    not 30 above the frame.
  - R10 stopped by going away: the board's sentence drops "dokud přenos neskončí"; the build says the
    string whole.
  - R7 sent: the stamp prints the cost; the archive has none, so the build's is blank (not-now.md).
  - R7 sent: "Odesláno" and "Dodáno" as two rows at one time; ISDS gives one, the build merges them
    into "Odesláno a dodáno" (017 T011).
  - R7 sent window: the name alone; the build adds the box ID and the address (015 US3).
  - R7 sent attachments are glyphs in wells; the build draws the Message board's document sheet.
  - R7 not downloaded: no line under the card; the build keeps what the download does (it saves the
    message, and does not deliver it).
  - R7 download glyph plane at .28 white; the build takes `envelope-plane` (.2), the same blue under it.
  Confirmed by the owner 2026-11-13, each as built: the blank sent stamp, the merged first row, the
  sent window's ID and address, the 4-module QR quiet zone, the full logo in the QR, the note under the
  download card; also the sender's 120 wrap on a sent envelope and the sunken bar track (R6).
- [ ] T052 Delete `docs/engineering/identity-pass.md` in the last commit.
