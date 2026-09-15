// Sender identity avatar - the app's own take on the colour-per-sender pattern (not a Gmail clone):
// a ROUNDED-SQUARE tile (the FAB / box-tile shape) with a SOLID identity fill + a white 1–2 letter
// monogram (FÚ, OŠ, EČ - the *who* at a glance). One component for list / search / detail.
//
// The monogram is `onSolid` - white in both appearances - because the fill is one of six FIXED hues
// from `avatar.ts` that do not follow the theme. It used to be `onBlue`, which is white only in light
// mode; in dark mode that put near-black ink on those hues at **2.11–3.05:1**, on the most repeated
// element in the app. See the `onSolid` doc comment in `theme.ts`.

import { Text, YStack } from './ui';
import { useTheme } from './ThemeProvider';
import { avatarColor, monogram } from './avatar';

export function Avatar({
  name,
  size = 42,
  colorSeed,
}: {
  readonly name: string | null | undefined;
  readonly size?: number;
  /** Hash the colour off this instead of `name` - so same-named boxes (Ondřej Šimon × N) still get
   *  distinct tints while keeping their owner-name monogram. Defaults to `name`. */
  readonly colorSeed?: string | null;
}) {
  const theme = useTheme();
  const seed = colorSeed ?? name;
  const color = avatarColor(seed);
  // The 52pt identity tile (message detail's postmark card) is drawn with a tighter corner and a
  // translucent white ring around the solid fill; the smaller list tiles have neither.
  const identity = size >= 52;
  // Design radii are FIXED steps, not a ratio: every list tile (36/38/40/42) is 11, the 46pt re-auth
  // identity tile is 13, the 52pt detail postmark tile is 14.
  const radius = identity ? 14 : size >= 46 ? 13 : 11;
  // The identity tile's ring: a soft white highlight reads well on a saturated fill in LIGHT mode, but
  // on the dark base a white ring glares - dark mode wants a darker, recessed ring instead.
  const ringColor =
    theme.name === 'dark' ? 'rgba(0,0,0,0.28)' : 'rgba(255,255,255,0.5)';
  return (
    <YStack
      width={size}
      height={size}
      borderRadius={radius}
      backgroundColor={color}
      borderWidth={identity ? 2 : 0}
      borderColor={identity ? ringColor : undefined}
      alignItems="center"
      justifyContent="center"
    >
      <Text
        fontSize={identity ? 17 : size >= 42 ? 15 : size >= 36 ? 13 : 12}
        fontWeight="700"
        letterSpacing={0}
        color={theme.onSolid}
      >
        {monogram(name)}
      </Text>
    </YStack>
  );
}
