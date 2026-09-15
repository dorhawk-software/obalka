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
// Every spacing on this screen is a DESIGN.md step, named through `space`, and every note is the
// Caption role at its own 13/17. Until 2026-09-15 the screen typed a 9 gap, 20 and 22 margins and 12pt
// captions of its own. The settings furniture it sits in (`Section`, `CardRow`, `SubScreen`, shared with
// three other screens) moved onto the same scales that day, keeping the values DESIGN.md records for it.

import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, useWindowDimensions } from 'react-native';
import { Spinner, XStack, YStack } from '../../theme/ui';
import { Body, BodyStrong, Caption } from '../../theme/Typography';
import { PressScale } from '../../theme/PressScale';
import { OptionGroup } from '../../theme/OptionGroup';
import { Dialog } from '../../theme/Dialog';
import { useTheme } from '../../theme/ThemeProvider';
import { space } from '../../theme/spacing';
import { type as typeScale } from '../../theme/typography';
import { plural, t } from '../../i18n/strings';
import { haptics } from '../../services/haptics';
import { SubScreen } from './SubScreen';
import { Card, CardRow, RowTitle, Section } from './SettingsSection';
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
import {
  deleteBundle,
  listBundles,
  shareBundle,
  type SavedBundle,
} from '../../services/debug/debugStore';

const MIB = 1024 * 1024;

/** kB / MB, because "1483264 B" tells the user nothing about whether it will send by e-mail. */
function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < MIB) {
    return `${Math.round(bytes / 1024)} kB`;
  }
  return `${(bytes / MIB).toFixed(1)} MB`;
}

/** The status line while recording: "Zaznamenává se · 2 záznamy · 1 kB". */
export function recordingCounter(entries: number, bytes: number): string {
  const counted = t(`debug.recording.entries.${plural(entries)}`, { n: entries });
  return `${t('debug.recording')} · ${counted} · ${formatBytes(bytes)}`;
}

/**
 * A number one character longer than any the counter can show, in the widest digit Public Sans has.
 * The counter's numbers run to four characters - `MAX_ENTRIES` entries, "1024" in front of a kB, "4.0"
 * in front of an MB under `MAX_BYTES` - and its digits are not equally wide: an 8 is 8.5dp at 13pt and
 * a 1 is 5.4, so "3888" is wider than "4000". The fifth character is margin against the kerning and
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
  return `${t('debug.recording')} · ${counted} · ${RESERVE_NUMBER} MB`;
}

/** A caption's line box at the default text size: the Caption role, DESIGN.md 13/17. */
const CAPTION_LINE = typeScale.caption.lineHeight;
/**
 * Lines the notice reserves. It holds a saved file's name, and "Uloženo: obalka-debug-2026-09-15-1030-
 * standard-2.zip" is 345dp in Public Sans Medium 13, where a 360dp phone leaves it 324dp - so the name
 * takes a second line already at the default text size. Past two lines it is cut short; the file is
 * listed in full right below it.
 */
const NOTICE_LINES = 2;

/**
 * The saved files as last read: not read yet, read, or not readable (constitution II). A failed read
 * counts the failed reads in a row it ends, so trying again and failing again says something the screen
 * had not already said.
 */
type SavedFiles =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly bundles: readonly SavedBundle[] }
  | { readonly status: 'failed'; readonly attempts: number };

/**
 * What the saved files' row says after `attempts` failed reads in a row. Until 2026-09-15 a retry that
 * failed again put back the very words it had replaced: nothing on the screen changed and nothing was
 * announced, so "Zkusit znovu" looked like a press that had missed. The attempt is in the words now.
 */
export function savedFilesError(attempts: number): string {
  return attempts > 1 ? t('debug.saved.errorAgain', { n: attempts }) : t('debug.saved.error');
}

/**
 * A button at the end of a saved-files row. One size for every one of them - share, delete, and try
 * again when the list could not be read - so a row keeps its height whichever it carries.
 */
