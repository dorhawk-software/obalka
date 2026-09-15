// Attaching files on the compose screen (005 T006).
//
// The picker service decides what fits and reads it (`__tests__/files/attachmentPicker.test.ts`).
// This is the screen's half of the promise: the person can SEE a read happening, with real sizes, in
// the place the add button was - so nothing else on the screen moves - can stop it and get the button
// back at once, is told in words when a pick is too big for a data message, and cannot send while
// the files they just chose are still being read.
//
// The picker is driven by hand here, so each test can stand in the middle of a read.

import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { StyleSheet } from 'react-native';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { SnackbarProvider } from '../../src/app/Snackbar';
import type { DataBoxAccount, OutgoingDocument } from '../../src/services/isds/types';
import type {
  PickOptions,
  PickOutcome,
  ReadProgress,
} from '../../src/services/files/attachmentPicker';
import { VODZ_MAX_BYTES } from '../../src/features/messages/state/costModel';
import { MIN_TARGET } from '../../src/theme/touchTarget';
import { t } from '../../src/i18n/strings';

// `mock`-prefixed so jest's hoisting lets the factories below reference them.
const mockOvm = {
  boxId: 'ovm1234',
  name: 'Úřad práce',
  address: 'Dobrovského 25, 170 00 Praha',
  dbType: 'OVM',
};
const mockPick = jest.fn();

