// The two ways to the recovery key keep 8 apart (031 T050.5, the owner 2026-11-16: "8 px between
// them"). They were 44 rows that touched, so their 48 touch areas overlapped by 4 and a thumb meant
// for one could land on the other (practices: "Separate targets keep their distance").

import { StyleSheet } from 'react-native';
import { fireEvent, waitFor } from '@testing-library/react-native';
import { fakeController, manifest, mount } from '../helpers/backupScreenHarness';

jest.mock('../../src/features/transfer/screens/CodeScanner', () => {
  const actual = jest.requireActual('../../src/features/transfer/screens/CodeScanner');
  return { ...actual, scanningAvailable: () => true };
});

it('puts 8 between "Načíst heslo z QR kódu" and "Použít heslo z tohoto telefonu"', async () => {
  const fake = fakeController({ enabled: true, last: manifest(1_000) });
  fake.state.backups = [
    { manifest: manifest(1_000), restorable: true, compatibility: { kind: 'ok' } },
  ] as unknown as typeof fake.state.backups;
  const view = await mount(fake);
  await waitFor(() => expect(view.getByTestId('backup-item-0')).toBeTruthy());
  fireEvent.press(view.getByTestId('backup-item-0'));
  await waitFor(() => expect(view.getByTestId('backup-use-stored-key')).toBeTruthy());

  const scan = view.getByTestId('backup-scan-key');
  const stored = view.getByTestId('backup-use-stored-key');
  expect(scan.parent).toBe(stored.parent);
  const holder = StyleSheet.flatten(scan.parent?.props.style) as { gap?: number; rowGap?: number } | undefined;
  expect(holder?.rowGap ?? holder?.gap).toBe(8);
});
