// The gap between whatever is above a screen's own header and the header (`useHeaderTop`).
//
// The message detail's header asked for 14 under the TestEnvBanner and got 12 under a bare status bar,
// and 12 under Debug mode's recording strip, which hands the screen a spent inset instead of saying a
// strip is there. Both strips reserve one row so a screen under either lays its content out in the same
// place (`StatusStrip.tsx`); the 14 put that header 2dp lower under one strip than under the other
// (review, 2026-09-15).

import { readFileSync } from 'fs';
import { join } from 'path';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { space } from '../../src/theme/spacing';
import { HEADER_GAP, useHeaderTop } from '../../src/theme/useHeaderTop';

const DESIGN = readFileSync(join(__dirname, '../../DESIGN.md'), 'utf8');

/** DESIGN.md's spacing scale, read from its front matter rather than retyped here. */
const SPACING = [
  ...DESIGN.split('\nspacing:\n')[1].split(/\n\S/)[0].matchAll(/"(\d+)px"/g),
].map(m => Number(m[1]));

function Probe({ bannerAbove }: { readonly bannerAbove: boolean }) {
  return <Text testID="headerTop">{String(useHeaderTop(bannerAbove))}</Text>;
}

/** What the hook returns under a status-bar inset of `top`. */
async function headerTop(top: number, bannerAbove: boolean): Promise<number> {
  const view = await render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top, left: 0, right: 0, bottom: 34 },
      }}
    >
      <Probe bannerAbove={bannerAbove} />
    </SafeAreaProvider>,
  );
  return Number(view.getByTestId('headerTop').props.children);
}

describe('the gap above a screen s own header', () => {
  it('is the same below the status bar, below the test banner and below the recording strip', async () => {
    const inset = 47;
    const belowStatusBar = (await headerTop(inset, false)) - inset;
    // The banner has cleared the inset itself and the screen says so.
    const belowTestBanner = await headerTop(inset, true);
    // The recording strip has cleared it and handed the screen a spent inset instead.
    const belowRecordingStrip = await headerTop(0, false);

    expect(belowTestBanner).toBe(belowStatusBar);
    expect(belowRecordingStrip).toBe(belowStatusBar);
  });

  it('takes that gap from DESIGN.md s spacing scale', async () => {
    // A scale was read at all, so the containment below cannot pass against an empty one.
    expect(SPACING).toEqual(Object.values(space));
    expect(SPACING).toContain(HEADER_GAP);
    expect(await headerTop(0, true)).toBe(HEADER_GAP);
  });
});
