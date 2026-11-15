// The Debug screen's lower half as board R13 draws it (031 I47, agreed 2026-11-12): the notice strip
// under the start, and the saved files. Out of `DebugScreen.tsx`, which keeps the recording and its
// rules; these are only what is drawn of a save once it is made.
//
// The files: a line of muted text while there are none, with no card under it; otherwise one card,
// each file its name over its size and a pair of halves under them - Sdílet filled, Smazat neutral in
// the danger ink. Before the folder answers, the same line held empty; when it cannot be read, that
// line says so, with the way to try again as a link under it (R13 draws neither; a link, as the
// transfer's "make a backup" is one, because trying again is not the screen's main action).
//
// Roundings from the board: the strip's 13/19 600 is the Label role, 13/17; its check's 2.4 stroke is
// the icon family's 2.

import { Spinner, XStack, YStack } from '../../theme/ui';
import { Label, Meta, Small, SmallStrong } from '../../theme/Typography';
import { PressScale } from '../../theme/PressScale';
import { InkButton } from '../../theme/InkButton';
import { NeutralButton } from '../../theme/NeutralButton';
import { AlertIcon, CheckIcon } from '../../theme/icons';
import { chipTone } from '../../theme/chipTone';
import { useTheme } from '../../theme/ThemeProvider';
import { space } from '../../theme/spacing';
import { type as typeScale } from '../../theme/typeScale';
import { formatBytes, t } from '../../i18n/strings';
import type { SavedBundle } from '../../services/debug/debugStore';
import { Card, RowDivider, Section } from './SettingsSection';

/** The boards' `strip`: never shorter than this, whatever it says. */
const STRIP_ROW = 44;
/**
 * Lines the notice holds. It carries a saved file's name, and "Uloženo: obalka-debug-2026-09-15-1030-
 * standard-2.zip" is wider than a 360dp phone leaves the strip at 13pt, so the name takes a second line
 * already at the default text size. Past two lines it is cut short; the file is listed in full below.
 */
const NOTICE_LINES = 2;

/**
 * The saved files as last read: not read yet, read, or not readable (constitution II). A failed read
 * counts the failed reads in a row it ends, so trying again and failing again says something the screen
 * had not already said.
 */
export type SavedFiles =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly bundles: readonly SavedBundle[] }
  | { readonly status: 'failed'; readonly attempts: number };

/**
 * What the saved files' line says after `attempts` failed reads in a row. Until 2026-09-15 a retry that
 * failed again put back the very words it had replaced: nothing on the screen changed and nothing was
 * announced, so "Zkusit znovu" looked like a press that had missed. The attempt is in the words now.
 */
export function savedFilesError(attempts: number): string {
  return attempts > 1 ? t('debug.saved.errorAgain', { n: attempts }) : t('debug.saved.error');
}

/** What the strip says, and in which tone: a save that worked, or anything that did not. */
export interface Notice {
  readonly text: string;
  readonly tone: 'saved' | 'failed';
}

/**
 * The notice strip (R13): the blue tint with a check for a saved file, the danger tint for a failure.
 * Held from the press that starts a save until the next recording starts, empty and undrawn until the
 * save ends, so the save's end only fills it (constitution V); its height is a finger's or two lines at
 * the reader's text size, whichever is more, so neither the words nor the text size can grow it.
 *
 * Empty, VoiceOver is kept off it (an iOS Text is an element of its own). On Android it stays in the
 * accessibility tree: a Text there is no focus stop unless it can be pressed, so an empty one is
 * nothing to land on, and a view taken out of the tree gives TalkBack nothing to read when its live
 * region reports new words - the words and the tree would change in one commit, in an order this
 * screen does not control.
 */
export function NoticeStrip({ notice, fontScale }: { readonly notice: Notice | null; readonly fontScale: number }) {
  const theme = useTheme();
  const danger = chipTone('dangerSoft', theme);
  const failed = notice?.tone === 'failed';
  const ink = failed ? danger.fg : theme.blueDark;
  return (
    <XStack
      alignItems="center"
      gap={space.md}
      minHeight={Math.max(STRIP_ROW, NOTICE_LINES * typeScale.label.lineHeight * fontScale)}
      paddingLeft={space.xl}
      paddingRight={space.sm}
      borderRadius={12}
      backgroundColor={notice == null ? 'transparent' : failed ? danger.bg : theme.blueSoft}
      testID="debug-notice-strip"
    >
      <YStack opacity={notice == null ? 0 : 1} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {failed ? <AlertIcon size={16} color={ink} /> : <CheckIcon size={16} color={ink} />}
      </YStack>
      <Label
        flex={1}
        numberOfLines={NOTICE_LINES}
        color={ink}
        accessibilityLiveRegion="polite"
        accessibilityElementsHidden={notice == null}
        testID="debug-notice"
      >
        {notice?.text ?? ''}
      </Label>
    </XStack>
  );
}

/**
 * Try again, as a link under the words that say the read failed. While a read is out the press is
 * swallowed and a spinner stands in for the words, which keep their room, so nothing beside or under
 * it moves (constitution V). Disabled and nothing more, a try again that waited on a stuck folder
 * looked like a press that had not landed.
 */
