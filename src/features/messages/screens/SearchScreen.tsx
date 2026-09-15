// Local-archive search (feature 004). Searches the cached envelopes across ALL boxes by their text
// (subject / sender / recipient / addresses), accent- and case-insensitively. Works fully offline -
// it only reads the local cache. Debounced search-as-you-type; a hit opens that message's detail.

import { useEffect, useMemo, useRef, useState } from 'react';
import { ScreenHeader } from '../../../theme/ScreenHeader';
import { FlatList, type TextInput } from 'react-native';
import { useContentBottom } from '../../../theme/useContentBottom';
import { useAutoFocus } from '../../../theme/useAutoFocus';
import { Input, XStack, YStack } from '../../../theme/ui';
import { Body, Caption, Heading } from '../../../theme/Typography';
import { useTheme } from '../../../theme/ThemeProvider';
import {
  SearchGlyph,
} from '../../../theme/icons';
import { HeroIcon } from '../../../theme/iconTiers';
import { EmptyState } from '../../../theme/EmptyState';
import { Skeleton } from '../../../theme/Skeleton';
import { Avatar } from '../../../theme/Avatar';
import { fonts } from '../../../theme/typography';
import { rowDate } from '../state/groupByDate';
import { searchRowLabel } from '../state/rowLabel';
import { plural, t } from '../../../i18n/strings';
import type { DataBoxAccount } from '../../../services/isds/types';
import { SEARCH_LIMIT } from '../../../services/db/messagesStore';
import type {
  MessageFolder,
  MessageSearchHit,
} from '../../../services/db/messagesStore';
import { messagesController } from '../../accounts/deps';



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
  /** What the list actually shows: never more than the cap, whatever the store handed back. */
  const shown = results.slice(0, SEARCH_LIMIT);
  const [searching, setSearching] = useState(false);

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
        content={
          <XStack
            flex={1}
            alignItems="center"
            minHeight={44}
            paddingHorizontal={14}
            borderRadius={12}
            backgroundColor={theme.bg}
            borderWidth={1}
            borderColor={theme.border}
          >
            <Input
              ref={fieldRef}
              flex={1}
              minHeight={44}
              backgroundColor="transparent"
              borderWidth={0}
              paddingHorizontal={0}
              fontSize={15}
              color={theme.text}
              placeholderTextColor={theme.textFaint}
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
      ) : searching && results.length === 0 ? (
        <YStack>
          {[0, 1, 2, 3, 4].map(i => (
            <ResultRowSkeleton key={i} />
          ))}
        </YStack>
      ) : results.length === 0 ? (
        <NoResults theme={theme} />
      ) : (
        <FlatList
          data={shown}
          keyExtractor={h => `${h.boxId}:${h.envelope.id}`}
          keyboardShouldPersistTaps="handled"
          // The field is focused on open (`useAutoFocus`), so the keyboard is up before the first
          // result exists and this
          // list is the only thing under it. iOS lays a ScrollView out at full height regardless, so
          // the bottom rows sat behind the keyboard with no way to reach them but dismissing it:
          // `automaticallyAdjustKeyboardInsets` insets the content by the keyboard instead. (Android
          // needs nothing - `adjustResize` shrinks the window, and the list with it.)
          automaticallyAdjustKeyboardInsets
          // Scrolling the results puts the keyboard away, the iOS search convention - the list is
          // long, the query is already typed.
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingBottom: contentBottom }}
          ListHeaderComponent={
            <Caption
              fontFamily={fonts.bodyBold}
              fontSize={12}
              fontWeight="700"
              color={theme.textFaint}
              paddingHorizontal={18}
              paddingTop={14}
              paddingBottom={6}
            >
              {/* The store returns one past the cap so this can tell "exactly 100" from "at least
                  100" - the difference between a count and a claim. */}
              {results.length > SEARCH_LIMIT
                ? t('search.count.capped', { n: SEARCH_LIMIT })
                : t(`search.count.${plural(results.length)}`, {
                    n: results.length,
                  })}
            </Caption>
          }
          renderItem={({ item }) => (
            <ResultRow
              hit={item}
              account={accountByBox.get(item.boxId)}
              onPress={() =>
                onOpenMessage(item.boxId, item.envelope.id, item.folder)
              }
            />
          )}
        />
      )}
    </YStack>
  );
}

