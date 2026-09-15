// The drag gestures' configuration and release logic.
//
// jest cannot recognise a gesture - that is the device pass's job - but it can read what each screen
// asked Gesture Handler for and drive the release callback by hand. That is where a migration can go
// quietly wrong: a threshold retyped, an offset dropped, `onEnd` mapped onto a callback that fires on
// different transitions, the dismiss called on the wrong side of the slide-out. So this pins:
//   - the sheet pan (box switcher, ⋯ menu, Termín picker): activates on a 12pt downward drag, follows
//     the finger down only, dismisses past 90pt or 800pt/s AFTER the slide-out finishes, else springs
//     back - and each of the three sheets is wired to it with its own close, the ⋯ menu only while
//     its sheet is open;
//   - the iOS edge swipe: a 20pt rightward drag activates, a 15pt vertical one fails it, and it
//     commits past a third of the width or on a 60pt+ flick faster than 600pt/s.

import { Dimensions, Platform, Text } from 'react-native';
import { act, fireEvent, render, renderHook } from '@testing-library/react-native';
import { usePanGesture } from 'react-native-gesture-handler';
import * as Reanimated from 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { AppThemeProvider } from '../../src/theme/ThemeProvider';
import { useSheetDismissPan } from '../../src/theme/SheetDismissGesture';
import { EdgeSwipeBack } from '../../src/app/EdgeSwipeBack';
import { BoxOverflowMenu } from '../../src/features/accounts/screens/BoxOverflowMenu';
import { BoxSwitcherSheet } from '../../src/features/accounts/screens/BoxSwitcherSheet';
import { TermPicker } from '../../src/features/messages/screens/TermPicker';
import type { DataBoxAccount } from '../../src/services/isds/types';

type PanConfig = {
  activeOffsetX?: number | [number, number];
  activeOffsetY?: number | [number, number];
  failOffsetX?: number | [number, number];
  failOffsetY?: number | [number, number];
  onUpdate: (e: { translationX: number; translationY: number }) => void;
  onDeactivate: (e: {
    translationX: number;
    translationY: number;
    velocityX: number;
    velocityY: number;
    canceled: boolean;
  }) => void;
};

const panMock = usePanGesture as unknown as jest.Mock;

/** The config the most recent `usePanGesture` call was given. */
function lastPanConfig(): PanConfig {
  const calls = panMock.mock.calls;
  expect(calls.length).toBeGreaterThan(0);
  return calls[calls.length - 1][0] as PanConfig;
}

type TimingCall = { to: number; duration: number; done?: (finished: boolean) => void };

/**
 * `withTiming` that records each animation and returns its target, so `value` reads as where the
 * animation is heading. The completion callback is kept for the test to fire.
 */
function recordTimings(): TimingCall[] {
  const timings: TimingCall[] = [];
  jest
    .spyOn(Reanimated, 'withTiming')
    .mockImplementation(((
      to: number,
      config: { duration: number },
      done?: (finished: boolean) => void,
    ) => {
      timings.push({ to, duration: config.duration, done });
      return to;
    }) as unknown as typeof Reanimated.withTiming);
  return timings;
}

const release = (over: Partial<Parameters<PanConfig['onDeactivate']>[0]>) => ({
  translationX: 0,
  translationY: 0,
  velocityX: 0,
  velocityY: 0,
  canceled: false,
  ...over,
});

