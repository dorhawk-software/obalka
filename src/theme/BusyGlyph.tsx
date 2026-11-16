// The glyph of a hand-built ink button that spins while it works (sign in, the code, the password,
// Odeslat): the spinner takes the glyph's own 20 px slot, so the words never move when it starts
// (no layout jumps; 031 T050.7, "every action carries its glyph").

import { YStack } from './ui';
import { ArcSpinner } from './ArcSpinner';
import { OffsetIcon, type OffsetGlyphName } from './offsetIcons';
import { useTheme } from './ThemeProvider';

export const BUTTON_GLYPH = 20;

export function BusyGlyph({ name, busy }: { readonly name: OffsetGlyphName; readonly busy: boolean }) {
  const theme = useTheme();
  if (!busy) {
    return <OffsetIcon name={name} size={BUTTON_GLYPH} color={theme.surfaceAlt} plane="button" />;
  }
  return (
    <YStack width={BUTTON_GLYPH} height={BUTTON_GLYPH} alignItems="center" justifyContent="center" testID="busy-glyph">
      <ArcSpinner track={theme.surfaceSunken} ink={theme.surfaceAlt} />
    </YStack>
  );
}
