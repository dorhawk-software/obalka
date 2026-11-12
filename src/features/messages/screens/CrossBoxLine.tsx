// "V ostatních schránkách **2 nepřečtené**" - one line, under the box's own attention block.
//
// It replaces a bordered card with a header and a row per box. That card was reported twice: once
// for clashing with everything around it (an inset, rounded, uppercase-labelled card between two
// full-bleed Bricolage sections - a third component language on a screen that had two), and once
// for taking attention away from the box the user had actually opened. Both complaints have the
// same root: it looked like CONTENT, on a screen whose content is mail.
//
// A line is not content. It cannot be mistaken for a message, it costs about a fifth of the height,
// and being a section header rather than a floating card it inherits the list's own geometry, so
// the clash disappears rather than being tuned away.
//
// 031 (board InboxA) drew it as words on the paper: the boxes glyph, "V ostatních schránkách" and
// the news in the ink's bold, a chevron. The coloured dots and the hairlines above and below are gone:
// the dots named boxes by a colour nobody had learnt, and the hairlines boxed in a line that is
// already no more than a sentence.
//
// THE SENTENCE SHOWS WHOLE CLAUSES (2026-09-15). It used to be one caption cut off at its end, and a
// phone drew "Jinde: 1 doručeno fikcí · naposledy 3 nepřečtené · 2 nen…". Half a clause says nothing,
// and nothing on the line said that more had been cut. It now measures what fits in the room left
// beside the glyph and the chevron, shows that many clauses from the front, and counts the rest
// ("· +2"). It stays one line either way: it appears and changes after a refresh, above the
// list, and a second line would push every row down (constitution V).

import { useState } from 'react';
import { PixelRatio, type LayoutChangeEvent } from 'react-native';
import { XStack, YStack } from '../../../theme/ui';
import { Small } from '../../../theme/Typography';
import { ChevronRightIcon } from '../../../theme/icons';
import { OffsetIcon } from '../../../theme/offsetIcons';
import { useTheme } from '../../../theme/ThemeProvider';
import { touchSlop } from '../../../theme/touchTarget';
import { plural, t } from '../../../i18n/strings';
import { haptics } from '../../../services/haptics';
import type { BoxAttention } from '../state/crossBox';
import { attentionDaysRemaining } from '../state/attention';

/** Between two clauses, and between the last clause shown and the count of the rest. */
const SEPARATOR = ' · ';

/**
 * The hidden measuring column's width: wider than any sentence this line can build at any text size,
 * so nothing in it wraps and every width it reports is the text's own rather than the column's.
 */
const MEASURING_WIDTH = 10_000;

/**
 * Physical pixels kept spare when deciding what fits. `onLayout` reports widths rounded to the pixel
 * grid, while the row shrinks its text by the unrounded ones. Yoga rounds a text outwards, so the two
 * text widths can only read wide, but it rounds the room's edges to the nearest pixel, so the room can
 * read up to a pixel wider than the row really has. Three to spare covers that with a margin, so a
 * sentence measured to fit is never squeezed into an ellipsis after all.
 */
const ROUNDING_PIXELS = 3;

/**
 * The nearest deadline, said the way a person says it. A date would make the reader do the
 * subtraction on a line that exists to be glanced at, and "za 1 den" is not how anyone says tomorrow.
 */
function dueClause(days: number): string {
  if (days === 0) {
    return t('crossBox.due.today');
  }
  if (days === 1) {
    return t('crossBox.due.tomorrow');
  }
  return t(`crossBox.due.in.${plural(days)}`, { n: days });
}

