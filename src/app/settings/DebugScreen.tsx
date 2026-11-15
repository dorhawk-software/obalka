// Debug mode (023). The screen where somebody decides to record their own mail to a file.
//
// The design problem here is not layout, it is CONSENT. Two things have to be true at the same time:
// the feature must be useful enough to fix a bug that a Sentry report cannot (which means the Full
// level has to exist and has to carry the ISDS traffic), and the person tapping the button has to
// understand what they are about to make. So the level is chosen BEFORE recording starts, each
// option states in one sentence what ends up in the file, and the sentence about credentials sits
// under both because it is the one guarantee that never varies.
//
// Nothing on this screen uploads anything. `Sdílet` opens the OS share sheet and the app never
// learns where the file went - see `services/debug/debugStore.ts`, and the structural test that
// keeps it that way.
//
// Every spacing on this screen is a DESIGN.md step, named through `space`. Until 2026-09-15 the screen
// typed a 9 gap, 20 and 22 margins and 12pt captions of its own.
//
// As board R13 draws it (031 I47, agreed 2026-11-12): the intro in body text, the level as one sheet of
// choices with its two notes as meta lines under it, and the start as the filled button. While
// recording, one card holds the dot and the counter, the hint, the stop and the discard, and the
// choices above it are dimmed, since they cannot change then. The saved notice and the files are in
// `DebugFiles.tsx`.

import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, useWindowDimensions } from 'react-native';
import { XStack, YStack } from '../../theme/ui';
import { Caption, Meta, Small, SmallStrong } from '../../theme/Typography';
import { InkButton } from '../../theme/InkButton';
import { NeutralButton } from '../../theme/NeutralButton';
import { OptionGroup } from '../../theme/OptionGroup';
import { Dialog } from '../../theme/Dialog';
import { TrashIcon } from '../../theme/icons';
import { useTheme } from '../../theme/ThemeProvider';
import { space } from '../../theme/spacing';
import { type as typeScale } from '../../theme/typeScale';
import { formatBytes, plural, t } from '../../i18n/strings';
import { haptics } from '../../services/haptics';
import { SubScreen } from './SubScreen';
import { Card, Section } from './SettingsSection';
import { NoticeStrip, SavedFilesSection, savedFilesError, type Notice, type SavedFiles } from './DebugFiles';
import { RecordingDot, useDebugRecording } from '../DebugRecordingStrip';
import {
  cancelDebug,
  debugSaveInFlight,
  startDebug,
  stopDebugAndWrite,
  type StoppedBundle,
} from '../../services/debug/debugController';
import {
  debugStatus,
  MAX_BYTES,
  MAX_ENTRIES,
  type DebugLevel,
} from '../../services/debug/debugLog';
import { deleteBundle, listBundles, shareBundle, type SavedBundle } from '../../services/debug/debugStore';
import { useCloseOnBackground } from '../useCloseOnBackground';

const MIB = 1024 * 1024;

/** The status line while recording: "Zaznamenává se · 2 záznamy · 1 kB". */
export function recordingCounter(entries: number, bytes: number): string {
  const counted = t(`debug.recording.entries.${plural(entries)}`, { n: entries });
  return `${t('debug.recording')} · ${counted} · ${formatBytes(bytes)}`;
}

/**
 * A number one character longer than any the counter can show, in the widest digit Public Sans has.
 * The counter's numbers run to four characters - `MAX_ENTRIES` entries, "1024" in front of a kB, "4.0"
 * in front of an MB under `MAX_BYTES` - and its digits are not equally wide: an 8 is wider than a 1 in
 * every Public Sans face, so "3888" is wider than "4000". The fifth character is margin against the kerning and
 * hinting that the measurement behind this leaves out.
 */
const RESERVE_NUMBER = '8'.repeat(
  1 + Math.max(String(MAX_ENTRIES).length, String(1024).length, (MAX_BYTES / MIB).toFixed(1).length),
);

/**
 * The counter the recording line reserves room for: word for word at least as wide as any counter the
 * recorder can reach - the widest number above, the count's widest plural form, which is the one that
 * number takes, and the widest unit, "MB". `__tests__/app/debugCounterReserve.test.ts` measures that
 * claim from the bundled font, in both languages, for every count and size under the caps.
 */
