// A fast double tap on the compose screen (audit 2026-09-23).
//
// The screen used to guard its actions with React state - `busy`, `opening`, PressScale's `busy` prop -
// and state only takes effect once it has been rendered. A double tap delivers both presses before
// that re-render, so each test here takes a button's handler out of ONE render and calls it twice in
// the same tick: exactly what the second finger does. The send controller is a mock, so what is
// counted is what the SCREEN asks for; the controller's own guard is `sendController.test.ts`'s.

import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { SnackbarProvider } from '../../src/app/Snackbar';
import { doubleTap } from '../helpers/doubleTap';
import type { DataBoxAccount, OutgoingDocument } from '../../src/services/isds/types';

// `mock`-prefixed so jest's hoisting lets the factories below reference them.
const mockOvm = {
  boxId: 'ovm1234',
  name: 'Úřad práce',
  address: 'Dobrovského 25, 170 00 Praha',
  dbType: 'OVM',
  acceptsPdz: false,
};
const mockSend = jest.fn();
const mockPick = jest.fn();

jest.mock('../../src/features/accounts/deps', () => ({
  sendController: {
    searchRecipients: jest.fn(async () => ({
      kind: 'recipients',
      recipients: [mockOvm],
    })),
    send: (...args: unknown[]) => mockSend(...args),
    estimate: () => ({ paid: false, approxCzk: 0, bigMessage: false, oversize: false }),
    fetchSentStatus: jest.fn(async () => null),
  },
  draftsStore: {
    list: jest.fn(async () => []),
    save: jest.fn(async () => {}),
    remove: jest.fn(async () => {}),
  },
  messagesController: {
    getCredit: jest.fn(async () => 0),
    recordSentMessage: jest.fn(async () => {}),
  },
  accountsController: { recordCredit: jest.fn(async () => {}) },
}));

jest.mock('../../src/services/files/attachmentPicker', () => ({
  pickDocuments: (...args: unknown[]) => mockPick(...args),
}));

// A real PDF encode is work these tests have no opinion about - and it is an await BEFORE the send,
// which is the gap a double tap used to fall through.
jest.mock('../../src/services/files/textToPdf', () => ({
  textToPdf: jest.fn(async () => ({
    fileName: 'Textová zpráva.pdf',
    mimeType: 'application/pdf',
    contentBase64: 'JVBERi0=',
    sizeBytes: 8,
    isMain: false,
  })),
}));

import { ComposeScreen } from '../../src/features/messages/screens/ComposeScreen';

const account: DataBoxAccount = {
  id: 'a1',
  boxId: 'box1',
  loginName: 'user',
  label: 'Sender',
  dbType: null,
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
};

const doc = (fileName: string): OutgoingDocument => ({
  fileName,
  mimeType: 'application/pdf',
  sizeBytes: 1024,
  contentBase64: 'JVBERi0=',
  isMain: false,
});

type View = Awaited<ReturnType<typeof render>>;

/** Compose to an OVM with a typed body, stopping on the form. */
async function openCompose(onOpenSent: (id: string) => void = () => {}): Promise<View> {
  const view = await render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <SnackbarProvider>
        <ComposeScreen account={account} onBack={() => {}} onOpenSent={onOpenSent} />
      </SnackbarProvider>
    </TamaguiProvider> as ReactElement,
  );
  await fireEvent.changeText(view.getByTestId('composeRecipientQuery'), 'Urad');
  const row = await waitFor(() => view.getByTestId(`recipient-${mockOvm.boxId}`), {
    timeout: 3000,
  });
  await fireEvent.press(row);
  await waitFor(() => view.getByTestId('composeSubject'), { timeout: 3000 });
  await fireEvent.changeText(view.getByTestId('composeSubject'), 'Podání');
  await fireEvent.changeText(view.getByTestId('composeBody'), 'Dobrý den,');
  return view;
}

/** A send held open until the test lets it answer. */
function holdSend(outcome: unknown): () => Promise<void> {
  let answer: (value: unknown) => void = () => {};
  mockSend.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        answer = resolve;
      }),
  );
  return () =>
    act(async () => {
      answer(outcome);
    });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSend.mockReset();
  mockPick.mockReset();
  mockPick.mockResolvedValue({ kind: 'dismissed' });
});

