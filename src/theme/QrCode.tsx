// The recovery key, drawn as a scannable QR with the Obálka mark in the middle (006 T012a).
//
// Drawn as board R6 draws it (031, agreed 2026-11-12): ink modules on a `#FFFDF8` plate with the 8
// corner, and the logo in its own blue and gold over the middle, its tile filling the omitted modules.
//
// The code is NOT theme-aware, deliberately: always dark-on-light. Some scanners read inverted codes
// and some do not, and a backup key that scans on one phone and not another is worse than one that
// ignores dark mode. The mark's colour cannot hurt the scan: the modules under it are not there.
//
// One difference from the board, on purpose: the board's plate leaves 10 dp around its code, under
// two modules; this keeps the standard four-module quiet zone, because below it scanners start to
// miss the code. The plate is the board's size; the code inside it is that much smaller.
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

// The board's ink and paper, fixed in both themes (about 16:1).
const DARK = '#211B12';
const LIGHT = '#FFFDF8';

/** The logo's tile inside its 1024 viewBox (ObalkaMark): where it starts and how wide it is. */
const TILE_FROM = 142.2 / 1024;
const TILE_SPAN = (883.5 - 142.2) / 1024;

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
  const unit = size / span;
  // The mark's tile covers exactly the omitted modules, as the board's plate does.
  const hole = HOLE_MODULES * unit;
  const holeAt = (Math.floor((matrix.length - HOLE_MODULES) / 2) + QUIET) * unit;
  const mark = hole / TILE_SPAN;
  const markAt = holeAt - TILE_FROM * mark;
  return (
    <YStack
      width={size}
      height={size}
      borderRadius={8}
      overflow="hidden"
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
      <YStack position="absolute" left={markAt} top={markAt} testID={testID ? `${testID}-mark` : undefined}>
        <ObalkaMark size={mark} />
      </YStack>
    </YStack>
  );
}
