// A restore left running from a phone with no boxes (2026-09-24).
//
// Leaving the restore screen mid-restore asks, as it does from Settings, and "Nechat běžet" goes back
// to Welcome while the restore carries on. When it ends having brought boxes in, the phone is no longer
// the empty one Welcome is about, so the shell goes to the inbox by itself. Runs that end later, under
// the inbox, are none of this - an automatic backup ending must not re-read the table from here.
// One shell per file: see `firstRunShell`.

import { waitFor } from '@testing-library/react-native';
import {
  openRestore,
  press,
  renderShell,
  restoredBox,
  RESTORING,
  world,
} from '../helpers/firstRunShell';

afterEach(() => {
  jest.restoreAllMocks();
});

it('goes to the inbox by itself when a restore left running ends with boxes', async () => {
  const w = world();
  const view = await renderShell();
  await openRestore(view);
  await w.setRun(RESTORING);

  await press(view, 'back');
  await waitFor(() => expect(view.getByTestId('backup-leave-dialog')).toBeTruthy());
  await press(view, 'backup-leave-background');
  await waitFor(() => expect(view.getByTestId('welcome')).toBeTruthy());

  w.setAccounts([restoredBox]);
  await w.setRun(null);

  await waitFor(() => expect(view.getByTestId('consentYes')).toBeTruthy());
  expect(view.queryByTestId('welcome')).toBeNull();

  // An automatic backup ending under the inbox: not a restore on a new phone.
  const reads = w.listAccounts.mock.calls.length;
  await w.setRun({ kind: 'backup', progress: { stage: 'reading', done: 0, total: 0, fraction: 0 } });
  await w.setRun(null);
  expect(w.listAccounts.mock.calls.length).toBe(reads);
});
