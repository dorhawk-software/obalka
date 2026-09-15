# Feature Specification: About & Help — FAQ and licences

**Feature Branch**: `012-about-help-licences`
**Created**: 2026-07-23
**Status**: Implemented (42/42).
**Input**: User description: "on top of the features not yet built we should also add FAQ and license
sections, run it through speckit"

## Problem / Why

Two gaps, one surface.

**1. The app never explains itself, or its domain.** Settings has an `O aplikaci` section containing a
single row — the version number. There is no help anywhere in the app. Meanwhile the app now *displays*
domain concepts it never defines: a sent message reads `Dodáno` in one place and `Doručeno` in another
(two legally distinct ISDS states), 010 will show a delivery-fiction countdown, and ISDS deletes message
contents after 90 days while the local archive keeps them. A user who does not already know ISDS cannot
tell whether any of that is the app misbehaving or the system working as designed. This is the single
most likely source of "the app is broken" reports for behaviour that is correct.

**2. The app is not licence-compliant, and has no licence of its own.** It bundles 26 direct runtime
dependencies (883 MIT / 61 ISC / 28 BSD-3-Clause / 22 Apache-2.0 / 21 BSD-2-Clause across the resolved
tree) whose licences require their copyright notice to travel with the distributed binary. It also
bundles eight font files — **Public Sans** and **Bricolage Grotesque**, both SIL OFL-1.1 — with **no
licence text shipped at all**, which is a straightforward violation of OFL-1.1's notice requirement.
Separately the project itself has no `LICENSE` file and no `license` field, so its status is legally
undefined; the decision (2026-07-23) is to publish it as open source under **MIT**.

Both gaps land in the same place — the `O aplikaci` section — and share one delivery mechanism: static,
bundled, offline, localized long-form content. Hence one feature, not two.

## Clarifications

### Session 2026-07-23

- Q: What licence does the app itself ship under? → A: **MIT**. Chosen over GPL-3.0 because App Store
  terms conflict with GPL's "no further restrictions" clause; keeping a store exception grantable would
  require a CLA from every future contributor, and copyleft would protect the codebase — the least
  durable asset here — rather than the brand, the design system, or the ISDS maintenance.
- Q: How far should the FAQ go beyond the app itself? → A: **App how-to AND ISDS basics**, with an
  explicit "informative only, not legal advice" disclaimer. The domain questions are the ones users are
  actually stuck on; answering only the app's own mechanics would miss the point.
- Q: (derived) One feature or two? → A: **One.** FAQ and licences share the `O aplikaci` hub, the same
  navigation pattern, and the same bundled-static-content rendering. Splitting them would duplicate all
  three.
- Q: (derived) Is help reachable before sign-in? → A: **Yes.** The hardest question ("where do I get my
  ISDS credentials?") is asked by someone who cannot sign in, so gating help behind sign-in fails exactly
  the user who needs it.
- Q: (derived) Are third-party notices hand-written or generated? → A: **Generated** from the resolved
  dependency tree, checked in as a build artifact, with CI failing when it drifts from `package.json`.
  A hand-maintained list silently rots and re-creates the compliance gap.
- Q: (derived) Do these screens exist in the reference design? → A: **Not at spec time.** They were
  designed and imported on 2026-07-23 — see `plan.md` § "What the design returned".
- Q: Should the FAQ explain why some sign-in methods are unavailable? → A: **Yes** (FR-017), and it must
  separate *never exposed to third parties* (NIA / BankID / mojeID) from *offered today* (password,
  SMS code, Mobilní klíč). Collapsing these into "not supported" would
  read as an app failing rather than the platform's constraint.

## Scope

**In scope:**

- **`O aplikaci` hub** — the existing Settings section grows from one row to a small set: `Verze`,
  `Časté dotazy`, `Licence`, `Zdrojový kód` (repository link).
- **FAQ screen** — two groups (`Aplikace`, `Datové schránky`), each an expand/collapse question, plus a
  standing disclaimer. Content bundled with the app; no network.
- **Pre-sign-in help entry** — the FAQ is reachable from the Welcome / sign-in screens.
- **Licence screen** — the app's own MIT licence, then the third-party notice list (name, version,
  licence identifier) drilling into each full licence text, including the two OFL-1.1 fonts.
