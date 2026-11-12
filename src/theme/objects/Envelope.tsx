// The envelope (031): a box, and what arrives in it. The logo's blue, fixed in both appearances, with
// its two folds. `Envelope` is the front of one (a message, the sent result); `EnvelopeTile` is the
// envelope as an avatar - a box, or a sender, sealed with the gold flap while unread.

import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../ThemeProvider';
import { monogram } from '../avatarPalette';
import { objectShadow } from '../depth';
import { envelopeShape, envelopeTile } from '../print';
import { fonts, type } from '../typeScale';

/**
 * The front of an envelope around `children` (the sender, the window, the postmark), which set its
 * padding and size it. The folds are drawn on the message envelope's sheet stretched to the size, at
 * a constant line weight.
 */
export function Envelope({
  children,
  style,
}: {
  readonly children: ReactNode;
  readonly style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const c = envelopeShape.creases;
  return (
    <View
      style={[
        {
          borderRadius: envelopeShape.radius,
          backgroundColor: theme.envelope,
          overflow: 'hidden',
          boxShadow: objectShadow(theme.name, 'envelope'),
        },
        style,
      ]}
    >
      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${c.width} ${c.height}`}
        preserveAspectRatio="none"
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Path
          d={c.d}
          stroke={theme.envelopeCrease}
          strokeWidth={c.stroke}
          fill="none"
          vectorEffect="non-scaling-stroke"
        />
      </Svg>
      {children}
    </View>
  );
}

/**
 * The envelope as an avatar tile, in the box's or the sender's own colour, with their monogram. A
 * sealed gold flap says "unread" and replaces the dot; a read one shows its fold. The tile is the
 * picture of a name the row already says, so assistive technology skips it.
 */
export function EnvelopeTile({
  name,
  color,
  sealed = false,
  size = 42,
}: {
  readonly name: string | null | undefined;
  readonly color: string;
  readonly sealed?: boolean;
  /** 42 for a sender in a list, 40 for a box, 24 beside a sender in the register. */
  readonly size?: number;
}) {
  const theme = useTheme();
  const t = envelopeTile;
  const large = size >= 42;
  if (size < t.smallBelow) {
    // The register's small tile (InboxA): too small for a flap or a fold to read, so plain, the
    // monogram centred. A read row's sender; the attention sheets carry the sealed ones.
    return (
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          width: size,
          height: size,
          borderRadius: t.smallRadius,
          backgroundColor: color,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* The Tag role's face and size; only the face, never `fontWeight`, as Typography does. */}
        <Text
          style={{
            fontFamily: type.tag.fontFamily,
            fontSize: type.tag.fontSize,
            lineHeight: type.tag.lineHeight,
            letterSpacing: type.tag.letterSpacing,
            color: theme.onSolid,
          }}
        >
          {monogram(name)}
        </Text>
      </View>
    );
  }
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: t.radius,
        backgroundColor: color,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingBottom: large ? 5 : 6,
      }}
    >
      {sealed ? (
        <Svg
          width={size}
          height={(size * t.flapHeight) / 42}
          viewBox={`0 0 42 ${t.flapHeight}`}
          style={{ position: 'absolute', left: 0, top: 0 }}
        >
          <Path d={t.flap} fill={theme.flap} />
        </Svg>
      ) : (
        <Svg width={size} height={size} viewBox="0 0 42 42" style={StyleSheet.absoluteFill}>
          <Path
            d={t.fold}
            fill="none"
            stroke={theme.envelopeFold}
            strokeWidth={t.foldStroke}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      )}
      {/* The line is the iOS clipping model's (inkClipping.ts): an accent like "Ů" needs it. */}
      <Text
        style={{
          fontFamily: fonts.bodyBold,
          fontSize: large ? 15 : 13,
          lineHeight: large ? 19 : 17,
          color: theme.onSolid,
        }}
      >
        {monogram(name)}
      </Text>
    </View>
  );
}