/**
 * Empty query - the app's shared empty state, glyph and all.
 *
 * It was a lone centred sentence pinned near the top of an otherwise blank screen, while every other
 * empty state in the app (both inbox folders, both licence screens) uses `EmptyState` with a hero
 * glyph and a headline. Nothing about search justified being the exception (2026-09-09 critique).
 */
function Hint() {
  return (
    <EmptyState
      icon={<HeroIcon glyph={SearchGlyph} />}
      title={t('search.hint.title')}
      subtitle={t('search.hint')}
      marginTop={60}
    />
  );
}

/** No matches - a bare 44px search glyph (no sunken circle) + a Bricolage heading. */
function NoResults({ theme }: { readonly theme: ReturnType<typeof useTheme> }) {
  return (
    <YStack paddingVertical={56} paddingHorizontal={36} alignItems="center">
      <HeroIcon glyph={SearchGlyph} />
      <Heading
        fontSize={17}
        fontWeight="700"
        color={theme.text}
        marginTop={14}
        textAlign="center"
      >
        {t('search.noResults')}
      </Heading>
    </YStack>
  );
}

/** Loading placeholder mirroring ResultRow (avatar + party/date + subject + box-name chip). */
function ResultRowSkeleton() {
  const theme = useTheme();
  return (
    <XStack
      paddingHorizontal={18}
      paddingVertical={13}
      gap={12}
      alignItems="flex-start"
      borderTopWidth={1}
      borderTopColor={theme.border}
    >
      <Skeleton width={38} height={38} radius={11} />
      <YStack flex={1} gap={8} paddingTop={3}>
        <XStack alignItems="center" justifyContent="space-between">
          <Skeleton width={150} height={13} radius={6} />
          <Skeleton width={62} height={11} radius={6} />
        </XStack>
        <Skeleton width="72%" height={13} radius={6} />
        <Skeleton width={84} height={18} radius={8} />
      </YStack>
    </XStack>
  );
}

function ResultRow({
  hit,
  account,
  onPress,
}: {
  readonly hit: MessageSearchHit;
  readonly account?: DataBoxAccount;
  readonly onPress: () => void;
}) {
  const theme = useTheme();
  const { envelope } = hit;
  const boxName = account?.alias ?? account?.label;
  return (
    <XStack
      paddingHorizontal={18}
      paddingVertical={13}
      gap={12}
      alignItems="flex-start"
      borderTopWidth={1}
      borderTopColor={theme.border}
      pressStyle={{ backgroundColor: theme.surfaceAlt }}
      onPress={onPress}
      accessibilityRole="button"
      // One sentence per hit, box included - a search that spans every box is only useful if the
      // answer says WHICH box, and that fact is a pill a screen reader would otherwise read last and
      // loose, if at all.
      accessibilityLabel={searchRowLabel({
        party: envelope.sender || '—',
        subject: envelope.subject || t('messages.noSubject'),
        date: rowDate(envelope.deliveryTime, Date.now()),
        box: boxName ?? hit.boxId,
      })}
      testID={`result-${hit.boxId}-${envelope.id}`}
    >
      <Avatar name={envelope.sender} size={38} />
      <YStack flex={1}>
        <XStack alignItems="center" gap={7}>
          <Body
            flex={1}
            minWidth={0}
            fontFamily={fonts.bodyBold}
            fontSize={14}
            lineHeight={17}
            fontWeight="700"
            color={theme.text}
            numberOfLines={1}
          >
            {envelope.sender || '—'}
          </Body>
          <Caption
            fontFamily={fonts.bodyRegular}
            fontSize={12}
            lineHeight={16}
            fontWeight="400"
            color={theme.textFaint}
          >
            {rowDate(envelope.deliveryTime, Date.now())}
          </Caption>
        </XStack>
        <Body
          fontSize={13}
          lineHeight={16}
          color={theme.textMuted}
          marginTop={2}
          numberOfLines={1}
        >
          {envelope.subject || t('messages.noSubject')}
        </Body>
        {/* Box-name pill. */}
        <XStack
          alignSelf="flex-start"
          marginTop={6}
          paddingHorizontal={7}
          paddingVertical={2}
          borderRadius={6}
          backgroundColor={theme.surfaceSunken}
        >
          <Caption
            fontFamily={fonts.bodySemiBold}
            fontSize={11}
            lineHeight={14}
            fontWeight="600"
            color={theme.textMuted}
            numberOfLines={1}
          >
            {boxName ?? hit.boxId}
          </Caption>
        </XStack>
      </YStack>
    </XStack>
  );
}
