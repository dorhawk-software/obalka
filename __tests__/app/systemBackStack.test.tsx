// Inside the shell's EdgeSwipeBack, Android's system back asks the innermost screen that offered a
// back, and leaves the flow only when none did (systemBack.ts, walked on Obalka_Demo, 2026-11-16).

import type { ReactElement } from 'react';
import { BackHandler, Platform, Text } from 'react-native';
import { act, render } from '@testing-library/react-native';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { EdgeSwipeBack } from '../../src/app/EdgeSwipeBack';
import { OtpForm } from '../../src/features/accounts/screens/OtpForm';

const realOS = Platform.OS;
type BackListener = Parameters<typeof BackHandler.addEventListener>[1];
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

function ui(node: ReactElement) {
  return render(<TamaguiProvider config={tamaguiConfig} defaultTheme="light">{node}</TamaguiProvider>);
}

it('cancels the SMS code step, as its chevron does, and does not leave the flow', async () => {
  const leave = jest.fn();
  const cancel = jest.fn();
  await ui(
    <EdgeSwipeBack onBack={leave}>
      <OtpForm onSubmit={jest.fn()} onResend={jest.fn()} onCancel={cancel} />
    </EdgeSwipeBack>,
  );
  await systemBack();
  expect(cancel).toHaveBeenCalledTimes(1);
  expect(leave).not.toHaveBeenCalled();
});

it('leaves the flow from a screen that offered no back of its own', async () => {
  const leave = jest.fn();
  await ui(
    <EdgeSwipeBack onBack={leave}>
      <Text>An error with only a retry</Text>
    </EdgeSwipeBack>,
  );
  await systemBack();
  expect(leave).toHaveBeenCalledTimes(1);
});
