module.exports = {
  root: true,
  extends: '@react-native',
  plugins: ['import', 'sonarjs'],
  rules: {
    // Always use braces for blocks — even single-statement if/else/for/while.
    curly: ['error', 'all'],

    // ── Rules switched off because they contradict a decision this codebase has already made ─────
    //
    // Before this block, `eslint .` reported 0 errors and 211 warnings, of which 190 were these
    // three rules firing on the house style. A warning count that nobody can act on is a warning
    // count nobody reads, and it was hiding ten stale `eslint-disable` comments and a handful of
    // shadowed names that ARE worth looking at (audit 2026-09-09).

    // 91 hits. The rule wants styles hoisted into `StyleSheet.create`, which cannot hold a value
    // that comes from a hook — and in this app every colour does (`useTheme()`), by design, because
    // the palette has two appearances. A themed component's style object is necessarily built during
    // render. `boxShadow` strings, the other big group, are the RN 0.86 way to write a shadow.
    'react-native/no-inline-styles': 'off',

    // 58 hits, all of them the deliberate idiom for "this promise is intentionally not awaited" —
    // `void somePromise`. That is the marker TypeScript's own `no-floating-promises` asks for, so
    // the two rules were asking for opposite things and this one lost.
    'no-void': 'off',

    // 41 hits, 38 of them in `textCodec.ts` and `soap.ts` — UTF-8 and base64 codecs, where shifting
    // and masking IS the algorithm — and the rest in hash functions (`avatarColor`). Bitwise
    // arithmetic is not a smell in code whose job is bytes. Four of those files had already
    // reached this conclusion one `/* eslint-disable no-bitwise -- ... */` at a time; this is the
    // same argument, made once, and those four comments are gone.
    'no-bitwise': 'off',

    // `DialogAction.icon` is a render prop by contract — `icon: color => <TrashIcon color={color} />`
    // — so the caller can tint the glyph to match the button it lands on. That is the case this
    // option exists for; without it the rule reads a prop-passed function as a component defined
    // during render, which it is not.
    'react/no-unstable-nested-components': ['warn', { allowAsProps: true }],

    // Props are inputs, never state. SonarQube reports a component whose props type is mutable (S6759,
    // "React props should be read-only"); this is the same check at lint time, so it fails
    // `npm run lint` and CI instead of surfacing only in an IDE. It is satisfied by `readonly` members or
    // a `Readonly<Props>` wrapper, and `eslint --fix` inserts `readonly` for you.
    'react/prefer-read-only-props': 'error',

    // One statement per module. SonarQube reports a module imported more than once (S3863), and its rule is
    // built on this one: a type-only import stays separate from a value import, which is the TypeScript
    // idiom, while genuine duplicates are an error and `eslint --fix` merges them.
    'import/no-duplicates': 'error',
    // `const x = f(); return x;` - WebStorm's "redundant local variable" / Sonar S1488. Autofixable.
    'sonarjs/prefer-immediate-return': 'error',
  },

  overrides: [
    {
      // A deprecated API is one the library has announced it will remove - a TODO with a deadline set
      // by someone else. Reported, because nobody reads the strikethrough in an editor that is not
      // open on that line (`sendDefaultPii` was found by hand, 2026-09-24). The rule needs the types,
      // so this is the one place the lint loads the TypeScript project.
      files: ['*.ts', '*.tsx'],
      parserOptions: { projectService: true, tsconfigRootDir: __dirname },
      rules: {
        '@typescript-eslint/no-deprecated': 'error',
      },
    },
    {
      // The dev scripts, which are ESM and run in node rather than on a phone.
      //
      // `eslint .` had never actually read any of them. The `@react-native` config parses every file
      // as the app's dialect, and under that all five .mjs files were a PARSE ERROR — optional
      // chaining, top-level import, `import.meta`. Parse errors on files the traversal never visits
      // are invisible, so the gate reported 0 errors while the attributions generator, the shipped-
      // dependency audit and the fixture builder went unchecked. Naming them here is what puts them
      // in front of the linter at all: ESLint 8 walks only `.js` on its own, but a file matched by an
      // `overrides` entry is linted too.
      files: ['*.mjs', 'scripts/**/*.mjs'],
      parser: 'espree',
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
      env: { node: true, es2022: true },
      rules: {
        // React Native's own rules have no business here - these files never render anything.
        'react-hooks/rules-of-hooks': 'off',
        'react-native/no-inline-styles': 'off',
      },
    },
  ],
};
