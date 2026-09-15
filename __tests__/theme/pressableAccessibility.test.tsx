// A pressable that VoiceOver cannot reach (impeccable audit, 2026-09-09).
//
// Tamagui routes `onPress` through its own gesture layer and never sets RN's `accessible` prop.
// Android survives that - `accessibilityLabel` becomes a `contentDescription`, which makes the
// ViewGroup focusable for TalkBack, which is why every uiautomator pass on this project looked
// clean. iOS does not: `isAccessibilityElement` comes from `accessible` alone, so a labelled,
// role-tagged `XStack onPress` is a control the VoiceOver cursor never lands on. That was every
// switch in the app, every back chevron, inbox search and the compose ✕.
//
// Two halves, tested here because each one is invisible in review:
//   1. a pressable stack IS an accessibility element
//   2. an overlay wrapper is NOT - RN's Pressable defaults `accessible` to true, and on iOS an
//      accessibility element is a LEAF, so a scrim spanning the dialog swallowed every control
//      inside it into one blob that could be dismissed but never confirmed.

import { render } from '@testing-library/react-native';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { AppThemeProvider } from '../../src/theme/ThemeProvider';
import { XStack, YStack, Text } from '../../src/theme/ui';
import { Toggle } from '../../src/theme/Toggle';
import { Dialog } from '../../src/theme/Dialog';

const wrap = (ui: React.ReactElement) =>
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <AppThemeProvider isDark={false}>{ui}</AppThemeProvider>
    </TamaguiProvider>,
  );

describe('pressable stacks', () => {
  it('reach the native view as accessibility elements', async () => {
    // The mechanical claim: the prop survives Tamagui and lands on the host node. Everything else
    // here depends on that being true.
    const view = await wrap(
      <XStack onPress={() => {}} accessibilityRole="button" testID="target">
        <Text>Press me</Text>
      </XStack>,
    );
    expect(view.getByTestId('target').props.accessible).toBe(true);
  });

  it('leave non-pressable stacks alone', async () => {
    // Marking every layout box as an element would flood the screen reader with stops.
    const view = await wrap(<YStack testID="layout" />);
    expect(view.getByTestId('layout').props.accessible).toBeUndefined();
  });

  it('let an explicit value win, in both directions', async () => {
    const view = await wrap(
      <>
        <XStack onPress={() => {}} accessible={false} testID="opt-out" />
        <YStack accessible testID="opt-in" />
      </>,
    );
    expect(view.getByTestId('opt-out').props.accessible).toBe(false);
    expect(view.getByTestId('opt-in').props.accessible).toBe(true);
  });

  it('makes the app switch focusable - it is the only hit area in its row', async () => {
    const view = await wrap(
      <Toggle value={false} onChange={() => {}} label="Zámek aplikace" testID="sw" />,
    );
    const node = view.getByTestId('sw');
    expect(node.props.accessible).toBe(true);
    expect(node.props.accessibilityRole).toBe('switch');
    expect(node.props.accessibilityLabel).toBe('Zámek aplikace');
  });
});

describe('overlay wrappers', () => {
  it('do not swallow the dialog they contain', async () => {
    const view = await wrap(
      <Dialog
        title="Smazat?"
        body="B"
        onDismiss={() => {}}
        testID="dlg"
        actions={[
          { label: 'Ponechat', onPress: () => {}, testID: 'keep' },
          { label: 'Smazat', onPress: () => {}, tone: 'danger', testID: 'del' },
        ]}
      />,
    );

    // Both buttons must be reachable in their own right. If either wrapper were an element, iOS
    // would stop at it and neither of these would ever receive focus.
    for (const id of ['keep', 'del']) {
      expect(view.getByTestId(id).props.accessible).not.toBe(false);
    }
    // …and the card announces itself as a modal container so the cursor stays inside it.
    expect(view.getByTestId('dlg').props.accessibilityViewIsModal).toBe(true);
  });
});
