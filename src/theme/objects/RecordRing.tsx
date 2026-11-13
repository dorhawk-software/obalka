// A step's mark on a delivery record (031, board Message): two rings struck like a postmark, with
// what happened in the middle. Geometry in `print.ts` › `recordRing`.

import Svg, { Circle, Path } from 'react-native-svg';
import { recordRing } from '../print';

export type RecordRingKind = 'arrived' | 'fiction' | 'signed' | 'pending' | 'stopped';

export function RecordRing({
  kind,
  color,
  knockout,
  size = recordRing.grid,
}: {
  readonly kind: RecordRingKind;
  /** The ink, a theme token at the call site. */
  readonly color: string;
  /** The paper under it: the check is cut out of the filled ring in this (`signed`). */
  readonly knockout: string;
  readonly size?: number;
}) {
  const r = recordRing;
  const c = r.grid / 2;
  const ring = kind === 'fiction' ? r.strokeGold : r.stroke;
  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${r.grid} ${r.grid}`}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Circle
        cx={c}
        cy={c}
        r={r.outer}
        fill="none"
        stroke={color}
        strokeWidth={ring}
        strokeDasharray={kind === 'pending' ? r.pendingDash : undefined}
      />
      {kind === 'pending' ? null : (
        <Circle
          cx={c}
          cy={c}
          r={r.inner}
          fill={kind === 'signed' ? color : 'none'}
          stroke={color}
          strokeWidth={ring}
        />
      )}
      {kind === 'pending' ? null : (
        <Path
          d={kind === 'fiction' ? r.clock : kind === 'stopped' ? r.cross : r.check}
          fill="none"
          stroke={kind === 'signed' ? knockout : color}
          strokeWidth={r.markStroke}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </Svg>
  );
}
