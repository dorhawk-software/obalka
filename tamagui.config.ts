// Tamagui design system for Obálka. Starts from Tamagui's opinionated v5 default config (clean,
// modern, light + dark, system fonts). The app's own colours and type live in src/theme/ (useTheme),
// not in this config. Canonical setup:
// createTamagui from @tamagui/core, augment @tamagui/core so tokens type-check on style props.

import { createTamagui } from '@tamagui/core';
import { defaultConfig } from '@tamagui/config/v5';

export const tamaguiConfig = createTamagui(defaultConfig);

type Conf = typeof tamaguiConfig;

declare module '@tamagui/core' {
  interface TamaguiCustomConfig extends Conf {}
}
