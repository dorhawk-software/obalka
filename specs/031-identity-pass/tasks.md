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

- [x] I01 iOS launch screen (`LaunchScreen.storyboard`, logo 96 on paper, both appearances) - **M**: the
  logo is the envelope mark (captured 2026-11-12, `cap/00`). Walked 2026-11-15 on the iOS simulator, light
  and dark: paper and the mark, then R1's welcome with nothing moving between them. It has no words, so
  the language does not reach it.
- [x] I02 Android launch (no splash theme; the system splash shows the adaptive icon on #2563A6) - **N**,
  then **fixed**: captured 2026-11-15, the splash stood on AppCompat's #FAFAFA and the screen turned to
  paper under it. Now the window background is the paper of each appearance (`res/values*/paper.xml`),
  and the splash takes it: paper, the icon, the blank paper, the app, in light and dark (no words).
  Held by `launchAndIcons.test.ts`, red on the old styles.
- [x] I02.1 Before the settings load: a blank view on the paper colour (`App.tsx` 178-186) - **N**, then
  **matches**: captured 2026-11-15 in both appearances, the same paper as the splash before it.
- [x] I03 JS `LaunchScreen` (loading: logo 84 + name + platform spinner; failed: retry) - **X**: a generic
  spinner where the product waits. R8. Fixed 2026-11-13: the lockup centred over all but the bottom
  120, one `WaitingBar` 120 wide at 84 (spoken "Načítání schránek"), and on a failure the message and
  a compact inline `NeutralButton` at 64 in its place; the outlined retry is gone. Roundings: the bar's
  4 to the one waiting bar's 6 (DESIGN.md); the retry's 46/13/14 to the neutral button's compact
  48/14/15. Walked both states light, dark and in English (forced on, reverted).
- [x] I04 `Welcome` (logo tile 120, Hero title, add box, restore, language, FAQ) - **X**: the envelope's
  biggest moment has no object. R1. Built 2026-11-15 as R1: the envelope (310×196, laid down -1.5°,
  its creases) with the window empty - "Komu" over two blank lines of round dots - waiting for a box;
  the name 36 under it, the tagline balanced; the dark action, the sunken restore with the archive
  glyph, the help a blue link; the language a sunken pill in the corner. A short phone scrolls rather
  than lay the two blocks over each other. Walked on Obalka_Demo beside R1 at full resolution, light
  and dark, Czech and English (forced on, reverted); the window first came out 2.5 short (R1's rows are
  14 over a 2 dotted border) and the dots square, both fixed. Rounded: the pill's 9 to 10, the window's
  9 to 10, the actions' 16 labels to `bodyStrong` 15.
- [x] I05 FAQ overlay and `FaqScreen` (accordion cards, Overline groups) - **D** (cards). Fixed
  2026-11-15: the answers are R3's sheets (`Card`), and the groups are headed as R13 heads a list -
  `GroupHead`, moved out of Licences for both: the overline 8 over the cards, the next group 18 under
  them (were 10 and 24), the ISDS disclaimer the muted quiet line under its overline (was a faint line
  with its own info icon). Walked light, dark and English; the overlay over sign-in is the same screen.
- [x] I06 `TelemetryConsent` (first run after the first box; two cards, two buttons) - **D** (cards).
  Fixed 2026-11-15: the two lists one R3 sheet with the inset divider (was full width), the notes
  R13's muted quiet lines (were faint), the longer answer R1's help link (44 with the slop; was a 15
  glyph over an 18 line), and the answers R6's pair of sunken neutral buttons at 48 - alike, as the
  screen's own rule asks; yes was filled in ink and no outlined, at 50. Walked light and dark (forced
  on, reverted); the Czech answers are the longer pair.
- [x] I07 `BackupScreen` first run (restore) - see I45. Built 2026-11-15 with I45.7.
- [x] I08 `AddBoxForm` - **D** (cards); the busy spinner is R8. The busy spinner went with I76.
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
- [x] I09.1 Android's SMS User Consent sheet over the code field (the system's) - **N**: seen in place
  2026-11-15, **matches**: the code form forced on (reverted) and an SMS sent to the emulator. The
  system's sheet rises over the form, quoting the message; Allow fills all eight boxes and wakes
  Confirm, which still waits for a tap. Light and dark (the sheet follows the phone); its words are
  the phone's language, the form's were walked in both with I09.
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

- [x] I14 Inbox header, one box (avatar 36, name, identity line, search, segmented) - **D**: board
  "Inbox - the envelope front" (flap band, window switcher, segmented on blue). Built in T030. Walked again 2026-11-15 at full resolution, each part cropped beside the board, light and dark, Czech and English (InboxA, R5's dark phone): the walk found the segments' words in Roboto, now Public Sans Bold
  (I107).
- [x] I15 Inbox header, all boxes (Layers tile, subtitle) - **X**: R5. Fixed 2026-11-13: `BoxStackTile`, the
  boxes' envelopes fanned (3 and 8 degrees, the board's 10 corner rounded to 11), the count on the
  front one; "Sloučený archiv · 3 schránky", no unread count (the board's).
- [x] I16 Inbox strips: reauth, password expiry, unified missing, stale, offline - **X**: not drawn under
  the envelope header. R5. Fixed 2026-11-13 (board R14): `InboxStrips.tsx`, a tone
  card inset 16 under the envelope, radius 12, minimum 44, no hairline, the 20 alert glyph, the action
  at 800; an expired password's two actions under the message (the board's 11 padding rounded to 12).
  The stale line is a sunken card, centred, minimum 32, its 10 corner rounded to 11, 8 under a strip.
  Copy stays the app's own (the board: "copy is the app's own"). The debug strip on the flap is I62's.
- [x] I17 Attention block and its rows - **D**: board Inbox (sheets with the second envelope's edge,
  flap tiles, fiction chip with the offset glyph). Built in T030. Walked again 2026-11-15 at full resolution, each part cropped beside the board, light and dark, Czech and English: as T030 lists; the English
  fiction chip takes two lines, its glyph and "?" in place.
- [x] I18 Received rows and month sections - **D**: board Inbox (day numeral, small sender tile, offset
  attachment and reminder glyphs). Built in T030. Walked again 2026-11-15 at full resolution, each part cropped beside the board, light and dark, Czech and English. The clip is the Icons board's, with its two
  lines; InboxA draws it without them (T051).
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
- [x] I22 Empty received - **D**: board "Empty inbox - the inside of the envelope". Built in T031. Walked again 2026-11-15 at full resolution, each part cropped beside the board, light and dark, Czech and English,
  through a temporary swap that emptied the list (no demo box is empty; removed): the open envelope, its
  lining and the words as the board's, the Czech hint on its two lines.
- [x] I23 Empty sent (paper-plane hero) - **X**: R4. Fixed 2026-11-13: the unsent pose, a dashed blank
  stamp and an empty window with dotted address lines; the heading lost its full stop.
- [x] I24 Empty, needs a new sign-in (CloudOff hero, "Zprávy zatím nejsou k dispozici") - **X**: R4.
  Fixed 2026-11-13: the addressed pose (an empty window, no stamp), 24 under the strip, not 60.
- [x] I25 Cross-box line ("Jinde: …") - **D**: board Inbox ("V ostatních schránkách …", Schránky glyph).
  Built in T030 ("Jinde:" when no whole clause fits). Walked again 2026-11-15 at full resolution, each part cropped beside the board, light and dark, Czech and English.
- [x] I26 Freshness line at the list's end - **D**: board Empty ("Naposledy dnes ve 14:02"). Built in
  T031. Walked again 2026-11-15 at full resolution, each part cropped beside the board, light and dark, Czech and English: under the last row and under the empty envelope.
- [x] I27 Drafts entry above the list - **X**: R5. Fixed 2026-11-13: one sheet (`DraftsEntry`), the draft
  glyph in a 36 well.
- [x] I28 Compose FAB (gold extended, pencil) - **D**: the blank stamp, board Inbox. Its stamp draws a
  frame late on a cold start (I107). Built in T030. Fixed 2026-11-15: a stamp shows nothing until its
  paper can be drawn at the measured size, then all of it at once (`objects.test`, red before). A
  40 s screen recording of a cold start on Obalka_Demo: the stamp's first frame is whole, gold and
  words together. Walked at full resolution beside InboxA, light and dark, Czech and English.
- [x] I29 Message detail, received - **D**: boards "Message - the envelope it came in" and "Message - dark".
  Built in T032. Walked again 2026-11-15 at full resolution beside Detail and DetailDark, light and dark, Czech and English: as T032 lists. Found: the English postmark's words ran round two thirds
  of the ring (104 of its 157 against the Czech 135); they are "DELIVERED · DATA BOX · ISDS ·" (133),
  and the sent one "SENT · DATA BOX SYSTEM · ISDS ·" (145, the Czech 145; it was 79). Held by
  `postmarkRingWords.test`, red before.
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
- [x] I32 Fiction banner - **D**: board Message (gold band with "Připomenout"). Built in T032. Walked again 2026-11-15 at full resolution beside Detail and DetailDark, light and dark, Czech and English.
- [x] I33 Delivery record (Doručenka card, dotted rail) - **D**: the slip, board Message. Built in T032.
  Walked again 2026-11-15 at full resolution beside Detail and DetailDark, light and dark, Czech and English.
- [x] I34 Term card, "alerts off" line, deadline suggestion (scan) - **X**: not on a board. R7.
  2026-11-13: the reminder row matches R7 (56, 8/12, its glyph in a well, 14/600 over 13/500, the
  muted chevron), walked; the "alerts off" line and the scan suggestion are still today's.
  Done 2026-11-15, no board drawing them (T051). The scan suggestion is R14's strip, the agreed tone
  card with answers: the estimate's sunken tone with no outline (was a 1 px border on it), radius 12,
  12/14 in, the offset deadline glyph at 20 (search while it looks), the bold small title, the
  evidence in Meta, the disclaimer faint, and the answers as links under the words (`StripAction`):
  taking it is the user's own reminder, so that link is in the reminder's blue; hiding it is muted.
  It was two 40 buttons, a filled blue one and an outlined one. While the scan runs, the one waiting
  bar (R8) in place of the platform's spinner (I76); laid on the sunken paper its own sunken track
  vanished, so `WaitingBar onSunken` takes the toggle's off track, `borderStrong`. Both states keep
  the 108 floor (constitution V). The "alerts off" line stays the card's footer under its hairline
  with the link in the reminder's blue, as walked; its Lucide alert glyph goes with I78. Held by
  `deadlineSuggestion.test` (no outline, radius 12, links without a fill; the waiting bar on the
  `borderStrong` track, no spinner), red before. Walked through temporary swaps (removed), light
  and dark, Czech and English, the suggestion and the scan.
