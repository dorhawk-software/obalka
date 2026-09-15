// The grouped-settings furniture: an uppercase section label above bordered cards, and the row title
// used inside them (009 §06). Extracted when the backup screen appeared - two screens drawing the
// same pattern from two copies is exactly how the numbers drift (constitution V).
//
// Every spacing here is a DESIGN.md step or a value the design gives this pattern, named below.
// `__tests__/app/settingsFurniture.test.tsx` reads the values DESIGN.md records back from it.

import type { ReactNode } from 'react';
import { XStack, YStack } from '../../theme/ui';
import { Badge, Body } from '../../theme/Typography';
import { fonts } from '../../theme/typography';
import { useTheme } from '../../theme/ThemeProvider';
import { space } from '../../theme/spacing';

/**
 * The section label: Public Sans Bold 12, uppercase, 0.4 letter-spacing, faint ink - the design's own
 * label (009 `design-system.md` §2, DESIGN.md › Components › Settings sections). 12 is under the type
 * scale's 13 step, and stays: it is what the design draws, one of the 12-tier overrides DESIGN.md counts
 * under Typography, not a number picked to fit.
 */
const LABEL_SIZE = 12;
const LABEL_TRACKING = 0.4;

/** A row's vertical padding: DESIGN.md › Layout, "Row padding is 13 vertical" - the design's, off the scale. */
const ROW_PADDING_VERTICAL = 13;

/**
 * A section's card sits 9 under its label, and the next section 22 under its last card: the design's
 * values, as the 009 port of the design drew them. Neither is a spacing step, and neither is a near miss
 * of one to round: DESIGN.md and `specs/009-visual-redesign/design-system.md` record no other number for
 * this pattern, and a value the design draws is not changed to fit a scale. A pass on 2026-09-15 moved
 * them to the `base` and `gutter` steps for being off the scale, which moved every section on the
 * Settings, Backup, Transfer and Debug screens; they were put back the same day.
 */
const SECTION_GAP = 9;
const SECTION_MARGIN_BOTTOM = 22;

/**
 * A grouped-settings section: an uppercase faint label above its card(s).
 *
 * `icon` is optional and decorative - it sits beside the label to make a long screen scannable, and
 * carries no meaning the label does not already carry (a screen reader hears the label alone).
 */
export function Section({
  label,
  icon,
  children,
}: {
  readonly label: string;
  readonly icon?: ReactNode;
  readonly children: ReactNode;
}) {
  const theme = useTheme();
  return (
    <YStack marginBottom={SECTION_MARGIN_BOTTOM} gap={SECTION_GAP}>
      <XStack alignItems="center" gap={space.sm} marginLeft={space.xs}>
        {icon ? (
          <YStack accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {icon}
          </YStack>
        ) : null}
        <Badge
          accessibilityRole="header"
          fontSize={LABEL_SIZE}
          textTransform="uppercase"
          letterSpacing={LABEL_TRACKING}
          color={theme.textFaint}
        >
          {label}
        </Badge>
      </XStack>
      {children}
    </YStack>
  );
}

/**
 * A settings-card row title - 15/600 (design). The SemiBold FACE has to be named: Public Sans is
 * 4-style grouped, so `fontWeight="600"` alone can't reach it from the Regular family (RN would render
 * 400). Same metrics on every card row (constitution V).
 */
export function RowTitle({
  children,
  flex,
}: {
  readonly children: ReactNode;
  readonly flex?: number;
}) {
  const theme = useTheme();
  return (
    <Body
      flex={flex}
      fontFamily={fonts.bodySemiBold}
      fontWeight="600"
      color={theme.text}
    >
      {children}
    </Body>
  );
}

/** The bordered card every settings row sits in. */
export function Card({ children }: { readonly children: ReactNode }) {
  const theme = useTheme();
  return (
    <YStack
      borderWidth={1}
      borderRadius={14}
      borderColor={theme.border}
      backgroundColor={theme.surface}
      overflow="hidden"
    >
      {children}
    </YStack>
  );
}

/**
 * A row inside a card: hairline-separated from the next one (design). Padded 13 above and below, as
 * DESIGN.md pads a row, and 14 at the sides, which is DESIGN.md's card padding and the `xl` step.
 */
export function CardRow({
  children,
  last,
  onPress,
  accessibilityLabel,
  testID,
}: {
  readonly children: ReactNode;
  readonly last: boolean;
  readonly onPress?: () => void;
  readonly accessibilityLabel?: string;
  readonly testID?: string;
}) {
  const theme = useTheme();
  return (
    <XStack
      alignItems="center"
      justifyContent="space-between"
      gap={space.md}
      paddingVertical={ROW_PADDING_VERTICAL}
      paddingHorizontal={space.xl}
      borderBottomWidth={last ? 0 : 1}
      borderBottomColor={theme.border}
      testID={testID}
      {...(onPress
        ? {
            onPress,
            accessibilityRole: 'button' as const,
            accessibilityLabel,
            pressStyle: { backgroundColor: theme.surfaceAlt },
          }
        : null)}
    >
      {children}
    </XStack>
  );
}
