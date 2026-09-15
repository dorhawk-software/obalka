# Implementation Plan: About & Help — FAQ and licences

**Branch**: `012-about-help-licences` | **Date**: 2026-07-23 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/012-about-help-licences/spec.md`

## Summary

Add an `O aplikaci` hub with two new pushed screens — a bundled, offline **FAQ** (app how-to + ISDS
domain, with a not-legal-advice notice) and a **Licence** screen carrying the app's own MIT licence plus
every third-party notice. Settle the project's licence: `LICENSE` (MIT) at the root, `"license": "MIT"`
in `package.json`.

The attribution list is **generated** from the resolved production tree and CI-verified, because a
hand-kept list is exactly how the current gap arose. Generation is a purpose-built script rather than an
off-the-shelf licence checker, for a reason that turned out to be decisive: **the components with the
strictest notice requirements are not npm packages at all** (see Decision T2).

**Design status: complete (2026-07-23).** The first round (+50 064 chars, 8 hunks) drew all four
screens and answered the three questions the prompt delegated — see § "What the design returned" below.
The two requirements it missed, both because the prompt failed to state them (G1 enumeration, G2
per-component copyright), were closed by §5 the same day. Everything that is not screen layout
(licence tooling, content, repo licensing, CI) was never blocked.

## Technical Context

**Language/Version**: TypeScript 5.x (strict), React Native 0.86, New Architecture
**Primary Dependencies**: none added at runtime. Generation uses Node's stdlib + `npm ls` only.
**Storage**: N/A — all content is compiled into the bundle; nothing is persisted or fetched.
**Testing**: Jest (content parity, manifest completeness, licence-screen rendering)
**Target Platform**: iOS 15.1+, Android; both themes; cs + en
**Project Type**: mobile app (single project)
**Performance Goals**: no runtime cost — content is a static import, parsed at build time, never at
  startup. The manifest must not measurably affect cold start (Principle I).
**Constraints**: fully offline; no network call from either screen; bundle growth budget **≤ 80 KB**
  for the deduped manifest and licence texts.
**Scale/Scope**: **170 npm packages actually ship** (measured from the release bundle's source map,
  both platforms) plus 4 non-npm components = **174** distributed, across 5 licence identifiers. Not
  717, which is what `npm ls --prod` reports — see T1a. ~14 FAQ entries × 2 languages; 4 new screens;
  1 generator; 1 CI check.

## Constitution Check

*GATE: passed at plan time; re-check after the design returns and before implementation closes.*

| Principle | Assessment |
|---|---|
| **I. Never block the UI thread** | PASS. No network, no runtime parsing. The manifest is a compile-time import; licence texts are deduped so no large blob is decoded at startup. Long texts render in a scroll view, virtualized if the list warrants it. |
| **II. Crash-resilient by contract** | PASS. Nothing can fail at runtime except a missing content key, which the cs/en parity test makes impossible to ship. No I/O, no retries needed. |
| **III. Privacy first, on-device only** | PASS, and this feature is where it gets *stated*. No backend, no fetch, no analytics; the repository link hands off to the system browser on explicit user action. The deliberate exclusion of a contact form (spec Out-of-scope) exists to protect this. |
| **IV. The local archive is sacred** | N/A — this feature reads and writes nothing. |
| **V. Modern, accessible, Czech-first UX** | PASS *with one carve-out to verify*: FAQ expansion moves content, which is legitimate because it is user-initiated, not transient/async — but content **above** the tapped row must not move, and no async element may reflow the list. Metrics come from the ui-guide only; both themes; Dynamic Type at large sizes on the app's longest text blocks; cs primary. |
| **VI. Honest scope** | PASS, and load-bearing here. A FAQ is the easiest place in the app to over-claim. Answers describe only shipped behaviour — in particular, Mobile Key must be described as it actually ships, not as the roadmap imagines it. SC-007 is the guard. |
| **VII. Verify against the test environment** | N/A for ISDS — this feature makes no ISDS call, so there is nothing to exercise against czebox. It still requires on-device verification in both themes and both languages before "done". |

No principle is violated and no exception is requested.

### Re-checked after implementation (2026-07-23, Phase F)

Measured on device rather than asserted:

| Principle | Result |
|---|---|
| **I** | PASS. No network primitive is referenced by any of the four screens (verified by grep); the only outbound call in the whole area is `Linking.openURL` for the repository row, which is a hand-off, not a fetch. |
| **II** | PASS. Nothing can fail at runtime — no I/O. |
| **III** | PASS. See I. Nothing is fetched, and the deliberate absence of a contact form holds. |
| **V** | PASS, **after one fix**. Expanding an FAQ entry leaves every element above it byte-identical (`APLIKACE` and all three questions above the tapped row kept the same uiautomator bounds). At 1.5× font scale the line boxes grow to the font's natural leading (26.3dp/line) rather than clipping — large type reflows. Both themes walked. |
| **VI** | PASS, and it earned its keep: reviewing the design's draft copy against the code caught three false claims, all of which would have shipped. One was already live in the app. |
| **VII** | N/A for ISDS. |

**The one deviation the port forced.** The pre-sign-in FAQ was first built as an `AppShell` *route*.
On device that failed FR-007 twice over: Android hardware back exited the app instead of returning, and
— because a route swap unmounts the screen underneath — the half-filled sign-in form came back wiped.
It is now an **overlay** over the live screen, wrapped in `EdgeSwipeBack` for hardware back and the iOS
edge swipe. Re-verified end to end: type into the form → open help → hardware back → the form returns
with the typed value intact.

## What the design returned (2026-07-23)

Four screens: `O aplikaci` hub, FAQ, Licence, Licence detail — plus a Welcome help affordance. The three
delegated questions were answered:

| Question | The design's answer |
|---|---|
| FAQ expand model | **Accordion.** One card per entry (radius 14, `card` on `bd`), question 15/700/lh 20, a 22×22 `sunken` chip showing `+` / `–`. Expanded answers are paragraph arrays at 14/400/`text2`, lh 20, gap 10. |
| ~310 licence entries | **Four-part screen**: the app's own licence as a card (with logo) first → search field → **`Vestavěné komponenty`** (the four non-npm components, listed in full, each labelled *Písmo* / *Nativní knihovna*) → third-party **grouped by SPDX**, each group showing a count, a few sample rows, and a link to the licence text. |
| Pre-sign-in affordance | **Two** entry points, not one: a bottom-centred text button with a question-mark-circle glyph on Welcome, **and** one under the credentials form. `faqFrom` tracks the origin so back returns to the right screen — which is exactly FR-007. |

It also settled the plan's one open question: the copyright line is **`© 2026 Přispěvatelé projektu
Obálka` / `© 2026 The Obálka contributors`** — contributors rather than a personal name, which is the
better choice for an open-source project and is adopted.

The design separated the four non-npm components into their own section unprompted, which is the single
most useful thing on that screen: SQLCipher and the two typefaces are the entries a curious user would
actually recognise.

### Two requirements the returned design does not meet

Both are omissions in **my** prompt, not design errors — it was never told either constraint.

**G1 — the ~310 components are not enumerable.** The browse view shows a per-SPDX count plus 3–5 sample
rows; the `Zobrazit celou licenci` row opens the *licence text*, not the component list. Sample rows do
the same. Search reaches any component by name, but only if you already know the name. FR-009 requires
every distributed component to be listed with name, version, and licence id.

**G2 — no per-component copyright notices anywhere.** The `LIC` map holds one *generic* text per SPDX id
with literal `Copyright (c) <year> <copyright holders>` placeholders. But MIT, ISC and both BSD variants
require **the copyright notice of each component** to be reproduced — that is the actual obligation, and
a placeholder does not discharge it. This is the more serious of the two: G1 is a usability gap, G2 is
the compliance gap this feature exists to close.

Resolution: follow-up prompt `design-prompts.md` §5. Do **not** improvise either in code.

### §5 returned — both gaps closed (2026-07-23)

**G1** → a new **`licenceGroup`** screen. The browse row becomes `Zobrazit všech {count}` / `Show all
{count}` and pushes a screen titled with the SPDX id, holding a card button to the full licence text
(blue, document glyph + chevron) above **every** component in that group. Search was also widened from
the samples to the full expansion, so both routes now reach everything.

**G2** → a copyright line per component, everywhere one is listed: bundled rows show
`{{ kind }} · {{ ver }}` then the copyright at 11/500/`fnt`; group rows show name 14/600, copyright
11/500 lh 15, version 12/500 right-aligned; search results carry it too.

The resulting model is exactly the one the manifest already assumed: **one licence body per SPDX id**
(the detail screen) **plus a copyright line per component** (the lists). `openLicence(id, from)` now
takes an origin so back returns to `licence` or `licenceGroup` correctly.

### The manifest contract (what Phase B must emit)

```text
bundled[]  { name, version, spdx, kind (cs/en), copyright }   — the four non-npm components
groups[]   { spdx, count, components[ { name, version, copyright } ] }
texts      { [spdx]: full licence body }
total      number
```

`expandGroup()` in the design is mock synthesis (`_namePool` / `_holders` cycled to fill a count) — the
real screens read the manifest directly. Treat it as scaffolding, like the rest of the placeholder data.

### Mock data that must not be ported

The design's placeholder data is scaffolding, in the sense 009's notes warn about:

- `LIC_GROUPS` samples name packages this app does not use (`react-native-mmkv`, `date-fns`, `zustand`,
  `@react-native-firebase/app`) at versions it does not ship (`react-native 0.75.4`, `react 18.3.1`).
- `typescript` appears as a component — it is a devDependency and must never appear as distributed.
- `licTotal: '310'` is a placeholder. The measured figure is **174** (170 npm + 4 non-npm).
- Bundled versions (Public Sans 2.001, SQLCipher 4.5.6, OpenSSL 3.3.1) are plausible but unverified —
  read them from the actual files at port time.

Only the **structure** is authoritative. Every value comes from Phase B.

### A factual error in the design's FAQ copy — and in shipped copy

The design wrote real Czech answers, which is a genuine head start on Phase C. One is wrong in a way
that matters. Entry `a3` says attachments download only on explicit tap *because downloading the whole
message is legally treated as delivery*.

Per §17(3) of Act 300/2008 as stated in the Provozní řád ISDS, delivery is caused **exclusively by
fetching the received-message list** (`GetListOfReceivedMessages`). By the time a user sees an
attachment, delivery has already happened — at sync. Downloading changes nothing legally.

The same error is already in **shipped** copy: the download button's helper text reads *"Tím se zpráva
považuje za doručenou."* So this is a pre-existing defect the FAQ would have formalized and amplified.
FR-018 covers it; correcting the shipped string is in scope.

Everything else spot-checked as accurate: fikce at 10 days from *dodání*, the 90-day ISDS retention, the
`Dodáno`/`Doručeno` split, and czebox.

## Key technical decisions

### T1 — Generate the attribution manifest with a purpose-built script, not a licence checker

`license-checker` and friends read the npm tree and stop there. Rejected because the tree is not the
whole binary (T2), and because we need a prod/dev split, per-licence text dedupe, and hard failure on
unresolvable components (FR-013) that those tools treat as warnings.

Cost: a script to own. Benefit: no new dependency, and the one behaviour we actually need — failing
loudly — is the default rather than a flag.

### T1a — `npm ls --prod` is not what ships; the release bundle is

Discovered while building the generator, and it changes the numbers materially. `npm ls --prod --all`
reports **717** packages — but that includes `metro`, `typescript`, `react-devtools-core`, `fb-watchman`
and the rest of the toolchain, which `react-native` declares as production dependencies and which run on
a developer's machine, never on a device. Listing them would claim dev tooling as distributed software:
false, and exactly the error the design's placeholder data made by listing `typescript`.

The honest source is the release bundle itself. Metro's source map names every module it included, so
`npm run attributions:scan` bundles both platforms and takes the union: **170 packages**. That is the
distributed set.

Because bundling is slow, the module list is checked in (`scripts/bundled-modules.json`) together with a
fingerprint of `package.json`'s dependencies. The fast CI check compares that fingerprint, so a
dependency change fails the build with "rescan" rather than silently reusing a stale list.

### T2 — The npm tree is not the shipped binary; a supplement list is mandatory

This is the finding that shaped the whole approach. Verified against the installed tree:

| Component | Where it lives | Licence | Why a npm scan misses it |
|---|---|---|---|
| **SQLCipher** | `@op-engineering/op-sqlite/cpp/sqlcipher/` | BSD-3-Clause (Zetetic LLC) | Vendored **C source**, compiled into the binary. No `package.json`. |
| **OpenSSL** | linked by op-sqlite via prefab | Apache-2.0 (3.x) | Native prefab dependency, not an npm package. |
| **Public Sans** | `assets/fonts/` | SIL OFL-1.1 | Bundled font file; **ships today with no notice at all**. |
| **Bricolage Grotesque** | `assets/fonts/` | SIL OFL-1.1 | Same. |

SQLCipher's licence is explicit: *"Redistributions in binary form must reproduce the above copyright
notice … in the documentation and/or other materials provided with the distribution."* That is precisely
what the licence screen is for, and no npm-based tool would ever have surfaced it.

The supplement is therefore hand-maintained but tiny and CI-guarded: the generator asserts every declared
supplement path still exists, so a dependency bump that relocates or drops vendored source fails the
build rather than silently dropping an attribution.

### T3 — Manifest shape: per-component metadata + deduped licence texts

Storing the full text per component would mean 168 copies of the MIT text. Instead:

- **per component**: name, version, SPDX id, copyright line, and `distributed | build-only`
- **per SPDX id**: one full licence text

This is not merely a size optimization — it matches what the licences require. MIT and BSD demand *the
copyright notice* of each component (kept per-component) plus the licence terms (identical across them,
so stored once). Estimated ~50 KB against the 80 KB budget.

### T4 — FAQ content is a typed module, not flat i18n keys

`src/i18n/strings.ts` is a flat key→string map, which suits labels and suits multi-paragraph answers
badly. FAQ content goes in a dedicated typed module keyed by locale, so a missing translation is a
**type error** rather than a runtime fallback — which is what FR-006 actually demands. Labels and screen
chrome stay in `strings.ts` as usual.

### T5 — Screens follow the existing Settings sub-screen pattern

Pushed on the native stack with a back chevron, as Settings sub-screens already are. No new navigation
shape (spec Assumptions). The *visual* design of what sits inside them is Claude Design's to determine.

## Project Structure

### Documentation (this feature)

```text
specs/012-about-help-licences/
├── spec.md              # Phase -1 (done)
├── plan.md              # This file
├── design-prompts.md    # Claude Design prompts §0–§5 (all returned 2026-07-23)
└── tasks.md             # Phase 2 output
```

`research.md`, `data-model.md`, `quickstart.md`, and `contracts/` are deliberately **not** created.
Research findings are recorded inline as T1–T5 above; the data model is three small shapes already stated
in the spec's Key Entities; there is no API contract because the feature makes no call. Manufacturing
those files would produce exactly the write-after-the-fact fiction `specs/README.md` warns against.

### Source Code (repository root)

*Amended 2026-09-14: the "awaits design" markers are dropped, and the screens, routes and help entries
match what was built.*

```text
scripts/
└── gen-attributions.mjs          # NEW — walks the prod tree + supplements, emits the manifest

