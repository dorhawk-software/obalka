// Which box a message belongs to, as a chip.
//
// In a merged list this is not decoration. The boxes on one phone are frequently different LEGAL
// ENTITIES of the same person - an individual, their own trading name, their company - so a row
// whose box is not visible is a message whose recipient is ambiguous. The pill is never optional.
//
// FILLED IN THE BOX'S OWN COLOUR since 027 (decision 3C, 2026-10-03). The pill used to be a sand
// outline with a 7 dp dot, the legal-form code and the name; for three boxes of one owner - "Ondřej
// Dvořák" as FO, PFO and the company - that left two letters between them, reported as not enough to
// see the receiving box. A solid fill in a colour no other box has (`boxColor`, assigned distinct)
// reads without reading, the box's monogram backs it up for anyone who cannot rely on hue, and the
// name is the user's own name for the box when they gave it one. White on every box colour is at least
// 5.9:1, and on the monogram's darker step more (`__tests__/theme/contrast.test.ts` measures both).

import { XStack, YStack } from '../../../theme/ui';
import { Tag } from '../../../theme/Typography';
import { useTheme } from '../../../theme/ThemeProvider';
import { avatarColor, monogram } from '../../../theme/avatar';
import { boxColor } from '../../../theme/boxColor';
import { concentric } from '../../../theme/radius';
import type { DataBoxAccount } from '../../../services/isds/types';
import { shade } from '../../../theme/color';

/**
 * How much darker the monogram's chip is than the pill. Darker, not lighter: the design's lighter step
 * (white at 22 %) took the 10 px monogram below AA on every box colour, to 3.7:1 on the lightest.
 */
export const MONOGRAM_SHADE = 0.2;

/** The pill's corner, and how far in the monogram chip sits - the same on its top, bottom and left. */
const PILL_RADIUS = 7;
const CHIP_GAP = 2;

export function BoxPill({
  account,
  fallbackBoxId,
}: {
  readonly account?: DataBoxAccount;
  /** Shown when the account is gone - a removed box whose archive survives (Principle IV). */
  readonly fallbackBoxId?: string;
}) {
  const theme = useTheme();
  const boxId = account?.boxId ?? fallbackBoxId ?? '';
  const name = account?.alias ?? account?.label ?? fallbackBoxId ?? '';
  const fill = account ? boxColor(account) : avatarColor(boxId);
  return (
    <XStack
      alignItems="center"
      gap={6}
      minWidth={0}
      flexShrink={1}
      paddingLeft={CHIP_GAP}
      paddingRight={8}
      paddingVertical={CHIP_GAP}
      borderRadius={PILL_RADIUS}
      backgroundColor={fill}
      testID={`boxPill-${boxId}`}
    >
      {/* The monogram, on a darker step of the same fill. Decorative to a screen reader: the name
          beside it says the same thing, and the row's own label repeats it. */}
      <YStack
        paddingHorizontal={4}
        borderRadius={concentric(PILL_RADIUS, CHIP_GAP)}
        testID={`boxPill-${boxId}-monogram`}
        backgroundColor={shade(MONOGRAM_SHADE)}
        flexShrink={0}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Tag
          color={theme.onSolid}
        >
          {monogram(name)}
        </Tag>
      </YStack>
      <Tag fontWeight="600"
        color={theme.onSolid}
        numberOfLines={1}
        flexShrink={1}
        minWidth={0}
      >
        {name}
      </Tag>
    </XStack>
  );
}
