// Welcome's language picker over a list of THREE (2026-09-24).
//
// The corner used to be a switch to "the other language" - `LANGUAGES.find(l => l.code !== locale)`,
// which works for exactly two and silently offers only one of two others the day a third arrives
// (Ukrainian is the likely one). So the list is given a third entry here and the picker, and the
// Settings rows it shares, must show all three: they map `LANGUAGES`, they do not name languages.

import { act, fireEvent, render, waitFor, within } from '@testing-library/react-native';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { AppThemeProvider } from '../../src/theme/ThemeProvider';
import { Welcome } from '../../src/features/accounts/screens/Welcome';
import { SettingsProvider } from '../../src/app/settings/SettingsProvider';
import { LanguageChoice } from '../../src/app/settings/LanguageChoice';
import { settingsStore } from '../../src/features/accounts/deps';
import { setActiveLocale } from '../../src/i18n/strings';

// A language this build does not ship - only its entry in the list exists. Written inside the factory,
// which jest runs before anything at this file's top level.
jest.mock('../../src/app/settings/languages', () => {
  const actual = jest.requireActual('../../src/app/settings/languages');
  return {
    ...actual,
    LANGUAGES: [...actual.LANGUAGES, { code: 'uk', name: 'Українська', flag: null }],
  };
});

const wrap = (ui: React.ReactElement) =>
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <AppThemeProvider isDark={false}>{ui}</AppThemeProvider>
    </TamaguiProvider>,
  );

beforeEach(() => {
  jest.spyOn(settingsStore, 'getSetting').mockResolvedValue(null);
  jest.spyOn(settingsStore, 'setSetting').mockResolvedValue();
});

afterEach(() => {
  jest.restoreAllMocks();
  setActiveLocale('cs');
});

it('lists every language in the list, not the one other than the current', async () => {
  const view = await wrap(
    <SettingsProvider>
      <Welcome onAddBox={() => {}} onOpenFaq={() => {}} onRestore={() => {}} canTransfer />
    </SettingsProvider>,
  );
  await waitFor(() => expect(view.getByTestId('welcome-language')).toBeTruthy());
  await act(async () => {
    fireEvent.press(view.getByTestId('welcome-language'));
  });
  const sheet = view.getByTestId('language-sheet');

  expect(within(sheet).getAllByRole('radio')).toHaveLength(3);
  expect(within(within(sheet).getByTestId('lang-uk')).getByText('Українська')).toBeTruthy();
  expect(within(sheet).getByTestId('lang-cs').props.accessibilityState).toEqual({ selected: true });
  expect(within(sheet).getByTestId('lang-uk').props.accessibilityState).toEqual({
    selected: false,
  });
});

it('gives Settings the same three rows', async () => {
  const view = await wrap(<LanguageChoice value="cs" onChange={() => {}} />);
  expect(view.getAllByRole('radio')).toHaveLength(3);
  expect(view.getByText('Українська')).toBeTruthy();
});
