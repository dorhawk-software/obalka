// Opening a message (031 I67, board Motion 1): the row's sender tile grows into the message's
// envelope, then the letter rises out of it over the envelope's edge - 280 ms each, eased out, and
// quiet (no haptic). The movement is walked on a device; these hold its plan, where the tile flies
// from and to, that the envelope is never left hidden, that Reduce Motion moves nothing, and that only
// a message opened from its row fades in instead of the platform's push.

import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Animated, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import RNHaptic from 'react-native-haptic-feedback';
import { useReducedMotion } from 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { AppThemeProvider } from '../../src/theme/ThemeProvider';
import { lightTheme } from '../../src/theme/theme';
import type { DataBoxAccount, MessageEnvelope } from '../../src/services/isds/types';

const mockEnvelope: MessageEnvelope = {
  id: '1234567',
  subject: 'Výzva k doplnění podání',
  sender: 'Magistrát města Kotlina',
  senderAddress: null,
  recipient: 'Jana Nováková',
  recipientAddress: null,
  recipientBoxId: 'ab12cd3',
  deliveryTime: Date.UTC(2026, 7, 18),
  acceptanceTime: Date.UTC(2026, 7, 18),
  state: 6,
  attachmentSize: 1,
};

jest.mock('../../src/features/accounts/deps', () => ({
  messagesController: {
    getSentNews: async () => 0,
    markSentNewsSeen: async () => {},
    listReceived: async () => ({ kind: 'loaded', messages: [mockEnvelope], downloaded: [], syncedAt: 1 }),
    listSent: async () => ({ kind: 'loaded', messages: [], downloaded: [], syncedAt: 1 }),
    getCachedMessages: async () => ({ envelopes: [mockEnvelope], downloaded: [], syncedAt: 1 }),
    getCachedSyncedAt: async () => 1,
  },
  accountsController: { decrementUnread: async () => {} },
  draftsStore: { list: async () => [] },
  remindersController: { listForBox: async () => [], alertsFor: async () => 'on' },
  scanController: { enabled: async () => false, isDismissed: async () => false },
}));

import { DetailEnvelope } from '../../src/features/messages/screens/DetailEnvelope';
import {
  FLIGHT_FRESH_MS,
  FlyingTile,
  easedStretch,
  openFromTile,
  openingMoment,
  type TileRect,
} from '../../src/features/messages/screens/EnvelopeFlight';
import { MessageList } from '../../src/features/messages/screens/MessageList';
import { screenOptions } from '../../src/app/AppNavigator';

const account = {
  id: 'a',
  boxId: 'a',
  loginName: 'user',
  label: 'Domácí schránka',
  dbType: 'FO',
  alias: null,
  authMethod: 'password',
  host: 'production',
  secretRef: 'ref',
  sessionValidUntil: null,
  passwordExpiresAt: null,
  lastSyncedAt: 1,
  messageCount: null,
  unreadCount: 0,
  pdzCreditCzk: null,
  syncError: null,
  createdAt: 0,
  updatedAt: 0,
} as DataBoxAccount;

const tile = (at = Date.now()): TileRect => ({ x: 34, y: 610, width: 24, height: 24, color: '#2E7D5B', radius: 7, at });
const flat = (style: unknown) => (StyleSheet.flatten(style as never) ?? {}) as Record<string, unknown>;

afterEach(() => {
  (useReducedMotion as jest.Mock).mockReturnValue(false);
  jest.useRealTimers();
});

describe('the plan', () => {
  it('flies 280, then the letter rises 280 from 60 % of the flight', () => {
    expect(openingMoment(true, false)).toEqual({ flightMs: 280, sheetAtMs: 168, sheetMs: 280, totalMs: 448, sheetRise: 24 });
  });

  it('only raises the letter when there is no tile to fly from', () => {
    expect(openingMoment(false, false)).toEqual({ flightMs: 0, sheetAtMs: 0, sheetMs: 280, totalMs: 280, sheetRise: 24 });
  });

  it('moves nothing with Reduce Motion', () => {
    expect(openingMoment(true, true).totalMs).toBe(0);
  });

  it('eases each stretch out on the one clock, the letter starting where the plan says', () => {
    const m = openingMoment(true, false);
    const letter = easedStretch(m.sheetAtMs, m.sheetMs, m.totalMs);
    expect(letter.inputRange[0]).toBeCloseTo(168 / 448);
    expect(letter.inputRange[letter.inputRange.length - 1]).toBeCloseTo(1);
    expect(letter.outputRange[0]).toBe(0);
    expect(letter.outputRange[letter.outputRange.length - 1]).toBe(1);
    // Eased out: a third of the way through, more than half of the way there.
    expect(letter.outputRange[3]).toBeGreaterThan(0.55);
  });
});

describe('the tapped tile', () => {
  it('is measured where it is on screen, with its look and the moment', () => {
    const open = jest.fn();
    const view = { measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => cb(34, 610, 24, 24) };
    openFromTile(view, { color: '#2E7D5B', radius: 7 }, open);
    expect(open).toHaveBeenCalledTimes(1);
    expect(open.mock.calls[0][0]).toMatchObject({ x: 34, y: 610, width: 24, height: 24, color: '#2E7D5B', radius: 7 });
  });

  it('opens the message without it when the platform does not answer at once, and only once', () => {
    const open = jest.fn();
    const answer: { late?: (x: number, y: number, w: number, h: number) => void } = {};
    openFromTile({ measureInWindow: cb => (answer.late = cb) }, { color: '#000', radius: 7 }, open);
    answer.late?.(1, 2, 3, 4);
    expect(open.mock.calls).toEqual([[undefined]]);
  });

  it('opens without it when it has no size', () => {
    const open = jest.fn();
    openFromTile({ measureInWindow: cb => cb(0, 0, 0, 0) }, { color: '#000', radius: 7 }, open);
    expect(open.mock.calls).toEqual([[undefined]]);
  });
});

