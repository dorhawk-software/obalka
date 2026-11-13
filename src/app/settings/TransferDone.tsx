// The transfer's end as a screen of its own (031 I46.5, board R8 "Transfer, done", agreed 2026-11-12):
// the archive arrives as the stack of envelopes the search's empty state draws, what came back is the
// title, what is still to do follows it, the route is last and quietest, and the way on is the one
// filled button at the foot - no bar under it, as the password change's done state.
//
// Roundings from the board: the 80 above the stack is the screen's 18 plus the scale's top step, 60;
// the 32 under it is 36, as on every hero-object screen (the search, the password change).

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView, XStack, YStack } from '../../theme/ui';
import { ScreenHeader } from '../../theme/ScreenHeader';
import { BodyStrong, Meta, Small, Title } from '../../theme/Typography';
import { EnvelopePose } from '../../theme/objects/Envelope';
import { PressScale } from '../../theme/PressScale';
import { useTheme } from '../../theme/ThemeProvider';
import { space } from '../../theme/spacing';
import { t } from '../../i18n/strings';

/** The last word: what happened, what follows from it, and the route when it became known. */
export interface TransferEnd {
  readonly title: string;
  readonly body: string | null;
  readonly went: string | null;
}

export function TransferDone({
  title,
  end,
  onBack,
  onContinue,
}: {
  /** The screen's own title, so the header does not change under the person. */
  readonly title: string;
  readonly end: TransferEnd;
  readonly onBack: () => void;
  readonly onContinue: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <YStack flex={1} backgroundColor={theme.bg} testID="transfer-done-screen">
      <ScreenHeader title={title} onBack={onBack} />
      <ScrollView
        flex={1}
        contentContainerStyle={{
          alignItems: 'center',
          paddingTop: space.gutter + 60,
          paddingHorizontal: 28,
        }}
      >
        <EnvelopePose pose="archive" />
        <Title alignSelf="stretch" textAlign="center" marginTop={36} accessibilityRole="header" testID="transfer-done">
          {end.title}
        </Title>
        {end.body ? (
          <Small
            color={theme.textMuted}
            textAlign="center"
            maxWidth={300}
            marginTop={8}
            textBreakStrategy="balanced"
            testID="transfer-done-body"
          >
            {end.body}
          </Small>
        ) : null}
        {end.went ? (
          <Meta color={theme.textFaint} textAlign="center" marginTop={14} testID="transfer-done-route">
            {end.went}
          </Meta>
        ) : null}
      </ScrollView>
      <YStack paddingHorizontal={16} paddingTop={12} paddingBottom={insets.bottom + 12}>
        <PressScale
          fullWidth
          onPress={onContinue}
          accessibilityLabel={t('common.continue')}
          testID="transfer-continue"
        >
          <XStack
            width="100%"
            minHeight={52}
            borderRadius={14}
            backgroundColor={theme.text}
            alignItems="center"
            justifyContent="center"
          >
            <BodyStrong color={theme.surfaceAlt}>{t('common.continue')}</BodyStrong>
          </XStack>
        </PressScale>
      </YStack>
    </YStack>
  );
}
