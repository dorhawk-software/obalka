// A refused password that may want an SMS code too (031 board R11, "After a refusal"): the fields stay
// on screen and editable, and this sheet under them names the three reasons - a wrong password, an
// expired one, a box that also wants an SMS code - with the way out of each. Adding a box and signing
// in again both show it, under the password field.
//
// The board sets the two links 2 apart; two 44 targets cannot be, so each is its own 44 row and the
// block is pulled up to keep the first line where the board has it (a sync-back item).

import { XStack, YStack } from '../../../theme/ui';
import { Caption, SmallStrong, Subheading } from '../../../theme/Typography';
import { useTheme } from '../../../theme/ThemeProvider';
import { Card } from '../../../theme/Card';
import { Well } from '../../../theme/Well';
import { SmartphoneIcon } from '../../../theme/icons';
import { t } from '../../../i18n/strings';

export function RefusedSuggestion({
  onUseSms,
  onOpenPortal,
}: {
  /** Sign in again with the SMS-code method, reusing what was typed. */
  readonly onUseSms: () => void;
  /** The ISDS portal of the box's environment, where an expired password is changed (030 US1). */
  readonly onOpenPortal?: () => void;
}) {
  const theme = useTheme();
  return (
    <Card padding={14} paddingBottom={2} testID="otpSuggestion">
      <XStack gap={12} alignItems="flex-start">
        <Well>
          <SmartphoneIcon size={22} color={theme.text} />
        </Well>
        <YStack flex={1} gap={4}>
          <Subheading accessibilityRole="header">{t('login.otpSuggest.title')}</Subheading>
          <Caption color={theme.bodyText}>{t('login.otpSuggest.sub')}</Caption>
          <YStack marginTop={-6}>
            <XStack
              alignSelf="flex-start"
              minHeight={44}
              alignItems="center"
              pressStyle={{ opacity: 0.6 }}
              onPress={onUseSms}
              accessibilityRole="button"
              accessibilityLabel={t('login.otpSuggest.btn')}
              testID="useSms"
            >
              <SmallStrong color={theme.blue}>{t('login.otpSuggest.btn')} →</SmallStrong>
            </XStack>
            {onOpenPortal ? (
              <XStack
                alignSelf="flex-start"
                minHeight={44}
                alignItems="center"
                pressStyle={{ opacity: 0.6 }}
                onPress={onOpenPortal}
                accessibilityRole="link"
                accessibilityLabel={t('pwd.action')}
                testID="refusedPortal"
              >
                <SmallStrong color={theme.blue}>{t('pwd.action')} →</SmallStrong>
              </XStack>
            ) : null}
          </YStack>
        </YStack>
      </XStack>
    </Card>
  );
}