- **Generated attribution manifest** + a CI check that fails when dependencies change without it being
  regenerated.
- **Repository licensing** — `LICENSE` (MIT) at the repo root and `"license": "MIT"` in `package.json`.
  `"private": true` stays, to keep the app from being publishable to npm.
- **Localization** — every string and every FAQ answer in **cs + en** (Principle V, Czech-first).
- **Design prompt** — a Claude Design prompt for both new screens, so the reference stays authoritative.

**Out of scope:**

- A contact / support form or any "email us" round-trip that implies a backend (Principle III).
- Remotely-updatable or fetched FAQ content — it ships with the binary and works fully offline.
- A privacy policy or terms-of-service *document*. Both stores require a privacy policy **URL** on the
  listing; that is a store-listing artifact tracked with ASO work (`docs/aso.md`), not an app screen.
  The FAQ may state the app's privacy posture in plain language and must not be mistaken for the policy.
- Legal advice of any kind, or any statement that a user's specific message has or has not been legally
  delivered. The FAQ explains what the states *mean*; it never adjudicates a case.
- Re-litigating the licence choice; MIT is decided (see Clarifications).

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Understand what the app is telling me (Priority: P1)

A user sees a sent message listed as `Dodáno` while its detail timeline shows `Doručeno` reached, or sees
a fikce countdown, and cannot tell whether the app is wrong. They open `Nastavení → O aplikaci → Časté
dotazy`, find the question under `Datové schránky`, and read that these are two distinct ISDS states with
different legal weight.

**Why this priority**: This is the whole reason a help section earns its place. It converts "the app is
buggy" into "the system works this way", on the concepts this app uniquely surfaces. It is also the only
story that delivers value on its own — shipped alone, the app is more usable.

**Independent Test**: Fresh install, device in airplane mode, never signed in. Open Settings → Časté
dotazy, expand any question in both groups, read a complete answer. No network, no account.

**Acceptance Scenarios**:

1. **Given** a device with no network, **When** the user opens the FAQ, **Then** every question and
   answer renders in full from bundled content.
2. **Given** the FAQ is open, **When** the user taps a question, **Then** its answer expands and no
   content above the tapped row moves.
3. **Given** the device language is English, **When** the user opens the FAQ, **Then** every question and
   answer is in English, with no untranslated or missing entries.
4. **Given** any FAQ screen, **When** the user reads it, **Then** the "informative only, not legal
   advice" disclaimer is visible without hunting for it.

---

### User Story 2 — Ship legally, and prove it (Priority: P2)

A store reviewer, a security-minded user, or the maintainer needs to see what the app is built from and
under what terms it is offered. They open `Nastavení → O aplikaci → Licence` and find the app's MIT
licence followed by every bundled component with its licence and full text.

**Why this priority**: It closes a real compliance gap — the OFL-1.1 fonts currently ship with no notice
at all — and it is a prerequisite for store submission. It ranks below P1 only because it protects the
project rather than helping the user do something.

**Independent Test**: Open the licence screen offline; confirm the app's own MIT text is present, that
both bundled font families appear with OFL-1.1 text, and that the component count matches the generated
manifest.

**Acceptance Scenarios**:

1. **Given** the licence screen, **When** it opens, **Then** the app's own MIT licence and copyright line
   appear before the third-party list.
2. **Given** the third-party list, **When** the user selects any entry, **Then** that component's full,
   unmodified licence text is shown and is scrollable to its end.
3. **Given** both bundled font families, **When** the user looks for them, **Then** each appears with its
   OFL-1.1 notice.
4. **Given** a dependency is added, removed, or version-bumped, **When** CI runs without the manifest
   being regenerated, **Then** the build fails with a message naming the drift.

---

### User Story 3 — Find help before I can sign in (Priority: P3)

Someone installs the app, reaches the sign-in screen, and does not know where ISDS credentials come from
or that a Mobile Key option exists. They open help directly from that screen.

**Why this priority**: Real, and the worst moment to be stuck — but it serves a narrower slice than P1,
and depends on the FAQ existing first.

**Independent Test**: Fresh install, never signed in. From Welcome / sign-in, reach the FAQ and return to
exactly the screen you left, with any entered field values intact.

