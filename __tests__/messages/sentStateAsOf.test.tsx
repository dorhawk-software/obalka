// "Stav k …" on a sent message's delivery card (owner, 2026-11-11).
//
// The card reads the archive, so a sent message opened from search or offline could show "Dodáno"
// days after it had been served, with nothing saying how old that was. The date shows while the
// state can still change, and never on a final one.

import { render, waitFor } from '@testing-library/react-native';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { t } from '../../src/i18n/strings';
import type { DataBoxAccount, MessageEnvelope } from '../../src/services/isds/types';

const AT = new Date(2026, 9, 26, 21, 5).getTime();
let mockState = 4;
let mockSyncedAt: number | null = AT;

const mockEnvelope = (): MessageEnvelope => ({
  id: '1787306585',
  subject: 'Přiznání',
  sender: 'Jan Novák',
  senderAddress: null,
  recipient: 'Finanční úřad',
  recipientAddress: null,
  recipientBoxId: null,
  deliveryTime: AT - 60 * 60 * 1000,
  acceptanceTime: mockState === 5 || mockState === 6 ? AT : null,
  state: mockState,
  attachmentSize: 1,
});

jest.mock('../../src/features/accounts/deps', () => ({
  messagesController: {
    getCachedEnvelope: jest.fn(async () => mockEnvelope()),
    getCachedSyncedAt: jest.fn(async () => mockSyncedAt),
    getCachedDetail: jest.fn(async () => null),
    markRead: jest.fn(async () => false),
    getDetail: jest.fn(),
    setAttachmentsUnavailable: jest.fn(async () => {}),
    fetchSignedOriginal: jest.fn(),
  },
  accountsController: { decrementUnread: jest.fn(async () => {}) },
  remindersController: {
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
}));
jest.mock('../../src/services/files/attachmentFileStore', () => ({
  attachmentFileStore: { exists: jest.fn(async () => true) },
}));
jest.mock('../../src/services/files/attachmentOpener', () => ({
  attachmentOpener: { open: jest.fn() },
  NoViewerError: class NoViewerError extends Error {},
  openSignedOriginal: jest.fn(),
}));

import { MessageDetail } from '../../src/features/messages/screens/MessageDetail';

const account: DataBoxAccount = {
  id: 'a1',
  boxId: 'box1',
  loginName: 'user',
  label: 'Jan Novák',
  dbType: 'FO',
  alias: null,
  authMethod: 'password',
  host: 'production',
  secretRef: 'box1',
  sessionValidUntil: null,
  passwordExpiresAt: null,
  lastSyncedAt: null,
  messageCount: null,
  unreadCount: null,
  pdzCreditCzk: null,
  syncError: null,
  createdAt: 1,
  updatedAt: 1,
};

const open = () =>
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <MessageDetail account={account} messageId="1787306585" folder="sent" onBack={() => {}} />
    </TamaguiProvider>,
  );

describe('how old a sent message’s state is', () => {
  it.each([
    ['submitted', 1],
    ['in the box, not yet served', 4],
  ])('says so while it can still change: %s', async (_, state) => {
    mockState = state;
    mockSyncedAt = AT;
    const view = await open();
    await waitFor(() => view.getByTestId('state-as-of'));
    expect(view.getByTestId('state-as-of')).toHaveTextContent(
      t('detail.stateAsOf', { d: '26.10.2026 21:05' }),
    );
  });

  it.each([
    ['served by fiction', 5],
    ['served by sign-in', 6],
    ['undeliverable', 8],
  ])('says nothing once it is final: %s', async (_, state) => {
    mockState = state;
    mockSyncedAt = AT;
    const view = await open();
    await waitFor(() => view.getByText(t('detail.deliveryStatus')));
    expect(view.queryByTestId('state-as-of')).toBeNull();
  });

  it('says nothing for a row no listing brought - a restore or a transfer', async () => {
    mockState = 4;
    mockSyncedAt = null;
    const view = await open();
    await waitFor(() => view.getByText(t('detail.deliveryStatus')));
    expect(view.queryByTestId('state-as-of')).toBeNull();
  });
});
