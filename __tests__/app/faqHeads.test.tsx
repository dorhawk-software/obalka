// The FAQ heads its groups as R13 heads a list (031 I05): the overline 8 over the cards, the next group
// 18 under them, the ISDS disclaimer the muted line under its overline. Until 2026-11-15 the heads were
// 10 over the cards and 24 apart, and the disclaimer a faint line with an info icon of its own.

import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { AppThemeProvider } from '../../src/theme/ThemeProvider';
import { lightTheme } from '../../src/theme/theme';
import { FaqScreen } from '../../src/app/settings/FaqScreen';
import { FAQ_DISCLAIMER } from '../../src/content/faq';

const mount = () =>
  render(
    <SafeAreaProvider
      initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } }}
    >
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <AppThemeProvider isDark={false}>
          <FaqScreen onBack={() => {}} />
        </AppThemeProvider>
      </TamaguiProvider>
    </SafeAreaProvider>,
  );

const style = (node: { props: Record<string, unknown> }) =>
  (StyleSheet.flatten(node.props.style as never) ?? {}) as Record<string, unknown>;

describe('the FAQ\'s group heads (R13)', () => {
  it('puts the first group\'s cards 8 under its overline, with the screen\'s own top above it', async () => {
    const view = await mount();
    expect(style(view.getByTestId('faq-head-app'))).toMatchObject({ paddingTop: 0, paddingBottom: 8 });
  });

  it('starts the ISDS group 18 under the last card', async () => {
    const view = await mount();
    expect(style(view.getByTestId('faq-head-isds'))).toMatchObject({ paddingTop: 18, paddingBottom: 8 });
  });

  it('gives the disclaimer as the ISDS head\'s muted line, not a faint line of its own', async () => {
    const view = await mount();
    const head = view.getByTestId('faq-head-isds');
    // Its words carry the typesetter's no-break spaces, so the start of it is matched.
    const disclaimer = view.getByText(new RegExp(`^${FAQ_DISCLAIMER.cs.slice(0, 12)}`));
    expect(head).toContainElement(disclaimer);
    expect(disclaimer).toHaveStyle({ color: lightTheme.textMuted });
  });
});
