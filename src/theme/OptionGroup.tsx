import { useEffect, useRef, type ReactNode } from 'react';
import { Animated } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { XStack, YStack } from './ui';
import { Body, Caption } from './Typography';
import { fonts } from './typography';
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

const RADIUS = 14;

/**
 * A compact grouped selector. Every option shares one rounded, bordered container split by hairline
 * dividers; the selected option is shown ONLY by its radio (design: no tint, no divider suppression -
 * every non-last row keeps its solid `border` hairline). A `selection` haptic ticks on pick.
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
  const theme = useTheme();
  return (
    <YStack
      borderRadius={RADIUS}
      borderWidth={1}
      borderColor={theme.border}
      backgroundColor={theme.surface}
      overflow="hidden"
    >
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
    </YStack>
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
      {/* Every non-last row carries the hairline, whatever is selected (design). */}
      {showDivider ? <YStack height={1} backgroundColor={theme.border} /> : null}
      <XStack
        alignItems="center"
        gap={12}
        paddingVertical={13}
        paddingHorizontal={14}
        backgroundColor="transparent"
        pressStyle={{ opacity: 0.85 }}
        onPress={onPress}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        testID={testID}
      >
        {/* 28px leading slot (the design's flag chip) → the label starts at 14 + 28 + 12 = 54px. */}
        {option.leading != null ? (
          <YStack width={28} alignItems="center">
            {option.leading}
          </YStack>
        ) : null}
        {/* Selection is shown ONLY by the radio (design): label stays text 15/600 in every state.
            The SemiBold FACE must be named explicitly - Public Sans is 4-style grouped, so a bare
            fontWeight can't reach it from the Regular family. */}
        <YStack flex={1}>
          <Body fontFamily={fonts.bodySemiBold} fontWeight="600" color={theme.text}>
            {option.label}
          </Body>
          {option.description ? (
            <Caption fontSize={12} lineHeight={15} marginTop={1} color={theme.textFaint}>
              {option.description}
            </Caption>
          ) : null}
        </YStack>
        {option.trailing != null ? option.trailing : null}
        {/* Radio: an empty ring; when selected a filled-blue disc with a white centre dot grows in. */}
        <YStack
          width={22}
          height={22}
          borderRadius={11}
          borderWidth={2}
          alignItems="center"
          justifyContent="center"
          overflow="hidden"
          borderColor={selected ? theme.blue : theme.borderStrong}
        >
          <Animated.View
            style={{
              position: 'absolute',
              width: 22,
              height: 22,
              borderRadius: 11,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: theme.blue,
              opacity: check,
              transform: [{ scale: check }],
            }}
          >
            <YStack
              width={9}
              height={9}
              borderRadius={5}
              backgroundColor={theme.onBlue}
            />
          </Animated.View>
        </YStack>
      </XStack>
    </YStack>
  );
}
