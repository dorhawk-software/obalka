// Android's system back on the restore screen opened from Welcome (2026-09-24).
//
// The screen answers it itself: back while a restore runs asks first, exactly as its header back does.
// The shell's own wrapper also listens for it on the add-box flow, and registered after the screen it
// would be asked first and leave without the question - so on this route it does not listen.
// One shell per file: see `firstRunShell`.

import { BackHandler, Platform } from 'react-native';
import { act, waitFor } from '@testing-library/react-native';
import {
  openRestore,
  press,
  renderShell,
  RESTORING,
  world,
} from '../helpers/firstRunShell';

const realOS = Platform.OS;
type BackListener = Parameters<typeof BackHandler.addEventListener>[1];
/** The back handlers registered, oldest first. Android asks the newest first. */
let handlers: BackListener[] = [];

beforeEach(() => {
  Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true, writable: true });
  handlers = [];
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
    handlers.push(handler);
    return {
      remove: () => {
        handlers = handlers.filter(h => h !== handler);
      },
    };
  });
});

afterEach(() => {
  Object.defineProperty(Platform, 'OS', { value: realOS, configurable: true, writable: true });
  jest.restoreAllMocks();
});

/** Press the system back: the newest handler first, until one takes it. */
async function systemBack() {
  await act(async () => {
    for (const handler of [...handlers].reverse()) {
      if (handler({ type: 'hardwareBackPress', timeStamp: Date.now() })) {
        return;
      }
    }
  });
}

it('asks first while a restore runs, and goes back to Welcome once none does', async () => {
  const w = world();
  const view = await renderShell();
  await openRestore(view);

  // Left running, and the screen opened again while it runs. That is the order that matters: the
  // screen registers its handler as it mounts, before the wrapper around it, and does not register it
  // again while the run goes on - so a wrapper that listened too would be asked first.
  await w.setRun(RESTORING);
  await systemBack();
  await waitFor(() => expect(view.getByTestId('backup-leave-dialog')).toBeTruthy());
  await press(view, 'backup-leave-background');
  await waitFor(() => expect(view.getByTestId('welcome')).toBeTruthy());
  await press(view, 'welcome-restore');
  await waitFor(() => expect(view.getByTestId('backup-import')).toBeTruthy());

  await systemBack();
  await waitFor(() => expect(view.getByTestId('backup-leave-dialog')).toBeTruthy());
  expect(view.queryByTestId('welcome')).toBeNull();

  await press(view, 'backup-leave-stay');
  await w.setRun(null);
  await systemBack();

  await waitFor(() => expect(view.getByTestId('welcome')).toBeTruthy());
});
