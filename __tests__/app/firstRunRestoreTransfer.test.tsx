// Receiving a transfer on a phone with no boxes, from Welcome (2026-09-24).
//
// Where this phone can receive one (Android), Welcome names the other phone, the restore screen offers
// the transfer first, and the transfer screen opens receiving only - a phone with no boxes has nothing
// to send. Back from it is the restore screen, where the backup file still is. When what arrived is
// saved and has brought boxes in, the transfer screen offers the way on too.
// One shell per file: see `firstRunShell`.

import { waitFor } from '@testing-library/react-native';
import {
  openRestore,
  press,
  renderShell,
  restoredBox,
  world,
} from '../helpers/firstRunShell';
import { STRINGS_FOR_TEST } from '../../src/i18n/strings';

const { cs } = STRINGS_FOR_TEST;

afterEach(() => {
  jest.restoreAllMocks();
});

it('opens the transfer receiving only, comes back to the restore screen, and goes on from a save', async () => {
  const w = world({ canTransfer: true });
  const view = await renderShell();
  await waitFor(() => expect(view.getByRole('button', { name: cs['welcome.restore'] })).toBeTruthy());
  await openRestore(view);

  await press(view, 'backup-open-transfer');
  await waitFor(() => expect(view.getByTestId('transfer-receive')).toBeTruthy());
  expect(view.queryByTestId('transfer-send')).toBeNull();
  expect(view.queryByTestId('transfer-continue')).toBeNull();

  await press(view, 'back');
  await waitFor(() => expect(view.getByTestId('backup-import')).toBeTruthy());

  // In again, and a transfer's save - a run of the backup controller's - brings a box in.
  await press(view, 'backup-open-transfer');
  await waitFor(() => expect(view.getByTestId('transfer-receive')).toBeTruthy());
  await w.setRun({
    kind: 'restore',
    progress: { stage: 'restoring', done: 1, total: 2, fraction: 0.5 },
    cancellable: false,
  });
  w.setAccounts([restoredBox]);
  await w.setRun(null);

  await waitFor(() => expect(view.getByTestId('transfer-continue')).toBeTruthy());
  await press(view, 'transfer-continue');
  await waitFor(() => expect(view.getByTestId('consentYes')).toBeTruthy());
});
