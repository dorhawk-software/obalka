# What's new

What changed in each Obálka release, written for the people using it. The newest is at the top.
Česky: [CHANGELOG.md](CHANGELOG.md).

<!-- How this file works (spec 029, scripts/changelog.mjs):
     Every change a user would notice adds an entry under "Unreleased" here AND in CHANGELOG.md, in the
     same commit and with as many entries in each kind. The kinds, in this order: New, Better, Changed,
     Fixed, Underneath (what the app is built on; on its own it interrupts nobody after an update).
     An entry starts with what changed, in bold: "- **What changed.** Why it matters."
     `npm run release` refuses an empty Unreleased and turns it into "## <version> (<date>)". That section
     is the GitHub release's text, the App Store's and Google Play's "What's new" and the app's own. -->

## Unreleased

### New

- **Save a copy of an attachment or the signed original wherever you like.** The Download button
  beside a file saves a copy through the system dialog; tapping the row opens the file as before.

### Changed

- **The subject no longer hides under the envelope.** The subject now has as much room above it as the
  letter has below its last line, in a message and in Compose.
- **The letter comes out from under the envelope.** On a message and while writing one, the letter's top
  lies under the envelope and the envelope's shadow falls down onto it; until now the letter lay on top
  and its shadow pointed up. Bottom sheets in the dark appearance no longer throw a shadow upward; their
  tone is their edge.
- **In the dark appearance, cards and envelopes end in their own tone.** Cards, envelopes, the box menu
  and the notice at the bottom no longer have a faint light line round them; the edge is the surface one
  step lighter than the page and the shadow under it, as in the light appearance.
- **Buttons show what they do.** Every button that does something carries its mark before its words: a
  key on "Sign in", a bin on "Delete", an envelope with an arrow on "Send". Buttons that only move on or
  leave things as they are ("Continue", "Keep") stay as words, so you can tell at a glance which button
  changes something.
- **The two ways to a backup's password have room between them.** "Scan the password from a QR code" and "Use the password from this phone" touched, so a thumb aimed at one could land on the other; there are now 8 points between them.
- **The "Wi-Fi only" switch says why it is dimmed.** While documents don't download automatically, it reads "Applies when documents download automatically." The faintest grey text is a shade darker, so it reads on the grey ground too.
- **The button that closes a question says what stays.** Instead of "Cancel", for example "Keep it on", "Don't send" or "Close the camera", and receiving a backup from another phone says "Receive the backup": what happens is clear without reading the question.
- **A sent message's postmark cancels its stamp, as real mail does.** The ring sits over the stamp's edge, in the dark ink of the waves, with the date on the stamp's paper. The waves run out of the ring and never cross the date. On a narrow phone it no longer covers the sender's name.
- **The FAQ and the privacy policy say who does what.** Where they said "we", they now name the app or its developers, so it is clear who can reach your data and who cannot.
- **The password field says its name once.** "Password" stands above the field and no longer inside it, as with the username.
- **Error reports have their own glyph.** In Settings › Diagnostics the error-report row leads with a bug instead of the bell; the bell stays with notifications.
- **The message detail has the same header as every other screen.** Going from the list to a message and on to Settings, the header no longer jumps.
- **A clean envelope window in dark.** The grey band and smudge that lay over the address window at night are gone.
- **A switch you can't use doesn't look on.** It takes the grey track; its knob stays on its side, so you can see what will apply once it can be used.
- **Less red in the box switcher.** A box with a problem shows only the problem in red; "Last known state" is grey, and the alert badge no longer covers the letters.
- **A backup screen that says each thing once.** The paragraphs that repeated the card are gone and the attachments switch has a shorter line. The sign-in form calls the name "Username", as ISDS does.
- **The app speaks for itself.** Texts that spoke in the first person now say what the app does, or what is happening.
- **An undeliverable message has its mark in Sent.** "Undeliverable" now follows the filled
  disc with a slash, as in the help and the message detail; it used to be the quietest line in
  the list.
