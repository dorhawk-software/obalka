// Local-archive search (feature 004). Searches the cached envelopes across ALL boxes by their text
// (subject / sender / recipient / addresses), accent- and case-insensitively. Works fully offline -
// it only reads the local cache. Debounced search-as-you-type; a hit opens that message's detail.

import { useEffect, useMemo, useRef, useState } from 'react';
import { ScreenHeader } from '../../../theme/ScreenHeader';
import { SectionList, type TextInput } from 'react-native';
import { useContentBottom } from '../../../theme/useContentBottom';
import { useAutoFocus } from '../../../theme/useAutoFocus';
import { Input, XStack, YStack } from '../../../theme/ui';
import { Meta, Title } from '../../../theme/Typography';
import { useTheme } from '../../../theme/ThemeProvider';
import { EmptyObject } from '../../../theme/EmptyObject';
import { EnvelopePose } from '../../../theme/objects/Envelope';
import { groupByDate, type DateSectionLabel } from '../state/groupByDate';
import type { Reminder } from '../state/reminders';
import { plural, t } from '../../../i18n/strings';
import type { DataBoxAccount } from '../../../services/isds/types';
import { SEARCH_LIMIT } from '../../../services/db/messagesStore';
import type {
  MessageFolder,
  MessageSearchHit,
} from '../../../services/db/messagesStore';
import { messagesController, remindersController } from '../../accounts/deps';
import { RegisterRow, RegisterSkeleton, SectionHead } from './InboxRows';
import { SentRegisterRow } from './SentRows';
import { OffsetIcon } from '../../../theme/offsetIcons';



export interface SearchScreenProps {
  readonly accounts: DataBoxAccount[];
  readonly onBack: () => void;
  /** Opens the hit's detail. `folder` MUST be threaded through - a sent hit opened without it defaults
   *  to 'received' and is mis-rendered (fikce banner, wrong attachment flow). */
  readonly onOpenMessage: (
    boxId: string,
    messageId: string,
    folder: MessageFolder,
  ) => void;
}

