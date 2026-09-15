// The icon scale (feature 016) - the two rules that are easy to break by accident.
//
// 1. A hero or emblem glyph is DECORATION. It must be invisible to a screen reader, because the text
//    beside it already says the thing, and a 132px shape announced as an image is noise for exactly
//    the people who cannot skip it.
// 2. A hero occupies a FIXED box. The glyph cannot resize anything when it renders - the layout-jump
//    rule the app has now broken twice.
//
// The sizes themselves are asserted against ICON_TIER rather than against literals, so this suite
// tracks the design if the scale is retuned, and fails only when a CALL SITE invents its own size.

import { render } from '@testing-library/react-native';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import {
  EmblemIcon,
  HeroIcon,
  ICON_TIER,
} from '../../src/theme/iconTiers';
import { MailGlyph, SendGlyph } from '../../src/theme/icons';

const ui = (node: React.ReactElement) =>
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      {node}
    </TamaguiProvider>,
  );

describe('the icon scale', () => {
  it('hides a hero glyph from assistive technology', async () => {
    const view = await ui(<HeroIcon glyph={MailGlyph} />);
    const root = view.toJSON();
    const props = (Array.isArray(root) ? root[0] : root)?.props ?? {};
    expect(props.accessibilityElementsHidden).toBe(true);
    expect(props.importantForAccessibility).toBe('no-hide-descendants');
  });

  it('hides an emblem glyph too - the headline carries the meaning', async () => {
    const view = await ui(<EmblemIcon glyph={SendGlyph} />);
    const root = view.toJSON();
    const props = (Array.isArray(root) ? root[0] : root)?.props ?? {};
    expect(props.accessibilityElementsHidden).toBe(true);
  });

  it('gives a hero a fixed box, so it cannot shift what is around it', async () => {
    const view = await ui(<HeroIcon glyph={MailGlyph} />);
    const root = view.toJSON();
    const style = (Array.isArray(root) ? root[0] : root)?.props?.style ?? {};
    const flat = Array.isArray(style) ? Object.assign({}, ...style) : style;
    expect(flat.width).toBe(ICON_TIER.hero.size);
    expect(flat.height).toBe(ICON_TIER.hero.size);
  });

  it('keeps the stroke moving AGAINST the size - a 132px slab is not the design', () => {
    // Inline is the heaviest stroke and hero the lightest; the taper is what makes the big glyph
    // read as atmosphere rather than as a wall.
    expect(ICON_TIER.hero.stroke).toBeLessThan(ICON_TIER.emblem.stroke);
    expect(ICON_TIER.emblem.stroke).toBeLessThan(ICON_TIER.inline.stroke);
  });
});
