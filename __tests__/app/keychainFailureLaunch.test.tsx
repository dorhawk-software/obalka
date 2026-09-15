// The whole app over a Keychain that fails on every call (2026-09-24; see `helpers/brokenKeychain.ts`).
//
// The database key is a Keychain item, so nothing - not even the settings that say whether the app
// lock is on - can be read. The app used to show a blank screen for good: the settings read rejected
// with nothing to catch it, and the app waits for that read before it draws anything. It now says the
// saved boxes could not be loaded, on the launch screen, with a retry.

import { AppState } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import App from '../../App';
import { t } from '../../src/i18n/strings';
import {
  breakKeychain,
  failOnUnhandledRejections,
  press,
  settle,
} from '../helpers/brokenKeychain';

failOnUnhandledRejections();

beforeEach(() => {
  (AppState as unknown as { currentState: string }).currentState = 'active';
});

test('says the saved boxes could not be loaded, with a retry that tries again - never a blank screen', async () => {
  const keychain = breakKeychain();

  await render(<App />);
  await settle();

  expect(screen.getByTestId('loadFailed')).toBeOnTheScreen();
  expect(screen.getByText(t('app.loadFailed'))).toBeOnTheScreen();
  const before = keychain.failedCalls();

  // Still failing: the retry asks the Keychain again, and the same screen stays up with its retry.
  await press('loadRetry');

  expect(keychain.failedCalls()).toBeGreaterThan(before);
  expect(screen.getByTestId('loadFailed')).toBeOnTheScreen();
  expect(screen.getByTestId('loadRetry')).toBeOnTheScreen();
});
