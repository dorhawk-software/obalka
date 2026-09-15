// The app's dialog (009 §3) - the shape every confirm in this app takes.
//
// Extracted from `RemoveBoxDialog`, which had it first, when the backup screen needed three more.
// The point is not reuse for its own sake: the OS `Alert` is a different visual language entirely
// (system fonts, system spacing, ALL-CAPS buttons), and one screen using it makes the app feel like
// two apps stitched together. Reported plainly: "the default modal is ugly as heck".
//
// Metrics live here once, so a second dialog cannot drift from the first (constitution V).
//
// The words scroll and the buttons do not. React Native scales a dialog's text with the system text size
// and nothing else about it, so at the largest sizes a long message used to push the buttons below the
// bottom of the screen: back and a tap on the dim still closed the dialog, but the choice it asked for
// could not be made (2026-09-15). Where everything fits - the default text size, and every dialog in the
// app at it - the scroll is exactly as tall as its words and the dialog is drawn as it always was.

import { Modal, Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRef, type ReactNode } from 'react';
import { XStack, YStack } from './ui';
import { BodyStrong, Caption, Heading, Value } from './Typography';
import { useTheme } from './ThemeProvider';
import { useScrim } from './useScrim';
import { PressScale } from './PressScale';
import { depth } from './depth';

export interface DialogAction {
  label: string;
  onPress: () => void;
  /**
   * Drawn before the label. For a destructive action it says what will happen before the words are
   * read - the one place in a dialog where a glance has to be enough.
   *
   * A FUNCTION of the colour, not an element: the tone decides the foreground, so a caller cannot
   * hardcode a hex that then fails to follow the theme (the palette guard rejects it outright).
   */
  icon?: (color: string) => ReactNode;
  /**
   * `primary` fills with ink, `danger` with the danger colour, `neutral` is the outlined one.
   * A dialog has at most one primary and at most one danger - more than one filled button and the
   * user has to read all of them to find the safe way out.
   */
  tone?: 'primary' | 'danger' | 'neutral';
  testID?: string;
}

