// Telling the user why every box asks to sign in again (001 T028, research R6b).
//
// When the phone invalidates the vault key - the screen lock removed, and on some phones a change of
// fingerprints or face - every sealed password and session stops opening at once, and each box goes
// to re-authentication the way any refused box does. Without a word that looks like the app having
// forgotten everything; with one it is a consequence of a security setting, and the archive is fine.
//
// Once per launch at most: the store fires for the first lost read and again for each until this is
// acknowledged, so a refresh of four boxes is one dialog, not four.
//
// Never over the lock screen, and never while the app is in the background (`useAppCovered`). The loss
// is found by the first secret read after an unlock, which lands while the lock cover still holds for
// the OS success animation - and an RN Modal draws above that cover. Held back rather than dismissed:
// the explanation is still owed once the app is really open.

import { useEffect, useState } from 'react';
import { Dialog } from '../../theme/Dialog';
import { t } from '../../i18n/strings';
import { useAppCovered } from './LockGate';

/** The slice of `VaultSecureStore` the notice listens to. */
export interface LostSecretsSource {
  subscribeLost(listener: () => void): () => void;
  acknowledgeLost(): void;
}

export function VaultLostNotice({ source }: { readonly source: LostSecretsSource }) {
  const [shown, setShown] = useState(false);
  const covered = useAppCovered();

  useEffect(() => source.subscribeLost(() => setShown(true)), [source]);

  if (!shown || covered) {
    return null;
  }
  const dismiss = () => {
    source.acknowledgeLost();
    setShown(false);
  };
  return (
    <Dialog
      title={t('vault.lost.title')}
      body={t('vault.lost.body')}
      onDismiss={dismiss}
      testID="vault-lost-dialog"
      actions={[
        {
          label: t('common.ok'),
          tone: 'primary',
          testID: 'vault-lost-ok',
          onPress: dismiss,
        },
      ]}
    />
  );
}
