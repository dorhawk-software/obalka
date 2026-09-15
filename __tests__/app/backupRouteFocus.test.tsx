// The backup route's return counter (025 review, 2026-09-15), on its own and in the navigator.
//
// The backup screen stays mounted under the transfer it opens, and a transfer can turn backups on by
// keeping the key that arrived. So the screen reads its status again each time it comes BACK into view,
// counted from the route's `blur` and `focus` events - wiring that shipped with no test of its own. The
// same events now also say whether the screen is in view, which is when it may say how a transfer's
// save ended (`inView`).

import { enableScreens } from 'react-native-screens';
// Plain RN views (not native screen containers) so the native-stack renders under jest.
enableScreens(false);

import { act, render, waitFor } from '@testing-library/react-native';
import { TamaguiProvider } from 'tamagui';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { tamaguiConfig } from '../../tamagui.config';
import {
  AppNavigator,
  useViewPresence,
  type AppData,
  type FocusEvents,
} from '../../src/app/AppNavigator';
import { navigate, navigationRef } from '../../src/app/navigationRef';
import { backupController } from '../../src/features/accounts/deps';
import type { DataBoxAccount } from '../../src/services/isds/types';

type Presence = ReturnType<typeof useViewPresence>;

/** A route's focus events, sent when the test says. */
function fakeNavigation() {
  let focused = true;
  const listeners = { focus: new Set<() => void>(), blur: new Set<() => void>() };
  const navigation: FocusEvents & { emit(type: 'focus' | 'blur'): void; listening(): number } = {
    addListener: (type, listener) => {
      listeners[type].add(listener);
      return () => {
        listeners[type].delete(listener);
      };
    },
    isFocused: () => focused,
    emit: type => {
      focused = type === 'focus';
      listeners[type].forEach(l => l());
    },
    listening: () => listeners.focus.size + listeners.blur.size,
  };
  return navigation;
}

function Probe({ navigation, seen }: Readonly<{ navigation: FocusEvents; seen: Presence[] }>) {
  seen.push(useViewPresence(navigation));
  return null;
}

describe('useViewPresence', () => {
  it('counts each return into view - never the first focus - and says whether the screen is in view', async () => {
    const navigation = fakeNavigation();
    const seen: Presence[] = [];
    const view = await render(<Probe navigation={navigation} seen={seen} />);
    const now = () => seen[seen.length - 1];
    const send = async (type: 'focus' | 'blur') => {
      await act(async () => {
        navigation.emit(type);
      });
    };
    expect(now()).toEqual({ inView: true, shownAgain: 0 });

    // The focus react-navigation sends on arrival. The screen's own mount already reads for it.
    await send('focus');
    expect(now()).toEqual({ inView: true, shownAgain: 0 });

    // The transfer opens on top, and then goes away again.
    await send('blur');
    expect(now()).toEqual({ inView: false, shownAgain: 0 });
    await send('focus');
    expect(now()).toEqual({ inView: true, shownAgain: 1 });

    // A second focus with no blur between is not a second return.
    await send('focus');
    expect(now().shownAgain).toBe(1);

    await send('blur');
    await send('focus');
    expect(now()).toEqual({ inView: true, shownAgain: 2 });

    await act(async () => {
      view.unmount();
    });
    expect(navigation.listening()).toBe(0);
  });

  it('starts out of view for a screen that mounts covered', async () => {
    const navigation = fakeNavigation();
    navigation.emit('blur');
    const seen: Presence[] = [];
    await render(<Probe navigation={navigation} seen={seen} />);
    expect(seen[seen.length - 1]).toEqual({ inView: false, shownAgain: 0 });
  });
});

const SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const box: DataBoxAccount = {
  dbType: null,
  id: 'box1',
  boxId: 'box1',
  loginName: 'user',
  label: 'Alpha',
  alias: null,
  authMethod: 'password',
  host: 'production',
  secretRef: 'ref',
  sessionValidUntil: null,
  passwordExpiresAt: null,
  lastSyncedAt: null,
  messageCount: null,
  unreadCount: null,
  pdzCreditCzk: null,
  syncError: null,
  createdAt: 0,
  updatedAt: 0,
};

const data: AppData = {
  accounts: [box],
  activeBoxId: 'box1',
  setActive: jest.fn(),
  addBox: jest.fn(),
  removeBox: jest.fn(),
  setAlias: jest.fn(),
  onReauth: jest.fn(),
  reloadAccounts: jest.fn(),
  crossBox: [],
  unified: false,
  onOpenUnified: jest.fn(),
  onRefreshAll: jest.fn(),
};

describe('the backup route in the navigator', () => {
  it('reads the backup screen again when it comes back from the transfer it opened', async () => {
    // The route's own wiring, not a stand-in: without the counter passed to the screen, nothing reads
    // the restore list again after the transfer screen is closed.
    const listed = jest.spyOn(backupController, 'list');
    try {
      await act(async () => {
        render(
          <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
            <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
              <AppNavigator {...data} />
            </TamaguiProvider>
          </SafeAreaProvider>,
        );
      });
      await waitFor(() => expect(navigationRef.isReady()).toBe(true));

      await act(async () => {
        navigate('Backup');
      });
      await waitFor(() => expect(listed).toHaveBeenCalled());
      await act(async () => {
        navigate('Transfer');
      });
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 20));
      });
      expect(navigationRef.getCurrentRoute()?.name).toBe('Transfer');
      const beforeReturn = listed.mock.calls.length;

      await act(async () => {
        navigationRef.goBack();
      });
      expect(navigationRef.getCurrentRoute()?.name).toBe('Backup');
      await waitFor(() => expect(listed.mock.calls.length).toBeGreaterThan(beforeReturn));
    } finally {
      listed.mockRestore();
    }
  });
});
