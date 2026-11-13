// The envelope (031): a box, and what arrives in it. The logo's blue, fixed in both appearances, with
// its two folds. `Envelope` is the front of one (a message, the sent result); `EnvelopeTile` is the
// envelope as an avatar - a box, or a sender, sealed with the gold flap while unread.

import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { ClipPath, Defs, G, LinearGradient, Path, Pattern, Rect, Stop } from 'react-native-svg';
import { useTheme } from '../ThemeProvider';
import { monogram } from '../avatarPalette';
import { objectFilter, objectShadow } from '../depth';
import { envelopePose, envelopeShape, envelopeTile, openEnvelope } from '../print';
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

/** Where the boxes behind the front one lie, nearest first (board R5: 3 and 8 degrees, up and right). */
const STACK_FAN = [
  { left: 5, top: 0, rotate: '3deg' },
  { left: 10, top: -3, rotate: '8deg' },
] as const;

/**
 * All boxes at once (031 I15/I54, board R5): the boxes' own envelopes fanned, the first in front with
 * how many there are on it. 46 x 40 in the inbox's window and in the switcher. Never one envelope:
 * a merged view is not an identity, so it shows the identities it merges.
 */
export function BoxStackTile({ colors, count }: { readonly colors: readonly string[]; readonly count: number }) {
  const theme = useTheme();
  const [front = theme.envelope, ...behind] = colors;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="boxStackTile"
      style={{ width: 46, height: 40 }}
    >
      {behind
        .slice(0, STACK_FAN.length)
        .map((color, i) => ({ color, at: STACK_FAN[i] }))
        .reverse()
        .map(({ color, at }) => (
          <View
            key={at.rotate}
            style={{
              position: 'absolute',
              left: at.left,
              top: at.top,
              width: 34,
              height: 34,
              borderRadius: envelopeTile.radius,
              backgroundColor: color,
              transform: [{ rotate: at.rotate }],
            }}
          />
        ))}
      <View style={{ position: 'absolute', left: 0, top: 4 }}>
        <EnvelopeTile name={String(count)} color={front} size={36} />
      </View>
    </View>
  );
}

/**
 * The open envelope of the empty inbox (board Empty): nothing in it but its lining. One drawing at
 * 220 x 196, its shadow a filter so it follows the flap's point.
 */
export function OpenEnvelope() {
  const theme = useTheme();
  const g = openEnvelope;
  const b = g.back;
  return (
    <View style={{ filter: objectFilter(theme.name, 'openEnvelope') }}>
      <Svg
        width={g.width}
        height={g.height}
        viewBox={`0 0 ${g.width} ${g.height}`}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Defs>
          <Pattern id="lining" width={g.lining.width} height={g.lining.height} patternUnits="userSpaceOnUse">
            <Path
              d={g.lining.d}
              fill="none"
              stroke={theme.lining}
              strokeWidth={g.lining.stroke}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Pattern>
          <ClipPath id="inside">
            <Rect
              transform={[{ translateX: b.x }, { translateY: b.y }]}
              width={b.width}
              height={b.height}
              rx={b.radius}
            />
          </ClipPath>
        </Defs>
        <Path d={g.flap} fill={theme.flap} />
        <Path d={g.flap} fill={theme.flapShade} />
        <Rect
          transform={[{ translateX: b.x }, { translateY: b.y }]}
          width={b.width}
          height={b.height}
          rx={b.radius}
          fill={theme.envelopeInside}
        />
        {/* The whole drawing's size, clipped to the inside: the lining's tiles start at the drawing's
            corner, as the canvas's pattern does. */}
        <G clipPath="url(#inside)">
          <Rect width={g.width} height={g.height} fill="url(#lining)" opacity={g.lining.opacity} />
        </G>
        <Path d={g.front} fill={theme.envelope} />
        <Path d={g.folds} fill="none" stroke={theme.envelopeFoldFaint} strokeWidth={g.foldStroke} />
      </Svg>
    </View>
  );
}

/** A rounded rectangle as a path. */
function roundRect(x: number, y: number, w: number, h: number, r: number): string {
  return (
    `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}` +
    `H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`
  );
}

/** Turned `deg` about a point, as SVG's `rotate(deg cx cy)`. */
function turned(deg: number, cx: number, cy: number) {
  return [{ translateX: cx }, { translateY: cy }, { rotate: `${deg}deg` }, { translateX: -cx }, { translateY: -cy }];
}

