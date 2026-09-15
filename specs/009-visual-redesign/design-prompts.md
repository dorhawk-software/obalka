# Claude Design prompts — screens the redesign omits

The imported `Obalka Redesign.dc.html` covers most of the app, but several **already-implemented**
features have **no design section**. Per the user's instruction, we don't invent these — instead, paste
the prompts below into the **same Claude Design project** ("Obálka app design overview") so the screens
are designed in the identical visual language, then we port them in 009.

**Status:** ✅ **All 7 confirmed & imported** (2026-06-30). 1–2 → [`design-system.md` §6](./design-system.md);
3–7 → [§7](./design-system.md). Verified implementable against existing code, with 3 mock-only caveats
recorded in §7 (the Settings "States" section is demo scaffolding — **do not port**).

**How to use:** paste **§0 (shared context)** once, then the specific prompt(s) you want. Each prompt
asks Claude Design to **extend the existing `Obalka Redesign.dc.html`** with new `sc-if` states using
the same tokens/components, so everything stays consistent. (Order by priority: 1 Sent mail → 2 Test
env → 3 Mobile Key → 4 Reauth → 5 Notifications → 6 List/sync states → 7 Attachments.)

---

## §0 — Shared context (paste first)

> You are extending an existing mobile app design, **`Obalka Redesign.dc.html`**, in this project.
> "Obálka" is a Czech **Datová schránka** (government data-box) mail client. Keep the **exact** visual
> language already in that file — do not restyle it. Reuse its tokens and components:
>
> - **Palette (light/dark):** bg `#F4EEE2`/`#1A1712`, surface `s` `#FBF6EA`/`#221E18`, card `#FFFDF8`/
>   `#2A251E`, sunken `#F2EADB`/`#322C24`, border `bd` `#ECE3D2`/`#3A332A`, strong `bds` `#DCD2BF`/
>   `#4A4236`, text `#211B12`/`#F2ECE0`, mut `#6B6253`/`#A89D8B`, faint `fnt` `#9A9180`/`#8A8070`.
>   Accents: brand blue `#2A5C9A` (logo tile `#2D6CB5`), gold `#E8A100`/`#F5B81E`, red `#BE3A34`
>   (surface `#F7E4E1`), green `#2E7D52` (surface `#E2F0E8`), amber surface `#FBEFD0`, link `#B07F00`.
> - **Type:** Bricolage Grotesque (`.bg`) for display/headings; Public Sans for body/UI.
> - **Components:** 54px screen header (back chevron + `.bg` title); cards radius 16, inputs/buttons/rows
>   14, chips 8–9, sheets 24-top, dialogs 20; **dark high-contrast primary buttons** (`text` fill, `s`
>   label); blue selection radios; 48×28 toggles; bottom sheets with a 40×4 grab handle and
>   `rgba(33,27,18,.4)` scrim; the `text`-fill snackbar with a gold action.
> - **Brand mark:** the app has its **own** envelope logo (blue body + gold flap) used at the sizes the
>   design already uses — design the layouts around a logo slot; don't draw a new mark.
> - **Hard constraints:** Czech-first copy (provide cs + en), full **dark mode**, **WCAG AA** contrast,
>   **no layout jumps** (reserve space for any transient/async element), honor Reduce-Motion/Transparency.
>
> Deliver each new screen/state as `sc-if` blocks consistent with the file, with placeholder data wired
> like the existing screens. Czech labels primary.

---

## 1. Sent mail (comprehensive — you decide the best placement)

