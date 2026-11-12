// A received message scrolled past its letter (031, board "Message, scrolled", B as chosen
// 2026-11-12): the bar becomes the envelope. As the envelope's last 54 slide under the paper bar, a band
// of its blue comes in over the bar - the back chevron in white, the sender on the blue, the window
// beside it - so who it is from and who it is for stay in sight. Scrolling back to the top lets the bar
// return. The band follows the finger: it has no animation of its own, so Reduce Motion leaves it be.
//
// Its opacity runs on the native driver from the scroll, which Android draws (031 I68, I70).

import { useCallback, useMemo, useRef, useState } from 'react';
import { Animated, StatusBar, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { YStack } from '../../../theme/ui';
import { Overline, Subheading } from '../../../theme/Typography';
import { useTheme } from '../../../theme/ThemeProvider';
import { HeaderBack } from '../../../theme/ScreenHeader';
import { Envelope } from '../../../theme/objects/Envelope';
import { Window } from '../../../theme/objects/Window';
import { envelopeShape } from '../../../theme/print';
import { objectShadow } from '../../../theme/depth';
import { space } from '../../../theme/spacing';
import { useOnScreen } from '../../../theme/useOnScreen';
import { t } from '../../../i18n/strings';
import type { DataBoxAccount, MessageEnvelope } from '../../../services/isds/types';

/** The band's height under the status bar, and how far of scrolling it takes to come in. */
export const BAND_HEIGHT = 54;

/**
 * The scroll over which the band comes in: from when the envelope's bottom is 54 below the bar to when
 * it has gone under it. `envelopeBottom` is where the envelope ends in the scrolled content; before it
 * is known, the band never comes.
 */
export function tuckRange(envelopeBottom: number | null) {
  const end = envelopeBottom ?? Number.MAX_SAFE_INTEGER;
  return { inputRange: [end - BAND_HEIGHT, end], outputRange: [0, 1], extrapolate: 'clamp' as const };
}

/** Whether the band is in, for what is not drawn by the scroll: touches, the status bar, assistive technology. */
export function isTucked(scrollY: number, envelopeBottom: number | null): boolean {
  return envelopeBottom != null && scrollY >= envelopeBottom - BAND_HEIGHT / 2;
}

/** The scroll handler for the message, and the band's progress. */
export function useTuck() {
  const [scrollY] = useState(() => new Animated.Value(0));
  const [envelopeBottom, setEnvelopeBottom] = useState<number | null>(null);
  const [tucked, setTucked] = useState(false);
  const bottom = useRef<number | null>(null);
  bottom.current = envelopeBottom;
  const lastY = useRef(0);

  const onScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
        useNativeDriver: true,
        listener: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
          lastY.current = e.nativeEvent.contentOffset.y;
          setTucked(isTucked(lastY.current, bottom.current));
        },
      }),
    [scrollY],
  );
  // A node made once per place: the scroll moves it on the UI thread, and a new one is only handed over
  // when the envelope's place changes (the fikce band above it arrives).
  const progress = useMemo(() => scrollY.interpolate(tuckRange(envelopeBottom)), [scrollY, envelopeBottom]);
  const onEnvelopeBottom = useCallback((y: number) => {
    setEnvelopeBottom(y);
    // The place can change while the message is scrolled; the band's state follows it at once.
    setTucked(isTucked(lastY.current, y));
  }, []);
  return { onScroll, progress, tucked, onEnvelopeBottom };
}

export function DetailBand({
  top,
  envelope,
  account,
  tuck,
  onBack,
}: {
  /** The paper bar's top padding, which the band's row lines up with. */
  readonly top: number;
  readonly envelope: MessageEnvelope;
  /** The box it arrived in: who the window names when the message itself does not (as the envelope). */
  readonly account: DataBoxAccount;
  readonly tuck: Pick<ReturnType<typeof useTuck>, 'progress' | 'tucked'>;
  readonly onBack: () => void;
}) {
  const theme = useTheme();
  const { progress, tucked } = tuck;
  const onScreen = useOnScreen();
  // The envelope's blue covers the bar over the first half, and its print comes in over the second:
  // one fade for both put the bar's title and the sender over each other (Obalka_Demo).
  const { cover, print } = useMemo(
    () => ({
      cover: progress.interpolate({ inputRange: [0, 0.5], outputRange: [0, 1], extrapolate: 'clamp' }),
      print: progress.interpolate({ inputRange: [0.5, 1], outputRange: [0, 1], extrapolate: 'clamp' }),
    }),
    [progress],
  );
  return (
    // Over the whole bar and its hairline.
    <Animated.View
      pointerEvents={tucked ? 'auto' : 'none'}
      accessibilityElementsHidden={!tucked}
      importantForAccessibility={tucked ? 'auto' : 'no-hide-descendants'}
      testID="detailBand"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        opacity: cover,
      }}
    >
      {tucked && onScreen ? <StatusBar barStyle="light-content" /> : null}
      {/* The paper behind the band's corners is the screen's, not the bar's. */}
      <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: top + BAND_HEIGHT + 1, backgroundColor: theme.bg }} />
      <View
        style={{
          paddingTop: top,
          // The row's square corners would cover the rounded ones.
          overflow: 'hidden',
          backgroundColor: theme.envelope,
          borderBottomLeftRadius: envelopeShape.headerRadius,
          borderBottomRightRadius: envelopeShape.headerRadius,
          boxShadow: objectShadow(theme.name, 'envelopeHeader'),
        }}
      >
        {/* The 54 is the envelope's front: its folds are drawn there, not across the status bar. It
            grows with the largest text sizes rather than cut the sender off (Obalka_Demo, 2.0x). */}
        <Envelope
          style={{
            minHeight: BAND_HEIGHT,
            paddingVertical: space.xs,
            borderRadius: 0,
            boxShadow: [],
            justifyContent: 'center',
            paddingLeft: space.sm,
            paddingRight: space.md,
          }}
        >
          <Animated.View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, opacity: print }}>
            <HeaderBack onBack={onBack} color={theme.onSolid} testID="bandBack" />
            <YStack flex={1} minWidth={0}>
              <Overline color={theme.envelopeInkSoft}>{t('detail.from')}</Overline>
              <Subheading color={theme.onSolid} numberOfLines={1} testID="bandSender">
                {envelope.sender || '—'}
              </Subheading>
            </YStack>
            <Window
              radius={12}
              style={{
                maxWidth: 150,
                minHeight: 40,
                justifyContent: 'center',
                paddingVertical: space.sm,
                paddingLeft: space.lg,
                paddingRight: space.xl,
              }}
            >
              <Subheading numberOfLines={1} testID="bandRecipient">
                {envelope.recipient || (account.alias ?? account.label)}
              </Subheading>
            </Window>
          </Animated.View>
        </Envelope>
      </View>
    </Animated.View>
  );
}
