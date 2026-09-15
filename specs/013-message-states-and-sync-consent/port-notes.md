# 013 — what the design decided, and what the port had to resolve

Companion to `design-prompts.md`. Records the answers to the six delegated questions, and the places
where the port could not follow the design literally — so a future reader can tell a deliberate
divergence from a mistake.

## What the design chose

**Ten states → five treatments** (`SENT_KIND` + `stateVisual` in the design; `messageState.ts` here):

| Treatment | States | Chip | Glyph |
|---|---|---|---|
| `sent` | 1, 2 | sunken `#F2EADB` / `#6B6253` | paper plane |
| `delivered` | 4 | `#E4ECF7` / `#2A5C9A` | heavy check |
| `accepted` | 6, 7 (+ 9, 10 with a footnote) | `#E2F0E8` / `#1B6E52` | solid disc + check |
| `fiction` | 5 | `#FBEFD0` / `#8C6100` | the same solid disc, **gold** |
| `stop` | 3, 8 | **inverted** — ink on paper swapped | solid disc + diagonal |

Three things worth keeping in mind about that table:

- **5 and 6 share a glyph and differ only in colour.** At 16px a second solid figure is mush; the
  distinction is carried by gold-vs-green and by the label.
- **`stop` is the only inverted treatment in the app.** That is what makes a terminal failure
  unmistakable without borrowing the fikce red, which means "hurry" rather than "broken".
- **9 and 10 are annotations, not states.** They sit as a footnote on a finished journey (a slashed
  cloud for "content erased at the state", a safe for "kept in the Datový trezor").

**A timeline that can stop.** State 3 ends it after step 1, state 8 after step 2, and the remaining
steps are *dropped* rather than greyed out — a greyed step reads as "still coming" when nothing is
coming. A `stopWhy` paragraph below the rail says what to do instead.

**A chip on a sent row only when the news is surprising** (`showsListChip`): fiction or stop. Ordinary
progress stays carried by the glyph, so the common row keeps its two-line height.

**Two sync settings, deliberately asymmetric.** Delivery receipts are a plain toggle; new-messages-in-
the-background is a navigating row showing its current value, behind a consent screen. Two toggles side
by side would have implied the choices were comparable.

**Consent as four numbered facts,** not a paragraph, with an equal-weight "Nechat vypnuté" button and a
"why there is no other way" counterweight.

**Three notification channels** (new messages / delivery receipts / alerts), each previewable in both
locked and unlocked form.

**§6 — the fikce countdown moved sides.** The design agreed the received-side countdown cannot fire and
replaced it with a notice about a message *already* served by fiction; the countdown itself now lives
on sent messages, where it is genuinely still running.

## Where the port diverged, and why

**1. Fields ISDS does not give us.** The design's mock data carries `stampedAt`, `failedAt` and
`erasedAt`. `MessageEnvelope` has only `deliveryTime`, `acceptanceTime` and `state` — there is no
timestamp for the stamping, the failure, or the erasure. Rather than fabricate one (the timeline's
standing rule since 009: *no time is fabricated*), the stop step shows an em-dash and the annotations
show no date. Everything else the design draws is real data.

**2. Locked-screen notifications.** The design shows a different, redacted form when locked. The port
puts the generic wording in the **title** and the counterparty + subject in the **body**, which is what
makes a redacted form possible at all. ~~Android's `PRIVATE` visibility conceals the body.~~ That
justification was wrong on both platforms and was corrected on 2026-08-14 — see the follow-up section
at the end of this file.

**3. The old `syncInterval` setting is not migrated into `syncReceived`.** A user who had hourly sync
on never consented in the informed sense the new screen asks for — it was the default. Carrying that
forward would have upgraded them into an ongoing legal act without ever showing them the four facts.
Everyone lands on received-sync **off**; the chosen cadence is carried over, since that part was a
genuine preference.

**4. `messageStateKind` rejects out-of-range values.** `dmMessageStatus` is documented as 1–10; a value
outside that means a garbled envelope, and the safe reading is "in transit", never "delivered".
Claiming a legally significant outcome from a value we do not recognise is the same class of bug as the
state-8 one this feature exists to fix.

**5. Copy NOT taken from the design.** The design's `downloadFullNote` still reads *"Tím se zpráva
považuje za doručenou"* / *"This counts as delivery."* That claim is false and was corrected in 012
(§17/3 — the list serves the message, the download has no legal effect). The shipped, corrected wording
was kept and the design's reverted string ignored. The same applies to the design's FAQ answer i1,
which says a message is served by signing in *and opening it*; opening is not required.

