// The envelope's folds run corner to corner over the whole envelope (031). Seen on the R8 walk,
// 2026-11-13, by the owner: on the sign-in's envelope they stopped 34 short of the right edge and 32
// short of the bottom - the envelope's padding. The drawing sat in the padded envelope with a
// percentage size, and Yoga sizes a percentage against the content box, inside the padding. The
// message detail and its band drew the same short folds.
//
// So the drawing lies in a layer of its own, absolutely filling the envelope, with no padding of its
// own: its 100% is then the whole envelope.

import { render } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { AppThemeProvider } from '../../src/theme/ThemeProvider';
import { Envelope } from '../../src/theme/objects/Envelope';

type Json = { type: string; props: Record<string, unknown>; children: (Json | string)[] | null };

/** The drawing's host and the node that holds it. */
function svgAndParent(node: Json, parent: Json | null = null): { svg: Json; parent: Json | null } | null {
  if (node.type === 'RNSVGSvgView') {
    return { svg: node, parent };
  }
  for (const child of node.children ?? []) {
    if (typeof child !== 'string') {
      const found = svgAndParent(child, node);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

const PADDING = ['padding', 'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight', 'paddingHorizontal', 'paddingVertical'];

describe('the envelope s folds', () => {
  it('lie in a layer that fills the whole envelope, not its padded content', async () => {
    const view = await render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <AppThemeProvider isDark={false}>
          <Envelope style={{ width: 300, minHeight: 186, paddingVertical: 16, paddingHorizontal: 18 }}>
            <Text>k8tw2e</Text>
          </Envelope>
        </AppThemeProvider>
      </TamaguiProvider>,
    );
    const found = svgAndParent(view.toJSON() as unknown as Json);
    expect(found).not.toBeNull();
    const layer = StyleSheet.flatten(found!.parent!.props.style as never) as Record<string, unknown>;
    expect(layer).toEqual(expect.objectContaining({ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }));
    for (const key of PADDING) {
      expect(layer[key] ?? 0).toBe(0);
    }
  });
});
