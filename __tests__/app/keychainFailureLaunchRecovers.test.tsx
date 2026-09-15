// A Keychain that fails at launch and then answers (2026-09-24; see `helpers/brokenKeychain.ts`).
//
// The database key would not read, so neither would the settings. The retry on the launch screen must
// get the person into the app without killing it - which it could not: the failed database open was
// kept, and every later read, the retry's included, got the same failure back.

import { AppState } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import App from '../../App';
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

test('a retry after the Keychain answers again opens the app', async () => {
  const keychain = breakKeychain();

  await render(<App />);
  await settle();
  expect(screen.getByTestId('loadFailed')).toBeOnTheScreen();

  keychain.heal();
  await press('loadRetry');

  // No box on this phone, so the app opens on Welcome.
  expect(screen.getByTestId('welcome')).toBeOnTheScreen();
  expect(screen.queryByTestId('loadFailed')).toBeNull();
});
