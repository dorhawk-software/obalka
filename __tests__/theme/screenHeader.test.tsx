// One header bar, and no ninth copy of it (impeccable audit, 2026-09-09).
//
// `ScreenHeader` was written to stop exactly this, and said so in its own first paragraph - "One
// component so those copies can't drift (constitution V - visual consistency)". It then had ONE
// consumer while the eight screens it names each built their own, and they drifted into four
// different bars: three vertical rhythms, two chevron sizes (44 and 40), gaps of 0, 4 and 6, and a
// title line box of 22 in compose against 23 in the other seven. Three of the copies had also
// dropped `accessibilityRole="header"`, so a screen reader could not jump to the title there.
//
// None of that is catchable by reading a diff - each copy looked right on its own screen. It is
// catchable by asking who draws a back chevron, which is what this file does.

import { render } from '@testing-library/react-native';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { AppThemeProvider } from '../../src/theme/ThemeProvider';
import { ScreenHeader } from '../../src/theme/ScreenHeader';

const ROOT = join(__dirname, '../..');
const SRC = join(ROOT, 'src');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(entry => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      return sourceFiles(full);
    }
    return /\.tsx$/.test(entry) ? [full] : [];
  });
}

/**
 * The two files allowed to name the back chevron.
 *
 * `MessageDetail` is the documented exemption and has been since this component was written: an
 * entity screen carries a context subtitle and a row of actions that the shared bar does not model.
 * Everything else - every screen that shows a name and a way back - goes through `ScreenHeader`.
 */
const ALLOWED = new Set([
  'src/theme/icons.tsx',
  'src/theme/ScreenHeader.tsx',
  'src/features/messages/screens/MessageDetail.tsx',
]);

describe('the back chevron', () => {
  it('is drawn in one place, plus the one documented exemption', () => {
    const drawers = sourceFiles(SRC)
      .filter(f => /<ChevronLeftIcon\b/.test(readFileSync(f, 'utf8')))
      .map(f => relative(ROOT, f))
      .filter(f => !ALLOWED.has(f));
    expect(drawers).toEqual([]);
  });
});

function wrap(ui: React.ReactElement) {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <AppThemeProvider isDark={false}>{ui}</AppThemeProvider>
      </TamaguiProvider>
    </SafeAreaProvider>,
  );
}

describe('ScreenHeader', () => {
  it('announces its title as a heading, on every screen at once', async () => {
    // The half three of the copies had lost. A screen reader user navigates by heading; without it
    // the only way to learn which screen you are on is to sweep the whole page.
    const view = await wrap(
      <ScreenHeader title="Nastavení" onBack={() => {}} />,
    );
    expect(view.getByText('Nastavení').props.accessibilityRole).toBe('header');
  });

  it('gives the back control a label and a role', async () => {
    const view = await wrap(<ScreenHeader title="Nastavení" onBack={() => {}} />);
    const back = view.getByTestId('back');
    expect(back.props.accessibilityRole).toBe('button');
    expect(back.props.accessibilityLabel).toBeTruthy();
  });

  it('grows the 44pt chevron to the 48 a finger needs', async () => {
    const view = await wrap(<ScreenHeader title="Nastavení" onBack={() => {}} />);
    const slop = view.getByTestId('back').props.hitSlop;
    expect(44 + slop.top + slop.bottom).toBeGreaterThanOrEqual(48);
    expect(44 + slop.left + slop.right).toBeGreaterThanOrEqual(48);
  });

  it('draws no back control when there is nowhere to go', async () => {
    const view = await wrap(<ScreenHeader title="Nastavení" />);
    expect(view.queryByTestId('back')).toBeNull();
  });

  it('takes a control in place of the title, for the search field', async () => {
    const view = await wrap(
      <ScreenHeader onBack={() => {}} content={<View testID="header-slot" />} />,
    );
    expect(view.getByTestId('header-slot')).toBeTruthy();
    expect(view.queryByText('Nastavení')).toBeNull();
  });
});