/**
 * What the line says, in urgency order, omitting whatever is zero.
 *
 * The same order the boxes and their dots are sorted in (`compareBoxAttention`), so the words and
 * the colours lead with the same thing - and it matters twice over here, because the line shows
 * whole clauses from the front, as many as fit (`clausesThatFit`). What a narrow screen leaves out
 * is always the least urgent:
 *
 *   1. deadlines already missed            "1 po termínu"
 *   2. the nearest one still ahead         "termín zítra"
 *   3. mail served by fiction              "1 doručeno fikcí"
 *   4. other unread, as last refreshed     "2 nepřečtené"
 *   5. unread we could not refresh         "naposledy 1 nepřečtená"  (FR-004: marked as last known)
 *   6. boxes that could not be refreshed   "1 nenačtená"
 *   7. a refresh still running             "načítá se…"
 *
 * Deadlines are counted as of `now`, the inbox's own clock, not as of when the boxes were read (see
 * `BoxAttention.deadlines`). "zítra" turns into "dnes", and "dnes" into "po termínu", on the same
 * render as the deadline chips in the rows beside it.
 *
 * Fiction-served mail is taken OUT of the unread clauses, because it is also in the badge count they
 * read (see `BoxAttention.fiction`). One fiction-served message is "1 doručeno fikcí", not that plus
 * "1 nepřečtená" - which would read as two messages, and would contradict the box's own attention
 * subtitle, where the two are disjoint.
 *
 * A box being retried is reported as loading rather than as not refreshed: its last failure is no
 * longer the verdict while a new attempt is out. Its unread count stays "naposledy", though - until
 * that attempt succeeds, the number is still a memory.
 */
function crossBoxClauses(
  boxes: readonly BoxAttention[],
  now: number,
): string[] {
  let overdue = 0;
  let nearest: number | null = null;
  let fiction = 0;
  let unread = 0;
  let lastKnown = 0;
  let unreachable = 0;
  let refreshing = false;
  for (const b of boxes) {
    for (const date of b.deadlines) {
      // The same whole-day rule the attention group dates its own rows by: due earlier today is
      // still "dnes", not missed.
      const days = attentionDaysRemaining(date, now);
      if (days < 0) {
        overdue += 1;
      } else if (nearest === null || days < nearest) {
        nearest = days;
      }
    }
    fiction += b.fiction;
    // Floored: the badge and the archive come from the same sync and should agree, but a count about
    // someone's mail must never print as negative if they ever do not.
    const plainUnread = Math.max(0, b.unread - b.fiction);
    if (b.stale) {
      lastKnown += plainUnread;
    } else {
      unread += plainUnread;
    }
    if (b.refreshing) {
      refreshing = true;
    } else if (b.syncError != null) {
      unreachable += 1;
    }
  }
  const parts: string[] = [];
  if (overdue > 0) {
    parts.push(t(`crossBox.overdue.${plural(overdue)}`, { n: overdue }));
  }
  if (nearest !== null) {
    parts.push(dueClause(nearest));
  }
  if (fiction > 0) {
    parts.push(t(`attn.fiction.${plural(fiction)}`, { n: fiction }));
  }
  if (unread > 0) {
    parts.push(t(`attn.unread.${plural(unread)}`, { n: unread }));
  }
  if (lastKnown > 0) {
    parts.push(t(`crossBox.lastKnown.${plural(lastKnown)}`, { n: lastKnown }));
  }
  if (unreachable > 0) {
    parts.push(
      t(`crossBox.unreachable.${plural(unreachable)}`, { n: unreachable }),
    );
  }
  if (refreshing) {
    parts.push(t('crossBox.refreshing'));
  }
  return parts;
}

/**
 * The whole sentence: what a screen reader is told, and what the inbox asks before inserting the line.
 *
 * Exported so the test reads the same function the row does - a sentence assembled twice is a
 * sentence that drifts, and this one states counts about someone's legal mail.
 */
export function crossBoxSummary(
  boxes: readonly BoxAttention[],
  now: number,
): string {
  return crossBoxClauses(boxes, now).join(SEPARATOR);
}

/**
 * The words before the news: "V ostatních schránkách " as the board prints it, or, when not even the
 * most urgent clause fits whole after that, "Jinde: ". The prefix gives way before the news does.
 */
function prefixOf(short: boolean): string {
  return short ? `${t('crossBox.prefix')}: ` : `${t('crossBox.title')} `;
}

/** "V ostatních schránkách 1 prošlá připomínka · připomínka zítra" - the first `count` clauses. */
function sentenceOf(clauses: readonly string[], count: number, short = false): string {
  return `${prefixOf(short)}${clauses.slice(0, count).join(SEPARATOR)}`;
}

