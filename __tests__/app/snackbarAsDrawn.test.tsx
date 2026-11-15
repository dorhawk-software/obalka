// The snackbar as board R9 draws it (031 I60, agreed 2026-11-12): ink, 52 tall at the least with the
// 14 corner, the words in the bold small role and the action in the flap's gold in a 44 row; 6 over the
// compose stamp while the stamp is on screen, 14 over the bottom edge otherwise; it fades out rather
// than vanishing.

import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { AppState, StyleSheet, type StyleProp, type TextStyle } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { AppThemeProvider } from '../../src/theme/ThemeProvider';
import { lightTheme } from '../../src/theme/theme';
import { type as typeScale } from '../../src/theme/typeScale';
import { SnackbarProvider, useSnackbar } from '../../src/app/Snackbar';
import { Fab } from '../../src/theme/Fab';
import { Button } from '../../src/theme/ui';

const styleOf = (node: { props: Record<string, unknown> }) =>
  (StyleSheet.flatten(node.props.style as StyleProp<TextStyle>) ?? {}) as Record<string, unknown>;

function Trigger() {
  const snackbar = useSnackbar();
  return (
    <Button
      testID="trigger"
      onPress={() => snackbar.show({ message: 'Koncept zahozen', action: { label: 'Vrátit zpět', onPress: () => {} } })}
    >
      go
    </Button>
  );
}

const mount = (withStamp: boolean) =>
  render(
    <SafeAreaProvider>
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <AppThemeProvider isDark={false}>
          <SnackbarProvider>
            <Trigger />
            {withStamp ? <Fab label="Napsat" onPress={() => {}} accessibilityLabel="Napsat zprávu" /> : null}
          </SnackbarProvider>
        </AppThemeProvider>
      </TamaguiProvider>
    </SafeAreaProvider>,
  );

const open = async (view: Awaited<ReturnType<typeof mount>>) => {
  await act(async () => {
    fireEvent.press(view.getByTestId('trigger'));
  });
};

describe('the snackbar, as R9 draws it', () => {
  it('is the ink bar, 52 at the least with the 14 corner, the words in the bold small role', async () => {
    const view = await mount(false);
    await open(view);
    const bar = styleOf(view.getByTestId('snackbarBar'));
    expect([bar.minHeight, bar.borderTopLeftRadius, bar.backgroundColor]).toEqual([52, 14, lightTheme.snackbarBg]);
    expect(styleOf(view.getByText('Koncept zahozen')).fontFamily).toBe(typeScale.smallStrong.fontFamily);
  });

  it('sets the action in the flap s gold, in a 44 row', async () => {
    const view = await mount(false);
    await open(view);
    expect(styleOf(view.getByTestId('snackbarAction')).minHeight).toBe(44);
    expect(styleOf(view.getByText('Vrátit zpět')).color).toBe(lightTheme.flap);
  });

  it('stands 14 over the bottom edge with no stamp on screen', async () => {
    const view = await mount(false);
    await open(view);
    expect(styleOf(view.getByTestId('snackbarHost')).paddingBottom).toBe(14);
  });

  it('stands 6 over the compose stamp while the stamp is on screen', async () => {
    // On screen: the app in front (Jest's stand-in has no state of its own) and no navigator over it.
    const appState = AppState as unknown as { currentState: string };
    const before = appState.currentState;
    appState.currentState = 'active';
    try {
      const view = await mount(true);
      await open(view);
      // The stamp: 22 over the edge and 60 tall (44 inside its rule and perforated margin).
      expect(styleOf(view.getByTestId('snackbarHost')).paddingBottom).toBe(22 + 60 + 6);
    } finally {
      appState.currentState = before;
    }
  });

  it('fades out when it is done with, rather than vanishing', async () => {
    const view = await mount(false);
    await open(view);
    await act(async () => {
      fireEvent.press(view.getByTestId('snackbarAction'));
    });
    // Still drawn while it fades, then gone.
    expect(view.getByText('Koncept zahozen')).toBeTruthy();
    await waitFor(() => expect(view.queryByText('Koncept zahozen')).toBeNull());
  });
});
