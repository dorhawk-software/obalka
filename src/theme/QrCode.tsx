// The recovery key, drawn as a scannable QR with the Obálka mark in the middle (006 T012a).
//
// Two things here are NOT theme-aware, deliberately:
//
//   * The code is always dark-on-light. Some scanners read inverted codes and some do not, and a
//     backup key that scans on one phone and not another is worse than one that ignores dark mode.
//   * The mark is black and white. A colour logo in the middle of a QR is a scanning risk for no
//     gain - the mark is recognisable by shape.
//
// The middle modules are OMITTED rather than covered, so nothing shows through at the plate's edge.
// Level H reconstructs them; `__tests__/backup/keyQr.test.ts` decodes a code with a LARGER hole than
// this one punched in it, so the margin is measured rather than assumed.

import Svg, { Path, Rect } from 'react-native-svg';
import { YStack } from './ui';
import { ObalkaMark } from './ObalkaMark';
import { qrMatrix } from '../services/backup/keyQr';

/** Modules across the centre that the logo plate replaces. 7 of 29 ≈ 24% of the width. */
const HOLE_MODULES = 7;
/** Quiet zone, in modules. Four is the standard minimum; below it, scanners start to miss the code. */
const QUIET = 4;

const DARK = '#111111';
const LIGHT = '#FFFFFF';

/**
 * One `Path` for every dark module, as rectangle subpaths.
 *
 * Exported for the test. Hundreds of `<Rect>` elements would cross the bridge as hundreds of shadow
 * nodes; this is one.
 */
export function qrPathData(matrix: boolean[][], hole: number): string {
  const count = matrix.length;
  const from = Math.floor((count - hole) / 2);
  const to = from + hole;
  let d = '';
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      const covered = hole > 0 && row >= from && row < to && col >= from && col < to;
      if (matrix[row][col] && !covered) {
        d += `M${col + QUIET} ${row + QUIET}h1v1h-1z`;
      }
    }
  }
  return d;
}

/**
 * A QR code with the brand mark inlaid.
 *
 * `size` is the full outside edge including the quiet zone, so the caller can lay it out without
 * knowing how many modules the payload happened to need.
 */
export function QrCode({
  value,
  size = 240,
  testID,
  accessibilityLabel,
}: {
  readonly value: string;
  readonly size?: number;
  readonly testID?: string;
  readonly accessibilityLabel?: string;
}) {
  const matrix = qrMatrix(value);
  const span = matrix.length + QUIET * 2;
  // The plate is a shade larger than the hole so no module touches the mark.
  const plate = (HOLE_MODULES + 0.6) * (size / span);
  return (
    <YStack
      width={size}
      height={size}
      borderRadius={12}
      backgroundColor={LIGHT}
      alignItems="center"
      justifyContent="center"
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${span} ${span}`}>
        <Rect width={span} height={span} fill={LIGHT} />
        <Path d={qrPathData(matrix, HOLE_MODULES)} fill={DARK} />
      </Svg>
      <YStack
        position="absolute"
        width={plate}
        height={plate}
        alignItems="center"
        justifyContent="center"
        backgroundColor={LIGHT}
      >
        <ObalkaMark size={plate} body={DARK} flap={LIGHT} />
      </YStack>
    </YStack>
  );
}
