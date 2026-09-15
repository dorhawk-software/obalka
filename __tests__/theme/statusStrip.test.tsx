// One strip across the top of a screen, drawn two ways (`src/theme/StatusStrip.tsx`).
//
// The Debug-mode recording strip (023 FR-007) was written as a copy of the test-environment banner, so
// that two strips in the same place would share their numbers. It kept them faithfully - and they were
// on neither of DESIGN.md's scales: a 5 padding and a 7 gap against spacing that runs
// 2/4/6/8/10/12/14/18, and a 12/15 label under a type scale that starts at 13 (review, 2026-09-15).
// These tests hold the numbers to the scales DESIGN.md states, hold the two strips to one reserved
// row, and check the two tones in both themes and at a large text size.

import { readFileSync } from 'fs';
import { join } from 'path';
import { StyleSheet, Text } from 'react-native';
import { act, render } from '@testing-library/react-native';
import { TamaguiProvider } from 'tamagui';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { tamaguiConfig } from '../../tamagui.config';
import { AppThemeProvider } from '../../src/theme/ThemeProvider';
import { darkTheme, lightTheme } from '../../src/theme/theme';
import { MIN_TARGET } from '../../src/theme/touchTarget';
import {
  STATUS_STRIP_ROW,
  statusStripColors,
} from '../../src/theme/StatusStrip';
import { TestEnvBanner } from '../../src/app/TestEnvBanner';
import { DebugRecordingFrame } from '../../src/app/DebugRecordingStrip';
import { cancelDebug } from '../../src/services/debug/debugController';
import { startDebugRecording } from '../../src/services/debug/debugLog';
import { t } from '../../src/i18n/strings';
import { occupiedLine } from '../helpers/textClipping';

const DESIGN = readFileSync(join(__dirname, '../../DESIGN.md'), 'utf8');

/** DESIGN.md's spacing scale, read from its front matter rather than retyped here. */
const SPACING = [
  ...DESIGN.split('\nspacing:\n')[1].split(/\n\S/)[0].matchAll(/"(\d+)px"/g),
].map(m => Number(m[1]));

/** The Badge role as DESIGN.md's type hierarchy states it: [size, line height]. */
const BADGE = (() => {
  const m = /\*\*Badge\*\* \(Public Sans Bold, (\d+)\/(\d+)\)/.exec(DESIGN);
  return m ? [Number(m[1]), Number(m[2])] : null;
})();

type Style = Record<string, unknown>;

interface StripStyles {
  readonly strip: Style;
  readonly row: Style;
  readonly label: Style;
  readonly labelProps: Record<string, unknown>;
}

interface MountOptions {
  /** The status-bar inset above the strip: 47 is an iPhone's, 0 is a screen under another strip. */
  readonly top?: number;
  readonly dark?: boolean;
}

function mount(node: React.ReactElement, { top = 47, dark = false }: MountOptions = {}) {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top, left: 0, right: 0, bottom: 34 },
      }}
    >
      <TamaguiProvider config={tamaguiConfig} defaultTheme={dark ? 'dark' : 'light'}>
        <AppThemeProvider isDark={dark}>{node}</AppThemeProvider>
      </TamaguiProvider>
    </SafeAreaProvider>,
  );
}

async function styles(
  node: React.ReactElement,
  testID: string,
  opts: MountOptions = {},
): Promise<StripStyles> {
  const view = await mount(node, opts);
  const flat = (id: string) =>
    (StyleSheet.flatten(view.getByTestId(id).props.style) ?? {}) as Style;
  return {
    strip: flat(testID),
    row: flat(`${testID}-row`),
    label: flat(`${testID}-label`),
    labelProps: view.getByTestId(`${testID}-label`).props,
  };
}

const banner = (opts: MountOptions = {}) =>
  styles(<TestEnvBanner show />, 'testEnvBanner', opts);

async function recordingStrip({
  pressable = true,
  ...opts
}: MountOptions & { readonly pressable?: boolean } = {}) {
  await act(async () => {
    startDebugRecording('standard');
  });
  return styles(
    <DebugRecordingFrame onOpen={pressable ? () => {} : undefined}>
      <Text>{'screen'}</Text>
    </DebugRecordingFrame>,
    'debugRecordingStrip',
    opts,
  );
}

/** Everything about a strip that decides how much room it takes. Colours are left out. */
function reserved({ strip, row, label }: StripStyles) {
  return {
    inset: strip.paddingTop,
    hairline: strip.borderBottomWidth,
    rowMinHeight: row.minHeight,
    rowHeight: row.height,
    padding: [row.paddingTop, row.paddingBottom, row.paddingLeft, row.paddingRight],
    gap: row.gap,
    // The line the label occupies: a Badge's 16 is drawn on a taller line with the extra taken back.
    type: [label.fontSize, occupiedLine(label)],
  };
}