export function recordingCounterReserve(): string {
  const counted = t(`debug.recording.entries.${plural(Number(RESERVE_NUMBER))}`, {
    n: RESERVE_NUMBER,
  });
  return `${t('debug.recording')} · ${counted} · ${RESERVE_NUMBER}\u00A0MB`;
}

/** The counter's line box at the default text size: the SmallStrong role, DESIGN.md 14/20. */
const COUNTER_LINE = typeScale.smallStrong.lineHeight;

export function DebugScreen({ onBack }: { readonly onBack: () => void }) {
  const theme = useTheme();
  const { fontScale } = useWindowDimensions();
  const [level, setLevel] = useState<DebugLevel>('standard');
  // The recorder's own state, as it announces it - what the strip on every other screen reads. A copy
  // kept here went on saying "Zaznamenává se" through the whole save, over a recorder that stopped at
  // the press and a strip that had already gone from every other screen, and then took the recording
  // controls away when the save ended, moving everything under them at a moment nobody chose.
  const recording = useDebugRecording();
  const [entries, setEntries] = useState(0);
  const [bytes, setBytes] = useState(0);
  const [saved, setSaved] = useState<SavedFiles>({ status: 'loading' });
  // A read of the folder is out, and "Zkusit znovu" is busy for as long as one is - not only while the
  // read its own press began is out. A save that ends meanwhile reads the folder again, and the press's
  // read, answering first, handed the button back idle over the newer read (review, 2026-09-15). The
  // newest read always ends, within `LIST_TIMEOUT_MS`, so the button cannot stay busy.
  const [reading, setReading] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [pendingDelete, setPendingDelete] = useState<SavedBundle | null>(null);
  // An RN Modal draws above the lock cover: a dialog the person opened closes as the app leaves.
  useCloseOnBackground(useCallback(() => setPendingDelete(null), []));
  // True while a stopped recording is being written. The archive is built in slices that keep the app
  // answering (Principle I), so a press can now arrive mid-write - on this screen, or on this screen
  // opened again after someone left it during the save. Either way the buttons say so and wait.
  const [saving, setSaving] = useState(() => debugSaveInFlight() !== null);
  // The notice strip's room, held from the press that starts a save - so the save's end, at a moment
  // nobody picks, only fills it (constitution V) - until a new recording starts or one is thrown away,
  // which are presses of their own. A notice from a share or a delete brings the strip with it.
  const [held, setHeld] = useState(saving);
  // Reads of the folder can overlap - the one this screen opens with, and the one after a save that
  // ends straight away - and the older one can answer last. Only the newest read says what is in the
  // folder, or the file a save just wrote could drop out of the list again.
  const lastRead = useRef(0);

  const refresh = useCallback(async () => {
    lastRead.current += 1;
    const read = lastRead.current;
    setReading(true);
    // Constitution II: a folder that could not be read is not a folder with nothing in it. It used to be
    // shown as one - "Zatím tu nic není." over files that were there - with no way to try again. A read
    // that does not answer ends here too, after `LIST_TIMEOUT_MS`; it used to leave the row blank for as
    // long as the screen stayed open.
    const bundles = await listBundles().catch(() => null);
    if (read === lastRead.current) {
      setReading(false);
      setSaved(previous =>
        bundles == null
          ? {
              status: 'failed',
              attempts: previous.status === 'failed' ? previous.attempts + 1 : 1,
            }
          : { status: 'ready', bundles },
      );
    }
  }, []);

  /** A save, followed to its outcome: the file it wrote, or that it could not be written. */
  const follow = useCallback(
    async (save: Promise<StoppedBundle>) => {
      setSaving(true);
      setHeld(true);
      try {
        const done = await save;
        setNotice({
          text: t('debug.savedNotice').replace('{name}', done.path.split('/').pop() ?? ''),
          tone: 'saved',
        });
        await refresh();
      } catch {
        // Principle II: the recording is lost, the screen is not. The buffer is cleared either way.
        setNotice({ text: t('debug.error'), tone: 'failed' });
      } finally {
        setSaving(false);
      }
    },
    [refresh],
  );

  // A save that began before this screen opened - stop pressed, then back - is still this screen's to
  // report. Without it the screen offered "Spustit záznam" over a save still running and never said
  // how that save ended, and the bundle list stayed without the file until the screen was reopened.
  useEffect(() => {
    const inFlight = debugSaveInFlight();
    if (inFlight) {
      void follow(inFlight);
    }
  }, [follow]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // A notice arrives when nobody is looking for it - a save ends, a share sheet does not open - so a
  // screen reader has to be told. On Android the notice is a live region (below), and TalkBack reads
  // it whenever its words change; React Native has no live regions on iOS, so VoiceOver is told here.
  // Never both: announcing on Android as well would have TalkBack read every notice twice.
  useEffect(() => {
    if (notice != null && Platform.OS === 'ios') {
      AccessibilityInfo.announceForAccessibility(notice.text);
    }
  }, [notice]);

  // The counter while recording. A second is the right cadence for a number a person is watching to
  // decide "have I done the broken thing yet"; it is also cheap, since it reads two integers.
  useEffect(() => {
    if (!recording) {
      return;
    }
    const tick = () => {
      const status = debugStatus();
      setEntries(status.entries);
      setBytes(status.bytes);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [recording]);

  const onStart = useCallback(() => {
    haptics.selection();
    startDebug(level);
    setNotice(null);
    setHeld(false);
  }, [level]);

  const onStop = useCallback(() => follow(stopDebugAndWrite()), [follow]);

  const onDiscard = useCallback(() => {
    cancelDebug();
    setNotice(null);
    setHeld(false);
  }, []);

  const onShare = useCallback(async (bundle: SavedBundle) => {
    try {
      await shareBundle(bundle.path, t('debug.shareTitle'));
    } catch {
      setNotice({ text: t('debug.shareError'), tone: 'failed' });
    }
  }, []);

  // A delete that did not happen says so (constitution II). The folder is read again either way, so the
  // list shows what is really there; a row that just stayed put after "Smazat" looked like a missed tap.
  const onDelete = useCallback(
    async (bundle: SavedBundle) => {
      try {
        await deleteBundle(bundle.path);
      } catch {
        setNotice({ text: t('debug.deleteError'), tone: 'failed' });
      }
      await refresh();
    },
    [refresh],
  );

  // What the saved files' row says after a failed read, in new words each time one fails again. They
  // arrive when a read ends, which nobody is watching for, so a screen reader is told: TalkBack by the
  // row's live region (below), VoiceOver here - the notice's split, for the notice's reason.
  // Queued behind what VoiceOver is already saying, never spoken over it. The folder is read again as a
  // save or a delete ends, straight after the notice about that save or delete is announced, and on iOS
  // an announcement cuts off the one before it: a read that failed then would have left the person
  // hearing that the files could not be read, and never that their file was saved (review, 2026-09-15).
  // TalkBack queues a polite live region on its own.
  const failedWords = saved.status === 'failed' ? savedFilesError(saved.attempts) : null;
  useEffect(() => {
    if (failedWords != null && Platform.OS === 'ios') {
      AccessibilityInfo.announceForAccessibilityWithOptions(failedWords, { queue: true });
    }
  }, [failedWords]);

  const strip = held || notice != null ? <NoticeStrip notice={notice} fontScale={fontScale} /> : null;

  return (
    <>
      {pendingDelete ? (
        <Dialog
          title={t('debug.delete.title')}
          subtitle={pendingDelete.name}
          body={t('debug.delete.body')}
          onDismiss={() => setPendingDelete(null)}
          glyph="settings"
          testID="debug-delete-dialog"
          actions={[
            { label: t('common.cancel'), onPress: () => setPendingDelete(null) },
            {
              label: t('debug.delete'),
              tone: 'danger',
              icon: color => <TrashIcon size={18} color={color} />,
              testID: 'debug-delete-confirm',
              onPress: () => {
                const target = pendingDelete;
                setPendingDelete(null);
                void onDelete(target);
              },
            },
          ]}
        />
      ) : null}

      <SubScreen title={t('debug.title')} onBack={onBack} paddingTop={space.inset}>
        <Small color={theme.bodyText} testID="debug-intro">
          {t('debug.intro')}
        </Small>

        {/* The level, and it is only choosable BEFORE recording starts - changing what a bundle
            contains halfway through would produce a file whose manifest lies about it. */}
        <YStack marginTop={space.base}>
          <Section label={t('debug.level')}>
            <YStack
              opacity={recording ? 0.55 : 1}
              // Faded as one picture, as the board's CSS opacity fades it (031 R13, as `CardRow`).
              needsOffscreenAlphaCompositing={recording}
              testID="debug-levels"
            >
              <OptionGroup
                options={[
                  { value: 'standard' as const, label: t('debug.level.standard') },
                  { value: 'full' as const, label: t('debug.level.full') },
                ]}
                value={level}
                onChange={recording ? () => {} : setLevel}
                testIDPrefix="debug-level"
              />
            </YStack>
            <YStack gap={space.sm} marginHorizontal={space.xs}>
              <Meta color={theme.textMuted} testID="debug-level-desc">
                {t(level === 'full' ? 'debug.level.full.desc' : 'debug.level.standard.desc')}
              </Meta>
              {/* Under both options, deliberately: it is the guarantee that does not vary, and it is
                  what makes choosing the detailed level a decision about mail rather than about
                  everything. */}
              <Meta color={theme.textMuted} testID="debug-creds">
                {t('debug.creds')}
              </Meta>
            </YStack>
          </Section>
        </YStack>

        <YStack gap={space.md} marginBottom={space.gutter} testID="debug-controls">
          {/* Only while the recorder runs. It stops at the press on "Ukončit a uložit", so the card goes
              in answer to that press - the mirror of "Spustit záznam" bringing it - and not when the
              save it started ends, long after, under a finger that has moved on. Meanwhile the start
              says the save is running, at the size it always has. */}
          {recording ? (
            <Card testID="debug-recording">
              <YStack padding={space.xl} gap={space.md}>
                <XStack alignItems="flex-start" gap={space.base} testID="debug-status-row">
                  {/* A dot, because a screen that is recording someone's mail should say so at a
                      glance and not only in a sentence. Held to the counter's first line at the
                      reader's text size, however many lines the counter's room below takes. */}
                  <YStack minHeight={COUNTER_LINE * fontScale} justifyContent="center" testID="debug-status-dot">
                    <RecordingDot />
                  </YStack>
                  {/* The counter's words grow while it records - "2 záznamy · 1 kB" to "4000 záznamů ·
                      1024 kB" - and at a larger text size the longer ones take a second line part-way
                      through, which pushed the hint and the buttons under it down (constitution V).
                      So the room is taken by the longest counter the recorder can reach, drawn
                      invisibly at the reader's own text size and width, and the live counter is laid
                      over it, taking no room of its own.
                      Both are broken into lines greedily, at spaces, on both platforms. A reserve that
                      is word for word at least as wide takes at least as many lines only under that
                      breaker, and it is the one `debugCounterReserve.test.ts` measures with. Android's
                      own default (`highQuality`) weighs whole paragraphs and promises no such thing. */}
                  <YStack flex={1}>
                    <SmallStrong
                      opacity={0}
                      textBreakStrategy="simple"
                      lineBreakStrategyIOS="none"
                      accessibilityElementsHidden
                      importantForAccessibility="no-hide-descendants"
                      testID="debug-status-reserve"
                    >
                      {recordingCounterReserve()}
                    </SmallStrong>
                    <SmallStrong
                      position="absolute"
                      top={0}
                      left={0}
                      right={0}
                      textBreakStrategy="simple"
                      lineBreakStrategyIOS="none"
                      color={theme.text}
                      testID="debug-status"
                    >
                      {recordingCounter(entries, bytes)}
                    </SmallStrong>
                  </YStack>
                </XStack>
                <Caption color={theme.textMuted}>{t('debug.recording.hint')}</Caption>
                <YStack marginTop={space.xs}>
                  <InkButton label={t('debug.stop')} onPress={onStop} testID="debug-toggle" />
                </YStack>
                <NeutralButton label={t('debug.discard')} onPress={onDiscard} testID="debug-discard" />
              </YStack>
            </Card>
          ) : (
            <InkButton
              label={t(saving ? 'debug.saving' : 'debug.start')}
              onPress={onStart}
              busy={saving}
              testID="debug-toggle"
            />
          )}
          {strip}
        </YStack>

        <SavedFilesSection
          saved={saved}
          failedWords={failedWords}
          reading={reading}
          fontScale={fontScale}
          onRetry={() => void refresh()}
          onShare={bundle => void onShare(bundle)}
          onDelete={setPendingDelete}
        />
      </SubScreen>
    </>
  );
}