**Acceptance Scenarios**:

1. **Given** the sign-in screen with a partly filled form, **When** the user opens help and returns,
   **Then** the form is as they left it.
2. **Given** no box has been added, **When** the FAQ opens, **Then** no answer assumes an existing box or
   references a screen the user cannot reach.

---

### Edge Cases

- **Long licence texts.** Apache-2.0 and OFL-1.1 run to thousands of words. Text must scroll to its end,
  never truncate, and never be summarized — a paraphrased licence is not the licence.
- **Expansion is not a layout jump.** Principle V forbids content shifting when *transient/async* UI
  appears. A user tapping a question is a deliberate action, so expansion is legitimate — but content
  *above* the tapped row must not move, and no spinner or async element may reflow the list.
- **Dynamic Type at large sizes.** These are the app's longest text blocks; they must reflow rather than
  clip or overlap.
- **A dependency with no licence field.** `tamagui` and `@tamagui/config` declare none in
  `package.json` but ship an MIT `LICENSE` file. Generation must read the file, and must fail loudly on a
  component it genuinely cannot resolve rather than silently omitting it.
- **Answers going stale.** FAQ answers describe app behaviour that changes. An answer that names a screen
  or label which no longer exists is worse than no answer.
- **Locale switch while reading.** Changing language in Settings re-renders open content in the new
  language without losing the user's place in the section.
- **Dark mode.** Long-form text is where low contrast is most punishing (Principle V, no black-on-black).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The `O aplikaci` section MUST offer, at minimum: app version, FAQ, licences, and a link to
  the public source repository.
- **FR-002**: The FAQ MUST group entries into app-usage questions and ISDS-domain questions, and MUST be
  navigable without reading every answer.
- **FR-003**: The FAQ MUST cover at least: adding and switching boxes; why re-authentication is required;
  where downloaded attachments go; what the local archive keeps; **which sign-in methods are offered and
  why others are not** (FR-017); `Dodáno` vs `Doručeno`; delivery fiction (fikce doručení); ISDS's
  90-day deletion; and the test-vs-production environment distinction.
- **FR-004**: The FAQ MUST display a persistent notice that its contents are informative only and are not
  legal advice, and MUST NOT state whether any specific message was legally delivered.
- **FR-005**: All FAQ and licence content MUST be bundled with the app and fully readable offline.
- **FR-006**: All content MUST exist in Czech and English, with Czech primary; no entry may fall back to
  an untranslated string.
- **FR-007**: The FAQ MUST be reachable both from Settings and from the pre-sign-in screens, and
  returning MUST restore the originating screen's state.
- **FR-008**: The licence screen MUST show the app's own licence (MIT) together with its copyright line.
- **FR-009**: The licence screen MUST list every third-party component distributed in the app binary,
  with name, version, and licence identifier, and MUST make each component's full unmodified licence text
  reachable.
- **FR-010**: The bundled font families MUST appear in that list with their OFL-1.1 notices.
- **FR-011**: The third-party list MUST be generated from the resolved dependency tree rather than
  hand-maintained, and MUST distinguish components shipped in the binary from build-time-only tooling.
- **FR-012**: CI MUST fail when the checked-in attribution manifest no longer matches the dependency
  tree, and MUST name what drifted.
- **FR-013**: Generation MUST fail loudly on any component whose licence cannot be resolved, rather than
  omitting it.
- **FR-014**: The repository MUST carry a root `LICENSE` file (MIT) and declare `"license": "MIT"`, while
  remaining `"private": true`.
- **FR-015**: Both new screens MUST follow the ui-guide scale — no hand-tuned per-screen metrics
  (Principle V) — and MUST render correctly in both themes and at large Dynamic Type sizes.
- **FR-016**: Neither screen may make a network request.
- **FR-017**: The FAQ MUST explain **which sign-in methods the app offers and why others are absent**,
  distinguishing the three reasons — which are genuinely different and must not be blurred into "not
  supported":
  - **Offered today**: name + password; name + password + SMS code; **Mobilní klíč** (built and
    live-validated 2026-06-19 — so the app must *not* repeat the outdated claim that ISDS exposes no
    third-party federated sign-in).
  - **Not exposed to third-party apps**: Identita občana (NIA), BankID, mojeID — portal sign-in methods
    with no public API for third-party clients. Per Constitution VI these are described as unavailable
    rather than shipped half-broken, and the answer must not promise them.
