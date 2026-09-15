// App lock off, a box saved, and a Keychain that fails on every call (2026-09-24; see
// `helpers/brokenKeychain.ts`). The inbox opens and says its saved sign-in could not be read just now,
// with a retry - not a signed-out box. Its reads of the archive fail too, with the database key: they
// were unhandled rejections, and the first left the sync bar running with no sync behind it.

import { enableScreens } from 'react-native-screens';
enableScreens(false);

import { AppState } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import App from '../../App';
import { t } from '../../src/i18n/strings';
import {
  SAVED_BOX,
  breakKeychain,
  failOnUnhandledRejections,
  savedState,
  settle,
} from '../helpers/brokenKeychain';

failOnUnhandledRejections();

beforeEach(() => {
  (AppState as unknown as { currentState: string }).currentState = 'active';
});

test('opens the inbox, which says the saved sign-in could not be read, with a retry', async () => {
  savedState({ lockOn: false, boxes: [SAVED_BOX] });
  const keychain = breakKeychain();

  await render(<App />);
  await settle();

  expect(keychain.failedCalls()).toBeGreaterThan(0);
  expect(screen.getByText(t('messages.error.credentials'))).toBeOnTheScreen();
  expect(screen.getByTestId('retry')).toBeOnTheScreen();
  expect(screen.queryByTestId('unlock')).toBeNull();
});
