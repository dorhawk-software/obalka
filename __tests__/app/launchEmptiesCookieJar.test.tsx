// A sign-in the last run of the app left unfinished (018 FR-003, 2026-09-24).
//
// Every sign-in empties the shared cookie jar when it ends, but a process killed mid-sign-in ends
// nothing. The native store outlives the process and stays readable while the app is locked, so that
// half-finished handshake stayed there until the next sign-in started. The app now empties the jar at
// launch - only when the last run noted a handshake open (review, the same day): emptying it loads
// Android's WebView cookie store, which every cold start paid for, and a phone without a working WebView
// reported the failure on every launch.

import { render } from '@testing-library/react-native';
import CookieManager from '@react-native-cookies/cookies';
import App from '../../App';
import { settingsStore } from '../../src/features/accounts/deps';
import { HANDSHAKE_OPEN_KEY } from '../../src/app/settings/settingsKeys';

const PORTAL = 'https://www.czebox.cz';

type MockJar = typeof CookieManager & {
  __seed(url: string, pairs: Record<string, string>): void;
  __reset(): void;
};

afterEach(() => {
  (CookieManager as MockJar).__reset();
  jest.restoreAllMocks();
});

/**
 * The settings table as the last run left it. The database is a no-op under jest, so the mark is read
 * and written through spies on the app's own store.
 */
function lastRunLeft(mark: '0' | '1') {
  const read = settingsStore.getSetting.bind(settingsStore);
  jest
    .spyOn(settingsStore, 'getSetting')
    .mockImplementation(async key => (key === HANDSHAKE_OPEN_KEY ? mark : read(key)));
  return jest.spyOn(settingsStore, 'setSetting');
}

async function launch() {
  await render(<App />);
}

test('empties a handshake the last run left in the cookie jar, at launch, and takes the note back', async () => {
  // What an SMS request leaves behind when the process is killed before the code is entered.
  (CookieManager as MockJar).__seed(PORTAL, { 'IPCZ-X-COOKIE': 'half-finished-handshake' });
  const written = lastRunLeft('1');

  await launch();

  expect(await CookieManager.get(PORTAL)).toEqual({});
  expect(written).toHaveBeenCalledWith(HANDSHAKE_OPEN_KEY, '0');
});

test('leaves the jar alone at a launch after a run that left no handshake', async () => {
  lastRunLeft('0');
  const clear = jest.spyOn(CookieManager, 'clearAll');

  await launch();

  expect(clear).not.toHaveBeenCalled();
});
