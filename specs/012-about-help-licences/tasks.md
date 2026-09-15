---
description: "Task list — About & Help: FAQ and licences (012)"
---

# Tasks: About & Help — FAQ and licences

**Input**: `specs/012-about-help-licences/` — spec.md, plan.md, design-prompts.md
**Branch**: `012-about-help-licences`
**Tests**: Real but narrow — content parity (cs/en), manifest completeness, and a CI drift gate. There is
no new runtime logic to TDD; the failure modes worth guarding are *missing content* and *stale
attributions*, and both are checkable headless.

User stories (spec.md): **US1** understand what the app is telling me (P1) · **US2** ship legally, and
prove it (P2) · **US3** find help before I can sign in (P3).

## Format: `[ID] [P?] [Story?] Description with file path`

- **[P]** = parallelizable (different files, no incomplete deps). Story label only on user-story phases.
- 🎨 = **blocked on Claude Design** returning the screens (see `design-prompts.md`).

---

## Phase A: Repo licensing

Independent of everything else. Settles the decision the rest of the feature reports.

- [X] T001 Root `LICENSE` added — MIT, `Copyright (c) 2026 The Obálka contributors` (the wording the design settled on: contributors rather than a personal name, which stays correct once anyone else contributes). Built from `assets/licenses/MIT.txt` so the repo licence and the text the app displays are byte-identical below the notice.
- [X] T002 `"license": "MIT"` set in `package.json`; `"private": true` kept so the app can never be published to npm.
- [X] T003 `README.md` gained a Licence section: the licence and holder, why MIT over GPL, where the in-app third-party list lives, and how it is generated and CI-checked.

**Checkpoint:** ✅ **Phase A complete.** The project's licence status is defined and discoverable.

---

## Phase B: Attribution pipeline (US2)

Fully headless and testable. This is the compliance fix; it can merge with no screen in place.

- [X] T004 [US2] Wrote `scripts/gen-attributions.mjs`. Resolves each package's SPDX id and copyright, reading the LICENSE file where `package.json` omits the field, and **exits non-zero** on anything unresolvable (FR-013) — verified by the residue it refused to emit until every case was resolved.
- [X] T005 [US2] Non-npm supplement added, and it now **reads the facts from the artefacts** rather than hardcoding them: font copyright + version from the TTF `name` table, SQLCipher's notice from its vendored `LICENSE.txt` and version from `CIPHER_VERSION_NUMBER`, OpenSSL's version from op-sqlite's `build.gradle`. Every entry asserts its path.
- [X] T006 [US2] Emits `src/content/attributions.generated.ts` — 174 components (170 npm + 4 bundled), 3 licence groups, licence bodies deduped per SPDX under `assets/licenses/`.
- [X] T007 [US2] Budget verified: **37.5 KB** against the 80 KB ceiling, and the generator now fails if it is ever exceeded.
- [X] T008 [US2] `__tests__/content/attributions.test.ts` — 11 cases covering copyright presence, text-behind-every-identifier, group counts, the four non-npm components, and that no build-time tooling is claimed as shipped.
- [X] T009 [US2] `npm run attributions` / `:scan` / `:check` added; the check wired into `.github/workflows/ci.yml`.
- [X] T010 [US2] Proved it: adding a dependency makes `attributions:check` exit 1 naming the staleness; removing it returns to exit 0.

**Checkpoint:** ✅ **Phase B complete.** The app is licence-compliant in data and cannot silently regress. Nothing user-visible yet.

> **Finding that reshaped this phase:** `npm ls --prod` reports **717** packages, including metro,
> typescript and react-devtools-core — dev tooling `react-native` declares as production deps that never
> reach a device. The shipped set comes from the release bundle's own source map instead: **170**
> packages. See `plan.md` T1a.

---

## Phase C: FAQ content (US1)

Prose work, reviewable independently of layout.