afterEach(async () => {
  await act(async () => {
    cancelDebug();
  });
});

describe('the scale', () => {
  it('reads the scales DESIGN.md states, so nothing below passes against an empty one', () => {
    expect(SPACING).toEqual([2, 4, 6, 8, 10, 12, 14, 18]);
    expect(BADGE).toEqual([13, 16]);
  });

  it.each([
    ['the test banner', () => banner()],
    ['the recording strip', () => recordingStrip()],
  ])('draws %s with spacing from the scale and the Badge type step', async (_name, draw) => {
    const s = await draw();
    const { padding, gap, type } = reserved(s);
    for (const value of [...padding, gap]) {
      expect(SPACING).toContain(value);
    }
    expect(type).toEqual(BADGE);
  });
});

describe('one reserved row', () => {
  it('reserves the same row for the test banner and the recording strip, button or label', async () => {
    // A screen carrying either strip lays its content out in the same place. The copy this replaces
    // had a minimum height the banner did not, and a label 12/15 inside 5/5 padding.
    const expected = reserved(await banner());
    expect(expected.rowMinHeight).toBe(STATUS_STRIP_ROW);
    expect(STATUS_STRIP_ROW).toBe(6 + 16 + 6);
    expect(reserved(await recordingStrip({ pressable: true }))).toEqual(expected);
    expect(reserved(await recordingStrip({ pressable: false }))).toEqual(expected);
    // Clearing the status bar, and never a fixed height a larger text size could not grow.
    expect(expected.inset).toBe(47);
    expect(expected.hairline).toBe(1);
    expect(expected.rowHeight).toBeUndefined();
  });

  it('grows a button to a finger s height only where no status bar pays for it', async () => {
    // Under another strip the inset is spent. The recording strip there is still a whole target; a
    // banner or a label has none to meet, so it keeps the row every other strip reserves.
    expect((await recordingStrip({ pressable: true, top: 0 })).row.minHeight).toBe(MIN_TARGET);
    expect((await recordingStrip({ pressable: false, top: 0 })).row.minHeight).toBe(STATUS_STRIP_ROW);
    expect((await banner({ top: 0 })).row.minHeight).toBe(STATUS_STRIP_ROW);
  });
});

describe('both themes', () => {
  it('pins each tone to its tokens', () => {
    for (const theme of [lightTheme, darkTheme]) {
      expect(statusStripColors('test', theme)).toEqual({
        background: theme.testBg,
        ink: theme.testFg,
        edge: theme.testBd,
        chevron: theme.testFg,
      });
      expect(statusStripColors('chrome', theme)).toEqual({
        background: theme.surfaceAlt,
        ink: theme.text,
        edge: theme.border,
        chevron: theme.textMuted,
      });
    }
  });

  it.each([
    ['light', false, lightTheme],
    ['dark', true, darkTheme],
  ])('paints both strips from the %s palette', async (_name, dark, theme) => {
    const test = await banner({ dark });
    expect(test.strip.backgroundColor).toBe(theme.testBg);
    expect(test.label.color).toBe(theme.testFg);

    const chrome = await recordingStrip({ dark });
    expect(chrome.strip.backgroundColor).toBe(theme.surfaceAlt);
    expect(chrome.label.color).toBe(theme.text);
  });
});

describe('a large text size', () => {
  it('lets the label wrap rather than run off the screen', async () => {
    // "Režim ladění zaznamenává" is 166dp in Public Sans Bold 13 (measured from the bundled font), so
    // at 200 % the recording strip's row needs about 398dp - more than a 390dp phone has. Pinned to
    // one line, as the banner used to be, the label is drawn past both edges of the screen.
    for (const s of [await banner(), await recordingStrip()]) {
      expect(s.label.flexShrink).toBe(1);
      expect(s.labelProps.numberOfLines).toBeUndefined();
    }
  });

  it('is still one element to a screen reader, whatever wraps', async () => {
    await act(async () => {
      startDebugRecording('standard');
    });
    const view = await mount(
      <DebugRecordingFrame onOpen={() => {}}>
        <Text>{'screen'}</Text>
      </DebugRecordingFrame>,
    );
    expect(view.getByRole('button', { name: t('debug.indicator') })).toBeTruthy();
    const test = await mount(<TestEnvBanner show />);
    expect(test.getByTestId('testEnvBanner').props.accessible).toBe(true);
    expect(test.getByTestId('testEnvBanner').props.accessibilityLabel).toBe(t('testEnv.banner'));
  });
});
