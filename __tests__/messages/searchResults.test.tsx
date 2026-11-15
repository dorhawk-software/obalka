// The archive search's results are the register's rows (031 I42, "rows as I18", agreed 2026-11-12):
// the day and its weekday beside the first row of a day, the subject, the sender's tile, the reminder,
// the month heads, and the box each hit is in. Until 2026-11-15 a hit was a row of its own: a 38 avatar,
// the name over the subject, a pill under them, a hairline between rows.

import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { TamaguiProvider } from 'tamagui';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { tamaguiConfig } from '../../tamagui.config';
import type { DataBoxAccount, MessageEnvelope } from '../../src/services/isds/types';
import type { MessageSearchHit } from '../../src/services/db/messagesStore';

const day = (d: number, h = 10) => new Date(2026, 9, d, h, 0).getTime();

const envelope = (id: string, at: number, subject: string): MessageEnvelope => ({
  id,
  subject,
  sender: 'Finanční úřad pro hl. m. Prahu',
  senderAddress: null,
  recipient: 'Jana Nováková',
  recipientAddress: null,
  recipientBoxId: 'r1',
  deliveryTime: at,
  acceptanceTime: null,
  state: 4,
  attachmentSize: 1200,
});

const mockHits: MessageSearchHit[] = [
  { boxId: 'box1', folder: 'received', envelope: envelope('m1', day(14, 11), 'Výzva k doložení') },
  { boxId: 'box1', folder: 'received', envelope: envelope('m2', day(14, 9), 'Platební výměr') },
  { boxId: 'box2', folder: 'sent', envelope: envelope('m3', day(2), 'Žádost o prodloužení lhůty') },
];

jest.mock('../../src/features/accounts/deps', () => ({
  messagesController: { searchMessages: jest.fn(async () => mockHits) },
  remindersController: {
    listForBox: jest.fn(async (boxId: string) =>
      boxId === 'box1' ? [{ boxId, messageId: 'm2', date: new Date(2026, 10, 30).getTime(), source: 'user' }] : [],
    ),
  },
}));

import { SearchScreen } from '../../src/features/messages/screens/SearchScreen';

const account = (boxId: string, label: string): DataBoxAccount => ({
  id: boxId,
  boxId,
  loginName: 'u',
  label,
  dbType: 'FO',
  alias: null,
  authMethod: 'password',
  host: 'czebox',
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

async function search(onOpenMessage = jest.fn()) {
  jest.useFakeTimers({ now: new Date(2026, 10, 15, 12, 0) });
  const view = await render(
    <SafeAreaProvider
      initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } }}
    >
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <SearchScreen
          accounts={[account('box1', 'Ondřej Dvořák'), account('box2', 'Dvořák s.r.o.')]}
          onBack={() => {}}
          onOpenMessage={onOpenMessage}
        />
      </TamaguiProvider>
    </SafeAreaProvider>,
  );
  await fireEvent.changeText(view.getByTestId('search-input'), 'lhůt');
  await act(async () => {
    jest.advanceTimersByTime(300);
  });
  jest.useRealTimers();
  await waitFor(() => view.getByTestId('message-m1'));
  return view;
}

afterEach(() => jest.useRealTimers());

describe('search results, as the register draws them', () => {
  it('prints the day once beside the first row of that day', async () => {
    const view = await search();
    expect(view.getByTestId('message-m1')).toHaveTextContent(/^14/);
    expect(view.getByTestId('message-m2')).not.toHaveTextContent(/^14/);
  });

  it('heads the rows with their month, as the register does', async () => {
    const view = await search();
    // The month in Bricolage, its year a step quieter beside it, said whole.
    expect(view.getByLabelText('Říjen 2026')).toBeTruthy();
  });

  it('says which box each hit is in, with the box pill', async () => {
    const view = await search();
    const hidden = { includeHiddenElements: true };
    expect(view.getAllByTestId('boxPill-box1', hidden)).toHaveLength(2);
    expect(view.getAllByTestId('boxPill-box2', hidden)).toHaveLength(1);
  });

  it('draws a sent hit as a sent row, its delivery state included', async () => {
    const view = await search();
    expect(view.getByTestId('message-m3')).toBeTruthy();
    expect(view.getByTestId('sentRowState', { includeHiddenElements: true })).toBeTruthy();
  });

  it('carries the reminder a hit has, as its row in the inbox does', async () => {
    const view = await search();
    expect(view.getByTestId('message-m2').props.accessibilityLabel).toMatch(/30/);
  });

  it('opens a hit in its box and folder', async () => {
    const onOpen = jest.fn();
    const view = await search(onOpen);
    fireEvent.press(view.getByTestId('message-m3'));
    expect(onOpen).toHaveBeenCalledWith('box2', 'm3', 'sent');
  });
});
