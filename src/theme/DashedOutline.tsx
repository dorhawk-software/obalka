// A dashed rounded-rect outline, drawn with SVG.
//
// WHY: React Native cannot render `borderStyle: 'dashed'` together with a `borderRadius` on Android -
// the border silently falls back to SOLID. The design uses dashed affordances (the switcher's "Přidat
// datovou schránku", compose's "add attachment"), so we draw the outline ourselves instead. Drop this
// inside a relatively-positioned container; it fills the parent and never intercepts touches.

import { useState } from 'react';
import { type LayoutChangeEvent } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { YStack } from './ui';

export function DashedOutline({
  radius = 14,
  strokeWidth = 1.5,
  color,
  dash,
}: {
  readonly radius?: number;
  readonly strokeWidth?: number;
  readonly color: string;
  /** Override the pattern. Defaults to the browser's, which is what the design is drawn with. */
  readonly dash?: string;
}) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  // The design writes these outlines as CSS `border: 1.5px dashed`, so copy what a browser actually
  // paints for that: dashes AND gaps of 3× the border thickness (≈4.5/4.5 here). Hand-picking a
  // pattern instead (an earlier 6/4) makes the outline read heavier and more solid than the design.
  const pattern = dash ?? `${strokeWidth * 3} ${strokeWidth * 3}`;
  return (
    <YStack
      position="absolute"
      top={0}
      left={0}
      right={0}
      bottom={0}
      pointerEvents="none"
      onLayout={(e: LayoutChangeEvent) =>
        setSize({
          w: e.nativeEvent.layout.width,
          h: e.nativeEvent.layout.height,
        })
      }
    >
      {size.w > 0 && size.h > 0 ? (
        <Svg width={size.w} height={size.h}>
          {/* Inset by half the stroke so the whole line lands inside the box. As a translate rather
              than the rect's own x/y: react-native-svg's RectProps.x/y carry no JSDoc of their own,
              so TypeScript hands them the @deprecated one of the TransformProps.x/y they override,
              and the lint reports every <Rect x>. Same matrix, same pixels. */}
          <Rect
            transform={[{ translateX: strokeWidth / 2 }, { translateY: strokeWidth / 2 }]}
            width={size.w - strokeWidth}
            height={size.h - strokeWidth}
            rx={radius}
            ry={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={pattern}
          />
        </Svg>
      ) : null}
    </YStack>
  );
}
