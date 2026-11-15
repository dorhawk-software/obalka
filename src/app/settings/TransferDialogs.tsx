// The transfer screen's two questions (split out of TransferScreen.tsx on 2026-11-12, when they
// learnt what to do as the app leaves). An RN Modal draws above the lock cover. The mobile-data
// question is the person's: it closes as the app leaves, like Cancel. What arrived is the app's: its
// question waits, hidden, while the app is covered, because the transfer is on disk until answered.

import { Dialog } from '../../theme/Dialog';
import { formatBytes, t } from '../../i18n/strings';
import type { ReceivedTransfer } from '../../features/transfer/state/transferController';
import { useAppCovered } from '../lock/LockGate';
import { useCloseOnBackground } from '../useCloseOnBackground';

const pad = (n: number) => String(n).padStart(2, '0');

export function formatDateTime(epochMs: number): string {
  const d = new Date(epochMs);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}


export function TransferDialogs({
  meteredAsk,
  onMeteredCancel,
  onMeteredConfirm,
  got,
  onDecline,
  onConfirm,
}: {
  /** The size of a send held back until the mobile-data question is answered (FR-008), or null. */
  readonly meteredAsk: number | null;
  readonly onMeteredCancel: () => void;
  readonly onMeteredConfirm: () => void;
  /** What arrived, waiting for its answer (FR-004), or null. */
  readonly got: ReceivedTransfer | null;
  readonly onDecline: () => void;
  readonly onConfirm: () => void;
}) {
  useCloseOnBackground(onMeteredCancel);
  const covered = useAppCovered();
  return (
    <>
    {meteredAsk != null ? (
      <Dialog
        glyph="transfer"
        title={t('transfer.metered.title')}
        body={t('transfer.metered.body', { size: formatBytes(meteredAsk) })}
        onDismiss={onMeteredCancel}
        testID="transfer-metered-dialog"
        actions={[
          {
            label: t('common.cancel'),
            testID: 'transfer-metered-cancel',
            onPress: onMeteredCancel,
          },
          {
            label: t('transfer.metered.confirm'),
            // R9 fills it: the answer the question is asking for, first under the words.
            tone: 'primary',
            testID: 'transfer-metered-confirm',
            onPress: onMeteredConfirm,
          },
        ]}
      />
    ) : null}

    {got && !covered ? (
      <Dialog
        glyph="transfer"
        title={t('transfer.got.title')}
        body={
          got.restorable
            ? t('transfer.got.body', {
                when: formatDateTime(got.manifest.createdAt),
                size: formatBytes(got.manifest.sizeBytes),
              })
            : got.compatibility.kind === 'tooNew'
            ? t('transfer.got.tooNew')
            : t('transfer.got.unsupported')
        }
        onDismiss={onDecline}
        testID="transfer-received-dialog"
        actions={
          got.restorable
            ? [
                {
                  label: t('common.cancel'),
                  testID: 'transfer-received-cancel',
                  // Declining still has to let go of what arrived: the documents are on disk.
                  onPress: onDecline,
                },
                {
                  label: t('transfer.got.confirm'),
                  tone: 'primary',
                  testID: 'transfer-received-confirm',
                  onPress: onConfirm,
                },
              ]
            : [
                {
                  label: t('common.ok'),
                  testID: 'transfer-received-close',
                  onPress: onDecline,
                },
              ]
        }
      />
    ) : null}
    </>
  );
}
