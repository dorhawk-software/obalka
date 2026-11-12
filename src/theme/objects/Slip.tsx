// The slip (031): a record you keep - the delivery record, the recovery key, the transfer code. A
// sheet torn off along its perforated top. Its edge is the 1 px `border` the canvas draws as a first
// drop shadow, drawn here as the same shape one point lower: iOS keeps only one `drop-shadow`.

import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { ClipPath, Defs, G, Path, Rect } from 'react-native-svg';
import { useTheme } from '../ThemeProvider';
import { objectFilter } from '../depth';
import { perforation } from '../print';
import { paperPath, slipHoles, useLayoutSize } from './perforation';

/** A slip around `children`, which set its padding and size it. */
export function Slip({
  children,
  style,
}: {
  readonly children: ReactNode;
  readonly style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const [size, onLayout] = useLayoutSize();
  const filter = objectFilter(theme.name, 'slip');
  const geometry = perforation.slip;
  const d = size ? paperPath(size.width, size.height, slipHoles(size.width, geometry), geometry.corner) : '';
  return (
    <View onLayout={onLayout} style={[filter ? { filter } : null, style]}>
      {size ? (
        <Svg
          width={size.width}
          height={size.height + 1}
          style={[StyleSheet.absoluteFill, { height: size.height + 1 }]}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Defs>
            <ClipPath id="paper">
              <Rect width={size.width} height={size.height} />
            </ClipPath>
          </Defs>
          <G transform={[{ translateY: 1 }]}>
            <G clipPath="url(#paper)">
              <Path d={d} fill={theme.border} fillRule="evenodd" />
            </G>
          </G>
          <G clipPath="url(#paper)">
            <Path d={d} fill={theme.surface} fillRule="evenodd" />
          </G>
        </Svg>
      ) : null}
      {children}
    </View>
  );
}