src/
├── content/
│   ├── faq.ts                    # NEW — typed FAQ entries, cs + en
│   └── attributions.generated.ts # NEW — generated; checked in; never hand-edited
├── app/settings/
│   ├── SettingsScreen.tsx        # EDIT — `O aplikaci` grows to a hub
│   ├── FaqScreen.tsx             # NEW
│   ├── LicencesScreen.tsx        # NEW
│   ├── LicenceGroupScreen.tsx    # NEW — §5: every component in one SPDX group
│   └── LicenceDetailScreen.tsx   # NEW
├── app/AppNavigator.tsx          # EDIT — four routes (Faq, Licences, LicenceGroup, LicenceDetail)
├── app/AppShell.tsx              # EDIT — pre-sign-in FAQ overlay (`withFaq`)
├── features/accounts/screens/
│   ├── Welcome.tsx               # EDIT — pre-sign-in help entry
│   └── AddBoxForm.tsx            # EDIT — pre-sign-in help entry
└── i18n/strings.ts               # EDIT — screen chrome, cs + en

__tests__/
├── content/faq.test.ts           # NEW — cs/en parity; no answer references a dead label
└── content/attributions.test.ts  # NEW — manifest completeness + supplement presence

LICENSE                           # NEW — MIT
package.json                      # EDIT — "license": "MIT" (keeps "private": true)
.github/workflows/ci.yml          # EDIT — attribution drift check
```

## Phasing

Ordered so that the design dependency blocks as little as possible.

**Phase A — Repo licensing (no dependencies).** `LICENSE`, `package.json`, copyright line. Independently
shippable and unblocks nothing else, but it is the decision that makes the rest coherent.

**Phase B — Attribution pipeline (no dependencies).** Generator, supplement list, manifest, tests, CI
check. Fully testable headless. This is the compliance fix; it can merge before any screen exists.

**Phase C — FAQ content (no dependencies).** Write and review the ~14 entries in cs + en. Content
authoring, reviewable as prose, independent of layout.

**Phase D — Design prompt → Claude Design.** Hand off `design-prompts.md`. **Async and external**; start
it at the same time as Phase A so it runs while B and C proceed.

**Phase E — Screens.** Blocked on D returning. Port the design as drawn, wire the content from B and C.

**Phase F — Verification.** On-device, both themes, both languages, large Dynamic Type, airplane mode,
fresh install.

Phases A–C carry the compliance and content value and are unblocked today. Only E waits on design.

## Complexity Tracking

| Added complexity | Why it is necessary | Simpler alternative rejected because |
|---|---|---|
| A hand-maintained supplement list beside a generated manifest | The components with the strictest binary-attribution requirements (SQLCipher, OpenSSL, both fonts) have no `package.json` to read | A purely generated list would be *silently* incomplete — the exact failure mode this feature exists to fix |
| A generator script rather than an existing tool | Needs prod/dev split, text dedupe, non-npm supplements, and hard failure | Off-the-shelf checkers warn where we need to fail, and cannot see vendored native source |
| A second content mechanism (typed module) alongside `strings.ts` | FR-006 requires a missing translation to be impossible, and long-form prose does not fit a flat key map | Flat keys would make a missing answer a runtime fallback rather than a compile error |

## Open questions

None. The copyright line was settled as `Copyright (c) 2026 The Obálka contributors` (see § "What the
design returned"; T001).
