// The inbox can be navigated by heading (001 T042, extended app-wide 2026-09-08).
//
// A long inbox is exactly where a screen-reader user needs to move in jumps: past the attention block,
// to "Dnes", to a month. Before this the app had NO `accessibilityRole="header"` anywhere at all, so
// every screen was one flat run of text and the only way through was swiping item by item.
//
// The second half of the same problem, found by the 2026-09-09 native audit: the jumps landed on rows
// that were themselves four or five separate stops with nothing tying them together. A row is one
// element saying one sentence now - see `state/rowLabel.ts` for the wording, here for the fact that
// the row actually carries it.

import { render, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { TamaguiProvider } from 'tamagui';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { tamaguiConfig } from '../../tamagui.config';
import type { DataBoxAccount, MessageEnvelope } from '../../src/services/isds/types';
import { MESSAGE_STATE } from '../../src/features/messages/state/messageState';

const DAY = 86400000;
const mockMessages: MessageEnvelope[] = [
  {
    id: 'unread',
    subject: 'Nepřečtená',
    sender: 'Úřad',
    senderAddress: null,
    recipient: null,
    recipientAddress: null,
    recipientBoxId: null,
    deliveryTime: Date.now() - 2 * DAY,
    acceptanceTime: null,
    state: MESSAGE_STATE.servedBySignIn,
    attachmentSize: null,
  },
  {
    id: 'old',
    subject: 'Starší',
    sender: 'Soud',
    senderAddress: null,
    recipient: null,
    recipientAddress: null,
    recipientBoxId: null,
    deliveryTime: Date.now() - 60 * DAY,
    acceptanceTime: null,
    state: MESSAGE_STATE.read,
    attachmentSize: null,
  },
];

jest.mock('../../src/features/accounts/deps', () => ({
  messagesController: {
    listReceived: jest.fn(async () => ({
      kind: 'loaded' as const,
      messages: mockMessages,
      downloaded: [] as string[],
    })),
    listSent: jest.fn(async () => ({
      kind: 'loaded' as const,
      messages: [] as MessageEnvelope[],
      downloaded: [] as string[],
    })),
    getCachedMessages: jest.fn(async () => ({
      envelopes: mockMessages,
      downloaded: [],
      syncedAt: Date.now(),
    })),
  },
  draftsStore: { list: jest.fn(async () => []) },
  remindersController: { listForBox: jest.fn(async () => []) },
  scanController: { clearBox: jest.fn(async () => {}) },
}));

import { MessageList } from '../../src/features/messages/screens/MessageList';

const account: DataBoxAccount = {
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
};

function countHeaders(json: unknown): number {
  if (json == null || typeof json !== 'object') {
    return 0;
  }
  const n = json as { props?: Record<string, unknown>; children?: unknown[] };
  const self = n.props?.accessibilityRole === 'header' ? 1 : 0;
  return (n.children ?? []).reduce<number>((sum, c) => sum + countHeaders(c), self);
}

it('announces its section headers', async () => {
  const view = await render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
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
          />
        </NavigationContainer>
      </TamaguiProvider>
    </SafeAreaProvider>,
  );
  await waitFor(() => expect(view.getByTestId('message-unread')).toBeTruthy());
  // The attention block plus at least one date group - the two kinds of jump the list offers.
  expect(countHeaders(view.toJSON())).toBeGreaterThanOrEqual(2);
});

it('gives each row a single composed label, unread state included', async () => {
  const view = await render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
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
          />
        </NavigationContainer>
      </TamaguiProvider>
    </SafeAreaProvider>,
  );
  await waitFor(() => expect(view.getByTestId('message-unread')).toBeTruthy());

  const unread = view.getByTestId('message-unread').props.accessibilityLabel;
  // Everything the row shows, on the row itself - not spread over the four children that draw it.
  expect(unread).toContain('Nová');
  expect(unread).toContain('Úřad');
  expect(unread).toContain('Nepřečtená');

  // …and the read row does NOT claim to be new. The gold dot is the only visual difference between
  // the two, so this is the whole of what the announcement adds.
  expect(view.getByTestId('message-old').props.accessibilityLabel).not.toContain(
    'Nová',
  );
});