/** What an empty, failed or waiting list draws (031 R4): the envelope in the pose the state needs. */
export type EnvelopePoseName = 'unsent' | 'sealed' | 'addressed' | 'archive';

/**
 * The envelope in a pose (031 board R4, agreed 2026-11-12), in place of the 132 px Lucide glyphs:
 * - `unsent`: the front with a blank stamp and an empty window - nothing sent yet;
 * - `sealed`: shut under its gold flap - nothing came out this time (the list failed to load);
 * - `addressed`: the front with an empty window - the app has not got in yet (sign in again);
 * - `archive`: a stack of envelopes - the archive search looks through.
 * One drawing at 220 x 140 (the stack 220 x 150), tilted 2 degrees as if laid down, with the open
 * envelope's shadow.
 */
export function EnvelopePose({ pose }: { readonly pose: EnvelopePoseName }) {
  const theme = useTheme();
  const g = envelopePose;
  const tilt = pose === 'sealed' ? '2deg' : pose === 'archive' ? '0deg' : '-2deg';
  // The creases run to the corners, which are round: clipped to the paper, or they poke out past it.
  const front = roundRect(0, 0, g.width, g.height, 16);
  const stackFront = roundRect(10, 36, 190, 110, 15);
  const windowLines = (
    <Path
      d={g.windowLines}
      stroke={theme.borderStrong}
      strokeWidth={2}
      strokeDasharray="1.5 3"
      strokeLinecap="round"
      fill="none"
    />
  );
  return (
    <View
      testID={`envelopePose-${pose}`}
      style={{ filter: objectFilter(theme.name, 'openEnvelope'), transform: [{ rotate: tilt }] }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {pose === 'archive' ? (
        <Svg width={g.width} height={g.stackHeight} viewBox={`0 0 ${g.width} ${g.stackHeight}`}>
          <Defs>
            <ClipPath id="poseStackFront">
              <Path d={stackFront} />
            </ClipPath>
          </Defs>
          <G transform={turned(4, 112, 56)}>
            <Path d={roundRect(22, 4, 180, 104, 14)} fill={theme.envelopeInside} />
          </G>
          <G transform={turned(-3, 108, 74)}>
            <Path d={roundRect(16, 20, 184, 108, 14)} fill={theme.envelopeBehind} />
          </G>
          <Path d={stackFront} fill={theme.envelope} />
          <G clipPath="url(#poseStackFront)">
            <Path d={g.stackCreases} stroke={theme.envelopeCrease} strokeWidth={1.5} fill="none" />
          </G>
          <Path d={roundRect(24, 100, 110, 34, 8)} fill={theme.window} />
        </Svg>
      ) : (
        <Svg width={g.width} height={g.height} viewBox={`0 0 ${g.width} ${g.height}`}>
          <Defs>
            <LinearGradient id="poseSheen" x1="0" y1="0" x2="0" y2="1">
              <Stop offset={0} stopColor={theme.onSolid} stopOpacity={envelopeShape.headerFlap.sheen} />
              <Stop offset={1} stopColor={theme.printShade} stopOpacity={envelopeShape.headerFlap.shade} />
            </LinearGradient>
            <ClipPath id="poseFront">
              <Path d={front} />
            </ClipPath>
          </Defs>
          <Path d={front} fill={theme.envelope} />
          <G clipPath="url(#poseFront)">
            <Path d={pose === 'sealed' ? g.creasesSealed : g.creases} stroke={theme.envelopeCrease} strokeWidth={1.5} fill="none" />
            {pose === 'sealed' ? (
              <>
                <Path d={g.flap} fill={theme.flap} />
                <Path d={g.flap} fill="url(#poseSheen)" />
              </>
            ) : null}
          </G>
          {pose === 'sealed' ? null : (
            <>
              {pose === 'unsent' ? (
                <Path
                  d={roundRect(168, 14, 36, 42, 2)}
                  fill="none"
                  stroke={theme.envelopeInkFaint}
                  strokeWidth={1.4}
                  strokeDasharray="2.5 2.5"
                />
              ) : null}
              <Path d={roundRect(16, 78, 132, 46, 10)} fill={theme.window} />
              {windowLines}
            </>
          )}
        </Svg>
      )}
    </View>
  );
}
