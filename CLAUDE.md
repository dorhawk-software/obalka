<!-- SPECKIT START -->
Project principles: `.specify/memory/constitution.md`. Feature status and what is still open:
`specs/README.md`, the single index - its table is counted from each feature's own `tasks.md`, or its `spec.md` Status line where a
feature has no `tasks.md`; do not trust a status that contradicts the code. Stack, structure and commands: `README.md` and the
`package.json` scripts (`npm run verify` runs every CI check except the secret scan, which is `npm run audit:secrets` and
needs Trivy).
<!-- SPECKIT END -->

## Rules

In this order: the constitution, then this file, then the shared practices below (constitution 3.1.0).
Everything outside the SPECKIT markers is written by hand; `speckit-plan` rewrites only what is between them.

The design system (text roles, spacing scale, radius steps, theme colours, `Card`) is enforced by the
`obalka/*` lint rules in `npm run lint`; every finding says how to fix it from the theme. Fix the finding -
or, when the design really has a new role or step, add it to the theme and DESIGN.md - never disable the
rule to get past it (spec 028).

Never include Claude session information anywhere in the project, not even the comments and commits.

## Git (owner)

- Commit as the identity in this repository's git config. Normal history on `main` since 2026-11-10: no
  force-push without asking.
- A yes to commit includes the push (2026-11-11).
- Subject: the outcome; body: why, with numbers. The message ends with the `Co-Authored-By` trailer and
  nothing after it: the name-and-address sign-off is dropped, the author field carries it (2026-11-12).

## Words and design (owner)

- Public texts speak in the app's or the project's voice ("Aplikace…", "the developers"), never "I"; only
  the GDPR controller line names a person (2026-09-24).
- Design values come from the design's source (the Claude Design file), never from a screenshot; the code
  follows the design (2026-07-14).
- A value off the scale rounds to the nearest step without asking (spacing 7→8, 9→10, 20→18; radius
  4→8), and text that matches no type role takes the nearest role unless that breaks the hierarchy; no
  new roles. Each rounding is listed in its commit (2026-11-12).

## Practices (github.com/dorhawk-software/practices, adopted 2026-11-12)

Every shared rule, a line each (the detail is in .practices/docs/; the practices-* skills walk through UI
design, tests, commits and releases):
@.practices/rules.md

This project's own settings:
- The gate: `.practices/bin/lint` - tsc, then `lint`, `changelog:check` and `attributions:check`
  (`.practices/config`), the size limit and the secret scan (`.practices/lint.d/50-secrets`, Trivy with
  a canary). Pre-commit runs it and `npm test` when JS/TS files are committed; so does the Claude Code
  hook after `npm test`, `npx jest` and the like. `npm ci` installs the hooks (`prepare`).
- Files past 700 lines are in `.practices/size-allowlist`, which only shrinks.
- `npm run release` builds both apps on this Mac before the tag (`scripts/verify-native.sh`, 2026-11-12).
- What is decided "not now": docs/engineering/not-now.md, in the same commit.
