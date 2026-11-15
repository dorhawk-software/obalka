// "Režim ladění zaznamenává" - the strip above every screen while Debug mode is recording (023 FR-007).
//
// WHY IT EXISTS. The Debug screen tells the person to go and repeat whatever is broken, which means
// leaving the one screen that showed recording was on. A state that can write their mail to a file
// cannot be a state they forget they are in, so every screen says so while it lasts, and tapping the
// strip goes back to the screen that can stop it.
//
// NOT AN OVERLAY. It is the TestEnvBanner's shape, for the TestEnvBanner's reason: a normal-flow strip
// that clears the status bar itself and sits above the screen's own header, so it takes real space and
// never covers a control. The screen under it is handed a top inset of 0 through
// `SafeAreaInsetsContext`, which is how `ScreenHeader`, `useHeaderTop` and the TestEnvBanner all stop
// paying the status-bar gap a second time without any of them knowing this component exists.
//
// NO LAYOUT JUMP (constitution V), by construction rather than by luck. Recording starts and stops only
// on the Debug screen, and the strip is never drawn THERE - that screen shows the state in full. So the
// strip never appears or disappears on the screen the person is looking at: screens further down the
// stack gain or lose it while they are covered, and a screen opened later is laid out with it from its
// first frame. The element tree is the same whether the strip shows or not, so it never remounts the
// screen under it either: a half-written message survives recording starting or stopping.
//
// The strip itself is `StatusStrip`, the component the TestEnvBanner is drawn with too, because two
// strips in the same place with different numbers is exactly the drift DESIGN.md forbids - and this one
// began as a copy of the banner's numbers, which were off the scale. Its tone is `chrome`: the header's
// own `surfaceAlt` with a hairline under it, so it reads as part of the chrome rather than as an alert;
// the red dot is the one the Debug screen already uses for "recording".

import {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import {
  SafeAreaInsetsContext,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { YStack } from '../theme/ui';
import { useTheme } from '../theme/ThemeProvider';
import { STATUS_STRIP_ROW, StatusStrip } from '../theme/StatusStrip';
import { space } from '../theme/spacing';
import { t } from '../i18n/strings';
import { useLocale } from './settings/SettingsProvider';
import {
  isDebugRecording,
  subscribeDebugRecording,
} from '../services/debug/debugLog';

/** Whether Debug mode is recording right now, pushed by the recorder rather than polled. */
export function useDebugRecording(): boolean {
  return useSyncExternalStore(
    subscribeDebugRecording,
    isDebugRecording,
    isDebugRecording,
  );
}

/** The recording mark. The Debug screen's status line and the strip draw the same one. */
export function RecordingDot({ onFlap = false }: { readonly onFlap?: boolean }) {
  const theme = useTheme();
  return (
    <YStack
      width={8}
      height={8}
      borderRadius={999}
      backgroundColor={onFlap ? theme.dangerOnFlap : theme.danger}
    />
  );
}

/** True inside a frame. A screen is framed once, however many of its ancestors ask for it. */
const FramedContext = createContext(false);

/**
 * What a screen that prints the strip on its own flap is handed: how to open the Debug screen while a
 * recording runs, null otherwise (and outside any frame).
 */
const FlapStripContext = createContext<{ readonly onOpen?: () => void } | null>(null);

interface FrameProps {
  /** Leave the strip off this screen. The Debug screen passes it - see the header of this file. */
  readonly hidden?: boolean;
  /**
   * The screen prints the strip itself, on its flap (`FlapRecordingStrip`): the inbox, so the envelope
   * still reaches the top of the screen (031 R14). The frame draws nothing and spends no inset.
   */
  readonly onFlap?: boolean;
  /**
   * Opens the Debug screen. Omitted where that screen cannot be reached - the sign-in flow, Welcome
   * and the help drawn over them are outside the navigator - and the strip is then a mark, not a button.
   */
  readonly onOpen?: () => void;
  readonly children: ReactNode;
}

/**
 * Wraps one screen: the strip above it while recording, and the screen itself below with the top
 * inset already spent.
 *
 * A frame inside another frame adds nothing. Screens the shell draws outside the navigator frame
 * themselves, and one of them - the FAQ - is also a navigator route, where the navigator has already
 * framed it: without this it would carry two strips there, the second one clearing a status bar that
 * is not above it. Whether a frame is nested is fixed by where it is mounted, so the element tree
 * still never changes while it stays mounted.
 */
export function DebugRecordingFrame(props: FrameProps) {
  const framed = useContext(FramedContext);
  return framed ? <>{props.children}</> : <OutermostFrame {...props} />;
}

function OutermostFrame({ hidden = false, onFlap = false, onOpen, children }: FrameProps) {
  // The label is the strip's own, not the screen's: it has to re-localize with the app like one.
  useLocale();
  const recording = useDebugRecording();
  const insets = useSafeAreaInsets();
  const show = recording && !hidden && !onFlap;
  const inner = useMemo(
    () => (show ? { ...insets, top: 0 } : insets),
    [show, insets],
  );
  const flap = useMemo(() => (recording && onFlap ? { onOpen } : null), [recording, onFlap, onOpen]);
  return (
    <YStack flex={1}>
      {/* Outside the provider below, so the strip reads the real inset and clears the status bar. */}
      {show ? (
        <StatusStrip
          tone="chrome"
          label={t('debug.indicator')}
          glyph={<RecordingDot />}
          onPress={onOpen}
          accessibilityHint={t('debug.indicator.hint')}
          testID="debugRecordingStrip"
        />
      ) : null}
      <FramedContext.Provider value>
        <FlapStripContext.Provider value={flap}>
          <SafeAreaInsetsContext.Provider value={inner}>
            {children}
          </SafeAreaInsetsContext.Provider>
        </FlapStripContext.Provider>
      </FramedContext.Provider>
    </YStack>
  );
}

/**
 * Whether the screen's flap carries the strip now. The inbox header moves its window down by the
 * strip's row and 4 (`FLAP_STRIP_SPACE`) while it does: R14 draws the window 32 lower.
 */
export function useFlapRecordingStrip(): boolean {
  return useContext(FlapStripContext) !== null;
}

/** The room the strip takes on the flap, R14's 32: the shared strip row (its 30 rounded to 28) and `xs`. */
export const FLAP_STRIP_SPACE = STATUS_STRIP_ROW + space.xs;

/** The strip printed on the inbox's flap, clearing the status bar as every strip does (031 R14). */
export function FlapRecordingStrip() {
  useLocale();
  const strip = useContext(FlapStripContext);
  if (strip === null) {
    return null;
  }
  return (
    <YStack position="absolute" top={0} left={0} right={0}>
      <StatusStrip
        tone="flap"
        label={t('debug.indicator')}
        glyph={<RecordingDot onFlap />}
        onPress={strip.onOpen}
        accessibilityHint={t('debug.indicator.hint')}
        testID="debugRecordingStrip"
      />
    </YStack>
  );
}
