// Licence - the app's own licence plus every third-party notice (012 §3/§5), ported from the design.
//
// Four parts: the app's MIT licence as a card, a search field, the bundled non-npm components, then
// everything else grouped by licence identifier. Grouping is what makes 174 components legible - a
// flat list is a wall nobody reads - and each group opens a screen listing all of its members.
//
// The per-component COPYRIGHT line is the point of this screen, not decoration: MIT, ISC and BSD all
// require each component's own notice to be reproduced. The shared licence body is stored once per
// identifier; the notices are per component.

import { useMemo, useState, type ReactNode } from 'react';
import { Input, XStack, YStack } from '../../theme/ui';
import {
  Badge,
  Body,
  BodyStrong,
  Caption,
  Label,
  Title,
} from '../../theme/Typography';
import { useTheme } from '../../theme/ThemeProvider';
import { ChevronRightIcon, SearchIcon } from '../../theme/icons';
import LogoMark from '../../assets/logo.svg';
import { plural, t } from '../../i18n/strings';
import {
  ATTRIBUTION_GROUPS,
  ATTRIBUTION_TOTAL,
  BUNDLED_COMPONENTS,
  LICENCE_TEXTS,
  type AttributionComponent,
} from '../../content/attributions.generated';
import { useLocale } from './SettingsProvider';
import { SubScreen } from './SubScreen';

/** How many members of a group to preview before "show all". */
const SAMPLE_COUNT = 3;

type Match = AttributionComponent & { spdx: string };

/** Diacritic- and case-insensitive, so "sqlcipher" finds SQLCipher and "reagovat" isn't required. */
function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export function LicencesScreen({
  onBack,
  onOpenGroup,
  onOpenText,
}: {
  readonly onBack: () => void;
  readonly onOpenGroup: (spdx: string) => void;
  readonly onOpenText: (spdx: string) => void;
}) {
  const theme = useTheme();
  const locale = useLocale();
  const [query, setQuery] = useState('');

  const trimmed = query.trim();
  const searching = trimmed.length > 0;

  const results = useMemo<Match[]>(() => {
    if (!searching) {
      return [];
    }
    const needle = normalize(trimmed);
    const pool: Match[] = [
      ...BUNDLED_COMPONENTS.map(c => ({ ...c, spdx: c.spdx })),
      ...ATTRIBUTION_GROUPS.flatMap(g =>
        g.components.map(c => ({ ...c, spdx: g.spdx })),
      ),
    ];
    return pool.filter(
      c => normalize(c.name).includes(needle) || normalize(c.spdx).includes(needle),
    );
  }, [searching, trimmed]);

  return (
    <SubScreen title={t('licences.title')} onBack={onBack}>
        {/* The app's own licence, first - what the user is actually being granted. */}
        <YStack
          backgroundColor={theme.surface}
          borderWidth={1}
          borderColor={theme.border}
          borderRadius={16}
          padding={16}
          marginBottom={22}
        >
          <XStack alignItems="center" gap={11}>
            <YStack width={40} height={40} borderRadius={11} overflow="hidden">
              <LogoMark width={40} height={40} />
            </YStack>
            <YStack flex={1} minWidth={0}>
              <Title fontSize={18} color={theme.text}>
                {t('licences.appName')}
              </Title>
              <Label fontSize={13} color={theme.textMuted}>
                {t('licences.appSpdx')}
              </Label>
            </YStack>
          </XStack>
          <Caption fontSize={13} color={theme.textMuted} marginTop={12}>
            {t('licences.copyright')}
          </Caption>
          <Body
            fontSize={13}
            lineHeight={19}
            color={theme.bodyText}
            marginTop={10}
          >
            {LICENCE_TEXTS.MIT}
          </Body>
        </YStack>

        <XStack marginBottom={16} alignItems="center">
          <YStack position="absolute" left={13} zIndex={1}>
            <SearchIcon size={18} color={theme.textFaint} />
          </YStack>
          <Input
            flex={1}
            minHeight={46}
            borderWidth={1}
            borderColor={theme.borderStrong}
            borderRadius={14}
            backgroundColor={theme.surface}
            paddingLeft={40}
            paddingRight={14}
            color={theme.text}
            placeholder={t('licences.searchPlaceholder')}
            placeholderTextColor={theme.textFaint}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel={t('licences.searchPlaceholder')}
            testID="licence-search"
          />
        </XStack>

        {searching ? (
          results.length === 0 ? (
            <YStack paddingVertical={36} paddingHorizontal={20}>
              <Caption fontSize={14} color={theme.textFaint} textAlign="center">
                {t('licences.noResults')}
              </Caption>
            </YStack>
          ) : (
            <Card>
              {results.map((component, i) => (
                <ComponentRow
                  key={`${component.name}@${component.version}`}
                  component={component}
                  spdx={component.spdx}
                  last={i === results.length - 1}
                  onPress={() => onOpenText(component.spdx)}
                />
              ))}
            </Card>
          )
        ) : (
          <>
            {/* The four components a dependency scan cannot see. Listed in full, and first, because
                they are the ones a curious reader recognises - the app's typefaces and the library
                encrypting their archive. */}
            <GroupLabel>{t('licences.bundled')}</GroupLabel>
            <Caption
              fontSize={12}
              lineHeight={16}
              color={theme.textFaint}
              marginHorizontal={4}
              marginBottom={10}
            >
              {t('licences.bundled.desc')}
            </Caption>
            <YStack marginBottom={22}>
              <Card>
                {BUNDLED_COMPONENTS.map((component, i) => (
                  <ComponentRow
                    key={component.name}
                    component={component}
                    spdx={component.spdx}
                    kind={locale === 'en' ? component.kindEn : component.kindCs}
                    last={i === BUNDLED_COMPONENTS.length - 1}
                    onPress={() => onOpenText(component.spdx)}
                  />
                ))}
              </Card>
            </YStack>

            <GroupLabel>{t('licences.thirdParty')}</GroupLabel>
            <Caption
              fontSize={12}
              lineHeight={16}
              color={theme.textFaint}
              marginHorizontal={4}
              marginBottom={10}
            >
              {t(`licences.count.${plural(ATTRIBUTION_TOTAL)}`, {
                n: ATTRIBUTION_TOTAL,
              })}
            </Caption>
            <YStack gap={14}>
              {ATTRIBUTION_GROUPS.map(group => (
                <YStack key={group.spdx}>
                  <XStack
                    alignItems="baseline"
                    justifyContent="space-between"
                    marginHorizontal={4}
                    marginBottom={7}
                  >
                    <BodyStrong fontSize={14} dense color={theme.text}>
                      {group.spdx}
                    </BodyStrong>
                    <Caption fontSize={12} dense color={theme.textFaint}>
                      {t(`licences.groupCount.${plural(group.count)}`, {
                        n: group.count,
                      })}
                    </Caption>
                  </XStack>
                  <Card>
                    {group.components.slice(0, SAMPLE_COUNT).map(component => (
                      <ComponentRow
                        key={`${component.name}@${component.version}`}
                        component={component}
                        spdx={group.spdx}
                        last={false}
                        onPress={() => onOpenText(group.spdx)}
                      />
                    ))}
                    <XStack
                      paddingVertical={11}
                      paddingHorizontal={14}
                      alignItems="center"
                      justifyContent="space-between"
                      onPress={() => onOpenGroup(group.spdx)}
                      pressStyle={{ backgroundColor: theme.surfaceAlt }}
                      accessibilityRole="button"
                      testID={`licence-group-${group.spdx}`}
                    >
                      <Label fontSize={13} dense color={theme.blue}>
                        {t(`licences.showAll.${plural(group.count)}`, {
                          n: group.count,
                        })}
                      </Label>
                      <ChevronRightIcon size={16} color={theme.blue} />
                    </XStack>
                  </Card>
                </YStack>
              ))}
            </YStack>
          </>
        )}
    </SubScreen>
  );
}

