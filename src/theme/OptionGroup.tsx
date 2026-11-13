import { useEffect, useRef, type ReactNode } from 'react';
import { Animated } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { XStack, YStack } from './ui';
import { Caption, Small } from './Typography';
import { Card } from './Card';
import { useTheme } from './ThemeProvider';
import { haptics } from '../services/haptics';

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  /** Optional leading visual (a colored icon or a flag). */
  leading?: ReactNode;
  /**
   * A line under the label - what choosing it means, or a count (026). Drawn in the same caption the
   * settings rows use under their titles, so a described option reads like a settings row with a radio.
   */
  description?: string;
  /** Drawn between the text and the radio: a chip that states a fact about the option (026). */
  trailing?: ReactNode;
}

/**
 * A compact grouped selector. Every option shares one card (a sheet with weight, 031 Cards B), its
 * rows parted by a hairline inset 14; the selected option is shown ONLY by its radio - a blue ring
 * with a blue dot, the dot growing in over 140 ms (boards R3, R13; no tint, no divider suppression).
 * A `selection` haptic ticks on pick.
 */
export function OptionGroup<T extends string>({
  options,
  value,
  onChange,
  testIDPrefix,
}: {
  readonly options: SelectOption<T>[];
  readonly value: T;
  readonly onChange: (value: T) => void;
  readonly testIDPrefix?: string;
}) {
  return (
    <Card>
      {options.map((opt, i) => {
        const selected = opt.value === value;
        return (
          <OptionRow
            key={opt.value}
            option={opt}
            selected={selected}
            showDivider={i > 0}
            onPress={() => {
              if (!selected) {
                haptics.selection();
              }
              onChange(opt.value);
            }}
            testID={testIDPrefix ? `${testIDPrefix}-${opt.value}` : undefined}
          />
        );
      })}
    </Card>
  );
}

function OptionRow<T extends string>({
  option,
  selected,
  showDivider,
  onPress,
  testID,
}: {
  readonly option: SelectOption<T>;
  readonly selected: boolean;
  readonly showDivider: boolean;
  readonly onPress: () => void;
  readonly testID?: string;
}) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  // The check scales + fades in when this row becomes selected (settled state screenshots fine).
  const check = useRef(new Animated.Value(selected ? 1 : 0)).current;
  useEffect(() => {
    if (reduceMotion) {
      check.setValue(selected ? 1 : 0); // Reduce Motion → snap, don't scale in
      return;
    }
    Animated.timing(check, {
      toValue: selected ? 1 : 0,
      duration: 140,
      useNativeDriver: true,
    }).start();
  }, [selected, check, reduceMotion]);

  return (
    <YStack>
      {/* Every row but the first has the hairline above it, inset 14, whatever is selected. */}
      {showDivider ? <YStack height={1} marginLeft={14} backgroundColor={theme.border} /> : null}
      <XStack
        alignItems="center"
        gap={12}
        minHeight={52}
        paddingVertical={10}
        paddingHorizontal={14}
        backgroundColor="transparent"
        pressStyle={{ opacity: 0.85 }}
        onPress={onPress}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        testID={testID}
      >
        {/* The leading mark (a flag) sits in the row's own 12 gap, as the boards draw it. */}
        {option.leading != null ? option.leading : null}
        {/* Selection is shown ONLY by the radio: the label stays 14/600 in ink in every state. */}
        <YStack flex={1} minWidth={0} gap={2}>
          <Small fontWeight="600" color={theme.text}>
            {option.label}
          </Small>
          {option.description ? <Caption color={theme.textMuted}>{option.description}</Caption> : null}
        </YStack>
        {option.trailing != null ? option.trailing : null}
        {/* Radio: a 2 dp ring, `borderStrong`; selected, a blue ring with a 12 dp blue dot. */}
        <YStack
          width={22}
          height={22}
          borderRadius={999}
          borderWidth={2}
          alignItems="center"
          justifyContent="center"
          overflow="hidden"
          borderColor={selected ? theme.blue : theme.borderStrong}
        >
          <Animated.View
            style={{
              width: 12,
              height: 12,
              borderRadius: 999,
              backgroundColor: theme.blue,
              opacity: check,
              transform: [{ scale: check }],
            }}
          />
        </YStack>
      </XStack>
    </YStack>
  );
}
