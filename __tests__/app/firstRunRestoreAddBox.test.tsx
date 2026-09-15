// A restore left running while the add-box flow is open (2026-09-24).
//
// Welcome offers both ways in, so a person can leave a restore running ("Nechat běžet") and start
// adding a box by hand while it carries on. When the restore ends with boxes, the sign-in form is not
// taken away from them - and backing out of it goes to those boxes, with one of them chosen. It went
// to a Welcome about an empty phone, and then, once the shell knew of the boxes, to an inbox with none
// chosen: an empty screen. One shell per file: see `firstRunShell`.

import { waitFor } from '@testing-library/react-native';
import {
  openRestore,
  press,
  renderShell,
  restoredBox,
  RESTORING,
  world,
} from '../helpers/firstRunShell';
import { settingsStore } from '../../src/features/accounts/deps';
import { ACTIVE_BOX_KEY } from '../../src/app/settings/settingsKeys';

afterEach(() => {
  jest.restoreAllMocks();
});

it('leaves the sign-in form alone, and backing out of it goes to the restored boxes', async () => {
  const written = new Map<string, string>();
  jest.spyOn(settingsStore, 'getSetting').mockResolvedValue(null);
  jest.spyOn(settingsStore, 'setSetting').mockImplementation(async (k, v) => {
    written.set(k, v);
  });
  const w = world();
  const view = await renderShell();
  await openRestore(view);
  await w.setRun(RESTORING);
  await press(view, 'back');
  await waitFor(() => expect(view.getByTestId('backup-leave-dialog')).toBeTruthy());
  await press(view, 'backup-leave-background');
  await waitFor(() => expect(view.getByTestId('welcome')).toBeTruthy());

  await press(view, 'welcome-add-box');
  await waitFor(() => expect(view.queryByTestId('welcome')).toBeNull());

  w.setAccounts([restoredBox]);
  await w.setRun(null);
  // Still signing in: a restore ending is no reason to take the form away.
  await waitFor(() => expect(view.getByTestId('back')).toBeTruthy());
  expect(view.queryByTestId('consentYes')).toBeNull();

  await press(view, 'back');
  await waitFor(() => expect(view.getByTestId('consentYes')).toBeTruthy());
  expect(view.queryByTestId('welcome')).toBeNull();
  await waitFor(() => expect(written.get(ACTIVE_BOX_KEY)).toBe(restoredBox.boxId));
});
