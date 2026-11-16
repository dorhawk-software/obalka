// The way on from a restore made on a phone with no boxes (2026-09-24): once the archive is in, the
// restore screen and the transfer screen both end on this, under the sentence saying what came back.
//
// One component for both, so the two screens cannot draw it differently. It is the screen's one filled
// action, so it is the filled button itself, 52 with the 14 corner (R14's primary; 031 I123 - until
// 2026-11-15 it drew a face of its own at 48).

import { YStack } from '../../theme/ui';
import { InkButton } from '../../theme/InkButton';
import { space } from '../../theme/spacing';
import { t } from '../../i18n/strings';

export function ContinueButton({
  onPress,
  testID,
}: {
  readonly onPress: () => void;
  readonly testID: string;
}) {
  return (
    <YStack marginTop={space.md}>
      <InkButton bare="step" label={t('common.continue')} onPress={onPress} testID={testID} />
    </YStack>
  );
}