function RowAction({
  label,
  accessibilityLabel,
  tone,
  onPress,
  busy,
  testID,
}: {
  readonly label: string;
  readonly accessibilityLabel: string;
  /** `plain` sits on the row's own fill in the danger ink; `filled` has a tile of its own. */
  readonly tone: 'filled' | 'plain';
  readonly onPress: () => void;
  /**
   * The action is running. The press is swallowed and a spinner stands in for the label, which keeps its
   * room underneath, so the button keeps its width and the words beside it do not rewrap (constitution
   * V). Disabled and nothing more, a try again that waited on a stuck folder looked like a press that had
   * not landed.
   */
  readonly busy?: boolean;
  readonly testID: string;
}) {
  const theme = useTheme();
  const ink = tone === 'filled' ? theme.text : theme.danger;
  return (
    <PressScale
      onPress={onPress}
      busy={busy}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      <XStack
        minHeight={44}
        minWidth={tone === 'filled' ? 72 : 44}
        paddingHorizontal={space.lg}
        borderRadius={11}
        backgroundColor={tone === 'filled' ? theme.surfaceAlt : undefined}
        alignItems="center"
        justifyContent="center"
      >
        <Body fontSize={13} color={ink} opacity={busy ? 0 : 1}>
          {label}
        </Body>
        {busy ? (
          <YStack
            position="absolute"
            top={0}
            right={0}
            bottom={0}
            left={0}
            alignItems="center"
            justifyContent="center"
            testID={`${testID}-busy`}
          >
            <Spinner size="small" color={ink} />
          </YStack>
        ) : null}
      </XStack>
    </PressScale>
  );
}

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
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<SavedBundle | null>(null);
  // True while a stopped recording is being written. The archive is built in slices that keep the app
  // answering (Principle I), so a press can now arrive mid-write - on this screen, or on this screen
  // opened again after someone left it during the save. Either way the buttons say so and wait.
  const [saving, setSaving] = useState(() => debugSaveInFlight() !== null);
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
      try {
        const done = await save;
        setNotice(t('debug.savedNotice').replace('{name}', done.path.split('/').pop() ?? ''));
        await refresh();
      } catch {
        // Principle II: the recording is lost, the screen is not. The buffer is cleared either way.
        setNotice(t('debug.error'));
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
      AccessibilityInfo.announceForAccessibility(notice);
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
  }, [level]);

  const onStop = useCallback(() => follow(stopDebugAndWrite()), [follow]);

  const onDiscard = useCallback(() => {
    cancelDebug();
    setNotice(null);
  }, []);

  const onShare = useCallback(async (bundle: SavedBundle) => {
    try {
      await shareBundle(bundle.path, t('debug.shareTitle'));
    } catch {
      setNotice(t('debug.shareError'));
    }
  }, []);

  // A delete that did not happen says so (constitution II). The folder is read again either way, so the
  // list shows what is really there; a row that just stayed put after "Smazat" looked like a missed tap.
  const onDelete = useCallback(
    async (bundle: SavedBundle) => {
      try {
        await deleteBundle(bundle.path);
      } catch {
        setNotice(t('debug.deleteError'));
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

  // The label changes in place while saving; the button keeps its size, so nothing below it moves.
  let toggleLabel = t(recording ? 'debug.stop' : 'debug.start');
  if (saving) {
    toggleLabel = t('debug.saving');
  }

  return (
    <>
      {pendingDelete ? (
        <Dialog
          title={pendingDelete.name}
          body={t('debug.delete')}
          onDismiss={() => setPendingDelete(null)}
          testID="debug-delete-dialog"
          actions={[
            { label: t('common.cancel'), onPress: () => setPendingDelete(null) },
            {
              label: t('debug.delete'),
              tone: 'danger',
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

      <SubScreen title={t('debug.title')} onBack={onBack}>
        <Body
          fontSize={13}
          lineHeight={19}
          color={theme.textMuted}
          marginBottom={space.gutter}
        >
          {t('debug.intro')}
        </Body>

        {/* The level, and it is only choosable BEFORE recording starts - changing what a bundle
            contains halfway through would produce a file whose manifest lies about it. */}
        <Section label={t('debug.level')}>
          <YStack gap={space.base}>
            <OptionGroup
              options={[
                { value: 'standard' as const, label: t('debug.level.standard') },
                { value: 'full' as const, label: t('debug.level.full') },
              ]}
              value={level}
              onChange={recording ? () => {} : setLevel}
              testIDPrefix="debug-level"
            />
            <Caption color={theme.textFaint} marginLeft={space.xs} testID="debug-level-desc">
              {t(level === 'full' ? 'debug.level.full.desc' : 'debug.level.standard.desc')}
            </Caption>
            {/* Under both options, deliberately: it is the guarantee that does not vary, and it is
                what makes choosing the detailed level a decision about mail rather than about
                everything. */}
            <Caption color={theme.textFaint} marginLeft={space.xs}>
              {t('debug.creds')}
            </Caption>
          </YStack>
        </Section>

        <YStack gap={space.base} marginBottom={space.gutter} testID="debug-controls">
          <PressScale
            fullWidth
            onPress={recording ? onStop : onStart}
            busy={saving}
            accessibilityLabel={toggleLabel}
            testID="debug-toggle"
          >
            <XStack
              width="100%"
              minHeight={48}
              borderRadius={14}
              backgroundColor={theme.text}
              alignItems="center"
              justifyContent="center"
            >
              <BodyStrong fontSize={15} color={theme.surfaceAlt}>
                {toggleLabel}
              </BodyStrong>
            </XStack>
          </PressScale>

          {/* Only while the recorder runs. It stops at the press on "Ukončit a uložit", so these go in
              answer to that press - the mirror of "Spustit záznam" bringing them - and not when the
              save it started ends, long after, under a finger that has moved on. */}
          {recording ? (
            <>
              <XStack
                alignItems="flex-start"
                gap={space.base}
                marginLeft={space.xs}
                testID="debug-status-row"
              >
                {/* A dot, because a screen that is recording someone's mail should say so at a
                    glance and not only in a sentence. The label carries it for a screen reader. Held
                    to one caption line at the reader's text size, so it stays beside the first line
                    however many lines the counter's room below takes. */}
                <YStack
                  minHeight={CAPTION_LINE * fontScale}
                  justifyContent="center"
                  testID="debug-status-dot"
                >
                  <RecordingDot />
                </YStack>
                {/* The counter's words grow while it records - "2 záznamy · 1 kB" to "4000 záznamů ·
                    1024 kB" - and at a larger text size the longer ones take a second line part-way
                    through, which pushed the hint, the discard button and everything under them down
                    (constitution V). So the room is taken by the longest counter the recorder can
                    reach, drawn invisibly at the reader's own text size and width, and the live counter
                    is laid over it, taking no room of its own: however its words grow, nothing else on
                    the screen can move.
                    Both are broken into lines greedily, at spaces, on both platforms. A reserve that is
                    word for word at least as wide takes at least as many lines only under that breaker,
                    and it is the one `debugCounterReserve.test.ts` measures with. Android's own default
                    (`highQuality`) weighs whole paragraphs and promises no such thing, so it is named
                    here, with iOS's plain word wrap beside it, rather than left to each platform. */}
                <YStack flex={1}>
                  <Caption
                    opacity={0}
                    textBreakStrategy="simple"
                    lineBreakStrategyIOS="none"
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                    testID="debug-status-reserve"
                  >
                    {recordingCounterReserve()}
                  </Caption>
                  <Caption
                    position="absolute"
                    top={0}
                    left={0}
                    right={0}
                    textBreakStrategy="simple"
                    lineBreakStrategyIOS="none"
                    color={theme.textMuted}
                    testID="debug-status"
                  >
                    {recordingCounter(entries, bytes)}
                  </Caption>
                </YStack>
              </XStack>
              <Caption color={theme.textFaint} marginLeft={space.xs}>
                {t('debug.recording.hint')}
              </Caption>
              <PressScale
                fullWidth
                onPress={onDiscard}
                disabled={saving}
                accessibilityLabel={t('debug.discard')}
                testID="debug-discard"
              >
                <XStack
                  width="100%"
                  minHeight={44}
                  borderRadius={14}
                  borderWidth={1}
                  borderColor={theme.border}
                  alignItems="center"
                  justifyContent="center"
                >
                  <Body fontSize={14} color={theme.textMuted}>
                    {t('debug.discard')}
                  </Body>
                </XStack>
              </PressScale>
            </>
          ) : null}

          {/* Reserved whether or not there is a notice, at the reader's text size (constitution V). A
              notice arrives when a save ends or the share sheet fails to open - moments nobody picks -
              and drawn only then it pushed the saved files down under a finger that may be reaching
              for one of them. Now only its words change.
              Empty, VoiceOver is kept off it (an iOS Text is an element of its own). On Android it stays
              in the accessibility tree: a Text there is no focus stop unless it can be pressed, so an
              empty one is nothing to land on, and a view taken out of the tree gives TalkBack nothing to
              read when its live region reports new words - the words and the tree would change in one
              commit, in an order this screen does not control. */}
          <Caption
            minHeight={NOTICE_LINES * CAPTION_LINE * fontScale}
            numberOfLines={NOTICE_LINES}
            color={theme.textMuted}
            marginLeft={space.xs}
            accessibilityLiveRegion="polite"
            accessibilityElementsHidden={notice == null}
            testID="debug-notice"
          >
            {notice ?? ''}
          </Caption>
        </YStack>

        <Section label={t('debug.saved')}>
          <Card>
            {/* Before the first read answers there is nothing true to say: "Zatím tu nic není." would
                be a guess. The row holds a caption line, the height the list most often settles to,
                and has nothing to read. The list is the last thing on the screen, so whatever it
                settles to moves nothing under it.
                One row for a read not answered yet and a read that failed, and one caption in it: the
                words a failure puts there, and the new words the next failure puts there, change in a
                live region TalkBack already knows. A row drawn only once a read had failed would be a
                view that appeared, which TalkBack does not read out. Empty, VoiceOver is kept off it. */}
            {saved.status === 'ready' ? null : (
              <CardRow
                last
                testID={saved.status === 'failed' ? 'debug-saved-failed' : 'debug-saved-loading'}
              >
                <Caption
                  flex={1}
                  minHeight={CAPTION_LINE * fontScale}
                  color={theme.textMuted}
                  accessibilityLiveRegion="polite"
                  accessibilityElementsHidden={failedWords == null}
                  testID="debug-saved-status"
                >
                  {failedWords ?? ''}
                </Caption>
                {saved.status === 'failed' ? (
                  <RowAction
                    tone="filled"
                    label={t('debug.saved.retry')}
                    accessibilityLabel={t('debug.saved.retry')}
                    onPress={() => void refresh()}
                    busy={reading}
                    testID="debug-saved-retry"
                  />
                ) : null}
              </CardRow>
            )}
            {saved.status === 'ready' && saved.bundles.length === 0 ? (
              <CardRow last testID="debug-empty">
                <Caption flex={1} color={theme.textFaint}>
                  {t('debug.saved.empty')}
                </Caption>
              </CardRow>
            ) : null}
            {saved.status === 'ready'
              ? saved.bundles.map((bundle, i) => (
                  <CardRow key={bundle.path} last={i === saved.bundles.length - 1}>
                    <YStack flex={1}>
                      <RowTitle>{bundle.name}</RowTitle>
                      <Caption
                        marginTop={space.hair}
                        color={theme.textFaint}
                        testID={`debug-size-${i}`}
                      >
                        {/* Listed even when its size could not be read: it is still a file on the
                            phone that may hold someone's mail, and this is where it gets deleted. */}
                        {bundle.bytes == null
                          ? t('debug.saved.sizeUnknown')
                          : formatBytes(bundle.bytes)}
                      </Caption>
                    </YStack>
                    <XStack gap={space.sm}>
                      <RowAction
                        tone="filled"
                        label={t('debug.share')}
                        accessibilityLabel={`${t('debug.share')}, ${bundle.name}`}
                        onPress={() => void onShare(bundle)}
                        testID={`debug-share-${i}`}
                      />
                      <RowAction
                        tone="plain"
                        label={t('debug.delete')}
                        accessibilityLabel={`${t('debug.delete')}, ${bundle.name}`}
                        onPress={() => setPendingDelete(bundle)}
                        testID={`debug-delete-${i}`}
                      />
                    </XStack>
                  </CardRow>
                ))
              : null}
          </Card>
        </Section>
      </SubScreen>
    </>
  );
}