export function Dialog({
  title,
  subtitle,
  body,
  actions,
  onDismiss,
  testID,
}: {
  readonly title: string;
  /** One line under the title - what the action applies to (a box name, a date). */
  readonly subtitle?: string;
  readonly body: ReactNode;
  readonly actions: DialogAction[];
  /** Tapping the scrim or pressing back. Always the SAFE outcome, never the destructive one. */
  readonly onDismiss: () => void;
  readonly testID?: string;
}) {
  const theme = useTheme();
  const scrim = useScrim(0.45);
  const insets = useSafeAreaInsets();
  // Two fit side by side; three do not, and a squeezed row of three is how people press the wrong one.
  const stacked = actions.length > 2;
  // How tall the scroll is drawn and how tall its words are, as last laid out, and whether the reader has
  // been shown there is more. A message cut off at the bottom is only half a hint, and iOS draws no
  // scroll indicator until something scrolls, so the indicators are flashed once when the words do not
  // fit. Refs rather than state: none of it changes what is drawn.
  const scrollRef = useRef<ScrollView>(null);
  const drawnHeight = useRef(0);
  const wordsHeight = useRef(0);
  const hinted = useRef(false);
  const hintIfCut = () => {
    // A dp of slack: a scroll exactly as tall as its words can measure a fraction shorter than them.
    if (!hinted.current && drawnHeight.current > 0 && wordsHeight.current - drawnHeight.current > 1) {
      hinted.current = true;
      scrollRef.current?.flashScrollIndicators();
    }
  };
  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      {/* See the note on the inner Pressable below. The scrim keeps its own label so the
          tap-outside-to-dismiss affordance is still announced. */}
      <Pressable
        accessible={false}
        onPress={onDismiss}
        style={{
          flex: 1,
          backgroundColor: scrim,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 24,
          // The same margin above and below, past the larger of the two system bars. The modal is drawn
          // under the status bar, so a card grown to the height of the screen would otherwise reach under
          // the status bar or the notch, and down to the home indicator. Equal on both sides, a card that
          // fits is centred exactly where it always was.
          paddingVertical: 24 + Math.max(insets.top, insets.bottom),
        }}
      >
        {/* Swallows presses inside the card so the dialog does not dismiss itself. */}
{/* `accessible={false}`: RN's Pressable defaults `accessible` to TRUE, and on iOS an
          accessibility element is a LEAF - VoiceOver stops descending into it. These two wrappers
          span the whole overlay, so the dialog/sheet collapsed into a single element that read every
          label at once and could only be activated as a whole: a VoiceOver user could dismiss but
          never confirm. */}
        <Pressable
          accessible={false}
          onPress={() => {}}
          // `flexShrink` here, on the card and on the scroll: when the words outgrow the room the dim
          // leaves, each gives way in turn, so that bound lands on the scroll and on nothing else.
          style={{ width: '100%', maxWidth: 420, flexShrink: 1 }}
        >
          <YStack
            backgroundColor={theme.surfaceAlt}
            borderRadius={20}
            paddingTop={22}
            paddingHorizontal={20}
            paddingBottom={18}
            flexShrink={1}
            style={{ boxShadow: depth.lg }}
            // Keeps the VoiceOver cursor inside the dialog instead of wandering the page behind it.
            accessibilityViewIsModal
            testID={testID}
          >
            {/* The title scrolls with the message. At the largest text sizes a long one - the file name
                the Debug screen asks about deleting - takes half the screen by itself, and held above the
                scroll it would leave the message a sliver. No taller than its words (`flexGrow: 0`), and
                without the bounce iOS gives a scroll view whose words already fit. */}
            <ScrollView
              ref={scrollRef}
              style={{ flexGrow: 0, flexShrink: 1 }}
              alwaysBounceVertical={false}
              onLayout={event => {
                drawnHeight.current = event.nativeEvent.layout.height;
                hintIfCut();
              }}
              onContentSizeChange={(_width, height) => {
                wordsHeight.current = height;
                hintIfCut();
              }}
            >
              <Heading fontSize={18} marginBottom={10} accessibilityRole="header">
                {title}
              </Heading>
              {subtitle ? (
                <Value fontSize={13} numberOfLines={1} marginBottom={8}>
                  {subtitle}
                </Value>
              ) : null}
              {typeof body === 'string' ? (
                <Caption fontSize={14} lineHeight={20}>
                  {body}
                </Caption>
              ) : (
                body
              )}
            </ScrollView>

            {/* Never gives way: whatever the words take, the choice stays on the screen. */}
            <YStack marginTop={20} gap={10} flexShrink={0}>
              {stacked ? (
                actions.map(action => (
                  <ActionButton key={action.label} action={action} stacked />
                ))
              ) : (
                <XStack gap={10} alignItems="center">
                  {actions.map(action => (
                    <ActionButton key={action.label} action={action} />
                  ))}
                </XStack>
              )}
            </YStack>
          </YStack>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ActionButton({
  action,
  stacked,
}: {
  readonly action: DialogAction;
  /** In a column each button owns a row of its own; `flex: 1` there makes them share - and overlap. */
  readonly stacked?: boolean;
}) {
  const theme = useTheme();
  const tone = action.tone ?? 'neutral';
  const fill =
    tone === 'danger' ? theme.danger : tone === 'primary' ? theme.text : theme.surface;
  const ink = tone === 'neutral' ? theme.text : theme.onBlue;
  return (
    <PressScale
      fullWidth
      onPress={action.onPress}
      accessibilityLabel={action.label}
      testID={action.testID}
      style={stacked ? undefined : { flex: 1 }}
    >
      {/* Flat in a dialog - no shadow (design §3). */}
      <XStack
        minHeight={48}
        borderRadius={14}
        borderWidth={tone === 'neutral' ? 1 : 0}
        borderColor={theme.borderStrong}
        backgroundColor={fill}
        alignItems="center"
        justifyContent="center"
        gap={8}
      >
        {action.icon ? (
          // Decorative: the label already says it, and a screen reader should hear it once.
          <YStack accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {action.icon(ink)}
          </YStack>
        ) : null}
        <BodyStrong color={ink} fontSize={14}>
          {action.label}
        </BodyStrong>
      </XStack>
    </PressScale>
  );
}
