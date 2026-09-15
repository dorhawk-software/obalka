// The QR viewfinder is drawn OVER the page that opened it (found on the emulator, 2026-09-24).
//
// Both screens rendered the scanner as the first sibling of their page. Siblings are drawn in order,
// so the page covered it: the camera ran, the viewfinder and its Cancel button were underneath, and
// the screen looked as if the tap had done nothing. Unit tests never saw it because the scanner is
// absent under jest; here it is a stand-in, and what is checked is where it lands.

import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { AppThemeProvider } from '../../src/theme/ThemeProvider';
import { TransferScreen } from '../../src/app/settings/TransferScreen';
import type { TransferController } from '../../src/features/transfer/state/transferController';
import { fakeController, manifest, mount } from '../helpers/backupScreenHarness';

jest.mock('../../src/features/transfer/screens/CodeScanner', () => {
  const actual = jest.requireActual('../../src/features/transfer/screens/CodeScanner');
  const { View } = jest.requireActual('react-native');
  return {
    ...actual,
    scanningAvailable: () => true,
    TransferCodeScanner: () => <View testID="stand-in-scanner" />,
  };
});

/** True when `testID` is the last thing its parent draws - that is, drawn over its siblings. */
function drawnLast(view: Awaited<ReturnType<typeof render>>, testID: string): boolean {
  const node = view.getByTestId(testID);
  const siblings = node.parent?.children ?? [];
  return siblings.length > 1 && siblings[siblings.length - 1] === node;
}

it('draws the recovery-key scanner over the backup screen', async () => {
  const fake = fakeController({ enabled: true, last: manifest(1_000) });
  fake.state.backups = [
    { manifest: manifest(1_000), restorable: true, compatibility: { kind: 'ok' } },
  ] as unknown as typeof fake.state.backups;
  const view = await mount(fake);

  await waitFor(() => expect(view.getByTestId('backup-item-0')).toBeTruthy());
  fireEvent.press(view.getByTestId('backup-item-0'));
  await waitFor(() => expect(view.getByTestId('backup-scan-key')).toBeTruthy());
  fireEvent.press(view.getByTestId('backup-scan-key'));

  await waitFor(() => expect(view.getByTestId('stand-in-scanner')).toBeTruthy());
  expect(drawnLast(view, 'stand-in-scanner')).toBe(true);
});

it('draws the transfer scanner over the transfer screen', async () => {
  const controller = {
    available: () => true,
    isApplying: () => false,
    subscribeOutcome: () => () => {},
    takeOutcome: () => null,
  } as unknown as TransferController;
  const view = await render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <AppThemeProvider isDark={false}>
        <TransferScreen onBack={() => {}} controller={controller} backups={[]} />
      </AppThemeProvider>
    </TamaguiProvider>,
  );

  await waitFor(() => expect(view.getByTestId('transfer-scan')).toBeTruthy());
  fireEvent.press(view.getByTestId('transfer-scan'));

  await waitFor(() => expect(view.getByTestId('stand-in-scanner')).toBeTruthy());
  expect(drawnLast(view, 'stand-in-scanner')).toBe(true);
});
