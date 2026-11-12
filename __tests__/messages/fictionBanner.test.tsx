// The fiction band (031, board Message): gold across the top of a message the law signed for, the day
// it did, and "Připomenout" - the reminder of the deadline that day started. These hold the words and
// the year rule, that the button opens the reminder, and the canvas's gold in both themes.

import { fireEvent, render } from '@testing-library/react-native';
import { processColor, StyleSheet } from 'react-native';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { AppThemeProvider } from '../../src/theme/ThemeProvider';
import { darkTheme, lightTheme } from '../../src/theme/theme';
import { setActiveLocale } from '../../src/i18n/strings';
import { FictionBanner, fikceBannerLabel } from '../../src/features/messages/screens/FictionBanner';

const SERVED = new Date(2026, 7, 29, 0, 0).getTime();
const NOW = new Date(2026, 10, 12, 10, 0).getTime();

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
const style = (n: unknown) =>
  (StyleSheet.flatten((n as Node).props.style as never) ?? {}) as Record<string, unknown>;

const mount = (isDark: boolean, onRemind = jest.fn()) =>
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme={isDark ? 'dark' : 'light'}>
      <AppThemeProvider isDark={isDark}>
        <FictionBanner servedAt={SERVED} onRemind={onRemind} />
      </AppThemeProvider>
    </TamaguiProvider>,
  );

afterEach(() => setActiveLocale('cs'));

describe('the words', () => {
  it('gives the day the law signed for it, as the board does', () => {
    expect(fikceBannerLabel(SERVED, NOW)).toBe('Doručeno fikcí 29.08. · bez vašeho přihlášení');
  });

  it('says the year when it is not this one, so last August does not read as this August', () => {
    const lastYear = new Date(2025, 7, 29).getTime();
    expect(fikceBannerLabel(lastYear, NOW)).toBe('Doručeno fikcí 29.08.2025 · bez vašeho přihlášení');
  });

  it('says it in English', () => {
    setActiveLocale('en');
    expect(fikceBannerLabel(SERVED, NOW)).toMatch(/29\.08\./);
  });
});

it('opens the reminder from "Připomenout", a button that says what it does', async () => {
  const onRemind = jest.fn();
  const view = await mount(false, onRemind);
  const button = view.getByTestId('fikceRemind');
  expect(button.props.accessibilityRole).toBe('button');
  expect(button.props.accessibilityLabel).toBe('Připomenout');
  expect(style(view.getByText('Připomenout')).textDecorationLine).toBe('underline');
  await fireEvent.press(button);
  expect(onRemind).toHaveBeenCalledTimes(1);
});

describe.each([
  ['light', false, lightTheme, '#FBEFD0', '#8C6100'],
  ['dark', true, darkTheme, '#33290F', '#F0C452'],
] as const)('%s', (_label, isDark, theme, band, ink) => {
  it("is the canvas's gold band, its words and the fiction glyph in the gold ink on the gold plane", async () => {
    const view = await mount(isDark);
    expect(style(view.getByTestId('fikceBanner')).backgroundColor).toBe(band);
    expect(style(view.getByText(/^Doručeno fikcí/)).color).toBe(ink);
    expect(style(view.getByText('Připomenout')).color).toBe(ink);
    const all = nodes(view.toJSON());
    expect(all.some(n => n.type === 'RNSVGGroup' && JSON.stringify(n.props.stroke) === brush(ink))).toBe(true);
    expect(
      all.some(n => n.type === 'RNSVGGroup' && JSON.stringify(n.props.fill) === brush(theme.iconPlaneGold)),
    ).toBe(true);
  });
});