export function SearchScreen({
  accounts,
  onBack,
  onOpenMessage,
}: SearchScreenProps) {
  const theme = useTheme();
  // The design's search bar is a 62px row around the 44px field (9dp above / below), which is tighter
  // than the shared `useHeaderTop` gap - so the inset is applied directly here.
  const contentBottom = useContentBottom(12);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MessageSearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  // Every box's reminders, so a result shows its reminder as the register's row does. `null` until
  // read: the rows wait for it, so a mark never appears after its row (Principle V).
  const [reminders, setReminders] = useState<readonly Reminder[] | null>(null);

  // The search field is the whole point of this screen, so it opens focused. `autoFocus` cannot do
  // that - see `useAutoFocus` for the two reasons why.
  const fieldRef = useRef<TextInput>(null);
  useAutoFocus(fieldRef);

  const accountByBox = useMemo(() => {
    const m = new Map<string, DataBoxAccount>();
    for (const a of accounts) {
      m.set(a.boxId, a);
    }
    return m;
  }, [accounts]);

  useEffect(() => {
    let alive = true;
    Promise.all(accounts.map(a => remindersController.listForBox(a.boxId)))
      .then(lists => {
        if (alive) {
          setReminders(lists.flat());
        }
      })
      .catch(() => {
        if (alive) {
          // No marks beats no results (Principle II).
          setReminders([]);
        }
      });
    return () => {
      alive = false;
    };
  }, [accounts]);

  // The register's sections (I42, "rows as I18"): the hits by day and month, newest first as the
  // store returns them, never more than the cap whatever the store handed back.
  // The clock is read with the results, so a row's date and day stay put while the list is open.
  const { sections, now } = useMemo(() => {
    const at = Date.now();
    const shown = results.slice(0, SEARCH_LIMIT);
    const hitOf = new Map(shown.map(h => [h.envelope, h]));
    const grouped = groupByDate(
      shown.map(h => h.envelope),
      at,
    ).map(section => ({
      key: section.key,
      label: section.label,
      data: section.data.map(envelope => hitOf.get(envelope) as MessageSearchHit),
    }));
    return { sections: grouped, now: at };
  }, [results]);
  const termDates = useMemo(() => new Map((reminders ?? []).map(r => [r.messageId, r.date])), [reminders]);

  // Debounced search - only the local cache, so no network and no abort handling needed.
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setSearching(false);
      return;
    }
    let alive = true;
    setSearching(true);
    const handle = setTimeout(() => {
      messagesController.searchMessages(q).then(hits => {
        if (alive) {
          setResults(hits);
          setSearching(false);
        }
      });
    }, 220);
    return () => {
      alive = false;
      clearTimeout(handle);
    };
  }, [query]);

  const trimmed = query.trim();

  return (
    <YStack flex={1} backgroundColor={theme.bg}>
      {/* The design's one header bar, with the search field where a title would be. */}
      <ScreenHeader
        onBack={onBack}
        hairline={false}
        content={
          <XStack
            flex={1}
            alignItems="center"
            gap={8}
            minHeight={44}
            paddingHorizontal={12}
            borderRadius={12}
            backgroundColor={theme.bg}
            testID="search-field"
          >
            <OffsetIcon name="search" size={18} color={theme.textMuted} />
            <Input
              ref={fieldRef}
              flex={1}
              minHeight={44}
              backgroundColor="transparent"
              borderWidth={0}
              paddingHorizontal={0}
              fontSize={15}
              color={theme.text}
              placeholderTextColor={theme.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              value={query}
              onChangeText={setQuery}
              placeholder={t('search.placeholder')}
              accessibilityLabel={t('search.placeholder')}
              testID="search-input"
            />
          </XStack>
        }
      />

      {!trimmed ? (
        <Hint />
      ) : (searching && results.length === 0) || (results.length > 0 && reminders == null) ? (
        <RegisterSkeleton />
      ) : results.length === 0 ? (
        <NoResults />
      ) : (
        <SectionList<MessageSearchHit, SearchSection>
          sections={sections}
          keyExtractor={h => `${h.boxId}:${h.envelope.id}`}
          keyboardShouldPersistTaps="handled"
          // The field is focused on open (`useAutoFocus`), so the keyboard is up before the first
          // result exists and this list is the only thing under it. iOS lays a ScrollView out at full
          // height regardless, so the bottom rows sat behind the keyboard with no way to reach them
          // but dismissing it: `automaticallyAdjustKeyboardInsets` insets the content by the keyboard
          // instead. (Android needs nothing - `adjustResize` shrinks the window, and the list with it.)
          automaticallyAdjustKeyboardInsets
          // Scrolling the results puts the keyboard away, the iOS search convention - the list is
          // long, the query is already typed.
          keyboardDismissMode="on-drag"
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ paddingBottom: contentBottom }}
          ListHeaderComponent={
            <Meta fontWeight="700" color={theme.textFaint} paddingHorizontal={16} paddingTop={14} testID="searchCount">
              {/* The store returns one past the cap so this can tell "exactly 100" from "at least
                  100" - the difference between a count and a claim. */}
              {results.length > SEARCH_LIMIT
                ? t('search.count.capped', { n: SEARCH_LIMIT })
                : t(`search.count.${plural(results.length)}`, {
                    n: results.length,
                  })}
            </Meta>
          }
          renderSectionHeader={({ section }) => <SectionHead label={section.label} />}
          renderItem={({ item, section, index }) => {
            // The day is printed once, beside the first row of that day in the section.
            const before = index > 0 ? section.data[index - 1] : null;
            const showDay = before == null || !sameDay(before.envelope.deliveryTime, item.envelope.deliveryTime);
            // A search spans every box, so every row says which one, as the merged view's rows do.
            const box = accountByBox.get(item.boxId);
            const open = () => onOpenMessage(item.boxId, item.envelope.id, item.folder);
            return item.folder === 'sent' ? (
              <SentRegisterRow
                message={item.envelope}
                now={now}
                showDay={showDay}
                onOpen={open}
                folder={item.folder}
                boxAccount={box}
              />
            ) : (
              <RegisterRow
                message={item.envelope}
                now={now}
                termDate={termDates.get(item.envelope.id) ?? null}
                showDay={showDay}
                onOpen={open}
                folder={item.folder}
                boxAccount={box}
              />
            );
          }}
        />
      )}
    </YStack>
  );
}

/**
 * Empty query, and no matches: the archive as a stack of envelopes (031 R4), the search's own object,
 * where a lone centred sentence and later a grey glyph were (2026-09-09 critique). "No matches" is not
 * on the board; it keeps the stack and says so.
 */
function Hint() {
  return (
    <EmptyObject
      object={<EnvelopePose pose="archive" />}
      title={t('search.hint.title')}
      body={t('search.hint')}
      testID="searchHint"
    />
  );
}

function NoResults() {
  return (
    <YStack paddingTop={60} paddingHorizontal={24} alignItems="center" testID="searchNoResults">
      <EnvelopePose pose="archive" />
      <Title alignSelf="stretch" textAlign="center" marginTop={36} accessibilityRole="header">
        {t('search.noResults')}
      </Title>
    </YStack>
  );
}

interface SearchSection {
  key: string;
  label: DateSectionLabel;
  data: MessageSearchHit[];
}

function sameDay(a: number | null, b: number | null): boolean {
  if (a == null || b == null) {
    return false;
  }
  return new Date(a).toDateString() === new Date(b).toDateString();
}
