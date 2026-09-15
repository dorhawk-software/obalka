# UX plan: sending changes the navigation model

> **Historical (2026-06-15).** Design input for feature 008, which shipped its decisions — see
> [`specs/008-sending-navigation-ux/`](../../specs/008-sending-navigation-ux/). Recipient search was
> built on `ISDSSearch3`; 011 later replaced the ☰ drawer and the box list with the box switcher sheet.
> The "later" items (frequent recipients, address book, a Vše/All segment) were not built. Kept for
> rationale only.

**Trigger:** Feature 005 adds *sending*. The app's information architecture (IA) was built for a
**read-only** client, so several affordances are now ambiguous, and there's no way to see sent mail.
This plan addresses the three issues raised + one technical finding from on-device verification, and
proposes a coherent action model.

## The core problem

Until now there was exactly one "create" concept - **add a data box** - so a bare **`+`** and a
**pencil** were unambiguous. Now there are *three* distinct "create/act" intents that users must tell
apart at a glance:

| Intent | Frequency | Natural home |
|--------|-----------|--------------|
| **Compose / send** a message | medium | **inside a box** (it needs a sender box) |
| **Add** a data box | low (a few times ever) | top-level (home) |
| **Rename / remove** a box | low | per box |

The fix is to give each intent a distinct, conventional affordance and stop overloading `+` / pencil.

---

## Issue 1 - No way to see Sent messages

**Today:** opening a box shows only **"Přijaté zprávy"** (Received). After sending, users can't see
what they sent. ISDS exposes **`GetListOfSentMessages`**, and our parser *already* handles
`GetListOfSentMessagesResponse` (`parseMessageList` in `soap.ts`), so this is mostly wiring.

**Options**
- **A - Received / Odeslané segmented control** at the top of the box's message list (recommended).
  Conventional, scannable, low risk; each is a separate ISDS list with its own cache.
- **B - Unified timeline** (sent + received interleaved by date). You wondered about this. But ISDS
  messages are **standalone legal deliveries, not a threaded conversation**, so a date-interleaved mix
  is less scannable than a clear Received/Sent split. Better as an *optional later* "Vše/All" segment.
- **C - Sent as a separate top-level screen.** More navigation, worse discoverability than tabs.

**Recommendation: A** (a `Přijaté | Odeslané` segmented control), leaving the door open to add an
"All" timeline segment later if users ask for it.

## Issue 2 - The home `+` (add box) now reads as "compose"

A bare `+` universally means **"create new (message)"** in messaging apps. On the box overview it
means "add a data box" - which will mislead now that messages can be sent. And **compose is inherently
per-box** (with multiple boxes, a global "new message" is ambiguous about *which box sends*), so
compose should **not** live on the home at all.

**Options for "add box"**
- **A - Move "Add box" into the existing top-left menu (☰)** and drop the bare `+` from the home bar
  (recommended). Adding a box is rare; it doesn't deserve a primary slot.
- **B - Keep it on the home but make it unambiguous:** a labeled **"+ Přidat schránku"** row/button at
  the *end of the box list* (not a bare `+` in the top bar).

**Recommendation: A** (move to the menu), or **B** if you want a visible affordance - either way,
**no bare `+` on the home**, and **no compose action on the home**.

## Issue 3 - The per-box pencil (edit alias) looks like "compose"

A **pencil** means "write/compose" in most apps; here it means "rename the box." The card also shows
pencil **+** trash inline, which is noisy and compounds the ambiguity.

**Recommendation:** Replace the inline pencil + trash with a single **overflow (⋯) menu** per box →
**"Přejmenovat"** (rename, reuses the existing `AliasEditor` modal) + **"Odebrat"** (remove). This
declutters the card and removes the compose-confusion. Compose never appears on the box *card* - only
inside the box.

---

## The resulting action model (the through-line)

| Action | Where | Affordance |
|--------|-------|------------|
| Read received / sent | inside a box | message list with **Přijaté \| Odeslané** segments |
| **Compose / send** | inside a box | a clear **"Nová zpráva"** action (compose icon is fine *here*, in box context) |
| Add data box | home | **menu (☰)** or a labeled **"Přidat schránku"** row - never a bare `+` |
| Rename / remove box | per box | **overflow (⋯)** menu |

"Create new" semantics now belong **only** to compose, **only** inside a box.

---

## Recipient search - match the web: one fulltext field, all box types

On-device verification showed the *structured* `FindDataBox2` op requires a `dbType` (czebox returned
`dbStatusCode 1101 - "Nutno specifikovat typ schránky"`). **But the web portal's "Nová zpráva → Adresát"
step searches all box types from a single field** ("Hledat jméno, adresu, IČO, ID schránky" / *"celými
slovy"*) - that's the **fulltext** operation **`ISDSSearch`** (vendored in `db_search.wsdl`), **not**
the structured `FindDataBox2`. The web reserves typed/structured search for "Pokročilé vyhledávání".

So **recipient search should use `ISDSSearch` (fulltext, all types)** - a single field, **no type
selector** - exactly like the web. Each hit shows its **type + a free/paid badge**: the web marks
non-OVM recipients with a **🪙 coin** ("placená datová zpráva"), OVMs are free - which is *precisely*
our cost model. Keep structured `FindDataBox2` (with a `dbType`) only behind an optional later
"Pokročilé vyhledávání".

Two web niceties to note for later increments: **"Nejčastější adresáti"** (frequent recipients) and a
**personal address book** ("Můj adresář").

**Decision:** implement recipient search via **`ISDSSearch`** (fulltext, all types); **drop the
type-selector idea**. The current `findRecipients`/`buildFindDataBox2` (committed `ae689e7`) is rewired
to `ISDSSearch`. This fixes 1101 and matches the familiar web UX.

---

## Proposed tasks (outline)

1. **Sent messages** - add `GetListOfSentMessages` to the ISDS transport (parser already supports it);
   add a `Přijaté | Odeslané` segmented control to the box message list; cache the sent list per box.
2. **Home IA** - remove the bare `+`; move "add box" into the menu (☰); confirm compose is only
   reachable inside a box.
3. **Box card** - replace inline pencil/trash with an overflow (⋯) menu (Přejmenovat / Odebrat);
   declutter the card.
4. **Recipient search** - switch to **`ISDSSearch`** (fulltext, all box types) like the web: a single
   field, no type selector; show each hit's type + free/paid (🪙) badge. (Rewires the committed
   `findRecipients`.)
5. **(Later)** "Nejčastější adresáti" + personal address book; an "Vše/All" timeline segment if users
   want a chronological mix.

## Decisions (confirmed)

- **Sent messages:** segmented **Received | Sent** tabs (not a timeline).
- **Add box:** moved into the **menu (☰)**; no bare `+` on the home.
- **Recipient search:** **`ISDSSearch`** fulltext, all box types, no type selector (matches the web).
- **Box card:** per-box **overflow (⋯)** menu for rename/remove (drop the inline pencil/trash).
- **Proceed:** formalize as **feature 008** via the spec-kit loop, then implement.

## How to run this

Feature-sized and cross-cutting (touches 002 messages, 005 sending, 007 navigation). Formalize as
**feature 008 (sending & navigation UX)** via the spec-kit loop (`specify → plan → tasks`), per the
"run the full loop going forward" rule in `specs/README.md`, seeded by this document.
