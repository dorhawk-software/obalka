// A blocked button answers; a busy one does not (feature 019).
//
// The reported failure: the re-auth submit was disabled until a password was typed, the user pressed
// it with the field empty, and nothing happened at all. A disabled `Pressable` discards the touch
// before any handler runs, so the screen could not even learn that someone had tried - which is why
// the fix lives in the primitive rather than in the form.
//
// The distinction under test is the one that keeps this from being "shake everything": half the
// disabled states in this app mean the action is ALREADY RUNNING, and a spinner is the right answer
// to a second press. Since 2026-09-15 a screen reader hears that too: busy, not unavailable.

import { fireEvent, render } from '@testing-library/react-native';
import { Animated, Text } from 'react-native';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { PressScale } from '../../src/theme/PressScale';

const ui = (node: React.ReactElement) =>
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      {node}
    </TamaguiProvider>,
  );

describe('a blocked button', () => {
  it('answers the press instead of swallowing it', async () => {
    const onBlockedPress = jest.fn();
    const onPress = jest.fn();
    const view = await ui(
      <PressScale
        onPress={onPress}
        blockedReason="Nejdřív zadejte heslo"
        onBlockedPress={onBlockedPress}
        accessibilityLabel="Přihlásit se"
        testID="submit"
      >
        <Text>Přihlásit se</Text>
      </PressScale>,
    );
    await fireEvent.press(view.getByTestId('submit'));
    expect(onBlockedPress).toHaveBeenCalledTimes(1);
    // …and never submits (FR-009).
    expect(onPress).not.toHaveBeenCalled();
  });

  it('tells assistive technology that it is unavailable AND why', async () => {
    const view = await ui(
      <PressScale
        onPress={() => {}}
        blockedReason="Nejdřív zadejte heslo"
        accessibilityLabel="Přihlásit se"
        testID="submit"
      >
        <Text>Přihlásit se</Text>
      </PressScale>,
    );
    const btn = view.getByTestId('submit');
    expect(btn.props.accessibilityState?.disabled).toBe(true);
    expect(btn.props.accessibilityLabel).toContain('Nejdřív zadejte heslo');
  });
});

describe('a busy button', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('stays silent - the spinner is the answer - and does not dip under the finger', async () => {
    const onBlockedPress = jest.fn();
    const onPress = jest.fn();
    const timing = jest.spyOn(Animated, 'timing');
    const view = await ui(
      <PressScale
        onPress={onPress}
        busy
        onBlockedPress={onBlockedPress}
        accessibilityLabel="Přihlásit se"
        testID="submit"
      >
        <Text>Přihlásit se</Text>
      </PressScale>,
    );
    await fireEvent(view.getByTestId('submit'), 'pressIn');
    await fireEvent.press(view.getByTestId('submit'));
    expect(onBlockedPress).not.toHaveBeenCalled();
    expect(onPress).not.toHaveBeenCalled();
    expect(timing).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ toValue: 0.97 }));
  });

  it('is heard as busy, not as unavailable', async () => {
    // Until 2026-09-15 a running action was announced like one that cannot be taken at all, for as long
    // as the sign-in it had started was still going.
    const view = await ui(
      <PressScale onPress={() => {}} busy accessibilityLabel="Přihlásit se" testID="submit">
        <Text>Přihlásit se</Text>
      </PressScale>,
    );
    const btn = view.getByTestId('submit');
    expect(btn).toBeBusy();
    expect(btn).not.toBeDisabled();
    expect(btn.props.accessibilityLabel).toBe('Přihlásit se');
  });

  it('busy WINS over blocked - nobody is scolded for a race', async () => {
    // Both flags set at once: the action is running and a requirement reads unmet. Refusing would
    // blame the user for the app's own in-flight state.
    const onBlockedPress = jest.fn();
    const view = await ui(
      <PressScale
        onPress={() => {}}
        busy
        blockedReason="Nejdřív zadejte heslo"
        onBlockedPress={onBlockedPress}
        testID="submit"
      >
        <Text>Přihlásit se</Text>
      </PressScale>,
    );
    await fireEvent.press(view.getByTestId('submit'));
    expect(onBlockedPress).not.toHaveBeenCalled();
    expect(view.getByTestId('submit')).toBeBusy();
    expect(view.getByTestId('submit')).not.toBeDisabled();
  });

  it('is heard as unavailable only when it is: disabled and not running', async () => {
    // "Odeslat" with nothing to send is unavailable; while the send it started runs, it is busy and
    // nothing else, although nothing could be sent then either.
    const onPress = jest.fn();
    const view = await ui(
      <>
        <PressScale onPress={onPress} disabled testID="empty">
          <Text>Odeslat</Text>
        </PressScale>
        <PressScale onPress={onPress} busy disabled testID="sending">
          <Text>Odesílá se</Text>
        </PressScale>
      </>,
    );
    await fireEvent.press(view.getByTestId('empty'));
    await fireEvent.press(view.getByTestId('sending'));
    expect(onPress).not.toHaveBeenCalled();
    expect(view.getByTestId('empty')).toBeDisabled();
    expect(view.getByTestId('empty')).not.toBeBusy();
    expect(view.getByTestId('sending')).toBeBusy();
    expect(view.getByTestId('sending')).not.toBeDisabled();
  });

  it('a normal button still just works', async () => {
    const onPress = jest.fn();
    const view = await ui(
      <PressScale onPress={onPress} testID="submit">
        <Text>Odeslat</Text>
      </PressScale>,
    );
    await fireEvent.press(view.getByTestId('submit'));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(view.getByTestId('submit')).not.toBeBusy();
    expect(view.getByTestId('submit')).not.toBeDisabled();
  });
});
