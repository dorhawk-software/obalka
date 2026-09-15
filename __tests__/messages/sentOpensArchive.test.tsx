// "Zobrazit zprávu v archivu" on the send-success screen (005 T018).
//
// The message has been folded into the archive since T015; what was missing was any way to GET to
// it. Until now the only route from "Zpráva odeslána" was to leave, switch to the sent folder and
// find it - for a message the reader was looking at a moment ago.
//
// The behaviour worth a test is not the tap. It is the WAIT. `recordSentMessage` is the write that
// puts the message in the archive, and it is started, not awaited, when the send returns: awaiting
// it would hold the success screen behind a database write nobody is waiting for. So the button has
// to join that promise before it navigates, or a fast finger on a slow phone opens a detail screen
// for a message the archive does not have yet - an empty screen, arrived at by doing everything
// right, and impossible to reproduce on a developer's machine.

import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { SnackbarProvider } from '../../src/app/Snackbar';
import type { DataBoxAccount } from '../../src/services/isds/types';
import { t } from '../../src/i18n/strings';

// `mock`-prefixed so jest s hoist allows the factory below to reference it.
const mockOvm = {
  boxId: 'ovm1234',
  name: 'Úřad práce',
  address: 'Dobrovského 25, 170 00 Praha',
  dbType: 'OVM',
};

const mockSend = jest.fn();
/** Resolved by hand, so the test can stand in the gap the button has to close. */
let releaseRecord: () => void = () => {};
const mockRecordSent = jest.fn(
  (..._args: unknown[]) =>
    new Promise<void>(resolve => {
      releaseRecord = resolve;
    }),
);

jest.mock('../../src/features/accounts/deps', () => ({
  sendController: {
    searchRecipients: jest.fn(async () => ({
      kind: 'recipients',
      recipients: [mockOvm],
    })),
    send: (...args: unknown[]) => mockSend(...args),
    estimate: () => ({ paid: false, approxCzk: 0 }),
    estimateCost: jest.fn(),
    // Best-effort and allowed to say nothing; the success screen simply shows no extra line.
    fetchSentStatus: jest.fn(async () => null),
  },
  draftsStore: {
    list: jest.fn(async () => []),
    save: jest.fn(async () => {}),
    remove: jest.fn(async () => {}),
  },
  messagesController: {
    getCachedMessages: jest.fn(async () => ({
      envelopes: [],
      downloaded: [],
      syncedAt: null,
    })),
    getCredit: jest.fn(async () => 0),
    recordSentMessage: (...args: unknown[]) => mockRecordSent(...args),
  },
  accountsController: { recordCredit: jest.fn(async () => {}) },
}));

// A real PDF encode is a second of work this test has no opinion about.
jest.mock('../../src/services/files/textToPdf', () => ({
  textToPdf: jest.fn(async () => ({
    fileName: 'Textová zpráva.pdf',
    mimeType: 'application/pdf',
    contentBase64: 'JVBERi0=',
    sizeBytes: 8,
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

const ui = (node: ReactElement) =>
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <SnackbarProvider>{node}</SnackbarProvider>
    </TamaguiProvider>,
  );

/** Compose a free message to an OVM and send it, stopping on the success screen. */
async function sendOne(onOpenSent: (id: string) => void) {
  // AWAITED: RNTL 14's `render` hands back a thenable, and using the result without awaiting it
  // gives an object with no queries on it - which reads as "getByTestId is not a function".
  const view = await ui(
    <ComposeScreen account={account} onBack={() => {}} onOpenSent={onOpenSent} />,
  );
  await fireEvent.changeText(view.getByTestId('composeRecipientQuery'), 'Urad');
  const row = await waitFor(() => view.getByTestId(`recipient-${mockOvm.boxId}`), {
    timeout: 3000,
  });
  await fireEvent.press(row);
  // Picking a recipient swaps the search for the form; the subject field does not exist until then.
  await waitFor(() => view.getByTestId('composeSubject'), { timeout: 3000 });
  await fireEvent.changeText(view.getByTestId('composeSubject'), 'Podání');
  await fireEvent.changeText(view.getByTestId('composeBody'), 'Dobrý den,');
  await fireEvent.press(view.getByTestId('composeSend'));
  await waitFor(() => view.getByTestId('composeOpenSent'), { timeout: 3000 });
  return view;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSend.mockResolvedValue({ kind: 'sent', messageId: 'dm-42' });
});

describe('the send-success screen', () => {
  it('offers a way into the archive', async () => {
    const view = await sendOne(() => {});
    // By LABEL, not by text: the action is a labelled Pressable, so its caption is hidden from the
    // accessibility tree and `getByText` cannot see it. The label is the better assertion anyway -
    // it is the sentence a screen reader actually reads out.
    expect(view.getByLabelText(t('send.sent.open'))).toBeTruthy();
    // The primary action is still "done" - the ui-guide keeps the dark fill for one action a screen.
    expect(view.getByTestId('composeDone')).toBeTruthy();
  });

  it('WAITS for the archive write before opening the message', async () => {
    const onOpenSent = jest.fn();
    const view = await sendOne(onOpenSent);
    expect(mockRecordSent).toHaveBeenCalledTimes(1);

    await fireEvent.press(view.getByTestId('composeOpenSent'));
    // Nothing yet: the row is still being written. Navigating now would open an empty detail screen.
    await Promise.resolve();
    expect(onOpenSent).not.toHaveBeenCalled();

    releaseRecord();
    await waitFor(() => expect(onOpenSent).toHaveBeenCalledWith('dm-42'));
  });

  it('does not fire twice when the button is tapped twice', async () => {
    // A second navigation would push a second detail screen onto the stack, which the reader then
    // has to dismiss twice. Cheap to prevent, invisible when it happens, annoying to diagnose.
    const onOpenSent = jest.fn();
    const view = await sendOne(onOpenSent);
    await fireEvent.press(view.getByTestId('composeOpenSent'));
    await fireEvent.press(view.getByTestId('composeOpenSent'));
    releaseRecord();
    await waitFor(() => expect(onOpenSent).toHaveBeenCalledTimes(1));
  });
});
