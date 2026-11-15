// The way on after a restore (backup, transfer) is the screen's one filled action, so it is R14's
// primary: 52 tall, the 14 corner. Until 2026-11-15 it drew a face of its own at 48 (031 I123).

import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { ContinueButton } from '../../src/app/settings/ContinueButton';

type Node = { props?: { style?: unknown }; children?: (Node | string)[] | null };

/** Every style in the rendered tree, flattened. */
function styles(node: Node | Node[] | null): Record<string, unknown>[] {
  if (node == null) {
    return [];
  }
  if (Array.isArray(node)) {
    return node.flatMap(styles);
  }
  const own = node.props?.style ? [StyleSheet.flatten(node.props.style as never) as Record<string, unknown>] : [];
  const kids = (node.children ?? []).filter((c): c is Node => typeof c !== 'string');
  return [...own, ...kids.flatMap(styles)];
}

it('is the primary button: 52 tall with the 14 corner', async () => {
  const view = await render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <ContinueButton onPress={() => {}} testID="go-on" />
    </TamaguiProvider>,
  );
  const face = styles(view.toJSON() as Node).find(s => s.minHeight != null);
  expect(face).toMatchObject({ minHeight: 52, borderTopLeftRadius: 14 });
});
