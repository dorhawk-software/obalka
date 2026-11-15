// Every component under one licence identifier (012 §5, gap G1), as board R13 draws it (031 I48): the
// licence and its count as the title, the link to its full text, the search, and the components as one
// card - each its name over its version, the licence's chip and the chevron, opening that component's
// own text with its copyright notice in it, the obligation this screen exists for.
//
// Roundings from the board: the link's 4 above and 2 at the sides are the scale's 4 and its 2; the 12
// under it is 12.

import { useMemo, useState } from 'react';
import { XStack, YStack } from '../../theme/ui';
import { SmallStrong } from '../../theme/Typography';
import { useTheme } from '../../theme/ThemeProvider';
import { ExternalLinkIcon } from '../../theme/icons';
import { textSlop } from '../../theme/touchTarget';
import { plural, t } from '../../i18n/strings';
import { ATTRIBUTION_GROUPS } from '../../content/attributions.generated';
import { SubScreen } from './SubScreen';
import { Card } from '../../theme/Card';
import { RowDivider } from './SettingsSection';
import { space } from '../../theme/spacing';
import { LicenceChip, LicenceRow, LicenceSearch, NoMatch, normalize } from './LicenceParts';
import type { LicenceTextParams } from './LicencesScreen';

export function LicenceGroupScreen({
  spdx,
  onBack,
  onOpenText,
}: {
  readonly spdx: string;
  readonly onBack: () => void;
  readonly onOpenText: (text: LicenceTextParams) => void;
}) {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const group = ATTRIBUTION_GROUPS.find(g => g.spdx === spdx);
  const count = group?.count ?? 0;
  const needle = normalize(query.trim());
  const components = useMemo(
    () => (group?.components ?? []).filter(c => !needle || normalize(c.name).includes(needle)),
    [group, needle],
  );

  return (
    <SubScreen
      title={`${spdx} · ${t(`licences.groupCount.${plural(count)}`, { n: count })}`}
      onBack={onBack}
      paddingTop={space.lg}
    >
      <XStack
        alignSelf="flex-start"
        alignItems="center"
        gap={space.sm}
        paddingTop={space.xs}
        paddingHorizontal={space.hair}
        paddingBottom={space.lg}
        hitSlop={textSlop('smallStrong')}
        pressStyle={{ opacity: 0.6 }}
        onPress={() => onOpenText({ spdx })}
        accessibilityRole="link"
        accessibilityLabel={t('licences.fullText')}
        testID="licence-full-text"
      >
        <ExternalLinkIcon size={16} color={theme.blue} />
        <SmallStrong color={theme.blue}>{t('licences.fullText')}</SmallStrong>
      </XStack>

      <LicenceSearch value={query} onChange={setQuery} />

      {components.length === 0 ? (
        <NoMatch />
      ) : (
        <YStack marginTop={space.xl}>
          <Card>
            {components.map((component, i) => (
              <YStack key={`${component.name}@${component.version}`}>
                {i > 0 ? <RowDivider /> : null}
                <LicenceRow
                  title={component.name}
                  line={component.version}
                  end={<LicenceChip spdx={spdx} />}
                  onPress={() => onOpenText({ spdx, component })}
                  accessibilityLabel={`${component.name}, ${spdx}`}
                  testID={`licence-row-${component.name}`}
                />
              </YStack>
            ))}
          </Card>
        </YStack>
      )}
    </SubScreen>
  );
}
