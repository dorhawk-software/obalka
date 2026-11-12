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
- **A locked Obálka is an envelope sealed with wax.** The lock says your messages and sign-ins are
  under lock, and the Unlock button sits at the bottom, within reach of your thumb.

### Fixed

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