describe('a double tap on compose', () => {
  it('sends ONE message when "Odeslat" is tapped twice before the screen re-renders', async () => {
    const view = await openCompose();
    const answer = holdSend({ kind: 'sent', messageId: 'dm-1' });
    // Anything a stray second send might be answered with - the count below must not depend on it.
    mockSend.mockResolvedValue({ kind: 'sent', messageId: 'dm-2' });

    await doubleTap(view.getByTestId('composeSend'));
    await waitFor(() => expect(mockSend).toHaveBeenCalled());
    await answer();

    await waitFor(() => view.getByTestId('composeOpenSent'), { timeout: 3000 });
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('sends ONE paid message when the confirm button is tapped twice', async () => {
    const view = await openCompose();
    // The first press only asks: the PDZ gate answers with the price, and the sheet opens.
    mockSend.mockResolvedValueOnce({
      kind: 'needsConfirmation',
      estimate: { paid: true, approxCzk: 10, bigMessage: false, oversize: false },
      credit: { boxId: 'box1', balanceCzk: 100, pdzEnabled: true },
    });
    await fireEvent.press(view.getByTestId('composeSend'));
    await waitFor(() => view.getByTestId('composeConfirmSend'), { timeout: 3000 });
    mockSend.mockClear();

    const answer = holdSend({ kind: 'sent', messageId: 'dm-paid' });
    mockSend.mockResolvedValue({ kind: 'sent', messageId: 'dm-paid-again' });
    await doubleTap(view.getByTestId('composeConfirmSend'));
    await waitFor(() => expect(mockSend).toHaveBeenCalled());
    await answer();

    await waitFor(() => view.getByTestId('composeOpenSent'), { timeout: 3000 });
    // One spend, and it was the confirmed one.
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend.mock.calls[0][3]).toMatchObject({ confirmedPaid: true });
  });

  it('can send again once a send has answered - the guard holds only while it runs', async () => {
    const view = await openCompose();
    mockSend.mockResolvedValueOnce({ kind: 'error', messageKey: 'send.error.network' });
    await fireEvent.press(view.getByTestId('composeSend'));
    await waitFor(() => view.getByTestId('composeSendError'));

    mockSend.mockResolvedValueOnce({ kind: 'sent', messageId: 'dm-retry' });
    await fireEvent.press(view.getByTestId('composeSend'));
    await waitFor(() => view.getByTestId('composeOpenSent'), { timeout: 3000 });
    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it('removes exactly the tapped attachment, however many times it is tapped', async () => {
    const view = await openCompose();
    mockPick.mockResolvedValueOnce({
      kind: 'picked',
      documents: [doc('a.pdf'), doc('b.pdf'), doc('c.pdf')],
    });
    await fireEvent.press(view.getByTestId('composeAddAttachment'));
    await waitFor(() => view.getByText('c.pdf'));

    await doubleTap(view.getByTestId('composeRemoveFile-0'));

    // By index, the second tap removed whatever had moved into slot 0 - "b.pdf", a file nobody
    // touched. By the file, the second tap finds nothing left to remove.
    expect(view.queryByText('a.pdf')).toBeNull();
    expect(view.getByText('b.pdf')).toBeTruthy();
    expect(view.getByText('c.pdf')).toBeTruthy();
  });

  it('opens the sent message once, even tapped twice before the screen re-renders', async () => {
    const onOpenSent = jest.fn();
    const view = await openCompose(onOpenSent);
    mockSend.mockResolvedValueOnce({ kind: 'sent', messageId: 'dm-open' });
    await fireEvent.press(view.getByTestId('composeSend'));
    await waitFor(() => view.getByTestId('composeOpenSent'), { timeout: 3000 });

    await doubleTap(view.getByTestId('composeOpenSent'));
    await waitFor(() => expect(onOpenSent).toHaveBeenCalled());
    await act(async () => {});
    expect(onOpenSent).toHaveBeenCalledTimes(1);
    expect(onOpenSent).toHaveBeenCalledWith('dm-open');
  });

  it('still opens the sent message when keeping its copy in the archive failed', async () => {
    const { messagesController } = jest.requireMock('../../src/features/accounts/deps') as {
      messagesController: { recordSentMessage: jest.Mock };
    };
    messagesController.recordSentMessage.mockRejectedValueOnce(new Error('disk full'));
    const onOpenSent = jest.fn();
    const view = await openCompose(onOpenSent);
    mockSend.mockResolvedValueOnce({ kind: 'sent', messageId: 'dm-unkept' });
    await fireEvent.press(view.getByTestId('composeSend'));
    await waitFor(() => view.getByTestId('composeOpenSent'), { timeout: 3000 });

    // The message went; the detail can come from the box. A failed local copy must not leave the
    // one button after a send dead.
    await fireEvent.press(view.getByTestId('composeOpenSent'));
    await waitFor(() => expect(onOpenSent).toHaveBeenCalledWith('dm-unkept'));
  });
});
