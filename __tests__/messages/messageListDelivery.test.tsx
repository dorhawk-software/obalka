// The delivering call must happen only when the user asks for it (014).
//
// `GetListOfReceivedMessages` legally SERVES the user's mail under §17(3), and the Provozní řád ISDS
// permits a locally-installed application to sign in only "pomocí manuálního příkazu uživatele". The
// inbox therefore syncs on exactly two triggers: opening a box/folder, and pull-to-refresh.
//
// The bug this pins down was invisible in every other test. `refresh` listed the account OBJECT in its
// dependencies and sat in the open-folder effect's dependency list, while `reloadAccounts()` - called
// on every screen focus AND on every box-switcher open - re-read the accounts table and handed down
// freshly constructed objects with identical contents. Each of those churned `refresh`, re-ran the
// effect, aborted the in-flight sync, re-rendered the list from cache (a visible flash of a different
// message set) and fired ANOTHER listReceived. Tapping the box switcher delivered the user's post.

import { render, type RenderResult } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { TamaguiProvider } from 'tamagui';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { tamaguiConfig } from '../../tamagui.config';
import type { DataBoxAccount } from '../../src/services/isds/types';

const mockListReceived = jest.fn(async (_account?: DataBoxAccount) => ({
  kind: 'loaded' as const,
  messages: [],
  downloaded: [] as string[],
}));
const mockListSent = jest.fn(async (_account?: DataBoxAccount) => ({
  kind: 'loaded' as const,
  messages: [],
  downloaded: [] as string[],
}));

jest.mock('../../src/features/accounts/deps', () => ({
  messagesController: {
    listReceived: (account: DataBoxAccount) => mockListReceived(account),
    listSent: (account: DataBoxAccount) => mockListSent(account),
    getCachedMessages: jest.fn(async () => ({
      envelopes: [],
      downloaded: [],
      syncedAt: null,
    })),
  },
  draftsStore: { list: jest.fn(async () => []) },
  // 010: the inbox reads reminders for the attention group and the chips. Local-only - it must never
  // become another reason to touch ISDS, which is what this suite exists to guard.
  remindersController: { listForBox: jest.fn(async () => []) },
}));

import { MessageList } from '../../src/features/messages/screens/MessageList';

const SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/** A fresh object every call - exactly what `reloadAccounts()` produces from the DB. */
const box = (): DataBoxAccount => ({
  id: 'b1',
  boxId: 'b1',
  loginName: 'user',
  label: 'Alpha',
  dbType: null,
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

// `MessageList` uses `useFocusEffect`, so it needs a navigation context even rendered on its own.
const tree = (account: DataBoxAccount, resyncNonce = 0) => (
  <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <NavigationContainer>
        <MessageList
          account={account}
          onOpenSwitcher={() => {}}
          onSearch={() => {}}
          onOpenMessage={() => {}}
          onCompose={() => {}}
          onReauth={() => {}}
        onOpenFaq={() => {}}
          resyncNonce={resyncNonce}
        />
      </NavigationContainer>
    </TamaguiProvider>
  </SafeAreaProvider>
);

beforeEach(() => {
  mockListReceived.mockClear();
  mockListSent.mockClear();
});

describe('the inbox does not deliver mail on its own', () => {
  it('syncs once when the box opens', async () => {
    await render(tree(box()));
    expect(mockListReceived).toHaveBeenCalledTimes(1);
  });

  it('does NOT sync again when the account object is replaced with an equal one', async () => {
    const view: RenderResult = await render(tree(box()));
    expect(mockListReceived).toHaveBeenCalledTimes(1);

    // What `reloadAccounts()` does on switcher-open and on every focus: same box, new object.
    for (let i = 0; i < 3; i++) {
      await view.rerender(tree(box()));
    }
    expect(mockListReceived).toHaveBeenCalledTimes(1);
  });

  it('syncs again when a re-auth SUCCEEDS - and only then', async () => {
    // The strip that says "your sign-in expired" clears when a sync reports back, so a successful
    // re-auth has to trigger one. Nothing else changes across a re-auth (same box, same folder), so
    // the shell passes a counter. Reported from the device: the strip survived a good sign-in until
    // the user pulled to refresh.
    const view: RenderResult = await render(tree(box(), 0));
    expect(mockListReceived).toHaveBeenCalledTimes(1);

    // A re-render with the SAME nonce must not deliver mail again.
    await view.rerender(tree(box(), 0));
    expect(mockListReceived).toHaveBeenCalledTimes(1);

    await view.rerender(tree(box(), 1));
    expect(mockListReceived).toHaveBeenCalledTimes(2);
  });

  it('still syncs when the box genuinely changes', async () => {
    const view: RenderResult = await render(tree(box()));
    expect(mockListReceived).toHaveBeenCalledTimes(1);

    await view.rerender(
      tree({ ...box(), id: 'b2', boxId: 'b2', label: 'Beta' }),
    );
    expect(mockListReceived).toHaveBeenCalledTimes(2);
    // …and against the NEW box, not a stale captured one.
    expect(mockListReceived.mock.calls[1][0]).toMatchObject({ boxId: 'b2' });
  });
});
