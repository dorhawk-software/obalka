// Reduce Transparency support (a hard constraint from the design spec).
//
// The reference draws every modal/sheet backdrop as a translucent warm ink, `rgba(33,27,18,α)`. When the
// OS "Reduce Transparency" accessibility setting is on, a see-through backdrop is exactly what the user
// asked NOT to have - so we swap it for that same ink at FULL alpha (theme.scrimOpaque). The colour is
// the design's own; only the alpha changes.

import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useTheme } from './ThemeProvider';
import type { Theme } from './theme';

/** True when the OS "Reduce Transparency" setting is on. Never throws; defaults to false. */
export function useReduceTransparency(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceTransparencyEnabled?.()
      .then(on => {
        if (alive) {
          setReduce(!!on);
        }
      })
      .catch(() => {
        // best-effort - an unsupported platform must not break the screen
      });
    const sub = AccessibilityInfo.addEventListener(
      'reduceTransparencyChanged',
      on => setReduce(!!on),
    );
    return () => {
      alive = false;
      sub?.remove();
    };
  }, []);
  return reduce;
}

/**
 * Extra alpha the dark appearance needs.
 *
 * A scrim earns its keep by taking luminance OUT of what is behind it, and a dark ground has very
 * little to take. The design's alphas are measured against the light paper, where 0.4 removes about
 * 60% of it; the same 0.4 of black over `bg` in dark removes half that. The boost brings the dark
 * scrim to the same order of separation, so a sheet reads as floating in both appearances rather than
 * merely in one.
 */
const DARK_EXTRA_ALPHA = 0.2;

/**
 * The scrim colour itself - pure, so what it does to a backdrop can be measured rather than eyeballed
 * (see `__tests__/theme/contrast.test.ts`, which composites it over each theme's `bg`).
 *
 * `alpha` is the DESIGN's value, i.e. the light-mode one. What dark needs to reach the same effect is
 * this function's business, not the caller's - every call site would otherwise have to carry a theme
 * check to get an even backdrop.
 */
export function scrimColor(theme: Theme, alpha: number, reduce: boolean): string {
  if (reduce) {
    return theme.scrimOpaque;
  }
  const effective =
    theme.name === 'dark' ? Math.min(1, alpha + DARK_EXTRA_ALPHA) : alpha;
  return `rgba(${theme.scrimRgb},${effective})`;
}

/**
 * The scrim colour for a modal/sheet backdrop at the design's `alpha`, or an OPAQUE backdrop when
 * Reduce Transparency is on.
 */
export function useScrim(alpha = 0.4): string {
  return scrimColor(useTheme(), alpha, useReduceTransparency());
}
