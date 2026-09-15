// The first screen a new user sees must not be a one-way door.
//
// `AppShell` sends the add-box flow a `back` callback so `EdgeSwipeBack` can wire the iOS edge gesture
// and the Android system Back to it - and it used to send `undefined` whenever the account list was
// empty, i.e. on every genuine first run. `undefined` does not mean "back is not needed here", it
// means "there is nowhere behind this": the chevron vanished from the form's header, the edge swipe
// did nothing, and Android's Back left the app from the sign-up screen. Welcome is behind it.
//
// Asserted through the rendered flow rather than by reading the callback, because the bug was exactly
// a callback that existed in one branch and not the other.

import { enableScreens } from 'react-native-screens';
enableScreens(false);

import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { AppThemeProvider } from '../../src/theme/ThemeProvider';
import { AppShell } from '../../src/app/AppShell';
import { accountsController } from '../../src/features/accounts/deps';

const SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function renderShell() {
  return render(
    <GestureHandlerRootView>
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <AppThemeProvider isDark={false}>
          <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
            <AppShell />
          </SafeAreaProvider>
        </AppThemeProvider>
      </TamaguiProvider>
    </GestureHandlerRootView>,
  );
}

describe('the add-box flow on a first run (no boxes yet)', () => {
  beforeEach(() => {
    jest.spyOn(accountsController, 'listAccounts').mockResolvedValue([]);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('can be backed out of, all the way to Welcome', async () => {
    const view = await renderShell();
    await waitFor(() => expect(view.getByTestId('welcome')).toBeTruthy());

    fireEvent.press(view.getByTestId('welcome-add-box'));
    await waitFor(() => expect(view.getByTestId('back')).toBeTruthy());

    fireEvent.press(view.getByTestId('back'));
    await waitFor(() => expect(view.getByTestId('welcome')).toBeTruthy());
  });
});
