# Claude Design prompts — About & Help (FAQ + licences)

`Obalka Redesign.dc.html` draws `Nastavení → O aplikaci` as a **single row** (`Verze`). Feature 012 adds
a FAQ screen and a licence screen behind it, plus a pre-sign-in help entry. **None of these exist in the
design.** Per the 009 workflow and the user's explicit confirmation (2026-07-23), these screens are
**designed by Claude Design, not invented in code** — paste the prompts below into the same project
(`Obalka Redesign.dc.html`, project `2c15c7b1-3690-44ff-b610-4ea7620bdb6a`), then port what comes back.

**Status:** ✅ **§1–§5 sent, designed and imported (2026-07-23).** All four screens landed and the three
delegated decisions were answered — see `plan.md` § "What the design returned". §5 then closed the two
licence gaps the first round could not have met, because §3 failed to state them: the `licenceGroup`
screen (full enumeration) and per-component copyright lines — see `plan.md` § "§5 returned".

**How to use:** paste **§0** once, then §1–§3 (they are one coherent area; sending them together lets the
design settle the hub and its children consistently). §4 is a smaller, separable follow-up.

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
> - **Type:** Bricolage Grotesque (`.bg`) for display/headings; Public Sans for body/UI. Note the file's
>   own convention: prose sets an explicit `line-height` (14→20, 13→18, 12→16) while dense list rows
>   leave the font's metric leading. These screens are **prose-heavy** — set leading explicitly.
> - **Components:** 54px screen header (back chevron + `.bg` title); cards radius 16, inputs/buttons/rows
>   14, chips 8–9, sheets 24-top, dialogs 20; dark high-contrast primary buttons; the settings-card row
>   pattern already used on `Nastavení`.
> - **Hard constraints:** Czech-first copy (provide cs + en), full **dark mode**, **WCAG AA** contrast,
>   **no layout jumps** for transient/async elements, honor Reduce-Motion.
>
> Deliver each new screen/state as `sc-if` blocks consistent with the file, with placeholder data wired
> like the existing screens. Czech labels primary.

---

## 1. `O aplikaci` — from one row to a hub

> Today `Nastavení → O aplikaci` is a single card row showing `Verze` and a version number. It needs to
> become a small hub with four entries:
>
> - **Verze** — value on the right, as today (not tappable)
> - **Časté dotazy** — opens the FAQ screen (§2)
> - **Licence** — opens the licence screen (§3)
> - **Zdrojový kód** — opens the public repository in the system browser (external-link affordance)
>
> Design this using the settings-row pattern already in the file. Decide how a **navigating** row differs
> from the existing **value** row and from the existing **toggle** row — the section currently has only
> one row type, and three now coexist. Show both light and dark.

---

## 2. FAQ screen (`Časté dotazy`)

> A pushed screen with the standard 54px header. Two groups of questions:
>
> - **Aplikace** — how to use the app (adding/switching boxes, why re-authentication happens, where
>   downloaded attachments go, what the local archive keeps)
> - **Datové schránky** — how the government system works (`Dodáno` vs `Doručeno`, delivery fiction /
>   *fikce doručení*, ISDS deleting contents after 90 days, test vs production environment)
>
> Each entry is a question that expands to a multi-paragraph answer. **You decide** whether that is an
> accordion, a list navigating to a detail screen, or something else — please pick what suits long
> answers on a phone and say why.
>
> Requirements to design around:
>
> - A **standing disclaimer** — this is informative only and is not legal advice. It must be visible
>   without hunting for it, and must not look like an error or warning banner. Consider where it lives
>   relative to the domain group specifically, since that group is the sensitive one.
> - **Answers are genuinely long** — several paragraphs, occasionally a short list. Show a realistic
>   worst case, not a one-line placeholder.
> - Expanding an answer is user-initiated, so it may move content **below** it — but nothing above the
>   tapped row may shift.
> - Some answers reference a state the user can see elsewhere in the app (e.g. the `Dodáno`/`Doručeno`
>   glyphs on the sent list). If you think inline references to those marks help, design that.
>
> Also design the **empty-of-network** case: nothing here needs the network, so there is no loading,
> error, or offline state at all — confirm the screen has no such affordances rather than adding them.

---

## 3. Licence screen (`Licence`)

