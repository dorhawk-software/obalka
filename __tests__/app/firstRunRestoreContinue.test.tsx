// A restore on a phone with no boxes, and the way on from it (2026-09-24).
//
// The shell reads the accounts table only when asked, and a restore writes into it from underneath, so
// it reads the table again whenever a run ends on these screens. A restore that brought no boxes stays
// where it is, with its own outcome and nothing to go on to; one that did offers the way to them.
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

it('stays put after a restore with no boxes, and offers the inbox after one with some', async () => {
  const w = world();
  const view = await renderShell();
  await openRestore(view);

  // A backup with no boxes in it.
  const reads = w.listAccounts.mock.calls.length;
  await w.setRun(RESTORING);
  await w.setRun(null);
  await waitFor(() => expect(w.listAccounts.mock.calls.length).toBeGreaterThan(reads));
  expect(view.getByTestId('backup-import')).toBeTruthy();
  expect(view.queryByTestId('backup-continue')).toBeNull();
  expect(view.queryByTestId('consentYes')).toBeNull();

  // Then one with a box. The screen stays, so what was restored can be read, with the way on under it.
  await w.setRun(RESTORING);
  w.setAccounts([restoredBox]);
  await w.setRun(null);
  await waitFor(() => expect(view.getByTestId('backup-continue')).toBeTruthy());
  expect(view.getByTestId('backup-import')).toBeTruthy();

  await press(view, 'backup-continue');
  await waitFor(() => expect(view.getByTestId('consentYes')).toBeTruthy());
  expect(view.queryByTestId('welcome')).toBeNull();
  expect(view.queryByTestId('backup-import')).toBeNull();
});