> Add **sent messages** ("Odeslané") to the design. The current inbox you designed shows only received
> mail grouped into "Vyžaduje pozornost" + "Dříve" — there is **no** way to see what a box has sent, but
> the app fully supports sending and listing sent messages (ISDS `GetListOfSentMessages`). **Decide the
> best information architecture** for surfacing sent mail in this new design and lay it out — options to
> weigh (pick what fits the redesign best, or propose your own):
> (a) a `Přijaté | Odeslané` segmented control on the inbox; (b) an "Odeslané" entry in the box-switcher
> sheet; (c) a filter/scope control in the header. Then design **all** of:
> - The **sent list**: rows oriented **you → recipient** (recipient name/avatar, subject, sent date,
>   delivery state — odesláno / dodáno / doručeno), attachment indicator. Sent mail has **no** "Vyžaduje
>   pozornost" grouping (no fiction clock on outbound) — show a clean chronological list with date
>   sections ("Dříve" style).
> - The **sent-message detail**: same postmark-card pattern as received, but oriented to the **recipient**
>   ("Komu"), showing send/delivery/acceptance timestamps and a delivery-state indicator; same attachment
>   block; no Reply/Termín actions (or specify what actions a sent message should offer, e.g. "Detail
>   doručení").
> - **Empty state** ("Zatím jste nic neodeslali") and the **loading/refresh** state, matching §6 below.
> - How switching between received and sent feels (the control's selected/idle styling, per-platform if
>   relevant), and where the **compose FAB** sits in each.
> Provide cs + en labels. Keep it pixel-consistent with the existing inbox.

## 2. Test environment ("Testovací") — persistent banner + env affordances

> Design the **test-environment** treatment. Boxes can be on the real ISDS ("Ostré") or the **czebox**
> test environment ("Testovací"); when the active box is a **test** box, the user must be able to tell
> **at a glance, on every screen**, that this is not their real legal mail. Design:
> - A **persistent full-width "Testovací" banner** pinned at the very top, **above every header** (inbox,
>   detail, compose, settings, add-box, reauth). It sits in normal flow (pushes content down — never
>   overlaps), uses the soft-gold test styling, full-bleed, with a small icon + "Testovací prostředí".
>   Show how it stacks above the existing 54px headers and the inbox header.
> - The **per-box marker** in the box-switcher sheet (a small "Testovací" tag on a test box's row) and on
>   the box-switcher button in the inbox header.
> - Confirm the **Ostré | Testovací** toggle already in the add-box "Pokročilé" section is consistent.
> Czech-first (cs + en). Light + dark. Must not cause layout jumps when present vs. absent.

## 3. Mobile Key — waiting / confirmation screen (+ OTP suggestion)

> The add-box flow already has a method picker including **"Mobilní klíč" (Mobile Key)** and a
> credentials screen. Mobile Key needs **two more states** the design is missing:
> - A **"waiting for confirmation"** screen shown after the user submits the communication code: the app
>   is waiting for the user to approve the sign-in in the separate **Mobilní klíč** app. Design a calm
>   waiting state — our logo, a clear title ("Potvrďte přihlášení v aplikaci Mobilní klíč"), a subtitle
>   explaining to switch to that app and approve, an **animated but Reduce-Motion-safe** progress
>   indicator, a countdown/expiry hint, and **Zrušit** / **Zkusit znovu** affordances. Include the
>   timeout/expired variant ("Vypršel časový limit") with a retry.
> - An **"OTP suggestion"**: when a password sign-in could also use an SMS one-time code, a gentle
>   inline suggestion/card offering to switch to the SMS-code method. Design that nudge.
> Czech-first (cs + en), light + dark, consistent with the existing add-box/OTP screens.

## 4. Re-authentication (expired box session)

> Design the **re-authentication** screen. When a saved box's stored session/credentials expire, the user
> must re-authenticate **that specific box** (not add a new one). It differs from add-box: the **identity
> is fixed** (show the box's avatar + name + ID in a locked identity card at the top, not editable), and
> the copy explains the session expired. Design:
> - A header ("Přihlásit znovu"), the **locked identity card**, the method indicator (the box's auth
>   method — password / SMS / Mobile Key), the relevant credential field(s) (password or communication
>   code, with the eye toggle), and the primary **"Přihlásit se"** button (with its loading state).
> - The **error** state (wrong password / locked account) with a clear localized message + retry, and
>   the path into the **OTP** or **Mobile Key waiting** screens (§3) when the box uses those methods.
> Czech-first (cs + en), light + dark, consistent with add-box credentials.

## 5. Notification-permission priming

> Design a **one-time notification-priming** modal/sheet shown before the OS permission prompt. The app
> alerts users to **new government mail** (and, later, deadline reminders) via local notifications since
> ISDS has no push. Design a friendly bottom sheet or dialog: a bell/notification illustration, a title
> ("Zapnout upozornění?"), a short value explanation ("Dáme vám vědět o nové zprávě a blížících se
> termínech — vše zůstává ve vašem telefonu."), a primary **"Zapnout upozornění"** and a secondary
> **"Teď ne"**. Include the styling for when it's dismissed (no nag). Czech-first (cs + en), light + dark.

## 6. List & sync states (refreshing · offline · empty · error)

> Design the **transient/edge states** for the message lists (inbox + sent + search), which the current
> screens don't show. Critical constraint: **no layout jumps** — these must occupy reserved space and not
> shift the rows. Design:
> - **Refreshing / syncing indicator** — a quiet, constant-height "Aktualizuji…" line or pull-to-refresh
>   treatment (prefer text/inline over a height-changing spinner), plus a "naposledy aktualizováno …"
>   timestamp.
> - **Offline banner** — a subtle inline strip ("Offline — zobrazuji uložený archiv") that doesn't push
>   content jarringly.
> - **Empty states** — empty inbox ("Žádné zprávy"), empty search ("Nic nenalezeno"), no-boxes
>   first-run (before the welcome→add-box path), each with our logo/illustration + one helpful line.
> - **Error + retry** — a load failed state with a localized message and a **"Zkusit znovu"** button.
> Czech-first (cs + en), light + dark.

## 7. Attachments — multiple files, availability & paid-send confirm

> The design's message detail shows a **single** PDF attachment and compose only turns text into a
> "Textová zpráva.pdf". The app is richer; design these:
> - **Detail — multiple attachments**: a **list** of attachment rows (file-type tile, name, size,
>   downloaded/saved-offline state), since a message can carry several files. Show ISDS's **all-or-nothing
>   download** model (one "Stáhnout přílohy" action downloads the whole envelope, with progress), the
>   per-row downloaded ✓ state, and the **"Příloha už není dostupná"** state for mail past the ISDS 90-day
>   window (still in our local archive vs. not).
> - **Compose — attachments**: an **"Přidat přílohu"** affordance and attached-file chips/rows (name,
>   size, remove), shown above/below the body, alongside the existing "z textu vytvoříme přílohu" note.
> - **Paid-send confirmation**: when sending a **Poštovní datová zpráva (PDZ)** to a private recipient
>   (paid 🪙), a confirmation sheet/dialog before sending ("Odeslat placenou zprávu? Z kreditu schránky se
>   strhne ~X Kč") with confirm/cancel, complementing the inline cost card you already designed.
> Czech-first (cs + en), light + dark, consistent with the existing detail/compose screens.

---

### Notes for whoever runs these
- After Claude Design returns, re-import via the `claude_design` MCP and fold the new `sc-if` states /
  tokens into `design-system.md`, then port in 009.
- §1 (sent mail) and §2 (test banner) unblock the two 008 features the redesign dropped; do them first.
- The deadline/attention/scan screens are **already** in the design (feature 010) — no prompt needed.
