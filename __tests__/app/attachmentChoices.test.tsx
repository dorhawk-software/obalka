// The two questions 026 added, as a person meets them (US1, US2, US4).
//
// "Zálohovat i přílohy?" offers the two modes as rows with their numbers, and saves only the one that
// was confirmed; the backup list says what each backup holds. "Stahovat přílohy automaticky?" offers
// new messages only or every message, and neither dialog tells anyone that a download delivers a
// message - it does not (Provozní řád ISDS ch. 8).

import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { AppThemeProvider } from '../../src/theme/ThemeProvider';
import { fakeController, manifest, mount } from '../helpers/backupScreenHarness';
import { t } from '../../src/i18n/strings';

const mockSetAutoDownload = jest.fn();
const mockSettings = {
  themeMode: 'system' as const,
  locale: 'cs' as const,
  appLock: false,
  scanAttachments: false,
  autoDownload: { on: false, since: null, wifiOnly: true },
  setAutoDownload: (...args: unknown[]) => mockSetAutoDownload(...args),
  setAutoDownloadWifiOnly: jest.fn(),
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

describe('"Zálohovat i přílohy?" (026 US1)', () => {
  const documentsPhone = () => {
    const fake = fakeController({ enabled: true, last: manifest(1_000), documentsPossible: true });
    fake.state.estimate = { count: 12, plainBytes: 3_000_000, sealedBytes: 3_000_192, gone: 0 };
    fake.state.missing = { askable: 57, gone: 12 };
    return fake;
  };

  it('offers both modes with their numbers, and saves the one confirmed', async () => {
    const fake = documentsPhone();
    const view = await mount(fake);
    await act(async () => {
      fireEvent.press(view.getByTestId('backup-documents-toggle'));
    });
    await waitFor(() => expect(view.getByTestId('backup-documents-dialog')).toBeTruthy());
    expect(view.getByText(t('backup.docs.mode.all.count.many', { n: 57 }))).toBeTruthy();
    // The downloaded row is selected first, and says what it adds.
    expect(view.getByText(t('backup.docs.mode.downloaded.explain'))).toBeTruthy();

    await act(async () => {
      fireEvent.press(view.getByTestId('backup-documents-mode-all'));
    });
    // The explanation follows the row: it never says a download delivers anything, and it counts
    // what ISDS has already deleted.
    expect(view.getByText(t('backup.docs.mode.all.explain'))).toBeTruthy();
    expect(view.getByText(t('backup.docs.mode.all.gone.many', { n: 12 }))).toBeTruthy();
    expect(fake.state.calls.some(c => c.startsWith('setPreferences'))).toBe(false);

    await act(async () => {
      fireEvent.press(view.getByTestId('backup-documents-confirm'));
    });
    expect(fake.state.calls).toContain('setPreferences:{"documentMode":"all","documents":true}');
  });

  it('shows the mode once on, and "Změnit" asks again with it selected', async () => {
    const fake = documentsPhone();
    fake.state.status = { ...fake.state.status, documentsOn: true, documentMode: 'all' };
    fake.state.prefs = { automatic: true, keep: 1, documents: true, documentMode: 'all' };
    const view = await mount(fake);
    await waitFor(() => expect(view.getByTestId('backup-documents-mode')).toBeTruthy());
    expect(view.getByText(t('backup.docs.desc.on.all'))).toBeTruthy();

    await act(async () => {
      fireEvent.press(view.getByTestId('backup-documents-mode'));
    });
    await waitFor(() => expect(view.getByText(t('backup.docs.change.title'))).toBeTruthy());
    expect(view.getByTestId('backup-documents-mode-all').props.accessibilityState).toEqual({
      selected: true,
    });
    expect(view.getByTestId('backup-documents-confirm').props.accessibilityLabel).toBe(
      t('backup.docs.ask.save'),
    );
  });

  it('says in the list what each backup holds (026 US2)', async () => {
    const fake = documentsPhone();
    fake.state.backups = [
      {
        manifest: manifest(3_000, 2, {
          tiers: { metadata: true, documents: true },
          documentMode: 'all',
          documentsMissing: 1,
        }),
        compatibility: { kind: 'current' },
        restorable: true,
      },
      { manifest: manifest(2_000), compatibility: { kind: 'current' }, restorable: true },
    ] as never;
    const view = await mount(fake);
    await waitFor(() => expect(view.getByTestId('backup-docs-0')).toBeTruthy());
    expect(view.getByText(t('backup.docs.chip.all'))).toBeTruthy();
    expect(view.getByText(t('backup.docs.missing.one'))).toBeTruthy();
    expect(view.getByText(t('backup.docs.chip.none'))).toBeTruthy();
  });
});

describe('"Stahovat přílohy automaticky?" (026 US4)', () => {
  const mountSettings = () =>
    render(
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

  beforeEach(() => mockSetAutoDownload.mockClear());

  it('is off, with the Wi-Fi row drawn but not usable', async () => {
    const view = await mountSettings();
    expect(view.getByText(t('settings.autoDownload.desc.off'))).toBeTruthy();
    expect(view.getByTestId('auto-download-wifi-toggle')).toBeTruthy();
  });

  it('asks which messages before it switches on, new ones by default', async () => {
    const view = await mountSettings();
    await act(async () => {
      fireEvent.press(view.getByTestId('auto-download-toggle'));
    });
    expect(view.getByTestId('auto-download-dialog')).toBeTruthy();
    expect(mockSetAutoDownload).not.toHaveBeenCalled();
    expect(view.getByText(t('settings.autoDownload.ask.body'))).toBeTruthy();

    await act(async () => {
      fireEvent.press(view.getByTestId('auto-download-confirm'));
    });
    expect(mockSetAutoDownload).toHaveBeenCalledWith(true, true);
  });

  it('can reach back to the messages already on the phone', async () => {
    const view = await mountSettings();
    await act(async () => {
      fireEvent.press(view.getByTestId('auto-download-toggle'));
    });
    await act(async () => {
      fireEvent.press(view.getByTestId('auto-download-scope-all'));
    });
    await act(async () => {
      fireEvent.press(view.getByTestId('auto-download-confirm'));
    });
    expect(mockSetAutoDownload).toHaveBeenCalledWith(true, false);
  });

  it('leaves it off when the question is dismissed', async () => {
    const view = await mountSettings();
    await act(async () => {
      fireEvent.press(view.getByTestId('auto-download-toggle'));
    });
    await act(async () => {
      fireEvent.press(view.getByTestId('auto-download-cancel'));
    });
    expect(view.queryByTestId('auto-download-dialog')).toBeNull();
    expect(mockSetAutoDownload).not.toHaveBeenCalled();
  });
});
