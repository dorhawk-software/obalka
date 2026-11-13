// The archive search as board R4 draws it (031, agreed 2026-11-12): the field is a paper well in the
// header with the search glyph before the words, no outline; the hint under it is the stack of
// envelopes. The outline and the missing glyph were the owner's catch beside the board (2026-11-13).

import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { TamaguiProvider } from 'tamagui';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { tamaguiConfig } from '../../tamagui.config';
import { lightTheme } from '../../src/theme/theme';
import { fonts } from '../../src/theme/typeScale';

jest.mock('../../src/features/accounts/deps', () => ({
  messagesController: { searchMessages: jest.fn(async () => []) },
}));

import { SearchScreen } from '../../src/features/messages/screens/SearchScreen';

async function open() {
  return render(
    <SafeAreaProvider
      initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } }}
    >
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <SearchScreen accounts={[]} onBack={() => {}} onOpenMessage={() => {}} />
      </TamaguiProvider>
    </SafeAreaProvider>,
  );
}

it('draws the field as a paper well with the search glyph first, and no outline', async () => {
  const view = await open();
  const input = view.getByTestId('search-input');
  const flat = (StyleSheet.flatten(view.getByTestId('search-field').props.style as never) ?? {}) as Record<
    string,
    unknown
  >;
  expect(flat.backgroundColor).toBe(lightTheme.bg);
  expect(flat.borderTopWidth ?? flat.borderWidth ?? 0).toBe(0);
  // The glyph sits before the words, in the placeholder's muted ink.
  // (Inside the well: the back chevron before it is an SVG too.)
  const json = JSON.stringify(view.toJSON());
  const glyph = json.indexOf('RNSVGSvgView', json.indexOf('"search-field"'));
  expect(glyph).toBeGreaterThan(-1);
  expect(glyph).toBeLessThan(json.indexOf('"search-input"'));
  expect(input.props.placeholderTextColor).toBe(lightTheme.textMuted);
  // In the body face, not the system's (every field fell back to Roboto on Android).
  expect(StyleSheet.flatten(input.props.style).fontFamily).toBe(fonts.bodyRegular);
});

it('shows the stack of envelopes before anything is typed', async () => {
  const view = await open();
  expect(view.getByTestId('searchHint')).toBeTruthy();
  expect(view.getByTestId('envelopePose-archive', { includeHiddenElements: true })).toBeTruthy();
});