/**
 * A sentence as the line draws it: the prefix in the muted ink, the news after it in the ink's bold.
 * The words drawn and the words measured are both this, so a width measured is the width drawn.
 */
function Sentence({
  text,
  prefix,
  muted,
  ink,
  ...rest
}: {
  readonly text: string;
  readonly prefix: string;
  readonly muted: string;
  readonly ink: string;
} & Omit<Parameters<typeof Small>[0], 'children'>) {
  return (
    <Small color={muted} numberOfLines={1} {...rest}>
      {prefix}
      <Small fontWeight="700" color={ink}>
        {text.slice(prefix.length)}
      </Small>
    </Small>
  );
}

/** " · +2" - what follows the sentence when `rest` clauses did not fit. */
function notShownOf(rest: number): string {
  return `${SEPARATOR}${t('crossBox.notShown', { n: rest })}`;
}

/**
 * How many clauses fit after the given prefix: the most, from the front, whose sentence and count
 * were both measured and fit in `room`; zero when not even the first does.
 *
 * A width not measured yet counts as not fitting. A clause that arrives with new data is left to the
 * count until its own width is known, never drawn on a guess and cut in half.
 */
function clausesThatFit(
  clauses: readonly string[],
  room: number,
  widths: ReadonlyMap<string, number>,
  short: boolean,
): number {
  const spare = ROUNDING_PIXELS / PixelRatio.get();
  let fitting = 0;
  for (let count = 1; count <= clauses.length; count += 1) {
    const rest = clauses.length - count;
    const sentence = widths.get(sentenceOf(clauses, count, short));
    const after = rest > 0 ? widths.get(notShownOf(rest)) : 0;
    if (
      sentence !== undefined &&
      after !== undefined &&
      sentence + after + spare <= room
    ) {
      fitting = count;
    }
  }
  return fitting;
}

/**
 * What the line shows: the board's prefix with as many whole clauses as fit after it; when not even
 * one does, the short prefix with as many as fit after that. Never fewer than one clause - the most
 * urgent is the reason the line exists, so when even it does not fit after "Jinde: " it is shown
 * anyway and truncates, the last resort, and the count after it still says how much is not shown.
 */
function lineThatFits(
  clauses: readonly string[],
  room: number,
  widths: ReadonlyMap<string, number>,
): { short: boolean; fitting: number } {
  const long = clausesThatFit(clauses, room, widths, false);
  if (long > 0) {
    return { short: false, fitting: long };
  }
  return { short: true, fitting: Math.max(1, clausesThatFit(clauses, room, widths, true)) };
}

function sameWidths(
  a: ReadonlyMap<string, number>,
  b: ReadonlyMap<string, number>,
): boolean {
  if (a.size !== b.size) {
    return false;
  }
  for (const [text, width] of b) {
    if (a.get(text) !== width) {
      return false;
    }
  }
  return true;
}

