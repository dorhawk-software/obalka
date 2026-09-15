// Dark-mode smoke (feature 009): render representative screens under the DARK palette and assert they
// mount without crashing - guards against a light-only token leak or a missing dark value regressing
// dark mode (Constitution V: "a real, correct dark mode"). The palette itself is contrast-audited in
// __tests__/theme/chipTone.test.ts + the T043 audit; this guards rendering.

import { render } from '@testing-library/react-native';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { AppThemeProvider } from '../../src/theme/ThemeProvider';
import { Welcome } from '../../src/features/accounts/screens/Welcome';

const wrapDark = (ui: React.ReactElement) =>
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
      <AppThemeProvider isDark>{ui}</AppThemeProvider>
    </TamaguiProvider>,
  );

const wrapLight = (ui: React.ReactElement) =>
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <AppThemeProvider isDark={false}>{ui}</AppThemeProvider>
    </TamaguiProvider>,
  );

describe('dark mode renders (smoke)', () => {
  it('Welcome mounts under the dark palette', async () => {
    const v = await wrapDark(<Welcome onAddBox={() => {}} onOpenFaq={() => {}} onRestore={() => {}} canTransfer={false} />);
    expect(v.getByTestId('welcome')).toBeTruthy();
    expect(v.getByTestId('welcome-add-box')).toBeTruthy();
  });

  it('Welcome mounts under the light palette too (parity)', async () => {
    const v = await wrapLight(<Welcome onAddBox={() => {}} onOpenFaq={() => {}} onRestore={() => {}} canTransfer={false} />);
    expect(v.getByTestId('welcome')).toBeTruthy();
  });
});
