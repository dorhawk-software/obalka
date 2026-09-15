// The obalka/* design rules (spec 028). The message is the product - it is what an agent reads to fix
// the code - so every case asserts the whole text, and a reworded message is a reviewed change.

// ESLint 8 ships no types; the tester's surface used here is two methods.
const { RuleTester } = require('eslint') as {
  RuleTester: new (config: object) => { run: (name: string, rule: unknown, cases: object) => void };
};
const plugin = require('../../tools/eslint-plugin-obalka');

const tester = new RuleTester({
  parser: require.resolve('@typescript-eslint/parser'),
  parserOptions: { ecmaVersion: 2022, sourceType: 'module', ecmaFeatures: { jsx: true } },
});
const SCREEN = '/repo/src/features/messages/screens/Screen.tsx';
const THEME = '/repo/src/theme/Thing.tsx';

describe('obalka/role-typography', () => {
  tester.run('role-typography', plugin.rules['role-typography'], {
    valid: [
      { code: '<Meta fontWeight="700" color={c}>x</Meta>', filename: SCREEN },
      { code: '<Caption dense>x</Caption>', filename: SCREEN },
      { code: '<Caption fontSize={12}>x</Caption>', filename: THEME },
    ],
    invalid: [
      {
        code: '<Caption fontSize={12}>x</Caption>',
        filename: SCREEN,
        errors: [
          {
            message: [
              '<Caption fontSize={12}> restyles a text role. <Caption> (13/17 Public Sans 500) by design (src/theme/typography.ts).',
              '  Fix: use <Meta> (12/16 Public Sans 500); keep a different weight with `fontWeight`.',
              '  Why: one size per role is what keeps two screens from drifting apart (constitution V, DESIGN.md › Typography).',
            ].join('\n'),
          },
        ],
      },
      {
        code: '<Body fontSize={19}>x</Body>',
        filename: SCREEN,
        errors: [
          {
            message: [
              '<Body fontSize={19}> restyles a text role. <Body> (15/21 Public Sans 400) by design (src/theme/typography.ts).',
              '  Fix: no Public Sans role is 19px.',
              '  If nothing fits: if the design really uses 19px Public Sans, that is a missing role - add it to `type` in src/theme/typography.ts and to DESIGN.md › Typography, then use it here. Not here.',
              '  Why: one size per role is what keeps two screens from drifting apart (constitution V, DESIGN.md › Typography).',
            ].join('\n'),
          },
        ],
      },
      { code: '<Label fontFamily={fonts.bodyBold}>x</Label>', filename: SCREEN, errors: 1 },
      { code: '<Meta lineHeight={15}>x</Meta>', filename: SCREEN, errors: 1 },
      { code: '<Small fontSize={14}>x</Small>', filename: SCREEN, errors: [{ message: /Fix: delete it - 14 is already Small's size\./ }] },
    ],
  });
});

describe('obalka/space-scale', () => {
  tester.run('space-scale', plugin.rules['space-scale'], {
    valid: [
      { code: '<X padding={16} gap={13} marginTop={-4} margin={0} />', filename: SCREEN },
      { code: 'const s = { paddingHorizontal: 18 };', filename: SCREEN },
      { code: '<X padding={17} />', filename: THEME },
    ],
    invalid: [
      {
        code: '<X paddingTop={17} />',
        filename: SCREEN,
        errors: [
          {
            message: [
              'paddingTop=17 is not on the spacing scale (2 / 4 / 6 / 8 / 10 / 12 / 13 / 14 / 16 / 18 / 24 / 28 / 36 / 60).',
              '  Fix: use 18 (space.gutter) or 16 (space.inset).',
              "  If nothing fits: if the design really has this step, add it to DESIGN.md's `spacing:` and src/theme/spacing.ts (spacing.test.ts holds them together). Not here.",
              '  Why: spacing comes only from the scale, so the same gap reads the same on every screen (constitution V).',
            ].join('\n'),
          },
        ],
      },
      { code: 'const s = { marginTop: 1 };', filename: SCREEN, errors: [{ message: /A 1dp nudge is optical alignment/ }] },
    ],
  });
});

describe('obalka/radius-steps', () => {
  tester.run('radius-steps', plugin.rules['radius-steps'], {
    valid: [
      { code: '<X borderRadius={14} />', filename: SCREEN },
      { code: '<X borderRadius={concentric(7, 2)} />', filename: SCREEN },
    ],
    invalid: [
      {
        code: '<X borderTopLeftRadius={9} />',
        filename: SCREEN,
        errors: [{ message: /borderTopLeftRadius=9 is not one of DESIGN\.md's radius steps[\s\S]*Fix: use the step for what this is - 8 \(chips and status pills\); or 11 \(list-row tiles[\s\S]*concentric\(outer, gap\)/ }],
      },
    ],
  });
});

describe('obalka/no-raw-color', () => {
  tester.run('no-raw-color', plugin.rules['no-raw-color'], {
    valid: [
      { code: '<X color={theme.text} />', filename: SCREEN },
      { code: "const c = '#FFFFFF';", filename: '/repo/src/theme/theme.ts' },
    ],
    invalid: [
      {
        code: "<X color=\"#2A5C9A\" />",
        filename: SCREEN,
        errors: [{ message: /"#2A5C9A" is a raw colour\.\n {2}Fix: use theme\.blue[\s\S]*follows dark mode\./ }],
      },
      { code: 'const s = `rgba(0,0,0,${a})`;', filename: SCREEN, errors: [{ message: /useScrim/ }] },
    ],
  });
});

describe('obalka/use-card', () => {
  tester.run('use-card', plugin.rules['use-card'], {
    valid: [
      { code: '<Card padding={14}>x</Card>', filename: SCREEN },
      { code: '<YStack borderRadius={14} borderWidth={1} backgroundColor={theme.surface} borderColor={theme.borderStrong} />', filename: SCREEN },
    ],
    invalid: [
      {
        code: '<XStack borderRadius={14} borderWidth={1} borderColor={theme.border} backgroundColor={theme.surface} padding={12} />',
        filename: SCREEN,
        errors: [{ message: /Fix: use <Card> from src\/theme\/Card\.tsx and keep only the layout props \(padding, gap, flexDirection="row"\)\./ }],
      },
    ],
  });
});
