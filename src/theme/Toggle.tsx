// The design's switch: a 48×28 track with a 22px knob and one soft drop shadow. Extracted from
// SettingsScreen in 013 - the notifications screen now needs the identical control, and a second copy
// would be the first place the two drifted (constitution V: the same pattern keeps the same numbers).

import { XStack, YStack } from './ui';
import { useTheme } from './ThemeProvider';
import { touchSlop } from './touchTarget';

/**
 * A 48×28 track toggle (design §3): blue on-track, a white knob that slides between edges, and a
 * hairline outline while OFF so the control has a boundary against the row behind it.
 * A switch in spirit and accessibility - preserves the controlled value + busy/disabled handling.
 *
 * `label` is REQUIRED, and deliberately so. The switch sits as a SIBLING of its row title, not a
 * parent, so nothing associates the two: an unlabelled one announces as bare "Switch, on" and a
 * screen-reader user has no way to tell which setting they just heard. Caught by the uiautomator pass
 * on the notifications screen, where three of them sat in a row.
 */
export function Toggle({
  value,
  onChange,
  label,
  disabled,
  testID,
}: {
  readonly value: boolean;
  readonly onChange: (next: boolean) => void;
  /** What this switch controls, as the screen reader should announce it. */
  readonly label: string;
  readonly disabled?: boolean;
  readonly testID?: string;
}) {
  const theme = useTheme();
  return (
    <XStack
      width={48}
      height={28}
      borderRadius={14}
      // RN's box model is border-box, so the OFF state's 1px outline eats into the same 28 the knob
      // has to fit in. Padding drops to 2 there to pay for it: border 1 + padding 2 leaves the knob
      // exactly 22 tall and its outer edge exactly 3 from the track edge - the ON state's geometry,
      // unchanged. Typing `padding={3}` beside the border instead would clip the knob by 2px.
      padding={value ? 3 : 2}
      justifyContent={value ? 'flex-end' : 'flex-start'}
      backgroundColor={value ? theme.blue : theme.trackOff}
      // The OFF track is 1.70:1 on `surface` (1.54 in dark) - no discernible boundary at all, which
      // is the state half of WCAG 1.4.11. Outlined rather than darkened, so the design's track colour
      // survives; Material 3's own unselected switch carries the same outline.
      borderWidth={value ? 0 : 1}
      borderColor={value ? 'transparent' : theme.trackOffBorder}
      opacity={disabled ? 0.6 : 1}
      // 28 tall is the design's switch, not the target a finger gets: the slop takes it to 48 without
      // touching a pixel of it.
      hitSlop={touchSlop({ width: 48, height: 28 })}
      pressStyle={{ opacity: 0.85 }}
      onPress={disabled ? undefined : () => onChange(!value)}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled: !!disabled }}
      testID={testID}
    >
      <YStack
        width={22}
        height={22}
        borderRadius={999}
        // `onSolid`: the knob is white in BOTH appearances. `onBlue` is white only in light mode, so
        // the knob this file documents as "near-white" was rendering near-black at night.
        backgroundColor={theme.onSolid}
        // Design: a single soft drop shadow on the knob - no inset highlight, no ambient layer.
        style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }}
      />
    </XStack>
  );
}