- **Grey buttons stand out on the paper too.** "Back up now", "Verify backup" and "Show password"
  have a fill a tone deeper, so they no longer look like bold text.
- **Time lines say what happened.** "Updated 5 minutes ago" above the messages and "Backed up
  15 Nov 2026, 17:13" on the backup, in place of a bare "Last".
- **Dates are written the same way everywhere.** "12 Nov 2026, 9:20" and "29 Aug" on the envelope,
  the delivery record, the backups and the postmark; the English app used to show Czech numbers.
- **A sent message carries the stamp you saw while writing it.** The same size, kind line and
  all, now cancelled. Until you pick a recipient, the envelope's corner holds a faded blank stamp
  instead of a dashed frame.
- **A Send you cannot use yet is dimmed like every other button.** Until the message has a
  recipient and content, the button looks the way other unavailable buttons do.
- **A box's monogram leaves out the degree.** "Ing. Ondřej Dvořák" is OD, not IO, so one person's
  two boxes no longer look like two people.
- **The green of a delivered sent message is darker.** "Delivered" in Sent reads well even in small
  type.
- **An unpicked option has a clear ring.** The rings in Appearance, Language and elsewhere have the
  edge an off switch has.
- **The Test tag's letters are a touch larger.** It is now the size of the other tags.
- **A refused sign-in no longer repeats its title.** The card's text starts with what is wrong:
  "The name or password is wrong…".
- **Deleting a debug recording asks the way deleting a backup does.** "Delete this recording?", the
  file under it and what happens; the title used to be just the file name, broken in two.
- **A box's unread count shines in the stamp's gold.** A touch larger and the same yellow as the
  Compose button; the sign-in mark beside it has the same rim.
- **Downloading attachments of unknown size shows a moving bar.** It used to stand half full.
- **The backup's advanced options say what they hold.** The row under the Advanced heading no
  longer repeats it: it names automatic backups and how many are kept.
- **A sent message's fiction countdown carries the envelope with a clock.** The same mark received
  messages show for fiction, in place of a stopwatch.
- **The app icon has a dark and a tinted look.** On iPhone dark mode shows the blue envelope with its
  gold flap on a dark ground, and tinted mode a grey one; Android 13 and later recolour it from the
  wallpaper when themed icons are on.
- **On Android the app opens on its paper.** The system's opening screen is no longer grey-white, so
  the screen no longer flashes to the app's colour after it.
- **In the inbox, Debug mode's recording notice sits on the envelope's flap.** The envelope still
  reaches the top edge.
- **The backup looks like the rest of the app.** Back up and verify are two matching buttons, a
  running backup shows its progress right under the switch, each backup in the list has its
  documents label at the end, and an opened backup offers Delete and Restore side by side.
- **The error-report question offers both answers alike.** "Don't send" and "Send reports" are the
  same button; before, agreeing was filled and refusing only outlined.
- **The FAQ is headed as Settings is.** The note on the data-box answers is the quiet line under its
  group's heading, not a separate note with an icon.
- **The welcome screen shows an envelope waiting for a box.** Its window is still empty; under it
  are the app's name, the buttons to add a box or restore, and the language in the corner.
- **Waiting looks the same everywhere.** Wherever the app waits, its own small ring turns in place
  of the system's spinner, the same on Android and iPhone.
- **Search results look like the message list.** They carry the day and month, the sender, the
  clip, your reminder and the label of the box the message is in, and a sent message shows its
  delivery state.
- **The message text becomes a letter on A4.** The "Textová zpráva.pdf" attachment carries the
  sender, the recipient with their address, the date and the subject, as a Czech letter does, set in
  the app's own typeface.
- **A paid message asks with the stamp you are paying for.** The question before a postal data
  message is sent shows the stamp with its price and the box's credit, and rises like every other
  question in the app.
