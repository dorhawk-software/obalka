# Tamagui setup notes (feature 001 UI)

We use **Tamagui** (umbrella `tamagui` 2.2.x + `@tamagui/config` v5) for layout and text primitives
only, re-exported from `src/theme/ui.tsx`. The design system - colours, type, metrics - is our own:
`src/theme/theme.ts` via `useTheme()`, documented in [`DESIGN.md`](../DESIGN.md). The config is
`tamagui.config.ts` (the opinionated v5 default, unmodified - light+dark, system fonts); the provider
is mounted in `App.tsx`. Runtime-only (no optimizing Babel compiler) for now.

## Install recipe (what was needed, beyond `npm i tamagui @tamagui/config`)

These were non-obvious and are easy to lose, so they're recorded here:

1. **`npm dedupe`** - the install created ~45 nested copies of `@tamagui/web`. Duplicate `@tamagui/web`
   breaks the theme context at runtime (`useThemeState` crash) **and** the type augmentation. `dedupe`
   collapses them to one. Re-run after any Tamagui install.
2. **`react-dom`** (installed, matching React) - the umbrella eagerly imports `@tamagui/menu` →
   `@tamagui/popper`, whose native build does `import { flushSync } from "react-dom"`. It's dead code
   on native (we never render poppers) but the import must resolve for Metro **and** jest. (Leaner
   alternative later: import only the lightweight component packages and drop react-dom.)
3. **tsconfig** `lib: ["esnext", "dom"]` - Tamagui resolves to its TS source which references DOM types
   (`HTMLElement`). Adding `dom` lets those web-targeted files type-check.
4. **jest** `transformIgnorePatterns` includes `tamagui|@tamagui` so Babel transforms Tamagui's ESM.
5. **TamaguiProvider** wraps the app in `App.tsx`; its `defaultTheme` follows the appearance the app is
   actually painting (`shownDark`: the user's Light/Dark/System choice, or the last stored appearance -
   the OS on a first launch - until settings load).

## Known issue - to finish on-device

`tamagui.config.ts` augments `TamaguiCustomConfig`, but in this **headless RN tsconfig**
(`moduleResolution: "bundler"` resolving Tamagui's `src/*.ts`) the config token types do **not** bind
to component style props - `tsc` rejects `$token`/style props (even literal colors). The components
**render correctly** (verified by the jest render tests); it's purely a type-resolution problem.

**Workaround in place:** `src/theme/ui.tsx` re-exports the used primitives with loosened (`any`) prop
types, isolated to that one file with a `TODO(tamagui-types)`. Screens import primitives from there.

**To resolve on a real build** (where there's immediate feedback): try the Tamagui optimizing Babel
plugin (`@tamagui/babel-plugin`) + a `tamagui` loader, confirm a single `@tamagui/web`, and verify the
augmentation binds - then drop the `any` casts in `src/theme/ui.tsx` and import straight from `tamagui`.
This is also when we'll confirm the visual result.
