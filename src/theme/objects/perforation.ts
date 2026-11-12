// The perforations' geometry (031): where the holes of a stamp and a slip fall, as the agreed canvas
// cuts them. The canvas draws them with a CSS mask; these functions place the same circles, so the
// objects draw them as one SVG path (`paperPath`) whose holes the drop shadow can follow.

import { useCallback, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';

export type Hole = { readonly cx: number; readonly cy: number; readonly r: number };

/**
 * A stamp's holes. The canvas's mask is `radial-gradient(circle r, #0000 96%, #000) -p/2 -p/2 / p p
 * round` plus the content box: a grid of holes, stretched (`round`) so a whole number fits each side,
 * kept only in the paper outside the printed frame. Every hole that reaches into that margin is
 * returned; the frame's paper is drawn over the rest.
 */
export function stampHoles(
  width: number,
  height: number,
  { radius, pitch, inset }: { radius: number; pitch: number; inset: number },
): Hole[] {
  const along = (length: number) => {
    const step = length / Math.max(1, Math.round(length / pitch));
    const first = -pitch / 2 + step / 2;
    const out: number[] = [];
    for (let k = Math.floor((-radius - first) / step); first + k * step - radius < length; k += 1) {
      const c = first + k * step;
      if (c + radius > 0) {
        out.push(c);
      }
    }
    return out;
  };
  const holes: Hole[] = [];
  for (const cx of along(width)) {
    for (const cy of along(height)) {
      const inFrame =
        cx - radius >= inset &&
        cx + radius <= width - inset &&
        cy - radius >= inset &&
        cy + radius <= height - inset;
      if (!inFrame) {
        holes.push({ cx, cy, r: radius });
      }
    }
  }
  return holes;
}

/** A slip's holes: one row centred on its top edge, the first `pitch / 2` in (the canvas's `repeat-x`). */
export function slipHoles(width: number, { radius, pitch }: { radius: number; pitch: number }): Hole[] {
  const holes: Hole[] = [];
  for (let cx = pitch / 2; cx - radius < width; cx += pitch) {
    holes.push({ cx, cy: 0, r: radius });
  }
  return holes;
}

const n = (v: number) => String(Math.round(v * 100) / 100);

/**
 * The paper with its holes, for `fillRule="evenodd"` under a clip to the paper's own outline: a hole
 * that crosses the edge is cut where it is inside, and the clip removes what lies outside.
 * `bottomRadius` rounds the two bottom corners (a slip).
 */
export function paperPath(width: number, height: number, holes: readonly Hole[], bottomRadius = 0): string {
  const r = Math.min(bottomRadius, width / 2, height);
  const outline =
    r > 0
      ? `M0 0H${n(width)}V${n(height - r)}A${n(r)} ${n(r)} 0 0 1 ${n(width - r)} ${n(height)}` +
        `H${n(r)}A${n(r)} ${n(r)} 0 0 1 0 ${n(height - r)}Z`
      : `M0 0H${n(width)}V${n(height)}H0Z`;
  const circles = holes
    .map(
      h =>
        `M${n(h.cx - h.r)} ${n(h.cy)}a${n(h.r)} ${n(h.r)} 0 1 0 ${n(2 * h.r)} 0` +
        `a${n(h.r)} ${n(h.r)} 0 1 0 ${n(-2 * h.r)} 0Z`,
    )
    .join('');
  return outline + circles;
}

/** The size a view was laid out at, for the objects whose drawing depends on it; null until then. */
export function useLayoutSize() {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize(s => (s && s.width === width && s.height === height ? s : { width, height }));
  }, []);
  return [size, onLayout] as const;
}