- [X] T011 [US1] `src/content/faq.ts` — entries keyed by `FaqId` as `Record<FaqId, FaqText>` per locale, so a missing translation is a **compile error** rather than a runtime fallback (FR-006). Answers are paragraph arrays; the screen never has to split prose.
- [X] T012 [US1] **Aplikace** answers written in cs + en: adding/switching boxes, sign-in methods, re-authentication, attachments, the local archive.
- [X] T013 [US1] **Datové schránky** answers written in cs + en: `Dodáno` vs `Doručeno`, fikce (10 days from dodání, §17/4), the 90-day retention, and the test environment. Each load-bearing claim cites its source in a code comment (FR-018).
- [X] T013a [US1] Corrected. The answer no longer claims downloading causes delivery, and cross-references `deliveredVsServed` instead. **The same error was fixed in shipped copy** — `detail.attachments.downloadFullNote` in cs *and* en both said so. `deliveredVsServed` now states plainly that signing in and fetching the list is what serves a message, so opening the app delivers what was waiting (002 FR-017).
- [X] T013b [US1] Sign-in methods answer written, keeping the two reasons distinct: offered (password / SMS code / Mobilní klíč), and never exposed to third-party apps (Identita občana, Bankovní identita, mojeID) — with whose limitation it is stated explicitly.
- [X] T014 [US1] Disclaimer written in cs + en, scoped to the ISDS group as the design places it.
- [X] T015 [US1] Reviewed against Constitution VI. **Three of the design's claims were wrong and were corrected:** add-box is not in Settings (switcher only); the archive answer promised backup, which is feature 006 and not built; and the delivery-trigger claim above. Verified against code that the fikce countdown ships (`computeFikce`/`fikceLabel`), that the test banner is message-detail only (`TestEnvBanner`), and — contrary to a stale note — that `ReauthForm` **does** support `mobile_key`, so the re-auth answer's "pick a different method" is true.
- [X] T016 [US1] `__tests__/content/faq.test.ts` — 11 cases. Beyond parity and placeholders, it **pins the claims we got wrong** so they cannot return: no download-causes-delivery, no backup promise, no add-box-in-Settings, plus the named sign-in methods and the 10-day/90-day figures.

**Checkpoint:** ✅ **Phase C complete.** The content exists, every ISDS claim is sourced, and three
factual errors in the design's draft copy were corrected — one of which was also live in the shipped app.

---

## Phase D: Design hand-off 🎨

Start this at the same time as Phase A — it runs externally while B and C proceed.

- [X] T017 Sent `design-prompts.md` §0 + §1–§4 to Claude Design (project `2c15c7b1-3690-44ff-b610-4ea7620bdb6a`).
- [X] T018 Pulled the updated `Obalka Redesign.dc.html` via DesignSync and diffed it against the local reference (+50 064 chars, 8 hunks). All four screens landed.
- [X] T019 Recorded the three delegated decisions and the mock-data caveats in `plan.md` § "What the design returned".
- [X] T019a Sent §5 (full enumeration + per-component copyright lines).
- [X] T019b Pulled and diffed (+5 829 chars). Both gaps closed: a new `licenceGroup` screen lists every component in an SPDX group, and a copyright line now appears on every component row. Contract recorded in `plan.md` § "The manifest contract".

**Checkpoint:** design is complete and diffed. **All of Phase E is unblocked.**

---

## Phase E: Screens (design landed — port as drawn, invent nothing)

Every metric below is read from the design source, not from a screenshot.

