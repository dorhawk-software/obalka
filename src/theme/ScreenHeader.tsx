// The stack-screen header - the design draws ONE header bar and repeats it verbatim across every
// stack screen (compose, search, settings, add-box, credentials, OTP, mobile key, reauth): a flat
// 54px `surfaceAlt` bar below the safe area, a 1px bottom hairline, a 44×44 back chevron and a
// Bricolage 18/700 title. (Entity screens that carry a context subtitle - the message list and
// detail - keep their own header.)
//
// This component said all of that before, and had exactly ONE consumer. The eight screens it names
// each built their own, and by the 2026-09-09 audit they had drifted into four different bars:
//
//   bar sizing            pad L/R   gap   chevron   title
//   minHeight 54          6 / 6      -      44      Title 18/23      ← this file
//   minHeight 54          6 / 6      0      44      Heading 18/23    ← settings
//   minHeight 54          6 / 6      0      44      Title 18/22      ← compose
//   paddingBottom 12      6 / 16     4      44      Heading 18/23    ← the four sign-in screens
//   pt inset+9 / pb 9     10 / 10    6      40      (a search field) ← search
//
// Four geometries, two chevron sizes, and a title line box of 22 in one screen and 23 in the other
// seven - `Title` at 18 derives 22 from the 21/26 role ratio, `Heading` at 18 derives 23 from 17/22,
// and nobody chose either. Three of the copies also forgot `accessibilityRole="header"`, so a screen
// reader could not jump to the title on those screens.
//
// So the shape below is not new; it is the one shape, now reachable. Two variants, because the eight
// screens genuinely need two: a title, or a control that fills the row (search). Anything a ninth
// screen needs belongs HERE, not in a ninth copy.

import type { ReactNode } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { XStack, YStack } from './ui';
import { Title } from './Typography';
import { useTheme } from './ThemeProvider';
import { fonts } from './typography';
import { ChevronLeftIcon } from './icons';
import { touchSlop } from './touchTarget';
import { t } from '../i18n/strings';

/** The design's bar: 54 tall below the safe area, 6px of padding at each end. */
const BAR_MIN_HEIGHT = 54;
const BAR_PADDING = 6;
/** The chevron's drawn size. Its touch target is derived from it - see `touchTarget.ts`. */
const CHEVRON = 44;

export function ScreenHeader({
  title,
  onBack,
  testID = 'back',
  content,
  insetTop = true,
}: {
  /** The screen's name. Omit only when `content` fills the row instead. */
  readonly title?: string;
  readonly onBack?: () => void;
  /** The back control's testID - a couple of screens name theirs for their own flow. */
  readonly testID?: string;
  /**
   * A control that fills the row in place of the title: the search field, today. It is given
   * `flex: 1` by the row, so it should stretch rather than size itself.
   */
  readonly content?: ReactNode;
  /**
   * Whether this header clears the status bar itself. Almost always yes; pass `false` only when
   * something above it (a `TestEnvBanner`) has already consumed the inset, or the gap is paid twice.
   */
  readonly insetTop?: boolean;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <YStack
      backgroundColor={theme.surfaceAlt}
      paddingTop={insetTop ? insets.top : 0}
    >
      <XStack
        // minHeight, not height: at a large system font size the Bricolage title is taller than the
        // bar the design drew for it, and a fixed 54 clips its descenders instead of growing.
        minHeight={BAR_MIN_HEIGHT}
        alignItems="center"
        paddingHorizontal={BAR_PADDING}
        // A control filling the row needs air at the trailing edge that a title does not.
        paddingRight={content ? 12 : BAR_PADDING}
        gap={content ? 6 : 0}
      >
        {onBack ? (
          <XStack
            width={CHEVRON}
            height={CHEVRON}
            flexShrink={0}
            alignItems="center"
            justifyContent="center"
            borderRadius={999}
            // Derived, not typed: resize the chevron and its touch area follows. Two of the copies
            // this replaces had hand-typed slops that no longer reached 48.
            hitSlop={touchSlop({ width: CHEVRON, height: CHEVRON })}
            pressStyle={{ opacity: 0.5 }}
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            testID={testID}
          >
            <ChevronLeftIcon size={24} color={theme.text} />
          </XStack>
        ) : null}
        {content ?? (
          <Title
            // Announced as a heading so a screen reader can jump straight to it - every stack screen
            // in the app gets that from this one line (001 T042).
            accessibilityRole="header"
            fontFamily={fonts.displayBold} // Bricolage 700 - a fontWeight prop can't switch the face
            fontSize={18}
            lineHeight={23}
            fontWeight="700"
            letterSpacing={-0.3}
            color={theme.text}
            numberOfLines={2}
            // The title sits flush after the 44px chevron (bar pad 6 + 44 = 50). With no chevron it
            // keeps the design's 18px content inset instead (bar pad 6 + 12).
            marginLeft={onBack ? 0 : 12}
            flexShrink={1}
          >
            {title}
          </Title>
        )}
      </XStack>
      {/* The bar's bottom edge. `surfaceAlt` on `bg` is 1.06:1 - without this there is no edge. */}
      <YStack height={1} backgroundColor={theme.border} />
    </YStack>
  );
}
