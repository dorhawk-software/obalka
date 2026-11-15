import { Dialog } from '../../../theme/Dialog';
import { TrashIcon } from '../../../theme/icons';
import { YStack } from '../../../theme/ui';
import { EnvelopeTile } from '../../../theme/objects/Envelope';
import { boxColor } from '../../../theme/boxColor';
import { t } from '../../../i18n/strings';
import type { DataBoxAccount } from '../../../services/isds/types';

/** The tile's tilt on the sheet, as R9 lays it down: a picked-up envelope, not a filed one. */
const TILT = '-2deg';

/**
 * Confirm removing a box. Shows the box being removed - its envelope tile in its colour, with its
 * monogram, as R9 draws it (031 I89) - so there is no ambiguity about which one is about to go. Until
 * 2026-11-15 its name stood under the title instead. Rounding: the tile's 17 corner is 16.
 *
 * The dialog SHELL now lives in `theme/Dialog`: this screen had the app's dialog design first, and it
 * moved there when the backup screen needed the same one three more times.
 */
export function RemoveBoxDialog({
  account,
  onDelete,
  onKeep,
}: {
  readonly account: DataBoxAccount;
  readonly onDelete: () => void;
  readonly onKeep: () => void;
}) {
  return (
    <Dialog
      title={t('box.removeTitle')}
      object={
        <YStack style={{ transform: [{ rotate: TILT }] }}>
          <EnvelopeTile name={account.alias ?? account.label} color={boxColor(account)} size={64} radius={16} box />
        </YStack>
      }
      body={t('box.removeMessage')}
      // Dismissing (scrim, back) keeps the box: the safe outcome, never the destructive one.
      onDismiss={onKeep}
      actions={[
        { label: t('box.remove.keep'), onPress: onKeep, testID: 'removeKeep' },
        {
          label: t('box.remove.delete'),
          onPress: onDelete,
          tone: 'danger',
          icon: color => <TrashIcon size={18} color={color} />,
          testID: 'removeDelete',
        },
      ]}
    />
  );
}
