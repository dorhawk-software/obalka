// One release's changes, as the What's new sheet and the Co je nového screen both draw them (spec 029):
// a section per kind (Nové, Lepší, ...) in the settings' own furniture, each change a card row with its
// point in the row-title face and the explanation under it. One component, so the two places cannot
// drift apart (constitution V).

import { Fragment } from 'react';
import { YStack } from '../../theme/ui';
import { Label, Subheading } from '../../theme/Typography';
import { useTheme } from '../../theme/ThemeProvider';
import { space } from '../../theme/spacing';
import { getActiveLocale, t } from '../../i18n/strings';
import { typesetFor } from '../../i18n/typeset';
import {
  CHANGE_KINDS,
  type ChangelogEntry,
  type ChangelogRelease,
} from '../../content/changelog.generated';
import { Card, RowTitle, Section } from '../settings/SettingsSection';
import { releaseDate } from './whatsNew';

export function ReleaseChanges({
  release,
  withHeading,
}: {
  readonly release: ChangelogRelease;
  /** "Verze 0.2.0 · 12.11.2026" above the kinds - where more than one release is listed. */
  readonly withHeading: boolean;
}) {
  return (
    <YStack testID={`release-${release.version}`}>
      {withHeading ? (
        <Subheading accessibilityRole="header" marginLeft={space.xs} marginBottom={space.md}>
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
            <Section label={t(`whatsNew.kind.${kind}`)}>
              <Card overflow="hidden">
                {list.map((entry, i) => (
                  <ChangeRow key={i} entry={entry} last={i === list.length - 1} />
                ))}
              </Card>
            </Section>
          </Fragment>
        );
      })}
    </YStack>
  );
}

function ChangeRow({ entry, last }: { readonly entry: ChangelogEntry; readonly last: boolean }) {
  const theme = useTheme();
  // The language `t()` is speaking: this content is written per language and shown in the same one.
  const locale = getActiveLocale();
  return (
    <YStack
      gap={space.xs}
      paddingVertical={space.row}
      paddingHorizontal={space.xl}
      borderBottomWidth={last ? 0 : 1}
      borderBottomColor={theme.border}
    >
      <RowTitle>{typesetFor(locale, entry.lead)}</RowTitle>
      {entry.body ? (
        <Label fontWeight="400" color={theme.bodyText}>
          {typesetFor(locale, entry.body)}
        </Label>
      ) : null}
    </YStack>
  );
}