> A pushed screen with the standard 54px header, in two parts:
>
> 1. **The app's own licence** — "Obálka" is released under **MIT**. Show the copyright line and the
>    licence, plainly and first.
> 2. **Third-party components** — roughly **310 entries**. Each has a name, a version, and a licence
>    identifier (MIT, ISC, BSD-3-Clause, Apache-2.0, BSD-2-Clause, SIL OFL-1.1). Selecting one opens its
>    full licence text.
>
> The scale is the interesting problem: 310 rows is a long, dull list, and the user is almost never
> looking for a *specific* one — they are either a store reviewer checking it exists, or someone curious
> what the app is built from. **You decide** how to present that: grouped by licence type, searchable, a
> flat list, a summary count with a drill-down. Please say what you chose and why.
>
> Design also:
>
> - The **licence detail** view — full, unmodified licence text. Apache-2.0 runs to ~11 000 characters;
>   it must scroll to its end and must never be truncated or summarized.
> - Four entries are **not npm packages** and deserve a thought: two bundled typefaces (Public Sans and
>   Bricolage Grotesque, both SIL OFL-1.1 — these are the fonts the design itself uses) and two native
>   libraries compiled into the app (SQLCipher, which encrypts the local archive, and OpenSSL). Consider
>   whether these read better separated from the npm list, since they are the ones a curious user would
>   actually recognise.

---

## 4. Pre-sign-in help entry (smaller, separable)

> Someone who has just installed the app and cannot sign in has the hardest question of all: *where do I
> get my ISDS credentials?* Today help lives only inside Settings, which is behind sign-in.
>
> Add a way to reach the FAQ (§2) from the **Welcome** and **sign-in** screens. **You decide** the
> affordance — a header link, a footer link, a text button under the form. Constraints: it must not
> compete with the primary action, must survive returning to a partly-filled sign-in form, and must work
> on both screens without looking bolted on.

---

## 5. Licence screen — enumeration and copyright notices (follow-up) ✅

> Two things the licence screen you designed does not yet cover. Both are my omission — I did not state
> either constraint in the original brief — so this is an extension, not a correction of your work.
>
> **A. Every component has to be reachable by browsing, not only by search.**
> The browse view currently shows, per licence group, a count and a few sample rows; the
> `Zobrazit celou licenci` row opens the licence text. So a user can see *that* there are 241 MIT
> components and read the MIT text, but cannot see the other 236 names unless they already know what to
> search for. The obligation is that every distributed component is listed with its name, version and
> licence.
>
> Please design that. **You decide** the shape — a per-group "all components" screen, an expanding
> group, a sectioned long list, something else. Note the honest constraint: one group has ~240 entries,
> so whatever you choose has to stay pleasant at that length on a phone.
>
> **B. Each component's own copyright line has to appear somewhere.**
> Your `LIC` map holds one generic text per licence with `Copyright (c) <year> <copyright holders>` as a
> placeholder. In reality every component carries its *own* copyright line — `Copyright (c) 2013-present,
> Facebook, Inc.`, `Copyright (c) 2025 ZETETIC LLC`, and so on — and MIT, ISC and both BSD licences
> require **that line**, per component, to be reproduced. The shared licence body is the same for all of
> them; the copyright lines are not.
>
> So the model is: one licence *text* per identifier (as you have it), plus a copyright line per
> component. **You decide** where the copyright line belongs — on the component row, on the licence
> detail screen as a list of all holders that licence covers, on a per-component screen, or elsewhere.
> Consider that it is legally required but visually dull, so it should be present and findable without
> dominating the screen.
>
> Please say which option you chose and why, as you did for the grouping.

---

### Notes for whoever runs these

- Send §0 once, then §1–§3 together; §4 can follow separately.
- Three questions are deliberately left to the design: the FAQ's expand model (§2), the 310-entry
  presentation (§3), and the pre-sign-in affordance (§4). Capture the *reasoning* it gives, not just the
  markup — that reasoning belongs in the port.
- When the design returns, re-run the diff against the local reference copy before porting, the way the
  sent-status update was handled: pull the current `.dc.html`, diff, summarize, then implement.
- Do not port anything that looks like demo scaffolding (see 009's note about the Settings "States"
  section).
