// The box a sign-in screen is about, fixed and not editable (031 board R11, agreed 2026-11-12): a
// sheet, 12 / 14, with the box's own envelope at 46 (R11's 13 corner, the box's 13 monogram), its
// name, its identity line and the lock. Signing in again and changing the password both show it.

import { YStack } from '../../../theme/ui';
import { SmallStrong } from '../../../theme/Typography';
import { useTheme } from '../../../theme/ThemeProvider';
import { Card } from '../../../theme/Card';
import { EnvelopeTile } from '../../../theme/objects/Envelope';
import { OffsetIcon } from '../../../theme/offsetIcons';
import { boxColor } from '../../../theme/boxColor';
import type { DataBoxAccount } from '../../../services/isds/types';
import { BoxIdentityLine } from './BoxIdentityLine';

export function BoxSheet({ account }: { readonly account: DataBoxAccount }) {
  const theme = useTheme();
  const name = account.alias ?? account.label;
  return (
    <Card
      flexDirection="row"
      paddingVertical={12}
      paddingHorizontal={14}
      gap={12}
      alignItems="center"
      testID="boxSheet"
    >
      <EnvelopeTile name={name} color={boxColor(account)} size={46} radius={13} box testID="envelopeTile" />
      <YStack flex={1} minWidth={0}>
        <SmallStrong color={theme.text} numberOfLines={1}>
          {name}
        </SmallStrong>
        <BoxIdentityLine account={account} inWindow fontWeight="500" />
      </YStack>
      <YStack testID="boxSheetLock">
        <OffsetIcon name="lock" size={20} color={theme.textMuted} />
      </YStack>
    </Card>
  );
}
