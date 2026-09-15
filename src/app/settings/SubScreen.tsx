// The shell a settings sub-screen sits in: safe-area inset, the shared 54px header, and the paper
// background. Help, the licences, Backup, Transfer and Debug all use it, so the metrics live here once
// rather than being retyped on each - constitution V, the same pattern keeps the same numbers.
//
// Those numbers are DESIGN.md's (2026-09-15): the top is the `gutter` step, the sides are the 16 DESIGN.md
// gives settings-shaped scroll content, and the bottom comes from `useContentBottom`, the one source
// DESIGN.md names for a screen's bottom padding. It was a bare 28: right where the bottom inset is 0, and
// short by the whole gesture bar everywhere else.

import type { ReactNode, Ref } from 'react';
import { ScrollView, YStack } from '../../theme/ui';
import { ScreenHeader } from '../../theme/ScreenHeader';
import { useTheme } from '../../theme/ThemeProvider';
import { useContentBottom } from '../../theme/useContentBottom';
import { space } from '../../theme/spacing';

/** The sides: DESIGN.md › Layout, "16 on settings-shaped scroll content". */
const SETTINGS_SIDES = 16;
/**
 * The gap left above the home indicator: the one Settings itself ends on (`useContentBottom(28)` in
 * `SettingsScreen`), so a screen opened from Settings ends the same distance above the same edge.
 */
const SETTINGS_BOTTOM_GAP = 28;

export function SubScreen({
  title,
  onBack,
  children,
  paddingTop = space.gutter,
  paddingHorizontal = SETTINGS_SIDES,
  paddingBottom = SETTINGS_BOTTOM_GAP,
  scrollRef,
}: {
  readonly title: string;
  readonly onBack: () => void;
  readonly children: ReactNode;
  readonly paddingTop?: number;
  readonly paddingHorizontal?: number;
  /** The gap above the home indicator or gesture bar. It is added to that inset, never instead of it. */
  readonly paddingBottom?: number;
  /** For a screen that needs to scroll somewhere on open - see FaqScreen's `focus`. */
  readonly scrollRef?: Ref<{ scrollTo(o: { y: number; animated?: boolean }): void }>;
}) {
  const theme = useTheme();
  const contentBottom = useContentBottom(paddingBottom);
  return (
    <YStack flex={1} backgroundColor={theme.bg}>
      <ScreenHeader title={title} onBack={onBack} />
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingTop, paddingHorizontal, paddingBottom: contentBottom }}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </YStack>
  );
}
