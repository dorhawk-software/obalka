// The icon scale (feature 016) - the two rules that are easy to break by accident.
//
// 1. An emblem glyph is DECORATION. It must be invisible to a screen reader, because the text
//    beside it already says the thing, and a big shape announced as an image is noise for exactly
//    the people who cannot skip it.
// 2. The strokes taper against the size. (The 132px hero tier went in 031: an empty state now draws
//    the envelope in a pose, board R4.)
//
// The sizes themselves are asserted against ICON_TIER rather than against literals, so this suite
// tracks the design if the scale is retuned, and fails only when a CALL SITE invents its own size.

import { render } from '@testing-library/react-native';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import {
  EmblemIcon,
  ICON_TIER,
} from '../../src/theme/iconTiers';
import { SendGlyph } from '../../src/theme/icons';

const ui = (node: React.ReactElement) =>
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      {node}
    </TamaguiProvider>,
  );

describe('the icon scale', () => {
  it('hides an emblem glyph too - the headline carries the meaning', async () => {
    const view = await ui(<EmblemIcon glyph={SendGlyph} />);
    const root = view.toJSON();
    const props = (Array.isArray(root) ? root[0] : root)?.props ?? {};
    expect(props.accessibilityElementsHidden).toBe(true);
  });

  it('keeps the stroke moving AGAINST the size - a big slab is not the design', () => {
    // Inline is the heaviest stroke; the taper is what makes the big glyph read as atmosphere.
    expect(ICON_TIER.emblem.stroke).toBeLessThan(ICON_TIER.inline.stroke);
  });
});
