// App lock off, and a Keychain that fails on every call - the database key with it, so the saved boxes
// cannot be read (2026-09-24; see `helpers/brokenKeychain.ts`). The launch screen says so with a retry,
// and once the Keychain answers again that retry opens the app, without a restart. It could not: the
// database kept its failed open and handed the same failure to every later read.

import { AppState } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import App from '../../App';
import { t } from '../../src/i18n/strings';
import {
  breakKeychain,
  failOnUnhandledRejections,
  press,
  savedState,
  settle,
} from '../helpers/brokenKeychain';

failOnUnhandledRejections();

beforeEach(() => {
  (AppState as unknown as { currentState: string }).currentState = 'active';
});

test('says the saved boxes could not be loaded, and its retry opens the app once the Keychain answers', async () => {
  savedState({ lockOn: false });
  const keychain = breakKeychain();

  await render(<App />);
  await settle();

  expect(screen.getByTestId('loadFailed')).toBeOnTheScreen();
  expect(screen.getByText(t('app.loadFailed'))).toBeOnTheScreen();
  expect(screen.queryByTestId('unlock')).toBeNull();

  keychain.heal();
  await press('loadRetry');

  // No box on this phone after all, so the app opens on Welcome.
  expect(screen.getByTestId('welcome')).toBeOnTheScreen();
});
