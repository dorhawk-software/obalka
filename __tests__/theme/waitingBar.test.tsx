// The wait with nothing to count yet (025 T027): the progress bar's own track, with a segment
// travelling along it. The walk rejected both a still line (it read as a hang) and the platform
// spinner (nobody's design, and a 20-point box that made the gap under the stage twice the one above).

import { render } from '@testing-library/react-native';
import { act } from 'react';
import { useReducedMotion } from 'react-native-reanimated';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { WaitingBar } from '../../src/theme/ProgressBar';

const bar = () =>
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <WaitingBar label="Navazuji spojení…" testID="waiting" />
    </TamaguiProvider>,
  );

async function laidOut(view: Awaited<ReturnType<typeof bar>>) {
  await act(async () => {
    view.getByTestId('waiting').props.onLayout({ nativeEvent: { layout: { width: 300, height: 6 } } });
  });
}

/** How many nodes hang under the track: the travelling segment, or nothing. */
const segments = (view: Awaited<ReturnType<typeof bar>>) => {
  const track = view.toJSON() as { children?: unknown[] | null } | null;
  return track?.children?.length ?? 0;
};

afterEach(() => (useReducedMotion as jest.Mock).mockReturnValue(false));

describe('WaitingBar', () => {
  it('is the progress bar track: six points tall, so swapping one for the other moves nothing', async () => {
    const view = await bar();
    const style = [view.getByTestId('waiting').props.style].flat(Infinity);
    expect(Object.assign({}, ...style)).toMatchObject({ height: 6 });
  });

  it('says it is busy without claiming a fraction', async () => {
    const props = (await bar()).getByTestId('waiting').props;
    expect(props.accessibilityRole).toBe('progressbar');
    expect(props.accessibilityState).toEqual({ busy: true });
    expect(props.accessibilityLabel).toBe('Navazuji spojení…');
    expect(props.accessibilityValue).toBeUndefined();
  });

  it('draws the travelling segment once it knows how wide the track is', async () => {
    const view = await bar();
    expect(segments(view)).toBe(0);
    await laidOut(view);
    expect(segments(view)).toBe(1);
  });

  it('leaves the empty track under Reduce Motion', async () => {
    (useReducedMotion as jest.Mock).mockReturnValue(true);
    const view = await bar();
    await laidOut(view);
    expect(segments(view)).toBe(0);
  });
});
