// Settings rows must describe the state they are actually in.
//
// Both auditors landed on this row independently, and the app's own FAQ is the proof: "Funkce je ve
// výchozím stavu vypnutá. Když je vypnutá, aplikace obsah dokumentů vůbec nečte." The Settings row
// meanwhile said the phone finds deadlines in downloaded attachments - indicative present, next to a
// switch that has never been on. That is not a small thing to get wrong: it is a claim about the app
// reading the contents of legal mail, which is exactly what a privacy-conscious user reads that row
// to decide.

import { render, waitFor } from '@testing-library/react-native';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { AppThemeProvider } from '../../src/theme/ThemeProvider';
import { t } from '../../src/i18n/strings';

// `mock`-prefixed so jest allows the factory below to close over it.
const mockSettings = {
  themeMode: 'system' as const,
  locale: 'cs' as const,
  appLock: false,
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

jest.mock('../../src/app/settings/SettingsProvider', () => ({
  ...jest.requireActual('../../src/app/settings/SettingsProvider'),
  useSettings: () => mockSettings,
  useLocale: () => 'cs',
}));

const { SettingsScreen } = require('../../src/app/settings/SettingsScreen') as typeof import('../../src/app/settings/SettingsScreen');

const mount = async () => {
  const view = await render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <AppThemeProvider isDark={false}>
        <SettingsScreen onBack={() => {}} onOpenFaq={() => {}} onOpenBackup={() => {}}
      onOpenDebug={() => {}} onOpenLicences={() => {}} />
      </AppThemeProvider>
    </TamaguiProvider>,
  );
  await waitFor(() => expect(view.getByTestId('scan-toggle')).toBeTruthy());
  return view;
};

describe('the attachment-scan row', () => {
  it('says the scan is off while it is off - the default', async () => {
    mockSettings.scanAttachments = false;
    const view = await mount();

    expect(view.getByText(t('settings.scan.desc.off'))).toBeTruthy();
    expect(view.queryByText(t('settings.scan.desc'))).toBeNull();
  });

  it('describes the scan once it is on', async () => {
    mockSettings.scanAttachments = true;
    const view = await mount();

    expect(view.getByText(t('settings.scan.desc'))).toBeTruthy();
    expect(view.queryByText(t('settings.scan.desc.off'))).toBeNull();
  });

  it('never promises to FIND a deadline - the scan only looks for one', () => {
    // Even switched on, the scan reads a PDF's text layer only, at most four files and twelve pages,
    // keyed on cue words, and stays silent when two candidate dates disagree. "Najde"/"finds" was a
    // promise the feature does not make in any state.
    for (const key of ['settings.scan.desc', 'settings.scan.desc.off']) {
      expect(t(key)).not.toMatch(/\btelefon najde\b|\bphone finds\b/);
    }
  });

  it('does not describe the backup state from a row that cannot know it', () => {
    // The Settings row links to the backup screen; it has no access to the backup preferences, so it
    // says what the section IS and leaves the state to the section itself.
    expect(t('backup.row.desc')).not.toMatch(/automatick|po každé|after every/i);
  });
});
