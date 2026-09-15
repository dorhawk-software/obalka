# Feature Specification: The app does not boast

**Feature Branch**: `022-copy-tone-audit`
**Created**: 2026-08-19
**Status**: Specified → implemented same day
**Input**: user, 2026-08-19 — the Welcome tagline read *"Vaše státní pošta — **konečně** přehledně, v
bezpečí a bez stresu."* and *"it seems like the original application datovka.cz would be a complete
disaster and there is FINALLY a good thing out there, sounds way too cocky"*. Their proposed wording:
*"Vaše státní pošta — přehledně, bezpečně a bez stresu"* — **"not sounding cocky, while sounding
nice"**. The request was to audit **all** copy, in **all** locales, for the same problem.

## Why this is worth a rule rather than one edit

The app's whole pitch is that it tells the truth about what it does — 013's lock-screen promise, 014's
sync claim, 010's "estimate, verify it", 018's "offline" that was really a sign-out. Every one of those
was a sentence that claimed slightly more than the code could back.

**Boasting is the same defect in a friendlier register.** "Konečně" is not a claim about this app at
all; it is a claim about every other way a person has handled their state mail, and the app is in no
position to make it. The same goes for the quieter ones the audit turned up — "we would rather not do
it behind your back" implies somebody does, and "so they can never be mistaken" promises something no
label can guarantee.

None of this is about being modest for its own sake. A user who is handing an app their legal mail is
weighing whether to trust it, and copy that oversells is the first evidence that they should not.

## Requirements *(mandatory)*

- **FR-001**: No user-facing string may claim superiority over any other product, named or implied.
  This covers the sly forms: *konečně / finally*, *unlike*, *at last*, *the way it should be*.
- **FR-002**: No user-facing string may claim a virtue for the app where a plain statement of what it
  does would carry the same information. "We would rather not do X behind your back" becomes "it
  happens when you tap".
- **FR-003**: No user-facing string may promise an outcome the app cannot guarantee. A label that
  marks test messages helps someone notice; it cannot make confusion impossible.
- **FR-004**: Both locales must change together. cs and en are one voice, not a translation and its
  source, and a tone fix in one is a tone bug in the other.
- **FR-005**: A test MUST fail if a boastful construction reappears in any locale, in `strings.ts`,
  `loginMessages.ts` or `faq.ts`. Tone is exactly the kind of thing that drifts back in one PR at a
  time, and review does not catch it reliably.

## What the audit covered

Every user-facing string in the app: `src/i18n/strings.ts` (cs + en), `src/i18n/loginMessages.ts`
(cs + en), `src/i18n/serverMessages.ts` (a key map, no prose), `src/content/faq.ts` (cs + en). Every
Czech literal elsewhere in `src/` was checked and all of it is comments or generated licence data —
no screen carries hardcoded copy.

### Findings (4 strings, 8 including both locales)

1. **`welcome.tagline`** — the reported one. *"konečně / finally"*. FR-001.
2. **FAQ `loginMethods`** — *"Raději je neuvádíme vůbec, než abychom nabídli tlačítko, které
   nefunguje."* / *"We would rather leave them out than show a button that doesn't work."* A virtue
   claim, and a jab at whoever ships the broken button. FR-002.
3. **FAQ `attachments`** — *"a to nechceme dělat za vašimi zády"* / *"we would rather not do it behind
   your back"*. Implies that others do. FR-002.
4. **FAQ `testEnv`** — *"aby nemohlo dojít k záměně"* / *"so they can never be mistaken"*. FR-003.

Everything else read clean: the error strings state what failed and what to do, the delivery and
scan copy was already written under Principle VI, and the FAQ's legal answers cite the Provozní řád
rather than asserting.

## Non-goals

- Store copy (`docs/aso.md`) is not in the application. Its short description opens "Moderní aplikace
  pro datové schránky" — a mild marketing claim, flagged to the user rather than changed here.
- Rewriting copy that is merely long. This is about claims, not length.

---

## Second pass, 2026-09-09: copy that describes a STATE (user-reported)

The first pass asked whether a sentence boasts. This one asks whether it is *true right now*.
Reported against the backup switch: turning "Zálohovat automaticky" off in Pokročilé left the top of
the same screen saying "po každé aktualizaci schránky se archiv sám zazálohuje".

**FR-019 (a description must survive the state it describes):** copy that asserts what the app is
doing, or what state something is in, MUST be selected by that state. One sentence covering two
states is a sentence that is wrong in one of them. Where a render site cannot know the state (a row
that merely links to the screen that owns it), the copy MUST NOT make the claim at all.

### Method

Two auditors on different models (Opus, Sonnet) audited every claim-making string against its render
sites independently, then cross-examined each other's findings. That second round earned its cost:

- It **reversed** one auditor, which had filed the backup screen's `enabled` axis under "judgement
  call" and, when shown that the sentence points at a button the screen does not render while
  disabled, agreed it was the worst finding of the set — reachable on a fresh install with no taps.
- It **rejected** one finding outright. `box.removeMessage`'s "Zprávy v datové schránce zůstanou
  nedotčené" scopes its reassurance to the ISDS mailbox and is literally true; it was reworded as an
  incomplete destructive-action warning, not counted as a false sentence.
- Where both models agreed independently, the second round still demanded the decisive file:line —
  agreement between two models is not evidence.

### What was false, and now is not

| Was | Reachable by |
|---|---|
| Backup switch promised automatic backups with the switch OFF, and pointed at an absent button | Opening the screen on a fresh install |
| Attachment scan described itself as running while off — and promised to FIND deadlines it only looks for | Opening Settings |
| FAQ said downloaded attachments live "v šifrovaném archivu"; they are plain files under the phone's own protection | Opening the FAQ |
| "Platnost přihlášení vypršela" on password boxes, which have no session — the ISDS password had expired | The 90-day password cycle the app itself nags about |
| "Doručení nastalo přihlášením" on SENT messages and on ones served by fiction | Opening any sent message before it is picked up |
| Green "Celá zpráva uložena" over an amber "some attachments are missing" | Restoring a backup |
| Two notifications promised for dates that get one or none | Setting a deadline for today after 09:00 |
| "100 výsledků" — the cap stated as a total | Searching a common word in a large archive |

Each is pinned by a test. Three of them are pure-function extractions (`downloadNoteKey`,
`savedBadgeKey`, `reminderPromise`) precisely so the rule is testable without mounting a screen —
and `reminderPromise` reads the same function the scheduler does, so the promise cannot drift from
what is actually scheduled.

### Note on a near-miss

`reauthKey` first derived its second key by concatenation and produced `box.reauth.session.credentials`,
which does not exist — the app has already shipped a button reading "COMMON.CANCEL" for exactly that
reason, and `__tests__/i18n/keysExist.test.ts` cannot see a key picked at runtime. Both keys are now
written out at each call site.
