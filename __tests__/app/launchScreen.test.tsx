// The launch screen as board R8 draws it (031, agreed 2026-11-12): the shipped mark and the wordmark,
// one waiting bar in the spinner's old slot, and on a failure the message and a neutral retry in the
// same place. Before: a platform spinner and an outlined button.

import { render } from '@testing-library/react-native';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { LaunchScreen } from '../../src/app/LaunchScreen';
import { t } from '../../src/i18n/strings';

function launch(failed: boolean) {
  return render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <LaunchScreen failed={failed} onRetry={() => {}} />
    </TamaguiProvider>,
  );
}

describe('the launch screen (R8)', () => {
  it('waits with one bar, no spinner', async () => {
    const view = await launch(false);
    expect(view.getByTestId('launchBar')).toBeOnTheScreen();
    expect(view.getByLabelText(t('app.loading'))).toBeOnTheScreen();
    expect(JSON.stringify(view.toJSON())).not.toContain('ActivityIndicator');
    expect(view.queryByTestId('loadFailed')).toBeNull();
  });

  it('puts the message and the retry in the bar s place when the boxes would not load', async () => {
    const view = await launch(true);
    expect(view.queryByTestId('launchBar')).toBeNull();
    expect(view.getByTestId('loadFailed')).toHaveTextContent(new RegExp(t('app.loadFailed')));
    expect(view.getByTestId('loadRetry')).toHaveTextContent(t('app.loadFailed.retry'));
    expect(JSON.stringify(view.toJSON())).not.toContain('ActivityIndicator');
  });
});