- **FR-018**: Every factual claim about ISDS behaviour in the FAQ MUST be traceable to the Provozní řád
  ISDS or the ISDS developer bulletins (`docs/isds-ws-news/`), not to recollection. Where existing
  in-app copy contradicts that source, **the existing copy is the defect** and is corrected as part of
  this feature.

### Key Entities

- **FAQ entry**: a stable identifier, a group (app / domain), a question, and an answer body, each
  present in every supported language. Ordered within its group.
- **Licence notice**: a component name, version, licence identifier, full licence text, and whether the
  component is distributed in the binary or is build-time-only.
- **Attribution manifest**: the generated, checked-in collection of licence notices that the licence
  screen renders and CI validates.

## Success Criteria *(mandatory)*

- **SC-001**: A user who has never used ISDS can explain the difference between `Dodáno` and `Doručeno`
  after reading one FAQ answer, without leaving the app.
- **SC-002**: Every question in FR-003 is answerable from the FAQ in at most two taps from Settings.
- **SC-003**: The FAQ and licence screens are fully readable with the device in airplane mode, from a
  fresh install, with no box added.
- **SC-004**: 100% of components distributed in the app binary appear in the licence screen with their
  full licence text — verified by comparing the rendered list against the resolved dependency tree.
- **SC-005**: Adding or removing a dependency without regenerating the manifest fails CI.
- **SC-006**: Both screens pass the same theme, Dynamic Type, and screen-reader checks as the rest of the
  app, in cs and en.
- **SC-007**: No FAQ answer references a screen, label, or state that does not exist in the shipped
  build.

## Decisions (resolved 2026-07-23)

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | App ships under **MIT** | GPL conflicts with App Store terms; a store exception would need a CLA from every contributor. Copyleft would protect the code, not the brand/design/maintenance that actually differentiate this app. |
| D2 | FAQ covers **app + ISDS domain**, with a disclaimer | Domain confusion is what actually blocks users; app-only help would omit the questions that matter. |
| D3 | **One** feature, not two | Shared hub, navigation pattern, and static-content rendering. |
| D4 | Help reachable **before sign-in** | The credential question is asked by someone who cannot sign in. |
| D5 | Attributions **generated**, CI-verified | A hand-maintained list rots and re-opens the compliance gap. |
| D6 | Content **bundled**, never fetched | Principle III (no backend of ours) and offline-first. |
| D7 | Both screens need a **design prompt** first | Neither exists in `Obalka Redesign.dc.html`; the design is source of truth (009 workflow). |

## Relationship to other features

- **007 (Appearance, settings & localization)** — owns the Settings screen and the cs/en machinery this
  feature extends; `O aplikaci` already exists there.
- **009 (Visual redesign)** — supplies the ui-guide scale both screens must use, and the design-prompt
  workflow for screens the reference does not yet draw.
- **010 (Deadlines & attention)** — its planned received-side fikce countdown was dropped; the countdown
  that ships is 013's, on sent messages, which the `fiction` answer explains. 010 shipped reminders and
  the attachment scan, covered by the `attachmentScan` entry. *(Amended 2026-09-14.)*
- **Constitution III** — forbids the contact-form/backend shape this feature deliberately excludes.
- **Constitution V** — governs the metrics, theming, Dynamic Type, and layout-stability requirements.
- **Constitution VI (Honest scope)** — the FAQ must describe only what the app actually does today; it is
  a place where over-claiming would be easy and is explicitly forbidden.

## Assumptions

- Users read Czech or English; no third language is in scope.
- The repository will be public before or at the same time as the first store submission, so FR-001's
  source link resolves.
- The maintainer is the sole copyright holder today, which is what makes the MIT relicensing decision
  unilateral and clean.
- ISDS domain answers describe the system's documented behaviour and remain accurate across ISDS web
  service revisions; `docs/isds-ws-news/` is the tripwire for that assumption.
- The existing Settings navigation pattern (pushed sub-screen with a back chevron) is reused rather than
  a new navigation shape being introduced.
