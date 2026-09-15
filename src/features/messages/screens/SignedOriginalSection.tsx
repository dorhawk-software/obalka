// A message's signed original on the detail screen (004 amendment, 2026-09-14).
//
// One row under the attachments, in the attachment row's own metrics so the two read as one list: the
// .zfo when it is on the phone (open it, or save it where no app can), an offer to fetch it while ISDS
// may still hold it, or a plain statement that it cannot be had any more. What ISDS still holds is
// decided in `signedOriginal.ts`, never here.
//
// Nothing moves while something is in flight (constitution V). The caption is reserved at two lines
// and the trailing slot at 24dp, so a spinner, an error or a finished fetch changes what is inside
// them and not where anything else on the screen sits.

import { useEffect, useRef, useState } from 'react';
import { AppState, useWindowDimensions } from 'react-native';
// gesture-handler's Pressable, as the attachment rows use: a plain onPress can keep the JS touch
// responder across the hop to an external viewer and freeze the whole screen on return.
import { Pressable as GHPressable } from 'react-native-gesture-handler';
import { Spinner, XStack, YStack } from '../../../theme/ui';
import { Caption, Heading, Value } from '../../../theme/Typography';
import { Dialog } from '../../../theme/Dialog';
import { useTheme } from '../../../theme/ThemeProvider';
import {
  CheckIcon,
  DownloadIcon,
  FileXIcon,
  ShieldKeyIcon,
} from '../../../theme/icons';
import { t } from '../../../i18n/strings';
import { haptics } from '../../../services/haptics';
import { useSingleFlight } from '../../../app/useSingleFlight';
import { useAfterPressSettles } from '../../../app/useAfterPressSettles';
import { reportFailure } from '../../../services/telemetry/telemetry';
import { attachmentFileStore } from '../../../services/files/attachmentFileStore';
import {
  attachmentOpener,
  openSignedOriginal,
} from '../../../services/files/attachmentOpener';
import type {
  DataBoxAccount,
  MessageDetail,
  MessageEnvelope,
  SignedOriginal,
} from '../../../services/isds/types';
import type { MessageFolder } from '../../../services/db/messagesStore';
import { messagesController } from '../../accounts/deps';
import { reauthKey } from '../../accounts/state/reauthCopy';
import {
  signedOriginalAvailability,
  signedOriginalRow,
  type SignedOriginalRow,
} from '../state/signedOriginal';

/** The caption's line height, as the attachment rows' 12pt caption sets it. */
const CAPTION_LINE = 16;
/** Lines the caption reserves, so a note, a long error and a file name all fit the same row. */
const CAPTION_LINES = 2;

/** The caption of a row that is not showing an error. */
export function signedOriginalCaption(
  row: SignedOriginalRow,
  formatSize: (bytes: number) => string,
): string {
  switch (row.kind) {
    case 'stored':
      return `${row.original.fileName} · ${formatSize(row.original.size)}`;
    case 'fetch':
      if (row.missing) {
        return row.late
          ? t('detail.original.fetch.missingLate')
          : t('detail.original.fetch.missing');
      }
      return row.late ? t('detail.original.fetch.late') : t('detail.original.fetch.note');
    case 'unavailable':
      return row.missing
        ? t('detail.original.unavailable.missing')
        : t('detail.original.unavailable.note');
  }
}

export interface SignedOriginalSectionProps {
  readonly account: DataBoxAccount;
  readonly messageId: string;
  readonly folder: MessageFolder;
  readonly envelope: MessageEnvelope;
  /** What the cached detail records, or null. */
  readonly original: SignedOriginal | null;
  /** The detail's `attachmentsUnavailable`: ISDS has confirmed the message gone. */
  readonly unavailable: boolean;
  readonly formatSize: (bytes: number) => string;
  /** A fetch changed the cached detail: an original recorded, or the message recorded as gone. */
  readonly onChange: (detail: MessageDetail) => void;
}

