// The attachments' cards (031 I35, board R7). R7 draws one state, the message not yet downloaded: a card
// with the attach glyph in its well, the title over the words, and the blue download inside it. The
// states no board draws take that anatomy (T051): the files that went missing keep the soft-gold notice
// DESIGN.md gives them, its button now R7's blue download rather than an outlined one (tone, not
// outlines); a message gone from ISDS is the same card with nothing to press.

import { XStack, YStack } from '../../../theme/ui';
import { useTheme } from '../../../theme/ThemeProvider';
import { BodyStrong, Caption, SmallStrong } from '../../../theme/Typography';
import { Card } from '../../../theme/Card';
import { OffsetIcon } from '../../../theme/offsetIcons';
import { PressScale } from '../../../theme/PressScale';
import { Well } from '../../../theme/Well';
import { t } from '../../../i18n/strings';

/** R7's download: the blue button, 48 tall with the 13 corner, the offset download glyph and 15/700. */
export function DownloadButton({
  label,
  busyLabel,
  busy = false,
  onPress,
  testID,
}: {
  readonly label: string;
  /** What it says while the download runs; the glyph steps aside for it. */
  readonly busyLabel?: string;
  readonly busy?: boolean;
  readonly onPress: () => void;
  readonly testID?: string;
}) {
  const theme = useTheme();
  return (
    <PressScale fullWidth busy={busy} onPress={onPress} accessibilityLabel={label} testID={testID}>
      <XStack
        width="100%"
        minHeight={48}
        borderRadius={13}
        backgroundColor={theme.blue}
        alignItems="center"
        justifyContent="center"
        gap={8}
        opacity={busy ? 0.55 : 1}
        testID={testID ? `${testID}-face` : undefined}
      >
        {busy ? null : <OffsetIcon name="download" size={20} color={theme.onBlue} plane="envelope" />}
        <BodyStrong color={theme.onBlue}>{busy && busyLabel ? busyLabel : label}</BodyStrong>
      </XStack>
    </PressScale>
  );
}

/** ISDS no longer has the message and the files never came: R7's card, the words alone. */
export function AttachmentsUnavailableCard({ marginTop }: { readonly marginTop: number }) {
  const theme = useTheme();
  return (
    <Card marginTop={marginTop} padding={14} testID="attachmentsUnavailable">
      <XStack gap={12} alignItems="center">
        <Well name="attach" />
        <YStack flex={1}>
          <SmallStrong fontWeight="600" color={theme.text}>
            {t('detail.attachments.unavailable.title')}
          </SmallStrong>
          <Caption color={theme.textMuted}>{t('detail.attachments.unavailable.body')}</Caption>
        </YStack>
      </XStack>
    </Card>
  );
}
