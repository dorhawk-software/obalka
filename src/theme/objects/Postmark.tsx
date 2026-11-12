// The postmark (031): a date ISDS certifies. Two rings, the words round them, the date and time in the
// middle and three waves - one drawing (board Detail), scaled and turned where it lands. Struck on a
// stamp (board Sent), its waves are the stamp's cancellation instead (`Stamp cancelled`): drawn in the
// postmark's ink they would not show on the stamp's paper. It lands when
// ISDS accepts a send (board Motion); it is never decoration on something ISDS did not stamp.
//
// Hidden from assistive technology: the screen states the same date in words.

import Svg, { Circle, Defs, G, Path, Text, TextPath } from 'react-native-svg';
import { useTheme } from '../ThemeProvider';
import { postmarkPrint } from '../print';
import { fonts } from '../typeScale';

export function Postmark({
  ring,
  line1,
  line2,
  size = 104,
  rotate = -5,
  color,
  waves = true,
}: {
  /** The words round the ring, e.g. "DODÁNO · DATOVÁ SCHRÁNKA ·" (translated by the caller). */
  readonly ring: string;
  /** The date, then the time, in the middle. */
  readonly line1: string;
  readonly line2: string;
  /** The width it is drawn at; the height follows the drawing. */
  readonly size?: number;
  /** Degrees; a postmark is never struck quite straight. */
  readonly rotate?: number;
  /** The ink; `envelopeInkSoft` on the envelope. */
  readonly color?: string;
  /** False where the waves cross a stamp, which draws them as its cancellation. */
  readonly waves?: boolean;
}) {
  const theme = useTheme();
  const p = postmarkPrint;
  const ink = color ?? theme.envelopeInkSoft;
  const r = p.textRadius;
  return (
    <Svg
      width={size}
      height={Math.round((size * p.height) / p.width)}
      viewBox={`0 0 ${p.width} ${p.height}`}
      style={{ transform: [{ rotate: `${rotate}deg` }] }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Defs>
        <Path id="ring" d={`M${p.cx} ${p.cy}m-${r} 0a${r} ${r} 0 1 1 ${2 * r} 0a${r} ${r} 0 1 1 -${2 * r} 0`} />
      </Defs>
      <G fill="none" stroke={ink} strokeWidth={p.stroke}>
        {p.rings.map(radius => (
          <Circle key={radius} cx={p.cx} cy={p.cy} r={radius} />
        ))}
        {waves ? <Path d={p.waves} /> : null}
      </G>
      <Text fill={ink} fontFamily={fonts.bodyBold} fontSize={p.ringText.size} letterSpacing={p.ringText.spacing}>
        <TextPath href="#ring">{ring}</TextPath>
      </Text>
      {/* Each line's anchor is placed with a translate, as in DashedOutline: TextProps.x/y inherit the
          @deprecated note of TransformProps.x/y, so the lint reports every <Text x>. Same point. */}
      <Text
        transform={[{ translateX: p.cx }, { translateY: p.line1.y }]}
        textAnchor="middle"
        fill={ink}
        fontFamily={fonts.bodyBold}
        fontSize={p.line1.size}
      >
        {line1}
      </Text>
      <Text
        transform={[{ translateX: p.cx }, { translateY: p.line2.y }]}
        textAnchor="middle"
        fill={ink}
        fontFamily={fonts.bodySemiBold}
        fontSize={p.line2.size}
      >
        {line2}
      </Text>
    </Svg>
  );
}
