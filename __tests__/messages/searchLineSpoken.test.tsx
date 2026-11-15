// The recipient search says aloud what it is doing (031 T050, the native audit).
//
// The line under the recipient field - looking, no one found, an error - appears away from where a
// screen reader's cursor is, and nothing announced it: someone using one typed a box ID and heard
// silence.

import { render } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { AppThemeProvider } from '../../src/theme/ThemeProvider';
import { SearchLine } from '../../src/features/messages/screens/ComposeParts';
import { t } from '../../src/i18n/strings';

const line = (state: Parameters<typeof SearchLine>[0]['state'], error: string | null = null) => (
  <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
    <AppThemeProvider isDark={false}>
      <SearchLine state={state} error={error} />
    </AppThemeProvider>
  </TamaguiProvider>
);

let announce: jest.SpyInstance;
beforeEach(() => {
  announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
});
afterEach(() => announce.mockRestore());

it.each([
  ['searching', null, (): string => t('send.recipient.searching')],
  ['none', null, (): string => t('send.recipient.none')],
  ['error', 'Spojení se nepodařilo.', (): string => 'Spojení se nepodařilo.'],
] as const)('says "%s" when it appears', async (state, error, words) => {
  await render(line(state, error));
  expect(announce).toHaveBeenCalledWith(words());
});

it('stays quiet for the hint, which is there from the start', async () => {
  await render(line('hint'));
  expect(announce).not.toHaveBeenCalled();
});
