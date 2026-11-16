// The app's dialog (009 §3) - the shape every question and notice in this app takes.
//
// Extracted from `RemoveBoxDialog`, which had it first, when the backup screen needed three more.
// The point is not reuse for its own sake: the OS `Alert` is a different visual language entirely
// (system fonts, system spacing, ALL-CAPS buttons), and one screen using it makes the app feel like
// two apps stitched together. Reported plainly: "the default modal is ugly as heck".
//
// Board R9 (031 I52, agreed 2026-11-12): "the paid-send sheet, for every question" - one anatomy, a
// bottom sheet. The grabber, the object or glyph the question is about, the title, the words, and the
// answers under the thumb, one above the other, the filled or danger answer first and the way out
// last. It is `BottomSheet` itself, so it rises as every sheet does (240 ms; a fade under Reduce
// Motion), closes as every sheet does - the scrim, a swipe, back - and its words scroll while its
// answers never do: at the largest text sizes a long message used to push the buttons off the screen
// (2026-09-15). Until 2026-11-15 it was a card in the middle of the screen with its answers in a row.
//
// Roundings from the board: the 22 above the object and above the answers is 24; the title stands 16
// under a glyph's well and 18 under an object, as drawn.

import type { ReactNode } from 'react';
import { YStack } from './ui';
import { Small, Title } from './Typography';
import { useTheme } from './ThemeProvider';
import { BottomSheet } from './BottomSheet';
import { InkButton, inkButtonInk } from './InkButton';
import { NeutralButton } from './NeutralButton';
import { Well } from './Well';
import type { OffsetGlyphName } from './offsetIcons';
import type { Bare } from './buttonGlyph';
import { space } from './spacing';

export type DialogAction = DialogAnswerGlyph & {
  label: string;
  onPress: () => void;
  /**
   * `primary` fills with ink, `danger` with the danger colour, `neutral` is the sunken one.
   * A dialog has at most one primary and at most one danger - more than one filled button and the
   * user has to read all of them to find the safe way out.
   */
  tone?: 'primary' | 'danger' | 'neutral';
  /** The filled answer's press is running (the paid send while it starts): its spinner, no second press. */
  busy?: boolean;
  testID?: string;
};

/**
 * Before the label: the family's glyph by name (the button inks it in the tone's colour), or a plain
 * control's own drawn in that colour, or why the answer has none (`ButtonGlyph`).
 */
type DialogAnswerGlyph =
  | { glyph: OffsetGlyphName; icon?: never; bare?: never }
  | { icon: (color: string) => ReactNode; glyph?: never; bare?: never }
  | { bare: Bare; glyph?: never; icon?: never };

/** R9's order: the filled and danger answers first, under the words; the neutral ones last. */
function inOrder(actions: readonly DialogAction[]): DialogAction[] {
  const filled = actions.filter(a => (a.tone ?? 'neutral') !== 'neutral');
  const neutral = actions.filter(a => (a.tone ?? 'neutral') === 'neutral');
  return [...filled, ...neutral];
}

export function Dialog({
  title,
  subtitle,
  body,
  actions,
  onDismiss,
  glyph,
  object,
  testID,
}: {
  readonly title: string;
  /** One line under the title - what the action applies to (a box name, a date). */
  readonly subtitle?: string;
  readonly body: ReactNode;
  readonly actions: DialogAction[];
  /** Tapping the scrim, a swipe down, or back. Always the SAFE outcome, never the destructive one. */
  readonly onDismiss: () => void;
  /**
   * The glyph the question is about, drawn in a 56 well (R9's mobile data, a failed removal): an
   * offset glyph by name, or any glyph drawn in the colour given.
   */
  readonly glyph?: OffsetGlyphName | ((color: string) => ReactNode);
  /** The thing itself, drawn as it is (R9's box removal: the box's envelope tile). */
  readonly object?: ReactNode;
  readonly testID?: string;
}) {
  const theme = useTheme();
  let head: ReactNode = null;
  if (object != null) {
    head = <YStack marginTop={space.section}>{object}</YStack>;
  } else if (glyph != null) {
    head = (
      <YStack marginTop={space.section}>
        {typeof glyph === 'string' ? <Well large name={glyph} /> : <Well large>{glyph(theme.text)}</Well>}
      </YStack>
    );
  }
  let titleTop: number = space.inset;
  if (object != null) {
    titleTop = space.gutter;
  }
  return (
    <BottomSheet
      onClose={onDismiss}
      testID={testID}
      footer={
        // Never gives way: whatever the words take, the choice stays on the screen.
        <YStack marginTop={space.section} gap={space.base} flexShrink={0} testID={testID ? `${testID}-answers` : undefined}>
          {inOrder(actions).map(action => (
            <Answer key={action.label} action={action} />
          ))}
        </YStack>
      }
    >
      <YStack alignItems="center">
        {head}
        <Title textAlign="center" marginTop={titleTop} accessibilityRole="header">
          {title}
        </Title>
        {subtitle ? (
          <Small color={theme.textMuted} textAlign="center" numberOfLines={1} marginTop={space.xs}>
            {subtitle}
          </Small>
        ) : null}
        <YStack alignSelf="stretch" marginTop={space.base}>
          {typeof body === 'string' ? (
            <Small color={theme.bodyText} textAlign="center">
              {body}
            </Small>
          ) : (
            body
          )}
        </YStack>
      </YStack>
    </BottomSheet>
  );
}

function Answer({ action }: { readonly action: DialogAction }) {
  const theme = useTheme();
  const tone = action.tone ?? 'neutral';
  // Decorative: the label already says it, and a screen reader should hear it once.
  const drawn = (color: string) =>
    action.icon ? (
      <YStack accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {action.icon(color)}
      </YStack>
    ) : null;
  const glyph = action.glyph
    ? { glyph: action.glyph }
    : action.bare
      ? { bare: action.bare }
      : { icon: drawn(tone === 'neutral' ? theme.text : inkButtonInk(theme)) };
  if (tone === 'neutral') {
    return <NeutralButton label={action.label} onPress={action.onPress} {...glyph} testID={action.testID} />;
  }
  return (
    <InkButton
      label={action.label}
      onPress={action.onPress}
      busy={action.busy}
      danger={tone === 'danger'}
      {...glyph}
      testID={action.testID}
    />
  );
}
