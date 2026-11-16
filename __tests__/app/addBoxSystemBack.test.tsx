// Android's system back in the add-box flow does what the header's back does (walked on Obalka_Demo,
// T050.10, 2026-11-16): from the password form it went past the method step and out of the flow,
// while the chevron goes back one step. The flow's own screens answer it; the shell's wrapper does
// not listen on this route, or, registered after them, it would be asked first and leave.
// One shell per file: see `firstRunShell`.

import { BackHandler, Platform } from 'react-native';
import { act, waitFor } from '@testing-library/react-native';
import { press, renderShell, world } from '../helpers/firstRunShell';

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

it('goes from the password form back to the method step, then back to Welcome', async () => {
  world();
  const view = await renderShell();
  await waitFor(() => expect(view.getByTestId('welcome')).toBeTruthy());
  await press(view, 'welcome-add-box');
  await waitFor(() => expect(view.getByTestId('continue')).toBeTruthy());
  await press(view, 'continue');
  await waitFor(() => expect(view.getByTestId('loginName')).toBeTruthy());

  await systemBack();
  await waitFor(() => expect(view.getByTestId('continue')).toBeTruthy());
  expect(view.queryByTestId('welcome')).toBeNull();

  await systemBack();
  await waitFor(() => expect(view.getByTestId('welcome')).toBeTruthy());
});