jest.mock('../../src/features/accounts/deps', () => ({
  sendController: {
    searchRecipients: jest.fn(async () => ({
      kind: 'recipients',
      recipients: [mockOvm],
    })),
    send: jest.fn(),
    estimate: () => ({ paid: false, approxCzk: 0 }),
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

import { ComposeScreen } from '../../src/features/messages/screens/ComposeScreen';

const MB = 1024 * 1024;

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

const doc = (fileName: string, sizeBytes: number): OutgoingDocument => ({
  fileName,
  mimeType: 'application/pdf',
  sizeBytes,
  contentBase64: 'JVBERi0=',
  isMain: false,
});

type View = Awaited<ReturnType<typeof render>>;

/** Compose to an OVM, stopping on the form where the attachments live. */
async function openCompose(): Promise<View> {
  // AWAITED: RNTL 14's `render` hands back a thenable.
  const view = await render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <SnackbarProvider>
        <ComposeScreen account={account} onBack={() => {}} onOpenSent={() => {}} />
      </SnackbarProvider>
    </TamaguiProvider> as ReactElement,
  );
  await fireEvent.changeText(view.getByTestId('composeRecipientQuery'), 'Urad');
  const row = await waitFor(() => view.getByTestId(`recipient-${mockOvm.boxId}`), {
    timeout: 3000,
  });
  await fireEvent.press(row);
  await waitFor(() => view.getByTestId('composeAddAttachment'), { timeout: 3000 });
  return view;
}

interface PendingPick {
  readonly options: PickOptions;
  readonly progress: (p: ReadProgress) => Promise<void>;
  readonly finish: (outcome: PickOutcome) => Promise<void>;
}

/** Tap "Přidat přílohu" and hold the pick open, for the test to move and end. */
async function tapAdd(view: View): Promise<PendingPick> {
  let resolve: (outcome: PickOutcome) => void = () => {};
  const started = new Promise<PickOptions>(begin => {
    mockPick.mockImplementationOnce((options: PickOptions) => {
      begin(options);
      return new Promise<PickOutcome>(done => {
        resolve = done;
      });
    });
  });
  // NOT awaited here. RNTL 14's `fireEvent` hands back the handler's own return value, and the
  // handler is `addAttachment`, which is pending until the pick ends - awaiting the press would wait
  // for the very pick this helper exists to hold open. The press's `act` has already finished by the
  // time the pick starts; `finish` awaits the rest once the outcome is in.
  const pressed = fireEvent.press(view.getByTestId('composeAddAttachment'));
  const options = await started;
  return {
    options,
    progress: p =>
      act(async () => {
        options.onProgress?.(p);
      }),
    finish: async outcome => {
      await act(async () => {
        resolve(outcome);
      });
      await pressed;
    },
  };
}

beforeEach(() => {
  mockPick.mockReset();
  // A pick nobody set up closes as dismissed - never as a crash that would pass for a refusal.
  mockPick.mockResolvedValue({ kind: 'dismissed' });
});

describe('attaching files while composing', () => {
  it('shows the read in the add button’s place, with real sizes, and holds Send until it is done', async () => {
    const view = await openCompose();
    await fireEvent.changeText(view.getByTestId('composeBody'), 'Dobrý den,');
    expect(view.getByTestId('composeSend')).toBeEnabled();

    const pick = await tapAdd(view);
    expect(pick.options.attachedBytes).toBe(0);
    // The system picker is still open and nothing has passed the cap: the button is still the button.
    expect(view.getByTestId('composeAddAttachment')).toBeTruthy();

    await pick.progress({ stage: 'copying', readBytes: 0, totalBytes: 3 * MB });
    expect(view.queryByTestId('composeAddAttachment')).toBeNull();
    expect(view.getByTestId('composeAttachReadingLabel')).toHaveTextContent(
      t('send.attachments.readingStart'),
    );

    await pick.progress({ stage: 'reading', readBytes: 1.5 * MB, totalBytes: 3 * MB });
    expect(view.getByTestId('composeAttachReadingLabel')).toHaveTextContent(
      t('send.attachments.reading', { read: '1,5 MB', total: '3,0 MB' }),
    );
    expect(view.getByTestId('composeAttachProgress').props.accessibilityValue).toEqual({
      min: 0,
      max: 100,
      now: 50,
    });
    // Sending now would send the message without the files still being read.
    expect(view.getByTestId('composeSend')).toBeDisabled();

    await pick.finish({ kind: 'picked', documents: [doc('smlouva.pdf', 3 * MB)] });
    expect(view.queryByTestId('composeAttachReading')).toBeNull();
    expect(view.getByTestId('composeAddAttachment')).toBeTruthy();
    expect(view.getByText('smlouva.pdf')).toBeTruthy();
    expect(view.getByTestId('composeSend')).toBeEnabled();
  });

  it('cancel gives the button back at once, stops the read, and attaches nothing that arrives later', async () => {
    const view = await openCompose();
    const pick = await tapAdd(view);
    await pick.progress({ stage: 'reading', readBytes: 1 * MB, totalBytes: 40 * MB });

    await fireEvent.press(view.getByTestId('composeCancelAttach'));
    expect(pick.options.signal.aborted).toBe(true);
    expect(view.queryByTestId('composeAttachReading')).toBeNull();
    expect(view.getByTestId('composeAddAttachment')).toBeTruthy();

    // Whatever the abandoned pick still reports changes nothing: no row, no attachment, no error.
    await pick.progress({ stage: 'reading', readBytes: 2 * MB, totalBytes: 40 * MB });
    await pick.finish({ kind: 'picked', documents: [doc('pozde.pdf', 40 * MB)] });
    expect(view.queryByTestId('composeAttachReading')).toBeNull();
    expect(view.queryByText('pozde.pdf')).toBeNull();
    expect(view.queryByTestId('composeSendError')).toBeNull();

    // And the person can pick again straight away.
    await fireEvent.press(view.getByTestId('composeAddAttachment'));
    expect(mockPick).toHaveBeenCalledTimes(2);
  });

  it('refuses an oversized pick in words, counting what is already attached', async () => {
    const view = await openCompose();
    const first = await tapAdd(view);
    await first.finish({ kind: 'picked', documents: [doc('a.pdf', 60 * MB)] });

    const second = await tapAdd(view);
    expect(second.options.attachedBytes).toBe(60 * MB);
    await second.finish({
      kind: 'tooLarge',
      messageBytes: 130 * MB,
      limitBytes: VODZ_MAX_BYTES,
    });
    expect(view.getByTestId('composeSendError')).toHaveTextContent(
      t('send.attachments.tooLarge', { size: '130,0 MB', limit: '100,0 MB' }),
    );
    // Recoverable: what already fit is still attached, and the button is back for a smaller file.
    expect(view.getByText('a.pdf')).toBeTruthy();
    expect(view.getByTestId('composeAddAttachment')).toBeTruthy();
  });

  it('says so when a pick cannot be read', async () => {
    const view = await openCompose();
    const pick = await tapAdd(view);
    await pick.finish({ kind: 'failed' });
    expect(view.getByTestId('composeSendError')).toHaveTextContent(t('send.error.attach'));
  });

  it('keeps one footprint at every text size: the progress row sizes the slot while idle too (constitution V)', async () => {
    // Jest has no layout engine, so equal dp props cannot prove equal heights: at a large system text
    // size the row's caption and bar outgrow the button's one line. What CAN be pinned is the
    // structure that makes a jump impossible - the same box is laid out in both states, and the
    // button is drawn over it rather than in its place.
    const view = await openCompose();
    const hidden = { includeHiddenElements: true };
    const box = () => {
      const s = StyleSheet.flatten(
        view.getByTestId('composeAttachReading', hidden).props.style,
      );
      return {
        width: s.width,
        minHeight: s.minHeight,
        borderTopLeftRadius: s.borderTopLeftRadius ?? s.borderRadius,
        borderBottomRightRadius: s.borderBottomRightRadius ?? s.borderRadius,
        borderTopWidth: s.borderTopWidth ?? s.borderWidth,
        paddingTop: s.paddingTop ?? s.paddingVertical,
        paddingBottom: s.paddingBottom ?? s.paddingVertical,
        position: s.position,
      };
    };

    // Idle: the row is laid out - it is what sizes the slot - but nobody can see, hear or reach it.
    const idle = box();
    expect(idle).toMatchObject({
      width: '100%',
      minHeight: 46,
      borderTopLeftRadius: 13,
      borderBottomRightRadius: 13,
    });
    expect(idle.position).not.toBe('absolute');
    expect(view.getByTestId('composeAttachReading', hidden)).not.toBeVisible();
    expect(view.queryByTestId('composeCancelAttach')).toBeNull();
    // …and the button covers exactly that footprint.
    expect(
      StyleSheet.flatten(view.getByTestId('composeAddAttachment').props.style),
    ).toMatchObject({
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      borderTopLeftRadius: 13,
    });

    const pick = await tapAdd(view);
    await pick.progress({ stage: 'reading', readBytes: 0, totalBytes: 10 });
    // Reading: the SAME box with the same metrics, now shown; the button that was drawn over it is gone.
    expect(box()).toEqual(idle);
    expect(view.getByTestId('composeAttachReading')).toBeVisible();
    expect(view.queryByTestId('composeAddAttachment')).toBeNull();

    // Drawn small, like the remove control on an attachment row - but a full target under a finger.
    const slop = view.getByTestId('composeCancelAttach').props.hitSlop;
    expect(30 + slop.top + slop.bottom).toBeGreaterThanOrEqual(MIN_TARGET);
    expect(30 + slop.left + slop.right).toBeGreaterThanOrEqual(MIN_TARGET);
  });

  it('starts one pick at a time, even when the button is tapped again while the picker opens', async () => {
    const view = await openCompose();
    const pick = await tapAdd(view);
    await fireEvent.press(view.getByTestId('composeAddAttachment'));
    expect(mockPick).toHaveBeenCalledTimes(1);
    await pick.finish({ kind: 'dismissed' });
    expect(view.queryByTestId('composeSendError')).toBeNull();
  });

  it('abandons the read when compose is left mid-read', async () => {
    const view = await openCompose();
    const pick = await tapAdd(view);
    await pick.progress({ stage: 'reading', readBytes: 1 * MB, totalBytes: 9 * MB });
    // Awaited: RNTL 14's `unmount` is async, and the effect cleanups run inside it.
    await view.unmount();
    expect(pick.options.signal.aborted).toBe(true);
  });
});
