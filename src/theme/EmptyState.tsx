// Empty state - a BARE outline glyph (the design draws no tile/circle behind it) + a confident
// headline + a friendly one-line hint. An award-winning empty screen explains the absence and
// reassures, rather than a bare grey sentence. One reusable block so every empty state (no messages,
// no search results) looks the same. Callers pass the icon at 48px in `theme.borderStrong`.

import type { ReactNode } from 'react';
import { YStack } from './ui';
import { Body, Heading } from './Typography';
import { useTheme } from './ThemeProvider';
import { fonts } from './typography';

export function EmptyState({
  icon,
  title,
  subtitle,
  centered,
  marginTop = 0,
}: {
  readonly icon: ReactNode;
  readonly title: string;
  readonly subtitle?: string;
  /** Fill the area and vertically centre (a whole-screen empty, e.g. search). */
  readonly centered?: boolean;
  /** Top offset when not centred (e.g. inside a list, below the header). */
  readonly marginTop?: number;
}) {
  const theme = useTheme();
  return (
    <YStack
      flex={centered ? 1 : undefined}
      alignItems="center"
      justifyContent={centered ? 'center' : 'flex-start'}
      paddingHorizontal={36}
      marginTop={centered ? 0 : marginTop}
    >
      {icon}
      <Heading fontSize={18} color={theme.text} textAlign="center" marginTop={16}>
        {title}
      </Heading>
      {subtitle ? (
        <Body
          fontFamily={fonts.bodyMedium} // Public Sans 500 - a fontWeight prop can't switch the face
          fontSize={14}
          fontWeight="500"
          lineHeight={20}
          maxWidth={240}
          color={theme.textMuted}
          textAlign="center"
          marginTop={6}
        >
          {subtitle}
        </Body>
      ) : null}
    </YStack>
  );
}
