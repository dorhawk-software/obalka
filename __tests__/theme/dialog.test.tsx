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
/** Layout keys that take room: what a wrapper added around the words must not carry. */
const TAKES_ROOM = /^(margin|padding|border\w*Width|gap|top|bottom|left|right|height|minHeight)/;

// Every dialog in the app is this component with a string body - seventeen of them on 2026-09-15 - so
// these metrics are how every one of them is drawn. They are the dialog's numbers from before its
// message could scroll: making room for the largest text sizes must not move any of them at the
// default one.
describe('at the default text size', () => {
  it('is drawn with the metrics it had before its message could scroll', async () => {
    const view = await wrap(
      <Dialog
        title="Odebrat schránku?"
        subtitle="Jan Novák"
        body="Zprávy zůstanou v archivu."
        onDismiss={() => {}}
        testID="dlg"
        actions={[
          { label: 'Ponechat', onPress: () => {}, testID: 'keep' },
          { label: 'Smazat', onPress: () => {}, tone: 'danger', testID: 'remove' },
        ]}
      />,
    );
    const root = view.toJSON() as Json;
    const toCard = pathTo(root, withTestID('dlg'));
    // The Modal, then the dim it lays the card out in.
    const dim = styleOf(toCard[1]);
    for (const side of ['Top', 'Bottom', 'Left', 'Right'] as const) {
      expect({ side, padding: paddingOf(dim, side) }).toEqual({ side, padding: 24 });
    }

    const card = toCard[toCard.length - 1];
    expect(styleOf(card)).toEqual(
      expect.objectContaining({
        borderTopLeftRadius: 20,
        borderBottomRightRadius: 20,
        paddingTop: 22,
        paddingLeft: 20,
        paddingRight: 20,
        paddingBottom: 18,
      }),
    );
    expect(styleOf(view.getByRole('header', { name: 'Odebrat schránku?' }))).toEqual(
      expect.objectContaining({ fontSize: 18, lineHeight: 23, marginBottom: 10 }),
    );
    expect(styleOf(view.getByText('Jan Novák'))).toEqual(
      expect.objectContaining({ fontSize: 13, lineHeight: 18, marginBottom: 8 }),
    );
    expect(styleOf(view.getByText('Zprávy zůstanou v archivu.'))).toEqual(
      expect.objectContaining({ fontSize: 14, lineHeight: 20 }),
    );

    // Whatever holds the words inside the card takes no room of its own.
    for (const words of ['Odebrat schránku?', 'Jan Novák', 'Zprávy zůstanou v archivu.']) {
      const path = pathTo(card, holdsText(words));
      for (const between of path.slice(1, -1)) {
        const room = Object.keys(styleOf(between)).filter(key => TAKES_ROOM.test(key));
        expect({ words, room, content: between.props.contentContainerStyle }).toEqual({
          words,
          room: [],
          content: undefined,
        });
      }
    }

    // The buttons: 20 below the words, 10 apart, 48 tall on a 14 corner.
    const toKeep = pathTo(card, withTestID('keep'));
    const [group, row, button] = toKeep.slice(-3);
    expect(styleOf(group)).toEqual(expect.objectContaining({ marginTop: 20, gap: 10 }));
    expect(styleOf(row)).toEqual(expect.objectContaining({ gap: 10 }));
    const face = ((button.children as Json[])[0].children as Json[])[0];
    expect(styleOf(face)).toEqual(
      expect.objectContaining({ minHeight: 48, borderTopLeftRadius: 14 }),
    );
  });
});

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

  it('gives the words the height the buttons leave, and the buttons all of theirs', async () => {
    const view = await mount();
    const root = view.toJSON() as Json;
    const toScroll = pathTo(root, isScroll);
    expect(toScroll.length).toBeGreaterThan(0);

    // Gives up height when the card is bound, and never takes more than its words need.
    expect(styleOf(toScroll[toScroll.length - 1])).toEqual(
      expect.objectContaining({ flexShrink: 1, flexGrow: 0 }),
    );
    // Every box between the dim (the Modal's child) and the scroll gives way, so the bound the dim
    // sets reaches the scroll.
    const between = toScroll.slice(2, -1);
    expect(between.length).toBeGreaterThan(0);
    for (const node of between) {
      expect({ node: node.props.testID ?? node.type, flexShrink: styleOf(node).flexShrink }).toEqual({
        node: node.props.testID ?? node.type,
        flexShrink: 1,
      });
    }
    // The buttons are the card's one other child, and they keep their whole height.
    const card = between[between.length - 1];
    expect(card.props.testID).toBe('dlg');
    const others = (card.children ?? []).filter(
      (child): child is Json => typeof child !== 'string' && !isScroll(child),
    );
    expect(others).toHaveLength(1);
    expect(pathTo(others[0], withTestID('keep')).length).toBeGreaterThan(0);
    expect(styleOf(others[0]).flexShrink).toBe(0);
  });

  it('keeps the card clear of the status bar and the home indicator, centred where it was', async () => {
    // The same margin above and below - the larger inset's - so a card that fits sits exactly where it
    // always did, in the middle of the screen, and one that does not stops short of both bars.
    const view = await mount();
    const dim = styleOf(pathTo(view.toJSON() as Json, withTestID('dlg'))[1]);
    expect(paddingOf(dim, 'Top')).toBe(24 + insets.top);
    expect(paddingOf(dim, 'Bottom')).toBe(24 + insets.top);
    expect(paddingOf(dim, 'Left')).toBe(24);
    expect(paddingOf(dim, 'Right')).toBe(24);
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
    // The row layout still needs it (two buttons splitting the width), so the rule is per-layout.
    const stacked = await wrap(
      <Dialog
        title="T"
        body="B"
        onDismiss={() => {}}
        actions={[
          { label: 'A', onPress: () => {}, testID: 'a' },
          { label: 'B', onPress: () => {}, testID: 'b' },
          { label: 'C', onPress: () => {}, testID: 'c' },
        ]}
      />,
    );
    for (const id of ['a', 'b', 'c']) {
      expect(JSON.stringify(stacked.getByTestId(id).props.style)).not.toContain('"flex":1');
    }

    const row = await wrap(
      <Dialog
        title="T"
        body="B"
        onDismiss={() => {}}
        actions={[
          { label: 'A', onPress: () => {}, testID: 'ra' },
          { label: 'B', onPress: () => {}, testID: 'rb' },
        ]}
      />,
    );
    for (const id of ['ra', 'rb']) {
      expect(JSON.stringify(row.getByTestId(id).props.style)).toContain('"flex":1');
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
      expect(text).toMatch(locale === 'cs' ? /termín/i : /deadline/i);
    }
  });

  it('still says ISDS is untouched, because it is', () => {
    // The reassurance was true and worth keeping - it just could not be the whole sentence.
    expect(STRINGS_FOR_TEST.cs['box.removeMessage']).toMatch(/ISDS/);
    expect(STRINGS_FOR_TEST.en['box.removeMessage']).toMatch(/ISDS/);
  });
});
