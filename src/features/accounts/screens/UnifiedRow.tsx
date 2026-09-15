// The "Vše" entry in the box switcher (024 cycle 2).
//
// IT MUST NOT BE MISTAKABLE FOR A BOX, and a label cannot carry that on its own: nothing stops a
// user naming a box "Vše". So the difference is structural, and it is four independent signals, any
// one of which still separates the two if the names collide exactly:
//
//   1. THE MARK. A box gets a SOLID, saturated tile carrying its initials - the app's avatar, which
//      everywhere else in this product means "an identity". This gets an OUTLINED, muted tile
//      carrying a glyph. Filled-and-coloured is who; outlined-and-quiet is what. (Both are rounded
//      squares: the app's avatar is a squircle, not a circle - checked on the device rather than
//      assumed, after an earlier version of this note claimed otherwise.)
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

import { Text, XStack, YStack } from '../../../theme/ui';
import { BodyStrong, Caption } from '../../../theme/Typography';
import { CheckIcon, LayersIcon } from '../../../theme/icons';
import { useTheme } from '../../../theme/ThemeProvider';
import { plural, t } from '../../../i18n/strings';

export function UnifiedRow({
  boxCount,
  unreadTotal,
  active,
  onPress,
}: {
  readonly boxCount: number;
  /** Summed across every box, so the entry says what it is worth opening for. */
  readonly unreadTotal: number;
  readonly active: boolean;
  readonly onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <YStack>
      <XStack
        alignItems="center"
        gap={12}
        paddingTop={6}
        paddingRight={6}
        paddingBottom={6}
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
          unreadTotal > 0
            ? t(`attn.unread.${plural(unreadTotal)}`, { n: unreadTotal })
            : null,
        ]
          .filter(Boolean)
          .join(', ')}
        testID="switchUnified"
      >
        {/* Signal 1: an OUTLINED tile holding a glyph, where a box has a solid coloured tile
            holding initials. 42 to match the avatar's footprint so the rows line up (V). */}
        <YStack position="relative">
          <YStack
            width={42}
            height={42}
            borderRadius={13}
            borderWidth={1}
            borderColor={theme.borderStrong}
            backgroundColor={theme.surfaceSunken}
            alignItems="center"
            justifyContent="center"
          >
            <LayersIcon size={20} color={theme.textMuted} />
          </YStack>
          {/* The unread total, in the same place and at the same metrics a box row puts its own:
            overlaying the top-right corner, never an inline pill (design 009). */}
          {unreadTotal > 0 ? (
            <XStack
              position="absolute"
              top={-5}
              right={-5}
              minWidth={20}
              minHeight={20}
              paddingHorizontal={5}
              borderRadius={10}
              backgroundColor={theme.gold}
              borderWidth={2}
              borderColor={theme.surfaceAlt}
              alignItems="center"
              justifyContent="center"
              testID="unifiedUnread"
            >
              <Text
                fontSize={11}
                fontWeight="800"
                color={theme.onGold}
                lineHeight={14}
              >
                {unreadTotal > 99 ? '99+' : String(unreadTotal)}
              </Text>
            </XStack>
          ) : null}
        </YStack>
        <YStack flex={1} minWidth={0} gap={3}>
          <BodyStrong fontSize={15} numberOfLines={1} paddingRight={2}>
            {t('unified.title')}
          </BodyStrong>
          {/* Signal 3: a count of boxes. A box's own identity line can never say this. */}
          <Caption fontSize={12} color={theme.textFaint} numberOfLines={1}>
            {`${t('unified.kind')} · ${t(
              `unified.subtitle.${plural(boxCount)}`,
              { n: boxCount },
            )}`}
          </Caption>
        </YStack>
        {active ? <CheckIcon size={20} color={theme.gold} /> : null}
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
