import { metricLeading, type, type TextRole } from './typography';

// The smallest thing a finger can be asked to hit.
//
// iOS asks for 44×44 pt, Android for 48×48 dp; the larger of the two satisfies both, so this app has
// one number rather than a platform branch. Several controls are deliberately SMALLER than that on
// screen - the design draws a 48×28 switch, a 34pt segment, a 36pt stepper - and that is fine: a
// control's touch area is not its paint. `hitSlop` is how the two come apart.
//
// The point of computing the slop instead of typing it is that the two numbers stay tied. Resize the
// switch and its touch area follows; type `hitSlop={10}` beside it and it does not. Saying so here did
// not stop it - five typed slops outlived the sweep that was meant to remove them - so
// `__tests__/theme/noTypedHitSlop.test.ts` now fails on any `hitSlop` under `src/` that does not come
// from `touchSlop()` or `textSlop()`.

/** iOS 44 pt, Android 48 dp - the larger clears both. */
export const MIN_TARGET = 48;

function slop(size: number | undefined): number {
  if (size == null || size >= MIN_TARGET) {
    return 0;
  }
  return Math.ceil((MIN_TARGET - size) / 2);
}

/**
 * The `hitSlop` that grows a control of this drawn size to the minimum target.
 *
 * Pass only the dimension that is short: an omitted one is left alone, which is what a segment that
 * stretches to fill its track wants. Adjacent controls must still be far enough apart that their slop
 * does not overlap - the gap between them has to be at least the sum of the two facing values.
 */
export function touchSlop(size: { width?: number; height?: number }): {
  top: number;
  bottom: number;
  left: number;
  right: number;
} {
  return {
    top: slop(size.height),
    bottom: slop(size.height),
    left: slop(size.width),
    right: slop(size.width),
  };
}

/**
 * The slop a control needs when its drawn size is a LINE OF TEXT rather than a box.
 *
 * `touchSlop` above wants a number, and a text button has none - it is as tall as whatever it says.
 * So every text button in the app typed its slop by hand instead, and six of them ended up under the
 * floor: the snackbar's Undo at 41dp, "Použít SMS" at 33, "Pokročilé" at 36. The helper written to
 * stop exactly this drift could not be applied to the controls that needed it most, which is why
 * they drifted (found sweeping after the 2026-09-09 critique).
 *
 * A first sweep called it eleven. Five of those were not real: the two password eye-toggles inherit
 * their input's 50dp box through `top={0} bottom={0}`, the overflow button sizes itself inside a
 * `style` callback, and two more are saved by padding a regex could not see. Counting by hand is
 * exactly the thing this module exists to stop.
 *
 * The line box comes from the type scale, the same way `Typography.tsx` derives it: a role's own
 * ratio, or the family's tight metric leading when the text is `dense`. So resizing the label moves
 * the target with it, which is the entire point of the module.
 *
 * @param role   the `TextRole` the control's label uses
 * @param opts   `fontSize` if the call site overrides the role's; `dense` if it passes that prop;
 *               `paddingVertical` the control already has, which counts toward the target;
 *               `paddingTop` / `paddingBottom` where the two differ - each wins over
 *               `paddingVertical`, the same precedence RN's own style resolution gives them
 */
export function textSlop(
  role: TextRole,
  opts: {
    fontSize?: number;
    dense?: boolean;
    paddingVertical?: number;
    paddingTop?: number;
    paddingBottom?: number;
  } = {},
): { top: number; bottom: number; left: number; right: number } {
  const spec = type[role];
  const fontSize = opts.fontSize ?? spec.fontSize;
  const leading = opts.dense
    ? metricLeading[spec.fontFamily.startsWith('Bricolage') ? 'display' : 'body']
    : spec.lineHeight / spec.fontSize;
  const lineBox = Math.round(fontSize * leading);
  // Asymmetric padding is taken as the sum rather than forced into a `paddingVertical` average: the
  // slop itself is symmetric either way, and a call site should state the padding it actually draws.
  const padTop = opts.paddingTop ?? opts.paddingVertical ?? 0;
  const padBottom = opts.paddingBottom ?? opts.paddingVertical ?? 0;
  return touchSlop({ height: lineBox + padTop + padBottom });
}