- **A new message is the envelope you are sending.** The sender is on the envelope, the recipient
  in its window, and the stamp in the corner shows whether the message is free or paid as soon as
  you pick the recipient. The subject and text go on a sheet tucked under the envelope.
- **A deadline found in an attachment is offered more quietly.** The suggestion sits on a plain
  tinted panel with no outline, saving it as a reminder or hiding it are links under it, and while
  it looks, the same bar runs as elsewhere in the app.
- **The English postmark reads all the way round its ring.** Its words fill the ring as the Czech
  ones do, with no empty stretch left in it.
- **Attachments that could not be downloaded or opened look like the rest.** A file stays a sheet
  of paper, only fainter, and missing ones come back with the same blue button as the whole message.
- **The Received and Sent switch is set in the app's own typeface,** and at launch the chosen tab and
  the Compose button appear whole at once, not piece by piece.
- **Reminders and password alerts carry the envelope's blue in the notification shade,** the same as
  the app icon.
- **Every question shows what it is about.** A mark stands above its title: the lock, the backup, the
  attachment, the transfer or the alert; in a transfer the main answer is filled and comes first.
- **The short notices at the bottom of the screen no longer cover the Compose button.** They stand above
  it, fade away instead of vanishing, and in dark mode have a faint edge so they don't get lost.
- **The box menu opens beside its ⋯ button, and editing a box rises from the bottom.** The editor shows
  the box's envelope with the name and colour as you type and pick them, and needs only Save.
- **The reminder and the sender picker have the new look.** The reminder's dates are one card with
  bolder labels and Remove stands beside Save; the boxes to send from carry their envelope, and a ring
  marks the chosen one.
- **Questions and notices rise from the bottom like the other panels.** The answers stand one above
  the other within reach of the thumb, the main one first, and above the question is what it is
  about: the envelope of the box being removed, for one.
- **What's new reads as text.** Each change is one paragraph with its first sentence in bold, grouped
  by kind, and the sheets from the bottom have a larger title and more room at the sides.
- **Licences are easier to read.** Each licence is one row with its count of components, every
  component opens its licence's text with its own copyright notice, and the text flows in paragraphs.
- **Debug mode is tidier.** A running recording has a card of its own with the count and both
  buttons, a blue strip confirms the save, and each saved file offers Share and Delete side by side.
- **Moving to another phone is clearer.** The backups to send sit on one sheet with their size and
  what they hold, and sending is one large button. Receiving has a screen of its own: scan the code,
  the password field, and a Receive button that waits until the password is typed.
- **Moving to another phone ends on a screen that says what arrived.** The archive lands as a stack of
  envelopes, with what was restored under it, what is still to do and which way the transfer went.
  While it runs, the amount moved so far sits beside the stage, and a stopped transfer says so in a red
  block at the top of the half it concerns.
- **Changing the password looks like the rest of signing in.** The new password's rules are on a
  sheet and tick green as they are met. An error is a tinted block with no icon, and a large lock
  confirms the change.
- **Signing in again looks like adding a box.** The box is a sheet with its own envelope and a lock.
  When ISDS refuses the password, the form and what you typed stay, with the reasons and two links
  in a sheet under the field.
- **Every message in Needs attention rests on the same edge.** Only messages delivered by fiction
  had it, and they looked like a pile of several; the tag says how a message was delivered.
- **The sign-in fields are calmer.** A small tag names the method, the field labels are muted, and
  the Mobile Key communication code shows as you type it. When ISDS refuses the password, a sheet
  under the fields lists the reasons with two links.
- **When ISDS refuses the sign-in, one card with a lock says so.** Edit the name or password returns
  to the filled-in fields, not to the choice of method, and a link leads to the ISDS portal. Other
  errors show the sealed envelope, the reason and Try again.
- **The sign-in methods are one sheet with the choice on the right, as in Settings.** When adding a
  box and when signing in again. The environment's help stays open under the switch.