**6. The design's own em-dash purge was not ported wholesale.** The updated `.dc.html` replaced many
`—` with `·`, `,` or `.` across unrelated strings. Only the strings this feature touches were changed;
sweeping the rest is a separate, reviewable change rather than a side effect of a state-model port.

## Verification (resolved 2026-08-14)

The **26 June 2026 Provozní řád** is now in the repo — `docs/isds-provozni-rad-2026-06-26.md`. It
settles one of the two open questions, confirms the model behind the whole feature, and raises a new
problem.

### ✅ Confirmed: only `GetListOfReceivedMessages` serves mail

> *"Přihlášení do datové schránky majitele a doručování zpráv ve smyslu § 17 odst. 3 Zákona způsobuje
> **výhradně** stažení seznamu došlých zpráv – GetListOfReceivedMessages."* — §II, "Napojení aplikací
> třetích stran"

Verbatim confirmation of the premise the whole 013 split rests on. The guard rail in `backgroundSync`
wraps exactly the right call, and no other operation we make needs consent. The same section adds that
`db_access.wsdl` calls (`GetOwnerInfoFromLogin`, `GetPasswordInfo`, `ChangeISDSPassword`) do **not**
cause delivery either.

Retention is confirmed word-for-word as the consent screen states it: 90 days from delivery-by-login,
**at least 3 years** for a message never delivered by login.

### ⚠️ Confirmed, and it is a problem: automatic sign-in is not allowed for apps like ours

> *"Aplikace instalované na lokální stanici (jednotlivý počítač) se **musí** do datové schránky
> přihlašovat pomocí **manuálního příkazu uživatele** (např. stisknutím tlačítka pro výběr a odesílání
> zpráv). Serverové aplikace … se mohou do datové schránky přihlašovat automatizovaně…"* — §17
> "Dodržování přiměřenosti"

A phone app is a locally-installed application, not a server application. Every background sync
authenticates, so **this constrains the sent side too** — the §17(3) narrowing above governs *delivery*,
not *signing in*, so "legally inert" does not make the sent-side poll compliant with the operating
rules. Item 1 of the old list is therefore answered **yes**, and the shipped default (sent-side
background sync ON) is contrary to the Provozní řád.

Enforcement is graduated rather than punitive, which bounds the risk: a monitored account that keeps
exceeding internal limits first gets a system message, then a 3-second delay per request past a daily
threshold, then rejection of concurrent requests. *"Cílem omezujícího režimu není zablokování práce,
ale zpomalení na 'normální' úroveň."* Client-portal access is never affected.

