// The box's ⋯ menu and the alias editor as board R9 draws them (031 I55 and I56, agreed 2026-11-12).
// The menu: a popover held up beside the ⋯, 230 across with the 14 corner, rows 48 with the words in
// the bold small role, a hairline above Odebrat in the danger ink, under the ⋯ or over it where the
// screen ends. The editor: a sheet with the box's envelope tile at 56 as the preview, the chosen colour
// ringed outside its edge, and Uložit alone - the sheet closes as every sheet does.

import { act, fireEvent, render, within } from '@testing-library/react-native';
import { StyleSheet, type StyleProp, type TextStyle } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { AppThemeProvider } from '../../src/theme/ThemeProvider';
import { lightTheme } from '../../src/theme/theme';
import { type as typeScale } from '../../src/theme/typeScale';
import { t } from '../../src/i18n/strings';
import { BoxOverflowMenu, placeMenu } from '../../src/features/accounts/screens/BoxOverflowMenu';
import { AliasEditor } from '../../src/features/accounts/screens/AliasEditor';
import type { DataBoxAccount } from '../../src/services/isds/types';

const styleOf = (node: { props: Record<string, unknown> }) =>
  (StyleSheet.flatten(node.props.style as StyleProp<TextStyle>) ?? {}) as Record<string, unknown>;

const box = {
  id: 'a1',
  boxId: 'k4m9xrt',
  label: 'Jana Nováková',
  alias: null,
  dbType: 'FO',
  color: '#2A5C9A',
} as unknown as DataBoxAccount;

const wrap = (node: React.ReactNode) =>
  render(
    <SafeAreaProvider>
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <AppThemeProvider isDark={false}>{node}</AppThemeProvider>
      </TamaguiProvider>
    </SafeAreaProvider>,
  );

describe('the ⋯ menu, as R9 draws it', () => {
  const screen = { width: 411, height: 914 };
  const insets = { top: 24, bottom: 24 };
  const trigger = { x: 353, y: 547, width: 38, height: 38 };

  it('stands under the ⋯, its right edge on the ⋯ s, reaching 2 over it', () => {
    expect(placeMenu(trigger, 157, screen, insets)).toEqual({ top: 547 + 38 - 2, right: 411 - 391 });
  });

  it('opens upwards from the ⋯ where the screen leaves no room below', () => {
    const low = { ...trigger, y: 800 };
    expect(placeMenu(low, 157, screen, insets)).toEqual({ top: 800 + 2 - 157, right: 20 });
  });

  it('is not placed until the ⋯ and the menu are both measured', () => {
    expect(placeMenu(null, 157, screen, insets)).toBeNull();
    expect(placeMenu(trigger, 0, screen, insets)).toBeNull();
  });

  it('is the surface with the 14 corner, rows of 48, and Odebrat under a hairline in the danger ink', async () => {
    const view = await wrap(
      <BoxOverflowMenu account={box} onRename={() => {}} onRemove={() => {}} onChangePassword={() => {}} />,
    );
    await act(async () => {
      fireEvent.press(view.getByTestId('boxMenu-k4m9xrt'));
    });
    const list = view.getByTestId('boxMenuList-k4m9xrt');
    expect([styleOf(list).backgroundColor, styleOf(list).borderTopLeftRadius]).toEqual([lightTheme.surface, 14]);
    const rename = view.getByTestId('boxRename-k4m9xrt');
    expect(styleOf(rename).minHeight).toBe(48);
    expect(styleOf(within(rename).getByText(t('box.rename'))).fontFamily).toBe(typeScale.smallStrong.fontFamily);
    expect(styleOf(within(view.getByTestId('boxRemove-k4m9xrt')).getByText(t('box.remove'))).color).toBe(
      lightTheme.danger,
    );
    // The rows and the one hairline, in order: the hairline stands right above Odebrat.
    const kids = (list.children as { props: { testID?: string; style?: unknown } }[]).map(c =>
      c.props.testID ?? (styleOf(c as never).height === 1 ? 'hairline' : '?'),
    );
    expect(kids).toEqual(['boxRename-k4m9xrt', 'boxChangePassword-k4m9xrt', 'hairline', 'boxRemove-k4m9xrt']);
  });
});

describe('the alias editor, as R9 draws it', () => {
  it('is a sheet with the box s envelope tile at 56 as the preview, and Uložit alone', async () => {
    const view = await wrap(<AliasEditor account={box} onSave={() => {}} onClose={() => {}} />);
    expect(view.getByTestId('aliasEditor')).toBeTruthy();
    const tile = styleOf(view.getByTestId('aliasPreview', { includeHiddenElements: true }));
    expect([tile.width, tile.height, tile.borderRadius]).toEqual([56, 56, 16]);
    expect(view.getByTestId('aliasSave')).toBeTruthy();
    expect(view.queryByText(t('login.cancel'))).toBeNull();
  });

  it('rings the chosen colour outside its edge, with its corner on the 16 step', async () => {
    const view = await wrap(<AliasEditor account={box} onSave={() => {}} onClose={() => {}} />);
    const ring = styleOf(view.getByTestId('boxColor-ring'));
    expect([ring.top, ring.borderTopWidth, ring.borderTopLeftRadius, ring.borderTopColor]).toEqual([
      -4,
      2,
      16,
      lightTheme.text,
    ]);
  });
});