function RetryLink({ busy, onPress }: { readonly busy: boolean; readonly onPress: () => void }) {
  const theme = useTheme();
  return (
    <PressScale onPress={onPress} busy={busy} accessibilityLabel={t('debug.saved.retry')} testID="debug-saved-retry">
      <XStack minHeight={44} alignItems="center">
        <SmallStrong color={theme.blue} opacity={busy ? 0 : 1}>
          {t('debug.saved.retry')}
        </SmallStrong>
        {busy ? (
          <YStack
            position="absolute"
            top={0}
            right={0}
            bottom={0}
            left={0}
            alignItems="center"
            justifyContent="center"
            testID="debug-saved-retry-busy"
          >
            <Spinner size="small" color={theme.blue} />
          </YStack>
        ) : null}
      </XStack>
    </PressScale>
  );
}

/** One saved file (R13): its name over its size, then Sdílet and Smazat as two halves. */
function SavedRow({
  bundle,
  index,
  onShare,
  onDelete,
}: {
  readonly bundle: SavedBundle;
  readonly index: number;
  readonly onShare: () => void;
  readonly onDelete: () => void;
}) {
  const theme = useTheme();
  return (
    <YStack gap={space.md} paddingVertical={space.lg} paddingHorizontal={space.xl}>
      <YStack>
        <Label color={theme.text} testID={`debug-name-${index}`}>
          {bundle.name}
        </Label>
        {/* Listed even when its size could not be read: it is still a file on the phone that may hold
            someone's mail, and this is where it gets deleted. */}
        <Meta color={theme.textFaint} testID={`debug-size-${index}`}>
          {bundle.bytes == null ? t('debug.saved.sizeUnknown') : formatBytes(bundle.bytes)}
        </Meta>
      </YStack>
      <XStack gap={space.base}>
        <YStack flex={1}>
          <InkButton
            small
            label={t('debug.share')}
            accessibilityLabel={`${t('debug.share')}, ${bundle.name}`}
            onPress={onShare}
            testID={`debug-share-${index}`}
          />
        </YStack>
        <YStack flex={1}>
          <NeutralButton
            small
            danger
            label={t('debug.delete')}
            accessibilityLabel={`${t('debug.delete')}, ${bundle.name}`}
            onPress={onDelete}
            testID={`debug-delete-${index}`}
          />
        </YStack>
      </XStack>
    </YStack>
  );
}

/** The saved files' section: held, failed, empty, or the files. */
export function SavedFilesSection({
  saved,
  failedWords,
  reading,
  fontScale,
  onRetry,
  onShare,
  onDelete,
}: {
  readonly saved: SavedFiles;
  /** What a failed read says, or null; worked out by the screen, which also announces it on iOS. */
  readonly failedWords: string | null;
  /** A read of the folder is out. */
  readonly reading: boolean;
  readonly fontScale: number;
  readonly onRetry: () => void;
  readonly onShare: (bundle: SavedBundle) => void;
  readonly onDelete: (bundle: SavedBundle) => void;
}) {
  const theme = useTheme();
  return (
    <Section label={t('debug.saved')}>
      {/* Before the first read answers there is nothing true to say: "Zatím tu nic není." would be a
          guess. The line is held at one line of text, the height it most often settles to, and has
          nothing to read. The list is the last thing on the screen, so whatever it settles to moves
          nothing under it.
          One line for a read not answered yet and a read that failed: the words a failure puts there,
          and the new words the next failure puts there, change in a live region TalkBack already
          knows. A line drawn only once a read had failed would be a view that appeared, which TalkBack
          does not read out. Empty, VoiceOver is kept off it. */}
      {saved.status === 'ready' ? null : (
        <YStack
          alignItems="flex-start"
          marginHorizontal={space.xs}
          testID={saved.status === 'failed' ? 'debug-saved-failed' : 'debug-saved-loading'}
        >
          <Small
            alignSelf="stretch"
            minHeight={typeScale.small.lineHeight * fontScale}
            color={theme.textMuted}
            accessibilityLiveRegion="polite"
            accessibilityElementsHidden={failedWords == null}
            testID="debug-saved-status"
          >
            {failedWords ?? ''}
          </Small>
          {saved.status === 'failed' ? <RetryLink busy={reading} onPress={onRetry} /> : null}
        </YStack>
      )}
      {saved.status === 'ready' && saved.bundles.length === 0 ? (
        <Small color={theme.textMuted} marginHorizontal={space.xs} testID="debug-empty">
          {t('debug.saved.empty')}
        </Small>
      ) : null}
      {saved.status === 'ready' && saved.bundles.length > 0 ? (
        <Card>
          {saved.bundles.map((bundle, i) => (
            <YStack key={bundle.path}>
              {i > 0 ? <RowDivider /> : null}
              <SavedRow
                bundle={bundle}
                index={i}
                onShare={() => onShare(bundle)}
                onDelete={() => onDelete(bundle)}
              />
            </YStack>
          ))}
        </Card>
      ) : null}
    </Section>
  );
}