- [X] T020 `O aplikaci` is now one card of four hairline-separated rows — `Verze` (value), `Časté dotazy`, `Licence` (chevrons) and `Zdrojový kód` (repo label + external-link mark). Verified on device.
- [X] T021 `FaqScreen.tsx` — accordion of cards, 15/700 questions with a fixed 22×22 `+`/`−` chip so the swap cannot change row height, answers 14/400 lh 20. Disclaimer under the **Datové schránky** header only, as drawn.
- [X] T022 `LicencesScreen.tsx` — app-licence card (logo, MIT, copyright, full body), search, `Vestavěné komponenty`, then groups by SPDX with counts and samples.
- [X] T022a `LicenceGroupScreen.tsx` — the full-enumeration screen: a link to the licence text above **every** component in the group, each with name, copyright and version.
- [X] T023 `LicenceDetailScreen.tsx` — the licence body verbatim, scrolling to its end. Line breaks are the source file's own (the design's `pre-wrap`); re-wrapping would alter the text.
- [X] T023a Per-component copyright rendered everywhere a component appears — bundled rows, group rows and search results. Confirmed on device: Public Sans, Bricolage, SQLCipher and OpenSSL all show their real notices.
- [X] T024 Four routes registered in `AppNavigator`. The pre-sign-in FAQ was first built as an `AppShell` route; the device walk showed that wiped the form and lost hardware back, so it is now an overlay over the live Welcome/add-box screen (`withFaq` in `AppShell.tsx`, wrapped in `EdgeSwipeBack`) — see `plan.md` and T035.
- [X] T025 Strings added in cs + en, including `© 2026 Přispěvatelé projektu Obálka` / `© 2026 The Obálka contributors`. **Also deleted `login.federatedUnavailable`** — unreferenced since Mobile Key shipped, and factually wrong (it listed Mobilní klíč as unavailable).
- [X] T026 Both entries the design drew: the bottom-centred help button on `Welcome`, and one at the end of the credentials form's scroll — below the fields, never between them and the action.
- [X] T027 `Zdrojový kód` hands the URL to the OS browser via `Linking.openURL`. A failure is inert rather than surfacing an error the user cannot act on.

**Checkpoint:** ✅ **Phase E complete.** All three user stories are reachable, and all four screens were
walked on device in both themes. Only Phase F (the systematic verification pass) remains.

---

## Phase F: Verification

- [X] T028 Full gate green: tsc 0, eslint 0 errors, 327 tests, `attributions:check` clean.
- [X] T029 Both themes walked on device across all four screens. The longest text — Apache-2.0, ~11 KB — scrolls to its end with `END OF TERMS`, `APPENDIX` and the specimen `Copyright [yyyy]` line all present, confirming the leading-copyright strip did not damage it.
- [X] T030 Both languages verified on device; switching to English re-renders every question, answer and the disclaimer with no untranslated entry.
- [X] T031 1.5× font scale: questions wrap, answers reflow, the +/− chip stays put. Measured 26.3dp per line — Android grows the line box to the font's natural leading rather than clipping against our explicit `lineHeight`.
- [X] T032 Verified structurally: no `fetch`/XHR/WebSocket/blob-util reference in any of the four screens or the content module; the only outbound call in the area is `Linking.openURL` for the repository row. **Not** verified by literal airplane mode — a debug build loads its JS from Metro over the network, so airplane mode kills the harness, not the feature. A release build would exercise it end to end.
- [X] T033 Measured: expanding the third FAQ entry left `APLIKACE` and all three questions above it at byte-identical bounds. Nothing above the tapped row moves.
- [X] T034 Screen-reader exposure checked via uiautomator: the back button carries `content-desc="Back"`, and each FAQ row is an `android.widget.Button` announcing the question plus its `+`/`−` state.
- [X] T035 Re-run and recorded in `plan.md`, including **the one deviation the port forced** — the pre-sign-in FAQ had to become an overlay rather than a route.
- [X] T036 `specs/README.md` updated and `CLAUDE.md`'s active-feature pointer moved to 012.

---

## Dependencies

```text
Phase A ─┐
Phase B ─┼─→ (independent, mergeable today)
Phase C ─┘
Phase D ✅ (§1–§5 designed + diffed) ──→ Phase E ──→ Phase F
Phase A/B/C ─────────────────────────────┘
```

- **Nothing is blocked on design any more.** E needs B and C for its data and copy.
- T013a corrects copy that is **already shipped**, so it has value independent of this feature.
- Within B: T004 → T005 → T006 → T007; T008 needs T006; T009 needs T006; T010 needs T009.
- Within C: T011 → T012/T013 (parallel) → T014 → T015; T016 needs T011.
- Within E: T020–T024 need T018; T021 needs T011; T022/T023 need T006.

## Notes

- **Do not invent screen layout.** Every 🎨 task ports what Claude Design returns. If the design omits a
  case the spec requires, extend `design-prompts.md` and go back to the design rather than filling the
  gap in code.
- `src/content/attributions.generated.ts` is generated. Edits belong in `scripts/gen-attributions.mjs`.
- Licence texts are reproduced **verbatim**. Never reflow, re-wrap, summarize, or "clean up" a licence.