- **The SMS code goes into eight boxes, one for each digit.** The field takes digits only, eight at
  most, even from a paste with spaces, and Confirm waits for the whole code. A blue strip says it was
  sent.
- **At launch, one thin bar waits under the logo instead of a spinner.** When the boxes will not
  load, the message and Try again take its place; the logo does not move.
- **While the Mobile Key is awaited, your box's envelope lies still.** Its flap is sealed, the login
  name is in the window, and one bar under it is the only motion; the spinner and the pulsing tile are
  gone.
- **The name first, then the kind of box.** "Jan Novák - podnikající fyzická osoba" is now
  "Jan Novák" on the envelope with a quieter "PFO · ID …" under it; tap it to spell the kind out. Lists
  and search show the name alone.
- **The top of the inbox is the front of an envelope.** The box's name is in the envelope's window
  under the gold flap; tap the window to switch boxes, with search beside it and Received and Sent
  below.
- **Messages that need you lie as sheets of paper; the rest are in a register by day.** The sender's
  envelope stays sealed with the gold flap until you read the message, and the edge of a second
  envelope shows under a message delivered by fiction. The day and weekday appear once, beside the
  day's first message.
- **The line about your other boxes is a plain sentence.** "In your other boxes **2 unread**",
  without the coloured dots and rules; on a narrow screen the opening shortens to "Elsewhere:", never
  the news itself.
