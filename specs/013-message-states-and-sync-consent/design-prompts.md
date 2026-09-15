# Claude Design prompts — full message-state model + split background sync (013)

Two changes, one design round, driven by a research pass on the ISDS Provozní řád + the operator's
developer bulletins (source: a private research transcript that is not in the repository,
cross-checked against `docs/isds-ws-news/` and later against `docs/isds-provozni-rad-2026-06-26.md`):

1. **The app models 3 delivery states; ISDS has 10.** Two of the missing ones are *failures* the app
   currently reports as success or as permanent limbo.
2. **Background sync is one setting doing two very different things.** Syncing the **sent** folder is
   inert. Syncing the **received** folder is a legally significant act that serves the user's mail.
   They have to become two settings, and the second one needs informed consent.

Per the 009/012 workflow and the user's standing instruction, these screens are **designed by Claude
Design, not invented in code** — paste the prompts below into the existing project
(`Obalka Redesign.dc.html`, project `2c15c7b1-3690-44ff-b610-4ea7620bdb6a`), then diff and port what
comes back.

**Status:** ✅ **sent, designed and ported (2026-07-26).** The design returned §1–§5 and answered §6 as
well; the updated `.dc.html` was pulled, diffed (+17 023 chars, 24 hunks) and implemented. What the
design decided, and what the port had to resolve on its own, is recorded in `port-notes.md`. This
hand-off was deliberately front-run so the design work could overlap the spec work, the way 012 Phase D
did; spec.md, plan.md and tasks.md were written retrospectively on 2026-08-16.

> **Caveat on the pull:** `Obalka Redesign.dc.html` is now 260 189 characters and DesignSync's
> `get_file` caps at 256 KiB, so the fetched copy is truncated mid-`render()`. Everything load-bearing
> survived — all markup, both `STR` tables, and the `SENT_KIND` / `stateVisual` / `decorateSent` /
> `decorate` logic. What was lost is the demo harness that binds placeholder data, which the port does
> not use. Future pulls will lose more; the file needs splitting, or a range-capable read.

**How to use:** paste **§0** once, then **§1–§2 together** (the state vocabulary and the timeline are one
problem — the timeline is where the vocabulary is stress-tested). **§3–§5** are the sync/consent area and
form the second coherent block. **§6** is a small separable follow-up.

---

## §0 — Shared context (paste first)

