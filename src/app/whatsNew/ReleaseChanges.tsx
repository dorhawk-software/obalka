// One release's changes, as the What's new sheet and the Co je nového screen both draw them (spec 029):
// a section per kind (Nové, Lepší, ...), each an overline over a list, and each change one paragraph -
// its sentence in bold ink, the rest after it in body text - behind a faint dot, as board R9 draws it
// (031 I49, agreed 2026-11-12: "grouped by kind, each item's bold sentence first, as the changelog
// writes it"). On the sheet or the screen itself: until 2026-11-15 each kind was a card of rows. One
// component, so the two places cannot drift apart (constitution V).

import { Fragment } from 'react';
import { useWindowDimensions } from 'react-native';
import { XStack, YStack } from '../../theme/ui';
import { Overline, Small, SmallStrong, Subheading } from '../../theme/Typography';
import { useTheme } from '../../theme/ThemeProvider';
import { space } from '../../theme/spacing';
import { type as typeScale } from '../../theme/typeScale';
import { getActiveLocale, t } from '../../i18n/strings';
import { typesetFor } from '../../i18n/typeset';
import {
  CHANGE_KINDS,
  type ChangelogEntry,
  type ChangelogRelease,
} from '../../content/changelog.generated';
import { releaseDate } from './whatsNew';

/** The list's dot: 5 across, centred on the paragraph's first line. */
const DOT = 5;

export function ReleaseChanges({
  release,
  withHeading,
}: {
  readonly release: ChangelogRelease;
  /** "Verze 0.2.0 · 12.11.2026" above the kinds - where more than one release is listed. */
  readonly withHeading: boolean;
}) {
  const theme = useTheme();
  return (
    <YStack testID={`release-${release.version}`}>
      {withHeading ? (
        <Subheading accessibilityRole="header" marginTop={space.inset}>
          {t('changelog.release', { version: release.version, date: releaseDate(release.date) })}
        </Subheading>
      ) : null}
      {CHANGE_KINDS.map(kind => {
        const list = release.changes[kind];
        if (!list || list.length === 0) {
          return null;
        }
        return (
          <Fragment key={kind}>
            <Overline color={theme.textFaint} marginTop={space.inset} accessibilityRole="header">
              {t(`whatsNew.kind.${kind}`)}
            </Overline>
            <YStack gap={space.base} marginTop={space.base}>
              {list.map((entry, i) => (
                <ChangeItem key={i} entry={entry} testID={`change-${release.version}-${kind}-${i}`} />
              ))}
            </YStack>
          </Fragment>
        );
      })}
    </YStack>
  );
}

function ChangeItem({ entry, testID }: { readonly entry: ChangelogEntry; readonly testID: string }) {
  const theme = useTheme();
  // The language `t()` is speaking: this content is written per language and shown in the same one.
  const locale = getActiveLocale();
  // The first line's height at the reader's text size, so the dot sits on its middle (031 I135).
  const firstLine = typeScale.small.lineHeight * useWindowDimensions().fontScale;
  return (
    <XStack gap={space.md} alignItems="flex-start">
      <YStack
        height={firstLine}
        justifyContent="center"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        testID={`${testID}-dot`}
      >
        <YStack width={DOT} height={DOT} borderRadius={999} backgroundColor={theme.textFaint} />
      </YStack>
      <Small flex={1} color={theme.bodyText} testID={testID}>
        <SmallStrong color={theme.text}>
          {typesetFor(locale, entry.lead)}
        </SmallStrong>
        {entry.body ? ` ${typesetFor(locale, entry.body)}` : ''}
      </Small>
    </XStack>
  );
}
