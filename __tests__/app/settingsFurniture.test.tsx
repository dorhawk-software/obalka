// The settings furniture as the design draws it (2026-09-15).
//
// `Section`, `CardRow` and `SubScreen` are what the Settings, Backup, Transfer and Debug screens are
// built from, and `SubScreen` also frames help and the licences. Each number they draw was checked
// against DESIGN.md, which records the design. A value DESIGN.md records is read from it below rather
// than retyped; a value the design draws that DESIGN.md does not record - a section's 9 and 22 - is
// named here as the design's; anything else is a step of the spacing scale.
//
// Everything below is asserted on what renders. Until the same day two assertions read source text
// instead: the 28 in `SettingsScreen`'s `useContentBottom(28)`, and a scan of the two files for typed
// spacing numbers. A refactor that drew the same thing could fail them, and a change that drew
// something else, through a name or a spread, could pass them.

import { readFileSync } from 'fs';
import { join } from 'path';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { AppThemeProvider } from '../../src/theme/ThemeProvider';
import { lightTheme } from '../../src/theme/theme';
import { space } from '../../src/theme/spacing';
import { fonts } from '../../src/theme/typography';
import { Text } from '../../src/theme/ui';
import { Card, CardRow, RowTitle, Section } from '../../src/app/settings/SettingsSection';
import { SubScreen } from '../../src/app/settings/SubScreen';

// `mock`-prefixed so jest allows the factory below to close over it. Settings is rendered here only for
// where its content ends; what its rows say is `settingsCopy.test.tsx`'s.
const mockSettings = {
  themeMode: 'system' as const,
  locale: 'cs' as const,
  appLock: false,
  scanAttachments: false,
  autoDownload: { on: false, since: null, wifiOnly: true },
  setAutoDownload: () => {},
  setAutoDownloadWifiOnly: () => {},
  ready: true,
  setThemeMode: jest.fn(),
  setLocale: jest.fn(),
  setAppLock: jest.fn(),
  setScanAttachments: jest.fn(),
};

jest.mock('../../src/app/settings/SettingsProvider', () => ({
  ...jest.requireActual('../../src/app/settings/SettingsProvider'),
  useSettings: () => mockSettings,
  useLocale: () => 'cs',
}));

const { SettingsScreen } = require('../../src/app/settings/SettingsScreen') as typeof import('../../src/app/settings/SettingsScreen');

const DESIGN = readFileSync(join(__dirname, '../..', 'DESIGN.md'), 'utf8');

/**
 * A section's gap under its label and its margin under its last card: the design's, as the 009 port of
 * the design drew them. Neither DESIGN.md nor `specs/009-visual-redesign/design-system.md` records a
 * number for them, so they cannot be read from a record; they are named here instead of being moved to
 * the nearest steps, which is what happened to them for part of 2026-09-15.
 */
const DESIGN_SECTION = { gap: 9, marginBottom: 22 } as const;

type Json = {
  type: string;
  props: Record<string, unknown>;
  children: (Json | string)[] | null;
};

const flat = (style: unknown) =>
  (StyleSheet.flatten(style as StyleProp<ViewStyle>) ?? {}) as Record<string, unknown>;

function find(node: Json, match: (n: Json) => boolean): Json | null {
  if (match(node)) {
    return node;
  }
  for (const child of node.children ?? []) {
    const found = typeof child === 'string' ? null : find(child, match);
    if (found) {
      return found;
    }
  }
  return null;
}

const INSETS = { top: 47, bottom: 34, left: 0, right: 0 };

const wrap = (ui: React.ReactElement, insets = INSETS) =>
  render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets }}>
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <AppThemeProvider isDark={false}>{ui}</AppThemeProvider>
      </TamaguiProvider>
    </SafeAreaProvider>,
  );

/** The first capture of `pattern` in DESIGN.md, as a number; NaN when DESIGN.md does not say it. */
const designNumber = (pattern: RegExp) => Number(pattern.exec(DESIGN)?.[1]);

/** The content style of the first scroll view a screen renders. */
function contentOf(root: Json): Record<string, unknown> {
  const scroll = find(root, n => n.type === 'RCTScrollView');
  expect(scroll).not.toBeNull();
  return flat(scroll?.props.contentContainerStyle);
}

