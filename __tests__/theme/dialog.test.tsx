// The app's dialog (theme/Dialog) - the one every confirm in the app is now made of.
//
// It exists because the OS `Alert` is a different visual language: system font, system spacing,
// ALL-CAPS buttons. One screen using it makes the app look like two apps. So the shell is ours, and
// these are the properties a confirm has to have however it looks: the buttons do what they say, and
// dismissing takes the SAFE path rather than the destructive one.

import { render, fireEvent, act } from '@testing-library/react-native';
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { AppThemeProvider } from '../../src/theme/ThemeProvider';
import { Dialog } from '../../src/theme/Dialog';
import { Text } from '../../src/theme/ui';
import { STRINGS_FOR_TEST } from '../../src/i18n/strings';
import { lightTheme } from '../../src/theme/theme';
import { type as typeScale } from '../../src/theme/typeScale';

const wrap = (ui: React.ReactElement) =>
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <AppThemeProvider isDark={false}>{ui}</AppThemeProvider>
    </TamaguiProvider>,
  );

type Json = {
  type: string;
  props: Record<string, unknown>;
  children: (Json | string)[] | null;
};

const styleOf = (node: { props: Record<string, unknown> }) =>
  (StyleSheet.flatten(node.props.style as StyleProp<ViewStyle>) ?? {}) as Record<string, unknown>;

/** One side's padding the way React Native resolves it: the side, then its axis, then `padding`. */
function paddingOf(
  style: Record<string, unknown>,
  side: 'Top' | 'Bottom' | 'Left' | 'Right',
): unknown {
  const axis = side === 'Top' || side === 'Bottom' ? 'paddingVertical' : 'paddingHorizontal';
  return style[`padding${side}`] ?? style[axis] ?? style.padding;
}

/** The host elements from `node` down to the first one `match` accepts, both ends included. */
function pathTo(node: Json, match: (n: Json) => boolean): Json[] {
  if (match(node)) {
    return [node];
  }
  for (const child of node.children ?? []) {
    if (typeof child !== 'string') {
      const below = pathTo(child, match);
      if (below.length > 0) {
        return [node, ...below];
      }
    }
  }
  return [];
}

const holdsText = (text: string) => (n: Json) => (n.children ?? []).includes(text);
const withTestID = (id: string) => (n: Json) => n.props.testID === id;
const isScroll = (n: Json) => n.type === 'RCTScrollView';

// R9 (031 I52, agreed 2026-11-12): every question is a bottom sheet - the object or glyph it is about,
// the title, the words, and the answers one above the other under the thumb, the filled or danger one
// first. Until 2026-11-15 the dialog was a card in the middle of the screen, its answers in a row.
describe('as R9 draws it', () => {
  const mount = () =>
    wrap(
      <Dialog
        title="Odebrat schránku?"
        subtitle="Jan Novák"
        body="Zprávy zůstanou v archivu."
        onDismiss={() => {}}
        glyph={color => <Text testID="dlg-glyph" color={color}>x</Text>}
        testID="dlg"
        actions={[
          { label: 'Ponechat', onPress: () => {}, testID: 'keep' },
          { label: 'Smazat', onPress: () => {}, tone: 'danger', testID: 'remove' },
        ]}
      />,
    );

  it('is a sheet: the surface, the 24 corner, the sheet s sides', async () => {
    const view = await mount();
    const sheet = styleOf(view.getByTestId('dlg'));
    expect(sheet).toEqual(
      expect.objectContaining({
        backgroundColor: lightTheme.surfaceAlt,
        borderTopLeftRadius: 24,
        paddingLeft: 24,
        paddingRight: 24,
      }),
    );
  });

  it('sets the title in the title role and the words in body text, centred', async () => {
    const view = await mount();
    const title = styleOf(view.getByRole('header', { name: 'Odebrat schránku?' }));
    expect([title.fontSize, title.lineHeight, title.textAlign]).toEqual([
      typeScale.title.fontSize,
      typeScale.title.lineHeight,
      'center',
    ]);
    const words = styleOf(view.getByText('Zprávy zůstanou v archivu.'));
    expect([words.fontSize, words.color, words.textAlign]).toEqual([
      typeScale.small.fontSize,
      lightTheme.bodyText,
      'center',
    ]);
    expect(view.getByTestId('dlg-glyph', { includeHiddenElements: true })).toBeTruthy();
  });

  it('stacks the answers 8 apart, the danger one first, 24 under the words', async () => {
    const view = await mount();
    const answers = view.getByTestId('dlg-answers');
    expect(styleOf(answers)).toEqual(expect.objectContaining({ marginTop: 24, gap: 8 }));
    const ids = (view.toJSON() as Json | null) ? collectIDs(answers as unknown as Json) : [];
    expect(ids.filter(id => id === 'keep' || id === 'remove')).toEqual(['remove', 'keep']);
  });
});

/** Every testID under `node`, in the order drawn. */
function collectIDs(node: Json): string[] {
  const own = typeof node.props?.testID === 'string' ? [node.props.testID as string] : [];
  return own.concat(
    ...((node.children ?? []) as (Json | string)[]).map(child =>
      typeof child === 'string' ? [] : collectIDs(child),
    ),
  );
}

