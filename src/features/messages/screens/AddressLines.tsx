// The addressee's address, laid out (feature 015). ONE component for all three places it appears -
// a recipient search result, the picked recipient on compose, and a message's counterparty on the
// detail - so the three cannot drift apart in weight, colour or spacing (Principle V).
//
// The weighting is the load-bearing part and comes from the design: the street is muted, and the
// post code + town line is BOLD in the primary text colour. That is deliberate. When a search
// returns three people called Jan Novak, the town is the word that separates them, so it is the word
// the eye has to land on. Reversing this would show the whole address and still fail the user.
//
// Nothing here truncates. Every line wraps. The defect this feature exists to remove was a single
// clipped line that kept just enough of the address to look present while cutting the part that
// identified the person.

import { Body } from '../../../theme/Typography';
import { YStack } from '../../../theme/ui';
import { fonts } from '../../../theme/typography';
import { useTheme } from '../../../theme/ThemeProvider';
import { t } from '../../../i18n/strings';
import { addressParts } from '../state/addressParts';

export function AddressLines({
  address,
  marginTop = 5,
}: {
  /** The address exactly as ISDS composed it, or null when it returned none. */
  readonly address: string | null | undefined;
  /** Spacing above the block - 5 on compose, 4 on the detail, matching the design. */
  readonly marginTop?: number;
}) {
  const theme = useTheme();
  const parts = addressParts(address);

  if (parts.kind === 'none') {
    // States what the RECORD contains, never anything about the person: ISDS returned no address.
    // The spec originally forbade any placeholder here; the design showed one and was right - in a
    // block that otherwise carries two lines, a silent gap reads as a loading failure. See the
    // amendment on FR-004.
    //
    // The design draws this italic. No italic face is bundled (Public Sans ships here in five
    // upright weights), and React Native will not synthesise one for a named family - it would
    // silently render upright anyway. The faint colour carries the distinction instead.
    return (
      <YStack marginTop={marginTop}>
        <Body
          fontFamily={fonts.bodyMedium}
          fontSize={13}
          lineHeight={18}
          color={theme.textFaint}
        >
          {t('recipient.noAddress')}
        </Body>
      </YStack>
    );
  }

  if (parts.kind === 'whole') {
    return (
      <YStack marginTop={marginTop}>
        <Body
          fontFamily={fonts.bodySemiBold}
          fontSize={13}
          lineHeight={18}
          color={theme.text}
        >
          {parts.text}
        </Body>
      </YStack>
    );
  }

  return (
    <YStack marginTop={marginTop}>
      <Body
        fontFamily={fonts.bodyMedium}
        fontSize={13}
        lineHeight={18}
        color={theme.textMuted}
      >
        {parts.line1}
      </Body>
      <Body
        fontFamily={fonts.bodyBold}
        fontSize={13}
        lineHeight={18}
        color={theme.text}
      >
        {parts.line2}
      </Body>
    </YStack>
  );
}
