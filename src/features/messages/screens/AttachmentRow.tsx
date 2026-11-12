// One downloaded attachment on a message, and the dialog that says why it would not open
// (split out of MessageDetail.tsx on 2026-11-12, when the dialog learnt to close with the app).

import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { Pressable as GHPressable } from 'react-native-gesture-handler';
import { Spinner, XStack, YStack } from '../../../theme/ui';
import { Dialog } from '../../../theme/Dialog';
import { Card } from '../../../theme/Card';
import { Caption, Meta, Value } from '../../../theme/Typography';
import { useTheme } from '../../../theme/ThemeProvider';
import { AlertIcon, CheckIcon, FileIcon } from '../../../theme/icons';
import { haptics } from '../../../services/haptics';
import { useSingleFlight } from '../../../app/useSingleFlight';
import { useAfterPressSettles } from '../../../app/useAfterPressSettles';
import { useCloseOnBackground } from '../../../app/useCloseOnBackground';
import { t } from '../../../i18n/strings';
import type { MessageAttachment } from '../../../services/isds/types';
import { attachmentOpener, NoViewerError } from '../../../services/files/attachmentOpener';

/** Human file size: B / kB / MB (Czech comma decimal for MB). From the on-disk byte count. */
export function formatBytes(n: number): string {
  if (n < 1024) {
    return `${n} B`;
  }
  if (n < 1024 * 1024) {
    return `${Math.round(n / 1024)} kB`;
  }
  return `${(n / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}


/**
 * A downloaded attachment row - its content is cached, so it opens offline. Tap → write to a file and
 * open in the OS viewer. The ✓ marks it as saved offline.
 */
export function AttachmentRow({
  attachment,
  index,
  missing,
}: {
  readonly attachment: MessageAttachment;
  readonly index: number;
  /** The on-disk file is gone - show it as missing, don't try to open it. */
  readonly missing: boolean;
}) {
  const theme = useTheme();
  const [opening, setOpening] = useState(false);
  /**
   * One viewer per tap (audit 2026-09-23). `opening` dims the row and says "Otevírání…", but it is
   * state and lands a render late: a double tap got past it and launched the viewer twice.
   */
  const openOnce = useSingleFlight();
  const afterPressSettles = useAfterPressSettles();
  /** Why an attachment would not open. The app's own dialog, never the OS alert (theme/Dialog). */
  const [attachmentAlert, setAttachmentAlert] = useState<string | null>(null);
  // An RN Modal draws above the lock cover: a dialog the person opened closes as the app leaves.
  useCloseOnBackground(useCallback(() => setAttachmentAlert(null), []));
  const size = attachment.size != null ? formatBytes(attachment.size) : '';
  // No file path on a downloaded attachment ⇒ it couldn't be decoded/saved (malformed data). Like a
  // missing file it can't be opened, but it's not recoverable by re-download - show it as such.
  const corrupt = !missing && !attachment.localPath;
  const blocked = missing || corrupt;

  // Returning from the external viewer always clears the "opening" flag so the attachment can be
  // reopened - even if the open() promise is still pending across the background→foreground hop
  // (otherwise the row stays stuck "opening" and the guard below blocks every later tap).
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        setOpening(false);
        openOnce.release();
      }
    });
    return () => sub.remove();
  }, [openOnce]);

  const open = () => {
    void openOnce(async () => {
      haptics.selection(); // a light tick on opening an attachment
      setOpening(true);
      // Defer the launch until AFTER the press interaction settles. Launching an external activity
      // mid-press can leave RN's JS touch responder held by this row across the app backgrounding;
      // on return it's never released, which freezes touches across the WHOLE screen (incl. Back).
      // Waiting for the queued work lets the press release (onPressOut) before we background.
      await new Promise<void>(launched => {
        afterPressSettles(async () => {
          try {
            await attachmentOpener.open(attachment);
          } catch (e) {
            const key =
              e instanceof NoViewerError
                ? 'detail.attachment.noViewer'
                : 'detail.attachment.openError';
            setAttachmentAlert(t(key));
          } finally {
            setOpening(false);
            launched();
          }
        });
      });
    });
  };

  return (
    <>
    <GHPressable
      onPress={() => {
        if (!blocked) {
          open(); // a missing/undecodable file can't be opened
        }
      }}
      accessibilityRole="button"
      accessibilityLabel={t('detail.attachment.open', {
        name: attachment.name,
      })}
      testID={`attachment-${index}`}
      style={({ pressed }) => ({ opacity: pressed && !blocked ? 0.7 : 1 })}
    >
      <Card flexDirection="row"
        alignItems="center"
        gap={12}
        paddingVertical={12}
        paddingHorizontal={13}
      >
        {/* A NEUTRAL tile (design §detail attachments): a sunken square with a quiet file glyph - no
            per-extension colour fill, no extension label. Only the blocked state colours it. */}
        <YStack
          width={40}
          minHeight={40}
          borderRadius={11}
          backgroundColor={theme.surfaceSunken}
          alignItems="center"
          justifyContent="center"
        >
          {blocked ? (
            <AlertIcon size={20} color={theme.danger} />
          ) : (
            <FileIcon size={19} color={theme.textMuted} />
          )}
        </YStack>
        <YStack flex={1} minWidth={0}>
          <Value color={theme.text} numberOfLines={1}>
            {attachment.name || '—'}
          </Value>
          {blocked ? (
            <Caption color={theme.danger} numberOfLines={1}>
              {missing
                ? t('detail.attachment.missing')
                : t('detail.attachment.corrupt')}
            </Caption>
          ) : (
            // The sub-line carries the size only - the "saved offline" mark lives on the right (design).
            <Meta
              color={theme.textFaint}
              numberOfLines={1}
            >
              {opening ? t('detail.attachment.opening') : size}
            </Meta>
          )}
        </YStack>
        {blocked ? null : opening ? (
          <Spinner size="small" color={theme.blue} />
        ) : (
          <XStack alignItems="center" gap={4} flexShrink={0}>
            <CheckIcon size={15} color={theme.success} />
            <Meta fontWeight="700" color={theme.success}>
              {t('detail.attachment.savedOffline')}
            </Meta>
          </XStack>
        )}
      </Card>
    </GHPressable>
    {attachmentAlert ? (
      <Dialog
        title={t('detail.attachments')}
        body={attachmentAlert}
        onDismiss={() => setAttachmentAlert(null)}
        testID="attachment-alert"
        actions={[
          {
            label: t('common.ok'),
            tone: 'primary',
            testID: 'attachment-alert-ok',
            onPress: () => setAttachmentAlert(null),
          },
        ]}
      />
    ) : null}
    </>
  );
}