// React Native scales a dialog's words with the system text size and nothing else about it. At the
// largest sizes a long message pushed the buttons below the bottom of the screen: back and a tap on the
// dim still closed the dialog, but the choice it asked for could not be made.
//
// Jest has no layout engine, so a rendered tree cannot show where a button landed. What it can show is
// the contract Yoga lays the dialog out by: the words sit in a scroll view that gives up height, every
// box from the dim down to that scroll view gives way when the screen runs out, and the buttons, outside
// it, never do. Seeing it on a phone at the largest text size is a device walk.
describe('at the largest text sizes', () => {
  const long = Array.from({ length: 30 }, () => STRINGS_FOR_TEST.cs['box.removeMessage']).join(' ');
  const insets = { top: 59, bottom: 34, left: 0, right: 0 };
  const mount = () =>
    wrap(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets }}>
        <Dialog
          title="Odebrat schránku?"
          subtitle="Jan Novák"
          body={long}
          onDismiss={() => {}}
          testID="dlg"
          actions={[
            { label: 'Ponechat', onPress: () => {}, testID: 'keep' },
            { label: 'Smazat', onPress: () => {}, tone: 'danger', testID: 'remove' },
            { label: 'Později', onPress: () => {}, testID: 'later' },
          ]}
        />
      </SafeAreaProvider>,
    );

  it('scrolls the words and keeps every button out of the scroll', async () => {
    // Jest's window reports twice the default text size.
    expect(Dimensions.get('window').fontScale).toBe(2);
    const view = await mount();
    const root = view.toJSON() as Json;

    for (const words of ['Odebrat schránku?', 'Jan Novák', long]) {
      expect({ words: words.slice(0, 20), scrolls: pathTo(root, holdsText(words)).some(isScroll) }).toEqual({
        words: words.slice(0, 20),
        scrolls: true,
      });
    }
    for (const id of ['keep', 'remove', 'later']) {
      const path = pathTo(root, withTestID(id));
      expect({ id, found: path.length > 0, scrolls: path.some(isScroll) }).toEqual({
        id,
        found: true,
        scrolls: false,
      });
    }
  });

  it('gives the words the height the answers leave, and the answers all of theirs', async () => {
    const view = await mount();
    const root = view.toJSON() as Json;
    const toScroll = pathTo(root, isScroll);
    expect(toScroll.length).toBeGreaterThan(0);
    // Gives up height when the sheet reaches its cap, and never takes more than its words need.
    expect(styleOf(toScroll[toScroll.length - 1])).toEqual(
      expect.objectContaining({ flexShrink: 1, flexGrow: 0 }),
    );
    // The sheet is capped below the status bar, and the scroll is one of its children.
    const sheet = toScroll[toScroll.length - 2];
    expect(sheet.props.testID).toBe('dlg');
    expect(styleOf(sheet).maxHeight).toEqual(expect.any(Number));
    // The answers are outside the scroll, and keep their whole height.
    const answers = pathTo(sheet, withTestID('dlg-answers'));
    expect(answers.some(isScroll)).toBe(false);
    expect(styleOf(answers[answers.length - 1]).flexShrink).toBe(0);
  });

  it('keeps its answers clear of the home indicator', async () => {
    const view = await mount();
    expect(paddingOf(styleOf(view.getByTestId('dlg')), 'Bottom')).toBe(insets.bottom + 18);
  });

  it('does not bounce words that fit, and shows once that words that do not fit go on', async () => {
    type HostElement = Parameters<typeof fireEvent>[0];
    const findHost = (node: HostElement): HostElement | null => {
      if (node.type === 'RCTScrollView') {
        return node;
      }
      for (const child of node.children) {
        const found = typeof child === 'string' ? null : findHost(child);
        if (found) {
          return found;
        }
      }
      return null;
    };
    const view = await mount();
    const found = findHost(view.container);
    expect(found).not.toBeNull();
    const scroll = found as HostElement;
    expect(scroll.props.alwaysBounceVertical).toBe(false);

    // Jest's ScrollView keeps its methods on the prototype, so the dialog's ref calls this one.
    const flash = (ScrollView.prototype as unknown as { flashScrollIndicators: jest.Mock })
      .flashScrollIndicators;
    flash.mockClear();
    await act(async () => {
      fireEvent(scroll, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 400 } } });
    });
    await act(async () => {
      fireEvent(scroll, 'contentSizeChange', 300, 380);
    });
    expect(flash).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent(scroll, 'contentSizeChange', 300, 1400);
    });
    expect(flash).toHaveBeenCalledTimes(1);
    // Once is the hint. Flashing again as the words settle would be noise.
    await act(async () => {
      fireEvent(scroll, 'contentSizeChange', 300, 1500);
    });
    expect(flash).toHaveBeenCalledTimes(1);
  });
});

