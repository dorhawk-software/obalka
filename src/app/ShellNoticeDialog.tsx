// A box's removal or renaming that did not finish, said once as a question (R9's anatomy), out of
// AppShell.tsx (its size limit, 031 T050.7). The shell decides what a retry does.

import { Dialog } from '../theme/Dialog';
import { t } from '../i18n/strings';
import type { ShellNotice } from './shellNotices';

export function ShellNoticeDialog({
  notice,
  onClose,
  onRetry,
}: {
  readonly notice: ShellNotice;
  readonly onClose: (notice: ShellNotice) => void;
  readonly onRetry: (notice: ShellNotice) => void;
}) {
  if (notice.kind === 'removal') {
    return (
      <Dialog
        testID="removeFailed"
        glyph="boxes"
        title={t('box.removeFailed.title')}
        subtitle={notice.name ?? undefined}
        body={
          notice.notice === 'kept'
            ? t('box.removeFailed.kept')
            : notice.notice === 'incomplete'
            ? t('box.removeFailed.incomplete')
            : t('box.removeFailed.unknown')
        }
        onDismiss={() => onClose(notice)}
        actions={[
          {
            bare: 'way out',
            label: t('box.removeFailed.close'),
            onPress: () => onClose(notice),
            testID: 'removeFailedClose',
          },
          {
            glyph: 'retry',
            label: t('box.removeFailed.retry'),
            onPress: () => onRetry(notice),
            tone: 'primary',
            testID: 'removeFailedRetry',
          },
        ]}
      />
    );
  }
  return (
    <Dialog
      testID="aliasFailed"
      glyph="boxes"
      title={t('box.aliasFailed.title')}
      subtitle={notice.name ?? undefined}
      body={t('box.aliasFailed.body')}
      onDismiss={() => onClose(notice)}
      actions={[
        {
          bare: 'way out',
          label: t('box.aliasFailed.close'),
          onPress: () => onClose(notice),
          testID: 'aliasFailedClose',
        },
        {
          glyph: 'retry',
          label: t('box.aliasFailed.retry'),
          onPress: () => onRetry(notice),
          tone: 'primary',
          testID: 'aliasFailedRetry',
        },
      ]}
    />
  );
}
