// The transfer's two navigator routes (025, 031 R10): the transfer screen opened from Backup, and the
// receiving screen its row opens. Out of AppNavigator.tsx on 2026-11-13, when the second one arrived
// and the navigator file reached its size limit.

import { useCallback, useEffect, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../AppNavigator';
import { useViewPresence } from '../viewPresence';
import { TransferScreen } from './TransferScreen';
import { backupController, transferController } from '../../features/accounts/deps';
import type { BackupManifest } from '../../services/backup/schema';

export function TransferRoute({
  navigation,
}: Readonly<NativeStackScreenProps<RootStackParamList, 'Transfer'>>) {
  const [backups, setBackups] = useState<BackupManifest[] | null>(null);
  // The backups this phone holds, read here rather than passed in so the screen cannot be opened
  // holding a stale list - and read again when the chosen one turned out to be gone (026 US3).
  const readBackups = useCallback(() => {
    void backupController
      .list()
      .then(list => setBackups(list.map(item => item.manifest)))
      .catch(() => setBackups([]));
  }, []);
  useEffect(readBackups, [readBackups]);
  // Going back takes this screen out of view at once, while it stays mounted until the transition has
  // finished. A save that ends in that moment belongs to the backup screen now in view (2026-09-15).
  const { inView } = useViewPresence(navigation);
  return (
    <TransferScreen
      onBack={() => navigation.goBack()}
      controller={transferController}
      backups={backups}
      // Opened from the backup screen, which is where a backup is made.
      onOpenBackup={() => navigation.goBack()}
      onOpenReceive={() => navigation.navigate('TransferReceive')}
      onBackupsStale={readBackups}
      inView={inView}
    />
  );
}

/**
 * Receiving on a phone that already has its archive (031 R10): the first run's receiving screen,
 * opened from the transfer screen's row. Nothing to send from here, so no backups are read.
 */
export function TransferReceiveRoute({
  navigation,
}: Readonly<NativeStackScreenProps<RootStackParamList, 'TransferReceive'>>) {
  // As on the transfer screen: a save that ends while this screen is going away is the next one's.
  const { inView } = useViewPresence(navigation);
  return (
    <TransferScreen
      receiveOnly
      onBack={() => navigation.goBack()}
      controller={transferController}
      backups={null}
      inView={inView}
    />
  );
}