**RESOLVED — background sync was removed entirely (features 014 + 014b, 2026-08-14).** The options put
to the user were: make both sides foreground-only (sync on open + pull-to-refresh, which is what
"manual user command" describes); keep background sync as an informed opt-out; or seek the
server-application reading, which we do not qualify for. The user chose full removal, in two steps —
014 took out the received side and 013's consent screen, 014b took out the sent side and with it the
scheduler, the headless task, the notifier and the entire notification surface, since nothing was left
that could fire one. Both native dependencies were uninstalled, and the APK no longer declared
POST_NOTIFICATIONS or RECEIVE_BOOT_COMPLETED. (WAKE_LOCK comes from react-native-blob-util and was never
background sync's to remove; see the correction in 014's spec.md. Both notification permissions
returned with 010's reminders on 2026-08-17.)

What settled it was not the compliance risk, which is small and graduated, but that the FAQ entry
shipped alongside quotes the rule as the reason we do not check for incoming mail — polling the outbox
on a timer anyway would have made the app's own help text a half-truth. The full reasoning now lives
where users can read it: `faq.ts` → `noBackgroundFetch`, in both languages. Constitution 2.0.0 records
the constraint under Technical Constraints.

### ✅ Resolved 2026-08-16: the fikce deadline arithmetic

The Provozní řád does not cover it — no day-counting rule, no working-day rule, nothing on the
23:59:59.999 stamp. It is a matter of §17(4) of the Act and possibly the technical annexes, not the
operating rules — it is a matter of the Act, not the operator's rules. **Resolved 2026-08-16** by
reading §17 odst. 4 of Act 300/2008 directly: 10 days "ode dne" the document was delivered, service on
"posledním dnem této lhůty". `sentFictionCountdown` now counts CALENDAR DAYS in Czech civil time. The
flat arithmetic was not merely imprecise, it was off by one for most of the final day — it showed
"fikce za 1 den" on the morning of the day the fiction actually landed, which is exactly what the
26.07. device screenshot in this file recorded without anyone noticing.

## On-device pass (2026-07-26, emulator + a live czebox box)

Walked in both themes and both languages. **Three defects found and fixed**, all of them invisible to
tsc, eslint and the unit tests:

1. **The locked notification preview drew a literal em-dash.** A `color: 'transparent'` placeholder was
   meant to reserve the body's height; it rendered as visible punctuation AND a screen reader read it
   aloud. Replaced with a fixed 19dp slot that is genuinely empty when locked. Re-measured: the three
   preview cards keep byte-identical bounds across the locked/unlocked toggle (1139/1189, 1370/1470,
   1652/1702 in both) — no layout jump.
2. **At 1.5× font scale the decline button ellipsized to "Nechat vypn…".** That is precisely the button
   the design says must never look like the lesser option. Above ~1.3× the pair now stacks full-width,
   declining still first; measured 422dp wide, untruncated.
3. **Every `Toggle` was unlabelled in the accessibility tree.** The switch is a SIBLING of its row
   title, so nothing associated them: uiautomator showed three bare `Switch` nodes in a row on the
   notifications screen. `label` is now a required prop. Verified: `Nové zprávy — Vyžaduje
   synchronizaci na pozadí` (enabled=false), `Doručenky`, `Upozornění`. This also fixes the
   pre-existing app-lock toggle.

Confirmed working against real ISDS data:

- **The sent-side countdown fires on a real message.** A czebox message delivered 16.07. 19:34 showed
  `Adresát dosud nepřevzal · fikce za 1 den` on 26.07. — the first time the fiction clock has ever been
  visible in the app, since it could not appear on the received side.
- **The migration behaves.** An install that had `syncInterval: hourly` came up with
  `Nové zprávy na pozadí: Vypnuto` and the cadence preserved as `Přibližně každou hodinu` — preference
  carried, consent not.
- The five-glyph legend renders distinctly in dark mode, including the inverted `stop` disc.
- The 012-corrected `downloadFullNote` is intact on device ("It does not affect legal delivery").

## Not yet done

- **A real state-3/5/8 message.** czebox can produce state 5 (wait ten days without signing in) but 3
  and 8 are hard to provoke deliberately, so those two treatments are unit-tested, not observed. The
  FAQ legend is the only place their glyphs have been seen rendered.
- ~~**The design's "Poslední kontrola · dnes 8:12" line** on the sync-on card is not implemented — the app
  stores `lastSyncedAt` per box, not a single last-background-run timestamp, and inventing one from the
  newest box would misreport a multi-box install. Left out rather than approximated.~~
  *Moot: 014 removed the sync card this line belonged to.*
- **iOS.** Everything above is Android; the IPA build is for sideloading, not verified. *(Later: the
  user confirmed an iOS device test on 2026-08-16, per 014's plan.)*

## Follow-up (2026-08-14): the lock-screen claim, and two switches that did nothing

> **Historical.** 014b deleted everything this section describes the same day. Only the iOS `redacted`
> category and the lock-screen lesson came back, with 010's reminders (see the header comment of
> `notifeeNotifier.ts`).

Two defects found by re-reading the shipped code against the shipped copy. Both are the same shape —
the UI stated something the code did not do.

### The lock-screen promise was false

Shipped copy: *"Na zamčené obrazovce neuvádíme jméno protistrany ani předmět."* An unconditional
promise. What the platforms actually do:

| | what the app controls | what the user's phone decides |
|---|---|---|
| **Android** | `visibility` — a *declaration* that content is sensitive, and `PRIVATE` is already the platform default | whether a secure lock screen redacts it at all. The common default shows it in full. When it does redact, it replaces the **whole** notification with "Contents hidden" — our generic title included, because supplying the middle form needs `publicVersion`, which notifee does not expose |
| **iOS** | the *shape* of the hidden form, via a notification category | the "Show Previews" setting. There is no per-notification suppression whatsoever |

So the claim was untrue on iOS (nothing was implemented there at all — no `ios` block existed) and
overstated on Android (`PRIVATE` was a no-op relative to the default, and redacts everything or
nothing, never the design's middle form).

Fixed three ways:

1. **iOS now has the mechanism it was missing.** A `redacted` category with `hiddenPreviewsShowTitle`
   + `hiddenPreviewsBodyPlaceholder`, attached to every notification. When previews are hidden this
   produces *exactly* the design's locked card — generic title kept, identifying body swapped for
   "Podrobnosti se zobrazí po odemčení". Without a category iOS hides the title too and prints its own
   placeholder, so the design's locked form was previously unreachable on the platform.
2. **The copy now scopes the promise** to what is actually ours: *"Jméno protistrany a předmět
   označujeme jako citlivý obsah. Jestli je zamčená obrazovka skryje, rozhoduje nastavení vašeho
   telefonu."* This edits a design string, which the standing rule forbids — the exception is
   deliberate: the design made a factual claim about platform behaviour that no implementation can
   satisfy, and Constitution VI outranks design fidelity. The alternative (drop the detail from the
   body on every platform so the original sentence becomes true) would have made the design's
   *unlocked* card the lie instead, and cost the notification its usefulness.
3. **The comments asserting the false mechanism** are replaced with a table of what each platform
   really does, at the top of `notifeeNotifier.ts`.

The design's locked/unlocked preview cards are unchanged and stay accurate: on iOS that is now
literally what the category produces; on Android the OS hides strictly more.

### The three notification switches were inert

`notifChannels` was written by the settings screen, persisted, re-read on launch — and **never read by
anything that sends a notification**. `runBackgroundSync` called the notifier unconditionally. A user
who switched "Doručenky odeslaných zpráv" off kept receiving them.

`BackgroundSyncDeps.channels` is now required (not defaulted — a caller that forgets it should fail to
compile rather than quietly resume notifying) and gates each notify call. Two details worth keeping:

- The gate sits at the **notification**, never at the fetch. Muting a notification must not stop the
  sync that keeps the message list current — unlike the `received` switch, where the guard rail is the
  opposite way round and deliberately wraps the delivering call itself.
- A `stop` receipt rides the **alerts** switch, not the receipts one: muting "delivered" must not also
  mute "it will never arrive". `receiptChannel()` in `notifications.ts` owns that split so the sync's
  gate and the notifier's channel choice cannot drift apart.

`NotifChannels` is now an alias of `ChannelSwitches`, defined at the notification boundary, so the
settings screen and the code that honours the switches share one type.

### On-device pass (2026-08-14, emulator, Android 16)

Confirmed:

- **The reworded note renders in all four combinations** — cs/en × light/dark — wrapping to three
  lines, no truncation. At **1.5× font scale** it wraps to four and still fits with room to spare.
- **No layout jump across the Zamčeno/Odemčeno toggle.** All six card text nodes keep byte-identical
  bounds (`[211,1096]`, `[211,1140]`, `[211,1327]`, `[211,1371]`, `[211,1559]`, `[211,1603]`); only
  the three body lines appear, in the reserved 19dp slot. The 013 fix survives the copy change.
- **The channel switches round-trip.** Turning "Doručenky" off and force-stopping the app brought it
  back off, with alerts still on — so the compact `n,r,a` triple still parses after the
  `NotifChannels` → `ChannelSwitches` change, and it is the same string `backgroundFetch` reads
  headlessly.
- **Toggle accessibility labels intact** after extracting the type: `Nové zprávy — Vyžaduje
  synchronizaci na pozadí` (enabled=false), `Doručenky`, `Upozornění`.

### Verification owed

> **Moot.** The receipts, the three channels and `BackgroundSyncDeps` no longer exist.
> `notifications.ts`, `notifeeNotifier.ts` and `__tests__/services/notifeeNotifier.test.ts` now belong
> to 010's reminders: one `reminders` channel, the `redacted` category re-used, and a test asserting
> that single channel and the deletion of the retired ones. The IPA has since been run (the user
> confirmed an iOS device test on 2026-08-16, per 014's plan), but that test predates 010 bringing the
> `redacted` category back, and no record shows the category checked on an iPhone since; that check
> now belongs to 010's reminders. Nothing else below is owed.

1. **The iOS category is unverified on device** — no iOS hardware was available at the time, and the IPA has never
   been run. On a real iPhone with Settings → Notifications → Obálka → Show Previews = "When
   Unlocked": a receipt on the lock screen should show the generic title and our placeholder body,
   not Apple's own "Notification".
2. **Android channel creation was not exercised on device.** The emulator has never displayed a
   notification from this app (`dumpsys notification_manager` lists no channels for the package), and
   nothing in the UI triggers one on demand — a receipt needs a sent message to change state between
   two syncs. The refactor that moved the three `createChannel` calls behind a `Platform.OS` check is
   covered by `__tests__/services/notifeeNotifier.test.ts`, which asserts the ids and their order on
   Android and that no iOS category is registered there; the calls themselves are unchanged.