describe('Dialog', () => {
  it('shows its words and fires the action that was pressed', async () => {
    const keep = jest.fn();
    const remove = jest.fn();
    const view = await wrap(
      <Dialog
        title="Odebrat schránku?"
        subtitle="Jan Novák"
        body="Zprávy zůstanou v archivu."
        onDismiss={keep}
        testID="dlg"
        actions={[
          { label: 'Ponechat', onPress: keep, testID: 'keep' },
          { label: 'Smazat', onPress: remove, tone: 'danger', testID: 'remove' },
        ]}
      />,
    );

    expect(view.getByText('Odebrat schránku?')).toBeTruthy();
    expect(view.getByText('Jan Novák')).toBeTruthy();
    expect(view.getByText('Zprávy zůstanou v archivu.')).toBeTruthy();

    await act(async () => {
      fireEvent.press(view.getByTestId('remove'));
    });
    expect(remove).toHaveBeenCalledTimes(1);
    expect(keep).not.toHaveBeenCalled();
  });

  it('announces its title as a heading', async () => {
    const view = await wrap(
      <Dialog
        title="Záloha ještě běží"
        body="Nechat doběhnout?"
        onDismiss={() => {}}
        actions={[{ label: 'OK', onPress: () => {} }]}
      />,
    );
    // A screen-reader user lands on the dialog and hears what it is about, not a stray sentence.
    expect(view.getByRole('header', { name: 'Záloha ještě běží' })).toBeTruthy();
  });

  it('does not give stacked buttons a flex share - that made them overlap', async () => {
    // Found on the device: three actions in a column, each with `flex: 1`, drew on top of each other.
    // Every answer is stacked now (R9), two of them as well as three.
    for (const count of [2, 3]) {
      const ids = ['a', 'b', 'c'].slice(0, count);
      const view = await wrap(
        <Dialog
          title="T"
          body="B"
          onDismiss={() => {}}
          actions={ids.map(id => ({ label: id, onPress: () => {}, testID: `${count}${id}` }))}
        />,
      );
      for (const id of ids) {
        expect(JSON.stringify(view.getByTestId(`${count}${id}`).props.style)).not.toContain('"flex":1');
      }
    }
  });

  it('gives every action a pressable button, three of them stacked', async () => {
    const view = await wrap(
      <Dialog
        title="T"
        body="B"
        onDismiss={() => {}}
        actions={[
          { label: 'A', onPress: () => {}, tone: 'primary', testID: 'a' },
          { label: 'B', onPress: () => {}, tone: 'danger', testID: 'b' },
          { label: 'C', onPress: () => {}, testID: 'c' },
        ]}
      />,
    );
    for (const id of ['a', 'b', 'c']) {
      expect(view.getByTestId(id)).toBeTruthy();
    }
  });
});

// A destructive dialog has to name what it destroys (audit, 2026-09-09).
//
// Box removal wipes the local archive, the reminders and the dismissed scan suggestions
// (`AppShell.handleRemove`), while the dialog said only "the box and saved credentials" and then
// reassured that messages in the data box are untouched. That sentence is literally true - it is
// about the ISDS mailbox - and it reads, to someone hurrying through a confirm, as "my messages are
// safe". They are not: the local archive is the only copy of anything ISDS erased at 90 days.
describe('destructive buttons', () => {
  it('carry an icon, coloured by the button rather than by the caller', async () => {
    // The caller cannot hardcode a colour - the palette guard rejects raw hex in screens, and an icon
    // that ignored the theme would be invisible in one of them.
    let seen: string | null = null;
    const view = await wrap(
      <Dialog
        title="T"
        body="B"
        onDismiss={() => {}}
        actions={[
          { label: 'Ponechat', onPress: () => {}, testID: 'keep' },
          {
            label: 'Smazat',
            onPress: () => {},
            tone: 'danger',
            testID: 'delete',
            icon: color => {
              seen = color;
              return <Text testID="delete-icon">x</Text>;
            },
          },
        ]}
      />,
    );

    // `includeHiddenElements` because the icon is deliberately hidden from the screen reader - the
    // label already says "Smazat" and hearing it twice is worse than not hearing the icon at all.
    expect(
      view.getByTestId('delete-icon', { includeHiddenElements: true }),
    ).toBeTruthy();
    expect(seen).toEqual(expect.any(String));
    // The neutral button asked for none, and got none.
    expect(view.getByTestId('keep')).toBeTruthy();
  });
});

describe('the box-removal warning', () => {
  it('names the archive, not just the box and the credentials', () => {
    for (const locale of ['cs', 'en'] as const) {
      const text = STRINGS_FOR_TEST[locale]['box.removeMessage'];
      expect(text).toMatch(locale === 'cs' ? /archiv/i : /archive/i);
      expect(text).toMatch(locale === 'cs' ? /připomínk/i : /reminder/i);
    }
  });

  it('still says ISDS is untouched, because it is', () => {
    // The reassurance was true and worth keeping - it just could not be the whole sentence.
    expect(STRINGS_FOR_TEST.cs['box.removeMessage']).toMatch(/ISDS/);
    expect(STRINGS_FOR_TEST.en['box.removeMessage']).toMatch(/ISDS/);
  });
});