describe('what DESIGN.md says about the furniture', () => {
  it('is there to be read, so nothing below passes against a number it does not state', () => {
    // Row padding (Layout), card padding (Components › Cards), the settings scroll's gutter (Layout)
    // and the section label (Components › Settings sections).
    expect(designNumber(/Row padding is (\d+) vertical/)).toBe(13);
    expect(designNumber(/\*\*Padding:\*\* (\d+)dp/)).toBe(14);
    expect(designNumber(/(\d+) on settings-shaped scroll content/)).toBe(16);
    expect(designNumber(/\*\*Label:\*\* Public Sans Bold (\d+), uppercase/)).toBe(12);
  });
});

describe('a section', () => {
  it('sits its card 9 under the label and the next section 22 under it, as the design draws them', async () => {
    // Moved to the `base` and `gutter` steps (8 and 18) for part of 2026-09-15, for being off the scale,
    // which moved every section on the Settings, Backup, Transfer and Debug screens.
    const view = await wrap(
      <Section label="Vzhled">
        <Text>x</Text>
      </Section>,
    );
    const root = view.toJSON() as Json;
    expect(flat(root.props.style)).toEqual(expect.objectContaining(DESIGN_SECTION));
    const labelRow = (root.children as Json[])[0];
    expect(flat(labelRow.props.style)).toEqual(
      expect.objectContaining({ gap: space.sm, marginLeft: space.xs }),
    );
  });

  it('draws its label as the design does, which DESIGN.md records', async () => {
    const view = await wrap(
      <Section label="Vzhled">
        <Text>x</Text>
      </Section>,
    );
    const letterSpacing = designNumber(/\*\*Label:\*\* Public Sans Bold \d+, uppercase, ([\d.]+) letter-spacing, `faint-ink`/);
    expect(letterSpacing).toBe(0.4);
    expect(flat(view.getByRole('header', { name: 'Vzhled' }).props.style)).toEqual(
      expect.objectContaining({
        fontSize: designNumber(/\*\*Label:\*\* Public Sans Bold (\d+), uppercase/),
        textTransform: 'uppercase',
        letterSpacing,
        fontFamily: fonts.bodyBold,
        color: lightTheme.textFaint,
      }),
    );
  });
});

describe('a card row', () => {
  it('pads as DESIGN.md pads a row and a card, with a `md` step between what it holds', async () => {
    const view = await wrap(
      <CardRow last testID="row">
        <Text>x</Text>
      </CardRow>,
    );
    const vertical = designNumber(/Row padding is (\d+) vertical/);
    const horizontal = designNumber(/\*\*Padding:\*\* (\d+)dp/);
    expect(flat(view.getByTestId('row').props.style)).toEqual(
      expect.objectContaining({
        paddingTop: vertical,
        paddingBottom: vertical,
        paddingLeft: horizontal,
        paddingRight: horizontal,
        gap: space.md,
      }),
    );
  });
});

describe('a sub-screen', () => {
  const settings = (
    <SettingsScreen
      onBack={() => {}}
      onOpenFaq={() => {}}
      onOpenBackup={() => {}}
      onOpenDebug={() => {}}
      onOpenLicences={() => {}}
    />
  );

  /** Where Settings itself ends its content, over a home indicator `bottom` tall. */
  const settingsEnd = async (bottom: number) => {
    const view = await wrap(settings, { ...INSETS, bottom });
    await waitFor(() => expect(view.getByTestId('scan-toggle')).toBeTruthy());
    return contentOf(view.toJSON() as Json).paddingBottom as number;
  };

  const subScreen = async (bottom: number, paddingBottom?: number) => {
    const view = await wrap(
      <SubScreen title="Záloha" onBack={() => {}} paddingBottom={paddingBottom}>
        <Text>x</Text>
      </SubScreen>,
      { ...INSETS, bottom },
    );
    return contentOf(view.toJSON() as Json);
  };

  it('ends its content above the home indicator, where Settings ends', async () => {
    // A bare 28 until 2026-09-15: right where the bottom inset is 0, and short by the whole gesture bar
    // everywhere else - the defect `useContentBottom` exists for, which DESIGN.md names as the one source
    // of a screen's bottom padding. The Backup, Transfer and Debug screens are opened from Settings, and
    // end the same distance above the same edge, with a gesture bar and without one.
    const withBar = await settingsEnd(INSETS.bottom);
    const withoutBar = await settingsEnd(0);
    expect(withBar - withoutBar).toBe(INSETS.bottom);
    expect(withoutBar).toBeGreaterThan(0);
    expect((await subScreen(INSETS.bottom)).paddingBottom).toBe(withBar);
    expect((await subScreen(0)).paddingBottom).toBe(withoutBar);

    const sides = designNumber(/(\d+) on settings-shaped scroll content/);
    expect(await subScreen(INSETS.bottom)).toEqual(
      expect.objectContaining({ paddingTop: space.gutter, paddingLeft: sides, paddingRight: sides }),
    );
  });

  it('takes a screen s own bottom padding as its gap above the home indicator, not instead of it', async () => {
    // The licence text asks for 32 below it; it used to get 32 from the bottom edge of the screen.
    expect((await subScreen(INSETS.bottom, 32)).paddingBottom).toBe(INSETS.bottom + 32);
  });
});

