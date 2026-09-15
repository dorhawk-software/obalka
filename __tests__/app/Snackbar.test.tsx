import { AccessibilityInfo, StyleSheet } from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { AppThemeProvider } from '../../src/theme/ThemeProvider';
import { SnackbarProvider, useSnackbar } from '../../src/app/Snackbar';
import { darkTheme } from '../../src/theme/theme';
import { Button } from '../../src/theme/ui';

// A tiny harness that lets the test drive the snackbar via the hook.
function Harness() {
  const snackbar = useSnackbar();
  return (
    <Button
      testID="trigger"
      onPress={() =>
        snackbar.show({
          message: 'Koncept uložen',
          action: {
            label: 'Zahodit',
            onPress: () =>
              snackbar.show({
                message: 'Koncept zahozen',
                action: { label: 'Vrátit zpět', onPress: () => {} },
              }),
          },
        })
      }
    >
      go
    </Button>
  );
}

function renderHarness(dark = false) {
  return render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme={dark ? 'dark' : 'light'}>
      <AppThemeProvider isDark={dark}>
        <SnackbarProvider>
          <Harness />
        </SnackbarProvider>
      </AppThemeProvider>
    </TamaguiProvider>,
  );
}

describe('Snackbar', () => {
  it('shows a message with an action, and the action can chain a follow-up snackbar (discard → undo)', async () => {
    const view = await renderHarness();
    // nothing shown initially
    expect(view.queryByText('Koncept uložen')).toBeNull();

    await act(async () => {
      fireEvent.press(view.getByTestId('trigger'));
    });
    expect(view.getByText('Koncept uložen')).toBeTruthy();
    expect(view.getByText('Zahodit')).toBeTruthy();

    // tapping discard flips the snackbar to the undoable "discarded" state
    await act(async () => {
      fireEvent.press(view.getByTestId('snackbarAction'));
    });
    expect(view.getByText('Koncept zahozen')).toBeTruthy();
    expect(view.getByText('Vrátit zpět')).toBeTruthy();
    expect(view.queryByText('Koncept uložen')).toBeNull();
  });
});

// The snackbar is the app speaking without being asked, at the bottom edge, for a few seconds - the
// two ways that goes wrong are being unreadable and being unnoticed.
describe('the snackbar a screen reader gets', () => {
  it('announces itself, and says what there is to tap', async () => {
    const announce = jest
      .spyOn(AccessibilityInfo, 'announceForAccessibility')
      .mockImplementation(() => {});
    const view = await renderHarness();

    await act(async () => {
      fireEvent.press(view.getByTestId('trigger'));
    });

    // Not just the message: the bar leaves on a timer, so "there is a Zahodit here" is the half that
    // makes the announcement actionable rather than merely informative.
    expect(announce).toHaveBeenCalledWith('Koncept uložen. Zahodit');
    announce.mockRestore();
  });
});

describe('the snackbar in dark mode', () => {
  it('keeps the dark bar - it does not invert with the appearance', async () => {
    const view = await renderHarness(true);

    await act(async () => {
      fireEvent.press(view.getByTestId('trigger'));
    });

    const bar = StyleSheet.flatten(view.getByTestId('snackbarBar').props.style);
    // The bug this pins: painted with `theme.text`, the bar turned near-WHITE in dark mode and took
    // the gold action label down to 1.52:1 with it.
    expect(bar.backgroundColor).toBe(darkTheme.snackbarBg);
    expect(bar.backgroundColor).not.toBe(darkTheme.text);
  });
});
