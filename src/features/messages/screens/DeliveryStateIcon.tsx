// A message's delivery state as a glyph, in the design's fixed 18×18 slot. Shared by the sent list
// row, the sent detail's timeline and the FAQ legend so they can never drift apart - the same state
// must draw the same mark everywhere.
//
// The slot is a FIXED 18×18 box holding a 16×16 glyph: it reserves its space up front, so a row keeps
// its height whichever state it shows and nothing shifts as a message advances (constitution V). The
// design carries the state's wording in a `title` tooltip; on a phone that becomes the accessibility
// label, which is the only thing left announcing the state once the visible text is gone.
//
// Two of the five marks are SOLID discs with a knocked-out figure - `accepted` (a check) and `stop`
// (a diagonal). They share a circle and a radius on purpose: terminal success and terminal failure
// are the same *kind* of event, and reading them as a pair is how a glance tells them apart from the
// two in-transit marks. `fiction` reuses the accepted disc and is distinguished by colour alone,
// exactly as the design draws it - at 16px a second solid figure would be mush.

import { XStack } from '../../../theme/ui';
import { useTheme } from '../../../theme/ThemeProvider';
import {
  StatusAcceptedIcon,
  StatusDeliveredIcon,
  StatusSentIcon,
  StatusStopIcon,
} from '../../../theme/icons';
import type { MessageStateKind } from '../state/messageState';

export function DeliveryStateIcon({
  kind,
  color,
  label,
  /**
   * What the solid marks knock their figure out against. Defaults to the card colour the glyph sits
   * on; the `stop` mark on a list row sits on the same paper, so the default is right there too.
   */
  knockout,
}: {
  readonly kind: MessageStateKind;
  readonly color: string;
  /** The state's wording ("Doručeno fikcí") - invisible, but announced by the screen reader. */
  readonly label?: string;
  readonly knockout?: string;
}) {
  const theme = useTheme();
  const paper = knockout ?? theme.surface;
  const glyph =
    kind === 'accepted' || kind === 'fiction' ? (
      <StatusAcceptedIcon size={16} color={color} knockout={paper} />
    ) : kind === 'stop' ? (
      <StatusStopIcon size={16} color={color} knockout={paper} />
    ) : kind === 'delivered' ? (
      <StatusDeliveredIcon size={16} color={color} />
    ) : (
      <StatusSentIcon size={16} color={color} />
    );
  return (
    <XStack
      width={18}
      height={18}
      flexShrink={0}
      alignItems="center"
      justifyContent="center"
      accessible={label != null}
      accessibilityLabel={label}
    >
      {glyph}
    </XStack>
  );
}
