// The blue download button sits alone in its card at the 48 size, with the buttons' 14 corner. Until
// 2026-11-16 its corner was 13, off the radius scale (T050.4, the owner's "three sizes by job").
import type { ReactElement } from 'react';
import { StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { AppThemeProvider } from '../../src/theme/ThemeProvider';
import { DownloadButton } from '../../src/features/messages/screens/AttachmentCards';

const wrap = (child: ReactElement) => (
  <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
    <AppThemeProvider isDark={false}>{child}</AppThemeProvider>
  </TamaguiProvider>
);

it('is 48 tall with the 14 corner', async () => {
  const view = await render(wrap(<DownloadButton label="Stáhnout" onPress={() => {}} testID="dl" />));
  const face = StyleSheet.flatten(view.getByTestId('dl-face', { includeHiddenElements: true }).props.style) as {
    minHeight?: number;
    borderTopLeftRadius?: number;
    borderRadius?: number;
  };
  expect([face.minHeight, face.borderRadius ?? face.borderTopLeftRadius]).toEqual([48, 14]);
});
