# Tasks: A changelog, in the app and in every release

**Feature**: `029-changelog` | **Spec**: [spec.md](./spec.md)

No plan.md: the rules are Crake's (owner, 2026-10-13), the presentation the owner's choice (2026-11-10).

## Phase 1: The changelog and its rules

- [x] T001 `CHANGELOG.md` and `CHANGELOG.en.md`, with the first release's entry under "Unreleased".
- [x] T002 `scripts/changelog.mjs`: parse with errors that say file, line and fix; compare the languages;
  date "Unreleased"; render for GitHub, the stores and the app; `--check` in `npm run verify`
  (`npm run changelog:check`), `--generate` (`npm run changelog`).
- [x] T003 `src/content/changelog.generated.ts`, checked current by `--check` and a test.
- [x] T004 Tests: `__tests__/scripts/changelog.test.ts` (what it refuses, the two languages, dating, the
  published texts, the repository's own files, the kind names against the app's strings).

## Phase 2: Releasing

- [x] T005 `scripts/release.mjs` refuses an empty "Unreleased" or languages that disagree; dates both files
  and regenerates the app's copy in the release commit. Tests in `__tests__/scripts/release.test.ts`.
- [x] T006 `.github/workflows/release.yml`: verify refuses a tag without its section; the GitHub release's
  text is the section (no `--generate-notes`); Google Play gets `whatsNewDirectory` from `--short`.
- [x] T007 `tools/asc.py whatsnew <version>`: App Store "What's New" and TestFlight "What to Test", both
  languages, only differences sent, the first version's refusal reported.
- [x] T008 `docs/release-ci.md` › The changelog.

## Phase 3: In the app

- [x] T009 `src/app/whatsNew/whatsNew.ts`: the decision (fresh install, same, older, underneath only,
  newer) and the releases between.
- [x] T010 `WhatsNewSheet`, `ChangelogScreen`, `ReleaseChanges`; `BottomSheet` `footer`; Settings row and
  the `Changelog` route; strings in both languages.
- [x] T011 `AppShell`: decided once per launch on the home route after the diagnostics answer, written as
  seen, held while covered or while a notice is up. `whatsNew.seen` device-local.
- [x] T012 Tests: `__tests__/app/whatsNew.test.tsx` (decision, sheet, screen) and
  `__tests__/app/whatsNewShell.test.tsx` (the real shell: after the question, once, written as seen).
- [ ] T013 Walked on a phone: install a build of one version, then a newer one over it; the sheet comes up
  once, in both languages, and Settings → Co je nového lists both. Needs two releases with sections.
- [ ] T014 The first real release: the GitHub release's text, Google Play's notes and `asc.py whatsnew`
  checked where they land.
