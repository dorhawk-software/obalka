# Claude Design prompt — rework the recipient result row

**Purpose**: the recipient search is the one screen in the app where getting it wrong is
irreversible — a data message is a legal delivery and cannot be recalled — and it is currently
unusable for its hardest case: several people with the same name. The row shows the address, then
truncates it at the point where it would have told you which person you are looking at.

**Status**: sent and returned 2026-08-17 — see *What came back* below; ported in tasks T007–T012
(`AddressLines.tsx`).

---

## The prompt

> The recipient search in `Obalka Redesign.dc.html` needs reworking. It fails at the exact moment it
> matters most, and I have measured it rather than guessed.
>
> ### The failure
>
> Searching a common Czech surname returns many people with the **same name**. Here are three real
> results, rendered by the current row design:
>
> ```
> [JN]  Jan Novak · Nová 1/777, 60200 Br…        [Placená]
>       Fyzická osoba · ezfam3k
>
> [JN]  Jan Novak · Vaclavske namesti 1, …       [Placená]
>       Fyzická osoba · irci5we
>
> [JN]  Jan Novak · Ujezd 450, 11000 Pra…        [Placená]
>       Fyzická osoba · vsxiu3c
> ```
>
> Three different people. Same name, same avatar initials, same box type, same cost badge — **identical
> on every visible axis except the address**, which is the axis the row truncates. Two of the three
> lose the town entirely, and the town is the one word separating a Brno Jan Novak from a Prague one.
> The only thing shown in full is the box ID, which distinguishes nothing to a human being choosing
> between three strangers.
>
> The current row is: 38px avatar, one line of `name · address` clipped to a single line, a second line
> of `type · box ID`, and a cost badge pinned right. The address is last in the string, so it is always
> what gets cut, and the badge has already claimed the width it would need.
>
> ### What I want
>
> **Rework the row so the entire address is always visible.** Not "more of it" — all of it. And where
> the address has structure, present it structurally rather than as one run-on line.
>
> ### The data you have, exactly
>
> Per result, and nothing else:
>
> - **name** — `Jan Novak`, or a company name, which can be much longer
> - **address** — **one pre-composed string** from ISDS, e.g. `Nová 1/777, 60200 Brno, CZ`. In practice
>   it is two or three comma-separated parts: *street + number*, *post code + town*, and sometimes a
>   *country code*. Real examples: `Nová 1/777, 60200 Brno, CZ` · `Vaclavske namesti 1, 11000 Praha` ·
>   `Křejpského 1526, 14900 Praha` · `č. p. 1, 20100 …`
> - **box type** — `Fyzická osoba`, `Právnická osoba`, `OVM`, …
> - **box ID** — 7 characters, e.g. `ezfam3k`
> - **cost** — free or paid, currently the `Placená` / `Zdarma` badge
>
> Two things follow, and both are constraints rather than suggestions:
>
> 1. **The address is a single string. I do not get separate street/town/postcode fields here.** So a
>    structured presentation means **breaking the line at the commas ISDS itself put there** — that is
>    presentation. You may **not** re-order the parts, relabel them, add a country name, expand an
>    abbreviation, or infer anything not in the string. This is an official register entry and the app
>    must not restate it in its own words.
> 2. **Not every address has that shape.** Design the fallback: when the string does not split into
>    recognisable parts, the whole of it is still shown, wrapped, and the row must not look broken.
>
> ### Constraints
>
> - **Nothing may be truncated away.** If the name is very long *and* the address is very long, both
>   still have to be readable. Say what wraps and what is allowed to grow.
> - **The cost badge stays visible.** It is money — a paid message is charged to the box's credit. If it
>   is in the way, move it; do not drop it.
> - **The box ID stays.** It is the last-resort distinguisher when two results share a name *and* an
>   address.
> - **Long result lists.** A search can return dozens of matches. Taller rows mean more scrolling — tell
>   me how you traded that off, and whether you would group, condense or paginate. I would rather scroll
>   than pick the wrong person, but I want the choice made deliberately.
> - Full **dark mode**, **WCAG AA**, no layout jumps, holds at **1.5×** font scale, comfortable touch
>   targets, Czech-first copy (cs + en), existing palette/type/components.
>
> ### Also design these two, with the same address treatment
>
> 1. **The picked recipient**, as shown on the compose screen before sending. It currently repeats the
>    same `name · address` single line. This is the last moment a wrong choice can be caught, so it
>    should identify the person at least as clearly as the search result did.
> 2. **The message detail's counterparty** — the sender of a received message, the recipient of a sent
>    one. The app already stores an address for both and shows it nowhere. Same rules: whole address,
>    structured if the string supports it.
>
> ### Deliver
>
> - `sc-if` blocks for the reworked result row (including: long company name, missing address,
>   unstructured address, and three same-name results side by side so I can see them disambiguated).
> - The picked-recipient state and the message-detail counterparty block.
> - A short rationale, including the scrolling trade-off and what you did with the badge.