- [x] I35 Attachments: none, unavailable, downloading, not downloaded, missing, corrupt, opening, saved -
  **D** for the saved row (board Message); **X** for the other states, R7. 2026-11-13: not downloaded
  matches R7 (one card, the attach glyph in a well, the blue download inside it at 48 / 13 with the
  offset download glyph, 15/700), walked; the other states are still today's.
  Done 2026-11-15, no board drawing them (T051): R7's card anatomy for each. The files that went
  missing keep the soft-gold notice DESIGN.md gives them, its outlined surface button now R7's blue
  download (`DownloadButton`, shared with the not-downloaded card); a message gone from ISDS is R7's
  card with the attach glyph in its well and nothing to press (its 22 above rounded to 24); a file
  that cannot be opened (missing, undecodable) is its own sheet at the app's .55 dim with the red
  words, no longer an alert glyph in a well. Downloading stays the quiet line over the progress bar
  (R8); none stays the muted line; opening's spinner goes with I76. The cards moved to
  `AttachmentCards.tsx` (MessageDetail 1053 -> 985 lines). Held by `messageDetailDownload.test` and
  `attachmentRows.test`, red before. Walked through temporary swaps (removed), light and dark,
  Czech and English.
- [x] I36 Signed original (ZFO) row - **D**: board Message (Pečeť glyph in a well). Built in T032.
  Walked again 2026-11-15 at full resolution beside Detail and DetailDark, light and dark, Czech and English; the stored row through a temporary swap (no demo message holds its original). The offer to
  fetch it is the stored row's anatomy. Gone from ISDS, it kept a file-x glyph: it is the seal, faint
  (`signedOriginalSection.test`, red before); `FileXIcon` is gone.
- [x] I37 Test-environment banner (`StatusStrip` test tone, flask) - **X**: the airmail strip. R7. Fixed
  2026-11-13: `TestEnvBanner` lays the existing `AirmailStrip` over `surface-alt`, the band 28 with 16
  sides, the Badge label in ink taking the row's width (dark cut "prostředí" off before), no glyph or
  hairline; StatusStrip lost its `test` tone. Walked light and dark by forcing it on (no czebox box on
  the demo), reverted.
  - [x] I37.1 Walk it in place, under a czebox box the owner signs in on Obalka_Demo (owner,
    2026-11-13): the header straight under the strip, no second status-bar gap. Walked 2026-11-13 on
    the owner's test box, a sent message, light and dark: the strip takes the status bar (132 px) and
    its band; the header's title sits 79 px under it, as it sits under the bare status bar.
