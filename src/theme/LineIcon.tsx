// An icon set beside text, centred on the text's FIRST line (spec 028).
//
// Five rows lined a small icon up with the first line of a multi-line text by eye - a `marginTop={1}`
// that was right for one size and one text scale. This box is exactly one line of the role tall, scaled
// with the system text size as React Native scales the line itself, so the icon sits on the first line's
// centre at any size, and a second line grows below it without moving it.

import type { ReactNode } from 'react';
import { useWindowDimensions } from 'react-native';
import { YStack } from './ui';
import { type as typeScale, type TextRole } from './typography';

export function LineIcon({ role, children }: { readonly role: TextRole; readonly children: ReactNode }) {
  const { fontScale } = useWindowDimensions();
  return (
    <YStack
      height={typeScale[role].lineHeight * fontScale}
      justifyContent="center"
      flexShrink={0}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {children}
    </YStack>
  );
}
