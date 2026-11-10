# Feature Specification: A changelog, in the app and in every release

**Feature Branch**: `029-changelog`
**Created**: 2026-11-10
**Status**: Built 2026-11-10 (see `tasks.md`); not yet through a real release.
**Input**: Owner, 2026-11-10, before the first TestFlight build: *"please see crake how when a release is
made it also publishes github release with a changelog, also the appication must include a changelog and
whats new when a person updates, this is absolutely vital"*, and: *"the whats new must be in both english
and czech, so that is another complication, unlike crake"*. Asked how the app should tell the person, the
owner chose a sheet shown once after an update.

## Why

A release today publishes a GitHub release whose text is GitHub's generated list of commits, and
nothing in the app says what changed. Commits are written for developers. The people using Obálka get
a new version from the store with no word about it.

Crake (the owner's VPN client) solved this, decided with the owner on 2026-10-13: a `CHANGELOG.md`
written by hand for users, an entry per user-facing change under "Unreleased" in the same commit, a
release script that refuses an empty "Unreleased", and that one section becoming the GitHub release and
the app's built-in What's new. Obálka takes the same rules, with one addition Crake does not have: every
word exists in Czech and in English, and the two must never say different things.

## User Scenarios & Testing

### User Story 1 - Told what changed after an update (Priority: P1)

1. **Given** a phone that last ran 0.1.0 opens 0.3.0, **When** the inbox is up (after the lock, a first
   box and the diagnostics question), **Then** a bottom sheet "Co je nového ve verzi 0.3.0" says "Od verze
   0.1.0, kterou jste měli: N změn" and lists the changes of 0.2.0 and 0.3.0, each release under its
   heading, each kind (Nové, Lepší, Změněno, Opraveno, Pod kapotou) as a section, each change its point
   and the explanation under it. "Pokračovat" closes it.
2. It is shown once: the next launch of 0.3.0 says nothing.
3. A fresh install, and a phone a transfer or restore has just filled, says nothing: that person never
   had an older Obálka on this phone.
4. An update whose changes are all "Pod kapotou" interrupts nobody.
5. The sheet is in the app's language, and follows it if the language changes.

### User Story 2 - Every release, any time (Priority: P1)

1. Settings → O aplikaci → "Co je nového", under the version row, lists every released version newest
   first, in the app's language. Before the first release it says there is none yet.

### User Story 3 - The same words in every place a release is published (Priority: P1)

1. The GitHub release's text is the version's section, Czech then English.
2. Google Play's release notes are the section's points, per language, within 500 characters.
3. `tools/asc.py whatsnew <version>` sets the App Store's "What's New" and TestFlight's "What to Test" in
   both languages.

### User Story 4 - A release cannot go out undescribed (Priority: P1)

1. `npm run release` refuses when "Unreleased" is empty in either file, or the two languages disagree.
2. The release workflow refuses a tag whose version has no section.
3. `npm run verify` fails when the files are malformed, disagree, or the app's copy is stale.

## Requirements

- **FR-001** `CHANGELOG.md` (Czech) and `CHANGELOG.en.md` (English), the README/PRIVACY split. `## Unreleased`
  heads each; a release is `## X.Y.Z (YYYY-MM-DD)`, newest first; kinds `###` from the fixed list in its
  fixed order; an entry is `- **Point.** Explanation.` (continuation lines indented).
- **FR-002** The two files hold the same releases, dates, kinds and number of entries per kind.
- **FR-003** `scripts/changelog.mjs` is the one implementation: parse, compare, date, and render for
  GitHub (Markdown), the stores (plain text; `--short` = points only) and the app
  (`src/content/changelog.generated.ts`, released versions only, both languages).
- **FR-004** The version last shown is the setting `whatsNew.seen`, device-local (`DEVICE_LOCAL_SETTINGS`):
  it records what this phone showed. It is written when the sheet is decided on, so a launch that ends with
  it open does not show it again; the same text stays in Settings.
- **FR-005** The sheet waits behind the lock, the diagnostics question and any notice dialog, and is held
  (not closed) while the app is covered.
- **FR-006** The sheet and the screen use the settings furniture (`Section`, `Card`, `RowTitle`) and the
  shared `BottomSheet`, which gains a pinned `footer`; the close button is the shared `ContinueButton`.
- **FR-007** Nothing is fetched: the text is built into the app.

## Out of scope

- Fetching release notes from the network, or announcing a version the store has not installed yet.
- Generating entries from commits.
