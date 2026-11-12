// The unlocking moment (031, board Motion 3): the seal breaks and the flap opens on the first unlock
// since the app started, only the flap after that; a light tick as the seal splits; a failed scan
// leaves the seal whole with the refusal a blocked button gives. The motion itself is walked on a
// device; these hold the plan, the haptics and when each plays.

import { act, render, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';
import RNHaptic from 'react-native-haptic-feedback';
import { useReducedMotion } from 'react-native-reanimated';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { Text } from '../../src/theme/ui';
import { LockGate, resetSealForTests, unlockMoment } from '../../src/app/lock/LockGate';
import type { AppLock, UnlockResult } from '../../src/services/appLock/appLock';

const trigger = RNHaptic.trigger as unknown as jest.Mock;
const kinds = () => trigger.mock.calls.map(c => c[0]);

/** A lock that answers every unlock with `answer`, and refuses anything else it is asked. */
function fakeLock(answer: UnlockResult): AppLock {
  const refuse = (name: string) => () => {
    throw new Error(`fakeLock was not told about ${name}`);
  };
  return {
    isAvailable: refuse('isAvailable'),
    enable: refuse('enable'),
    disable: refuse('disable'),
    forget: refuse('forget'),
    unlock: async () => answer,
    resetKey: refuse('resetKey'),
    lock: () => {},
    needsRecovery: () => false,
    subscribe: () => () => {},
  } as AppLock;
}

const mount = (lock: AppLock) =>
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <LockGate enabled lock={lock}>
        <Text>SECRET-CONTENT</Text>
      </LockGate>
    </TamaguiProvider>,
  );

beforeEach(() => {
  (AppState as unknown as { currentState: string }).currentState = 'active';
  trigger.mockReset();
  resetSealForTests();
});
afterEach(() => (useReducedMotion as jest.Mock).mockReturnValue(false));

it('breaks the seal and opens the flap the first time; only the flap, quicker, after that', () => {
  expect(unlockMoment(true, false)).toEqual({ holdMs: 0, sealMs: 180, flapMs: 260, fadeMs: 180, tick: true });
  expect(unlockMoment(false, false)).toEqual({ holdMs: 0, sealMs: 0, flapMs: 180, fadeMs: 180, tick: false });
});

it('with Reduce Motion holds for the system checkmark and crossfades, the tick kept', () => {
  expect(unlockMoment(true, true)).toEqual({ holdMs: 260, sealMs: 0, flapMs: 0, fadeMs: 240, tick: true });
  expect(unlockMoment(false, true).tick).toBe(false);
});

it('ticks once as the seal splits on the first unlock, and not on the next', async () => {
  const first = await mount(fakeLock('unlocked'));
  await waitFor(() => expect(first.queryByTestId('unlock')).toBeNull(), { timeout: 2000 });
  expect(kinds()).toEqual(['impactLight']);
  await first.unmount();

  trigger.mockReset();
  const again = await mount(fakeLock('unlocked'));
  await waitFor(() => expect(again.queryByTestId('unlock')).toBeNull(), { timeout: 2000 });
  expect(kinds()).toEqual([]);
});

it('keeps the tick under Reduce Motion', async () => {
  (useReducedMotion as jest.Mock).mockReturnValue(true);
  const view = await mount(fakeLock('unlocked'));
  await waitFor(() => expect(view.queryByTestId('unlock')).toBeNull(), { timeout: 2000 });
  expect(kinds()).toEqual(['impactLight']);
});

it('refuses a failed scan with the blocked button\'s warning, and stays sealed', async () => {
  const view = await mount(fakeLock('failed'));
  await act(async () => {});
  expect(kinds()).toEqual(['notificationWarning']);
  expect(view.getByTestId('unlock')).toBeTruthy();
});
