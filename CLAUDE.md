<!-- SPECKIT START -->
Project principles: `.specify/memory/constitution.md`. Feature status and what is still open:
`specs/README.md`, the single index - its table is counted from each feature's own `tasks.md`, or its `spec.md` Status line where a
feature has no `tasks.md`; do not trust a status that contradicts the code. Stack, structure and commands: `README.md` and the
`package.json` scripts (`npm run verify` runs every CI check except the secret scan, which is `npm run audit:secrets` and
needs Trivy).
<!-- SPECKIT END -->

After any UI change run `npm run lint:design`: the design system (text roles, spacing scale, radius steps,
theme colours, `Card`) is enforced as lint rules, and every finding says how to fix it from the theme. Fix
the finding; never raise `design-lint-baseline.json` (spec 028).

Never include Claude session information anywhere in the project, not even the comments and commits.
