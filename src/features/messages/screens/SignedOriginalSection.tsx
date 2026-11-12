// A message's signed original on the detail screen (004 amendment, 2026-09-14).
//
// One row in the attachments' list, in the attachment row's own metrics so the two read as one list
// (031, board Message: the seal in a well, "Podepsaný originál", "Soubor ZFO s elektronickou pečetí"):
// the .zfo when it is on the phone (open it, or save a copy from its download glyph), an offer to fetch
// it while ISDS may still hold it, or a plain statement that it cannot be had any more. What ISDS still holds is
// decided in `signedOriginal.ts`, never here.
//
// Nothing moves while something is in flight (constitution V). An offer to fetch reserves its caption
// at two lines and the trailing slot is 44dp, so a spinner or an error changes what is inside them
// and not where anything else on the screen sits. A stored original reserves one line (2026-11-11,
// reported from a phone: two lines for its one-line file name made it taller than the attachment rows
// above it, which it is meant to match): nothing it shows can grow - an open that fails says so in a
// dialog - and the one change of height, a finished fetch, is the user's own command and moves
// nothing, the row being the last thing on the screen.

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, useWindowDimensions } from 'react-native';
// gesture-handler's Pressable, as the attachment rows use: a plain onPress can keep the JS touch
// responder across the hop to an external viewer and freeze the whole screen on return.
import { Pressable as GHPressable } from 'react-native-gesture-handler';
import { Spinner, XStack, YStack } from '../../../theme/ui';
import { Caption, SmallStrong } from '../../../theme/Typography';
import { Dialog } from '../../../theme/Dialog';
import { useTheme } from '../../../theme/ThemeProvider';
import { FileXIcon } from '../../../theme/icons';
import { OffsetIcon } from '../../../theme/offsetIcons';
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
import {
  ZFO_MIME_TYPE,
  type DataBoxAccount,
  type MessageDetail,
  type MessageEnvelope,
  type SignedOriginal,
} from '../../../services/isds/types';
import type { MessageFolder } from '../../../services/db/messagesStore';
import { messagesController } from '../../accounts/deps';
import { reauthKey } from '../../accounts/state/reauthCopy';
import {
  signedOriginalAvailability,
  signedOriginalRow,
  type SignedOriginalRow,
} from '../state/signedOriginal';
import { useCloseOnBackground } from '../../../app/useCloseOnBackground';

/** The caption's line height, as the attachment rows' 13pt caption sets it. */
const CAPTION_LINE = 17;
/** Lines an offer's caption reserves, so its note and a long error fit the same row. */
const CAPTION_LINES = 2;

/** The caption of a row that is not showing an error. */
export function signedOriginalCaption(row: SignedOriginalRow): string {
  switch (row.kind) {
    case 'stored':
      // What it is, as the board says it; its file name is in the save sheet, its size is small.
      return t('detail.original.stored.note');
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
  onChange,
}: SignedOriginalSectionProps) {
  const theme = useTheme();
  const { fontScale } = useWindowDimensions();
  const [missing, setMissing] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alert, setAlert] = useState<string | null>(null);
  // An RN Modal draws above the lock cover: a dialog the person opened closes as the app leaves.
  useCloseOnBackground(useCallback(() => setAlert(null), []));
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
  const caption = error ?? signedOriginalCaption(row);
  const captionLines = row.kind === 'stored' && error == null ? 1 : CAPTION_LINES;

  // The well and the words: the part of the row that opens, fetches or just states.
  const main = (
    <XStack flex={1} alignItems="center" gap={12} minHeight={52}>
      <YStack
        width={40}
        height={40}
        borderRadius={12}
        backgroundColor={theme.surfaceSunken}
        alignItems="center"
        justifyContent="center"
      >
        {row.kind === 'unavailable' ? (
          <FileXIcon size={20} color={theme.textFaint} />
        ) : (
          <OffsetIcon name="seal" size={24} color={theme.text} />
        )}
      </YStack>
      <YStack flex={1} minWidth={0}>
        <SmallStrong color={row.kind === 'unavailable' ? theme.textMuted : theme.text} numberOfLines={1}>
          {title}
        </SmallStrong>
        <Caption
          fontWeight="400"
          // Two lines, at the reader's text size: RN scales the line height with the system font and
          // leaves a dp minHeight alone, so a bare 34 would let a one-line caption turning into a
          // two-line error grow the row at any size but the default (constitution V).
          minHeight={captionLines * CAPTION_LINE * fontScale}
          color={error ? theme.danger : theme.textMuted}
          numberOfLines={captionLines}
        >
          {caption}
        </Caption>
      </YStack>
    </XStack>
  );

  /** A copy of the stored original where the person chooses; the archive keeps its own. */
  const saveOriginal = (stored: SignedOriginal) => {
    if (fetching) {
      return;
    }
    void openOnce(async () => {
      haptics.selection();
      await new Promise<void>(done => {
        afterPressSettles(async () => {
          try {
            await attachmentOpener.save(stored.localPath, stored.fileName, ZFO_MIME_TYPE);
          } catch (e) {
            reportFailure('file.write', e, { stage: 'native' });
            setAlert(t('detail.original.writeFailed'));
          } finally {
            done();
          }
        });
      });
    });
  };

  // The trailing slot, 44 wide whatever it holds, so nothing moves when a spinner takes its place.
  const trailing = busy ? (
    <XStack width={44} height={44} marginRight={-10} alignItems="center" justifyContent="center">
      <Spinner size="small" color={theme.blue} />
    </XStack>
  ) : row.kind === 'unavailable' ? null : (
    <XStack
      width={44}
      height={44}
      marginRight={-10}
      alignItems="center"
      justifyContent="center"
      pressStyle={{ opacity: 0.5 }}
      onPress={() => {
        if (row.kind === 'stored') {
          saveOriginal(row.original);
        } else {
          void fetchOriginal();
        }
      }}
      accessibilityRole="button"
      accessibilityLabel={row.kind === 'stored' ? t('detail.original.save') : title}
      testID="signed-original-download"
    >
      <OffsetIcon name="download" size={20} color={theme.blue} />
    </XStack>
  );

  return (
    <>
      <XStack marginTop={8} alignItems="center" gap={12}>
        {row.kind === 'unavailable' ? (
          <YStack flex={1} accessible accessibilityLabel={`${title}. ${caption}`} testID="signed-original">
            {main}
          </YStack>
        ) : (
          // Siblings, not nested, as in the attachment row: a press inside the gesture-handler
          // Pressable could fire both.
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
            style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.7 : 1 })}
          >
            {main}
          </GHPressable>
        )}
        {trailing}
      </XStack>
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
