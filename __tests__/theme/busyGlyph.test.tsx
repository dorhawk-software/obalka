// A hand-built ink button that spins (sign in, the code, the password, Odeslat) carries its glyph, and
// the spinner takes the glyph's own 20 px slot, so the words do not move when it starts (031 T050.7).
import type { ReactElement } from 'react';
import { StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { AppThemeProvider } from '../../src/theme/ThemeProvider';
import { BUTTON_GLYPH, BusyGlyph } from '../../src/theme/BusyGlyph';

const wrap = (child: ReactElement) => (
  <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
    <AppThemeProvider isDark={false}>{child}</AppThemeProvider>
  </TamaguiProvider>
);

it('draws the glyph while idle', async () => {
  const view = await render(wrap(<BusyGlyph name="key" busy={false} />));
  expect(view.queryByTestId('offset-key', { includeHiddenElements: true })).not.toBeNull();
  expect(view.queryByTestId('busy-glyph', { includeHiddenElements: true })).toBeNull();
});

it("spins in the glyph's own 20 px slot while busy", async () => {
  const view = await render(wrap(<BusyGlyph name="key" busy />));
  expect(view.queryByTestId('offset-key', { includeHiddenElements: true })).toBeNull();
  const slot = StyleSheet.flatten(view.getByTestId('busy-glyph', { includeHiddenElements: true }).props.style) as {
    width?: number;
    height?: number;
  };
  expect([slot.width, slot.height]).toEqual([BUTTON_GLYPH, BUTTON_GLYPH]);
  expect(BUTTON_GLYPH).toBe(20);
});
