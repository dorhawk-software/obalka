// Welcome → the restore screen → back, on a phone with no boxes (2026-09-24).
//
// The case the app did not have: phone A holds the archive, the app is installed on phone B, and B
// opens on Welcome. Its one action was adding a box by hand - the transfer and the backup file sat
// behind Settings, which a phone with no boxes cannot reach. One shell per file: see `firstRunShell`.

import {
  openRestore,
  press,
  renderShell,
  restoredBox,
  RESTORING,
  world,
} from '../helpers/firstRunShell';
import { waitFor } from '@testing-library/react-native';
import { STRINGS_FOR_TEST } from '../../src/i18n/strings';

const { cs } = STRINGS_FOR_TEST;

afterEach(() => {
  jest.restoreAllMocks();
});

it('opens without a box and goes back to Welcome, then to the restored boxes once there are some', async () => {
  // A phone that cannot receive a transfer (iOS, for now): the button and the screen say so by
  // offering only the backup.
  const w = world({ canTransfer: false });
  const view = await renderShell();
  await waitFor(() => expect(view.getByRole('button', { name: cs['welcome.restore.backupOnly'] })).toBeTruthy());

  await openRestore(view);
  expect(view.queryByTestId('welcome')).toBeNull();
  expect(view.getByText(cs['restore.title'])).toBeTruthy();
  expect(view.queryByTestId('backup-open-transfer')).toBeNull();
  // Nothing to go on to yet.
  expect(view.queryByTestId('backup-continue')).toBeNull();

  await press(view, 'back');
  await waitFor(() => expect(view.getByTestId('welcome')).toBeTruthy());

  // In again, and a restore brings a box in.
  await openRestore(view);
  await w.setRun(RESTORING);
  w.setAccounts([restoredBox]);
  await w.setRun(null);
  await waitFor(() => expect(view.getByTestId('backup-continue')).toBeTruthy());

  // Back now goes to the boxes, not to a Welcome offering to add a first one.
  await press(view, 'back');
  await waitFor(() => expect(view.getByTestId('consentYes')).toBeTruthy());
  expect(view.queryByTestId('welcome')).toBeNull();
});
