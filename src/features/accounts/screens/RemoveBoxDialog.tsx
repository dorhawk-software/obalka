import { Dialog } from '../../../theme/Dialog';
import { TrashIcon } from '../../../theme/icons';
import { t } from '../../../i18n/strings';
import type { DataBoxAccount } from '../../../services/isds/types';

/**
 * Confirm removing a box. Names the box being removed - its display name (alias ?? owner) - so there
 * is no ambiguity about which one is about to go.
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
      subtitle={account.alias ?? account.label}
      body={t('box.removeMessage')}
      // Dismissing (scrim, back) keeps the box: the safe outcome, never the destructive one.
      onDismiss={onKeep}
      actions={[
        { label: t('box.remove.keep'), onPress: onKeep, testID: 'removeKeep' },
        {
          label: t('box.remove.delete'),
          onPress: onDelete,
          tone: 'danger',
          icon: color => <TrashIcon size={16} color={color} />,
          testID: 'removeDelete',
        },
      ]}
    />
  );
}