> You are extending an existing mobile app design, **`Obalka Redesign.dc.html`**, in this project.
> "Obálka" is a Czech **Datová schránka** (government data-box) mail client. Keep the **exact** visual
> language already in that file — do not restyle it. Reuse its tokens and components:
>
> - **Palette (light/dark):** bg `#F4EEE2`/`#1A1712`, surface `s` `#FBF6EA`/`#221E18`, card `#FFFDF8`/
>   `#2A251E`, sunken `#F2EADB`/`#322C24`, border `bd` `#ECE3D2`/`#3A332A`, strong `bds` `#DCD2BF`/
>   `#4A4236`, text `#211B12`/`#F2ECE0`, mut `#6B6253`/`#A89D8B`, faint `fnt` `#9A9180`/`#8A8070`.
>   Accents: brand blue `#2A5C9A`, gold `#E8A100`/`#F5B81E`, red `#BE3A34` (surface `#F7E4E1`), green
>   `#1B6E52` (surface `#E2F0E8`), amber surface `#FBEFD0`, link `#B07F00`.
> - **Existing status chips** you must stay consistent with (these are already in the file and shipping):
>   `Odesláno` — neutral sunken `#F2EADB` on `#6B6253`; `Dodáno` — blue `#E4ECF7` on `#2A5C9A`;
>   `Doručeno` — green `#E2F0E8` on `#1B6E52`. Their glyphs at 16px: a paper plane (Odesláno), a heavy
>   check (Dodáno), and a **solid** green disc with a knocked-out check (Doručeno — solid because it is
>   the terminal, legally load-bearing state).
> - **Type:** Bricolage Grotesque (`.bg`) for display/headings; Public Sans for body/UI. Prose sets an
>   explicit `line-height` (14→20, 13→18, 12→16); dense list rows leave the font's metric leading.
> - **Components:** 54px screen header (back chevron + `.bg` title); cards radius 16, inputs/buttons/rows
>   14, chips 8–9, sheets 24-top, dialogs 20; dark high-contrast primary buttons; the settings-card row
>   pattern on `Nastavení`; the existing bottom-sheet pattern used by the notification-permission sheet.
> - **Hard constraints:** Czech-first copy (provide cs + en), full **dark mode**, **WCAG AA** contrast,
>   **no layout jumps** for transient/async elements, honor Reduce-Motion.
>
> Deliver each new screen/state as `sc-if` blocks consistent with the file, with placeholder data wired
> like the existing screens. Czech labels primary.
>
> **Domain primer — read this before designing, it drives everything below.** A data box is legal
> post. A message moves through numbered states, and two of them are *not* progress:
>
> | # | Czech | What it means |
> |---|---|---|
> | 1 | Podána | Submitted. Exists for a fraction of a second. |
> | 2 | Orazítkována | Message + attachments signed with a submission timestamp. |
> | 3 | **Neprošla antivirovou kontrolou** | Failed the AV check. **Never delivered. Terminal failure.** |
> | 4 | Dodána | Landed in the recipient's box. Not yet legally served. |
> | 5 | **Doručena fikcí** | 10 days passed and nobody with read rights signed in. Served **by law, without anyone reading it**. |
> | 6 | **Doručena přihlášením** | Someone entitled to read it signed in to the box. Served. |
> | 7 | Přečtena | Opened/downloaded. **No legal significance whatsoever** — bookkeeping only. |
> | 8 | **Nedoručitelná** | The recipient's box was made inaccessible retroactively. **Terminal failure.** |
> | 9 | Obsah smazán | 90 days elapsed; ISDS erased the content, the envelope remains. |
> | 10 | V Datovém trezoru | Moved into the user's paid long-term vault. |
>
> States 5 and 6 are both legally "Doručeno" but they are **not the same event** and the difference
> matters to a human: 6 means a person saw it, 5 means the deadline ran out on someone. The app
> currently collapses 1–3 into "Odesláno" and 5–10 into "Doručeno", which means it reports state 8 —
> *undeliverable* — as **delivered**, and leaves state 3 sitting on "Odesláno" forever.

---

## §1 — A visual vocabulary for all ten states

> The app has three status chips and three glyphs. It needs to express ten states, on both sides of a
> message, without turning every list row into a rainbow.
>
> **Which states are visible from which side is asymmetric — design to this, it is not a detail:**
>
> - **In my Sent folder** I can see: 1, 2 (briefly after sending), **3** (AV failure), 4, 5, 6, **8**
>   (undeliverable), 9, 10. I **never** see 7 — since 2019 ISDS deliberately stops reporting "the
>   recipient opened it" to the sender. So for a sender, **6 is terminal**; there is no read receipt,
>   and the design must not imply one is coming.
> - **In my Received folder** I can see: 4 (rare), 5, 6, 7, 9, 10. I never see 1, 2, 3 or 8 — those all
>   happen before or instead of the message reaching me.
>
> Please design:
>
> **A. The chip set.** Extend the three existing chips to cover all ten states. Group them however
> reads best — you might find that ten labels want fewer than ten treatments, e.g. a shared "in
> transit" look for 1/2/4, a shared "failed" look for 3/8, and a muted archival look for 9/10. Whatever
> you choose, the two failure states must be **impossible to mistake for progress**, and they must not
> borrow the red already used for the fikce-deadline countdown (that red means "hurry", not "broken").
>
> **B. The glyph set.** Same question for the 16px marks used on list rows. The current three are a
> paper plane, a heavy check, and a solid check-in-disc. Decide what 3, 8, 9 and 10 get, and whether 5
> and 6 share the solid check or are distinguished at glyph size. Note the constraint that discovered
> the current set: these are drawn from **Lucide**, and the icon library spreads `fill` onto every child
> node, so a "filled outline icon" has to be composed by hand. Prefer marks that survive that.
>
> **C. `Doručeno fikcí` vs `Doručeno přihlášením`.** These need to be tellable apart. Decide where the
> distinction is worth carrying: chip label, glyph, only in the detail, only on the sent side. Consider
> that for a **sender**, "doručeno fikcí" carries real information — the recipient never logged in, and
> a delivery served by fiction is the kind that gets challenged in court. For a **recipient** looking at
> their own inbox, seeing "doručeno fikcí" on a message means a deadline already ran while they weren't
> looking, which is closer to an alarm than a status.
>
> **D. Czech + English labels for all ten**, in the app's voice — plain, non-bureaucratic, no legalese
> the user has to decode. The existing three are `Odesláno` / `Dodáno` / `Doručeno`.

