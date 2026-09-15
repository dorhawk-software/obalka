// The attention group must say the RIGHT thing about each row it holds (010 US1/US2).
//
// 013 put one feed in "Vyžaduje pozornost" - messages served by fiction - so its row hardcoded the
// gold "Doručeno fikcí" pill. 010 added three more feeds (a user deadline, a cycle-2 scan estimate,
// and plain unread), and a hardcoded pill would then have told someone their message had been
// served by law when it had not. That is a false legal claim, produced by nothing worse than a
// convenient layout: the same defect class as 013's lock-screen promise (Principle VI).
//
// This suite renders the real inbox and asserts what each kind of row actually says.

import { act, render } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { TamaguiProvider } from 'tamagui';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { tamaguiConfig } from '../../tamagui.config';
import type { DataBoxAccount, MessageEnvelope } from '../../src/services/isds/types';
import { MESSAGE_STATE } from '../../src/features/messages/state/messageState';
import type { Reminder } from '../../src/features/messages/state/reminders';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.now();

const envelope = (over: Partial<MessageEnvelope>): MessageEnvelope => ({
  id: 'm',
  subject: 'Předmět',
  sender: 'Odesílatel',
  senderAddress: null,
  recipient: null,
  recipientAddress: null,
  recipientBoxId: null,
  deliveryTime: NOW - 3 * DAY_MS,
  acceptanceTime: null,
  state: MESSAGE_STATE.read,
  attachmentSize: null,
  ...over,
});

const mockMessages: MessageEnvelope[] = [
  // Served by fiction: nobody signed in, the law did. The gold pill belongs here and only here.
  envelope({
    id: 'fiction',
    subject: 'Rozhodnutí o dani', // deliberately free of the words the assertions match on
    sender: 'Finanční úřad',
    state: MESSAGE_STATE.servedByFiction,
    acceptanceTime: NOW - 2 * DAY_MS,
  }),
  // Delivered and unopened. In the group, but there is nothing to announce about it.
  envelope({
    id: 'unread',
    subject: 'Nepřečtená zpráva',
    sender: 'Městský úřad',
    state: MESSAGE_STATE.servedBySignIn,
  }),
  // Read, but the user put a date on it.
  envelope({ id: 'termed', subject: 'S termínem', sender: 'Soud' }),
  // BOTH: served by fiction and carrying a user deadline. The deadline is why it ranks where it
  // does, but the legal clock is still running and must still be visible.
  envelope({
    id: 'both',
    subject: 'Výzva k úhradě',
    sender: 'Krajský soud',
    state: MESSAGE_STATE.servedByFiction,
    acceptanceTime: NOW - 6 * DAY_MS,
  }),
];

const mockReminders: Reminder[] = [
  {
    boxId: 'b1',
    messageId: 'termed',
    date: NOW + 5 * DAY_MS,
    createdBy: 'user',
    createdAt: NOW,
  },
  {
    boxId: 'b1',
    messageId: 'both',
    date: NOW + 2 * DAY_MS,
    createdBy: 'user',
    createdAt: NOW,
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
      messages: [],
      downloaded: [] as string[],
    })),
    getCachedMessages: jest.fn(async () => ({
      envelopes: mockMessages,
      downloaded: [],
      syncedAt: Date.now(),
    })),
  },
  draftsStore: { list: jest.fn(async () => []) },
  remindersController: {
    listForBox: jest.fn(async () => {
      // Held open by the layout-jump test; instant everywhere else.
      if (mockGate.held) {
        await new Promise<void>(release => {
          mockGate.release = release;
        });
      }
      return mockReminders;
    }),
  },
}));

/** Lets one test stall the (normally instant) local reminders read. */
const mockGate: { held: boolean; release: (() => void) | null } = {
  held: false,
  release: null,
};

import { MessageList } from '../../src/features/messages/screens/MessageList';

const SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

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

const inbox = () =>
  render(
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
          />
        </NavigationContainer>
      </TamaguiProvider>
    </SafeAreaProvider>,
  );

describe('the attention group tells the truth about each row', () => {
  it('claims delivery by fiction only on the messages that were served by it', async () => {
    const view = await inbox();
    // Four rows are in the group; two of them were served by fiction.
    expect(view.queryAllByText(/Doručeno fikcí/)).toHaveLength(2);
  });

  it('shows the user their own deadline', async () => {
    const view = await inbox();
    expect(view.queryAllByText(/^Termín /)).toHaveLength(2);
  });

  it('shows BOTH when a message has a deadline and was served by fiction', async () => {
    const view = await inbox();
    // The deadline is why this row ranks where it does, but the legal clock is still running -
    // ranking must not decide which true things the user gets told.
    const row = view.getByTestId('message-both');
    expect(row).toHaveTextContent(/Doručeno fikcí/);
    expect(row).toHaveTextContent(/Termín /);
  });

  // Principle V. A chip that arrives a frame after its row shoves every row below it down - the
  // defect 013 shipped twice. 010 avoids it by waiting for the (local, fast) reminders read rather
  // than by reserving a chip-sized gap on every row forever, so the guarantee lives HERE: no rows at
  // all until the chips are known.
  it('paints no rows until the reminders are known', async () => {
    mockGate.held = true;
    try {
      const view = await inbox();
      expect(view.queryByTestId('message-termed')).toBeNull();

      await act(async () => {
        mockGate.release?.();
      });
      // …and once they are, the row appears WITH its chip already on it.
      const row = view.getByTestId('message-termed');
      expect(row).toHaveTextContent(/Termín /);
    } finally {
      mockGate.held = false;
      mockGate.release = null;
    }
  });

  it('says nothing at all about a merely unread message', async () => {
    const view = await inbox();
    // The unread row carries the group's dot and its subject, and no status claim of any kind.
    const row = view.getByTestId('message-unread');
    expect(row).toHaveTextContent(/Nepřečtená zpráva/);
    expect(row).not.toHaveTextContent(/Doručeno/);
    expect(row).not.toHaveTextContent(/Termín/);
  });
});