describe('on DESIGN.md s scales', () => {
  const SPACING_KEY = /^(gap|rowGap|columnGap|margin\w*|padding\w*)$/;

  /** Every spacing a rendered node and everything under it draws, as `key: value`. */
  function spacings(node: Json, out: string[] = []): string[] {
    for (const style of [node.props.style, node.props.contentContainerStyle]) {
      for (const [key, value] of Object.entries(flat(style))) {
        if (SPACING_KEY.test(key)) {
          out.push(`${key}: ${String(value)}`);
        }
      }
    }
    for (const child of node.children ?? []) {
      if (typeof child !== 'string') {
        spacings(child, out);
      }
    }
    return out;
  }

  it('draws nothing in a section, card or row but a step or a value DESIGN.md records, past a section s own 9 and 22', async () => {
    // What a scan of the source used to hold them to, on what renders: every branch drawn - a section
    // with an icon and one without, a pressable row and a last one. A number that is neither is how
    // off-scale spacing gets in, one close-enough value at a time. The section's 9 and 22 are allowed
    // where the design draws them, on the section itself, and nowhere else.
    const view = await wrap(
      <View testID="furniture">
        <Section label="Vzhled" icon={<Text>i</Text>}>
          <Card>
            <CardRow last={false} onPress={() => {}} accessibilityLabel="Motiv">
              <RowTitle flex={1}>Motiv</RowTitle>
            </CardRow>
            <CardRow last>
              <RowTitle>Jazyk</RowTitle>
            </CardRow>
          </Card>
        </Section>
        <Section label="Záloha">
          <Text>x</Text>
        </Section>
      </View>,
    );
    const allowed = new Set<number>([
      ...Object.values(space),
      designNumber(/Row padding is (\d+) vertical/),
      designNumber(/\*\*Padding:\*\* (\d+)dp/),
    ]);
    const holder = find(view.toJSON() as Json, n => n.props.testID === 'furniture');
    const sections = (holder?.children ?? []) as Json[];
    expect(sections).toHaveLength(2);
    const drawn = sections.flatMap(section => {
      const { gap, marginBottom, ...rest } = flat(section.props.style);
      expect({ gap, marginBottom }).toEqual(DESIGN_SECTION);
      return spacings({ ...section, props: { ...section.props, style: rest } });
    });
    expect(drawn.length).toBeGreaterThan(0);
    expect(drawn.filter(entry => !allowed.has(Number(entry.split(': ')[1])))).toEqual([]);
  });

  it('draws no spacing in a sub-screen but its content padding', async () => {
    // The header is `ScreenHeader`'s, on its own metrics; everything else a sub-screen draws is the
    // content padding the tests above pin.
    const view = await wrap(
      <SubScreen title="Záloha" onBack={() => {}}>
        <Text>x</Text>
      </SubScreen>,
    );
    const root = view.toJSON() as Json;
    const scroll = find(root, n => n.type === 'RCTScrollView');
    expect(scroll).not.toBeNull();
    const own = spacings({ ...root, children: [] });
    const content = spacings(scroll as Json)
      .map(entry => entry.split(': ')[0])
      .sort();
    expect({ own, content }).toEqual({
      own: [],
      content: ['paddingBottom', 'paddingLeft', 'paddingRight', 'paddingTop'],
    });
  });
});
