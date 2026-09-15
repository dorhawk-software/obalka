// The design system as lint rules (spec 028).
//
// Every rule reads what the system IS from `tokens.json`, which `__tests__/lint/designTokens.test.ts`
// derives from the theme and DESIGN.md and fails on when it goes stale - so a rule can never enforce a
// scale the app no longer has. Every message follows one contract, so an agent can act on it without
// opening the rule: what was written and what the system says, the fix taken from the system, where
// the system itself grows when nothing fits, and why (see `message.js`).
//
// Run through `scripts/design-lint.mjs` (`npm run lint:design`, part of `verify`), which holds the
// findings to a baseline that may only shrink.

module.exports = {
  rules: {
    'role-typography': require('./rules/role-typography'),
    'space-scale': require('./rules/space-scale'),
    'radius-steps': require('./rules/radius-steps'),
    'no-raw-color': require('./rules/no-raw-color'),
    'use-card': require('./rules/use-card'),
  },
};
