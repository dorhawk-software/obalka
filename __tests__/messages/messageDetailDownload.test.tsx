// The detail screen's answer to a download that did not bring the attachments (004 research R8).
//
// Until 2026-09-15 the screen decided for itself that ISDS had deleted a message: ANY failure the
// controller reported as `messages.error.load` - a 500, a paused VoDZ service, an answer it could not
// parse - on a message delivered more than 90 days ago recorded the files as lost for good and swapped
// the download button for "no longer available". Only the controller may say that now, and only on
// ISDS's own code for a deleted message; the screen shows the verdict it is given.

import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { StyleSheet, type StyleProp, type TextStyle } from 'react-native';
import { reauthKey } from '../../src/features/accounts/state/reauthCopy';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { t } from '../../src/i18n/strings';
import type {
  DataBoxAccount,
  MessageEnvelope,
} from '../../src/services/isds/types';

const DAY = 24 * 60 * 60 * 1000;

const mockGetDetail = jest.fn();
const mockGetCachedDetail = jest.fn(async (..._args: unknown[]): Promise<unknown> => null);
const mockSetUnavailable = jest.fn(async (..._args: unknown[]) => {});
/** Accepted and delivered long past any retention window - the case the old rule fired on. */
const mockEnvelope: MessageEnvelope = {
  id: '1234567',
  subject: 'Rozhodnutí',
  sender: 'Finanční úřad',
  senderAddress: null,
  recipient: null,
  recipientAddress: null,
  recipientBoxId: null,
  deliveryTime: Date.now() - 401 * DAY,
  acceptanceTime: Date.now() - 400 * DAY,
  state: 7,
  attachmentSize: 1,
};

