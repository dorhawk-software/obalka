// App lock on, and a Keychain that fails on every call - the database key with it, so the saved boxes
// cannot be read behind the lock either (2026-09-24; see `helpers/brokenKeychain.ts`). The lock screen
// says the unlock did not work and offers it again; nothing behind it shows. Once the Keychain answers,
// the same button unlocks, and the launch screen's retry behind it opens the app - without a restart.

import { AppState } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';
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

test('keeps the lock screen up saying the unlock failed, and recovers through it once the Keychain answers', async () => {
  savedState({ lockOn: true });
  const keychain = breakKeychain();

  await render(<App />);
  await settle();

  expect(screen.getByText(t('lock.title'))).toBeOnTheScreen();
  expect(screen.getByText(t('lock.failed'))).toBeOnTheScreen();

  // Asking again while it still fails asks the Keychain again, and ends the same way.
  const before = keychain.failedCalls();
  await press('unlock');
  expect(keychain.failedCalls()).toBeGreaterThan(before);
  expect(screen.getByText(t('lock.failed'))).toBeOnTheScreen();

  keychain.heal();
  await press('unlock');
  // The cover holds for the OS success animation, then fades.
  await act(async () => {
    await new Promise<void>(resolve => setTimeout(resolve, 700));
  });
  await settle();
  expect(screen.queryByTestId('unlock')).toBeNull();

  // Behind it, the boxes that would not load, and the retry that loads them now.
  expect(screen.getByTestId('loadFailed')).toBeOnTheScreen();
  await press('loadRetry');
  expect(screen.getByTestId('welcome')).toBeOnTheScreen();
});