---

## §2 — The sent-message timeline, with failure branches

> The message detail for a **sent** message currently draws a three-step vertical timeline —
> `Odesláno → Dodáno → Doručeno` — on an 18px rail with a dotted connector, each step showing its glyph
> and its timestamp, completed steps in the state colour and future steps in the muted border colour.
>
> That shape assumes the journey always moves forward. It doesn't. Redesign it to handle:
>
> - **A terminal failure part-way through.** State 3 (AV check failed) ends the journey at the start;
>   state 8 (undeliverable) ends it after `Dodáno`. The remaining steps must not sit there greyed out
>   looking *pending* — that reads as "still coming" when nothing is coming. Decide how a timeline
>   **stops**: a strike-through tail, a truncated rail, a replaced final step, something else.
> - **A named delivery step.** Step 3 is either `Doručeno přihlášením` or `Doručeno fikcí`. Same slot,
>   different meaning. Design both.
> - **An optional archival tail.** After delivery, a message can reach state 9 (ISDS erased the content
>   after 90 days — the app keeps its own copy) or 10 (moved to the user's Datový trezor). Decide
>   whether these are a fourth step, a footnote under the timeline, or not on the timeline at all.
> - **The pre-delivery head.** States 1 and 2 are real but last seconds. Decide whether they earn a step
>   or whether `Odesláno` absorbs them (the app has no time to render them in practice, but a message
>   sent while offline and reconciled later can genuinely show up in state 2).
>
> Please show the timeline in at least these variants: happy path to `Doručeno přihlášením`; happy path
> to `Doručeno fikcí`; AV failure at step 1; undeliverable after `Dodáno`; and delivered-then-erased.
>
> One thing **not** to design: a "read" step. There is no read receipt for a sender.

---

## §3 — Splitting background sync in two

> **The problem, stated plainly, because the whole design follows from it.**
>
> Fetching the list of *received* messages is not a read operation. Under §17(3) of the Czech Act
> 300/2008, downloading that list **is** "signing in to the data box", and it legally **serves** every
> message waiting there. Deadlines start. Appeal periods start. And ISDS's own retention drops: it keeps
> an undelivered message for **at least 3 years**, but only **90 days** once it has been served. Opening
> a specific message and downloading its attachments, by contrast, have **no legal effect at all**.
>
> Fetching the list of *sent* messages does none of this. It is the user's own outbox; nothing is being
> served to anybody.
>
> Today the app has **one** setting — `Synchronizace na pozadí` with options
> `Vypnuto / Přibližně každou hodinu / Přibližně každých 6 hodin / Jednou denně`, **defaulting to
> hourly** — and it drives a background task that fetches the *received* list for every box, on a timer,
> with the app closed. So by default, the app serves the user's government mail every hour while the
> phone sits in a pocket.
>
> That has to become two independent settings:
>
> - **Doručenky odeslaných zpráv** (sent-side sync) — inert, safe, can default **on**. This is what
>   powers the new notification in §5.
> - **Nové zprávy na pozadí** (received-side sync) — the one with consequences. Must default **off** and
>   must not be reachable by a single unexplained tap.
>
> Please redesign the `Nastavení → Synchronizace na pozadí` section for this. Open questions for you:
>
> - Do these read as two rows in one section, two sections, or one row plus a nested screen? They are
>   not siblings of equal weight — one is a preference, the other is a decision.
> - The cadence choice (`hourly / 6 h / daily`) currently applies to the single setting. Does each side
>   get its own cadence, do they share one, or does the safe one not need to expose cadence at all?
> - How does an **off** received-sync explain what the user gives up, without nagging? The honest answer
>   is "the app can't tell you about new mail without serving it — but ISDS itself will, by e-mail, SMS
>   and via the Mobilní klíč app", and that is worth saying somewhere.
>
> **Do not** design this as a scary red warning surface. It is not a danger; it is a real choice with a
> real trade-off, and the app's whole tone is calm and matter-of-fact.

---

## §4 — The consent moment for received-side sync

> Turning on received-side background sync needs **informed consent**, not a toggle. The user has to
> understand, before it is on, that:
>
> - the app will sign in to their box on a schedule, without them touching the phone;
> - **every such sign-in legally serves every message waiting in the box** — the same as if they had
>   opened it themselves;
> - deadlines therefore start running from that moment, even if they never open the app;
> - and ISDS will keep those messages 90 days instead of 3 years.
>
> And the counterweight, stated just as plainly: **this is the only way the app can notify them about
> new mail at all**, because there is no way to learn that mail arrived without performing the act that
> serves it. (The government does expose a notification API that avoids this, but it is restricted to
> organisations holding a certificate and a permit — not available to an app like this one. That
> constraint is worth one honest sentence somewhere, not a paragraph.)
>
> Design the moment. **You decide** the shape — a pushed full screen, a bottom sheet in the existing
> pattern, a two-step toggle-then-confirm — but it must satisfy:
>
> - **Off is the default and must be a real, respected answer**, not a dead end the user is nudged out
>   of. No dark patterns: the "no thanks" path is as prominent and as unembarrassed as the "turn on"
>   path.
> - The consequence must be readable in **one pass**, not buried in a paragraph the user scrolls past.
>   These are four facts; find a form that makes four facts land.
> - It must be **re-openable later** from Settings, and turning the feature **off** again must be one
>   step with no second interrogation.
> - Czech-first, and the Czech must sound like a person explaining something, not like a statute. Avoid
>   `doručování ve smyslu § 17 odst. 3` as body copy — cite it as a discreet source line if at all.
>
> Also design its relationship to the **existing notification-permission sheet** (the one with the blue
> bell and the gold dot, which explains what notifications the app sends before triggering the OS
> prompt). There are now two consent-ish moments in the same area and they must not stack into a wall of
> dialogs on first run. Decide whether they merge, sequence, or stay far apart — and say why.

---

## §5 — A new notification: your sent message was delivered

> Sent-side sync makes a genuinely useful, entirely consequence-free notification possible: **the
> message you sent has been delivered.** Design it.
>
> The app currently sends two kinds of local notification, on two channels: `Nové zprávy` (new mail,
> "3 nové zprávy") and `Upozornění` (a box needs re-authentication). Both are already designed in the
> file, including the locked-screen redacted variant.
>
> The new one has variants worth distinguishing:
>
> - **Doručeno přihlášením** — the recipient signed in. The good outcome.
> - **Doručeno fikcí** — 10 days passed and nobody signed in; the law delivered it for them. Materially
>   different news, and the more consequential of the two.
> - **Nedoručitelná / neprošla kontrolou** (states 8 and 3) — the message will never arrive. This is a
>   failure notification and belongs on the alerts channel, not the messages channel.
>
> Decide: is this one notification type with variants, or two/three types? Does it get its own channel so
> a user can mute delivery receipts without muting new mail? What does a tap open — the sent message's
> detail, presumably, but confirm. And what does it show on a **locked screen**, given that a recipient's
> name is itself sensitive?
>
> Design the corresponding entries in the notification-permission explanation from §4, since the list of
> "what we will send you" grows.

---

## §6 — Where does the fikce countdown now belong? (smaller, separable)

> The received list currently has a `Vyžaduje pozornost` group at the top, with a red/amber chip counting
> down the days until delivery fiction (`Doručení fikcí za 3 dny`).
>
> There is a problem with it that only became visible with the research above: **that chip can almost
> never appear.** It is shown for messages in state 4 — delivered to the box but not yet served — and
> the app cannot see a state-4 message, because the act of listing the inbox is what moves it to state 6.
> By the time a message is on screen it has already been served, and its countdown is over.
>
> Meanwhile the countdown's logic is genuinely useful on the **other** side. As a sender, a message
> sitting in state 4 *is* counting down toward fiction, and that is real, visible information: "the
> recipient hasn't signed for this yet; in 4 days the law will sign for them."
>
> Please look at the `Vyžaduje pozornost` grouping and the countdown chip with that in mind, and decide
> what they should become. Options include moving the countdown to the sent side, keeping it on the
> received side for the narrow cases where it does occur (a message already served by fiction before the
> user ever opened the app — the countdown is over, but "this was served by fiction on 14 May, without
> you" is arguably *more* worth surfacing than a countdown), or something else.
>
> This one is genuinely open. If the honest answer is that the received-side attention group has no real
> content and should go away until the deadline features (a separate, unbuilt spec) arrive, say so.

---

### Notes for whoever runs these

- Send §0 once, then §1–§2 together, then §3–§5 together; §6 can follow separately.
- **Six questions are deliberately delegated to the design:** the chip/glyph grouping for ten states
  (§1A/B), whether 5 and 6 are distinguished at glyph size (§1C), how a timeline *stops* (§2), the
  shape of the two sync settings (§3), the consent form and its relationship to the existing
  notification sheet (§4), the notification-type split (§5), and the fate of the attention group (§6).
  Capture the **reasoning** it gives, not just the markup — that reasoning belongs in the port.
- When the design returns: pull the current `.dc.html`, diff against the local reference, summarize,
  get sign-off, then implement. Do not port demo scaffolding.

### Verification still owed before any of this is built

> **Resolved.** (1) Confirmed on 2026-08-14 from `docs/isds-provozni-rad-2026-06-26.md`; the answer
> removed §3–§5 through 014. (2) Settled on 2026-08-16 by reading §17(4) of Act 300/2008: calendar
> days (see `fikce.ts`).

Two facts underpin §3–§5 and neither is confirmed against a primary source we hold:

1. **"Locally installed applications must sign in on a manual user command, not automatically."**
   Claimed to be in the Provozní řád ISDS. If true it constrains the *sent*-side sync too, since that
   also authenticates to the box — the §17(3) narrowing to `GetListOfReceivedMessages` covers
   *delivery*, not necessarily *signing in*. **This does not block the design work** (the two-setting
   split and the consent moment are right either way), but it could change the sent side's default from
   "on" to "on, but only while the app is in the foreground".
2. **The fikce deadline arithmetic** — claimed to count whole days from the day after delivery, land on
   the first **working** day, and stamp `23:59:59.999`. The app currently does flat `delivery + 10×24h`.
   Affects §6's countdown copy if the design keeps a countdown.

Both need the **Provozní řád ISDS of 26 June 2026** (`2245_Provozni_rad_ISDS_26_06_2026.pdf`), which we
do not have — our reference is the 17 April 2026 edition and only its Mobile Key annex was extracted.
The info site now serves an SPA shell for `/info/files/*.pdf`, so it has to be downloaded in a browser.
