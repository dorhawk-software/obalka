// One licence, in full (012 §3).
//
// The text is reproduced VERBATIM and must stay that way: it is never truncated, re-wrapped,
// summarized or "tidied up". Apache-2.0 runs to ~11 000 characters and simply scrolls. The bodies are
// stored once per identifier - each component's own copyright notice is shown beside the component,
// not here, because that is the part that differs between them.

import { Body } from '../../theme/Typography';
import { useTheme } from '../../theme/ThemeProvider';
import { LICENCE_TEXTS } from '../../content/attributions.generated';
import { SubScreen } from './SubScreen';

export function LicenceDetailScreen({
  spdx,
  onBack,
}: {
  readonly spdx: string;
  readonly onBack: () => void;
}) {
  const theme = useTheme();
  return (
    <SubScreen
      title={spdx}
      onBack={onBack}
      paddingTop={20}
      paddingHorizontal={18}
      paddingBottom={32}
    >
      <Body fontSize={13} lineHeight={20} color={theme.bodyText}>
        {LICENCE_TEXTS[spdx] ?? ''}
      </Body>
    </SubScreen>
  );
}
