# 024 - One inbox, many boxes

**Status**: Implemented. Specified from approved mockups and built straight through, so there is no `tasks.md`. Amended 2026-09-14: FR-003, FR-004, FR-007 and cycle 2's refresh reporting now record what was built. The same day the line gained FR-003's nearest deadline and still-refreshing state and FR-004's last-known marking, and the empty `Jinde: ` line was fixed.

Approved from the mockups: **A + C, C first.** They are not rivals. C is the alert, A is the list,
and both read the same aggregate.

## What prompted it

"I don't like that the boxes selector does not display any information that a box contains unread
messages - the Podnikajici fyzicka osoba production box has an unread message which is not known
until you go into the boxes detail."

The count existed on the account record the whole time, and the attention machinery existed per box.
Neither reached the screen the user was actually looking at.

## The constraint, stated correctly

Listing a box's messages is legal service (§17 odst. 3 zák. 300/2008 Sb.). 014 FR-001 permits exactly
four triggers and the app already uses all of them: opening the app, opening a box or folder,
pull-to-refresh, an explicit send or download. Launch already fans out to every box
(`AppShell.tsx:217`), which 014 settles: "opening the app counts as a manual user command."

So a merged view adds **no new legal exposure**. What it adds is a legibility problem: one gesture
signs in to several boxes, and the user has to be able to see that it did and which one failed.

## Cycle 1 (this) - C, the cross-box card

