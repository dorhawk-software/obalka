// Settings -> About links the privacy policy (owner decision 2026-09-24).
//
// The policy lives in the repository, beside the README: PRIVACY.md in Czech, PRIVACY.en.md in
// English. The row opens the one in the app's language on GitHub - a hand-off to the browser, like
// the source-code row under it, never a fetch.

import { existsSync } from 'fs';
import { join } from 'path';
import { Linking } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { AppThemeProvider } from '../../src/theme/ThemeProvider';
import { setActiveLocale, t, type Locale } from '../../src/i18n/strings';
import { PRIVACY_POLICY_FILES, privacyPolicyUrl } from '../../src/app/appInfo';

// `mock`-prefixed so jest allows the factory below to close over it.
const mockSettings = {
  themeMode: 'system' as const,
  locale: 'cs' as Locale,
  appLock: false,
  scanAttachments: false,
  autoDownload: { on: false, since: null, wifiOnly: true },
  setAutoDownload: () => {},
  setAutoDownloadWifiOnly: () => {},
  telemetry: false,
  ready: true,
  setThemeMode: jest.fn(),
  setLocale: jest.fn(),
  setAppLock: jest.fn(),
  setScanAttachments: jest.fn(),
  setTelemetry: jest.fn(),
};

jest.mock('../../src/app/settings/SettingsProvider', () => ({
  ...jest.requireActual('../../src/app/settings/SettingsProvider'),
  useSettings: () => mockSettings,
  useLocale: () => mockSettings.locale,
}));

const { SettingsScreen } = require('../../src/app/settings/SettingsScreen') as typeof import('../../src/app/settings/SettingsScreen');

const ROOT = join(__dirname, '../..');

async function openPolicyIn(locale: Locale): Promise<unknown[][]> {
  mockSettings.locale = locale;
  setActiveLocale(locale);
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  try {
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
    const row = await waitFor(() => view.getByText(t('settings.privacy')));
    await act(async () => {
      fireEvent.press(row);
    });
    return open.mock.calls;
  } finally {
    open.mockRestore();
  }
}

afterEach(() => setActiveLocale('cs'));

describe('the privacy-policy row', () => {
  it('opens the Czech policy in Czech', async () => {
    expect(await openPolicyIn('cs')).toEqual([
      ['https://github.com/dorhawk-software/obalka/blob/main/PRIVACY.md'],
    ]);
  });

  it('opens the English policy in English', async () => {
    expect(await openPolicyIn('en')).toEqual([
      ['https://github.com/dorhawk-software/obalka/blob/main/PRIVACY.en.md'],
    ]);
  });

  it('is named in both languages', () => {
    setActiveLocale('cs');
    expect(t('settings.privacy')).toBe('Zásady ochrany osobních údajů');
    setActiveLocale('en');
    expect(t('settings.privacy')).toBe('Privacy policy');
  });

  it('links into the same repository as the source-code row', () => {
    for (const locale of ['cs', 'en'] as const) {
      expect(privacyPolicyUrl(locale)).toBe(
        `https://github.com/dorhawk-software/obalka/blob/main/${PRIVACY_POLICY_FILES[locale]}`,
      );
    }
  });

  // The policy the About row links to must exist at the repository root: a linked file that is
  // renamed or deleted fails here. (Until the owner confirmed the text, 2026-09-24, both files were
  // listed as awaiting it; the list stays so a future language can be added the same way.)
  const AWAITING_TEXT: ReadonlySet<string> = new Set<string>();

  it('points at files that exist at the repository root (except those awaiting their text)', () => {
    for (const file of Object.values(PRIVACY_POLICY_FILES)) {
      // [file, is it there]: absent while awaiting its text, present once it is not.
      expect([file, existsSync(join(ROOT, file))]).toEqual([file, !AWAITING_TEXT.has(file)]);
    }
  });
});
