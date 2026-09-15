// A restore ending on Welcome while the person is already on their way elsewhere (2026-09-24).
//
// Ending with boxes on Welcome takes the phone to the inbox, but only after reading which box was used
// last - from the settings table, which can take a moment. A tap on "Přidat datovou schránku" in that
// moment is the person's, and the inbox arriving after it would take the sign-in form out from under
// them. One shell per file: see `firstRunShell`.

import { act, waitFor } from '@testing-library/react-native';
import {
  openRestore,
  press,
  renderShell,
  restoredBox,
  RESTORING,
  world,
} from '../helpers/firstRunShell';
import { settingsStore } from '../../src/features/accounts/deps';

afterEach(() => {
  jest.restoreAllMocks();
});

it('does not pull the person out of the sign-in form they opened meanwhile', async () => {
  let hold: Promise<void> | null = null;
  let release = () => {};
  jest.spyOn(settingsStore, 'getSetting').mockImplementation(async () => {
    if (hold) {
      await hold;
    }
    return null;
  });
  jest.spyOn(settingsStore, 'setSetting').mockResolvedValue(undefined);
  const w = world();
  const view = await renderShell();
  await openRestore(view);
  await w.setRun(RESTORING);
  await press(view, 'back');
  await waitFor(() => expect(view.getByTestId('backup-leave-dialog')).toBeTruthy());
  await press(view, 'backup-leave-background');
  await waitFor(() => expect(view.getByTestId('welcome')).toBeTruthy());

  // The settings table is slow to answer, and the restore ends.
  hold = new Promise<void>(resolve => {
    release = resolve;
  });
  w.setAccounts([restoredBox]);
  await w.setRun(null);
  await waitFor(() => expect(settingsStore.getSetting).toHaveBeenCalled());

  // The person taps "add a box" before it has answered.
  await press(view, 'welcome-add-box');
  await waitFor(() => expect(view.queryByTestId('welcome')).toBeNull());
  hold = null;
  await act(async () => {
    release();
    // Let the reads that were waiting answer, and whatever they start settle.
    await new Promise(resolve => setTimeout(resolve, 50));
  });

  await waitFor(() => expect(view.getByTestId('back')).toBeTruthy());
  expect(view.queryByTestId('consentYes')).toBeNull();
});