export function SignedOriginalSection({
  account,
  messageId,
  folder,
  envelope,
  original,
  unavailable,
  formatSize,
  onChange,
}: SignedOriginalSectionProps) {
  const theme = useTheme();
  const { fontScale } = useWindowDimensions();
  const [missing, setMissing] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alert, setAlert] = useState<string | null>(null);
  const inFlight = useRef<AbortController | null>(null);
  // One fetch and one viewer per tap (audit 2026-09-23). `fetching` and `opening` draw the row, but
  // they are state and land a render late: a double tap got past them and launched the viewer twice,
  // or started a second fetch that aborted the first. Two guards, because only the viewer's is let go
  // on the way back from it (see below) - a fetch is still running then.
  const fetchOnce = useSingleFlight();
  const openOnce = useSingleFlight();
  const afterPressSettles = useAfterPressSettles();

  // An error belongs to the record it was about. When the record changes under it - the whole message
  // downloaded again from the button above, bringing its original - a caption still saying the fetch
  // failed would sit in red under an original that is right there.
  useEffect(() => {
    setError(null);
  }, [original, unavailable]);

  // A file can vanish independently of the database, so the record is checked against the disk
  // whenever it changes - the attachments are checked the same way.
  useEffect(() => {
    if (original == null) {
      setMissing(false);
      return;
    }
    let cancelled = false;
    attachmentFileStore.exists(original.localPath).then(
      present => {
        if (!cancelled) {
          setMissing(!present);
        }
      },
      () => {
        if (!cancelled) {
          setMissing(true);
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [original]);

  useEffect(() => () => inFlight.current?.abort(), []);

  // Back from the viewer or the save sheet: the row is free again even if that promise is still
  // pending across the hop, as with an attachment row. A fetch is not cleared here - it is still
  // running, and a second tap would start another.
  useEffect(() => {
    const sub = AppState.addEventListener('change', next => {
      if (next === 'active') {
        setOpening(false);
        openOnce.release();
      }
    });
    return () => sub.remove();
  }, [openOnce]);

  const row = signedOriginalRow(
    original ?? undefined,
    missing,
    signedOriginalAvailability(envelope, { attachmentsUnavailable: unavailable }, Date.now()),
  );

  // Only ever on the user's tap: opening the message fetched nothing.
  const fetchOriginal = () =>
    fetchOnce(async () => {
      if (fetching || opening) {
        return;
      }
      haptics.selection();
      setFetching(true);
      setError(null);
      inFlight.current?.abort();
      const ctrl = new AbortController();
      inFlight.current = ctrl;
      const outcome = await messagesController.fetchSignedOriginal(
        account,
        messageId,
        folder,
        ctrl.signal,
      );
      if (ctrl.signal.aborted) {
        return;
      }
      setFetching(false);
      if (outcome.kind === 'saved' || outcome.kind === 'gone') {
        setMissing(false);
        onChange(outcome.detail);
      } else if (outcome.kind === 'reauth') {
        setError(t(reauthKey(account, 'messages.reauth', 'messages.reauth.credentials')));
      } else {
        setError(t(outcome.messageKey));
      }
    });

  const openOriginal = (stored: SignedOriginal) => {
    if (fetching) {
      return;
    }
    void openOnce(async () => {
      haptics.selection();
      setOpening(true);
      // After the press settles, for the reason the attachment row gives: an external activity
      // launched mid-press can leave the touch responder held across the hop.
      await new Promise<void>(launched => {
        afterPressSettles(async () => {
          try {
            await openSignedOriginal(attachmentOpener, stored);
          } catch (e) {
            reportFailure('file.open', e, { stage: 'native' });
            setAlert(t('detail.original.openError'));
          } finally {
            setOpening(false);
            launched();
          }
        });
      });
    });
  };

  const busy = fetching || opening;
  const title =
    row.kind === 'stored'
      ? t('detail.original.stored')
      : row.kind === 'fetch'
      ? t('detail.original.fetch')
      : t('detail.original.unavailable');
  const caption = error ?? signedOriginalCaption(row, formatSize);

  const body = (
    <XStack
      alignItems="center"
      gap={12}
      paddingVertical={11}
      paddingHorizontal={13}
      backgroundColor={theme.surface}
      borderWidth={1}
      borderColor={theme.border}
      borderRadius={14}
    >
      <YStack
        width={40}
        minHeight={40}
        borderRadius={11}
        backgroundColor={theme.surfaceSunken}
        alignItems="center"
        justifyContent="center"
      >
        {row.kind === 'unavailable' ? (
          <FileXIcon size={20} color={theme.textFaint} />
        ) : (
          <ShieldKeyIcon size={19} color={theme.textMuted} />
        )}
      </YStack>
      <YStack flex={1} minWidth={0}>
        <Value
          color={row.kind === 'unavailable' ? theme.textMuted : theme.text}
          numberOfLines={1}
        >
          {title}
        </Value>
        <Caption
          fontSize={12}
          lineHeight={CAPTION_LINE}
          // Two lines, at the reader's text size: RN scales the line height with the system font and
          // leaves a dp minHeight alone, so a bare 32 would let a one-line caption turning into a
          // two-line error grow the row at any size but the default (constitution V).
          minHeight={CAPTION_LINES * CAPTION_LINE * fontScale}
          marginTop={1}
          color={error ? theme.danger : theme.textFaint}
          numberOfLines={2}
        >
          {caption}
        </Caption>
      </YStack>
      <XStack width={24} height={24} flexShrink={0} alignItems="center" justifyContent="center">
        {busy ? (
          <Spinner size="small" color={theme.blue} />
        ) : row.kind === 'stored' ? (
          <CheckIcon size={15} color={theme.success} />
        ) : row.kind === 'fetch' ? (
          <DownloadIcon size={17} color={theme.blue} />
        ) : null}
      </XStack>
    </XStack>
  );

  return (
    <>
      <XStack marginTop={22} alignItems="center" gap={7}>
        <Heading fontSize={15} color={theme.text}>
          {t('detail.original.heading')}
        </Heading>
      </XStack>
      <YStack marginTop={10}>
        {row.kind === 'unavailable' ? (
          <YStack accessible accessibilityLabel={`${title}. ${caption}`} testID="signed-original">
            {body}
          </YStack>
        ) : (
          <GHPressable
            onPress={() => {
              if (row.kind === 'stored') {
                openOriginal(row.original);
              } else {
                void fetchOriginal();
              }
            }}
            accessibilityRole="button"
            accessibilityLabel={
              row.kind === 'stored'
                ? t('detail.original.open', { name: row.original.fileName })
                : title
            }
            accessibilityHint={caption}
            accessibilityState={{ busy }}
            testID="signed-original"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            {body}
          </GHPressable>
        )}
      </YStack>
      {alert ? (
        <Dialog
          title={t('detail.original.heading')}
          body={alert}
          onDismiss={() => setAlert(null)}
          testID="signed-original-alert"
          actions={[
            {
              label: t('common.ok'),
              tone: 'primary',
              testID: 'signed-original-alert-ok',
              onPress: () => setAlert(null),
            },
          ]}
        />
      ) : null}
    </>
  );
}
