// Which box a message belongs to, as a chip.
//
// In a merged list this is not decoration. The boxes on one phone are frequently different LEGAL
// ENTITIES of the same person - an individual, their own trading name, their company - so a row
// whose box is not visible is a message whose recipient is ambiguous. The pill is never optional.
//
// WHY IT CARRIES A COLOURED DOT. The first version was a sand-filled pill (`surfaceSunken`), which
// works on an unread row and disappears on a read one: measured, that fill is 1.03:1 against the
// paper ground and 1.18:1 against the white surface an unread row uses. Reported exactly that way -
// "nicely visible for unread, barely visible for read". A neutral fill cannot solve it, because
// every sand token in the palette sits within 1.3:1 of BOTH grounds; the two grounds are themselves
// only 1.14:1 apart, so there is no neutral that separates from both.
//
// Colour does. The dot is the box's OWN avatar hue - the same `avatarColor(boxId)` the switcher
// paints its tile with - so it is 5.1:1 at worst against either ground, and it is not a new visual
// language: it is the identity the user has already learned for that box. In a list merged from
// three or four boxes it also makes the thing scannable without reading, which the sand pill never
// was.
//
// The outline moved to `borderStrong` for the same reason - 1.30:1 rather than 1.10:1 - and the
// legal-form code to `textMuted`. Neither is load-bearing: the dot and the name are.

import { XStack, YStack } from '../../../theme/ui';
import { Caption } from '../../../theme/Typography';
import { useTheme } from '../../../theme/ThemeProvider';
import { fonts } from '../../../theme/typography';
import { avatarColor } from '../../../theme/avatar';
import { boxTypeShort } from '../../accounts/state/boxType';
import type { DataBoxAccount } from '../../../services/isds/types';

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
  const code = boxTypeShort(account?.dbType ?? null);
  return (
    <XStack
      alignItems="center"
      gap={6}
      minWidth={0}
      flexShrink={1}
      paddingLeft={7}
      paddingRight={8}
      paddingVertical={2}
      borderRadius={7}
      borderWidth={1}
      borderColor={theme.borderStrong}
      backgroundColor={theme.surfaceSunken}
    >
      {/* The box's identity colour, seeded exactly as the switcher seeds its tile. Decorative to a
          screen reader: the name beside it says the same thing, and the row's own label repeats it. */}
      <YStack
        width={7}
        height={7}
        borderRadius={999}
        flexShrink={0}
        backgroundColor={avatarColor(boxId)}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      {code ? (
        <Caption
          fontSize={11}
          lineHeight={15}
          color={theme.textMuted}
          numberOfLines={1}
          flexShrink={0}
        >
          {code}
        </Caption>
      ) : null}
      {/* The name is the half that identifies, so it carries the ink and the weight. */}
      <Caption
        fontFamily={fonts.bodySemiBold}
        fontSize={11}
        lineHeight={15}
        fontWeight="600"
        color={theme.text}
        numberOfLines={1}
        flexShrink={1}
        minWidth={0}
      >
        {name}
      </Caption>
    </XStack>
  );
}
