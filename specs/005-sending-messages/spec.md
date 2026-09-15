# Feature Specification: Sending Messages

**Feature Branch**: `005-sending-messages`
**Created**: 2026-06-13
**Status**: Implemented (41/42 tasks done; T031, the acceptance run in the test environment, is open). Captured early because of a non-obvious **cost model**.
**Input**: Roadmap feature 005 — compose, recipient lookup, attachment upload, delivery/acceptance
info. The hard part is not the SOAP call (`CreateMessage`) — it's that **sending can cost money**.

> **As built.** Recipient lookup uses fulltext `ISDSSearch3` (`FindDataBox2` is unused). PDZ eligibility
> comes from the search hit's `acceptsPdz` plus whether `DataBoxCreditInfo` answers; there is no
> `PDZInfo` call. See [`docs/sending.md`](../../docs/sending.md).

## ⚠️ Cost model (the critical, easy-to-miss part)

Sending a data message is **sometimes free, sometimes paid**, depending on the recipient:

- **To a public authority (OVM)** — **free**. A normal data message (DZ).
- **To another private box (FO / PFO / PO)** — **paid**, as a **Poštovní datová zpráva (PDZ)** — the
  commercial message type. It requires the **sender's box to have PDZ enabled and enough credit**.
  - **Observed (user, production, 2026-06):** Fyzicka → DPFO cost **10 CZK** per message; a **large**
    message (large attachment) cost **30 CZK**. So price is **tiered by size**. The user had to **buy
    credit** for the Fyzicka box first.
- The **sender** pays (their box's credit), not the recipient.

So a send flow can't just "send" — it must know whether the recipient makes it free or paid, and the
price tier, BEFORE sending.

## What the ISDS web services give us (vendored, confirmed)

- `CreateMessage` (dm_operations) — send a message; `dmType` / PDZ fields select the message type.
- `CreateBigMessage` — the VoDZ (large-volume) track.
- `FindDataBox2` (db_search) — recipient lookup (the user types a name/ID → resolve the box).
- **`DataBoxCreditInfo`** (15 refs in the schema) — **the box's PDZ credit balance + history**. So we
  **can show the user their remaining credit** in-app. ✅
- **`PDZInfo` / `DataBoxCreditInfo`** — whether the sender box may send PDZ + its credit; this is the
  PDZ-eligibility source (`GetUserInfo` only if finer per-user permissions turn out to be needed).
- Recipient box `dbType` (OVM vs FO/PFO/PO) tells us free-vs-paid.

## Implications / requirements to honor (for the eventual build)

- **FR-001 (inform before paying)** Before sending, determine if it's free (OVM) or paid (PDZ) from
  the resolved recipient, and **tell the user the cost** (and confirm) — never silently spend credit.
- **FR-002 (show credit)** Surface the box's PDZ credit balance (`DataBoxCreditInfo`), at least in the
  compose flow / box detail, so a paid send isn't a surprise (and we can warn "insufficient credit").
- **FR-003 (free path obvious)** Make the free case (to an OVM) clearly free in the UI.
- **FR-004 (price tier by size)** The price depends on attachment size — reflect/estimate it; the exact
  tariff should be confirmed from the operator's price list (10/30 CZK observed, may change).
- **FR-005 (text message → PDF, accessibility)** ISDS messages must carry a document, not just a
  subject. Mirror the web portal: let the user type a plain-text body, and on send render it to a
  **`Textová zpráva.pdf`** (the main document) so they don't have to create a PDF themselves. Rendering
  uses the OS PDF engine (Czech diacritics/wrapping correct, off the JS thread). A typed body OR an
  attachment satisfies the "≥1 document" rule. _(Implemented; `react-native-html-to-pdf`.)_
- **FR-006 (large messages / VoDZ)** Attachments over the ordinary ~20 MB limit (≤ 100 MB) send via the
  large-volume **VoDZ** track (`UploadAttachment` → `CreateBigMessage` on the separate `ws2` service);
  over 100 MB is blocked with a clear reason. See `contracts/isds-bigmessage.md`.
- **FR-007 (drafts auto-save on exit + undoable discard)** _(refinement, 2026-06-16)_ Composing must
  not require a manual "Uložit koncept" action — **remove that button**. Instead, when the user **leaves
  message creation** with anything entered (recipient, subject, or body) and it wasn't sent, the draft
  is **saved automatically** on every exit path (back chevron, swipe-back, hardware back). On save, show
  a brief **"Koncept uložen" snackbar** with an inline **"Zahodit" (discard)** action. Tapping discard
  deletes the draft and the snackbar flips to **"Koncept zahozen" with "Vrátit zpět" (undo)**, which
  restores the draft — so an accidental discard is recoverable. Nothing is saved for an empty compose or
  after a successful send (a sent draft is cleaned up). The snackbar lives **above the navigator** so it
  survives the Compose→list transition.
- **FR-008 (recipient search placeholder fits)** _(refinement, 2026-06-16)_ The recipient-search field's
  placeholder must **fit the input** (the long "Hledat příjemce (název nebo ID schránky)" overflowed) —
  use a short placeholder and keep the full description as the accessibility label.

## Buying credit — investigate before dismissing

- Credit is almost certainly **bought via the web portal / bank**, NOT via the ISDS web services
  (there's a credit _info_ WS, but no "top-up" WS that we expect). So **in-app top-up is likely not
  possible** — the app would **link out** to the portal to buy credit.
- **App-store caveat:** even if a top-up flow existed, selling credit could be treated as digital
  goods (Apple/Google 30% + rules) — another reason to link out rather than sell in-app.
- **Resolved:** ISDS has no top-up operation; the app links out to the portal (Koupit kredit).

## Status — built

All four parked items shipped: recipient lookup (US1), native base64 attachment read, the single
post-send delivery line (T035) and drafts (US3).

**Still deferred** (genuinely out of v1.x scope):

- Recipient lookup niceties — **recents / favourites**, advanced search refinement.
- A richer delivery-event **timeline** (beyond the single post-send acceptance confirmation).