- **FR-001** A summary of every box OTHER than the one on screen, as ONE LINE inside the list,
  after this box's attention block and before its date sections.

  It began as a bordered card with a row per box and was reported twice: for clashing with the
  sections around it, and for taking attention from the box the user had actually opened. Both had
  the same root - it looked like CONTENT, on a screen whose content is mail. A line cannot be
  mistaken for a message, costs about a fifth of the height, and being a section header rather than
  a floating card it inherits the list's geometry, so the clash disappears instead of being tuned.

  The dots are the boxes BEING REPORTED, not every box owned: the line says what is happening
  elsewhere, so a quiet box contributes nothing to it, exactly as it contributes nothing to the
  sentence. Past three they stack and stop with a count, which fixes the width by construction and
  leaves the rest of the line to the sentence - a user with fifteen boxes cannot overflow it.

  *Amended 2026-09-15 (fitting the line):* the sentence was one caption truncated at its end, on the
  reasoning that its clauses are in urgency order, so whatever fell off was the least urgent. The
  owner reported what that looks like on a phone (1080×2400, density 420, font scale 1.0):
  `Jinde: 1 doručeno fikcí · naposledy 3 nepřečtené · 2 nen…`. A clause cut in half says nothing, and
  nothing on the line said that more had been cut. The line now shows WHOLE clauses, most urgent
  first (FR-003's order), as many as fit, and counts the rest:
  `Jinde: 1 doručeno fikcí · naposledy 3 nepřečtené · +1`.

  - *Measured, not estimated.* The slot beside the dots and the chevron reports its width through
    `onLayout`. An invisible column, absolutely positioned so it takes no room, draws every candidate
    sentence (the prefix and the first 1…n clauses) and every count (` · +1` … ` · +n`) in the same
    Caption type, and reports each width. A new text size, a rotation or new data is measured again,
    and the choice follows. The column's texts are keyed by their words, so changed words report a
    width even when it equals the old one.
  - *The rule.* The most clauses whose sentence, plus the count of the rest, fits with three physical
    pixels to spare. `onLayout` widths are rounded to the pixel grid (Yoga rounds a text outwards, so
    its width can only read wide, and a view's edges to the nearest pixel, so the room can read up to
    a pixel wide), while the row shrinks its text by the unrounded ones. A width not yet
    measured counts as not fitting, so a clause that arrives with a refresh waits in the count until
    it has been measured, and is never drawn on a guess.
  - *The first clause is always shown.* When even it does not fit, it truncates - the last resort -
    and the count after it does not shrink, so the reader still learns that more is not shown.
  - *One line, no jump (constitution V).* Every text on the line is held to one line. Until the first
    measurement lands, the whole sentence sits transparent in that line, so nothing cut mid-word is
    drawn and then rearranged.
  - *Screen readers.* The label is still the whole sentence and where the tap goes. The measuring
    column is hidden on both platforms (`accessibilityElementsHidden`, and `importantForAccessibility`
    set to `no-hide-descendants`).
  - *The count is a bare number* (`crossBox.notShown`, `+{n}` in both languages), the same mark as the
    `+12` beside the dots. A worded count (`+1 další`, `+5 dalších`) was built first and dropped. An
    estimate from Public Sans Medium's advance widths at 12 (no kerning) gives the reported phone
    about 314dp beside three dots. For the reported sentence, two clauses and ` · +1` take about
    287dp, and two clauses with ` · +1 další` about 317dp: the words would have cost the line its
    second clause. The same estimate puts the reported cut, `… · 2 nen…`, at about 316dp, in line
    with the screenshot.
  - *Wording.* The English last-known clause is now `3 unread, last known` (it was
    `3 unread when last checked`): the words the switcher row already uses (`Last known state`),
    about 41dp narrower, and before this the longest clause in either language. `at last check` was
    tried first; the copy-tone guard refuses it, since 022 FR-001 bans `at last`. The Czech clauses
    had nothing to spare that was not meaning.

  Evidence: `src/features/messages/screens/CrossBoxLine.tsx` (`clausesThatFit`), `src/i18n/strings.ts`
  (`crossBox.notShown`, `crossBox.lastKnown`). Tests: `__tests__/messages/crossBoxLine.test.tsx`, 'fitting the
  line (2026-09-15)': 'shows every clause when all of them fit', 'shows the first two whole and counts
  the one left out', 'shows only the first when that is all that fits, and counts the rest', 'counts
  what it left out in English at parity', 'still shows the first clause when not even that fits,
  truncating it and keeping the count whole', 'keeps three pixels spare, because every width it reads
  was rounded to the pixel grid', 'holds its one line without words until the first measurement lands,
  and never draws two', 'follows the widths when the text size, the screen or the sentence changes',
  'keeps its measuring words from screen readers on both platforms, and measures in the type it draws';
  and 'is said in English at parity' for the new wording. Each failed against the code before the
  change. jest has no layout engine, so these fire `layout` events with widths from a stand-in font.
  None of this has been walked on a device.

  Reviewed the same day, before it shipped. Checked in the tests' render tree: `onLayout`, the
  hiding props and `pointerEvents` reach the native Text and View, not only Tamagui's wrappers.
  `fireEvent` walks up to any handler, so a prop dropped on the way would still have passed. The
  line itself is `accessible`, so both screen readers read its label, not the clauses drawn. In
  React Native 0.86 (`BaseViewEventEmitter`, `ShadowTree::emitLayoutEvents`), one commit emits every
  layout event before the next render, so the widths arrive together. Three corrections. The count's
  key was `crossBox.more`, which read as the dots' own box count (`crossBoxMore`); it is now
  `crossBox.notShown`, matching `crossBoxNotShown`. The room does not change only with the screen:
  the text size and the dots change it too, and `onLayout` already follows. The rounding reason above
  is stated as Yoga does it (`PixelGrid.cpp`), not as every edge rounding to the nearest pixel. Known
  and accepted: the frame after a refresh changes a clause, that clause and those after it wait in the
  count until measured. They are never drawn half.
- **FR-002** Read from the local archive and the account record only. Nothing here may open a socket.
- **FR-003** Show unread count, the nearest deadline (reminder, scan estimate or fiction), and
  whether the box is still syncing. Order by what is closest to hurting the user.

  *Amended 2026-09-14 (as built, after FR-001's one-line form):* the line is one sentence about all
  the other boxes (`crossBoxSummary`). Its clauses follow the order the boxes and their dots are
  sorted in, so a narrow screen always leaves out the least urgent clause first (FR-001, amended
  2026-09-15):

  1. missed deadlines, counted one by one: `1 po termínu`;
  2. the nearest deadline still ahead in any other box, said relatively: `termín dnes`,
     `termín zítra`, `termín za 3 dny`, `termín za 5 dní` (`crossBox.due.*`). Reminders and accepted
     scan estimates both count. Each box carries the date of every deadline (`deadlines`), and the
     line counts them against the inbox's own clock when it is drawn, by the attention group's
     whole-day rule. The aggregate is re-read when the accounts or the box change, not at midnight,
     so a day count stored in it would still say `zítra` on the morning the deadline is due. Counted
     at draw time, the line moves on together with the deadline chips in the rows. A box with a missed
     deadline and one due tomorrow still says tomorrow. `soonest`, which includes missed ones, only
     orders the boxes;
  3. mail served by fiction: `1 doručeno fikcí`. A received fiction-served message has no date left
     to count down (013 §6), so it is not a deadline here. It gets its own clause and its own place
     in the box order: below any box with a deadline, above plain unread, as in the attention group.
     The unread badge counts it too, so the unread clauses leave it out, and one such message never
     reads as two. It counts whether or not it was opened on this device, as in the box's own
     attention group: a message leaves the badge and state 5 together, once ISDS confirms the read;
  4. other unread mail, `2 nepřečtené`, then unread mail in boxes we could not refresh, marked as
     last known (FR-004);
  5. boxes we could not refresh: `1 nenačtená`;
  6. `načítá se…` while `refreshAll` is fetching a box the line reports. The shell counts in-flight
     boxes per refresh (`countInFlight`), so overlapping refreshes cannot clear each other. It skips
     boxes waiting for a sign-in (`reauth` or `passwordExpired`, `boxesToFetch`), and clears the mark
     only once every box it fetched is done and the accounts are re-read - or when that re-read
     fails. A box that fails is its own `error` flag and settles nothing for the others (amended
     2026-09-15, below). A retried box reads as loading, not as not refreshed. The mark never adds a
     row: a quiet box being refreshed brings no line with it (constitution V).

  Sent-message fiction countdowns are not on the line. They are the recipient's clock, and the line
  reads only the received archive (FR-002).

  Fixed: a box whose only news was an upcoming reminder rendered `Jinde: ` with nothing after it.
  Every box `crossBoxAttention` reports now produces a clause. The line renders nothing when the
  sentence is empty, and the inbox asks the same question before inserting it, so the attention
  block keeps its closing footer. While a refresh starts and settles, the line stays one line with the
  same dots.

  Corrected on review the same day, before any of this shipped. The deadline had been phrased from a
  day count fixed when the boxes were read. And a fiction-served message opened here, but not yet
  confirmed as read by ISDS, had been reported as plain unread.

  Evidence: `src/features/messages/state/crossBox.ts`, `src/features/messages/screens/CrossBoxLine.tsx`,
  `src/features/messages/screens/MessageList.tsx`, `src/app/AppShell.tsx`, `src/i18n/strings.ts`.
  Tests: `__tests__/messages/crossBoxLine.test.tsx` (one test per clause, plus "leads with what is
  closest to hurting you", "is said as of the moment the line is drawn, not when the boxes were
  read", "phrases its deadline with the clock it is drawn with", "has words for every kind of box the
  aggregate reports", "never renders the prefix with nothing after it", "keeps its one line while a
  refresh starts and settles"); `__tests__/messages/crossBox.test.ts` ("keeps every deadline, soonest
  first, so a missed one cannot hide the next", "still counts one opened here that ISDS has not
  confirmed as read", "a refresh in flight", "countInFlight", "puts mail served by fiction below any
  deadline and above any amount of unread"); `__tests__/messages/crossBoxInbox.test.tsx`;
  `__tests__/i18n/czechAgreement.test.ts` (`crossBox.due.in`, `crossBox.lastKnown`).
  `__tests__/app/crossBoxRefreshing.test.tsx` mounts the real `AppShell` over a fake of its
  dependencies and holds one box's listing, and then the accounts re-read, open. `načítá se…` shows
  while that box is fetched, never for the box skipped for re-auth, and stays until the new count has
  been re-read. When the box fails, it gives way to `nenačtené`. None of this has been walked on a
  device.

  *Amended 2026-09-15:* a refresh in which one box THROWS - a database write failing - is driven
  through the mounted shell as well ('keeps the note up while one box is still fetched after another
  failed to record, and settles when both are done'). It used to be read from the source, because
  `refreshAll` rethrew the rejection and nothing caught it, and the code it read was wrong: one
  `Promise.all` rejected on the first box that threw, took the mark down for the boxes still being
  fetched, and never re-read the accounts. Every box now settles on its own (`refreshBox` in
  `src/app/refreshAll.ts`), a box that throws becomes its own `error` flag, and `refreshAll` never
  rejects; a table that will not read is reported and leaves the screen as it was. A box waiting for
  a password change was also marked as loading, by a second copy of the skip that knew only `reauth`
  ('never marks a box waiting for a password change as loading'). Both mounted tests failed against
  the code before the change. Unit tests: `__tests__/app/refreshAll.test.ts` ('flags only the box
  whose counts would not record, and records every other box', 'resolves only when every box is done,
  even after one has already failed', 'never rejects, whatever throws'), `refreshAllSkip.test.ts`.
- **FR-004** A box we cannot reach still reports its last known count, marked as last known. Hiding
  it would hide the thing the card exists to surface.

  *Amended 2026-09-14 (as built):* a box we cannot reach still reports its last known unread count,
  and the line marks it as last known: `naposledy 1 nepřečtená` (`1 unread, last known` in English, shortened 2026-09-15), kept
  apart from fresh unread (`crossBox.lastKnown.*`, from `BoxAttention.stale`). The box also counts
  as not refreshed (`1 nenačtená`) unless a retry is in flight, and its switcher row still says
  `Poslední známý stav`. Tests: "still reports its unread mail, marked as the last count we know",
  "keeps remembered counts apart from fresh ones" (`__tests__/messages/crossBoxLine.test.tsx`).
- **FR-005** Render nothing when every other box is quiet. No permanent "nothing to report" panel.
- **FR-006** Resolve before the list paints, so it never pushes settled rows down (constitution V).
- **FR-007** ~~Tapping a row switches to that box.~~ Tapping the line opens the box switcher, where each
  box shows its own count and sync state. (A card with a row per box that switched directly was
  replaced by the one-line form; see FR-001.)

## Cycle 2 (built) - A, the merged list

- A `Vše` entry above the boxes in the switcher, rendering the merged archive newest-first.
- A box chip on every row. A row whose box is not visible is the one risk this app cannot take.

**It is a MODE on the existing inbox, not a second screen.** The first implementation built a
separate `UnifiedInbox` and it diverged immediately: no avatars, no month sections, different row
metrics, no attention group, no freshness line. Two components drawing "an inbox" is two places for
the design to live, and they will not stay equal. The only thing that genuinely differs between one
box and all boxes is whether a row has to say which box it came from, so that is the only thing the
flag changes: `unified` selects the data source and turns the chip on, and everything else - the
sections, the rows, the empty states, the pull-to-refresh - is the code that was already there.
- Per-box refresh reporting: one spinner cannot report four outcomes. "3 of 4 refreshed,
  Podnikající FO needs a sign-in" is the shape.
  **As built:** a banner in `Vše` states how many boxes could not be refreshed, without naming them
  (`unified.missing.*`). When exactly one box needs a sign-in, its action goes straight to that
  re-auth; otherwise it opens the switcher, where each broken box is marked. The "3 of 4" count and
  the box name were not built.
- Compose, credit and the sent folder stay per box. `Vše` is a reading surface, not an acting one.

### The one-box question, settled

**With a single box the merged view does not exist at all** - it is not offered, not enterable, and
not restored from persistence. `Vše` and that box would be the same list, so offering both is a
choice whose two branches render identically: the user has to work out that it does not matter, and
they learn a model that silently changes meaning the day they add a second box.

The threshold is enforced in both directions (`resolveUnified`). A user with two boxes sitting in
`Vše` who removes one is put back on their remaining box, rather than left in a view that has become
their only box under a title saying "all".

### Distinguishing it from a box

A user can name a box `Vše`, so the difference cannot be lexical. Four structural signals, any one of
which survives an exact name collision:

1. **Shape** - a rounded square holding a glyph, where a box has a circle holding initials. Circle is
   who, square is what.
2. **Placement** - above the boxes, in its own group, separated by a hairline.
3. **Subtitle grammar** - it says how many boxes it merges, which no box can say about itself.
4. **No overflow menu** - nothing to rename, nothing to remove, so the affordance is absent rather
   than present-and-disabled.

## Out of scope

Reversing 011's inbox-first IA (mockup option B). Grouping by box instead of by date (option D).
Any refresh trigger 014 does not already permit.

## Device walk, 2026-09-15

On the `Obalka_Demo` Android emulator (1080×2400, density 420), over a demo archive of three boxes. The
unified inbox showed "3 schránky · 4 nepřečtené", the three boxes that could not be refreshed as one strip,
and the attention block with the fiction-served chip and each message's box tag. In a single box, the
cross-box line read "Jinde: 1 doručeno fikcí · naposledy 3 nepřečtené · 2 nen…" - cut mid-word, reported by
the owner the same day. After the FR-001 fit amendment above, the same screen showed "Jinde: 1 doručeno fikcí
· naposledy 3 nepřečtené · +1" at font scale 1.0 and "Jinde: 1 doručeno fikcí · +2" at 1.3, both on one line,
with the accessibility label still carrying the whole sentence. Not walked: the still-refreshing clause and a
reminder-only line, which the demo archive does not produce.