const account = (boxId: string): DataBoxAccount => ({
  id: boxId,
  boxId,
  loginName: 'user',
  label: `Box ${boxId}`,
  dbType: null,
  alias: null,
  authMethod: 'password',
  host: 'czebox',
  secretRef: 'ref',
  sessionValidUntil: null,
  passwordExpiresAt: null,
  lastSyncedAt: null,
  messageCount: null,
  unreadCount: null,
  pdzCreditCzk: null,
  syncError: null,
  createdAt: 0,
  updatedAt: 0,
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

beforeEach(() => {
  panMock.mockClear();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('the sheet dismiss pan', () => {
  async function sheetPan() {
    const dragY = { value: 0 } as Reanimated.SharedValue<number>;
    const onDismiss = jest.fn();
    await renderHook(() => useSheetDismissPan(dragY, onDismiss));
    return { dragY, onDismiss, config: lastPanConfig() };
  }

  it('activates on a 12pt downward drag and sets no other offset', async () => {
    const { config } = await sheetPan();
    expect(config.activeOffsetY).toBe(12);
    expect(config.activeOffsetX).toBeUndefined();
    expect(config.failOffsetX).toBeUndefined();
    expect(config.failOffsetY).toBeUndefined();
  });

  it('follows the finger down, never up past rest', async () => {
    const { config, dragY } = await sheetPan();
    config.onUpdate({ translationX: 0, translationY: 40 });
    expect(dragY.value).toBe(40);
    config.onUpdate({ translationX: 0, translationY: -30 });
    expect(dragY.value).toBe(0);
  });

  it.each([
    ['dragged past 90pt', { translationY: 91 }],
    ['flicked faster than 800pt/s', { translationY: 20, velocityY: 801 }],
  ])('%s: slides off-screen, and dismisses only once the slide has finished', async (_, over) => {
    const timings = recordTimings();
    const { config, dragY, onDismiss } = await sheetPan();
    config.onDeactivate(release(over));
    expect(timings).toHaveLength(1);
    expect(timings[0]).toMatchObject({ to: 600, duration: 180 });
    expect(dragY.value).toBe(600);
    expect(onDismiss).not.toHaveBeenCalled();

    timings[0].done?.(false); // interrupted: stays open
    expect(onDismiss).not.toHaveBeenCalled();
    timings[0].done?.(true);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('springs back at exactly 90pt and 800pt/s - the thresholds are exclusive', async () => {
    const timings = recordTimings();
    const { config, dragY, onDismiss } = await sheetPan();
    dragY.value = 90;
    config.onDeactivate(release({ translationY: 90, velocityY: 800 }));
    expect(timings).toEqual([{ to: 0, duration: 160, done: undefined }]);
    expect(dragY.value).toBe(0);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it.each([
    [
      'the box switcher',
      (onClose: () => void) => (
        <BoxSwitcherSheet
          onClose={onClose}
          accounts={[account('a')]}
          activeBoxId="a"
          onSwitch={() => {}}
          onAddBox={() => {}}
          onOpenSettings={() => {}}
          onSetAlias={() => {}}
          onRemove={async () => {}}
        />
      ),
    ],
    [
      'the Termín picker',
      (onClose: () => void) => (
        <TermPicker current={null} onPick={() => {}} onRemove={() => {}} onClose={onClose} />
      ),
    ],
  ])('%s closes through it', async (_, ui) => {
    const timings = recordTimings();
    const onClose = jest.fn();
    await wrap(ui(onClose));
    const config = lastPanConfig();
    expect(config.activeOffsetY).toBe(12);
    config.onDeactivate(release({ translationY: 200 }));
    timings[timings.length - 1].done?.(true);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('the ⋯ menu closes through it', async () => {
    const timings = recordTimings();
    const view = await wrap(
      <BoxOverflowMenu account={account('a')} onRename={() => {}} onRemove={() => {}} />,
    );
    // Closed, it registers no pan: a hook-API gesture exists natively from mount, and this host sits
    // on every row of the switcher.
    expect(panMock).not.toHaveBeenCalled();
    await fireEvent.press(view.getByTestId('boxMenu-a'));
    expect(view.getByText('Přejmenovat')).toBeTruthy();

    const config = lastPanConfig();
    expect(config.activeOffsetY).toBe(12);
    config.onDeactivate(release({ translationY: 200 }));
    const slide = timings.find(t => t.to === 600);
    expect(slide).toBeDefined();
    await act(() => slide?.done?.(true));
    expect(view.queryByText('Přejmenovat')).toBeNull();
  });
});

describe('the iOS edge swipe back', () => {
  const originalOS = Platform.OS;
  afterEach(() => {
    Platform.OS = originalOS;
  });

  async function edgePan(os: typeof Platform.OS) {
    Platform.OS = os;
    const onBack = jest.fn();
    await wrap(
      <EdgeSwipeBack onBack={onBack}>
        <Text>screen</Text>
      </EdgeSwipeBack>,
    );
    return { onBack };
  }

  it('activates on a 20pt rightward drag and yields to a 15pt vertical one', async () => {
    await edgePan('ios');
    const config = lastPanConfig();
    expect(config.activeOffsetX).toBe(20);
    expect(config.failOffsetY).toEqual([-15, 15]);
    expect(config.activeOffsetY).toBeUndefined();
    expect(config.failOffsetX).toBeUndefined();
  });

  it.each([
    ['past a third of the width', { translationX: Dimensions.get('window').width * 0.33 + 1 }],
    ['on a 60pt+ flick faster than 600pt/s', { translationX: 61, velocityX: 601 }],
  ])('commits %s: slides the width, then goes back', async (_, over) => {
    const timings = recordTimings();
    const { onBack } = await edgePan('ios');
    lastPanConfig().onDeactivate(release(over));
    const slide = timings[timings.length - 1];
    expect(slide).toMatchObject({ to: Dimensions.get('window').width, duration: 160 });
    expect(onBack).not.toHaveBeenCalled();
    slide.done?.(true);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['a drag short of a third', { translationX: Dimensions.get('window').width * 0.33 }],
    ['a fast flick shorter than 60pt', { translationX: 60, velocityX: 2000 }],
    ['a 60pt+ drag at exactly 600pt/s', { translationX: 61, velocityX: 600 }],
  ])('snaps back on %s', async (_, over) => {
    const timings = recordTimings();
    const { onBack } = await edgePan('ios');
    lastPanConfig().onDeactivate(release(over));
    expect(timings[timings.length - 1]).toEqual({ to: 0, duration: 160, done: undefined });
    expect(onBack).not.toHaveBeenCalled();
  });

  it('brings the screen back when it is still there after going back (2026-09-24)', async () => {
    // Left slid off by its full width, the screen drawn next in the same wrapper - or this one, when
    // back asks a question instead of leaving - showed as a blank screen on an iPhone.
    const timings = recordTimings();
    await edgePan('ios');
    lastPanConfig().onDeactivate(
      release({ translationX: Dimensions.get('window').width * 0.33 + 1 }),
    );
    timings[timings.length - 1].done?.(true);
    await act(() => new Promise(resolve => setTimeout(resolve, 300)));
    expect(timings[timings.length - 1]).toEqual({ to: 0, duration: 160, done: undefined });
  });

  it('is not a pan at all on Android - the system back handles it', async () => {
    await edgePan('android');
    expect(panMock).not.toHaveBeenCalled();
  });
});
