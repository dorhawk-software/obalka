// The stamp (031): what a send costs - and, in the flap's gold, the compose button. Paper with a
// printed frame, its margin perforated as the canvas cuts it (`stampHoles`). The shadow is a filter,
// so it follows the holes. The frame is printed in the same drawing as a 1-wide stroke: as a View
// border in its translucent ink, Android drew it 6 px wide on a 2.625x screen where an opaque one
// drew 3 (seen on the emulator, 2026-11-12).

import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { ClipPath, Defs, G, Path, Rect } from 'react-native-svg';
import { useTheme } from '../ThemeProvider';
import { objectFilter } from '../depth';
import { perforation } from '../print';
import { paperPath, stampHoles, useLayoutSize } from './perforation';

export type StampKind = 'stamp' | 'stampSmall' | 'fab';

/**
 * A perforated stamp around `children`, which are printed inside its frame and size it.
 *
 * - `kind`: the perforation (`print.ts` › `perforation`);
 * - `paper`: `stamp` paper (light in both themes, `stampFrame` rule) or the `flap`'s gold (`flapFrame`);
 * - `shadow`: the drop shadow of a stamp lying on its own, or the compose button's gold glow. A stamp
 *   stuck on an envelope casts none of its own.
 */
export function Stamp({
  kind,
  paper = 'stamp',
  shadow,
  children,
  style,
}: {
  readonly kind: StampKind;
  readonly paper?: 'stamp' | 'flap';
  readonly shadow?: 'stamp' | 'stampFab';
  readonly children: ReactNode;
  readonly style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const geometry = perforation[kind];
  const [size, onLayout] = useLayoutSize();
  const fill = paper === 'flap' ? theme.flap : theme.stampPaper;
  return (
    <View
      onLayout={onLayout}
      style={[
        { padding: geometry.inset },
        shadow ? { filter: objectFilter(theme.name, shadow) } : null,
        style,
      ]}
    >
      {size ? (
        <Svg
          width={size.width}
          height={size.height}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Defs>
            <ClipPath id="paper">
              <Rect width={size.width} height={size.height} />
            </ClipPath>
          </Defs>
          <G clipPath="url(#paper)">
            <Path
              d={paperPath(size.width, size.height, stampHoles(size.width, size.height, geometry))}
              fill={fill}
              fillRule="evenodd"
            />
            {/* The frame's own paper: the canvas's mask keeps the content box whole. */}
            <Rect
              transform={[{ translateX: geometry.inset }, { translateY: geometry.inset }]}
              width={size.width - 2 * geometry.inset}
              height={size.height - 2 * geometry.inset}
              fill={fill}
            />
            {/* The printed frame: the canvas's 1px border just inside the content box. */}
            <Rect
              transform={[{ translateX: geometry.inset + 0.5 }, { translateY: geometry.inset + 0.5 }]}
              width={size.width - 2 * geometry.inset - 1}
              height={size.height - 2 * geometry.inset - 1}
              fill="none"
              stroke={paper === 'flap' ? theme.flapFrame : theme.stampFrame}
              strokeWidth={1}
            />
          </G>
        </Svg>
      ) : null}
      {/* The frame's width, kept so the children sit inside it as they did inside the border. */}
      <View style={{ padding: 1 }}>{children}</View>
    </View>
  );
}
