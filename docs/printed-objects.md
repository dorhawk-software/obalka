# The printed objects

The detail behind DESIGN.md › Colors › The printed objects: what each object is for, the tokens it
takes, and the numbers measured for it. DESIGN.md keeps the rule; this page keeps the inventory, so the
design file stays within the size limit as the objects reach the screens.

"Obálka is printed matter" (spec 031; the identity agreed by the owner on 2026-11-11, every board by
2026-11-12, on the design canvas). Six objects, each with one job; objects play, chrome doesn't. The
values are read from the canvas's source. Colours are in `src/theme/theme.ts`, the geometry in
`src/theme/print.ts`, the shadows in `src/theme/depth.ts` (`objectShadow`, `objectFilter`).

- **Envelope** (`#2563A6`, **fixed in both appearances**): a box, and what arrives in it. The inbox
  header, a message, compose, the sent result, the box avatars. Its folds are `envelope-crease`
  (`rgba(9,30,64,.22)`). Words on it are `on-solid`; its secondary words and the postmark are
  `envelope-ink-soft` (`rgba(255,255,255,.92)`, 5.51:1 composited). As an avatar tile (a box, a
  sender) it is a small envelope: a sealed gold flap while unread, else an `envelope-fold` line
  (`rgba(255,255,255,.55)`). The inbox header is its front (lower corners 22, the flap shaded by
  `print-shade`); controls printed on it take `envelope-well`, `envelope-button`, `envelope-ink-faint`
  and `envelope-plane`. Opened, it is the empty inbox (board Empty): the flap up in the gold under
  `flap-shade` (`rgba(33,27,18,.14)`, its inside faces us), the `envelope-inside` (`#1A4C86`) printed
  with the `lining`, and the front pocket's folds in `envelope-fold-faint` (`rgba(255,255,255,.18)`).
- **Flap** (`#FFC305`, fixed): the envelope's gold, and the stamp-shaped compose button. Words on it
  are `on-gold`; the compose stamp's frame is `flap-frame` (`rgba(33,27,18,.28)`), printed in the
  stamp's drawing (a translucent View border drew twice as wide on Android), and its glyph sits on a
  `flap-plane` (`rgba(255,255,255,.55)`) with a 1.9 line.
- **Window** (`#FFFDF8` / `#2A251E`): who it is addressed to - the box switcher, the recipient in
  compose (also its search field), the login name while signing in. Its edge is an inset shade (the
  envelope's paper over it) and a film that catches the light, over a `window-glint` cast
  (`rgba(214,228,246,.14)` / `.03`). In dark it is 2.47:1 against the
  envelope; the words in it identify it, so 1.4.11's boundary floor does not apply, and the number is
  pinned in `contrast.test.ts`.
- **Security tint**: the inside, the private - chevrons of the envelope's blue, 16 x 14, at 16 % (light)
  or 12 % (dark), behind the lock and the slips. The lining of an open envelope is the finer `lining`
  print (`#9EC0EA`).
- **Postmark**: a date ISDS certifies - two rings, the waves, the word and the date in
  `envelope-ink-soft`. It lands when ISDS accepts a send (board Motion).
- **Stamp**: what a send costs - `stamp-paper`, a `stamp-frame` rule, `stamp-ink` for the value, the
  muted `stamp-label` for the small print, perforated (4 every 12; the small stamp 3.5 every 10). Light
  in both appearances: it is paper stuck on the envelope. A used stamp is cancelled in `cancel-ink`.
- **Slip**: a record you keep - the delivery record, the recovery key, the transfer code. A sheet with
  a perforated top (5 every 14) and a faint `slip-mark` ring. On the delivery record each step is
  struck as a ring (`RecordRing`, `recordRing`: two rings on a 34 grid) - a check for the arrival in
  `body-text`, clock hands for fiction in `gold-ink` on a 1.6 line, the inner ring filled for a service
  someone signed in for; a step still to come is the outer ring alone, dashed (the sent result).
- **Document sheet**: a file in a message (board Message) - a sheet 40 x 46 in `surface-sunken` with a
  `border-strong` edge and its corner folded in `doc-fold` (`#E8DECB` / `#3B3429`), the file's type
  printed at 11 ("PDF" in `danger`, any other type in `text-muted`). The signed original sits beside it
  as the seal glyph in a well.
- **Airmail strip**: the test environment, stripes of envelope, paper, flap and paper at 135 degrees.
- **Offset glyphs**: a 1.75 ink stroke with one plane printed 1.3 off register, `icon-plane`
  (`#CFE0F5` / `#2F4A6E`), or `icon-plane-gold` (`#F3D891` / `#5A4716`) on gold. Plain controls stay
  Lucide.
- **Seal**: the lock's wax seal, `seal-light` to `seal-shade`.
- **Sheet edge** (`#F7F1E4` / `#231F19`): the second envelope's edge under an attention sheet. Every
  board draws it under the sheet of a message delivered by fiction, and only there, so that is where
  the inbox puts it.
