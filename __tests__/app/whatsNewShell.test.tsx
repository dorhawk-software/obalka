// What's new in the real shell (spec 029): a phone that had 0.1.0 opens 0.3.0, and the sheet comes up
// over the inbox - after the diagnostics question, never instead of it - says what changed, and closes
// on Pokračovat. The version is written as seen, so the next launch says nothing.
// One shell per file: see `firstRunShell`.

import { act, render, waitFor } from '@testing-library/react-native';
import type { ChangelogRelease } from '../../src/content/changelog.generated';
import { WHATS_NEW_SEEN_KEY } from '../../src/app/settings/settingsKeys';
import { settingsStore } from '../../src/features/accounts/deps';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { AppThemeProvider } from '../../src/theme/ThemeProvider';
import { AppShell } from '../../src/app/AppShell';
import { SettingsProvider } from '../../src/app/settings/SettingsProvider';
import { press, restoredBox, world } from '../helpers/firstRunShell';

/** `renderShell`, inside the real settings provider: the diagnostics answer has to land somewhere. */
const renderShell = () =>
  render(
    <GestureHandlerRootView>
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <SettingsProvider>
          <AppThemeProvider isDark={false}>
            <SafeAreaProvider
              initialMetrics={{
                frame: { x: 0, y: 0, width: 390, height: 844 },
                insets: { top: 47, left: 0, right: 0, bottom: 34 },
              }}
            >
              <AppShell />
            </SafeAreaProvider>
          </AppThemeProvider>
        </SettingsProvider>
      </TamaguiProvider>
    </GestureHandlerRootView>,
  );

// `mock`-prefixed so jest allows the factories below to close over it.
const mockReleases: ChangelogRelease[] = [
  {
    version: '0.3.0',
    date: '2026-12-01',
    changes: { new: [{ lead: 'Připomínka lhůty.', body: 'Nastavíte ji u zprávy.' }] },
  },
  { version: '0.2.0', date: '2026-11-20', changes: { fixed: [{ lead: 'Hledání najde i přílohy.', body: '' }] } },
  { version: '0.1.0', date: '2026-11-12', changes: { new: [{ lead: 'První vydání.', body: '' }] } },
];

jest.mock('../../src/app/appInfo', () => ({
  ...jest.requireActual('../../src/app/appInfo'),
  APP_VERSION: '0.3.0',
}));
jest.mock('../../src/content/changelog.generated', () => ({
  ...jest.requireActual('../../src/content/changelog.generated'),
  get CHANGELOG() {
    return { cs: mockReleases, en: mockReleases };
  },
}));

afterEach(() => {
  jest.restoreAllMocks();
});

it('shows what changed since the version this phone had, once, after the diagnostics question', async () => {
  const w = world();
  w.setAccounts([restoredBox]);
  const settings = new Map<string, string>([[WHATS_NEW_SEEN_KEY, '0.1.0']]);
  const getSetting = settingsStore.getSetting.bind(settingsStore);
  jest.spyOn(settingsStore, 'getSetting').mockImplementation(async key =>
    key === WHATS_NEW_SEEN_KEY ? settings.get(key) ?? null : getSetting(key),
  );
  const setSetting = settingsStore.setSetting.bind(settingsStore);
  const written = jest
    .spyOn(settingsStore, 'setSetting')
    .mockImplementation(async (key, value) => {
      if (key === WHATS_NEW_SEEN_KEY) {
        settings.set(key, value);
        return;
      }
      await setSetting(key, value);
    });

  const view = await renderShell();
  // The question comes first; nothing is decided behind it.
  await waitFor(() => expect(view.getByTestId('consentNo')).toBeTruthy());
  expect(view.queryByTestId('whats-new-sheet')).toBeNull();
  expect(written).not.toHaveBeenCalledWith(WHATS_NEW_SEEN_KEY, expect.anything());

  await press(view, 'consentNo');
  await waitFor(() => expect(view.getByTestId('whats-new-sheet')).toBeTruthy());
  expect(view.getByText('Co je nového ve verzi 0.3.0')).toBeTruthy();
  expect(view.getByText('Od verze 0.1.0, kterou jste měli: 2 změny')).toBeTruthy();
  expect(view.getByText('Připomínka lhůty.')).toBeTruthy();
  expect(view.getByText('Hledání najde i přílohy.')).toBeTruthy();
  expect(view.queryByText('První vydání.')).toBeNull();
  expect(settings.get(WHATS_NEW_SEEN_KEY)).toBe('0.3.0');

  await press(view, 'whats-new-continue');
  await act(async () => {});
  expect(view.queryByTestId('whats-new-sheet')).toBeNull();
});
