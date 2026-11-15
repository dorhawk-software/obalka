// The welcome is R1's (031 I04, agreed 2026-11-12): the envelope with its window empty - "Komu" over two
// blank lines, waiting for a box - the name, the tagline, the dark action, the sunken restore with the
// archive glyph, the help link in blue, and the language as a sunken pill. Until 2026-11-15 it was the
// logo badge over the name, an outlined restore, a muted help line and a bare language label.

import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { AppThemeProvider } from '../../src/theme/ThemeProvider';
import { lightTheme } from '../../src/theme/theme';
import { Welcome } from '../../src/features/accounts/screens/Welcome';
import { SettingsProvider } from '../../src/app/settings/SettingsProvider';
import { settingsStore } from '../../src/features/accounts/deps';
import { t } from '../../src/i18n/strings';

const flat = (node: { props: Record<string, unknown> }) =>
  (StyleSheet.flatten(node.props.style as never) ?? {}) as Record<string, unknown>;

const hidden = { includeHiddenElements: true };

beforeEach(() => {
  jest.spyOn(settingsStore, 'getSetting').mockResolvedValue(null);
  jest.spyOn(settingsStore, 'setSetting').mockResolvedValue();
});

afterEach(() => jest.restoreAllMocks());

const welcome = () =>
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <AppThemeProvider isDark={false}>
        <SettingsProvider>
          <Welcome onAddBox={() => {}} onOpenFaq={() => {}} onRestore={() => {}} canTransfer />
        </SettingsProvider>
      </AppThemeProvider>
    </TamaguiProvider>,
  );

describe('the welcome, as R1 draws it', () => {
  it('shows the envelope waiting for a box: its window says Komu and nothing else', async () => {
    const view = await welcome();
    const window = view.getByTestId('welcome-window', hidden);
    // Only "Komu": the lines under it are blank, drawn, with nothing to read.
    expect(window).toHaveTextContent(new RegExp(`^${t('detail.to')}$`));
  });

  it('restores from a sunken button, not an outlined one', async () => {
    const view = await welcome();
    const style = flat(view.getByTestId('welcome-restore-face', hidden));
    expect(style.backgroundColor).toBe(lightTheme.surfaceSunken);
    expect(style.borderWidth ?? 0).toBe(0);
  });

  it('offers help as a blue link', async () => {
    const view = await welcome();
    expect(view.getByText(t('faq.help'))).toHaveStyle({ color: lightTheme.blue });
  });

  it('puts the language in a sunken pill', async () => {
    const view = await welcome();
    expect(flat(view.getByTestId('welcome-language'))).toMatchObject({
      backgroundColor: lightTheme.surfaceSunken,
      borderTopLeftRadius: 999,
    });
  });
});
