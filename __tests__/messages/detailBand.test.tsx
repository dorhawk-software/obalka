// A received message scrolled past its letter (031, board "Message, scrolled", B as chosen
// 2026-11-12): the envelope tucks into the bar, and a band of its blue names who it is from and, in its
// window, who it is for. The band's fade is drawn by the scroll on the UI thread and walked on a
// device; these hold where it comes in, that it neither takes touches nor speaks until it is in, that
// the status bar turns light over it, and that a sent message tucks the same way.

import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { AppState, StatusBar, StyleSheet } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { lightTheme } from '../../src/theme/theme';
import type { DataBoxAccount, MessageEnvelope } from '../../src/services/isds/types';

const mockEnvelope: MessageEnvelope = {
  id: '1234567',
  subject: 'Rozhodnutí o přestupku',
  sender: 'Krajský úřad Lesního kraje',
  senderAddress: null,
  recipient: 'Jana Nováková',
  recipientAddress: null,
  recipientBoxId: 'ab12cd3',
  deliveryTime: Date.now() - 2 * 24 * 60 * 60 * 1000,
  acceptanceTime: Date.now() - 24 * 60 * 60 * 1000,
  state: 7,
  attachmentSize: 1,
};

jest.mock('../../src/features/accounts/deps', () => ({
  messagesController: {
    getCachedEnvelope: jest.fn(async () => mockEnvelope),
    getCachedSyncedAt: jest.fn(async () => null),
    getCachedDetail: jest.fn(async () => null),
    markRead: jest.fn(async () => false),
    getDetail: jest.fn(),
    setAttachmentsUnavailable: jest.fn(async () => {}),
    fetchSignedOriginal: jest.fn(),
  },
  accountsController: { decrementUnread: jest.fn(async () => {}) },
  remindersController: {
    get: jest.fn(async () => null),
    setReminder: jest.fn(async () => {}),
    removeReminder: jest.fn(async () => {}),
    alertsFor: jest.fn(async () => 'on'),
    turnOnAlerts: jest.fn(async () => {}),
  },
  scanController: {
    enabled: jest.fn(async () => false),
    isDismissed: jest.fn(async () => false),
    scan: jest.fn(async () => null),
    dismiss: jest.fn(),
  },
}));
jest.mock('../../src/services/files/attachmentFileStore', () => ({
  attachmentFileStore: { exists: jest.fn(async () => true) },
}));
jest.mock('../../src/services/files/attachmentOpener', () => ({
  attachmentOpener: { open: jest.fn() },
  NoViewerError: class NoViewerError extends Error {},
  openSignedOriginal: jest.fn(),
}));

import { MessageDetail } from '../../src/features/messages/screens/MessageDetail';
import { BAND_HEIGHT, isTucked, tuckRange } from '../../src/features/messages/screens/DetailBand';

const account: DataBoxAccount = {
  id: 'a1',
  boxId: 'box1',
  loginName: 'user',
  label: 'Jan Novák',
  dbType: 'FO',
  alias: null,
  authMethod: 'password',
  host: 'production',
  secretRef: 'box1',
  sessionValidUntil: null,
  passwordExpiresAt: null,
  lastSyncedAt: null,
  messageCount: null,
  unreadCount: null,
  pdzCreditCzk: null,
  syncError: null,
  createdAt: 1,
  updatedAt: 1,
};

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, bottom: 34, left: 0, right: 0 },
};

// In front: the status bar is only turned light on a screen that is (`useOnScreen`).
const appState = AppState as unknown as { currentState: string };
const before = appState.currentState;
// The letter's opening is `envelopeFlight.test.tsx`'s: here the envelope stands still, as with Reduce
// Motion, so no animation of it ends after a test has.
beforeEach(() => {
  appState.currentState = 'active';
  (useReducedMotion as jest.Mock).mockReturnValue(true);
});
afterEach(() => {
  appState.currentState = before;
  (useReducedMotion as jest.Mock).mockReturnValue(false);
});

const hidden = { includeHiddenElements: true };

// The envelope 12 into its block, 170 tall; the block 0 into the content: it ends 182 down.
const ENVELOPE_BOTTOM = 182;

async function open(folder: 'received' | 'sent' = 'received') {
  const onBack = jest.fn();
  const view = await render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <MessageDetail account={account} messageId={mockEnvelope.id} folder={folder} onBack={onBack} />
      </TamaguiProvider>
    </SafeAreaProvider>,
  );
  await waitFor(() => view.getByTestId('detailScroll'), { timeout: 3000 });
  await act(async () => {});
  return { view, onBack };
}

const layout = (y: number, height: number) => ({ nativeEvent: { layout: { x: 0, y, width: 358, height } } });

async function placeEnvelope(view: Awaited<ReturnType<typeof open>>['view']) {
  await fireEvent(view.getByTestId('detailEnvelope'), 'layout', layout(0, 400));
  await fireEvent(view.getByTestId('detailEnvelopeFront'), 'layout', layout(12, 170));
}

async function scrollTo(view: Awaited<ReturnType<typeof open>>['view'], y: number) {
  await fireEvent.scroll(view.getByTestId('detailScroll'), {
    nativeEvent: {
      contentOffset: { x: 0, y },
      contentSize: { width: 390, height: 2000 },
      layoutMeasurement: { width: 390, height: 700 },
    },
  });
}