- [x] I38 Compose - **X**: the envelope you are sending (R2, agreed A).
  Built 2026-11-15 as R2 and R12: compose is one envelope (`ComposeEnvelope`, creases 358×188) with Od
  on it, Komu in its window - the search field until someone is picked, ringed in the flap gold while it
  has the caret - and the stamp in its corner, a blank dashed slot until a recipient sets the price.
  The letter (subject, text, hint) is a sheet tucked under the envelope; results, drafts and attachments
  are sheets below it; the footer is R12's (surfaceAlt, no hairline). ComposeScreen 1343 → 776 lines.
  Walked at full resolution beside R2/R12 by swapping states in (all reverted): free light, paid dark,
  credit short, searching, results with namesakes, reading and sending, no sender, drafts, English light
  and dark. Rounded: 7→8, 9→10, gap 1→2; the stamp's corner 3→8, the letter's top 4→8; Od's name
  16/800 → Subheading 15/700, the stamp's price 22 → Title 21, the window's name 15/20 → 15/19.
  - [x] I38.1 Sender gate (no box can send; dimmed placeholders). R12 "No sender yet": the same envelope,
    the stamp blank, Od a dashed slot to choose the box, the window and the letter faint (.55, .45).
  - [x] I38.2 Sender card and the change; recipient card, its type and the change. Od on the envelope
    with its chevron; the window holds the recipient's name and address (or kind and ID), tap to change.
  - [x] I38.3 Recipient search: searching, error, none, results, the same-name hint, the hint. One line
    under the window (R12's ring spinner, the muted none, the danger error); results as sheets.
  - [x] I38.4 The stamp: free, paid, credit short with "buy credit". ZDARMA/PLACENÁ with the price and
    the kind; the credit under Od only beneath a paid stamp; short credit is R12's danger strip and
    the footer's refusal with "Koupit kredit".
  - [x] I38.5 Subject, text and its hint (the text becomes a PDF). The fields and hint are built on the
    letter sheet (2026-11-15). The PDF is R12's Czech A4 letter since the same day: 25 mm sides, 20 top
    and bottom, the sender and the mark, the recipient a part per line, the date at the right, the
    subject in Bricolage, the text in Public Sans 10.5 pt, the foot line at the page's bottom; its words
    in the app's language. Rendered on Obalka_Demo, pulled and laid over R12's page at the same size:
    every line in place. The place before the date is not printed (the app does not know it).
    Walked on iOS the same day (iPhone 18 Pro simulator, Xcode 27): laid out at a pixel a point it
    printed 0.8 small - WebKit's print shrink - and on the library's off-white; now 1.25 px a point and
    the `printPage` white, and the iOS page matches Android's line for line.
  - [x] I38.6 Attachments: rows with remove, reading with its progress and cancel, the dashed add. The
    reading card holds its place; the add link lies over it, so nothing moves when reading starts.
  - [x] I38.7 Footer: errors (too large, attach, PDF, sign in again, send), send busy. Busy is R12's
    ring spinner in the button's ink; the dimmed button fades as one layer (Android).
- [x] I39 Compose sent state (emblem, ID, Done, Open sent) - **D**: board "Sent - the stamp is cancelled".
  Built and walked as T033 (both themes, free and paid), the postmark landing as I68, the English ring
  closing as the Czech (2026-11-13).
- [x] I40 Paid-send confirmation (modal, credit card tile) - **X**: R2. Built 2026-11-15: R9's `Dialog`
  (R9 took this sheet as every question's shape) with R2's paid stamp on it at 112×92, tilted 2° in its
  own drop shadow, the question, the words, and the box's credit as a muted line (it was a sunken
  panel under a card glyph). Walked beside R2 aligned at the sheet's top, light and dark, English.
- [x] I41 Draft rows (swipe to discard, snackbar Undo) - **X**: R2 (Koncept glyph). Built 2026-11-15 as
  R12's sheets (the glyph in a 36 well, Zahodit in danger), walked beside R12; the swipe and Undo kept.
- [x] I42 Search: hint, skeleton, no results, results - **X**: R4 (hint, no results), rows as I18.
  Part built 2026-11-13: the hint and no results draw the archive pose (a stack of three envelopes, a new
  `envelopeBehind` #22508A for the middle one); the field is a paper well with the offset search glyph
  (18, muted), no outline, the placeholder muted, in Public Sans - every `Input` had fallen back to the
  system face (owner's catch). No results is not on the board: it takes the hint's pose. Rounded:
  the no-results top 96 -> 60 (the empty step), the body width 280 -> 300 (the board's). The result
  rows and their skeleton built 2026-11-15: the register's own (`RegisterRow`, `SentRegisterRow`,
  `RegisterSkeleton`, the month heads), each with its box pill since a search spans every box, and the
  reminder a hit has; the rows wait for the reminders so no mark arrives late. Walked on Obalka_Demo
  beside the inbox, light and dark, English: the same rows. `searchRowLabel` went with the old row.

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
- [x] I44 FAQ entries and the delivery legend - **D** (cards; the legend's state glyphs follow I33).
  Seen 2026-11-15 with I05: the entries are sheets, and the legend draws the five marks from the same
  `DeliveryStateIcon` the rows and the slip use (sent, delivered, by sign-in, by fiction, stopped),
  light and dark, on the sunken block.
  2026-11-13: the cards are sheets now (Card), walked dark; the line ticks with R13's rest.
- [x] I45 `BackupScreen` - **X** for the key and QR: a slip on the security tint (R6). The rest:
  - [x] I45.0 The key and its QR - **X**: R6. Fixed 2026-11-13: `SecureSlip` (the surface-alt panel,
    radius 16, the tint measured to it) holds the key three groups and two in `code` 20/28, the QR plate
    and its hint; the warning and the pair of sunken buttons (48, radius 14) under it, one button at
    52 while hidden. Walked light and dark beside R6: matches but for the 4-module quiet zone, the full
    logo for the board's simplified plate, the label icon (R10) and the known text width.
  - [x] I45.1 Backup: the toggle (loading skeleton), last, never, a running stage with its count and
    progress bar, verify, back up now - **N**: R9.
    Fixed 2026-11-15 to R10, with the rest of I45: the archive's well, the switch and the last
    backup in one row; under it one slot - what backing up does, or the run's stage, count and bar
    laid over it, so nothing under the card moves when a run starts (constitution V; R10 only
    adds the stage, which would push the page down); Zálohovat nyní and Ověřit zálohu as R6's sunken pair at 48,
    dimmed while a run goes on (was a filled bar and a link row). The overline is R10's "Záloha".
  - [x] I45.2 Scope: documents toggle, measuring, the mode chip, auto, where, how - **N**: R9.
    Fixed 2026-11-15 to R10, with the rest of I45: what is (not) in the backup is the group's quiet
    line under its overline (FR-008 keeps it beside the switch; R10 leaves it out); the attachments
    switch and "Které přílohy" with the mode as R10's chip and Změnit; auto and where as quiet lines
    under the card; how it is sealed as R1's help link.
  - [x] I45.3 Advanced: auto, keep, the keep-count segmented control - **D** (cards).
    Fixed 2026-11-15 to R10, with the rest of I45: the lines muted 13/17 (were faint meta), the keep
    count in the card under its switch as R10 opens a backup (was a tinted block).
  - [x] I45.4 Restore list: loading, none, rows (documents chip, size and version, too new,
    unsupported, documents missing, held), swipe to delete or its menu under Reduce Motion - **N**: R9.
    Fixed 2026-11-15 to R10, with the rest of I45: the date over "size · verze x", the chip and the
    chevron at the end; a held one's reason in danger; one this build cannot read dimmed whole, with
    no chevron (R10 draws one; it opens nothing). The documents chip has DESIGN.md's 8 corner and the
    blue info tone for both kinds that hold attachments (was a pill, "downloaded only" in gold).
  - [x] I45.5 An opened row: key input, scan, start, delete, use the stored key - **N**: R9.
    Fixed 2026-11-15 to R10, with the rest of I45: the key field on the page's tone, no border;
    the scan and the stored key as flush blue links with their glyphs; Smazat (neutral, danger ink) and
    Obnovit (filled) side by side at 48 (was a 44 Obnovit over two links, Smazat a red link).
  - [x] I45.6 File export and import; restored, notice, error; Continue - **N**: R9.
    Fixed 2026-11-15 to R10, with the rest of I45: two rows in ink with the file-down and
    file-up glyphs (were blue links), why a file is the group's quiet line; restored and notice as
    quiet lines; a failure as the transfer's danger block (was a red line).
  - [x] I45.7 First run (restore only, its own snackbars) - **N**: R9.
    Fixed 2026-11-15 to R10, with the rest of I45: the sentence about a saved file heads the screen,
    then receiving (the transfer glyph in its well, "Přijmout do tohoto telefonu"), the list, the
    file - R10's order (the file was before the list). Walked through Welcome (forced, reverted).
- [x] I46 `TransferScreen` - **X** for the code phrase and QR: a slip (R6). The rest:
  - [x] I46.0 The phrase and its QR - **X**: R6. Fixed 2026-11-13: the same slip with the overline,
    the phrase three words and two with faint dashes (the board's 22 rounded to the `code` 20), the
    hint, the backup's two meta lines and the QR at 195; the stage, the bar, keep-open, the cancel link
    and the route as plain lines under it (R8's 10 between, the route last). Walked light while
    connecting beside R6.
  - [x] I46.1 Not available here (the card) - **N**: R9. Fixed 2026-11-13 to R10: the overline
    with no icon, one card with the sentence in muted 14/20 at 16. Walked forced, light and dark.
  - [x] I46.2 Send: pick a backup (none: a link to create one), the option group, the note, send -
    **N**: R9. Fixed 2026-11-13 to R10: the backups as one card of choices, each its date over "size
    · what it holds" (the chip's words as text), the note in muted 13/17 10 under it, the send as
    the filled button 16 under that; none is a card with a heading, its words and a link with a
    chevron. Receiving is a row with the transfer glyph in its well, 26 under (18 + 8), which opens
    a screen of its own (`TransferReceive`). Walked beside R10, light, dark and English.
  - [x] I46.3 Receive: the description, the hint, scan, the phrase field, start - **N**: R9. Fixed
    2026-11-13 to R10: the words in body colour, scan as the neutral button with the scan glyph,
    the field, the hint in muted meta, Přijmout as the filled button 8 lower, at .55 until something
    is typed (and refused with what is missing); a failure is the danger block in place of the
    words, the hint gone. Walked beside R10 (empty, typed, a wrong phrase), light, dark and English.
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
  - [x] I46.6 First run, receive only - **N**: R9. The same receiving screen as I46.3 (built); still
    to walk on a first run, which needs a phone with no boxes. Walked 2026-11-15 from the first-run restore
    screen (forced, reverted): the same receiving screen.
- [x] I47 `DebugScreen` (level, start/stop/saving, counter, files: loading, failed, empty, rows with
  share and delete) - **N** (cards). Fixed 2026-11-15 to R13: the intro in body text, the two notes as
  meta lines under the choices, Spustit záznam as the 52 filled button; while recording one card
  (14 in, 10 apart) with the dot and the counter in 14/20 bold, the hint, Ukončit a uložit and Zahodit
  záznam, the choices at .55 above it; the saved notice as the blue strip 10 under the start (a
  failure in the danger tint), held from the stop press so the save's end only fills it; the files as
  one card of name, size, and Sdílet beside Smazat (40, the 12 corner, 14/700, Smazat in the danger
  ink); nothing saved is a muted line with no card. The failed read (not drawn) is that line's words
  with Zkusit znovu as a link under them. Walked light and English against R13 (idle, recording,
  saved, failed forced), and dark on the theme's tokens: R13 draws no dark debug phone.
- [x] I48 Licences (logo 40, search, no results, groups), licence group, licence text - **N** (cards).
  Fixed 2026-11-15 to R13: the app's card (logo 40, the name in the heading role, Licence MIT, the
  copyright, four meta lines of the licence) opens the whole text with its notice; the search 44 on the
  page's tone with the offset glyph; the bundled components and one row per licence (the owner,
  2026-11-15: no samples), each row a name over its line, the chip and the chevron; a licence's screen
  titled with its count, the full-text link, its own search and its rows; one component's text titled
  with its name over version and licence, the text flowed (the owner, 2026-11-15; spec 012 amended)
  with its copyright under the licence's title; no results as the glyph in a 96 disc and one sentence.
  Walked light against the four R13 phones, dark (no dark board) and in English.
- [x] I49 What's new sheet and Changelog - **D**: the sheet (I53). R9. Built 2026-11-15: the title in
  the title role, since which version and how many changes as the sheet's muted line, each kind an
  overline over a list, each change one paragraph - its sentence in the bold small role in ink, the
  rest in body text - behind a faint 5 dot held to its first line; no cards. Pokračovat is the filled
  52 button (it was the 48 ContinueButton), pinned. The Changelog screen shares the list (no board
  draws it). Rounding: the 22 above Pokračovat is 24. Walked light and dark, Czech and English, forced
  from "seen 1.0.0" against R9's phone (its 5 changes; the real 1.1.0 has 6).
- [x] I50 Lock screen (brand tile 104, lock glyph, unlock, failure slot, reset link) - **D**: board
  "Lock - sealed" (tint, sealed envelope, wax seal). Built in T034 (2026-11-12), the unlock's motion
  since; checked again 2026-11-15 on Obalka_Demo against the board, the lock turned on for it and off
  after: as T034 lists.
- [x] I51 QR code scanner (viewfinder, hint, cancel; camera denied; no camera) - **N**. R13. Built
  2026-11-15: the picture dimmed (`cameraDim`, black at .45 in both themes) around the envelope's
  window - 260, the 24 corner, a 2 white edge at .9, the window's own film and glint - its top 230/844
  down the screen, as the lock places its envelope; under it a sheet (surfaceAlt, the 24 corner) with
  the hint in ink and Zrušit as the neutral button with its cross. The hint was `surfaceAlt` on the
  dark ground, unreadable in dark (R13's note). Without the camera, also while the system asks: the
  camera in a 56 well (`Well large`), the sentence, Zrušit. Roundings: the sheet's 22 above its words
  is 24; the words' 14/600 is smallStrong. Walked on Obalka_Demo with the emulator's scene camera,
  light and dark, Czech and English, declined in dark and while asked in light; no camera only in the
  tests (the emulator has one). The camera permission put back as it was.

### Sheets, dialogs, menus

Re-graded 2026-11-12, after the owner asked where the modals were: the first grading called the chrome
here "matches" from the code alone, without a drawing. With Cards B agreed (sheets with weight) every
surface below changes too, and the owner has seen none of them in the identity. All go on board **R9**
(round 2).

- [x] I52 `Dialog`, the anatomy (scrim .45, card max 420, radius 20, scrolling, actions in a row or
  stacked above two, primary / danger / neutral, icon) - **D**: the sheet weight from Cards B; its fade
  ignores Reduce Motion (I73). R9. Each use is a line, I84-I105. Built 2026-11-15
  as R9's "paid-send sheet, for every question": `Dialog` is a `BottomSheet` - the grabber, the
  object (drawn as it is) or a glyph in a 56 well, the title in the title role, the words in body text,
  all centred, and the answers stacked 8 apart under them, the filled or danger answer first and the
  neutral last (`InkButton` gains `danger` and a glyph). It rises and closes as every sheet does, a
  fade under Reduce Motion as R9 says; its words scroll and its answers never do (the 2026-09-15
  guard, restated for the sheet). Roundings: the 22 above the object and the answers is 24; R9's 30
  glyph is the well's 28 (R13 draws 28; one well). The uses R9 draws: I89 walked; I84 (`boxes`) and
  I104 (`transfer`) have their glyphs, walked with their lines.
- [x] I53 `BottomSheet` (Language, What's new, Term picker, Sender) - **D**: the grabber, the sheet's
  surface and shadow from Cards B. R9. Built 2026-11-15: 10 above and 24 at the sides (it was 14), the
  grabber alone at the top, the title in the title role 16 under it (it was Bricolage 16/700), an
  optional muted line 6 under that; each sheet's content brings its own distance (a card 14 under the
  title). Found on the device: the scrolling content clipped a card's resting shadow below and beside
  it; the scroll view now reaches 8 past the sides and 16 below and pads them back (a guard test,
  proven to fail without it). The Term picker kept its own header, 16 under the grabber, until I57.
  Seen once in English dark, not again in seven launches: the sheet's slide-in stopped part-way, with
  Pokračovat below the screen (T050).
- [x] I54 Box switcher sheet, `BoxRow`, `UnifiedRow` - **D** (avatar, Schránky glyph). R5 shows it. Fixed
  2026-11-13: envelope tiles at 40, the merged entry's fanned tile (no summed badge), the check in gold
  ink, the add row filled (sunken, 52, radius 12), the offset settings glyph. Kept against the board,
  both from the owner's own reports: the alert mark on a broken box's tile and "· Poslední známý
  stav" after its state; for the canvas's sync-back.
- [x] I55 Box overflow menu (rename, change password, remove) - **D**: the menu's surface. R9. Built
  2026-11-15 as R9's popover beside the ⋯ (it was a bottom sheet with the box's name over the rows):
  230 across, the 14 corner, the surface with R9's popover shadow (`objectShadow('popover')`, light
  and dark), rows 48 with the glyph 12 before the bold small words, a hairline above Odebrat in the
  danger ink; under the ⋯ with its right edge on the ⋯'s, or over it where the screen ends (walked:
  the lowest box opens upwards). No scrim; a tap outside, back or backgrounding closes it. Rounding:
  its 3 over the ⋯ is 2. Walked light and dark, Czech and English; line for line with R9 in light
  bar the glyphs (T051).
- [x] I56 `AliasEditor` (avatar preview, colour swatches) - **D** (avatar). R9. Built 2026-11-15 as
  a sheet (`BottomSheet`, which now rises over the keyboard): the envelope tile at 56 for the avatar,
  taking the name and colour live, beside the name and identity line; the chosen colour ringed outside
  its edge and checked; Uložit alone (Zrušit went: the sheet closes as every sheet does). Roundings:
  the tile's 15 corner is 16, the 20 above Uložit 18, the field's 15 inset 16, the ring's 3 off the
  swatch 2 (its corner then on the 16 step). Walked light and dark, Czech and English, typing with the
  keyboard up; matches R9 in light.
- [x] I57 `TermPicker` - **D** (icons: Připomínka). R9. Built 2026-11-15: the reminder's glyph in a
  well beside the title (title role), the promise in small muted text 8 under them, the presets one
  card 14 under, rows 50 with an inset hairline and their labels in smallStrong, the custom row's
  steppers 36 (Tamagui's button had made them 44) with the 11 corner rounded to 12, and Odebrat
  (danger ink, only when a reminder is set) beside Uložit, 18 under the card. Walked light and dark,
  Czech and English; line for line with R9 in light.
- [x] I58 Sender sheet - **D** (avatar). R9. Built 2026-11-15: rows 60 with the box's envelope tile
  at 36 in place of the avatar, and the Language rows' radio - a ring, blue with a 12 blue dot when
  chosen - in place of the filled disc. Walked light and dark, Czech and English; matches R9 in light.
- [x] I59 Language sheet - **D**: the sheet (I53). R9. Built 2026-11-15 with I53: the card 14 under
  the title. R9 draws its rows at 56; they are the Settings language rows (`OptionGroup`), which R13
  draws at 52, so one control keeps one height (constitution V): 52, for the canvas's sync-back.
  Walked light and English through a temporary swap (Welcome opens it; the demo has boxes).

### Transient surfaces

- [x] I60 Snackbar (ink pill, gold action, 4.5 s, 10 s with a screen reader; enters 220 ms, no exit
  animation) - **N**: R9. Built 2026-11-15: 16 in from the sides (it was 12), 52 at the least with
  the 14 corner, R9's shadow, the words in smallStrong 16 over and under (it was the 15 Value role),
  the action a 44 row 12 at its sides in the flap's gold (`goldBright` is now R9's #FFC305; it was
  #F5B81E). It stands 6 over the compose stamp while the stamp is on screen (`useSnackbarLift`; it
  lay over the stamp), 14 over the bottom edge elsewhere; it rises 220 ms and fades out 220 ms, and
  under Reduce Motion only fades (it appeared at once). At night it takes a faint white edge (R9
  draws no dark snackbar; T051). Measured: 52 tall, 16 in, 6 over the stamp.
- [x] I60.1 Draft snackbars: saved, discarded, Undo - **N**: R9. Seen 2026-11-15 on the inbox over
  the stamp, Czech and English, light and dark, through a temporary swap that shows "Koncept zahozen"
  with its Vrátit zpět; line for line with R9.
- [x] I60.2 Backup snackbars: exported, imported, verified, verify failed, prune or settings failed, "not
  stopped" - **N**: R9. Seen 2026-11-15 through the same swap with the longest, the English failed
  prune: two lines, 16 over and under, the right side 16 with no action (R9's 6 makes room for one).
- [x] I61 Shell notices (removal, alias - dialogs) - **D**: the dialog (I52). R9. Built 2026-11-15: they are I84-I86, each with its glyph. Walked 2026-11-15 light and dark, Czech and English, through a temporary gallery that opened all 22 in turn (removed).
- [x] I62 Debug recording strip (takes the top inset on every screen) - **N**, then **fixed** to R14:
  captured 2026-11-15, the inbox wore the chrome strip above its envelope, which no longer reached the
  top. Now the inbox prints it on the flap under the status bar (`StatusStrip` tone `flap`: no fill, no
  hairline, `onGold` words and chevron, the dot in the new fixed `dangerOnFlap` because the dark
  `danger` measures 1.80 on the gold), and the window moves down 32 as R14 draws it. Every other
  screen keeps the chrome strip, the header's tone. Cropped beside R14 at full resolution; walked light
  and dark, Czech and English, inbox and Settings, and the flap strip opens Debug. Roundings: the
  strip's 30 to the shared 28 row, the 2 under it to `xs` 4 (the window's 32 kept).
- [x] I63 Notifications: deadline reminder and password nudge (small icon `ic_notification`, colour
  #2A5C9A) - **D**: the accent becomes the envelope's #2563A6; the glyph is the envelope already.
  Built 2026-11-15: the tint is the theme's `envelope`, not a copy of it; held by a notifier test, red
  on the old blue. The shade's look is walked with I128.
- [x] I64 `ic_notification_alert.xml`, referenced nowhere - **D**: delete. Deleted 2026-11-15.
- [x] I65 App icons (iOS set, Android adaptive on #2563A6) - **N**: envelope and flap; check the flap at
  the smallest size. Seen 2026-11-15 on the launcher, the splash and at 40 px in every appearance:
  **matches**, the flap reads at the smallest size. The iOS set became one 1024 per appearance; Xcode
  draws the sizes (`actool` compiled it, the app's catalog holds all three).
- [x] I65.1 No dark or tinted iOS icon and no Android monochrome (themed) layer - **X**: the envelope
  drawn for each; a board in R8. Built 2026-11-15 by `scripts/gen-app-icons.py` from the shipped
  envelope's paths in R8's colours: dark is the blue envelope, gold flap and two folds on #17140F,
  tinted is greyscale on black; the Android monochrome layer is R8's outline as a vector. The board
  draws its own envelope, rounder than the shipped one; the icon keeps the shipped drawing (one object,
  one drawing), for the canvas to take back (T051). Seen on the Pixel launcher with themed icons on,
  beside R8's drawing.
- [x] I66 Privacy covers (iOS launch storyboard, Android cover below API 33) - **N**, then **matches**:
  2026-11-15. iOS: the snapshot the system stored when the app went to the background is the paper and
  the mark, in each appearance, never the screen. Android: a build that forced the cover on (reverted)
  showed it in the overview, the paper and the round icon, light and dark. No words.

### Motion

- [x] I67 Opening a message: the letter rises out of its envelope (280 ms) - **X** build, board Motion.
  Built and walked with T035 (below); on iOS too since 2026-11-15, where the swipe back was fixed.
- [x] I68 Sending: the postmark lands when ISDS accepts (haptic) - **X** build, board Motion.
  Built and walked with T035 (below), captured in T036.
- [x] I69 Unlocking: the seal breaks, the flap opens (cold start; later the flap only) - **X** build,
  board Motion; replaces today's 250 ms panel fade and 260 + 240 ms cover fade. Built and walked
  with T035 (below), the lock captured in T034.
- [x] I70 The window film's glint (tilt, `useAnimatedSensor`, only on screen) - **X** build, board Motion.
  Built and walked with T035 (below), with the emulator's virtual sensor.
- [x] I71 Edge swipe back (160 ms settle) - **N**: follows the finger; its settle ignores Reduce Motion.
  **M**, walked 2026-11-15. Since the iOS fix (I67) the swipe is the native stack's own: UIKit's
  interactive pop on iOS, the system's back arrow following the finger on Android, then the pop. The
  hand-made 160 ms settle (`EdgeSwipeBack`) is left only on the screens outside the stack (first run,
  restore, the FAQ), on iOS, where it is a `withTiming` with no `reduceMotion`, which Reanimated 4.4
  reads as the system's: under Reduce Motion it lands at once. A gesture follows the finger in either mode; that is direct manipulation,
  not a moment.
- [x] I71.1 Native-stack push and pop between screens - **N**: the platform's own; checked under
  Reduce Motion on both. **M**, 2026-11-15: Android's push to Settings is the platform's crossfade, and
  with the animation scales at 0 it is a cut; a message opened from the list fades in 150 ms (I67).
  iOS pushes with UIKit's own slide, which UIKit keeps under Reduce Motion as every iOS app does; not
  walked under Reduce Motion on the simulator, since its app would sync from ISDS on launch.
- [x] I72 Sheets' slide-in (240 ms), the overflow menu, drag to dismiss - **N**: the slides honour
  Reduce Motion, the drag's settle (180/160 ms) does not. **Fixed** 2026-11-15, and the grade was
  wrong: the settle's `withTiming` has no `reduceMotion`, which Reanimated 4.4 reads as the system's,
  so it lands at once under Reduce Motion. The walk found worse: on Android no sheet moved under the
  finger at all. A `Modal` is a window outside the app's gesture root, and neither `BottomSheet` nor
  the box switcher had one of its own. Both have it now (`sheetGestures.test`, red before the fix).
  Walked on Obalka_Demo: the switcher follows a drag, springs back short of 90, dismisses past it;
  under Reduce Motion the same, the spring-back a cut. The ⋯ menu is a popover since R9, with no pan.
- [x] I73 `Dialog`, sheet scrims and `AliasEditor` use `Modal animationType="fade"` - **D** (rm): no
  animation under Reduce Motion. **Left as it is**, 2026-11-15: three Modals are left (`BottomSheet`,
  the switcher, the ⋯ menu; `Dialog` and `AliasEditor` are sheets in them). Their fade is the Reduce
  Motion form the Motion board asks for ("each becomes a crossfade"), so there is nothing to turn
  off. Android with the animation scales at 0 cuts it; iOS keeps the fade. In not-now.md.
- [x] I74 The paid-send confirmation slides (`animationType="slide"`) - **D** (rm); R2 may replace it.
  Gone 2026-11-15 with I40: it rises as every sheet does (`BottomSheet`); the app has three Modals.
- [x] I75 Skeleton pulse, waiting bar, sync bar - **N**: loop only while work runs. Under Reduce Motion
  the waiting bar is an empty track and the stage line beside it carries the meaning: shown on R8.
  **M**, 2026-11-15: the skeleton pulses only while mounted and stands at 0.7 under Reduce Motion; the
  waiting bar's loop (`ProgressBar`) runs only while work does and is an empty track under Reduce
  Motion, walked on the launch with the animation scales at 0.
- [x] I76 Platform spinners in 11 places - **X**: R8 decides where an object waits instead. The Mobile Key wait's
  spinner is gone (I10, 2026-11-13), and the launch's (I03); the deadline scan's (I34, 2026-11-15)
  takes the waiting bar. Counted in the code that day, nine left: debug files, attachment opening,
  the signed original, compose (2), re-auth, password change, add box, the SMS code. Compose's two
  are R12's ring spinner (`ArcSpinner`, 2026-11-15), and so are the other seven the same day: on the
  paper in blue (debug files' retry, an attachment opening, the signed original), in an ink button in
  its words (re-auth, password change, add box, the SMS code). Tamagui's `Spinner` is no longer
  exported and `noPlatformSpinner.test` fails on any platform spinner in src. Walked on Obalka_Demo:
  an attachment opening, and add box's busy button light and dark.
- [x] I77 Press dip, refusal shake, FAB press, segmented slide, radio fill - **N**. **M**, 2026-11-15,
  each answering a touch and each off under Reduce Motion: the dip 0.97 in 90 ms (`PressScale`, the
  FAB's own the same, filmed on Compose); the refusal shake ±4 in three 50 ms steps with a warning
  haptic, the haptic alone under Reduce Motion (read in code, held by `pressScale.test`); the
  segmented thumb 200 ms, filmed sliding and, under Reduce Motion, jumping; the radio fill 140 ms,
  filmed in Settings › Appearance shrinking from the old choice and growing in the new.
- [x] I77.1 Haptics: 31 call sites (selection, light, medium, success, warning, error) - **N**: listed
  against the motion rule (a thump where paper lands). **M**, counted 2026-11-15: 38 calls now, every
  one answering something the person did, none on its own. One heavy thump, where paper lands: the
  postmark (`stamp`, SentResult). Light: the seal splitting on unlock, the FAB, the ⋯ menu opening,
  the switcher's add and settings rows. Medium: a swipe action committed. Success: the three ends of
  a transfer. Warning: a refused press, a refused unlock, the paid-send gate. Error: a failed send.
  The other 24 are selection ticks on a switch, a pick or an opened attachment.

### Icons and leftovers

- [x] I78 The offset icon family in `src/theme/` and the map from today's Lucide wrappers (Mail, Send,
  Pencil, Search, Paperclip, ShieldCheck, Timer, Layers, Archive, Download, File and the custom
  settings glyph) - **D** build. **Fixed** 2026-11-15. The family is `offsetIcons.tsx` (21 glyphs);
  the map, by what each Lucide glyph said: Mail → `inbox`, Send → `sent`, Pencil → `compose`, Search
  → `search`, Paperclip → `attach`, ShieldCheck → `lock`, Layers → `boxes`, Archive → `archive`,
  Download → `download`, File → `attach`, settings → `settings`, all moved over in the screens'
  rounds. The last, Timer on a sent message's fiction countdown, takes `fiction`, the envelope with
  its clock the inbox prints (15, 4 to the words, as the postmark above it; it was 13 and 6). Walked
  on Obalka_Demo with the clock set to 12 Sep, light and dark. Deleted: 15 wrappers nothing imported
  any more, the four raw glyphs and `iconTiers.tsx` (the emblem tier, unused since the postmark took
  the sent result). Lucide stays for what the boards draw as plain lines: chevrons, close, check,
  plus, the eye, ⋯, the ⋯ menu's pencil, lock and bin (R9), alert, info, help, the external link,
  scan, the camera, the backup's file arrows (R10) and the delivery states.
- [x] I79 Hero glyphs at 132 (Mail, Send, Search, CloudOff, stroke 1.25) - **X**: R4. Fixed 2026-11-13:
  every one is a pose; `HeroIcon`, the hero tier, `heroInk` and the unused `EmptyState` are deleted.
- [x] I80 `BrandHeader.tsx`, imported nowhere, with a stale TODO - **D**: delete. Deleted 2026-11-15.
- [x] I81 Every touched screen walked in English (the longest Czech strings are on the boards).
  **M**, walked 2026-11-15 on Obalka_Demo in light: the inbox, Sent, a received and a sent message,
  the reminder sheet, search with results, Settings top to bottom, Backup (shut, Advanced open, an
  opened backup, the keep-count question), Transfer, Debug, the FAQ, Licences, What's new, Add a box
  with its three sign-in forms and the environment. Nothing clipped or cut: the one ellipsis is a
  licence name on its designed single line; the sent detail's "č. j." parting across a line is the
  open I82 note. The dialogs were walked in both languages with I84-I105, the lock with T034.

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

- [x] I84 `box.removeFailed.title` - kept, incomplete, unknown; close, retry (`AppShell`). Glyph `boxes`. Walked 2026-11-15 light and dark, Czech and English, through a temporary gallery that opened all 22 in turn (removed).
- [x] I85 `box.aliasFailed.title` (`AppShell`). Glyph `boxes`. Walked 2026-11-15 light and dark, Czech and English, through a temporary gallery that opened all 22 in turn (removed).
- [x] I86 `notif.passwordAsk.title`, the nudge before the OS asks (`AppShell`). Glyph `bell` (it had none; the guard test found it). Walked 2026-11-15 light and dark, Czech and English, through a temporary gallery that opened all 22 in turn (removed).
- [x] I87 `vault.lost.title` - every box asks to sign in again (`VaultLostNotice`). Glyph `lock`. Walked 2026-11-15 light and dark, Czech and English, through a temporary gallery that opened all 22 in turn (removed).
- [x] I88 `lock.reset.title` - cancel, danger confirm (`LockGate`). Glyph `lock`. Walked 2026-11-15 light and dark, Czech and English, through a temporary gallery that opened all 22 in turn (removed).
- [x] I89 `box.removeTitle` - keep, danger delete with the bin (`RemoveBoxDialog`). Built 2026-11-15:
  the box's envelope tile at 64, tilted 2 degrees, instead of its name (R9); Smazat first with its bin
  at 18, Ponechat under it. Walked light and dark, Czech and English, against R9's two phones.
  Rounding: the tile's 17 corner is 16.
- [x] I90 `detail.attachments` - no viewer, cannot open (`MessageDetail`). Glyph `attach` (the dialog lives in `AttachmentRow`). Walked 2026-11-15 light and dark, Czech and English, through a temporary gallery that opened all 22 in turn (removed).
- [x] I91 `detail.original.heading` - cannot open the signed original (`SignedOriginalSection`). Glyph `seal`. Walked 2026-11-15 light and dark, Czech and English, through a temporary gallery that opened all 22 in turn (removed).
- [x] I92 `lock.unavailable.title` (`SettingsScreen`). Glyph `lock`. Walked 2026-11-15 light and dark, Czech and English, through a temporary gallery that opened all 22 in turn (removed).
- [x] I93 `lock.disableFailed.title` (`SettingsScreen`). Glyph `lock`. Walked 2026-11-15 light and dark, Czech and English, through a temporary gallery that opened all 22 in turn (removed).
- [x] I94 `settings.autoDownload.ask.title` with its option group (`SettingsScreen`). Glyph `download`; the tallest, its words and options scroll, its answers stay. Walked 2026-11-15 light and dark, Czech and English, through a temporary gallery that opened all 22 in turn (removed).
- [x] I95 Debug: delete a recording, titled with the file name (`DebugScreen`). Glyph `settings`; Smazat carries the bin at 18, as I89's. Walked 2026-11-15 light and dark, Czech and English, through a temporary gallery that opened all 22 in turn (removed).
- [x] I96 Backup: leave while working - restore, verify, default; background, cancel, stay. Glyph `archive`. Walked 2026-11-15 light and dark, Czech and English, through a temporary gallery that opened all 22 in turn (removed).
- [x] I97 `backup.off.title`. Glyph `archive`. Walked 2026-11-15 light and dark, Czech and English, through a temporary gallery that opened all 22 in turn (removed).
- [x] I98 `backup.prune.title`. Glyph `archive`. Walked 2026-11-15 light and dark, Czech and English, through a temporary gallery that opened all 22 in turn (removed).
- [x] I99 `backup.docs.ask.title` / `backup.docs.change.title` with the document mode choice. Glyph `attach`; the choice scrolls with the words, the answers stay. Walked 2026-11-15 light and dark, Czech and English, through a temporary gallery that opened all 22 in turn (removed).
- [x] I100 `backup.delete.title` with the backup's date. Glyph `archive`; its bin was 16, now 18 as I89's. Walked 2026-11-15 light and dark, Czech and English, through a temporary gallery that opened all 22 in turn (removed).
- [x] I101 `backup.noLock.title`. Glyph `lock`. Walked 2026-11-15 light and dark, Czech and English, through a temporary gallery that opened all 22 in turn (removed).
- [x] I102 `transfer.outcome.title` (on the backup screen). Glyph `transfer`. Walked 2026-11-15 light and dark, Czech and English, through a temporary gallery that opened all 22 in turn (removed).
- [x] I103 `backup.restore.outcome.title`. Glyph `archive`. Walked 2026-11-15 light and dark, Czech and English, through a temporary gallery that opened all 22 in turn (removed).
- [x] I104 `transfer.metered.title` - cancel, transfer anyway. Glyph `transfer`; "Přenést i tak" is filled and first, as R9 draws it (it was neutral). Walked 2026-11-15 light and dark, Czech and English, through a temporary gallery that opened all 22 in turn (removed).
- [x] I105 `transfer.got.title` - what came, too new, unsupported. Glyph `transfer`; the confirm is filled, as I104's. Walked 2026-11-15 light and dark, Czech and English, through a temporary gallery that opened all 22 in turn (removed).

### Controls and shared pieces (each with its states: rest, pressed, focus, selected, disabled, busy)

All **N** unless a board shows them; R9 shows the ones no agreed board has.

- [x] I106 `Toggle` (48 x 28, disabled .6, not animated). Matches R13 2026-11-13: the off track `hs`
  (#DCD2BF / #4A4236) with its inset ring; inside a dimmed row it takes the row's .55 alone (`rowDims`).
- [x] I107 `SegmentedControl` (height 34, 200 ms slide, the unseen dot) - inbox board shows it on blue;
  the backup and sign-in uses are on paper. Seen 2026-11-13: on a cold start the selected tab's fill
  draws a frame after the labels (it waits for the first layout); the FAB's stamp the same (I28).
  2026-11-15: the words were in Roboto (a weight and no face); they are the `smallStrong` role,
  Public Sans Bold 14, the boards' 14/700 on the envelope; R11's 13 on paper rounds to it (no 13/700
  role). Held by `SegmentedControl.test`, red before. Walked on the inbox and the add-box form.
  The cold start's late fill, fixed the same day: until the track is measured the selected tab
  carries the fill itself (`SegmentedControl.test`, red before); the recording's first inbox frame
  has it. Open: the backup's keep-count use, walked with I45.3. **M** 2026-11-15: walked, 2-5 on the
  sunken track with the white thumb, as the add-box form's, light and dark. The walk found its row
  saying "Pokročilé" under the overline "POKROČILÉ"; it says what it folds away now ("Automatické
  zálohování a počet záloh"), its chevron right shut and down open as R10 opens a backup
  (`backupRetention.test`, red before).
- [x] I108 `OptionGroup` radios (check 140 ms). Matches R13 2026-11-13: one card, rows 52, a 22 ring
  (2, `hs`), picked a blue ring with a 12 blue dot growing in over 140 ms; no tint.
- [x] I109 Buttons: primary, outline, link, danger; busy and blocked (warning haptic, shake).
  **M**. Walked 2026-11-15 on Obalka_Demo beside R14's "Every shared part" sheet rendered at the device's 2.625, light and dark: the primary (Sign in) and danger (Lower and delete) 52 with the 14
  corner, the second (Keep) sunken with no outline, the link, the in-content blue 48/13. Busy is R12's
  ring (I76). Blocked is .55, as R8 draws "Potvrdit kód" and R13 a dimmed row; R12 and R14 draw .45 -
  two agreed boards disagree, the code keeps the one the most boards use (T051: R12, R14 to .55). The
  blue's words are R7's 15/700 with the offset glyph, which R14's summary drew 14 with Lucide (T051).
- [x] I110 Text fields: rest, focus, error, the password eye, the dark keyboard.
  **M**. Walked 2026-11-15 on Obalka_Demo beside R14's "Every shared part" sheet rendered at the device's 2.625, light and dark, on the sign-in form: rest with the 1 outline, focused with the 1.5 blue,
  the eye, the placeholder. The error states are R11's, walked with the forms (I08-I12). The keyboard
  takes the app's appearance on iOS at every input (`ui.tsx` Input); Android draws its own.
- [x] I111 `ScreenHeader` (min 54, back 44, two-line title, slot, hairline). Fixed 2026-11-13: the
  hairline stays (every board draws it inline on its header), but the archive search ends at its tone
  (`hairline={false}`, R4 - the owner's catch). 561d039 took it off every screen after reading only
  the boards' shared `.hdr` class; put back the same day. Walked on search and add-a-box, light and dark.
- [x] I112 `ProgressBar` (6 px, determinate) and `WaitingBar`; MessageDetail draws its own copy of the
  bar - **D**: one drawing (visual-craft, "One object, one drawing"). 2026-11-13, R6 walk: both
  tracks are the sunken surface (`--sk` on every board), not the off switch's darker track; the copy
  in MessageDetail is left for R7.
  **Fixed** 2026-11-15: the detail's copy is gone. The download's bar is the shared one in its 6 slot:
  the bar when the size is known, the waiting bar when it is not (R14 "Downloading"; it was a still
  40 % stub). Held by `messageDetailDownload.test`, red before. Not walked live: a download asks
  ISDS, and the demo boxes stay off it; the waiting bar itself is walked on the launch (I75).
- [x] I113 `Skeleton` rows.
  **M**, 2026-11-15: the skeletons take the shape of what comes (constitution V), the register row
  (day, subject, sender) seen on the inbox's load, light, and the detail's (I31). R14's generic row,
  a 38 tile and two bars, is drawn on no screen (T051: R14 shows the register row).
- [x] I114 `EmptyState` and the hero glyphs (I79). Deleted 2026-11-13 with I79: `EmptyObject` draws
  every empty state.
- [x] I115 `DashedOutline` (add a box, add an attachment, the sender gate).
  **M**, 2026-11-15: two uses left, both R12's compose envelope (the stamp's frame and the empty
  recipient), walked with R12. Add a box became R9's sunken button; the sender gate has no outline.
- [x] I116 `DottedRail` (delivery steps).
  **Deleted** 2026-11-15 with its test: no screen used it since the delivery record became R6/R7's
  slip.
- [x] I117 Chips and tags: every `chipTone` (fiction red and amber, user blue, cost free and paid, the
  four delivery states, info, danger soft, estimate soft, stop), the test tag, the box pill, the
  documents chip, the saved badge.
  **M**. Walked 2026-11-15 on Obalka_Demo beside R14's "Every shared part" sheet rendered at the device's 2.625: the fiction red and amber, the cost free and paid, info and danger soft are R14's
  pairs in both themes (`chipTone.ts` read against the sheet); the box pill and the documents chip
  walked on the lists and the backup, the test tag in gold soft. `userBlue` is the reminder's ink for
  links (Zapnout, Uložit jako připomínku), as R14 draws them; the app draws no reminder chip - the row
  carries its glyph and date (R5), so R14's "Set" chip waits for T051.
- [x] I118 `QrCode` with the Obálka plate. Fixed 2026-11-13 (R6): ink #211B12 on #FFFDF8, radius 8,
  the logo in its own colours with its tile exactly over the seven omitted modules (a test holds it).
- [x] I119 Flags (cs, en) in the language picker and sheet.
  **M**: walked with I43 (Settings › Language) and in the English walk (I81).
- [x] I120 `BoxPill`, `CrossBoxLine` (dots, +N), `DeliveryStateIcon` (sent, delivered, accepted or
  fiction, stop).
  **M**, 2026-11-15: the box pill and the other-boxes line on the merged inbox, light and dark (I81);
  `DeliveryStateIcon` lives on in the FAQ's legend only, built with R11 (T044).
- [x] I121 Unread badge (99+, min 20) and the sync-error badge on a box avatar.
  **Fixed**. Walked 2026-11-15 on Obalka_Demo beside R14's "Every shared part" sheet rendered at the device's 2.625: the unread badge was `theme.gold` (#E8A100) and a 16 disc - R14's is the stamp's
  #FFC305, 20 across with its 2 ring outside; the sign-in badge 18 with the ring outside too (it drew
  both rings inside). Now 24 and 22 boxes, 2 further out. Held by `BoxSwitcherSheet.test`, red
  before. `theme.gold` is now unused (T051 with DESIGN.md).
- [x] I122 Pull to refresh (both lists and the error state).
  **Fixed** 2026-11-15: Android drew its arrow on a white disc, a white blob on the dark paper. Both
  lists set the disc to the card's surface (`noPlatformSpinner.test`, red before); walked in light and
  dark on the merged inbox.
- [x] I123 `ContinueButton` after a restore (backup, transfer, What's new).
  **Fixed** 2026-11-15: it drew its own face at 48; it is the filled button now, 52 with the 14
  corner, R14's primary (`continueButton.test`, red before). What's new's Pokračovat already was (I52).
  Not walked live: it shows only after a restore on a phone with no boxes.
- [x] I124 The Mobile Key brand tile, the logo at 40 / 84 / 120 (the lock tile, `BrandLockIcon`, became
  the sealed envelope in T034).
  **M**, 2026-11-15: the Mobile Key wait is the waiting envelope (I10), the lock the sealed envelope
  (T034), Welcome the envelope waiting for a box (R1), so the 120 mark and the brand tiles are gone
  (their tier went with `iconTiers.tsx`, I78). The logo is left at 84 on the launch (I03) and 40 in
  Licences (R13), and inside the QR plate (I118).

### What the system draws around the app

- [x] I125 Biometric and passcode prompts and their titles (`lock.prompt`, `backup.prompt.*`,
  `transfer.prompt.keepKey`) - **N**: the words follow the Lock board ("Obálka je zapečetěná").
  Walked 2026-11-15 on Obalka_Demo (a PIN, no fingerprint): the system's PIN screen says "Unlock
  Obálka", the Lock board's verb; the backup and transfer prompts name what they open, as verbs. The
  screen itself is the system's and cannot be captured (FLAG_SECURE), so the words were read from its
  view tree. **Fixed** on the way: cancelling that prompt opened "Biometrics unavailable - no
  fingerprint, face, or device code" on a phone with a PIN, because Settings asked after any cancel
  whether a biometric was enrolled. Only a phone with no screen lock gets the sheet now
  (`lockToggle.test`, red before); the biometric check had no other use and is gone.
- [x] I126 Notification permission: asked from the nudge (I86), the first reminder, and "alerts off" -
  **N**.
  Walked 2026-11-15 on Obalka_Demo, English: the first reminder's Uložit raises the system's question right after the sheet that
  says "we will tell you the day before and on the day", so the reason is on screen as it asks; "Don't
  allow" leaves the reminder set with the alerts-off line under it, and its "Turn on" opens the app's
  page in the system settings. The nudge (I86) was walked with the dialogs. **M**.
- [x] I127 Camera permission: asked when the scanner opens, with no word before it - **X**: the mobile
  practice "Explain before the permission prompt"; behaviour, not now (owner, 2026-11-12, not-now.md).
  Not now, as decided (not-now.md, Part C); the explanation gets its board with the sheets when built.
- [x] I128 Notifications: Android channels, the iOS hidden-body placeholder, the reminder and password
  texts - **N** (I63 is the colour).
  Walked 2026-11-15 on Obalka_Demo, English and Czech: two channels, "Password expiry" and "Reminders"; a reminder (its
  WorkManager job forced) shows the envelope on the envelope blue, the generic "Reminder for tomorrow"
  and the subject as the body, which a hidden preview leaves out. **M**. A reminder keeps the language
  it was scheduled in; channel names follow on the next one - with I137's language gaps, not now
  (not-now.md). The iOS hidden-body placeholder and the password text were not seen live: no demo
  box has an expiring password; `notifeeNotifier.test` holds their words.
- [x] I129 Opening an attachment: Android's chooser, iOS Quick Look, a ZFO's save sheet - **N**.
  Walked 2026-11-15 on Obalka_Demo, Czech: tapping the file hands it to the phone's PDF viewer (Drive, the only one, so no
  chooser), which refuses the demo archive's placeholder file - the app's side is the system's; the
  download glyph opens the system's save sheet with the file's own name, and a cancel says nothing.
  The ZFO's save sheet is the same call (`attachmentOpener.ts`), not walked: it would ask ISDS. iOS
  Quick Look was walked with I38.5. **M**.
- [x] I130 File pickers and save sheets (backup export and import, compose attachments) - **N**.
  Walked 2026-11-15 on Obalka_Demo, Czech: Načíst zálohu ze souboru opens the system picker on Recent, every type shown (a backup
  file has no type Android knows, so a filter would hide it - left as it is); a cancel returns
  quietly. Save to a file is I129's save sheet. Compose's attachment picker is the same
  `@react-native-documents/picker` call and sits behind a recipient search, which asks ISDS. **M**.
- [x] I131 Sharing a debug recording - **N**.
  Walked 2026-11-15 on Obalka_Demo, Czech: a recording saved, Sdílet opens the system share sheet with the file by name. **Fixed**
  on the way: deleting one asked with the bare file name as its title, broken mid-word on two lines,
  over a body that said only "Smazat". It now asks the way the backup's delete does - "Smazat
  záznam?", the file under it, what goes ("Kopie, které jste už sdíleli, zůstanou"); held by
  `debugAsDrawn.test`, red before. Four comments in `strings.ts` shortened to stay at 1795 lines.
- [x] I132 The PDF the app makes from typed text ("Textová zpráva.pdf", system font 14) - **X**: what the
  authority receives from Obálka; R9 shows it as printed matter. Built 2026-11-15 as R12's Czech A4
  letter and walked on Android and iOS (I38.5).
- [x] I133 External links: the ISDS portal (password, sign in again, buy credit), privacy, source, the
  OS settings - **N**.
  Walked 2026-11-15 on Obalka_Demo: privacy and source carry the external glyph and hand over to the system browser (Chrome's
  first run on the clean emulator, gone no further); the portal links share `portalUrl`; the OS
  settings is I126's. **Fixed** on the way: Compose's "buy credit" link was the one `openURL` that did
  not catch a refusal (no browser, a blocked profile), an unhandled rejection; a guard test over every
  `openURL` in `src` (`openUrlCatches.test`, red on it) holds all five.
- [x] I134 Notification taps and cold start into a message or the password screen - **N**.
  Walked 2026-11-15 on Obalka_Demo: the app killed, a tap on the reminder starts it on the paper (no white frame) and opens that
  message directly. **M**. The password notification's route to the change screen is held by
  `deeplink.test` and `shellRecovery.test`; no demo box has an expiring password to walk it.

### Platform variants

- [x] I135 Largest text size: fixed heights that may clip (segmented 34, FAB 54, badges 20/11, avatar
  monograms, the deadline suggestion's min height, the lock's failure slot 17) - **N**: walked at the
  largest size on both platforms.
  Walked 2026-11-15 on Obalka_Demo at Android's largest (2.0), Czech: inbox, switcher, detail, Settings,
  Backup, What's new, sign-in, compose. Fixed, each held by a test that failed first: the register's day
  numeral wrapped digit by digit in its 34 column (now at least 34, `inboxRows.test`); the monograms
  spilled out of their tiles or were cut to one letter ("F" for FÚ) and the unread badge grew over half
  the avatar - parts of a drawing, so they keep their size while the name beside them grows
  (`fixedObjectText.test`, `BoxSwitcherSheet.test`); compose's recipient field was a line in dp, cut in
  half (now at least a line at the font scale, `recipientRow.test`; pixel-identical at 1.0); What's
  new's dots sat above their first line (`whatsNew.test`). The segmented control, the stamp, the lock's
  slot (a `minHeight` already) and the deadline suggestion held. iOS at its largest accessibility size
  (about 3x, the simulator with the demo archive) cut the segmented labels and the stamp and squeezed
  the password strip's words to nothing: text now stops at 2x (`MAX_TEXT_SCALE`, `textScaleCap.test`),
  after which the iOS inbox reads as Android's largest; growing every drawn part to 3x is not now
  (not-now.md).
- [x] I136 Touch targets under 48: the box menu's trigger (38), header back (44) - **N**.
  **M**, 2026-11-15: both take a slop derived from their drawn size up to 48 (`touchSlop`; typed slops
  fail `noTypedHitSlop.test`). On Obalka_Demo a tap 4 dp outside the 38 menu trigger opened its menu,
  not the row under it.
- [x] I137 Language: the app starts in Czech whatever the device says; dates are Czech in English too;
  the iOS permission texts are Czech only - **N**: walked in English; the gaps are behaviour, not
  now (owner, 2026-11-12, not-now.md).
  Not now, as decided (not-now.md, Part C), with the reminder's language added on 2026-11-15 (I128).
- [x] I138 Orientation and size: iPhone only and portrait; Android tablets (600 dp and up) may rotate;
  content stops at 720 - **N**: walked on a tablet AVD in landscape.
  **M**, 2026-11-15: Obalka_Demo's display set to 2560x1600 at 320 dpi (1280x800 dp, landscape; Android
  16 ignores the portrait lock at 600 dp and up). The inbox, the detail and the box switcher stop at the
  720 column, centred, the envelope header, the stamp and the sheet inside it. The header's band stops
  with the column too: the column is the page and the margins are paper, as `ContentColumn` decides -
  left as it is (not-now.md). The display was reset after.
- [x] I139 No error boundary: a render error shows nothing - **X**: behaviour, not now (owner, 2026-11-12,
  not-now.md); the fallback screen, once built, gets a board.
  Not now, as decided (not-now.md, Part C).

### Fixed on the way (behaviour, the owner's call on 2026-11-12)

- [x] I140 Seven places left a dialog or sheet open as the app went to the background, drawn over the
  lock screen on return (an RN Modal sits above the lock cover): the Settings, Transfer and Debug
  dialogs, the attachment and signed-original dialogs, the paid-send confirmation, the sender sheet.
  Each now closes, or (a transfer that arrived) waits while covered. Held by
  `__tests__/security/modalsCloseOnBackground.test.ts` (red on the 7 first) and
  `__tests__/app/modalsLeaveWithTheApp.test.tsx`.

### Leftovers found by the second inventory

- [x] I80.1 Unused: `useIsWideWindow`; icons Bell, Paperclip, Menu, Send, Sun, Moon, Refresh, SyncOn;
  tokens `accentSun`, `accentMoon`, `accentDevice` - **D**: delete with I78. Deleted 2026-11-15, ahead
  of I78 (nothing they would map to): all but Bell, which the code-entry form has used since I09.

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
- [x] T035 Motion: I67-I70, each with its Reduce Motion form.
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
    on each render handed the view new nodes mid-flight, so they are made once. Walked on the iOS
    simulator 2026-11-15 (Maestro, the demo archive seeded locally and reverted): the tile flies and
    the message fades in as on Android, but the edge swipe did nothing on it while it went back from
    Settings - react-native-screens gives a custom animation's pop no driver unless the gesture is
    told to use it. With `animationMatchesGesture` the swipe fades the message out under the finger
    and lands on the inbox (a test holds the option, red before).
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
  Raised in I46.2: dates are "13.11.2026 15:18" across the app (backups, the message detail); the
  boards write "12. 11. 2026 09:20" with the Czech spaces. One formatter for the app is the fix.
  Raised in I46.4: English byte sizes keep the Czech decimal comma ("2,6 MB of 4,2 MB"); `formatBytes`
  knows one language.
  Raised in I11: R8's refusal card repeats its title as the first words of its body ("ISDS
  přihlášení odmítlo: …"), built as drawn; the error string could lose them.
  Raised in I47: in R13's bold 14 the recording counter's reserve takes two lines at the default text
  size on a 360dp phone (the longest count needs them), so a short count sits over an empty line
  there; one line from 411dp. And the saved strip wraps after "Uloženo:" on the device where the board
  fits one line (Android draws Public Sans about 2 % wider); the strip's height is held, so it moves
  nothing.
  Raised in I48: R13 sets a licence's text in monospace 12/18; the type scale has no monospaced role and
  the rule is no new roles, so it is the Meta role in Public Sans (12/16). Decided by the owner
  (2026-11-15): "public sans at meta size is ok" - kept; the canvas's text to follow (sync-back).
  Raised in I53: once, in English dark right after a language change, What's new's slide-in stopped
  part-way and stayed there, Pokračovat under the screen's edge (the sheet laid out at full height,
  drawn 980 px lower). Not seen again in seven launches; Reanimated's entering animation on the
  Modal is the suspect.
  Raised in I95: the debug delete's words repeat its answer ("Smazat …?" over Smazat); a body that says
  what goes would read better.
  Raised in I51: the scanner's sentence without the camera fits two lines under R13's 300 cap on the
  board and needs three on Android (the face 2 % wider); balanced, as the board's `text-wrap`, so no
  word stands alone.
  Raised in I38: Android fades a dimmed button's words apart from its ink (they sank to nothing on
  Odeslat until its layer was composited); check the other dimmed buttons (InkButton, the busy
  download). The English credit reads "Kč" (formatCzk is Czech-only).
  Raised in I76: on an ink button R12's busy ring is the sunken paper (#F2EADB) with the quarter in
  the button's words (#FBF6EA), 3 % apart, so the turn barely shows; built as drawn.
  Fixed 2026-11-15: I46.4 and I38's credit (formatBytes writes the English decimal point, formatCzk
  "1,234 CZK"; the active language moved to src/i18n/activeLocale.ts so both read it); I11 (the
  refusal's body starts with what is wrong); I38's dimmed buttons (InkButton, the busy download, the
  attachment sheet and the waiting window composite their layer while faded, fadedAsOne.test).
  The critique (2026-11-15), two isolated reviewers on the walk's 24 captures (12 screens, light and
  dark): A, the design review (Nielsen 28/40, "mostly authored for this product"; the identity drops
  out on Settings, Backup, Add box and Sign-in); B, a native technical audit standing in for the
  detector, which reads only the web. Fixed from it, each with a guard test proven able to fail:
  the clock over the gold flap in dark (1.68:1; the inbox asks for dark icons, every overlay puts the
  theme's back over its scrim); the switcher's list stopped at 360 and hid a fourth box; the compose
  fields were leaves' children on iOS (wrappers now `accessible={false}`); the disabled switch was
  not an element; radios said `selected` (now `checked`, in a `radiogroup`) and their ring measured
  1.47:1 (now the switch's off edge, 3.63); six headings without the header role; Pokročilé and the
  box-type line without `expanded`, the FAQ reading its +/−; the rename field without label, face or
  cap; the test tag a raw 10 (now the tag role); TermPicker's 16 (now 15, bodyStrong); the recipient
  search silent to a screen reader; ten presses drawn at 44 without slop (smallPressHasSlop.test now
  reads every one) and the help link's target over Pokročilé's; the monogram took the degree ("Ing.
  Ondřej Dvořák" was IO); `success` 4.36:1 on the paper (now #2A744C, 4.91); "ID" parted from the ID in
  Compose. Reply is written down as not now.
  Found in the sync-back (2026-11-15): a sent envelope pinned its window to the bottom, so a window
  with the address grew upwards over the postmark's date and time; the sender's lines now keep the
  room down to the Sent board's 120 and the envelope grows downwards (sentDetail.test).
  Raised for the owner (design, not built unasked): neutral buttons on the paper (the sunken fill is
  1.03:1 there, Backup's Zálohovat nyní / Ověřit zálohu / Zobrazit heslo read as bold words);
  Nedoručitelné has no glyph and is the quietest state; the backup screen's prose (15 lines before the
  status; the cloud sentence); Settings reached only through the switcher; the switcher's red line on
  every box ("Poslední známý stav" in red too); "Naposledy 12.09." does not say what; the empty stamp
  slot reads as an image placeholder; the disabled Jen na Wi-Fi shows a blue on switch; the window
  film's glint in dark looks like a smudge; the crash-report row's bell glyph; "budeme"/"ani my" in
  telemetry and backup copy (plural, so within the voice rule, the owner's call); the detail header
  taller with a faint title (documented exemption); the broken-box badge covering the monogram's first
  letter; the sign-in field's label and placeholder differing ("Přihlašovací" / "Uživatelské jméno");
  the "DPFO" example; the date form (the boards write both "12.11.2026 09:20" and "12. 11. 2026
  09:20", and "29.08." in lists; I46.2 waits for one form).
  Built as drawn: the busy primary button sets its ring and the busy words centred as one group (the
  words change too), as R8 and R12 draw it; nothing outside the button moves.
  Answered by the owner, one by one (2026-11-15):
  1. The stamp: R2's everywhere - the stamp compose shows (96x78, the kind line) is the one cancelled
     on the sent envelope; an archived sent message keeps it blank at the same size.
  2. The date form: the Czech standard, "12. 11. 2026 9:20", lists and the postmark "29. 8.", through
     one formatter; English "12 Nov 2026, 9:20" and "29 Aug".
  3. Neutral buttons: a deeper tone, one fill that separates from the paper and a card (tone, not
     outlines).
  4. Nedoručitelné: the stop disc (`StatusStopIcon`) at 15 before the words, in ink.
  5. Backup's text: the two loose paragraphs go (the cloud sentence with them); the attachments line
     becomes "Bez nich záloha ví jen, že příloha byla. Po obnovení si ji stáhnete znovu, dokud ji
     ISDS má."
  6. Settings: stays in the switcher (decided "left as it is").
  7. The switcher's state line: only the problem in red, "· Poslední známý stav" muted.
  8. "Naposledy": the verb named - "Aktualizováno …" in the inbox, "Zálohováno …" on the backup row.
  9. The empty stamp slot: the blank stamp at .55; the price prints in once a recipient sets it.
  10. A disabled switch: the neutral off track whatever its value, the knob keeps its side (every
      Toggle).
  11. The window film in dark: no glint.
  12. The error-report row: a bug glyph in the offset family, on the Icons board first.
  13. "we": all eight strings in the app's voice or impersonal; the SMS line no longer says the app
      sent the code.
  14. The detail header: the shared height; its title stays faint (the one exception, colour only).
  15. The broken-box badge: top-left, over the flap; the letters stay clear.
  16. The sign-in name: "Uživatelské jméno" (ISDS's word and the access letter's), no placeholder;
      the box's "Přihlašovací jméno" line follows.
  17. The alias example: "Např. Osobní, Firma…".
  Built 2026-11-15, each with a test that failed first and a walk on Obalka_Demo in both themes:
  1 and 9 (8c5ab03), 2 and 8 (12ab2d4), 3 (2df1baa), 4 (6601989), 5, 13, 16 and 17 (1aac45e; the
  voice guard `projectVoice.test.ts` found 45 offenders, about 20 of them Czech "I" progress labels),
  7 and 15 (bb06b66), 10 (75b13b6), 11 (013bc4c), 14 (1ea5abe; MessageDetail now takes
  `ScreenHeader quiet`, its hairline at 274 px like Settings'), 12 (ec40d12, the bug drawn on the
  Icons board first). 6 is written in not-now.md as "left as it is".
  The canvas took all 17 (version 35, 2026-11-15): 22 boards redrawn as built, each rendered and cropped
  beside a device capture; the sync also found "Čtu zprávy", the last first-person string (23daa6c).
  Open for the owner: on a 360 dp phone a sent envelope's postmark lies over the sender's name and ID,
  on the sent result (envelope 310 wide: the postmark from 64 to 172, the sender's column 18 to 138)
  and in the detail (328 wide: from 82). R2's wider stamp pushed it 36 further in; at 102 from the
  right it already reached 20 into the column. Seen on Obalka_Demo at 360 dp; at 411 the detail
  clears it. And the password field keeps a placeholder ("Heslo") that repeats its label, now that
  the name field has none.
  Answered 2026-11-16: the password field lost its placeholder (Q2, d501499), and the postmark strikes
  the stamp's edge (Q1): the 96 drawing over the stamp, its ring 40 into the paper (right 86), in
  `cancelInk`, the sender's column 100. Walked on Obalka_Demo at 360 dp (detail light and dark, the
  sent result with "0 Kč" struck) and 411 dp; the ring starts at 128 on the 310 result envelope.
  Canvas version 36 (2026-11-16): Sent and R7 redrawn to it, each cropped at 3x beside the capture;
  with practices 1.6.1's check-ui on the 24 boards (232 findings), the canvas's own mistakes fixed
  (dark phones' clock in dark ink, Přijaté | Odeslané marked as tabs, screens drawn mid-scroll
  marked): 200 left, the agreed design against the new rules, for the owner (not-now.md).
  On canvas v36 the owner saw the stamp's waves cross the postmark's date: they now start 4 past the
  ring (`cancellation.x` 44) and stop within 2 of the stamp's edge (4182e72, canvas v37). Shown on
  its own before/after page (the app and the board), accepted 2026-11-16: "ok accept". From then on,
  practices 1.7.0: every touch-up to the canvas gets its own before/after page, named in the commit.
  The owner, 2026-11-16: "Fix to 1.6 first" - the pass stays open until the build meets practices
  1.6. Plan, one rule at a time, each proposed on the canvas with options where it is a design choice,
  picked by the owner, built, walked, and re-checked with check-ui (target: 0 findings, or data-allow
  with a reason the owner gave):
  - [x] T050.1 Outcome: the ten bare "Zrušit" and "Přijmout". The owner picked "name what stays"
    (2026-11-16): Nechat zapnuté, Nechat jak je, Nechat vypnuté, Počkat na Wi-Fi, Neukládat,
    Ponechat, Nechat zámek, Neodesílat, Zavřít fotoaparát, Zrušit přihlášení, Přijmout zálohu.
    `common.cancel` and `login.cancel` are gone (guard: wayOutNamesOutcome). Canvas v38 redraws five
    boards; a before/after page shows them, and lists the six dialogs no board draws.
  - [x] T050.2 Contrast 4.5:1 (19). The owner picked "faded, and say why" (2026-11-16): a disabled
    control fades as one piece and something beside it says why. Only "Jen na Wi-Fi" lacked its
    reason: while automatic downloads are off it reads "Platí, když se přílohy stahují automaticky."
    `textFaint` #736A57 → #6E6555 (4.47 → 4.81 on the sunken well, now in contrast.test); the motion
    board's arrows take the muted ink. Eight faded items keep their look with a data-allow reason;
    two were check-ui's misses (a ground drawn as a picture: the gold flap, the camera). Canvas v39,
    check-ui 200 → 175, contrast 0. The settings strings moved to settingsStrings.ts (strings.ts
    1,605 → 1,549).
  - [x] T050.3 The 11 px floor (21 under 1.6.2). The owner picked "a drawing, marked" (2026-11-16): the
    postmark keeps its agreed size, a drawing whose date and time the detail writes in full; the
    welcome slide's is an example. "PDF" on the document glyph and the A4 letter's miniatures are
    marked the same way; the motion board's annotation goes 10 → 11 px. Nothing changes in the app.
    Canvas v40, check-ui 175 → 154, small text 0.
  - [x] T050.4 One anatomy (14). The owner picked "three sizes by job" (2026-11-16): 52 alone, 48 a
    pair or alone in a card, 40 in a list row, 54 for Welcome, Lock and Hotovo; each its own class
    on the boards. Off the scale: the sent result's "Ukázat v Odeslaných" 50 → 48, the download
    button's corner 13 → 14 (app and boards). The strips board still drew the missing-files button
    neutral at 46, though 6a14d22 had moved the app to the blue download; the board follows the app.
    Canvas v41, check-ui 154 → 140, same-look 0.
  - [ ] T050.5 8 px between targets (8): backup's two links, transfer dialog buttons, Napsat by dialogs.
  - [x] T050.6 Nothing past its surface (4). Canvas only, no design change: the Main slide was a fixed
    1280 × 900 and its words reached 1070, so the frame cut the cards' last lines (it now grows, frame
    1070); R8's paper was 3568 wide under nine phones (3950), now its 4040 frame. Canvas v42, check-ui
    140 → 136, contain 0.
  - [ ] T050.7 Icons on main buttons (56): dialog actions, Hotovo, Ukázat v Odeslaných, Připomenout.
  - [ ] T050.8 Tone, not outlines (45): 1 px rings on cards and sheets, 2 px rings on chips.
  - [ ] T050.9 Shadows fall away from the light (27): bottom sheets' upward shadow.
  - [ ] T050.10 The app itself: walk each screen against the same rules (check-ui reads only boards).
  Raised by the owner for it (2026-11-13): the second envelope's edge under a sheet delivered by
  fiction read as a pile. Decided the same day, "draw under all": every attention sheet has it, done.
- [x] T051 Canvas shows only agreed designs and matches the build; DESIGN.md records the objects, the
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
  - R10 send: the row says "Jen stažené přílohy"; the chip says "Jen stažené" everywhere else, and
    the build keeps the chip's words.
  - R10's filled and neutral buttons are now one component each (`InkButton`, `NeutralButton` with a
    glyph); DESIGN.md to record them.
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
  - R13 debug: no failed read and no read in progress; the build says the failure in the empty
    line's place with Zkusit znovu as a link under it, and holds that line empty while reading. A
    failed share, delete or save takes the strip in the danger tint with the alert glyph (R13 draws
    only the saved notice). No dark debug phone; the strip's dark tint is the theme's `blueSoft`
    (#233140), the boards' `--bluesoft` is #1F2C3A. The strip's 13/19 is the Label role (13/17).
  - R13's half-width row buttons are `InkButton small` and `NeutralButton small danger` (40, the 12
    corner, 14/700); DESIGN.md to record them with R10's.
  - R13 Licence: the third-party card ends after the MIT row and one component; built as one row per
    licence (the owner, 2026-11-15). The app's card is a button opening the whole text (not drawn).
    The licence texts flow and carry the component's notice (spec 012 amended the same day).
    The text is Public Sans at the Meta size, not monospace (the owner, 2026-11-15).
  - R9 Language: rows at 56; the same `OptionGroup` rows are 52 on R13 and in the build.
  - R9 What's new: 22 above Pokračovat; the build's scale step is 24.
  - R9 questions: the failed removal names its box under the title (the switcher it came from has
    closed, and two can follow each other); R9 draws none. The dark danger fill is the theme's
    #E27A73 (R9 #E58A84); the light danger label is the paper (R9 white).
  - I34 deadline suggestion and "alerts off" line: no board. Built as R14's strip (sunken tone, no
    outline, glyph at 20, links under the words, accept in the reminder's blue) and R8's waiting bar on
    a `borderStrong` track while it scans; draw both on R7 beside the term card.
  - R13 scanner: the window's film and glint lie outside a `.win`, so the board's `.win .crk` rules
    miss them and the film's stroke runs past the window's edge; the build draws the window's own
    film and glint inside it. DESIGN.md to record `cameraDim` and the 56 well (`Well large`).
  - R9 box menu and R14: the bin with two inner strokes and a square-cornered lock; the build's bin is
    the plain one an earlier board chose (`TrashIcon`) and its lock is the app's `LockIcon`, one
    drawing each across the app.
  - R9 alias editor: the identity line in the 13 Label role at 500; the build uses the switcher rows'
    `BoxIdentityLine` (Meta), so the box reads the same in both. Six swatches drawn; there are ten,
    on two rows. DESIGN.md to record the popover (`objectShadow('popover')`).
  - R9 snackbar: drawn only light, with an action. At night the build gives it the dark popover's
    faint white edge; words with no action keep 16 at the right, not 6.
  - InboxA's clip in the register has no text lines; the Icons board's attach glyph, built, has two.
  - Message's attachments: only the saved row and R7's not-downloaded card are drawn; the build
    gives the missing-files notice R7's blue download, the gone card R7's anatomy, a file it cannot
    open its own sheet at .55, and the gone original its seal, faint (I35, I36).
  - The postmark's English words (the boards are Czech): "DELIVERED · DATA BOX · ISDS ·" and
    "SENT · DATA BOX SYSTEM · ISDS ·", so the ring closes as the Czech does.
  - R2/R12 compose: R2 lays the footer on the paper, R12 (newer) on surfaceAlt, built as R12. The
    board gives namesakes two avatar colours; the build colours by name. Some derived phones omit the
    text field or the attachments; the build keeps them. The window is 3 taller from the roundings.
    R2's paid question: 20 above the stamp and under it, the words 15/21; the build is R9's `Dialog`
    (24 above the object, 18 under it, the words in Small), one anatomy for every question.
  - The stamp before and after sending: R2 draws compose's at 96×78 with the kind line (PDZ, datová
    zpráva), the Sent board the cancelled one smaller and without it. One stamp, two drawings: the
    owner to pick one on the canvas; each screen follows its own board until then.
  - R12's letter: "V Praze" before the date; the app does not know the sender's place, so the date
    stands alone at the right.
  Confirmed by the owner 2026-11-13, each as built: the blank sent stamp, the merged first row, the
  sent window's ID and address, the 4-module QR quiet zone, the full logo in the QR, the note under the
  download card; also the sender's 120 wrap on a sent envelope and the sunken bar track (R6).
  Done 2026-11-15: every item above is redrawn on its board as built (R1-R15, Main, InboxA, Detail,
  DetailDark; canvas version 34), each board re-rendered whole and checked for overflow; R8 widened to
  4040 for the sending phone's done state. DESIGN.md took the parts and the rejected variants (7142188).
  Still label notes, not phones: R4's no-results pose, R6's hidden key, the backup's Advanced row, the
  debug delete question (DESIGN.md records its anatomy, R9's `Dialog`), R13's licence list (3 of 9
  rows drawn, the rest the same row). Open for the owner, under T050: the stamp (R2 or Sent) and the
  date form; each screen follows its own board until then. The dimmed Odeslat took .55 with the rest.
- [ ] T052 Delete `docs/engineering/identity-pass.md` in the last commit.
