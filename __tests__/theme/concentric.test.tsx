// Nested rounded corners run parallel (DESIGN.md, the Concentric Rule, 2026-10-03).

import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { concentric } from '../../src/theme/radius';
import { BoxPill } from '../../src/features/messages/screens/BoxPill';
import type { DataBoxAccount } from '../../src/services/isds/types';

describe('concentric', () => {
  it('is the outer radius less the gap, never below square', () => {
    expect(concentric(7, 2)).toBe(5);
    expect(concentric(11, 3)).toBe(8);
    expect(concentric(8, 12)).toBe(0);
  });
});

describe('the merged list box pill', () => {
  it('holds its monogram chip concentric, the same gap on every side the corner touches', async () => {
    // The owner's report: the chip's corner rounded at a different rate from the pill's.
    const account = { boxId: 'abc', label: 'Ondřej Dvořák', alias: null, color: '#2A5C9A' };
    const view = await render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <BoxPill account={account as DataBoxAccount} />
      </TamaguiProvider>,
    );
    const pill = StyleSheet.flatten(view.getByTestId('boxPill-abc').props.style);
    const chip = StyleSheet.flatten(view.getByTestId('boxPill-abc-monogram', { includeHiddenElements: true }).props.style);
    expect(pill.paddingLeft).toBe(pill.paddingTop);
    expect(pill.paddingTop).toBe(pill.paddingBottom);
    // Tamagui writes a radius out per corner; the chip's left corners are the ones nested in the pill's.
    const outer = pill.borderTopLeftRadius ?? pill.borderRadius;
    const inner = chip.borderTopLeftRadius ?? chip.borderRadius;
    expect(outer).toBeGreaterThan(0);
    expect(inner).toBe(concentric(outer, pill.paddingTop));
    expect(chip.borderBottomLeftRadius ?? inner).toBe(inner);
  });
});