describe('the flight', () => {
  const to = { x: 16, y: 120, width: 358, height: 170 };
  const draw = (at: number) =>
    render(
      <AppThemeProvider isDark={false}>
        <FlyingTile from={tile()} to={to} flight={new Animated.Value(at)} />
      </AppThemeProvider>,
    );

  it('starts as the tile, where it was, in the sender\'s colour', async () => {
    const view = await draw(0);
    const frame = flat(view.getByTestId('flyingTile').props.style);
    const [tx, ty, sx, sy] = frame.transform as Record<string, number>[];
    expect(tx.translateX).toBe(34 + 12 - (16 + 179));
    expect(ty.translateY).toBe(610 + 12 - (120 + 85));
    expect(sx.scaleX).toBeCloseTo(24 / 358);
    expect(sy.scaleY).toBeCloseTo(24 / 170);
    expect(frame.backgroundColor).toBe(lightTheme.envelope);
    const colour = flat(view.getByTestId('flyingTileColour').props.style);
    expect(colour.backgroundColor).toBe('#2E7D5B');
    expect(colour.opacity).toBe(1);
  });

  it('ends as the envelope, in its place, in its blue', async () => {
    const view = await draw(1);
    const frame = flat(view.getByTestId('flyingTile').props.style);
    expect(frame.transform).toEqual([{ translateX: 0 }, { translateY: 0 }, { scaleX: 1 }, { scaleY: 1 }]);
  });
});

describe('the envelope', () => {
  const mount = (from?: TileRect) =>
    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <AppThemeProvider isDark={false}>
          <DetailEnvelope envelope={mockEnvelope} account={account} attachmentCount={1} openedFrom={from} />
        </AppThemeProvider>
      </TamaguiProvider>,
    );
  const opacityAbove = (view: Awaited<ReturnType<typeof mount>>, testID: string) => {
    let node = view.getByTestId(testID).parent;
    while (node) {
      const o = flat(node.props.style).opacity;
      if (typeof o === 'number') {
        return o;
      }
      node = node.parent;
    }
    return undefined;
  };

  // Settled, the native-driven style stays on at its end: taking it off failed Fabric's prop assertion
  // and Android killed the app (2026-11-12, Obalka_Demo). So the opacity is still there, at 1.
  it('waits hidden for its place, and is shown there if it never learns it', async () => {
    jest.useFakeTimers();
    const view = await mount(tile());
    expect(opacityAbove(view, 'detailSender')).toBe(0);
    await act(async () => jest.advanceTimersByTime(FLIGHT_FRESH_MS));
    expect(opacityAbove(view, 'detailSender')).toBe(1);
    expect(view.queryByTestId('flyingTile')).toBeNull();
  });

  it('does not fly from a tile tapped too long ago', async () => {
    const view = await mount(tile(Date.now() - FLIGHT_FRESH_MS - 1));
    expect(opacityAbove(view, 'detailSender')).toBe(1);
  });

  it('stands in its place with the letter on it under Reduce Motion', async () => {
    (useReducedMotion as jest.Mock).mockReturnValue(true);
    const view = await mount(tile());
    expect(opacityAbove(view, 'detailSender')).toBe(1);
    expect(opacityAbove(view, 'detailSubject')).toBe(1);
    expect(view.queryByTestId('flyingTile')).toBeNull();
  });
});

describe('the screen', () => {
  const route = (params: object) => ({ key: 'k', name: 'MessageDetail', params }) as never;

  it('fades in when opened from its row, so the tile can fly over it', () => {
    expect(screenOptions({ route: route({ boxId: 'a', messageId: '1', from: tile() }) })).toMatchObject({
      animation: 'fade',
      animationDuration: 150,
    });
  });

  it('is pushed as the platform pushes when opened from anywhere else', () => {
    expect(screenOptions({ route: route({ boxId: 'a', messageId: '1' }) }).animation).toBeUndefined();
    expect(screenOptions({ route: { key: 'k', name: 'Search' } as never }).animation).toBeUndefined();
  });
});

it('opens a message from its row quietly, with no haptic', async () => {
  const trigger = RNHaptic.trigger as unknown as jest.Mock;
  trigger.mockClear();
  const onOpenMessage = jest.fn();
  const view = await render(
    <SafeAreaProvider
      initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } }}
    >
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <NavigationContainer>
          <MessageList
            account={account}
            onOpenSwitcher={() => {}}
            onSearch={() => {}}
            onOpenMessage={onOpenMessage}
            onCompose={() => {}}
            onReauth={() => {}}
            onOpenFaq={() => {}}
            crossBox={[]}
            unified={null}
          />
        </NavigationContainer>
      </TamaguiProvider>
    </SafeAreaProvider>,
  );
  const row = await waitFor(() => view.getByTestId(`message-${mockEnvelope.id}`));
  trigger.mockClear();
  await act(async () => fireEvent.press(row));
  // Jest's views do not say where they are, so it opens without the tile.
  expect(onOpenMessage).toHaveBeenCalledWith(mockEnvelope.id, 'received', 'a', undefined);
  expect(trigger).not.toHaveBeenCalled();
});
