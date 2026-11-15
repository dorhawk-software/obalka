// What the three licence screens share, as board R13 draws it (031 I48, agreed 2026-11-12): the search
// field on the page's own tone, the row (a name over its line, the licence as a chip, the chevron), and
// the no-results state - the glyph in a disc and one sentence. The search glyph is the post's own offset
// print, as the board's sprite draws it.
//
// Roundings from the board: the chip's 12/16 700 is the Meta role at its 700; the rows' 9 above and below
// is 10. Composed, not rounded: the no-results disc's 110 under the field is the empty state's 60, the
// hero's 36 and the card's 14.

import type { ReactNode } from 'react';
import { Input, XStack, YStack } from '../../theme/ui';
import { Body, Meta, Small } from '../../theme/Typography';
import { ChevronRightIcon } from '../../theme/icons';
import { OffsetIcon } from '../../theme/offsetIcons';
import { useTheme } from '../../theme/ThemeProvider';
import { space } from '../../theme/spacing';
import { type as typeScale } from '../../theme/typeScale';
import { t } from '../../i18n/strings';

/** Diacritic- and case-insensitive, so "sqlcipher" finds SQLCipher. */
export function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/** The search field (R13): 44 tall, the 12 corner, a hairline, the page's tone under it. */
export function LicenceSearch({
  value,
  onChange,
}: {
  readonly value: string;
  readonly onChange: (text: string) => void;
}) {
  const theme = useTheme();
  return (
    <XStack
      alignItems="center"
      gap={space.base}
      minHeight={44}
      paddingHorizontal={space.xl}
      borderRadius={12}
      borderWidth={1}
      borderColor={theme.border}
      backgroundColor={theme.bg}
    >
      <OffsetIcon name="search" size={18} color={theme.textMuted} />
      <Input
        flex={1}
        minHeight={42}
        padding={0}
        borderWidth={0}
        backgroundColor="transparent"
        fontSize={typeScale.body.fontSize}
        color={theme.text}
        placeholder={t('licences.searchPlaceholder')}
        placeholderTextColor={theme.textFaint}
        value={value}
        onChangeText={onChange}
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel={t('licences.searchPlaceholder')}
        testID="licence-search"
      />
    </XStack>
  );
}

/** A licence's identifier as R13's chip: the sunken tone, muted 12/16 bold. */
export function LicenceChip({ spdx }: { readonly spdx: string }) {
  const theme = useTheme();
  return (
    <Meta
      fontWeight="700"
      color={theme.textMuted}
      backgroundColor={theme.surfaceSunken}
      borderRadius={8}
      paddingVertical={space.hair}
      paddingHorizontal={space.base}
      overflow="hidden"
      flexShrink={0}
    >
      {spdx}
    </Meta>
  );
}

/**
 * One row of a licence card (R13): what it is over its quieter line, then whatever stands at its end
 * (the licence's chip, or a group's count), then the chevron, since every row opens something.
 */
export function LicenceRow({
  title,
  line,
  end,
  strong = false,
  onPress,
  accessibilityLabel,
  testID,
}: {
  readonly title: string;
  /** The quieter line under the title: a version, a kind and a version. */
  readonly line?: string;
  readonly end: ReactNode;
  /** A licence group's row: its identifier in bold, alone on its line. */
  readonly strong?: boolean;
  readonly onPress: () => void;
  readonly accessibilityLabel: string;
  readonly testID: string;
}) {
  const theme = useTheme();
  return (
    <XStack
      alignItems="center"
      gap={space.lg}
      minHeight={52}
      paddingVertical={space.md}
      paddingHorizontal={space.xl}
      onPress={onPress}
      pressStyle={{ backgroundColor: theme.surfaceAlt }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      <YStack flex={1} minWidth={0}>
        <Small fontWeight={strong ? '700' : '600'} color={theme.text} numberOfLines={1}>
          {title}
        </Small>
        {line ? <Meta color={theme.textFaint}>{line}</Meta> : null}
      </YStack>
      {end}
      <ChevronRightIcon size={18} color={theme.textMuted} />
    </XStack>
  );
}

/** Nothing matched (R13): the search glyph in a sunken disc, and one sentence under it. */
export function NoMatch() {
  const theme = useTheme();
  return (
    <YStack
      alignItems="center"
      paddingTop={space.empty + space.hero + space.xl}
      paddingHorizontal={space.section}
      testID="licence-no-results"
    >
      <YStack
        width={96}
        height={96}
        borderRadius={999}
        backgroundColor={theme.surfaceSunken}
        alignItems="center"
        justifyContent="center"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        testID="licence-no-results-disc"
      >
        <OffsetIcon name="search" size={52} color={theme.text} />
      </YStack>
      <Body color={theme.textMuted} textAlign="center" marginTop={space.section}>
        {t('licences.noResults')}
      </Body>
    </YStack>
  );
}