- **The Compose button is a gold postage stamp.** It has a perforated edge and a printed frame.
- **An empty inbox is an open envelope.** Under it, when Obálka last looked ("Last checked today at
  14:02"), in the same words as at the end of the message list.
- **A received message lies in the envelope it came in.** The sender is on the envelope with a
  postmark of the day and minute it was delivered, the recipient in the window and the subject on the
  sheet sliding out of it.
- **A message delivered by fiction has a gold band at the top with a Remind me button.** The band
  gives the day the law delivered it for you, and Remind me sets a reminder of the deadline that day
  started.
- **The delivery record is a tear-off slip.** Each step has a stamp - a check for delivery, a clock
  for fiction, a filled ring for acceptance by signing in - a short note, and the date over the time on
  the right.
- **Attachments are sheets of paper with the file type.** Each says it is in the archive; the signed
  original sits in the same list.
- **A sent message is an envelope with a cancelled stamp.** The stamp shows what sending cost, the
  postmark carries the time ISDS accepted the message, and below the envelope is the delivery record,
  which fills in once the recipient opens it.
- **When ISDS accepts a message, the postmark lands on its stamp.** The phone gives one firm tap,
  like a rubber stamp on a desk, and the envelope then rises into its place; with Reduce Motion it
  all simply crossfades.
- **A locked Obálka is an envelope sealed with wax.** The lock says your messages and sign-ins are
  under lock, and the Unlock button sits at the bottom, within reach of your thumb.
- **Unlocking breaks the seal and opens the envelope.** The first time since the app started, the
  seal snaps in two with a light tap, the flap turns over and the inbox is underneath; later unlocks
  only open the flap. A failed check just shakes the seal. With Reduce Motion the lock simply fades.
- **An opened message comes out of its envelope.** The sender's tile grows into the message's
  envelope and the sheet with the subject rises out of it; opening a message no longer taps, reading
  is quiet. With Reduce Motion the message simply fades in.
- **Scroll down a message and its envelope tucks into the bar at the top.** The sender and, in the
  window, the recipient stay in sight while you read the record and the attachments; back at the top,
  the bar returns.
- **The glint on the envelope's window moves as you tilt the phone.** Only a little, and only on the
  screen in front of you; with Reduce Motion it stays still.
- **Sent messages are in the day-by-day register, like received ones.** On the right is when ISDS
  delivered the message or when it was accepted, with a postmark; drafts are one sheet above the list.
  In all boxes a message carries only its box's initials, so the sender or recipient fits beside it.
- **All boxes shows the boxes' envelopes fanned out.** In the header and in the switcher the merged
  boxes' envelopes lie over each other with their count on the front one; each box in the switcher
  has its envelope, and adding a box is a filled button.
- **The notices above the message list are cards in their message's colour.** A signed-out box, a
  password running out and a missing box each have their own card with its button; the line about
  saved messages sits quieter under them.
- **A loading box takes the register's shape.** Until the messages load, rows with a day and two lines
  of text hold their place; a sync shows as a thin bar under the notices that moves nothing.
- **When there is nothing to show, the envelope shows why.** An empty Sent folder has an envelope
  with a blank stamp, a box that failed to load a sealed envelope, a box waiting for a sign-in an empty
  window, and search a stack of envelopes. The search field has a magnifier, and the bar above search
  ends without a line.
- **Cards are sheets of paper with weight.** They lie on the paper with a soft shadow and no outline. In
  Settings each option has its mark in a well, the chosen one a blue ring with a dot, and a switch that
  is off is warm like paper.
- **The backup password and the transfer code are slips on the envelope's pattern.** The password and
  the code stand on the slip in larger type on two lines, and the QR code is on paper with the Obálka
  logo in its own colours; the warning and the buttons are under the slip. During a transfer only
  lines follow it: what is happening, the bar, Cancel transfer and, last, which way the transfer goes.
  The progress bar lies in the paper more softly.
- **A sent message is the envelope it went in.** You are the sender, the recipient is in the window with
  their address, and the stamp is cancelled by the postmark from when ISDS accepted it; under it is the
  delivery record, which fills in once the recipient opens it. The reminder and the attachment download
  have their mark in a well, and the Download button is inside its card.
- **A test box shows an airmail strip above a message.** Blue and gold stripes say it isn't real mail.

### Fixed

- **The recipient search says when the box must sign in again.** When ISDS refused the box's sign-in,
  the search said “Příjemce se nepodařilo vyhledat. Zkuste to znovu.” (could not search, try again),
  though trying again could not help. It now says what sending says, such as “Platnost hesla vypršela.
  Změňte ho v portálu ISDS a přihlaste se novým heslem.” (the password expired; change it in the ISDS
  portal).
- **The request to sign in again stands in the inbox from the moment the app opens.** Until now, at
  every launch the blue “Platnost hesla vypršela.” strip stood in for it until the sync answered, and
  the list under it then jumped by two lines.
- **A sent message's window no longer covers the postmark.** With an address it grew upwards over
  the date and time it was sent; now the envelope grows downwards.
- **The clock over the gold flap reads in dark mode.** The status bar was white on yellow.
- **The box switcher shows every box.** A fourth box hid under the list's edge with nothing to say
  it was there.
- **A screen reader reaches the message fields and hears more.** On iPhone it gets into To, Subject
  and Text; a disabled switch is announced, options say "selected", headings are headings, Advanced
  says whether it is open and the recipient search says what it is doing.
- **Small buttons have the full touch area.** Saving and removing attachments, the portal links and
  others reach 48 points like the rest of the app; Advanced and Help no longer share a spot.
- **The English app writes sizes and credit in English.** "2.6 MB of 4.2 MB" and "1,234 CZK"
  instead of the Czech decimal comma and "Kč".
- **Dimmed buttons on Android fade as a whole.** Their words used to sink into the button's colour.
- **Nothing is cut at the largest text size.** The day in the list no longer breaks between its
  digits, the monograms fit their tiles and the recipient field is whole. Text grows to at most twice
  its size, on iPhone too.
- **Cancelling the prompt that turns the lock on no longer claims the phone has no screen lock.** A
  phone with a PIN and no fingerprint was told "Biometrics unavailable" after a cancel.
- **The refresh indicator is no longer a white disc in dark mode.** On Android it now sits on the
  colour of the cards.
- **On Android, a sheet closes when you drag it down.** The box switcher, the language and deadline
  pickers and the other sheets used to stay put under the finger; now they follow it, and one let go
  too soon springs back.
- **On iPhone, a message opened from the list goes back with a swipe from the edge.** The gesture
  did nothing on it before; now the message fades under your finger and you are back in the box.
- **The code reader's hint can be read in dark mode too.** The reader shows the envelope's window to
  aim the code into, with the hint and Cancel on a panel at the bottom.
- **Words on the plain buttons are in the app's typeface.** Cancel, Resend SMS or Buy credit, for
  example, were drawn in the system's on Android.
- **The envelope's folds run all the way to its corners.** On a message's envelope the lines stopped
  short of the edge.
- **An undeliverable sent message says so legibly in Sent.** "Undeliverable" was light type on light
  paper, almost invisible; it is now dark like the rest of the text.
- **A message the app can't find on the phone shows a sealed envelope and the way back.** Before, an
  empty screen showed only a red "Please try again" over a Back button.
- **One-letter Czech words no longer end a line.** "v", "k", "s", "o" and the others move to the next
  line with the word after them, and a number stays with its unit ("4,2 MB"), in Settings, help and
  What's new. Debug mode writes a size with the decimal comma.
- **An empty box shows its empty envelope, even when something waits in the other boxes.** Before,
  there was only blank paper under the line about the other boxes.
- **What you type into a field is in the app's typeface.** On Android, fields used the system font.
- **An open question no longer shows over the lock screen.** When the app went to the background
  with a dialog open (the paid-send confirmation or the mobile-data question, for example), it was
  still visible over the lock screen on return. It now closes; a transfer that arrived waits until the
  app is unlocked again.

## 1.1.0 (2026-11-11)

### New

- **Change the password in the app.** A box that signs in with a name and password changes it right
  in Obálka while the current one still works: type the current one and the new one twice.
- **A notice before the password runs out.** A week and a day before, a notification reminds you to
  change it, or the box stops letting you in.

### Better

- **A refused password says what it may mean.** ISDS refuses an expired password exactly like a
  wrong one, so the app names both and offers the way to the ISDS portal.
- **Obálka says what notifications are for before the phone asks.** After a box is added it first
  explains the password-expiry notice; the system prompt comes only if you want them.

### Fixed

- **A password validity changed on the portal reaches Obálka.** When a password starts or stops
  expiring, the app learns it on a refresh, without signing in again, and warns or stops warning.
- **Dialogs in dark mode have an even edge all round.** It used to light up only along the top.

## 1.0.0 (2026-11-11)

### New

- **Obálka's first release.** Every data box in one list; an encrypted archive of messages,
  attachments and signed originals on your phone that outlives the 90 days ISDS keeps them; running
  deadlines and deemed delivery in plain sight; sending; offline search; an encrypted backup and a
  move to a new phone. It signs in to a box only when you ask: nothing happens in the background.
- **A dot on Sent.** When a message you sent is delivered, served by fiction or found undeliverable,
  a dot on Sent says so until you open it.

### Better

- **Sent messages are archived without opening Sent.** Opening the app lists every box's sent
  messages, so they reach the archive, a backup, a transfer and search before ISDS deletes them
  after 90 days.
- **A box's unread count is right as soon as you refresh just that box.** It used to wait for a
  refresh of every box.
- **A sent message says when its state was last checked.** While the state can still change, the
  delivery status shows "State as of …", so you can tell how old it is.

### Fixed

- **Sent in all boxes at once shows the messages of every box.** A box whose own Sent you had not
  opened yet was missing. Pulling down now waits for the boxes to refresh and shows the new messages
  straight away.
- **The signed original's row is as tall as the attachments above it.**
- **Downloading "new messages only" no longer fetches old sent messages.** Only messages delivered
  after it was turned on count as new.

### Underneath

- **The library that reads the data box replies brought up to date** (fast-xml-parser 5.12.0).
