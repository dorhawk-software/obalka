// App lock on, a box saved, and a Keychain that fails at launch and then answers (2026-09-24; see
// `helpers/brokenKeychain.ts`). The lock screen's own button gets the person in - no restart - and a
// failed read never made a new vault key: the one behind the gate is the one read back.

import { enableScreens } from 'react-native-screens';
enableScreens(false);

import { AppState } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';
import * as Keychain from 'react-native-keychain';
import App from '../../App';
import { t } from '../../src/i18n/strings';
import {
  SAVED_BOX,
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

const GATED = 'cz.obalka.vault.key.gated';

test('unlocks on the retry once the Keychain answers, with the key that was already there', async () => {
  savedState({ lockOn: true, boxes: [SAVED_BOX] });
  const key = 'ab'.repeat(32);
  await Keychain.setGenericPassword('vault', key, { service: GATED });
  const keychain = breakKeychain();

  await render(<App />);
  await settle();
  expect(screen.getByText(t('lock.failed'))).toBeOnTheScreen();

  keychain.heal();
  await press('unlock');

  // The cover holds for the OS success animation, then fades.
  await act(async () => {
    await new Promise<void>(resolve => setTimeout(resolve, 700));
  });
  await settle();
  expect(screen.queryByTestId('unlock')).toBeNull();
  expect(await Keychain.getGenericPassword({ service: GATED })).toMatchObject({ password: key });
});