// What the mounted `StatusBar`s ask for - React Native's own stack of them.
const lightBar = () =>
  (StatusBar as unknown as { _propsStack: { barStyle: { value: string } | null }[] })._propsStack.some(
    entry => entry.barStyle?.value === 'light-content',
  );

describe('where the band comes in', () => {
  it('over the last 54 of the envelope, as it goes under the bar', () => {
    expect(tuckRange(ENVELOPE_BOTTOM)).toEqual({
      inputRange: [ENVELOPE_BOTTOM - BAND_HEIGHT, ENVELOPE_BOTTOM],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    });
  });

  it('is in from half way, and never before the envelope has said where it ends', () => {
    expect(isTucked(ENVELOPE_BOTTOM - BAND_HEIGHT / 2 - 1, ENVELOPE_BOTTOM)).toBe(false);
    expect(isTucked(ENVELOPE_BOTTOM - BAND_HEIGHT / 2, ENVELOPE_BOTTOM)).toBe(true);
    expect(isTucked(10_000, null)).toBe(false);
  });
});

describe('the bar', () => {
  const paddingTops = (root: unknown): number[] => {
    const out: number[] = [];
    const walk = (n: unknown) => {
      if (!n || typeof n !== 'object') {
        return;
      }
      const node = n as { props?: { style?: unknown }; children?: unknown[] };
      const flat = (StyleSheet.flatten(node.props?.style as never) ?? {}) as { paddingTop?: number };
      if (typeof flat.paddingTop === 'number') {
        out.push(flat.paddingTop);
      }
      (node.children ?? []).forEach(walk);
    };
    walk(root);
    return out;
  };

  it("is every screen's bar: the inset, 54, the hairline, with its quiet title a heading", async () => {
    // It sat 12 lower than every other bar, so going from the list to a message and on to Settings
    // the header jumped; the title stays faint, the envelope's subject being this screen's headline
    // (the owner's answer 14, 2026-11-15).
    const { view } = await open();
    const tops = paddingTops(view.toJSON());
    expect(tops).toContain(METRICS.insets.top);
    expect(tops).not.toContain(METRICS.insets.top + 12);
    const title = view.getByText('Přijatá zpráva');
    expect(title.props.accessibilityRole).toBe('header');
    expect(StyleSheet.flatten(title.props.style).color).toBe(lightTheme.textFaint);
  });
});

describe('a received message', () => {
  it('names who it is from, and in the window who it is for', async () => {
    const { view } = await open();
    expect(view.getByTestId('bandSender', hidden)).toHaveTextContent(mockEnvelope.sender);
    expect(view.getByTestId('bandRecipient', hidden)).toHaveTextContent('Jana Nováková');
  });

  it('keeps the band out of reach at the top: no touches, nothing to read aloud, a dark status bar', async () => {
    const { view } = await open();
    await placeEnvelope(view);
    await scrollTo(view, 0);
    const band = view.getByTestId('detailBand', hidden);
    expect(band.props.pointerEvents).toBe('none');
    expect(band.props.accessibilityElementsHidden).toBe(true);
    expect(lightBar()).toBe(false);
  });

  it('hands the band the bar once the envelope has tucked in, and gives it back at the top', async () => {
    const { view, onBack } = await open();
    await placeEnvelope(view);
    await scrollTo(view, ENVELOPE_BOTTOM);
    const band = view.getByTestId('detailBand');
    expect(band.props.pointerEvents).toBe('auto');
    expect(band.props.accessibilityElementsHidden).toBe(false);
    // The paper bar's own back is under it now: one back for assistive technology, not two.
    // (An ancestor hides it: the bar is the shared ScreenHeader, wrapped.)
    let node = view.getByTestId('back', hidden).parent;
    let hiddenByAncestor = false;
    while (node) {
      hiddenByAncestor ||= node.props.accessibilityElementsHidden === true;
      node = node.parent;
    }
    expect(hiddenByAncestor).toBe(true);
    expect(lightBar()).toBe(true);
    await fireEvent.press(view.getByTestId('bandBack'));
    expect(onBack).toHaveBeenCalledTimes(1);

    await scrollTo(view, 0);
    expect(view.getByTestId('detailBand', hidden).props.pointerEvents).toBe('none');
    expect(lightBar()).toBe(false);
  });

  it('follows the envelope when its place is learnt while the message is already scrolled', async () => {
    const { view } = await open();
    await scrollTo(view, ENVELOPE_BOTTOM);
    expect(view.getByTestId('detailBand', hidden).props.pointerEvents).toBe('none');
    await placeEnvelope(view);
    expect(view.getByTestId('detailBand', hidden).props.pointerEvents).toBe('auto');
    expect(lightBar()).toBe(true);
  });
});

// Since 031 R7 a sent message has the Sent board's envelope, so it tucks as a received one does: the
// sender on the blue (the box it went from), the recipient in the window.
it('tucks a sent message too, now that it has an envelope', async () => {
  const { view } = await open('sent');
  expect(view.getByTestId('bandSender', hidden)).toHaveTextContent(mockEnvelope.sender);
  expect(view.getByTestId('bandRecipient', hidden)).toHaveTextContent('Jana Nováková');
  await placeEnvelope(view);
  await scrollTo(view, ENVELOPE_BOTTOM);
  expect(view.getByTestId('bandBack').props.accessibilityElementsHidden).toBeFalsy();
});
