// The "Jinde" line inside a real inbox (024 FR-001/FR-003).
//
// `CrossBoxLine` refuses to draw a sentence with no words in it. That alone is not enough: the inbox
// decides whether the line is a SECTION, and when it is, the attention block drops its own closing
// footer because the line's top hairline closes the block instead. A section whose line then drew
// nothing would leave the block open-ended. So the inbox asks the same question the line does, and
// this suite renders the real list to hold both halves together.

import { render } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { TamaguiProvider } from 'tamagui';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { tamaguiConfig } from '../../tamagui.config';
import type { DataBoxAccount, MessageEnvelope } from '../../src/services/isds/types';
import { MESSAGE_STATE } from '../../src/features/messages/state/messageState';
import type { BoxAttention } from '../../src/features/messages/state/crossBox';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.now();

// Served by fiction, so THIS box has an attention block for the line to follow.
const mockMessages: MessageEnvelope[] = [
  {
    id: 'served',
    subject: 'Rozhodnutí',
    sender: 'Finanční úřad',
    senderAddress: null,
    recipient: null,
    recipientAddress: null,
    recipientBoxId: null,
    deliveryTime: NOW - 12 * DAY_MS,
    acceptanceTime: NOW - 2 * DAY_MS,
    state: MESSAGE_STATE.servedByFiction,
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
  remindersController: { listForBox: jest.fn(async () => []) },
}));

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

const other = (over: Partial<BoxAttention> = {}): BoxAttention => ({
  boxId: 'b2',
  name: 'Beta',
  unread: 0,
  soonest: null,
  deadlines: [],
  fiction: 0,
  syncError: null,
  stale: false,
  refreshing: false,
  ...over,
});

const inbox = (crossBox: BoxAttention[]) =>
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
            crossBox={crossBox}
          />
        </NavigationContainer>
      </TamaguiProvider>
    </SafeAreaProvider>,
  );

describe('the line in the inbox', () => {
  it("follows this box's attention block with the other box's nearest deadline", async () => {
    // The reported case, end to end: another box whose only news is a reminder not yet due. Its
    // aggregate was read the day before, so the day count it carries is yesterday's; "za 2 dny" can
    // only come from the date, counted with the inbox's own clock.
    const today = new Date(NOW);
    const inTwoDays = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + 2,
      12,
    ).getTime();
    const view = await inbox([
      other({
        soonest: { reason: 'reminder', date: inTwoDays, daysRemaining: 3 },
        deadlines: [inTwoDays],
      }),
    ]);
    expect(await view.findByTestId('message-served')).toBeTruthy();
    expect(view.getByTestId('crossBoxSummary')).toHaveTextContent('Jinde: termín za 2 dny');
    // The line's own top hairline closes the block, so the block's footer steps aside.
    expect(view.queryByTestId('attentionEnd')).toBeNull();
  });

  it('is not inserted when the other boxes have nothing to say, and the block stays closed', async () => {
    // `crossBoxAttention` never builds a box like this; the inbox must still not trust that. A line
    // section that drew nothing would have taken the block's footer with it.
    const view = await inbox([other()]);
    expect(await view.findByTestId('message-served')).toBeTruthy();
    expect(view.queryByTestId('crossBoxLine')).toBeNull();
    expect(view.getByTestId('attentionEnd')).toBeTruthy();
  });
});
