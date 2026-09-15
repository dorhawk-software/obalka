// Inbox-first navigation smoke (feature 011, T021): the navigator ROOT is the active box's inbox (no
// box-list home); switching the active box updates the inbox IN PLACE via shell state (no push/pop);
// a pushed sub-screen (Search) backs to the inbox. Visuals/behavior are 009's - this asserts the IA.

import { enableScreens } from 'react-native-screens';
// Plain RN views (not native screen containers) so the native-stack renders under jest.
enableScreens(false);

import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import { TamaguiProvider } from 'tamagui';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { tamaguiConfig } from '../../tamagui.config';
import { AppNavigator, type AppData } from '../../src/app/AppNavigator';
import type { DataBoxAccount } from '../../src/services/isds/types';

const SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const box = (boxId: string, label: string): DataBoxAccount => ({
  dbType: null,
  id: boxId,
  boxId,
  loginName: 'user',
  label,
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
});

function makeData(activeBoxId: string, over: Partial<AppData> = {}): AppData {
  return {
    accounts: [box('box1', 'Alpha'), box('box2', 'Beta')],
    activeBoxId,
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
    ...over,
  };
}

async function renderNav(data: AppData) {
  let view!: ReturnType<typeof render>;
  await act(async () => {
    view = render(
      <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
        <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
          <AppNavigator {...data} />
        </TamaguiProvider>
      </SafeAreaProvider>,
    );
  });
  return view;
}

describe('inbox-first navigation', () => {
  it('roots on the active box inbox - no box-list home', async () => {
    const view = await renderNav(makeData('box1'));
    // The inbox header (switcher button + global search), not a box-list home (no ☰ menu).
    expect(await view.findByTestId('boxSwitcher')).toBeTruthy();
    expect(view.getByTestId('openSearch')).toBeTruthy();
    expect(view.queryByTestId('openMenu')).toBeNull();
    expect(view.getByText('Alpha')).toBeTruthy();
  });

  it('switching the active box updates the inbox in place (shell state)', async () => {
    const view = await renderNav(makeData('box1'));
    expect(await view.findByTestId('boxSwitcher')).toBeTruthy();
    expect(view.getByText('Alpha')).toBeTruthy();

    // Re-render with a different active box (what AppShell.setActive does) - the root inbox swaps in
    // place; no navigation push/pop.
    await act(async () => {
      view.rerender(
        <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
          <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
            <AppNavigator {...makeData('box2')} />
          </TamaguiProvider>
        </SafeAreaProvider>,
      );
    });
    expect(await view.findByText('Beta')).toBeTruthy();
    expect(view.queryByText('Alpha')).toBeNull();
  });

  it('a pushed sub-screen (Search) backs to the inbox', async () => {
    const view = await renderNav(makeData('box1'));
    await act(async () => {
      fireEvent.press(await view.findByTestId('openSearch'));
    });
    expect(await view.findByTestId('search-input')).toBeTruthy();

    await act(async () => {
      fireEvent.press(view.getByTestId('back'));
    });
    await waitFor(() => expect(view.getByTestId('boxSwitcher')).toBeTruthy());
  });
});