function Card({ children }: { readonly children: ReactNode }) {
  const theme = useTheme();
  return (
    <YStack
      backgroundColor={theme.surface}
      borderWidth={1}
      borderColor={theme.border}
      borderRadius={14}
      overflow="hidden"
    >
      {children}
    </YStack>
  );
}

/**
 * One component: name, an optional kind/version line, and - the part that matters legally - its own
 * copyright notice. Tapping opens the licence text its identifier refers to.
 */
export function ComponentRow({
  component,
  spdx,
  kind,
  last,
  onPress,
}: {
  readonly component: AttributionComponent;
  readonly spdx: string;
  readonly kind?: string;
  readonly last: boolean;
  readonly onPress?: () => void;
}) {
  const theme = useTheme();
  return (
    <XStack
      paddingVertical={12}
      paddingHorizontal={14}
      gap={10}
      alignItems="flex-start"
      borderBottomWidth={last ? 0 : 1}
      borderBottomColor={theme.border}
      {...(onPress
        ? {
            onPress,
            accessibilityRole: 'button' as const,
            pressStyle: { backgroundColor: theme.surfaceAlt },
          }
        : null)}
    >
      <YStack flex={1} minWidth={0}>
        <BodyStrong fontSize={14} dense color={theme.text} numberOfLines={1}>
          {component.name}
        </BodyStrong>
        <Caption fontSize={12} dense color={theme.textFaint} marginTop={1}>
          {kind ? `${kind} · ${component.version}` : component.version}
        </Caption>
        <Caption
          fontSize={11}
          lineHeight={15}
          color={theme.textFaint}
          marginTop={3}
        >
          {component.copyright}
        </Caption>
      </YStack>
      <Badge
        fontSize={11}
        color={theme.textMuted}
        backgroundColor={theme.surfaceSunken}
        borderRadius={7}
        paddingVertical={3}
        paddingHorizontal={8}
        flexShrink={0}
      >
        {spdx}
      </Badge>
    </XStack>
  );
}

function GroupLabel({ children }: { readonly children: string }) {
  const theme = useTheme();
  return (
    <Badge
      fontSize={12}
      textTransform="uppercase"
      letterSpacing={0.4}
      color={theme.textFaint}
      marginLeft={4}
      marginBottom={5}
    >
      {children}
    </Badge>
  );
}
