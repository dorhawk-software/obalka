import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { TamaguiProvider } from 'tamagui';
import { useReducedMotion } from 'react-native-reanimated';
import { tamaguiConfig } from '../../tamagui.config';
import { SwipeableRow } from '../../src/theme/SwipeableRow';

// SwipeableRow's real gesture/animation is native (verified on-device). Here we smoke-test its
// contract over the mocked swipeable (see jest.setup.js): the trailing action renders, and Reduce
// Motion drops the swipe so the row falls back to its overflow-menu path.

const action = {
  label: 'Odebrat',
  color: '#ffffff',
  background: '#cc0000',
  onPress: jest.fn(),
  testID: 'swipeRemove',
};

function ui(node: React.ReactElement) {
  return render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      {node}
    </TamaguiProvider>,
  );
}

describe('SwipeableRow (US4)', () => {
  it('renders the row and its trailing destructive action', async () => {
    (useReducedMotion as jest.Mock).mockReturnValue(false);
    const view = await ui(
      <SwipeableRow rightAction={action}>
        <Text>Row body</Text>
      </SwipeableRow>,
    );
    expect(view.getByText('Row body')).toBeTruthy();
    expect(view.getByTestId('swipeRemove')).toBeTruthy();
    expect(view.getByText('Odebrat')).toBeTruthy();
  });

  it('with Reduce Motion drops the swipe gesture (overflow menu is the fallback)', async () => {
    (useReducedMotion as jest.Mock).mockReturnValue(true);
    const view = await ui(
      <SwipeableRow rightAction={action}>
        <Text>Row body</Text>
      </SwipeableRow>,
    );
    expect(view.getByText('Row body')).toBeTruthy();
    expect(view.queryByTestId('swipeRemove')).toBeNull();
  });
});

// ── A swiped row must occlude what it uncovers ──────────────────────────────────────────────────
//
// Reported 2026-09-10: swiping a backup looked like the row and the red delete button smeared into
// each other, while the identical gesture on a compose draft was clean. The difference was not the
// gesture - it was the child. A draft passes a self-contained card that paints `surface`; a backup
// passes `CardRow`, which paints nothing and takes its colour from the `Card` behind it. Sliding a
// transparent row shows the action straight through it.
describe('bodyBackground', () => {
  /** Walk up from the child looking for an ancestor that actually paints this colour. */
  function paintsAbove(node: unknown, colour: string): boolean {
    let cur = node as { parent?: unknown; props?: { style?: unknown } } | null;
    while (cur) {
      const style = cur.props?.style;
      const flat = Array.isArray(style)
        ? Object.assign({}, ...style.filter(Boolean))
        : (style as Record<string, unknown> | undefined);
      if (flat?.backgroundColor === colour) {
        return true;
      }
      cur = cur.parent as typeof cur;
    }
    return false;
  }

  it('wraps the child in an opaque layer when given one', async () => {
    (useReducedMotion as jest.Mock).mockReturnValue(false);
    const view = await ui(
      <SwipeableRow bodyBackground="#FFFDF8" rightAction={action}>
        <Text testID="row-child">Záloha</Text>
      </SwipeableRow>,
    );
    expect(paintsAbove(view.getByTestId('row-child').parent, '#FFFDF8')).toBe(
      true,
    );
  });

  it('paints nothing when the child is its own card', async () => {
    // The drafts case: a rectangle behind a rounded card would show at the corners.
    (useReducedMotion as jest.Mock).mockReturnValue(false);
    const view = await ui(
      <SwipeableRow rightAction={action}>
        <Text testID="row-child">Koncept</Text>
      </SwipeableRow>,
    );
    expect(paintsAbove(view.getByTestId('row-child').parent, '#FFFDF8')).toBe(
      false,
    );
  });
});
