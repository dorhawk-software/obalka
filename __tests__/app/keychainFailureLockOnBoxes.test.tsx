// App lock on, a box saved, and a Keychain that fails on every call (2026-09-24; see
// `helpers/brokenKeychain.ts`). The lock screen stays up over the inbox and says the unlock did not
// work, with the button to try again; nothing behind it is revealed. The inbox mounted under the cover
// reads the archive, whose key failed too - and those reads were unhandled rejections.

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

test('keeps the lock screen up over the inbox, says the unlock failed, and offers it again', async () => {
  savedState({ lockOn: true, boxes: [SAVED_BOX] });
  const keychain = breakKeychain();

  await render(<App />);
  await settle();

  expect(keychain.failedCalls()).toBeGreaterThan(0);
  expect(screen.getByText(t('lock.title'))).toBeOnTheScreen();
  expect(screen.getByText(t('lock.failed'))).toBeOnTheScreen();
  expect(screen.getByTestId('unlock')).toBeOnTheScreen();
});
