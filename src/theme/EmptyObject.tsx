// An empty list as the paper sees it (031, board Empty): the object that is empty - the open envelope
// of an inbox with nothing in it - then what that means and, when it helps, when the app last looked.
// Not a grey glyph in a void: the printed object says it before the words do.

import type { ReactNode } from 'react';
import { YStack } from './ui';
import { Body, Caption, Title } from './Typography';
import { useTheme } from './ThemeProvider';

/**
 * The object 60 below the list's top, the title 36 below the object: steps of the spacing scale. The
 * boards drew 56 / 34 (Empty) and 48 / 32 (round 1's empty states); the owner moved both to these
 * (2026-11-12).
 */
const ABOVE_OBJECT = 60;
const OBJECT_TO_TITLE = 36;
/** The explanation's measure: short enough to balance in two lines. */
const BODY_WIDTH = 280;

export function EmptyObject({
  object,
  title,
  body,
  note,
  testID,
}: {
  /** The printed object, drawn at its own size (`OpenEnvelope`). */
  readonly object: ReactNode;
  readonly title: string;
  readonly body: string;
  /** A last quiet line, e.g. when the app last looked ("Naposledy dnes ve 14:02"). */
  readonly note?: string | null;
  readonly testID?: string;
}) {
  const theme = useTheme();
  return (
    <YStack alignItems="center" paddingTop={ABOVE_OBJECT} paddingHorizontal={24} testID={testID}>
      {object}
      {/* Stretched to the column: measured to its own words, Android cut the last one of a centred
          Bricolage line ("Ve schránce nic" for "… nic není", seen on the emulator). */}
      <Title alignSelf="stretch" textAlign="center" marginTop={OBJECT_TO_TITLE} accessibilityRole="header">
        {title}
      </Title>
      {/* Balanced as the board's `text-wrap: balance` (Android; iOS breaks greedily). */}
      <Body
        color={theme.textMuted}
        textAlign="center"
        maxWidth={BODY_WIDTH}
        marginTop={8}
        textBreakStrategy="balanced"
      >
        {body}
      </Body>
      {note ? (
        <Caption fontWeight="400" color={theme.textMuted} textAlign="center" marginTop={6}>
          {note}
        </Caption>
      ) : null}
    </YStack>
  );
}