---

## Notes for the port (fill in when the design comes back)

- The row is `RecipientRow` in `src/features/messages/screens/ComposeScreen.tsx` (~line 1225).
- `Recipient` currently carries a single `label` (`name · address`) built in `toRecipientFromSearch`
  (`src/services/isds/soap.ts`) — it has to split into separate fields, per spec FR-001.
- The avatar currently derives its initials from the combined `label`; with separate fields it takes
  the name (FR-006).
- The message-detail address is already stored (`senderAddress` / `recipientAddress`), so that half
  needs no ISDS call.

---

## What came back (2026-08-17)

Read from the design project via `DesignSync`; the rework is in `Obalka Redesign.dc.html`. **The
design is the source of truth** — this section records it so the port has a local reference.

### The reworked result row

```
[JN]  Jan Novak                              ← name, own line, wraps, never truncated
      Nová 1/777                             ← line1: street.  muted, weight 500
      60200 Brno, CZ                         ← line2: post code + town.  weight 700, full text colour
      Fyzická osoba · ezfam3k  [Placená] [Shodné jméno]
```

- **The town is the emphasised element.** `line2` is bold and in the primary text colour while the
  street above it is muted — so the part that actually separates two namesakes is the part the eye
  lands on. The spec asked for the whole address to be visible; the design worked out *which half
  does the disambiguating* and weighted it. That is the bit worth stealing.
- Name, both address lines and the type line all carry `overflow-wrap:anywhere` + `text-wrap:pretty`.
  **Nothing truncates anywhere in the row** — FR-002 satisfied structurally rather than by hoping the
  strings are short.
- The meta row **wraps** (`flex-wrap`), so the cost badge can never squeeze the address again — which
  is what caused the original defect.

### Three address states, consistently applied

| State | Rendering |
|---|---|
| `hasParts` | `line1` / `line2` as above |
| `unstructured` | `whole` — the entire string in one wrapped block, weight 600 |
| `noAddr` | italic `Adresa neuvedena` / `No address given` |

Applied identically in all three places the prompt asked for: the **search result row**, the
**picked recipient** on compose, and the **message-detail counterparty** (`dParty` for a received
message's sender, `sd.recip*` for a sent message's recipient).

### Two additions the spec did not ask for

1. **A `Shodné jméno` / `Same name` tag** on every result that shares its name with another result in
   the same set.
2. **A results header**: `Nalezeno · N`, plus — only when duplicates exist —
   *"Stejné jméno má víc schránek — rozliší je adresa."* / *"Several boxes share this name — the
   address tells them apart."*

Both are safe: they describe the **result set**, not the person, so nothing is being asserted about
an addressee that ISDS did not say. And they solve a problem the spec only implied — the user has to
notice the names are identical before they think to compare addresses. Worth adopting; needs a
requirement of its own.

### One conflict with the spec

**FR-004 says show nothing where there is no address** — "no placeholder, no 'address not given'".
The design shows exactly that, in italics, in both languages.

**Recommendation: adopt the design and amend FR-004.** The reason FR-004 existed was to stop the app
saying something about a *person* it does not know. *"Adresa neuvedena"* says something about the
*record* — ISDS returned no address — which is true and is the only thing the app actually knows.
Against that, a silently missing line in a row that otherwise has a two-line address reads as a
loading failure, and invites the user to wonder whether the app dropped it.

The spec's instinct was still right; it was aimed one notch too wide. See the amendment on FR-004.

## Port notes

- `Recipient` (`src/services/isds/types.ts`) splits: `label` → `name` + `address`. The split of the
  address into `line1`/`line2` happens at the seam that renders it, from the commas ISDS supplied.
- `toRecipientFromSearch` (`src/services/isds/soap.ts`) stops concatenating.
- `RecipientRow` (`ComposeScreen.tsx`, ~line 1225) is replaced by the structure above; the avatar
  takes `name` (FR-006).
- The message detail (`MessageDetail.tsx`) gains the counterparty block, reading the already-stored
  `senderAddress` / `recipientAddress` — no ISDS call (FR-009).
- The same-name tag is computed over the current result set, not fetched.
