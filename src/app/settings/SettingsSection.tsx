// The grouped-settings furniture: an uppercase section label above cards, the rows inside them and
// their parts. Extracted when the backup screen appeared - two screens drawing the same pattern from
// two copies is exactly how the numbers drift (constitution V).
//
// Drawn as boards R3 and R13 draw it (031, Cards B, agreed 2026-11-12): a card is a sheet with weight
// and no line around it; a row is at least 52 tall, 10 above and below and 14 at the sides; rows of one
// card are parted by a hairline inset 14 (66 above a row whose words start past a well, so the line
// starts where they do); a row may lead with its glyph in a 40 sunken well.
//
// Every spacing here is a DESIGN.md step. `__tests__/app/settingsFurniture.test.tsx` reads the values
// DESIGN.md records back from it.

import type { ReactNode } from 'react';
import { XStack, YStack } from '../../theme/ui';
import { Caption, Meta, Overline, Small } from '../../theme/Typography';
import { useTheme } from '../../theme/ThemeProvider';
import { space } from '../../theme/spacing';

/** A card row: DESIGN.md › Cards, "at least 52dp tall, 10dp above and below". */
export const CARD_ROW = { minHeight: 52, paddingVertical: space.md, paddingHorizontal: space.xl } as const;

/** Where a row's words start when it leads with a well: 14 + the 40 well + the 12 gap. */
export const WELL_INSET = space.xl + 40 + space.lg;

/**
 * A grouped-settings section: an uppercase faint label, its card(s) 8 under it, and the next section
 * 18 under the last card (boards R3, R13).
 *
 * The label carries no glyph (R10, R13). Until 2026-11-15 it took an optional decorative `icon`, which
 * only the backup screen still passed.
 */
export function Section({
  label,
  note,
  children,
  testID,
}: {
  readonly label: string;
  /** The group's quiet line under its label, 4 under it, in muted meta (R13's `GroupHead`). */
  readonly note?: ReactNode;
  readonly children: ReactNode;
  readonly testID?: string;
}) {
  const theme = useTheme();
  return (
    <YStack marginBottom={space.gutter} gap={space.base} testID={testID}>
      <YStack gap={space.xs} marginHorizontal={space.xs}>
        <XStack alignItems="center" gap={space.sm}>
          {/* The row's width, not its own measure: Android measured "ZABEZPEČENÍ" a letter short and cut
              the Í (practices, "Text takes its container's width"). */}
          <Overline accessibilityRole="header" flex={1}>
            {label}
          </Overline>
        </XStack>
        {typeof note === 'string' ? <Meta color={theme.textMuted}>{note}</Meta> : note ?? null}
      </YStack>
      {children}
    </YStack>
  );
}

/**
 * A list's group head (R13): the overline and, if the group has one, the quiet line under it - 18 above,
 * 4 between, 8 to the card. Licences and the FAQ head their groups with it; the first group of a screen
 * takes no top, the screen's own 18 standing in for it.
 */
export function GroupHead({
  label,
  note,
  first = false,
  testID,
}: {
  readonly label: string;
  readonly note?: ReactNode;
  readonly first?: boolean;
  readonly testID?: string;
}) {
  const theme = useTheme();
  return (
    <YStack
      paddingTop={first ? 0 : space.gutter}
      paddingBottom={space.base}
      paddingHorizontal={space.xs}
      gap={space.xs}
      testID={testID}
    >
      <Overline accessibilityRole="header">{label}</Overline>
      {note == null ? null : <Meta color={theme.textMuted}>{note}</Meta>}
    </YStack>
  );
}

/**
 * A card row's title - 14/600 in ink (the boards' `sm`). The SemiBold face is picked from the weight
 * by the role (Typography.tsx). Same metrics on every card row (constitution V).
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
    <Small fontWeight="600" flex={flex} color={theme.text}>
      {children}
    </Small>
  );
}

/** A row's words: its title, and under it what it does in muted 13/17 (the boards' `lbl`). */
export function RowText({ title, subtitle }: { readonly title: string; readonly subtitle?: string | null }) {
  const theme = useTheme();
  return (
    <YStack flex={1} minWidth={0} gap={space.hair}>
      <RowTitle>{title}</RowTitle>
      {subtitle ? <Caption color={theme.textMuted}>{subtitle}</Caption> : null}
    </YStack>
  );
}

/** A row's glyph in its well: one drawing, shared with the message's rows (031 R7). */
export { Well } from '../../theme/Well';

/** The cards every settings row sits in - the app's one card, in the theme (spec 028). */
export { Card } from '../../theme/Card';

/**
 * A row inside a card, with the hairline under it unless it is the `last`. The line starts at 14, or
 * at 66 when the row under it starts its words past a well (`dividerInset={WELL_INSET}`). A row that
 * belongs to the well-led row above it (`indent`) starts its words there too; `dimmed` greys the
 * whole row while it cannot be used. Rows without `onPress` are plain and take no press treatment.
 */
export function CardRow({
  children,
  last,
  onPress,
  accessibilityLabel,
  dividerInset = space.xl,
  indent = false,
  dimmed = false,
  testID,
}: {
  readonly children: ReactNode;
  readonly last: boolean;
  readonly onPress?: () => void;
  readonly accessibilityLabel?: string;
  readonly dividerInset?: number;
  readonly indent?: boolean;
  readonly dimmed?: boolean;
  readonly testID?: string;
}) {
  const theme = useTheme();
  return (
    <>
      <XStack
        alignItems="center"
        justifyContent="space-between"
        gap={space.lg}
        minHeight={CARD_ROW.minHeight}
        paddingVertical={CARD_ROW.paddingVertical}
        paddingHorizontal={CARD_ROW.paddingHorizontal}
        paddingLeft={indent ? WELL_INSET : CARD_ROW.paddingHorizontal}
        opacity={dimmed ? 0.55 : 1}
        // Faded as one picture, as the board's CSS opacity fades it: Android otherwise fades each child
        // on its own, and the switch's blue track showed through its white knob (031 R13, dark walk).
        needsOffscreenAlphaCompositing={dimmed}
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
      {last ? null : <RowDivider inset={dividerInset} />}
    </>
  );
}

/** The hairline between two rows of one card, inset from the left (boards R3, R13). */
export function RowDivider({ inset = space.xl }: { readonly inset?: number }) {
  const theme = useTheme();
  return <YStack height={1} marginLeft={inset} backgroundColor={theme.border} />;
}
