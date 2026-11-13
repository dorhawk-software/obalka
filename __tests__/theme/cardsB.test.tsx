// Cards B (031, board R3, agreed 2026-11-12) and the Settings parts board R13 draws with it: a card is a
// sheet with weight and no line around it; a picked option shows a blue ring with a blue dot; a row that
// cannot be used greys once, not twice. Each of these was built against the board and walked on the
// Obalka_Demo emulator beside it.

import { render } from '@testing-library/react-native';
import { StyleSheet, View } from 'react-native';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { AppThemeProvider } from '../../src/theme/ThemeProvider';
import { darkTheme, lightTheme } from '../../src/theme/theme';
import { objectShadow } from '../../src/theme/depth';
import { Card } from '../../src/theme/Card';
import { OptionGroup } from '../../src/theme/OptionGroup';
import { Toggle } from '../../src/theme/Toggle';
import { Text } from '../../src/theme/ui';
import { CardRow, Well } from '../../src/app/settings/SettingsSection';

const themed = (ui: React.ReactElement, isDark = false) =>
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme={isDark ? 'dark' : 'light'}>
      <AppThemeProvider isDark={isDark}>{ui}</AppThemeProvider>
    </TamaguiProvider>,
  );

/** A node's style, flattened; Tamagui writes a border or a corner out per side. */
const flat = (node: { props: { style?: unknown } }) =>
  (StyleSheet.flatten(node.props.style as never) ?? {}) as Record<string, unknown>;

describe('a card', () => {
  it.each([
    ['light', false],
    ['dark', true],
  ] as const)('is a sheet with weight and no line around it, in %s', async (name, isDark) => {
    const view = await themed(
      <Card testID="card">
        <Text>x</Text>
      </Card>,
      isDark,
    );
    const style = flat(view.getByTestId('card'));
    expect(style.borderWidth ?? 0).toBe(0);
    expect(style.borderTopWidth ?? 0).toBe(0);
    expect(style.boxShadow).toBe(objectShadow(name, 'sheet'));
    expect(style.backgroundColor).toBe((isDark ? darkTheme : lightTheme).surface);
    expect(style.borderTopLeftRadius).toBe(14);
  });
});

describe('an option group', () => {
  it('shows the pick by its radio alone: a blue ring with a blue dot, and a plain ring beside it', async () => {
    const view = await themed(
      <OptionGroup
        options={[
          { value: 'cs', label: 'Čeština' },
          { value: 'en', label: 'English' },
        ]}
        value="cs"
        onChange={() => {}}
        testIDPrefix="lang"
      />,
    );
    const radio = (id: string) => {
      const row = view.getByTestId(id);
      const ring = row.children[row.children.length - 1] as unknown as { props: { style?: unknown }; children: unknown[] };
      const dot = ring.children[0] as { props: { style?: unknown } };
      return { ring: flat(ring), dot: flat(dot) };
    };
    const picked = radio('lang-cs');
    const other = radio('lang-en');
    expect(picked.ring).toEqual(expect.objectContaining({ width: 22, height: 22, borderTopWidth: 2, borderTopColor: lightTheme.blue }));
    expect(picked.dot).toEqual(expect.objectContaining({ width: 12, height: 12, backgroundColor: lightTheme.blue, opacity: 1 }));
    expect(other.ring.borderTopColor).toBe(lightTheme.borderStrong);
    expect(other.dot.opacity).toBe(0);
  });
});

describe('a row that cannot be used', () => {
  it('greys once: the row at 0.55, its switch not again on top', async () => {
    const view = await themed(
      <View>
        <CardRow last indent dimmed testID="row">
          <Text>Jen na Wi-Fi</Text>
          <Toggle value onChange={() => {}} label="Jen na Wi-Fi" disabled rowDims testID="inRow" />
        </CardRow>
        <Toggle value onChange={() => {}} label="Samostatně" disabled testID="alone" />
      </View>,
    );
    expect(flat(view.getByTestId('row'))).toEqual(expect.objectContaining({ opacity: 0.55, paddingLeft: 66 }));
    // Faded as one picture: on Android each child faded alone, and the blue track showed through the
    // white knob (the dark walk beside R13).
    expect(view.getByTestId('row').props.needsOffscreenAlphaCompositing).toBe(true);
    expect(flat(view.getByTestId('inRow')).opacity ?? 1).toBe(1);
    expect(flat(view.getByTestId('alone')).opacity).toBe(0.6);
  });
});

describe('a well', () => {
  it('is 40 with the 12 corner, sunken, under a 24 glyph', async () => {
    const view = await themed(
      <View testID="holder">
        <Well name="lock" />
      </View>,
    );
    const holder = view.getByTestId('holder', { includeHiddenElements: true });
    const well = holder.children[0] as unknown as { props: { style?: unknown } };
    expect(flat(well)).toEqual(
      expect.objectContaining({ width: 40, height: 40, borderTopLeftRadius: 12, backgroundColor: lightTheme.surfaceSunken }),
    );
  });
});
