// One licence, in full (012 §3), as board R13 draws it (031 I48): the component's name as the title,
// its version and licence under it, and the text on a card.
// Opened from a component's row, the text carries that component's own copyright notice, set where the
// licence keeps one - the notice MIT, ISC and BSD require each copy to reproduce. Opened from a group's
// "Úplné znění licence", the licence alone.
//
// The text is never truncated, summarised or "tidied up"; Apache-2.0 runs to ~11 000 characters and
// simply scrolls. Its paragraphs flow (the owner, 2026-11-15) - `licenceText.ts` says what that changes,
// which is only line-break whitespace.
//
// Roundings from the board: the text's 12/18 monospace is the Meta role, 12/16 in Public Sans - the
// type scale has no monospaced role, and a face is a role (DESIGN.md › Typography; no new roles).

import { YStack } from '../../theme/ui';
import { Heading, Meta } from '../../theme/Typography';
import { useTheme } from '../../theme/ThemeProvider';
import { Card } from '../../theme/Card';
import { space } from '../../theme/spacing';
import { LICENCE_TEXTS, type AttributionComponent } from '../../content/attributions.generated';
import { SubScreen } from './SubScreen';
import { flowParagraphs, withNotice } from './licenceText';

export function LicenceDetailScreen({
  spdx,
  component,
  onBack,
}: {
  readonly spdx: string;
  /** The component whose notice the text carries; absent for a licence on its own. */
  readonly component?: AttributionComponent;
  readonly onBack: () => void;
}) {
  const theme = useTheme();
  const body = LICENCE_TEXTS[spdx] ?? '';
  const text = flowParagraphs(component ? withNotice(body, component.copyright) : body);
  const title = component?.name ?? spdx;
  return (
    <SubScreen title={title} onBack={onBack} paddingTop={space.inset}>
      <YStack gap={space.hair} marginBottom={space.lg}>
        <Heading testID="licence-text-name">{title}</Heading>
        {component ? (
          <Meta color={theme.textFaint} testID="licence-text-meta">
            {`${component.version} · ${spdx}`}
          </Meta>
        ) : null}
      </YStack>
      <Card>
        <YStack padding={space.xl}>
          <Meta color={theme.bodyText} selectable testID="licence-text">
            {text}
          </Meta>
        </YStack>
      </Card>
    </SubScreen>
  );
}
