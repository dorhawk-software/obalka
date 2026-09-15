// The dotted connector between two steps of a delivery rail, drawn with SVG.
//
// WHY: `borderStyle: 'dotted'` with a ONE-SIDED border (`borderLeftWidth`) renders as a plain solid
// line on iOS. RN's iOS border layer only applies a dash pattern when the border is uniform on all
// four sides; Android's per-side implementation honours it, so the rails looked right on the emulator
// and wrong on an iPhone 15 Pro - reported 2026-08-19.
//
// This is the mirror image of `DashedOutline`, which exists because Android cannot dash a border with
// a `borderRadius` while iOS can. Two platforms, two different holes in the same CSS-ish API, and the
// same answer both times: draw it, do not describe it.
//
// The rail is inside a flex column of unknown height (a step's text decides it), so the height is
// measured rather than assumed. Before the first layout nothing is drawn - one frame of nothing beats
// a frame of the wrong thing, and the row it sits in is already holding its space.

import { useState } from 'react';
import { type LayoutChangeEvent } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { YStack } from './ui';

export function DottedRail({
  color,
  width = 2,
  /** Overrides the pattern; the default is a round dot with a dot-sized gap. */
  dash,
  marginTop = 3,
  marginBottom = 1,
  minHeight = 12,
}: {
  readonly color: string;
  readonly width?: number;
  readonly dash?: string;
  readonly marginTop?: number;
  readonly marginBottom?: number;
  readonly minHeight?: number;
}) {
  const [height, setHeight] = useState(0);
  // `strokeLinecap="round"` turns each dash into a circle, so a 0-length dash is a dot: the pattern is
  // "nothing, then a gap", which is what a CSS dotted border paints. Gap = 2× the width, which reads
  // as the same rhythm the design's borders had on Android.
  const pattern = dash ?? `0.001 ${width * 2}`;
  return (
    <YStack
      flex={1}
      width={width}
      minHeight={minHeight}
      marginTop={marginTop}
      marginBottom={marginBottom}
      onLayout={(e: LayoutChangeEvent) =>
        setHeight(e.nativeEvent.layout.height)
      }
    >
      {height > 0 ? (
        <Svg width={width} height={height}>
          <Line
            x1={width / 2}
            y1={0}
            x2={width / 2}
            y2={height}
            stroke={color}
            strokeWidth={width}
            strokeDasharray={pattern}
            strokeLinecap="round"
          />
        </Svg>
      ) : null}
    </YStack>
  );
}
