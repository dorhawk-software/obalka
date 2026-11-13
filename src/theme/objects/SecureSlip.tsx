// A slip you keep, lying on the security tint (031 board R6, agreed 2026-11-12): the recovery key and
// the transfer code phrase. The tint is the inside of an envelope - the private - and sits behind the
// slip, never behind the text; the slip itself is the perforated sheet the delivery record uses.
//
// The panel is `surface-alt` with the 16 corner, 18 above, 14 at the sides and 16 below; the slip holds
// its content 18 / 16 / 16 with 12 between, stretched to its width.

import type { ReactNode } from 'react';
import { View } from 'react-native';
import { XStack, YStack } from '../ui';
import { Code } from '../Typography';
import { useTheme } from '../ThemeProvider';
import { SecurityTint } from './SecurityTint';
import { Slip } from './Slip';

export function SecureSlip({ children, testID }: { readonly children: ReactNode; readonly testID?: string }) {
  const theme = useTheme();
  return (
    <YStack
      borderRadius={16}
      overflow="hidden"
      backgroundColor={theme.surfaceAlt}
      paddingTop={18}
      paddingHorizontal={14}
      paddingBottom={16}
      testID={testID}
    >
      <SecurityTint />
      <Slip style={{ paddingTop: 18, paddingHorizontal: 16, paddingBottom: 16, gap: 12, alignItems: 'stretch' }}>
        {children}
      </Slip>
    </YStack>
  );
}

/** How many parts the first line holds: the board sets both the key and the phrase three and two. */
const FIRST_LINE = 3;

/**
 * A key or a phrase on its slip: centred, three parts on the first line and the rest on the next, each
 * line still free to wrap between parts (never inside one) when a long phrase runs out of room. The
 * dash ends the line it breaks, as the board writes "9TVB-" / "2PRN". `faintDashes` prints the phrase's
 * dashes in faint ink: they separate words a person types, not characters of the code.
 */
export function SlipCode({
  parts,
  faintDashes = false,
  accessibilityLabel,
  testID,
}: {
  readonly parts: readonly string[];
  readonly faintDashes?: boolean;
  readonly accessibilityLabel: string;
  readonly testID?: string;
}) {
  const theme = useTheme();
  const lines = [parts.slice(0, FIRST_LINE), parts.slice(FIRST_LINE)].filter(line => line.length > 0);
  let index = 0;
  return (
    <View accessible accessibilityLabel={accessibilityLabel} testID={testID}>
      {lines.map((line, l) => (
        <XStack key={l} flexWrap="wrap" justifyContent="center">
          {line.map(part => {
            const i = index;
            index += 1;
            return (
              <Code key={`${part}-${i}`} selectable>
                {part}
                {i < parts.length - 1 ? <Code color={faintDashes ? theme.textFaint : theme.text}>-</Code> : null}
              </Code>
            );
          })}
        </XStack>
      ))}
    </View>
  );
}