jest.mock('../../src/features/accounts/deps', () => ({
  messagesController: {
    getCachedEnvelope: jest.fn(async () => mockEnvelope),
    getCachedDetail: (...args: unknown[]) => mockGetCachedDetail(...args),
    markRead: jest.fn(async () => false),
    getDetail: (...args: unknown[]) => mockGetDetail(...args),
    setAttachmentsUnavailable: (...args: unknown[]) => mockSetUnavailable(...args),
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
import { attachmentFileStore } from '../../src/services/files/attachmentFileStore';

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

/** Open the message from the archive. AWAITED: RNTL 14's `render` hands back a thenable. */
function openMessage() {
  return render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <MessageDetail
        account={account}
        messageId={mockEnvelope.id}
        folder="received"
        onBack={() => {}}
      />
    </TamaguiProvider>,
  );
}

/** Open the message (never downloaded) and press "download", with the controller answering `outcome`. */
async function downloadWith(outcome: unknown) {
  mockGetDetail.mockResolvedValue(outcome);
  const view = await openMessage();
  const button = await waitFor(() => view.getByTestId('downloadAttachments'), { timeout: 3000 });
  await fireEvent.press(button);
  await waitFor(() => expect(mockGetDetail).toHaveBeenCalledTimes(1));
  return view;
}

beforeEach(() => {
  mockGetDetail.mockReset();
  mockGetCachedDetail.mockReset();
  mockGetCachedDetail.mockResolvedValue(null);
  mockSetUnavailable.mockClear();
  jest.mocked(attachmentFileStore.exists).mockImplementation(async () => true);
});

describe('the detail screen after a download that brought no attachments', () => {
  it('reads a failure past 90 days as a failure: it says so, keeps the retry, and records no loss', async () => {
    const view = await downloadWith({ kind: 'error', messageKey: 'messages.error.load' });
    await waitFor(() => view.getByText(t('messages.error.load')));
    expect(view.getByTestId('downloadAttachments')).toBeTruthy();
    expect(view.queryByText(t('detail.attachments.unavailable.title'))).toBeNull();
    expect(mockSetUnavailable).not.toHaveBeenCalledWith('box1', mockEnvelope.id, true);
  });

  it('shows the files as no longer available only when the controller says ISDS deleted the message', async () => {
    const view = await downloadWith({ kind: 'gone' });
    await waitFor(() => view.getByText(t('detail.attachments.unavailable.title')));
    // Nothing left to press: ISDS said the message is gone, and asking again would not change that.
    expect(view.queryByTestId('downloadAttachments')).toBeNull();
    // The controller has recorded it already (`attachmentsGone`); the screen does not write it twice.
    expect(mockSetUnavailable).not.toHaveBeenCalled();
  });
});

// A large-volume message whose enclosures stopped arriving part-way (constitution IV, 2026-09-15). The
// screen showed what arrived under "Celá zpráva uložena v archivu" and offered nothing more.
describe('the detail screen for a large-volume message with enclosures missing', () => {
  const held = {
    name: 'rozhodnuti.pdf',
    mimeType: 'application/pdf',
    metaType: 'main',
    contentBase64: '',
    localPath: '/docs/attachments/box1/1234567/0_rozhodnuti.pdf',
    size: 20_000_000,
  };
  const partial = {
    id: mockEnvelope.id,
    subject: mockEnvelope.subject,
    sender: mockEnvelope.sender,
    senderAddress: null,
    recipient: null,
    recipientAddress: null,
    deliveryTime: mockEnvelope.deliveryTime,
    acceptanceTime: mockEnvelope.acceptanceTime,
    attachments: [held],
    enclosuresMissingFrom: 1,
  };
  const incompleteText = t('detail.attachments.incomplete.one', { n: 1 });
  const opacityOf = (element: { props: { style?: StyleProp<TextStyle> } }) =>
    StyleSheet.flatten(element.props.style)?.opacity ?? 1;

  it('shows what arrived, says more is missing and why, and offers the missing ones alone', async () => {
    const view = await downloadWith({
      kind: 'partial',
      detail: partial,
      failure: { kind: 'error', messageKey: 'detail.attachments.missingFailed' },
    });
    await waitFor(() => view.getByText(incompleteText));
    expect(view.getByTestId('attachment-0')).toBeTruthy();
    expect(view.getByText(t('detail.attachments.missingFailed'))).toBeTruthy();
    expect(view.getByText(t('detail.attachments.partlySaved'))).toBeTruthy();
    expect(view.queryByText(t('detail.attachments.fullSaved'))).toBeNull();

    mockGetDetail.mockResolvedValue({
      kind: 'detail',
      detail: { ...partial, enclosuresMissingFrom: undefined },
    });
    await fireEvent.press(view.getByTestId('downloadMissingAttachments'));
    await waitFor(() => expect(mockGetDetail).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(view.queryByText(incompleteText)).toBeNull());
    expect(view.getByText(t('detail.attachments.fullSaved'))).toBeTruthy();
  });

  it('says a lost session in the words that lead to signing in again', async () => {
    const view = await downloadWith({ kind: 'partial', detail: partial, failure: { kind: 'reauth' } });
    await waitFor(() => view.getByText(incompleteText));
    // A password box: its credentials stopped working, it has no session to expire (`reauthKey`).
    expect(
      view.getByText(t(reauthKey(account, 'messages.reauth', 'messages.reauth.credentials'))),
    ).toBeTruthy();
  });

  it('keeps the last failure’s line, hidden, while the retry runs, so nothing under it moves', async () => {
    const view = await downloadWith({
      kind: 'partial',
      detail: partial,
      failure: { kind: 'error', messageKey: 'detail.attachments.missingFailed' },
    });
    await waitFor(() => view.getByText(incompleteText));
    expect(opacityOf(view.getByTestId('downloadError'))).toBe(1);

    let answer: (outcome: unknown) => void = () => {};
    mockGetDetail.mockReturnValue(
      new Promise(resolve => {
        answer = resolve;
      }),
    );
    // Not awaited: the press settles only once the download answers, and that is held back below.
    const pressed = fireEvent.press(view.getByTestId('downloadMissingAttachments'));
    await waitFor(() => expect(mockGetDetail).toHaveBeenCalledTimes(2));
    // Hidden from screen readers too, so only a query that includes hidden elements still finds it.
    expect(view.queryByTestId('downloadError')).toBeNull();
    const line = view.getByTestId('downloadError', { includeHiddenElements: true });
    expect(opacityOf(line)).toBe(0);
    expect(line.props.accessibilityElementsHidden).toBe(true);

    await act(async () => {
      answer({ kind: 'error', messageKey: 'detail.attachments.missingFailed' });
    });
    await pressed;
    await waitFor(() => expect(opacityOf(view.getByTestId('downloadError'))).toBe(1));
  });

  it('keeps a message it held whole whole when the download of its missing files stops part-way', async () => {
    // A file went from the device; the download offered for it stopped after the first enclosure. The
    // ones past the stop are still in the archive (`enclosuresAfterWalk`), so nothing is missing from ISDS
    // and the notice stays the one for files gone from the device, now with the failure in it.
    const gone = { ...held, name: 'priloha.pdf', localPath: '/docs/attachments/box1/1234567/1_priloha.pdf' };
    const whole = { ...partial, attachments: [held, gone] };
    delete (whole as { enclosuresMissingFrom?: number }).enclosuresMissingFrom;
    mockGetCachedDetail.mockResolvedValue(whole);
    jest.mocked(attachmentFileStore.exists).mockImplementation(async path => path !== gone.localPath);
    const view = await openMessage();
    const retry = await waitFor(() => view.getByTestId('redownloadAttachments'), { timeout: 3000 });

    mockGetDetail.mockResolvedValue({
      kind: 'partial',
      detail: whole,
      failure: { kind: 'error', messageKey: 'detail.attachments.missingFailed' },
    });
    await fireEvent.press(retry);
    await waitFor(() => view.getByText(t('detail.attachments.missingFailed')));
    expect(view.getByTestId('redownloadAttachments')).toBeTruthy();
    expect(view.queryByTestId('downloadMissingAttachments')).toBeNull();
    expect(view.queryByText(t('detail.attachments.incomplete.few', { n: 2 }))).toBeNull();
  });

  it('opens a message saved that way with the notice, without asking ISDS for anything', async () => {
    mockGetCachedDetail.mockResolvedValue(partial);
    const view = await openMessage();
    await waitFor(() => view.getByText(incompleteText), { timeout: 3000 });
    expect(view.getByTestId('downloadMissingAttachments')).toBeTruthy();
    expect(view.getByText(t('detail.attachments.partlySaved'))).toBeTruthy();
    expect(mockGetDetail).not.toHaveBeenCalled();
  });
});
