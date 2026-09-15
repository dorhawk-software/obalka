// Switching the app lock off, when it cannot be switched off (001 T028).
//
// Turning the lock off moves the vault key back to its unguarded Keychain item. If the Keychain
// refuses, the lock stays on - correctly, because a lock reported off with its key still behind the
// gate would ask for a fingerprint nobody expects. What must not happen is the switch springing back
// with no word: that reads as a tap that did not register, and the user tries again into the same
// refusal without ever learning the lock is still on.

import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { AppThemeProvider } from '../../src/theme/ThemeProvider';
import { t } from '../../src/i18n/strings';

// `mock`-prefixed so jest allows the factories below to close over them.
const mockSettings = {
  themeMode: 'system' as const,
  locale: 'cs' as const,
  appLock: true,
  scanAttachments: false,
  autoDownload: { on: false, since: null, wifiOnly: true },
  setAutoDownload: () => {},
  setAutoDownloadWifiOnly: () => {},
  ready: true,
  setThemeMode: jest.fn(),
  setLocale: jest.fn(),
  setAppLock: jest.fn(),
  setScanAttachments: jest.fn(),
};

const mockLock = {
  isAvailable: jest.fn(async () => true),
  enable: jest.fn(async () => 'enabled' as const),
  disable: jest.fn(async () => {}),
};

jest.mock('../../src/app/settings/SettingsProvider', () => ({
  ...jest.requireActual('../../src/app/settings/SettingsProvider'),
  useSettings: () => mockSettings,
  useLocale: () => 'cs',
}));

jest.mock('../../src/features/accounts/deps', () => ({
  ...jest.requireActual('../../src/features/accounts/deps'),
  appLock: mockLock,
}));

const { SettingsScreen } = require('../../src/app/settings/SettingsScreen') as typeof import('../../src/app/settings/SettingsScreen');

const mount = async () => {
  const view = await render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <AppThemeProvider isDark={false}>
        <SettingsScreen
          onBack={() => {}}
          onOpenFaq={() => {}}
          onOpenBackup={() => {}}
          onOpenDebug={() => {}}
          onOpenLicences={() => {}}
        />
      </AppThemeProvider>
    </TamaguiProvider>,
  );
  await waitFor(() => expect(view.getByTestId('lock-toggle')).toBeTruthy());
  return view;
};

beforeEach(() => {
  mockSettings.setAppLock.mockClear();
  mockLock.disable.mockClear();
});

describe('switching the app lock off', () => {
  it('says the lock stayed on when the Keychain would not take the key back', async () => {
    mockLock.disable.mockRejectedValueOnce(new Error('keychain refused'));
    const view = await mount();

    await act(async () => {
      fireEvent.press(view.getByTestId('lock-toggle'));
    });

    await waitFor(() => expect(view.getByTestId('lock-disable-failed-dialog')).toBeTruthy());
    expect(view.getByText(t('lock.disableFailed.title'))).toBeTruthy();
    expect(view.getByText(t('lock.disableFailed.body'))).toBeTruthy();
    expect(mockSettings.setAppLock).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.press(view.getByTestId('lock-disable-failed-ok'));
    });
    expect(view.queryByTestId('lock-disable-failed-dialog')).toBeNull();
  });

  it('switches off without a word when it can', async () => {
    const view = await mount();

    await act(async () => {
      fireEvent.press(view.getByTestId('lock-toggle'));
    });

    await waitFor(() => expect(mockSettings.setAppLock).toHaveBeenCalledWith(false));
    expect(mockLock.disable).toHaveBeenCalledTimes(1);
    expect(view.queryByTestId('lock-disable-failed-dialog')).toBeNull();
  });
});
