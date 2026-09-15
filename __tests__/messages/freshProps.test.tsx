// A screen handed the same box again, as a new object, loads nothing again (2026-10-03).
//
// The shell keeps an unchanged account the same object now (`reconcileList`), and
// `app/noDoubleLoad.test.tsx` holds it to that. This is the second line: the screens themselves key
// their loads on the box's ID, so a parent that does hand down a fresh copy - or builds a prop inline,
// as every parent eventually does - costs a re-render and nothing else. Before, the inbox listed its
// box again, the merged view re-read the archive, and the detail blanked to its skeleton, cancelled a
// download under way and sent the mark-read again.

import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { TamaguiProvider } from 'tamagui';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { tamaguiConfig } from '../../tamagui.config';
import type { DataBoxAccount, MessageEnvelope } from '../../src/services/isds/types';

const mockEnvelope: MessageEnvelope = {
  id: '1234567',
  subject: 'Rozhodnutí',
  sender: 'Finanční úřad',
  senderAddress: null,
  recipient: null,
  recipientAddress: null,
  recipientBoxId: null,
  deliveryTime: Date.UTC(2026, 7, 18),
  acceptanceTime: Date.UTC(2026, 7, 18),
  state: 5, // delivered, not yet read: opening it marks it read
  attachmentSize: 1,
};

const mockCalls = {
  listReceived: jest.fn(async () => ({ kind: 'loaded', messages: [], downloaded: [], syncedAt: 1 })),
  getMergedMessages: jest.fn(async () => ({ hits: [], downloaded: [], syncedAt: null })),
  getCachedMessages: jest.fn(async () => ({ envelopes: [], downloaded: [], syncedAt: null })),
  getCachedEnvelope: jest.fn(async () => mockEnvelope),
  getCachedDetail: jest.fn(async () => null),
  markRead: jest.fn(async () => true),
  getDetail: jest.fn(),
};

jest.mock('../../src/features/accounts/deps', () => {
  const call =
    (name: string) =>
    (...args: unknown[]) =>
      (mockCalls as Record<string, (...a: unknown[]) => unknown>)[name](...args);
  return {
    messagesController: {
      listReceived: call('listReceived'),
      listSent: call('listReceived'),
      getMergedMessages: call('getMergedMessages'),
      getCachedMessages: call('getCachedMessages'),
      getCachedEnvelope: call('getCachedEnvelope'),
      getCachedDetail: call('getCachedDetail'),
      markRead: call('markRead'),
      getDetail: call('getDetail'),
      setAttachmentsUnavailable: jest.fn(async () => {}),
      fetchSignedOriginal: jest.fn(),
    },
    accountsController: { decrementUnread: jest.fn(async () => {}) },
    draftsStore: { list: jest.fn(async () => []) },
    remindersController: {
      listForBox: jest.fn(async () => []),
      get: jest.fn(async () => null),
      setReminder: jest.fn(async () => {}),
      removeReminder: jest.fn(async () => {}),
      alertsFor: jest.fn(async () => 'on'),
      turnOnAlerts: jest.fn(async () => {}),
    },
    scanController: {
      enabled: jest.fn(async () => false),
      isDismissed: jest.fn(async () => false),
      scan: jest.fn(async () => null),
      dismiss: jest.fn(),
    },
  };
});
jest.mock('../../src/services/files/attachmentFileStore', () => ({
  attachmentFileStore: { exists: jest.fn(async () => true) },
}));
jest.mock('../../src/services/files/attachmentOpener', () => ({
  attachmentOpener: { open: jest.fn() },
  NoViewerError: class NoViewerError extends Error {},
  openSignedOriginal: jest.fn(),
}));

import { MessageList } from '../../src/features/messages/screens/MessageList';
import { MessageDetail } from '../../src/features/messages/screens/MessageDetail';

const SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/** A fresh object every call - what a re-read of the accounts table hands down. */
const box = (boxId: string): DataBoxAccount => ({
  id: boxId,
  boxId,
  loginName: 'user',
  label: `Box ${boxId}`,
  dbType: 'FO',
  alias: null,
  authMethod: 'password',
  host: 'production',
  secretRef: 'ref',
  sessionValidUntil: null,
  passwordExpiresAt: null,
  lastSyncedAt: 1,
  messageCount: null,
  unreadCount: 1,
  pdzCreditCzk: null,
  syncError: null,
  createdAt: 0,
  updatedAt: 0,
  color: '#2A5C9A',
});

/** The inbox exactly as a careless parent renders it: new objects and new arrows on every render. */
function inbox(unified: boolean) {
  const accounts = [box('a'), box('b')];
  return (
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <NavigationContainer>
          <MessageList
            account={accounts[0]}
            onOpenSwitcher={() => {}}
            onSearch={() => {}}
            onOpenMessage={() => {}}
            onCompose={() => {}}
            onReauth={() => {}}
            onOpenFaq={() => {}}
            crossBox={[]}
            unified={unified ? { accounts, onRefreshAll: () => {}, onReauthBox: () => {} } : null}
          />
        </NavigationContainer>
      </TamaguiProvider>
    </SafeAreaProvider>
  );
}

function detail() {
  return (
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <MessageDetail account={box('a')} messageId={mockEnvelope.id} folder="received" onBack={() => {}} />
    </TamaguiProvider>
  );
}

const counts = () =>
  Object.fromEntries(Object.entries(mockCalls).map(([k, fn]) => [k, fn.mock.calls.length]));

beforeEach(() => {
  Object.values(mockCalls).forEach(fn => fn.mockClear());
});

describe('the inbox, handed the same box again', () => {
  it('lists it once', async () => {
    const view = await render(inbox(false));
    await waitFor(() => expect(mockCalls.listReceived).toHaveBeenCalledTimes(1));
    const before = counts();
    for (let i = 0; i < 3; i++) {
      await act(async () => {
        view.rerender(inbox(false));
      });
    }
    expect(counts()).toEqual(before);
  });

  it('reads the merged archive once', async () => {
    const view = await render(inbox(true));
    await waitFor(() => expect(mockCalls.getMergedMessages).toHaveBeenCalledTimes(1));
    const before = counts();
    for (let i = 0; i < 3; i++) {
      await act(async () => {
        view.rerender(inbox(true));
      });
    }
    expect(counts()).toEqual(before);
  });
});

describe('the detail, handed the same box again', () => {
  it('opens and marks read once', async () => {
    const view = await render(detail());
    await waitFor(() => expect(mockCalls.markRead).toHaveBeenCalledTimes(1));
    const before = counts();
    for (let i = 0; i < 3; i++) {
      await act(async () => {
        view.rerender(detail());
      });
    }
    expect(counts()).toEqual(before);
    expect(mockCalls.getCachedEnvelope).toHaveBeenCalledTimes(1);
  });

  it('does not cancel a download under way', async () => {
    let signal: AbortSignal | undefined;
    mockCalls.getDetail.mockImplementation(
      (_a: unknown, _m: unknown, _f: unknown, s: AbortSignal) => {
        signal = s;
        return new Promise(() => {});
      },
    );
    const view = await render(detail());
    const button = await waitFor(() => view.getByTestId('downloadAttachments'));
    await act(async () => {
      fireEvent.press(button);
    });
    await waitFor(() => expect(signal).toBeDefined());
    await act(async () => {
      view.rerender(detail());
    });
    expect(signal?.aborted).toBe(false);
  });
});
