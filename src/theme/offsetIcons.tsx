// The offset glyphs (031, board "Icon set - offset print", agreed 2026-11-11): the post's own icons.
// Each is a 1.75 ink stroke on a 24 grid with one plane printed 1.3 off register beneath it, in the
// theme's plane colour. One drawing per glyph, transcribed from the board's `<symbol>` source; plain
// controls (chevrons, close, the eye) stay Lucide in `icons.tsx` (DESIGN.md › The printed objects).
//
// A glyph is decoration: the words beside it say the thing, so it is hidden from screen readers.

import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { useTheme } from './ThemeProvider';
import { offsetPrint } from './print';

type Shape =
  | {
      readonly kind: 'rect';
      readonly x: number;
      readonly y: number;
      readonly width: number;
      readonly height: number;
      readonly rx?: number;
    }
  | {
      readonly kind: 'circle';
      readonly cx: number;
      readonly cy: number;
      readonly r: number;
    }
  | { readonly kind: 'path'; readonly d: string; readonly dash?: string };

interface Glyph {
  readonly plane: readonly Shape[];
  readonly ink: readonly Shape[];
}

export const OFFSET_GLYPHS = {
  inbox: {
    plane: [{ kind: 'rect', x: 6, y: 3, width: 12, height: 8, rx: 1.5 }],
    ink: [
      { kind: 'rect', x: 6, y: 3, width: 12, height: 8, rx: 1.5 },
      { kind: 'path', d: 'M6.6 4.2 12 8l5.4-3.8' },
      {
        kind: 'path',
        d: 'M3 13h4.5l1.5 2.5h6l1.5-2.5H21v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
      },
    ],
  },
  sent: {
    plane: [{ kind: 'rect', x: 3, y: 5, width: 14, height: 10, rx: 2 }],
    ink: [
      { kind: 'rect', x: 3, y: 5, width: 14, height: 10, rx: 2 },
      { kind: 'path', d: 'M3.8 6.4 10 11l6.2-4.6' },
      { kind: 'path', d: 'M14 19h7M18.5 16.5 21 19l-2.5 2.5' },
    ],
  },
  compose: {
    plane: [{ kind: 'path', d: 'M8 3.5h8L18 10l-6 11-6-11z' }],
    ink: [
      { kind: 'path', d: 'M8 3.5h8L18 10l-6 11-6-11z' },
      { kind: 'circle', cx: 12, cy: 11.5, r: 1.3 },
      { kind: 'path', d: 'M12 13v7.5M6.8 8.5h10.4' },
    ],
  },
  search: {
    plane: [{ kind: 'circle', cx: 10.5, cy: 10.5, r: 6.5 }],
    ink: [
      { kind: 'circle', cx: 10.5, cy: 10.5, r: 6.5 },
      { kind: 'path', d: 'M15.4 15.4 20 20' },
      { kind: 'path', d: 'M7.5 9.5a3.2 3.2 0 0 1 2.5-2.4' },
    ],
  },
  attach: {
    plane: [
      { kind: 'path', d: 'M6 4h8l4 4v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1z' },
    ],
    ink: [
      {
        kind: 'path',
        d: 'M14 4H7a1 1 0 0 0-1 1v15a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V8z',
      },
      { kind: 'path', d: 'M14 4v4h4' },
      { kind: 'path', d: 'M9.5 2.5v6a1.5 1.5 0 0 0 3 0V5' },
      { kind: 'path', d: 'M9 15h6M9 18h4' },
    ],
  },
  seal: {
    plane: [{ kind: 'circle', cx: 12, cy: 10, r: 7 }],
    ink: [
      { kind: 'circle', cx: 12, cy: 10, r: 7 },
      { kind: 'path', d: 'M9.3 10.2 11 11.9l3.6-3.7' },
      {
        kind: 'path',
        d: 'M8.6 16.2 7.6 21.5l2.3-1 2.1 1.5M15.4 16.2l1 5.3-2.3-1',
      },
    ],
  },
  deadline: {
    plane: [
      {
        kind: 'path',
        d: 'M8.8 19.6c.7-2.2 3.2-3.2 3.2-4.6 0 1.4 2.5 2.4 3.2 4.6z',
      },
    ],
    ink: [
      { kind: 'path', d: 'M6.5 3h11M6.5 21h11' },
      {
        kind: 'path',
        d: 'M8 3c0 4.5 4 5.2 4 9s-4 4.5-4 9M16 3c0 4.5-4 5.2-4 9s4 4.5 4 9',
      },
    ],
  },
  fiction: {
    plane: [{ kind: 'circle', cx: 17, cy: 16, r: 4.5 }],
    ink: [
      {
        kind: 'path',
        d: 'M12 15H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3',
      },
      { kind: 'path', d: 'M3.8 6.4 10 11l6.2-4.6' },
      { kind: 'circle', cx: 17, cy: 16, r: 4.5 },
      { kind: 'path', d: 'M17 13.8V16l1.4 1.2' },
    ],
  },
  boxes: {
    plane: [{ kind: 'rect', x: 3, y: 9, width: 15, height: 11, rx: 2 }],
    ink: [
      { kind: 'path', d: 'M6.5 6H19a2 2 0 0 1 2 2v8.5' },
      { kind: 'rect', x: 3, y: 9, width: 15, height: 11, rx: 2 },
      { kind: 'path', d: 'M3.8 10.4 10.5 15.2l6.7-4.8' },
    ],
  },
  lock: {
    plane: [{ kind: 'rect', x: 4.5, y: 10, width: 15, height: 11, rx: 2.5 }],
    ink: [
      { kind: 'path', d: 'M8 10V7a4 4 0 0 1 8 0v3' },
      { kind: 'rect', x: 4.5, y: 10, width: 15, height: 11, rx: 2.5 },
      { kind: 'path', d: 'M9 14l3 2.2 3-2.2' },
    ],
  },
  archive: {
    plane: [
      { kind: 'path', d: 'M4.5 8.5h15V19a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2z' },
    ],
    ink: [
      { kind: 'rect', x: 3, y: 4, width: 18, height: 4.5, rx: 1.2 },
      { kind: 'path', d: 'M4.5 8.5V19a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V8.5' },
      { kind: 'path', d: 'M10 12.5h4' },
    ],
  },
  transfer: {
    plane: [{ kind: 'rect', x: 14, y: 3, width: 7, height: 13, rx: 1.6 }],
    ink: [
      { kind: 'rect', x: 3, y: 8, width: 7, height: 13, rx: 1.6 },
      { kind: 'rect', x: 14, y: 3, width: 7, height: 13, rx: 1.6 },
      {
        kind: 'path',
        d: 'M10.5 6.5c1.5-1.4 2.2-1.4 3.5-.6M13.5 17.5c-1.5 1.4-2.2 1.4-3.5.6',
      },
    ],
  },
  settings: {
    plane: [
      { kind: 'circle', cx: 15, cy: 7, r: 2.4 },
      { kind: 'circle', cx: 9, cy: 17, r: 2.4 },
    ],
    ink: [
      { kind: 'path', d: 'M4 7h8.6M17.4 7H20M4 17h2.6M11.4 17H20' },
      { kind: 'circle', cx: 15, cy: 7, r: 2.4 },
      { kind: 'circle', cx: 9, cy: 17, r: 2.4 },
    ],
  },
  bell: {
    plane: [{ kind: 'path', d: 'M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z' }],
    ink: [
      { kind: 'path', d: 'M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z' },
      { kind: 'path', d: 'M10 20.5a2 2 0 0 0 4 0' },
    ],
  },
  download: {
    plane: [{ kind: 'path', d: 'M4 15h16v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z' }],
    ink: [
      { kind: 'path', d: 'M12 3v11M8 10l4 4 4-4' },
      { kind: 'path', d: 'M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3' },
    ],
  },
  receipt: {
    plane: [
      {
        kind: 'path',
        d: 'M5 7h14v13l-2.3-1.4-2.4 1.4-2.3-1.4-2.3 1.4-2.4-1.4L5 20z',
      },
    ],
    ink: [
      {
        kind: 'path',
        d: 'M5 7h14v13l-2.3-1.4-2.4 1.4-2.3-1.4-2.3 1.4-2.4-1.4L5 20z',
      },
      { kind: 'path', d: 'M5 3.8h14', dash: '1.4 2.4' },
      { kind: 'path', d: 'M8.5 11h7M8.5 14.5h4' },
    ],
  },
  postmark: {
    plane: [{ kind: 'circle', cx: 10, cy: 12, r: 3.4 }],
    ink: [
      { kind: 'circle', cx: 10, cy: 12, r: 6.6 },
      { kind: 'circle', cx: 10, cy: 12, r: 3.4 },
      {
        kind: 'path',
        d: 'M17.5 9.2q1.2-1 2.4 0t2.1 0M17.5 12q1.2-1 2.4 0t2.1 0M17.5 14.8q1.2-1 2.4 0t2.1 0',
      },
    ],
  },
  opened: {
    plane: [{ kind: 'path', d: 'M6.5 13V6.5h11V13l-5.5 3.6z' }],
    ink: [
      { kind: 'path', d: 'M3 10v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-9' },
      { kind: 'path', d: 'M3 10l9-6.5 9 6.5' },
      { kind: 'path', d: 'M3.4 10.6 12 16.3l8.6-5.7' },
      { kind: 'path', d: 'M6.5 12.6V6.5h11v6.1' },
    ],
  },
  draft: {
    plane: [{ kind: 'path', d: 'M13 20.5l1-3.6 5.4-5.4 2.6 2.6-5.4 5.4z' }],
    ink: [
      { kind: 'path', d: 'M11 21H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h8l4 4v2' },
      { kind: 'path', d: 'M14 3v4h4' },
      { kind: 'path', d: 'M13 20.5l1-3.6 5.4-5.4 2.6 2.6-5.4 5.4z' },
      { kind: 'path', d: 'M8.5 11h5M8.5 14.5h3' },
    ],
  },
  remind: {
    plane: [{ kind: 'circle', cx: 12, cy: 13.5, r: 7 }],
    ink: [
      { kind: 'circle', cx: 12, cy: 13.5, r: 7 },
      { kind: 'path', d: 'M12 13.5V10M10 2.5h4M12 2.5v4M18.2 6.8l1.4-1.4' },
    ],
  },
} satisfies Record<string, Glyph>;

