// The rail connectors are DRAWN, not described (reported from an iPhone 15 Pro, 2026-08-19).
//
// `borderStyle: 'dotted'` with a one-sided border (`borderLeftWidth`) renders as a solid line on iOS:
// RN's iOS border layer only applies a dash pattern to a uniform border. Android honours per-side
// dashes, so the delivery rails looked right on the emulator all along and wrong on a real phone -
// the exact failure mode a device walk exists to catch, and one that no Android device would ever
// show.
//
// The test therefore asserts the ABSENCE of the old approach as much as the presence of the new one:
// a future "simplification" back to a border would pass any test that only checked for a line.

import { act, render } from '@testing-library/react-native';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { DottedRail } from '../../src/theme/DottedRail';

const rail = (props: Partial<Parameters<typeof DottedRail>[0]> = {}) =>
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <DottedRail color="#2A5C9A" {...props} />
    </TamaguiProvider>,
  );

/** Every node in the tree, so we can look for an SVG line without depending on host names. */
function nodes(view: Awaited<ReturnType<typeof render>>): { props: Record<string, unknown> }[] {
  const out: { props: Record<string, unknown> }[] = [];
  const walk = (n: unknown): void => {
    if (n == null || typeof n !== 'object') {
      return;
    }
    const node = n as { props?: Record<string, unknown>; children?: unknown[] };
    if (node.props) {
      out.push({ props: node.props });
    }
    for (const child of node.children ?? []) {
      walk(child);
    }
  };
  walk(view.toJSON());
  return out;
}

describe('the dotted rail', () => {
  it('draws nothing until it has been measured', async () => {
    // Its height comes from the step beside it, so there is nothing to draw on the first pass. A
    // frame of nothing beats a frame of the wrong length - the row is already holding the space.
    const view = await rail();
    const line = nodes(view).find(n => n.props?.strokeDasharray != null);
    expect(line).toBeUndefined();
  });

  it('draws a dashed SVG line once it knows its height', async () => {
    const view = await rail();
    const container = nodes(view).find(n => typeof n.props?.onLayout === 'function');
    expect(container).toBeTruthy();
    const onLayout = container?.props.onLayout as (e: {
      nativeEvent: { layout: { height: number; width: number } };
    }) => void;
    await act(async () => {
      onLayout({ nativeEvent: { layout: { height: 40, width: 2 } } });
    });
    const line = nodes(view).find(n => n.props?.strokeDasharray != null);
    expect(line).toBeTruthy();
    // react-native-svg normalises what it renders: the cap becomes its native enum (round = 1) and
    // the colour becomes a packed int, so assert on those rather than on what was passed in.
    expect(line?.props.strokeLinecap).toBe(1);
    expect(line?.props.strokeDasharray).toEqual(['0.001', '4']);
    // The line spans exactly the measured height - no guessed length, no clipping.
    expect(line?.props.y2).toBe(40);
    expect(line?.props.y1).toBe(0);
  });

  it('never falls back to a one-sided dotted border, which is the bug', async () => {
    const view = await rail();
    const offenders = nodes(view).filter(
      n => n.props?.borderStyle === 'dotted' || n.props?.borderLeftWidth != null,
    );
    expect(offenders).toEqual([]);
  });
});
