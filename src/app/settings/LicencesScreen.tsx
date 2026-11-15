// Licence - the app's own licence plus every third-party notice (012 §3/§5), ported from the design.
//
// Four parts, as board R13 draws them (031 I48, agreed 2026-11-12): the app's MIT licence as a card,
// a search field, the bundled non-npm components, then one row per licence identifier. Grouping is what
// makes 261 components legible - a flat list is a wall nobody reads - and each licence opens a screen
// listing all of its members. One row per licence, no members sampled under it (the owner,
// 2026-11-15, reading R13's cut-off card).
//
// Each component's COPYRIGHT notice is what MIT, ISC and BSD require to be reproduced. It is reproduced
// where R13 puts it: inside that component's licence text, which every component's row opens
// (`licenceText.ts`). The shared licence body is stored once per identifier; the notices per component.

import { useMemo, useState } from 'react';
import { XStack, YStack } from '../../theme/ui';
import { Caption, Heading, Label, Meta, SmallStrong } from '../../theme/Typography';
import { useTheme } from '../../theme/ThemeProvider';
import { ChevronRightIcon } from '../../theme/icons';
import LogoMark from '../../assets/logo.svg';
import { plural, t } from '../../i18n/strings';
import {
  ATTRIBUTION_GROUPS,
  ATTRIBUTION_TOTAL,
  BUNDLED_COMPONENTS,
  LICENCE_TEXTS,
  type AttributionComponent,
} from '../../content/attributions.generated';
import { APP_VERSION } from '../appInfo';
import { useLocale } from './SettingsProvider';
import { SubScreen } from './SubScreen';
import { Card } from '../../theme/Card';
import { GroupHead, RowDivider } from './SettingsSection';
import { space } from '../../theme/spacing';
import { LicenceChip, LicenceRow, LicenceSearch, NoMatch, normalize } from './LicenceParts';

/** What a licence text screen shows: a licence, and the component whose notice it carries, if any. */
export interface LicenceTextParams {
  readonly spdx: string;
  readonly component?: AttributionComponent;
}

type Match = AttributionComponent & { spdx: string };

/** Only a component's own fields go to the text screen - the route carries them. */
const own = ({ name, version, copyright }: AttributionComponent): AttributionComponent => ({
  name,
  version,
  copyright,
});

export function LicencesScreen({
  onBack,
  onOpenGroup,
  onOpenText,
}: {
  readonly onBack: () => void;
  readonly onOpenGroup: (spdx: string) => void;
  readonly onOpenText: (text: LicenceTextParams) => void;
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
      ...BUNDLED_COMPONENTS.map(c => ({ ...own(c), spdx: c.spdx })),
      ...ATTRIBUTION_GROUPS.flatMap(g => g.components.map(c => ({ ...own(c), spdx: g.spdx }))),
    ];
    return pool.filter(c => normalize(c.name).includes(needle) || normalize(c.spdx).includes(needle));
  }, [searching, trimmed]);

  const app: AttributionComponent = {
    name: t('licences.appName'),
    version: APP_VERSION,
    copyright: t('licences.copyright'),
  };

  return (
    <SubScreen title={t('licences.title')} onBack={onBack} paddingTop={space.inset}>
      {searching ? null : (
        // The app's own licence, first - what the person is actually being granted. Its opening lines;
        // the whole text, with the notice, is a press away.
        <Card
          onPress={() => onOpenText({ spdx: 'MIT', component: app })}
          pressStyle={{ backgroundColor: theme.surfaceAlt }}
          accessibilityRole="button"
          accessibilityLabel={`${t('licences.appName')}, ${t('licences.appSpdx')}`}
          testID="licence-app"
        >
          <YStack padding={space.xl} gap={space.md}>
            <XStack alignItems="center" gap={space.lg}>
              <YStack width={40} height={40} borderRadius={11} overflow="hidden">
                <LogoMark width={40} height={40} />
              </YStack>
              <YStack flex={1} minWidth={0}>
                <Heading>{t('licences.appName')}</Heading>
                <Label color={theme.textMuted}>{t('licences.appSpdx')}</Label>
              </YStack>
            </XStack>
            <Caption color={theme.bodyText}>{t('licences.copyright')}</Caption>
            <Meta color={theme.textMuted} numberOfLines={4}>
              {LICENCE_TEXTS.MIT.split(/\n\s*\n/)[1]?.replace(/\s*\n\s*/g, ' ')}
            </Meta>
          </YStack>
        </Card>
      )}

      <YStack marginTop={searching ? 0 : space.xl}>
        <LicenceSearch value={query} onChange={setQuery} />
      </YStack>

      {searching ? (
        results.length === 0 ? (
          <NoMatch />
        ) : (
          <YStack marginTop={space.xl}>
            <Card>
              {results.map((c, i) => (
                <YStack key={`${c.name}@${c.version}`}>
                  {i > 0 ? <RowDivider /> : null}
                  <LicenceRow
                    title={c.name}
                    line={c.version}
                    end={<LicenceChip spdx={c.spdx} />}
                    onPress={() => onOpenText({ spdx: c.spdx, component: own(c) })}
                    accessibilityLabel={`${c.name}, ${c.spdx}`}
                    testID={`licence-row-${c.name}`}
                  />
                </YStack>
              ))}
            </Card>
          </YStack>
        )
      ) : (
        <>
          {/* The components a dependency scan cannot see. Listed in full, and first, because they are
              the ones a curious reader recognises - the app's typefaces and the library encrypting
              their archive. */}
          <GroupHead label={t('licences.bundled')} note={t('licences.bundled.desc')} />
          <Card>
            {BUNDLED_COMPONENTS.map((c, i) => (
              <YStack key={c.name}>
                {i > 0 ? <RowDivider /> : null}
                <LicenceRow
                  title={c.name}
                  line={`${locale === 'en' ? c.kindEn : c.kindCs} · ${c.version}`}
                  end={<LicenceChip spdx={c.spdx} />}
                  onPress={() => onOpenText({ spdx: c.spdx, component: own(c) })}
                  accessibilityLabel={`${c.name}, ${c.spdx}`}
                  testID={`licence-row-${c.name}`}
                />
              </YStack>
            ))}
          </Card>

          <GroupHead
            label={t('licences.thirdParty')}
            note={t(`licences.count.${plural(ATTRIBUTION_TOTAL)}`, { n: ATTRIBUTION_TOTAL })}
          />
          <Card>
            {ATTRIBUTION_GROUPS.map((group, i) => {
              const count = t(`licences.groupCount.${plural(group.count)}`, { n: group.count });
              return (
                <YStack key={group.spdx}>
                  {i > 0 ? <RowDivider /> : null}
                  <XStack
                    alignItems="center"
                    gap={space.lg}
                    minHeight={52}
                    paddingVertical={space.md}
                    paddingHorizontal={space.xl}
                    onPress={() => onOpenGroup(group.spdx)}
                    pressStyle={{ backgroundColor: theme.surfaceAlt }}
                    accessibilityRole="button"
                    accessibilityLabel={`${group.spdx}, ${count}`}
                    testID={`licence-group-${group.spdx}`}
                  >
                    <SmallStrong flex={1} color={theme.text}>
                      {group.spdx}
                    </SmallStrong>
                    <Caption color={theme.textMuted}>{count}</Caption>
                    <ChevronRightIcon size={18} color={theme.textMuted} />
                  </XStack>
                </YStack>
              );
            })}
          </Card>
        </>
      )}
    </SubScreen>
  );
}

