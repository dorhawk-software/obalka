// The merged view is the SAME list, in a mode.
//
// The first attempt built a second screen and it drifted immediately: no avatars, no month sections,
// different row metrics. Reported in exactly those terms, and the fix was the obvious one - the only
// thing that genuinely differs between "one box" and "all boxes" is whether a row has to say which
// box it came from. So these tests are mostly about that single prop, and about the things that must
// NOT appear in one mode or the other.

import { render, waitFor, type RenderResult } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { TamaguiProvider } from 'tamagui';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { tamaguiConfig } from '../../tamagui.config';
import { t } from '../../src/i18n/strings';
import type { DataBoxAccount, MessageEnvelope } from '../../src/services/isds/types';
import type { MergedList } from '../../src/services/db/messagesStore';

const mockMerged = jest.fn<Promise<MergedList>, [string?]>();
const mockListReceived = jest.fn(async () => ({
  kind: 'loaded' as const,
  messages: [] as MessageEnvelope[],
  downloaded: [] as string[],
  syncedAt: null,
}));

jest.mock('../../src/features/accounts/deps', () => ({
  messagesController: {
    listReceived: () => mockListReceived(),
    listSent: () => mockListReceived(),
    getMergedMessages: (folder?: string) => mockMerged(folder),
    getCachedMessages: jest.fn(async () => ({
      envelopes: [],
      downloaded: [],
      syncedAt: null,
    })),
  },
  draftsStore: { list: jest.fn(async () => []) },
  remindersController: { listForBox: jest.fn(async () => []) },
}));

import { MessageList } from '../../src/features/messages/screens/MessageList';

const SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const box = (boxId: string, over: Partial<DataBoxAccount> = {}): DataBoxAccount =>
  ({
    id: boxId,
    boxId,
    loginName: 'user',
    label: `Box ${boxId}`,
    dbType: 'PFO',
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
    ...over,
  }) as DataBoxAccount;

const envelope = (id: string, over: Partial<MessageEnvelope> = {}): MessageEnvelope =>
  ({
    id,
    subject: 'Výzva k podání',
    sender: 'Finanční úřad',
    senderAddress: null,
    recipient: null,
    recipientAddress: null,
    recipientBoxId: null,
    deliveryTime: Date.UTC(2026, 7, 18),
    acceptanceTime: null,
    state: 7, // read: keeps the attention group out of the way unless a test wants it
    attachmentSize: 0,
    ...over,
  }) as MessageEnvelope;

const mount = (
  accounts: DataBoxAccount[],
  unified: boolean,
): Promise<RenderResult> =>
  render(
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
            unified={
              unified
                ? {
                    accounts,
                    onRefreshAll: () => {},
                    onReauthBox: () => {},
                  }
                : null
            }
          />
        </NavigationContainer>
      </TamaguiProvider>
    </SafeAreaProvider>,
  );

beforeEach(() => {
  mockMerged.mockReset();
  mockListReceived.mockClear();
  mockMerged.mockResolvedValue({ hits: [], downloaded: [], syncedAt: null });
});

describe('the box chip is the only difference', () => {
  it('names the box on every row in the merged view', async () => {
    mockMerged.mockResolvedValue({
      hits: [
        { boxId: 'a', folder: 'received', envelope: envelope('m1') },
        { boxId: 'b', folder: 'received', envelope: envelope('m2') },
      ],
      downloaded: [],
      syncedAt: null,
    });
    const view = await mount(
      [box('a', { label: 'Podnikající FO' }), box('b', { label: 'Alfa s.r.o.' })],
      true,
    );
    await waitFor(() => view.getByTestId('message-m1'));
    // "PFO · Podnikající FO" - the legal-form code plus the name.
    expect(view.getByTestId('message-m1')).toHaveTextContent(/PFO/);
    expect(view.getByTestId('message-m1')).toHaveTextContent(/Podnikající FO/);
    expect(view.getByTestId('message-m2')).toHaveTextContent(/Alfa s\.r\.o\./);
  });

  it('names no box in a per-box inbox, where every row shares one', async () => {
    mockListReceived.mockResolvedValue({
      kind: 'loaded' as const,
      messages: [envelope('m1')],
      downloaded: [],
      syncedAt: null,
    });
    const view = await mount([box('a', { label: 'Podnikající FO' })], false);
    await waitFor(() => view.getByTestId('message-m1'));
    expect(view.getByTestId('message-m1')).not.toHaveTextContent(/Podnikající FO/);
  });
});

describe('what the merged view reads', () => {
  it('reads the local archive and never the network', async () => {
    // The whole legal position: entering this view cannot deliver anybody's mail under 17(3),
    // because the only call it makes is a local one.
    await mount([box('a'), box('b')], true);
    await waitFor(() => expect(mockMerged).toHaveBeenCalled());
    expect(mockListReceived).not.toHaveBeenCalled();
  });

  it('leaves the per-box inbox reading ISDS as it always did', async () => {
    await mount([box('a')], false);
    await waitFor(() => expect(mockListReceived).toHaveBeenCalled());
    expect(mockMerged).not.toHaveBeenCalled();
  });
});

describe('what belongs to one box does not appear in the merged view', () => {
  it('hides compose, because every send belongs to a legal identity', async () => {
    const view = await mount([box('a'), box('b')], true);
    await waitFor(() => expect(mockMerged).toHaveBeenCalled());
    expect(view.queryByTestId('compose')).toBeNull();
  });

  it('keeps compose in a per-box inbox', async () => {
    const view = await mount([box('a')], false);
    await waitFor(() => expect(mockListReceived).toHaveBeenCalled());
    expect(view.getByTestId('compose')).toBeTruthy();
  });

  it('replaces the per-box re-auth strip with a count of unreachable boxes', async () => {
    const view = await mount(
      [box('a', { syncError: 'reauth' }), box('b', { syncError: 'error' })],
      true,
    );
    await waitFor(() => view.getByTestId('unifiedMissing'));
    expect(view.getByTestId('unifiedMissing')).toHaveTextContent(
      new RegExp(t('unified.missing.few', { n: 2 })),
    );
    expect(view.queryByTestId('reauth')).toBeNull();
  });

  it('says nothing about missing boxes when every box refreshed', async () => {
    const view = await mount([box('a'), box('b')], true);
    await waitFor(() => expect(mockMerged).toHaveBeenCalled());
    expect(view.queryByTestId('unifiedMissing')).toBeNull();
  });
});

it('titles itself for the merged view rather than for a box', async () => {
  const view = await mount([box('a'), box('b')], true);
  await waitFor(() => expect(mockMerged).toHaveBeenCalled());
  expect(view.getByTestId('boxSwitcher')).toHaveTextContent(
    new RegExp(t('unified.title')),
  );
});
