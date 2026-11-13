// The "Vše" entry in the box switcher (024 cycle 2).
//
// IT MUST NOT BE MISTAKABLE FOR A BOX, and a label cannot carry that on its own: nothing stops a
// user naming a box "Vše". So the difference is structural, and it is four independent signals, any
// one of which still separates the two if the names collide exactly:
//
//   1. THE MARK. A box gets its envelope with its initials - the app's avatar, which everywhere else
//      in this product means "an identity". This gets the boxes' envelopes fanned, the count on the
//      front one (031 board R5, agreed 2026-11-12): several identities, never one. The board shows no
//      unread count on it; each box row carries its own.
//   2. PLACEMENT. It sits above the boxes with a separator under it, in its own group, rather than
//      as the first item of the list.
//   3. SUBTITLE GRAMMAR. A box says "{legal form} · ID {boxId}". This says how many boxes it merges,
//      which is a sentence no box can produce about itself.
//   4. NO OVERFLOW MENU. Every box row carries a per-box ⋯ (rename / remove). This has nothing to
//      rename and nothing to remove, so the affordance is absent rather than disabled.
//
// It renders only when at least two boxes exist - see `resolveUnified`. With one box it and that box
// would be the same list, and offering a choice whose branches are identical is worse than offering
// none: the user has to work out that it does not matter.

import { XStack, YStack } from '../../../theme/ui';
import { BodyStrong, Meta } from '../../../theme/Typography';
import { CheckIcon } from '../../../theme/icons';
import { BoxStackTile } from '../../../theme/objects/Envelope';
import { useTheme } from '../../../theme/ThemeProvider';
import { plural, t } from '../../../i18n/strings';

export function UnifiedRow({
  boxCount,
  colors,
  active,
  onPress,
}: {
  readonly boxCount: number;
  /** The boxes' colours, in the switcher's order: the first is the front envelope. */
  readonly colors: readonly string[];
  readonly active: boolean;
  readonly onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <YStack>
      <XStack
        alignItems="center"
        gap={12}
        // 12 top and bottom: a box row's 6 plus its press area's own 6, so the two rows are one height
        // and their tiles sit the same distance from the highlighted row's corners (2026-10-03).
        paddingTop={12}
        paddingRight={6}
        paddingBottom={12}
        paddingLeft={12}
        marginBottom={6}
        borderRadius={14}
        backgroundColor={active ? theme.surfaceSunken : 'transparent'}
        pressStyle={{ opacity: 0.65 }}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        accessibilityLabel={[
          t('unified.title'),
          t('unified.kind'),
          t(`unified.subtitle.${plural(boxCount)}`, { n: boxCount }),
        ]
          .filter(Boolean)
          .join(', ')}
        testID="switchUnified"
      >
        {/* Signal 1: the boxes' own envelopes fanned, how many on the front one (031 R5), where a box
            has its one envelope with its initials. */}
        <BoxStackTile colors={colors} count={boxCount} />
        <YStack flex={1} minWidth={0} gap={4}>
          <BodyStrong numberOfLines={1} paddingRight={2}>
            {t('unified.title')}
          </BodyStrong>
          {/* Signal 3: a count of boxes. A box's own identity line can never say this. */}
          <Meta color={theme.textFaint} numberOfLines={1}>
            {`${t('unified.kind')} · ${t(
              `unified.subtitle.${plural(boxCount)}`,
              { n: boxCount },
            )}`}
          </Meta>
        </YStack>
        {active ? <CheckIcon size={20} color={theme.goldInk} /> : null}
        {/* Signal 4: no ⋯. The gap where every box row has one is itself the difference. */}
      </XStack>
      {/* Signal 2: a separator, so it reads as its own group rather than the first box. */}
      <YStack
        height={1}
        backgroundColor={theme.border}
        marginHorizontal={6}
        marginBottom={8}
      />
    </YStack>
  );
}