export type OffsetGlyphName = keyof typeof OFFSET_GLYPHS;

function shape(s: Shape, key: number) {
  if (s.kind === 'rect') {
    // Placed with a translate rather than the rect's own x/y, as in DashedOutline: RectProps.x/y
    // inherit TransformProps' @deprecated note, so the lint reports every <Rect x>. Same pixels.
    return (
      <Rect
        key={key}
        transform={[{ translateX: s.x }, { translateY: s.y }]}
        width={s.width}
        height={s.height}
        rx={s.rx}
      />
    );
  }
  if (s.kind === 'circle') {
    return <Circle key={key} cx={s.cx} cy={s.cy} r={s.r} />;
  }
  return <Path key={key} d={s.d} strokeDasharray={s.dash} />;
}

/**
 * An offset glyph. `color` is the ink (a theme token at the call site); `plane` picks the blue plane,
 * the gold one under a glyph that sits on gold, or the envelope's under one printed on the envelope.
 */
export function OffsetIcon({
  name,
  size = 24,
  color,
  plane = 'blue',
}: {
  readonly name: OffsetGlyphName;
  readonly size?: number;
  readonly color: string;
  readonly plane?: 'blue' | 'gold' | 'envelope' | 'flap';
}) {
  const theme = useTheme();
  const glyph: Glyph = OFFSET_GLYPHS[name];
  const off = offsetPrint.planeOffset;
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <G
        fill={
          plane === 'gold'
            ? theme.iconPlaneGold
            : plane === 'envelope'
              ? theme.envelopePlane
              : plane === 'flap'
                ? theme.flapPlane
                : theme.iconPlane
        }
        transform={`translate(${off} ${off})`}
      >
        {glyph.plane.map(shape)}
      </G>
      <G
        fill="none"
        stroke={color}
        strokeWidth={plane === 'flap' ? offsetPrint.strokeOnFlap : offsetPrint.stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {glyph.ink.map(shape)}
      </G>
    </Svg>
  );
}
