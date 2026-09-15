// Every component under one licence identifier (012 §5, gap G1).
//
// The Licence screen shows a few members per group; this is where the rest live, because the notice
// obligation is per component and a sampled list would leave most notices unreproduced. One group has
// ~168 members, so the list is plain and dense on purpose - the link to the licence text sits above it
// rather than being repeated on every row.

import { XStack, YStack } from '../../theme/ui';
import { BodyStrong, Caption, Label } from '../../theme/Typography';
import { useTheme } from '../../theme/ThemeProvider';
import { ChevronRightIcon, FileIcon } from '../../theme/icons';
import { t } from '../../i18n/strings';
import { ATTRIBUTION_GROUPS } from '../../content/attributions.generated';
import { SubScreen } from './SubScreen';

export function LicenceGroupScreen({
  spdx,
  onBack,
  onOpenText,
}: {
  readonly spdx: string;
  readonly onBack: () => void;
  readonly onOpenText: () => void;
}) {
  const theme = useTheme();
  const group = ATTRIBUTION_GROUPS.find(g => g.spdx === spdx);
  const components = group?.components ?? [];

  return (
    <SubScreen title={spdx} onBack={onBack} paddingTop={16}>
      <XStack
        backgroundColor={theme.surface}
        borderWidth={1}
        borderColor={theme.border}
        borderRadius={14}
        paddingVertical={13}
        paddingHorizontal={14}
        marginBottom={14}
        alignItems="center"
        justifyContent="space-between"
        onPress={onOpenText}
        pressStyle={{ backgroundColor: theme.surfaceAlt }}
        accessibilityRole="button"
        testID="licence-full-text"
      >
        <XStack alignItems="center" gap={10}>
          <FileIcon size={18} color={theme.blue} />
          <Label fontSize={14} dense color={theme.blue}>
            {t('licences.fullText')}
          </Label>
        </XStack>
        <ChevronRightIcon size={16} color={theme.blue} />
      </XStack>

      <YStack
        backgroundColor={theme.surface}
        borderWidth={1}
        borderColor={theme.border}
        borderRadius={14}
        overflow="hidden"
      >
        {components.map((component, i) => (
          <XStack
            key={`${component.name}@${component.version}`}
            paddingVertical={11}
            paddingHorizontal={14}
            gap={10}
            alignItems="baseline"
            borderBottomWidth={i === components.length - 1 ? 0 : 1}
            borderBottomColor={theme.border}
          >
            <YStack flex={1} minWidth={0}>
              <BodyStrong fontSize={14} dense color={theme.text} numberOfLines={1}>
                {component.name}
              </BodyStrong>
              {/* The reason this screen exists - each component's own notice, reproduced. */}
              <Caption
                fontSize={11}
                lineHeight={15}
                color={theme.textFaint}
                marginTop={3}
              >
                {component.copyright}
              </Caption>
            </YStack>
            <Caption fontSize={12} dense color={theme.textFaint} flexShrink={0}>
              {component.version}
            </Caption>
          </XStack>
        ))}
      </YStack>
    </SubScreen>
  );
}
