# Quickstart: Sending Messages (czebox)

How to exercise feature 005 against the **czebox** test environment (Principle VII). Never send from a
production box during development — and note that **czebox does not charge real money**, so the *paid*
path is validated for **flow/blocking behaviour**, not an actual deduction.

> *Amended 2026-09-14:* the steps below follow the app as built — fulltext `ISDSSearch3` search, the
> 020 balance on the cost card, reconcile-before-retry instead of a send token, and T018's "Zobrazit
> zprávu v archivu" button.

## Prerequisites

- Two czebox test data boxes added in the app (feature 001): a **sender** and a **recipient**.
  - To exercise the **free** path, the recipient should be (or behave as) an **OVM**.
  - To exercise the **paid (PDZ)** path, use a **private** recipient (FO/PFO/PO) and a sender box with
    PDZ enabled + (test) credit.
- App running on the Android emulator or a device (iOS via the macOS CI build / sideload).
- A couple of small files + one larger file to test attachments and the big-message route.

## Happy paths

1. **Free send (to OVM)**
   - Compose → search the OVM by name (fulltext `ISDSSearch3`) → pick it. Each result shows its
     address and a **"Zdarma"** / **"Placená"** badge; the OVM's reads **"Zdarma"**. Add subject + an
     attachment → Send.
   - Expect: **no cost confirmation gate**, `CreateMessage` succeeds, a `dmID` is returned, the
     message appears in Odeslané / the archive.
   - On the success screen tap **"Zobrazit zprávu v archivu"** → the detail opens with its attachments;
     back lands on the message list, not on "Zpráva odeslána".

2. **Paid send (to a private box)**
   - Compose → search a private recipient → pick it; the result shows the **"Placená"** badge.
   - The paid cost card shows **"Přibližně N Kč"** and the box balance (**"Zbývá N Kč"**), with a
     caution (**"Zbývá N Kč. Na tuto zprávu to nemusí stačit."**) when it may not cover the price. An
     unknown balance shows nothing.
   - Send → the confirmation sheet (**"Odeslat placenou zprávu?"**) → confirm → `CreateMessage` (PDZ)
     succeeds → `dmID` returned.

3. **Large message** — attach a file over the ordinary limit (20 MB) → the app routes to VoDZ
   (`UploadAttachment` → `CreateBigMessage`) transparently (no opaque size error).

## Failure / guard paths (Principle II)

- **Recipient rejects PDZ** → blocked pre-send with a clear localized reason (not an opaque ISDS error).
- **PDZ disabled / insufficient credit** → blocked with a **"Koupit kredit"** link out to the portal
  (no in-app purchase).
- **Network drop mid-send** → a localized error; the retry first reconciles against
  `GetListOfSentMessages` (same recipient + subject within 15 min), so it never charges twice.
- **Session expired** → compose shows the re-login message; sign in again and resend.

## Acceptance checklist (Definition of Done)

- [ ] Free vs paid is shown **before** the user can send; paid **always** requires confirmation.
- [ ] PDZ credit balance is visible; insufficient credit blocks + links out (no silent spend).
- [ ] UI **stays responsive while encoding/uploading a large attachment** (Principle I) — scroll/cancel work.
- [ ] No send outcome hard-crashes; every error is localized with a retry path (Principle II).
- [ ] A retry after an ambiguous failure never charges a PDZ twice.
- [ ] Sent message enters the durable archive (004) and is never silently lost (Principle IV).
- [ ] All strings localized, cs primary; works in dark mode (Principle V).
- [ ] Exercised end-to-end against czebox (Principle VII).
