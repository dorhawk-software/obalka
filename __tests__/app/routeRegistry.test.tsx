// Every screen the app can navigate to is actually registered (and reachable).
//
// Written after a bug that produced no error of any kind: the navigator had a screen REGISTRY and a
// second, hand-written list of `<Stack.Screen>` elements, and `Backup` was only in the registry. A
// `navigate('Backup')` on an unregistered name does nothing at all - no crash, no red box, no log the
// user or a test would see. The Settings row simply did not respond, and every unit test still passed,
// because each one rendered its screen directly.
//
// The invariant now has three links, and this file is the third:
//
//   1. `screens` is a MAPPED type over RootStackParamList - a declared route missing from the registry
//      does not compile.
//   2. The navigator renders from `Object.keys(screens)` - a registry entry cannot be left out.
//   3. Here: the navigator's OWN `routeNames`, read back from react-navigation after mounting, must
//      equal the registry's keys. This is what fails if anyone reintroduces a hand-written list.

import { enableScreens } from 'react-native-screens';
enableScreens(false);

import { render, act, waitFor } from '@testing-library/react-native';
import { CommonActions } from '@react-navigation/native';
import { TamaguiProvider } from 'tamagui';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { tamaguiConfig } from '../../tamagui.config';
import { AppNavigator, screens, type AppData } from '../../src/app/AppNavigator';
import { navigationRef } from '../../src/app/navigationRef';
import type { DataBoxAccount } from '../../src/services/isds/types';

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

async function mountNavigator() {
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
}

describe('navigator route registry', () => {
  it('registers exactly the screens in the registry - nothing declared but unreachable', async () => {
    await mountNavigator();

    // `routeNames` is react-navigation's own answer to "what can I navigate to", read from the mounted
    // navigator rather than from the source - which is the only version that could have caught the bug.
    const registered = [...(navigationRef.getRootState().routeNames ?? [])].sort();
    expect(registered).toEqual(Object.keys(screens).sort());
  });

  it('accepts a navigate() to every registered route', async () => {
    await mountNavigator();

    // The failure mode was silence: navigate() resolved, nothing moved. So this asserts where the
    // navigator ACTUALLY ended up, for every route, rather than that the call did not throw.
    for (const name of Object.keys(screens)) {
      await act(async () => {
        // What `navigate(name, params)` dispatches, typed for a name held as a plain string.
        navigationRef.dispatch(CommonActions.navigate(name, PARAMS[name]));
      });
      expect(navigationRef.getCurrentRoute()?.name).toBe(name);
    }
  });
});

/**
 * The params each route needs to render. Routes not listed here take none.
 *
 * Deliberately keyed by route name and read through `Object.keys(screens)`, so a NEW route with
 * required params fails here loudly (its screen throws on `route.params.x`) instead of being quietly
 * skipped - the same silence this file exists to end.
 */
const PARAMS: Record<string, object | undefined> = {
  MessageDetail: { boxId: 'box1', messageId: 'msg1', folder: 'received' },
  Compose: { boxId: 'box1' },
  Faq: {},
  LicenceGroup: { spdx: 'MIT' },
  LicenceDetail: { spdx: 'MIT' },
};
