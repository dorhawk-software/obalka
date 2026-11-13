// The inbox header (031, board "Inbox - the envelope front"): the list hangs from the front of an
// envelope. These hold what makes it that envelope - the flap's outline, the box named in the window,
// the controls printed on the blue - in both themes, and what it still has to do: switch boxes,
// search, change folder, and say when Odeslané has news.

import { fireEvent, render } from '@testing-library/react-native';
import { processColor, StyleSheet } from 'react-native';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { AppThemeProvider } from '../../src/theme/ThemeProvider';
import { darkTheme, lightTheme } from '../../src/theme/theme';
import { InboxHeader, headerFlapPath } from '../../src/features/messages/screens/InboxHeader';
import type { DataBoxAccount } from '../../src/services/isds/types';
import type { MessageFolder } from '../../src/services/db/messagesStore';

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

const ACCOUNT = {
  boxId: 'k4m9xrt',
  label: 'Ondřej Dvořák',
  alias: null,
  dbType: 'FO',
  host: 'production',
} as unknown as DataBoxAccount;

function header(
  isDark: boolean,
  over: Partial<{
    folder: MessageFolder;
    sentNews: number;
    unified: { count: number; colors: string[] } | null;
  }> = {},
) {
  const calls = { switcher: 0, search: 0, folder: [] as MessageFolder[] };
  const view = render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme={isDark ? 'dark' : 'light'}>
      <AppThemeProvider isDark={isDark}>
        <InboxHeader
          account={ACCOUNT}
          unified={over.unified ?? null}
          isTestBox={false}
          folder={over.folder ?? 'received'}
          onFolder={f => calls.folder.push(f)}
          sentNews={over.sentNews ?? 0}
          onOpenSwitcher={() => {
            calls.switcher += 1;
          }}
          onSearch={() => {
            calls.search += 1;
          }}
        />
      </AppThemeProvider>
    </TamaguiProvider>,
  );
  return { view, calls };
}

describe('the flap', () => {
  it('is the board\'s outline at the board\'s size', () => {
    expect(headerFlapPath(390, 70)).toBe('M0 0H390V50L211 63Q195 67 179 63L0 50Z');
  });

  it('comes down to the window on a taller status bar, its point centred', () => {
    expect(headerFlapPath(430, 79)).toBe('M0 0H430V59L231 72Q215 76 199 72L0 59Z');
  });
});

describe.each([
  ['light', false, lightTheme],
  ['dark', true, darkTheme],
] as const)('%s', (_label, isDark, theme) => {
  it('is the envelope\'s blue with the gold flap across the top', async () => {
    const { view } = header(isDark);
    const all = nodes((await view).toJSON());
    expect(style(all[0]).backgroundColor).toBe(theme.envelope);
    expect(all.some(n => n.type === 'RNSVGPath' && JSON.stringify(n.props.fill) === brush(theme.flap))).toBe(
      true,
    );
  });

  it('names the box in the window, and the window opens the switcher', async () => {
    const { view, calls } = header(isDark);
    const v = await view;
    const button = v.getByTestId('boxSwitcher');
    expect(button.props.accessibilityLabel).toBe('Ondřej Dvořák');
    expect(v.getByText('Ondřej Dvořák')).toBeTruthy();
    expect(v.getByText(' · ID k4m9xrt')).toBeTruthy();
    await fireEvent.press(button);
    expect(calls.switcher).toBe(1);
    const windowPaper = nodes(v.toJSON()).find(n => style(n).backgroundColor === theme.window);
    expect(windowPaper).toBeDefined();
  });

  it('searches from the round button printed on the blue', async () => {
    const { view, calls } = header(isDark);
    const v = await view;
    await fireEvent.press(v.getByTestId('openSearch'));
    expect(calls.search).toBe(1);
    const planes = nodes(v.toJSON()).filter(
      n => n.type === 'RNSVGGroup' && JSON.stringify(n.props.fill) === brush(theme.envelopePlane),
    );
    expect(planes).toHaveLength(1);
  });

  it('prints Přijaté | Odeslané in the envelope\'s well', async () => {
    const { view, calls } = header(isDark);
    const v = await view;
    expect(style(v.getByTestId('messagesFolder')).backgroundColor).toBe(theme.envelopeWell);
    await fireEvent.press(v.getByTestId('messagesFolder-sent'));
    expect(calls.folder).toEqual(['sent']);
  });

  it('marks news in Odeslané with the flap\'s gold, which shows on the blue', async () => {
    const { view } = header(isDark, { sentNews: 2 });
    const v = await view;
    expect(style(v.getByTestId('messagesFolder-sent-dot')).backgroundColor).toBe(theme.flap);
  });

  it('shows all boxes as their envelopes fanned, the count on the front one (R5)', async () => {
    const colors = ['#2563A6', '#12706A', '#5A4CA8'];
    const v = await header(isDark, { unified: { count: 3, colors } }).view;
    const tile = v.getByTestId('boxStackTile', { includeHiddenElements: true });
    const stack = nodes(v.toJSON()).find(n => n.props.testID === 'boxStackTile');
    const fills = nodes(stack).map(n => style(n).backgroundColor);
    for (const color of colors) {
      expect(fills).toContain(color);
    }
    expect(tile).toHaveTextContent('3');
    expect(v.getByText('Sloučený archiv · 3 schránky')).toBeTruthy();
  });
});
