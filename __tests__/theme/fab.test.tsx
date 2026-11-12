// The compose button (031, board InboxA): a perforated stamp in the flap's gold with "Napsat" and the
// compose glyph printed in its frame. These hold that it is that stamp in both themes, that it still
// composes, and that the list's clearance is measured from the stamp's real height.

import { fireEvent, render } from '@testing-library/react-native';
import { processColor, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { AppThemeProvider } from '../../src/theme/ThemeProvider';
import { Fab, useFabClearance } from '../../src/theme/Fab';
import { offsetPrint } from '../../src/theme/print';
import { darkTheme, lightTheme } from '../../src/theme/theme';

type Node = { type: string; props: Record<string, unknown>; children: (Node | string)[] | null };

function nodes(root: unknown): Node[] {
  const out: Node[] = [];
  const walk = (n: Node | string) => {
    if (typeof n === 'string') {
      return;
    }
    out.push(n);
    (n.children ?? []).forEach(walk);
  };
  (Array.isArray(root) ? root : root ? [root] : []).forEach(walk);
  return out;
}

const brush = (color: string) => JSON.stringify({ type: 0, payload: processColor(color) });
const style = (n: Node) => (StyleSheet.flatten(n.props.style as never) ?? {}) as Record<string, unknown>;

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function Clearance({ onValue }: { readonly onValue: (v: number) => void }) {
  onValue(useFabClearance());
  return null;
}

const mount = (isDark: boolean, onPress = jest.fn()) =>
  render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <TamaguiProvider config={tamaguiConfig} defaultTheme={isDark ? 'dark' : 'light'}>
        <AppThemeProvider isDark={isDark}>
          <Fab label="Napsat" onPress={onPress} accessibilityLabel="Napsat zprávu" testID="compose" />
        </AppThemeProvider>
      </TamaguiProvider>
    </SafeAreaProvider>,
  );

describe.each([
  ['light', false, lightTheme],
  ['dark', true, darkTheme],
] as const)('%s', (_label, isDark, theme) => {
  it('is a stamp in the flap\'s gold, framed, with the glow of a stamp lying on the paper', async () => {
    const view = await mount(isDark);
    // The stamp is drawn once it is laid out.
    let host = view.getByText('Napsat');
    while (host.props.onLayout == null && host.parent) {
      host = host.parent;
    }
    await fireEvent(host, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 140, height: 60 } } });
    const all = nodes(view.toJSON());
    expect(all.filter(n => JSON.stringify(n.props.fill) === brush(theme.flap))).toHaveLength(2);
    expect(all.filter(n => JSON.stringify(n.props.stroke) === brush(theme.flapFrame))).toHaveLength(1);
    expect(all.some(n => typeof style(n).filter === 'string' && /drop-shadow/.test(String(style(n).filter)))).toBe(
      true,
    );
    // No rounded gold square any more: nothing in it is filled with the old gold.
    expect(all.some(n => style(n).backgroundColor === theme.gold)).toBe(false);
  });

  it('prints "Napsat" and the compose glyph on the gold, the glyph on a white plane and a heavier line', async () => {
    const view = await mount(isDark);
    expect(style(view.getByText('Napsat') as unknown as Node).color).toBe(theme.onGold);
    const all = nodes(view.toJSON());
    expect(all.some(n => n.type === 'RNSVGGroup' && JSON.stringify(n.props.fill) === brush(theme.flapPlane))).toBe(
      true,
    );
    const ink = all.find(n => n.type === 'RNSVGGroup' && JSON.stringify(n.props.stroke) === brush(theme.onGold));
    expect(ink?.props.strokeWidth).toBe(offsetPrint.strokeOnFlap);
  });

  it('still composes, and says so', async () => {
    const onPress = jest.fn();
    const view = await mount(isDark, onPress);
    const button = view.getByTestId('compose');
    expect(button.props.accessibilityLabel).toBe('Napsat zprávu');
    await fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

it('keeps the list clear of the whole stamp: its 60 high, the safe area, the offset and a gap', async () => {
  let clearance = 0;
  await render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <Clearance onValue={v => (clearance = v)} />
    </SafeAreaProvider>,
  );
  // 34 safe area + 22 offset + (44 frame + 2 × (1 rule + 7 perforated margin)) + 20 gap
  expect(clearance).toBe(34 + 22 + 60 + 20);
});
