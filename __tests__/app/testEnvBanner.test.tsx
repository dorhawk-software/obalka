import { render } from '@testing-library/react-native';
import { TamaguiProvider } from 'tamagui';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { tamaguiConfig } from '../../tamagui.config';
import { TestEnvBanner } from '../../src/app/TestEnvBanner';
import { t } from '../../src/i18n/strings';

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function ui(node: React.ReactElement) {
  return render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        {node}
      </TamaguiProvider>
    </SafeAreaProvider>,
  );
}

describe('TestEnvBanner (US3)', () => {
  it('renders the "Testovací prostředí" strip when shown', async () => {
    const view = await ui(<TestEnvBanner show />);
    expect(view.getByTestId('testEnvBanner')).toBeTruthy();
    // The design's banner carries the full label ("Testovací prostředí"); the short "Testovací" tag
    // is the per-box chip in the switcher (BoxRow), not this strip.
    expect(view.getByText(t('testEnv.banner'))).toBeTruthy();
  });

  it('renders nothing (takes no layout space) when not shown', async () => {
    const view = await ui(<TestEnvBanner show={false} />);
    expect(view.queryByTestId('testEnvBanner')).toBeNull();
  });
});
