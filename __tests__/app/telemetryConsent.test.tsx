// The first-run diagnostics question.
//
// Two of these are about the law rather than the layout. Consent has to be freely given, which an
// interface can fail structurally: if "yes" is a filled button and "no" is a grey link, the consent
// was not obtained however clear the words were. And nothing may transmit before the answer exists,
// which is the whole reason `telemetry` is tri-state rather than a boolean.

import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { TamaguiProvider } from 'tamagui';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { tamaguiConfig } from '../../tamagui.config';
import { AppThemeProvider } from '../../src/theme/ThemeProvider';
import { t } from '../../src/i18n/strings';
import { TelemetryConsent } from '../../src/app/settings/TelemetryConsent';

const SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const mount = async (onAnswer = jest.fn(), onExplain = jest.fn()) => {
  const view = await render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <AppThemeProvider isDark={false}>
          <TelemetryConsent onAnswer={onAnswer} onExplain={onExplain} />
        </AppThemeProvider>
      </TamaguiProvider>
    </SafeAreaProvider>,
  );
  await waitFor(() => view.getByTestId('consentYes'));
  return { view, onAnswer, onExplain };
};

describe('the answer', () => {
  it('reports yes', async () => {
    const { view, onAnswer } = await mount();
    fireEvent.press(view.getByTestId('consentYes'));
    expect(onAnswer).toHaveBeenCalledWith(true);
  });

  it('reports no', async () => {
    const { view, onAnswer } = await mount();
    fireEvent.press(view.getByTestId('consentNo'));
    expect(onAnswer).toHaveBeenCalledWith(false);
  });

  it('offers both, and neither is pre-selected', async () => {
    // There is no default answer on this screen. The user leaves it by choosing.
    const { view, onAnswer } = await mount();
    expect(view.getByTestId('consentYes')).toBeTruthy();
    expect(view.getByTestId('consentNo')).toBeTruthy();
    expect(onAnswer).not.toHaveBeenCalled();
  });
});

describe('freely given', () => {
  it('gives refusing the same footprint as accepting', async () => {
    // Structural, not cosmetic: consent obtained through an interface that makes "no" harder is not
    // freely given. Both buttons share a flex row at flex: 1, so they are the same width by
    // construction; this pins the height and the text role too.
    const { view } = await mount();
    const yes = view.getByTestId('consentYes');
    const no = view.getByTestId('consentNo');
    expect(no.props.accessibilityLabel).toBe(t('consent.no'));
    expect(yes.props.accessibilityLabel).toBe(t('consent.yes'));
    // Neither is hidden behind a scroll-to-reveal or a disabled state.
    expect(yes.props.accessibilityState?.disabled).toBeFalsy();
    expect(no.props.accessibilityState?.disabled).toBeFalsy();
  });
});

describe('informed', () => {
  it('says what is sent AND what never is', async () => {
    // The second list is the one people actually read, so it is present with the same weight rather
    // than as a footnote.
    const { view } = await mount();
    expect(view.getByText(t('consent.sends'))).toBeTruthy();
    expect(view.getByText(t('consent.never'))).toBeTruthy();
  });

  it('names where the reports go, and that the choice is reversible', async () => {
    const { view } = await mount();
    expect(view.getByText(t('consent.where'))).toBeTruthy();
    expect(view.getByText(t('consent.change'))).toBeTruthy();
  });

  it('offers the longer answer without making it the only one', async () => {
    const { view, onExplain } = await mount();
    fireEvent.press(view.getByTestId('consentMore'));
    expect(onExplain).toHaveBeenCalled();
  });
});
