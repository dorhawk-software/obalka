// A sent message as board R7 draws it (031, agreed 2026-11-12): the Sent board's envelope - from this
// box, to them in the window, the stamp cancelled by the postmark - over the slip that fills in as ISDS
// reports the steps. Seen on Obalka_Demo before the build: the old subject, Komu card and timeline.

import { fireEvent, render, waitFor, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { t } from '../../src/i18n/strings';
import type { DataBoxAccount, MessageEnvelope } from '../../src/services/isds/types';

const AT = new Date(2026, 9, 26, 21, 5).getTime();
let mockState = 4;
let mockSyncedAt: number | null = AT;
let mockMissing = false;

const mockEnvelope = (): MessageEnvelope => ({
  id: '1787306585',
  subject: 'Přiznání',
  sender: 'Jan Novák',
  senderAddress: null,
  recipient: 'Finanční úřad',
  recipientAddress: 'Masarykova 1, 602 00 Brno',
  recipientBoxId: 'fu4x2ab',
  deliveryTime: AT - 60 * 60 * 1000,
  acceptanceTime: mockState === 5 || mockState === 6 ? AT : null,
  state: mockState,
  attachmentSize: 1,
});

jest.mock('../../src/features/accounts/deps', () => ({
  messagesController: {
    getCachedEnvelope: jest.fn(async () => (mockMissing ? null : mockEnvelope())),
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

const open = (folder: 'sent' | 'received' = 'sent', onBack: () => void = () => {}) =>
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <MessageDetail account={account} messageId="1787306585" folder={folder} onBack={onBack} />
    </TamaguiProvider>,
  );

const flat = (node: { props: { style?: unknown } }) =>
  (StyleSheet.flatten(node.props.style as never) ?? {}) as Record<string, unknown>;

afterEach(() => {
  mockState = 4;
  mockSyncedAt = AT;
  mockMissing = false;
});

describe('a sent message (R7)', () => {
  it('is the Sent board s envelope: from this box with its ID, to them with their address', async () => {
    const view = await open();
    await waitFor(() => view.getByTestId('detailEnvelope'));
    expect(view.getByText(t('detail.header.sent'))).toBeTruthy();
    expect(view.getByTestId('detailSender')).toHaveTextContent('Jan Novák');
    expect(view.getByText(t('send.sent.record.id', { id: 'box1' }))).toBeTruthy();
    expect(view.getByTestId('detailRecipient')).toHaveTextContent('Finanční úřad');
    expect(view.getByText(' · fu4x2ab')).toBeTruthy();
    expect(view.getByText(/Masarykova 1/)).toBeTruthy();
    // The subject is on the sheet, not loose on the paper.
    expect(within(view.getByTestId('detailSubject')).getByText('Přiznání')).toBeTruthy();
  });

  it('cancels its stamp with the postmark struck when ISDS took it', async () => {
    const view = await open();
    await waitFor(() => view.getByTestId('detailStamp', { includeHiddenElements: true }));
    expect(view.getByTestId('detailPostmark', { includeHiddenElements: true })).toBeTruthy();
    expect(JSON.stringify(view.toJSON())).toContain(t('send.sent.postmark.ring'));
  });

  it('keeps the steps on the slip: one row while ISDS gives one time, then what is still to come', async () => {
    const view = await open();
    await waitFor(() => view.getByTestId('deliveryRecord'));
    const slip = within(view.getByTestId('deliveryRecord'));
    expect(slip.getByText(t('send.sent.record.id', { id: '1787306585' }))).toBeTruthy();
    expect(slip.getByText(t('sent.merged'))).toBeTruthy();
    expect(slip.getByText(t('send.sent.step.accepted'))).toBeTruthy();
    expect(slip.getByText(t('send.sent.notYet'))).toBeTruthy();
    expect(view.queryByText(t('messages.status.delivered'))).toBeNull();
  });
});

describe('the rows under a message (R7)', () => {
  it('leads the reminder with its glyph in a well', async () => {
    const view = await open('received');
    await waitFor(() => view.getByTestId('detail-term'));
    const row = view.getByTestId('detail-term');
    expect(flat(row)).toEqual(expect.objectContaining({ minHeight: 56, paddingLeft: 12, paddingTop: 8 }));
    const well = row.children[0] as unknown as { props: { style?: unknown } };
    expect(flat(well)).toEqual(expect.objectContaining({ width: 40, height: 40, borderTopLeftRadius: 12 }));
  });

  it('keeps the download inside the card that says there are attachments', async () => {
    const view = await open('received');
    await waitFor(() => view.getByTestId('downloadAttachments'));
    let node: unknown = view.getByTestId('downloadAttachments');
    let inCard = false;
    while (node && !inCard) {
      const n = node as { props: { style?: unknown }; parent: unknown };
      inCard = flat(n).boxShadow !== undefined && flat(n).borderTopLeftRadius === 14;
      node = n.parent;
    }
    expect(inCard).toBe(true);
  });
});

describe('a message the archive does not hold (I31)', () => {
  it('is a failed state: the envelope sealed, what happened, and the one way on, which is back', async () => {
    // Before: red words in the middle of the screen saying "download" and "try again" over a button
    // that went back (the I31.1 walk on Obalka_Demo, 2026-11-13). The detail reads only the archive.
    mockMissing = true;
    const onBack = jest.fn();
    const view = await open('sent', onBack);
    await waitFor(() => view.getByTestId('detailError'));
    expect(view.getByTestId('envelopePose-sealed', { includeHiddenElements: true })).toBeTruthy();
    expect(view.getByText(t('detail.error.title'))).toBeTruthy();
    expect(view.getByText(t('detail.error.body'))).toBeTruthy();
    // The header still says what the screen is.
    expect(view.getByText(t('detail.header.sent'))).toBeTruthy();
    expect(view.getByTestId('retry')).toHaveTextContent(t('detail.error.back'));
    fireEvent.press(view.getByTestId('retry'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
