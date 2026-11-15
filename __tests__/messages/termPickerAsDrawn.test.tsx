// The reminder picker as board R9 draws it (031 I57, agreed 2026-11-12): the reminder's glyph in a
// well beside the title, the promise under them in small muted text, the presets one card of 50 rows
// with their labels in the bold small role, and Odebrat in the danger ink beside Uložit.

import { render, within } from '@testing-library/react-native';
import { StyleSheet, type StyleProp, type TextStyle } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { AppThemeProvider } from '../../src/theme/ThemeProvider';
import { lightTheme } from '../../src/theme/theme';
import { type as typeScale } from '../../src/theme/typeScale';
import { t } from '../../src/i18n/strings';
import { TermPicker } from '../../src/features/messages/screens/TermPicker';
import { SenderSheet } from '../../src/features/messages/screens/SenderPicker';
import type { DataBoxAccount } from '../../src/services/isds/types';

const styleOf = (node: { props: Record<string, unknown> }) =>
  (StyleSheet.flatten(node.props.style as StyleProp<TextStyle>) ?? {}) as Record<string, unknown>;

const mount = (current: number | null = null) =>
  render(
    <SafeAreaProvider>
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <AppThemeProvider isDark={false}>
          <TermPicker current={current} onPick={() => {}} onRemove={() => {}} onClose={() => {}} />
        </AppThemeProvider>
      </TamaguiProvider>
    </SafeAreaProvider>,
  );

describe('the reminder picker, as R9 draws it', () => {
  it('titles the sheet in the title role, the promise in small muted text under it', async () => {
    const view = await mount();
    const title = styleOf(view.getByRole('header', { name: t('term.title') }));
    expect([title.fontSize, title.lineHeight]).toEqual([typeScale.title.fontSize, typeScale.title.lineHeight]);
    const sub = styleOf(view.getByTestId('term-sub'));
    expect([sub.fontSize, sub.color]).toEqual([typeScale.small.fontSize, lightTheme.textMuted]);
  });

  it('gives each preset a 50 row with its label in the bold small role', async () => {
    const view = await mount();
    const row = view.getByTestId('term-week');
    expect(styleOf(row).minHeight).toBe(50);
    const label = styleOf(within(row).getByText(t('term.preset.week')));
    expect(label.fontFamily).toBe(typeScale.smallStrong.fontFamily);
  });

  it('sets Odebrat in the danger ink beside Uložit', async () => {
    const view = await mount(Date.now() + 7 * 86_400_000);
    const remove = within(view.getByTestId('term-remove')).getByText(t('term.remove'), {
      includeHiddenElements: true,
    });
    expect(styleOf(remove).color).toBe(lightTheme.danger);
    expect(view.getByTestId('term-save')).toBeTruthy();
  });
});

// The sender sheet as R9 draws it (031 I58): rows 60 tall at the least, the box's envelope tile, and the
// Language rows' radio - a blue ring with a 12 blue dot, not a filled disc.
describe('the sender sheet, as R9 draws it', () => {
  const boxes = [
    { id: 'a1', boxId: 'k4m9xrt', label: 'Jana Nováková', alias: null, dbType: 'FO' },
    { id: 'a2', boxId: 'c3zt8vn', label: 'NOVÁK STAVBY s.r.o.', alias: null, dbType: 'PO' },
  ] as unknown as DataBoxAccount[];

  it('gives each box a 60 row and marks the chosen one with the ring and its dot', async () => {
    const view = await render(
      <SafeAreaProvider>
        <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
          <AppThemeProvider isDark={false}>
            <SenderSheet accounts={boxes} selected="k4m9xrt" onPick={() => {}} onClose={() => {}} />
          </AppThemeProvider>
        </TamaguiProvider>
      </SafeAreaProvider>,
    );
    expect(styleOf(view.getByTestId('senderOption-c3zt8vn')).minHeight).toBe(60);
    const ring = styleOf(view.getByTestId('senderOption-on'));
    expect([ring.borderTopColor, ring.backgroundColor]).toEqual([lightTheme.blue, undefined]);
    expect(view.getByTestId('envelopeTile-k4m9xrt', { includeHiddenElements: true })).toBeTruthy();
  });
});