export function CrossBoxLine({
  boxes,
  now,
  onPress,
}: {
  readonly boxes: readonly BoxAttention[];
  /** The inbox's own `now`, so a deadline here is phrased on the same clock as the rows around it. */
  readonly now: number;
  /** Opens the switcher, where every box already shows its own count and sync state. */
  readonly onPress: () => void;
}) {
  const theme = useTheme();
  // Both measured by native layout, never estimated from a character count: the face, the person's
  // text size and the screen's width all decide what fits, and each can change under a mounted line.
  const [room, setRoom] = useState<number | null>(null);
  const [widths, setWidths] = useState<ReadonlyMap<string, number>>(
    () => new Map(),
  );
  const clauses = crossBoxClauses(boxes, now);
  // Nothing happening elsewhere is not a line saying so. Nor is a prefix with nothing after it:
  // "Jinde: " and then silence is what a box whose only news was an upcoming reminder used to
  // render. Every reported box has a clause now, and this keeps a wordless line impossible anyway.
  if (boxes.length === 0 || clauses.length === 0) {
    return null;
  }
  // Every sentence the line could show, and a count for every number of clauses it could leave out,
  // plus one: when a refresh adds a clause, the count it may need was measured a render earlier.
  const measuring = [
    ...clauses.map((_, i) => sentenceOf(clauses, i + 1)),
    ...clauses.map((_, i) => sentenceOf(clauses, i + 1, true)),
    ...clauses.map((_, i) => notShownOf(i + 1)),
  ];
  const onMeasured = (text: string) => (e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width;
    setWidths(previous => {
      // Kept to what this render measures, so a width read at an earlier text size cannot come back
      // with a sentence that returns later.
      const next = new Map<string, number>();
      for (const key of measuring) {
        const known = key === text ? width : previous.get(key);
        if (known !== undefined) {
          next.set(key, known);
        }
      }
      return sameWidths(previous, next) ? previous : next;
    });
  };
  // Until the first measurement lands, the line holds its one-line height with the whole sentence
  // transparent in it. The first words anyone sees are the ones that fit, not a sentence cut
  // mid-word that then rearranges itself.
  const measured = room !== null && widths.size > 0;
  const { short, fitting } = measured
    ? lineThatFits(clauses, room, widths)
    : { short: false, fitting: clauses.length };
  const notShown = clauses.length - fitting;
  return (
    <XStack
      alignItems="center"
      gap={8}
      minHeight={44}
      paddingHorizontal={16}
      paddingTop={4}
      pressStyle={{ backgroundColor: theme.surfaceAlt }}
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      accessibilityRole="button"
      // The label carries the whole sentence plus where the tap goes - "two unread in your other
      // boxes" is useless without "opens your boxes". Whole, whatever fits on the screen: a clause
      // left out for width is still news.
      accessibilityLabel={`${sentenceOf(clauses, clauses.length)}. ${t('home.title')}`}
      hitSlop={touchSlop({ height: 44 })}
      testID="crossBoxLine"
    >
      <OffsetIcon name="boxes" size={16} color={theme.textMuted} />
      <XStack
        flex={1}
        minWidth={0}
        alignItems="center"
        // The room the sentence has. Growing to fill the row and never sized by its own words, so this
        // changes when what is beside it does: the screen (a rotation, a split screen), the text size,
        // and the dots, which widen when another box joins the report.
        onLayout={(e: LayoutChangeEvent) => setRoom(e.nativeEvent.layout.width)}
        testID="crossBoxSlot"
      >
        <Sentence
          text={sentenceOf(clauses, fitting, short)}
          prefix={prefixOf(short)}
          muted={theme.textMuted}
          ink={theme.text}
          flexShrink={1}
          minWidth={0}
          opacity={measured ? 1 : 0}
          testID="crossBoxSummary"
        />
        {notShown > 0 ? (
          <Small
            // Never the part that gives way: when the first clause has to truncate, the count still
            // says there is more.
            flexShrink={0}
            color={theme.textMuted}
            numberOfLines={1}
            testID="crossBoxNotShown"
          >
            {notShownOf(notShown)}
          </Small>
        ) : null}
        <YStack
          position="absolute"
          top={0}
          left={0}
          width={MEASURING_WIDTH}
          opacity={0}
          pointerEvents="none"
          // Words for the layout engine only. The line's label already reads the whole sentence, so
          // a screen reader on either platform must not find these as well.
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          aria-hidden
          testID="crossBoxMeasure"
        >
          {measuring.map(text =>
            !text.startsWith(SEPARATOR) ? (
              <Sentence
                // Keyed by the words, so changed words mount a new element that reports its width
                // even when it equals the old one: `onLayout` fires when a size changes, not the text.
                key={text}
                text={text}
                prefix={prefixOf(!text.startsWith(prefixOf(false)))}
                muted={theme.textMuted}
                ink={theme.text}
                alignSelf="flex-start"
                onLayout={onMeasured(text)}
                testID="crossBoxMeasured"
              />
            ) : (
              <Small
                key={text}
                alignSelf="flex-start"
                numberOfLines={1}
                onLayout={onMeasured(text)}
                testID="crossBoxMeasured"
              >
                {text}
              </Small>
            ),
          )}
        </YStack>
      </XStack>
      <ChevronRightIcon size={16} color={theme.textMuted} />
    </XStack>
  );
}
