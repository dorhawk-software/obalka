// The window film's glint (031 I70, board Motion 4): it follows the phone's tilt by up to 8, and only
// while the window is on screen - the gravity sensor is asked for nothing otherwise - and with Reduce
// Motion it stays still. The movement itself runs on the UI thread and is walked on a device; these
// hold when it may move and that it has room to.

import { act, fireEvent, render } from '@testing-library/react-native';
import { AppState, StyleSheet, Text, type AppStateStatus } from 'react-native';
import { NavigationContext } from '@react-navigation/native';
import { useAnimatedSensor, useReducedMotion } from 'react-native-reanimated';
import { AppThemeProvider } from '../../src/theme/ThemeProvider';
import { Window } from '../../src/theme/objects/Window';
import { windowFilm } from '../../src/theme/print';

const sensor = useAnimatedSensor as jest.Mock;
const appState = AppState as unknown as { currentState: string };

/** A screen's navigation that is told only whether it is focused, and refuses anything else. */
function fakeNavigation(focused: boolean) {
  const listeners: Record<string, (() => void)[]> = { focus: [], blur: [] };
  const nav = {
    isFocused: () => focused,
    addListener: (event: string, cb: () => void) => {
      if (!(event in listeners)) {
        throw new Error(`fakeNavigation was not told about the '${event}' event`);
      }
      listeners[event].push(cb);
      return () => {
        listeners[event] = listeners[event].filter(c => c !== cb);
      };
    },
  };
  const emit = (event: 'focus' | 'blur') => listeners[event].forEach(cb => cb());
  const refusing = new Proxy(nav, {
    get: (o, k) => {
      if (!(k in o)) {
        throw new Error(`fakeNavigation was not told about ${String(k)}`);
      }
      return o[k as keyof typeof o];
    },
  });
  return { nav: refusing, emit };
}

async function draw(navigation?: unknown) {
  const ui = (
    <AppThemeProvider isDark={false}>
      <Window>
        <Text>Ondřej Dvořák</Text>
      </Window>
    </AppThemeProvider>
  );
  const view = await render(
    navigation ? <NavigationContext.Provider value={navigation as never}>{ui}</NavigationContext.Provider> : ui,
  );
  if (view.root) {
    await fireEvent(view.root, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 200, height: 76 } } });
  }
  return view;
}

let changes: ((s: AppStateStatus) => void)[] = [];
beforeEach(() => {
  sensor.mockClear();
  appState.currentState = 'active';
  changes = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_e, cb) => {
    changes.push(cb as (s: AppStateStatus) => void);
    return { remove: () => {} } as never;
  });
});
afterEach(() => {
  (useReducedMotion as jest.Mock).mockReturnValue(false);
  jest.restoreAllMocks();
});

it('has room to move: drawn 8 wider on each side, under the words', async () => {
  const view = await draw();
  const glint = view.getByTestId('windowGlint', { includeHiddenElements: true });
  expect(glint.props.width).toBe(200 + 2 * windowFilm.tilt.reach);
  const frame = StyleSheet.flatten(glint.parent?.props.style) ?? {};
  expect(frame.left).toBe(-windowFilm.tilt.reach);
  expect(frame.right).toBe(-windowFilm.tilt.reach);
});

it('listens to the tilt while the window is on screen', async () => {
  await draw();
  expect(sensor).toHaveBeenCalled();
});

it('stays still and listens to nothing with Reduce Motion', async () => {
  (useReducedMotion as jest.Mock).mockReturnValue(true);
  const view = await draw();
  expect(sensor).not.toHaveBeenCalled();
  expect(view.getByTestId('windowGlint', { includeHiddenElements: true })).toBeTruthy();
});

it('stops listening while the app is in the background, and listens again when it is back', async () => {
  await draw();
  sensor.mockClear();
  await act(async () => changes.forEach(cb => cb('background')));
  expect(sensor).not.toHaveBeenCalled();
  await act(async () => changes.forEach(cb => cb('active')));
  expect(sensor).toHaveBeenCalled();
});

it('listens to nothing on a screen the stack has covered, and listens once it is back on top', async () => {
  const { nav, emit } = fakeNavigation(false);
  await draw(nav);
  expect(sensor).not.toHaveBeenCalled();
  await act(async () => emit('focus'));
  expect(sensor).toHaveBeenCalled();
  sensor.mockClear();
  await act(async () => emit('blur'));
  expect(sensor).not.toHaveBeenCalled();
});
