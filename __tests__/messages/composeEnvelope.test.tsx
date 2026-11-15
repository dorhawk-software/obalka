// Compose is the envelope you are sending (031 I38, boards R2 and R12, agreed 2026-11-12): Od on the
// envelope, Komu in its window - the search field until someone is picked - and the stamp in its
// corner, blank until a recipient sets the price. Until 2026-11-15 compose was a form: a sender card,
// an outlined search field, a cost panel with a hairline, outlined result rows.

import type { ReactElement } from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { SnackbarProvider } from '../../src/app/Snackbar';
import { lightTheme } from '../../src/theme/theme';
import { t } from '../../src/i18n/strings';
import type { DataBoxAccount, Recipient } from '../../src/services/isds/types';

const mockOvm: Recipient = {
  boxId: 'ovm1',
  name: 'Finanční úřad',
  address: 'Štěpánská 619/28, Praha 1',
  dbType: 'OVM',
  acceptsPdz: false,
};
const mockPerson: Recipient = {
  boxId: 'fo1',
  name: 'Jana Nováková',
  address: null,
  dbType: 'FO',
  acceptsPdz: true,
};

jest.mock('../../src/features/accounts/deps', () => ({
  sendController: {
    searchRecipients: jest.fn(async () => ({ kind: 'recipients', recipients: [mockOvm, mockPerson] })),
    send: jest.fn(),
    estimate: (r: Recipient) =>
      r.dbType === 'OVM'
        ? { paid: false, approxCzk: 0, bigMessage: false, oversize: false }
        : { paid: true, approxCzk: 10, bigMessage: false, oversize: false },
    fetchSentStatus: jest.fn(async () => null),
  },
  draftsStore: {
    list: jest.fn(async () => []),
    save: jest.fn(async () => {}),
    remove: jest.fn(async () => {}),
  },
  messagesController: {
    // Asked once a paid recipient is picked; the stored balance stands when it answers nothing.
    getCredit: jest.fn(async () => null),
    recordSentMessage: jest.fn(async () => {}),
  },
  accountsController: { recordCredit: jest.fn(async () => {}) },
}));

import { ComposeScreen } from '../../src/features/messages/screens/ComposeScreen';
import { SenderGate } from '../../src/features/messages/screens/SenderPicker';

const account: DataBoxAccount = {
  id: 'a1',
  boxId: 'box1',
  loginName: 'user',
  label: 'Sender',
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
  pdzCreditCzk: 412,
  syncError: null,
  createdAt: 0,
  updatedAt: 0,
};

const styleOf = (node: { props: Record<string, unknown> }) =>
  (StyleSheet.flatten(node.props.style as StyleProp<ViewStyle>) ?? {}) as Record<string, unknown>;

type View = Awaited<ReturnType<typeof render>>;

/** The blank stamp is a picture (hidden from assistive technology), the send face sits inside its button. */
const hidden = { includeHiddenElements: true };

async function mount(node: ReactElement): Promise<View> {
  return render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <SnackbarProvider>{node}</SnackbarProvider>
    </TamaguiProvider>,
  );
}

const compose = () => mount(<ComposeScreen account={account} onBack={() => {}} onOpenSent={() => {}} />);

async function pick(view: View, r: Recipient) {
  await fireEvent.changeText(view.getByTestId('composeRecipientQuery'), 'hledat');
  const sheet = await waitFor(() => view.getByTestId(`recipient-${r.boxId}`), { timeout: 3000 });
  await act(async () => {
    fireEvent.press(sheet);
  });
}

describe('compose, the envelope you are sending (R2, R12)', () => {
  it('leaves the stamp a blank slot until a recipient sets the price', async () => {
    const view = await compose();
    expect(view.getByTestId('composeStampBlank', hidden)).toBeTruthy();
    expect(view.queryByTestId('composeStamp')).toBeNull();
  });

  it('prints Zdarma and the data message on the stamp for a public authority', async () => {
    const view = await compose();
    await pick(view, mockOvm);
    const stamp = view.getByTestId('composeStamp');
    expect(stamp).toHaveTextContent(new RegExp(t('send.cost.free').toLocaleUpperCase('cs')));
    expect(stamp).toHaveTextContent(new RegExp(t('send.stamp.free.kind')));
    // A free send says nothing about the credit.
    expect(view.queryByTestId('composeSenderCredit')).toBeNull();
  });

  it('prints Placená on the stamp for a postal data message, and the credit under Od', async () => {
    const view = await compose();
    await pick(view, mockPerson);
    const stamp = view.getByTestId('composeStamp');
    expect(stamp).toHaveTextContent(new RegExp(t('send.cost.paid.badge').toLocaleUpperCase('cs')));
    expect(stamp).toHaveTextContent(/~10/);
    expect(view.getByTestId('composeSenderCredit')).toHaveTextContent(/412/);
  });

  it('puts the picked recipient in the window: the address, or the kind and ID with none', async () => {
    const view = await compose();
    await pick(view, mockPerson);
    expect(view.getByTestId('composeRecipientName')).toHaveTextContent('Jana Nováková');
    expect(view.getByTestId('composeRecipientLine')).toHaveTextContent(/fo1/);
    expect(view.queryByTestId('composeRecipientQuery')).toBeNull();
  });

  it('keeps "ID" and the box ID together, on Od and in the window (031 T050)', async () => {
    // "p7wq2bs" stood alone on a line under "Podnikající fyzická osoba · ID". The matcher folds
    // spaces by default, the no-break one with them.
    const asIs = (text: string) => text;
    const view = await compose();
    expect(view.getByTestId('composeSenderKind')).toHaveTextContent(/ID\u00A0box1$/, { normalizer: asIs });
    await pick(view, mockPerson);
    expect(view.getByTestId('composeRecipientLine')).toHaveTextContent(/ID\u00A0fo1$/, { normalizer: asIs });
  });

  it('rings the window in the flap gold while the search has the caret', async () => {
    const view = await compose();
    expect(view.queryByTestId('composeWindowRing')).toBeNull();
    await act(async () => {
      fireEvent(view.getByTestId('composeRecipientQuery'), 'focus');
    });
    expect(styleOf(view.getByTestId('composeWindowRing'))).toMatchObject({
      borderColor: lightTheme.flap,
      borderWidth: 2,
    });
  });

  it('lays each result below the envelope as a sheet, not an outlined row', async () => {
    const view = await compose();
    await fireEvent.changeText(view.getByTestId('composeRecipientQuery'), 'hledat');
    const sheet = styleOf(await waitFor(() => view.getByTestId(`recipient-${mockOvm.boxId}`), { timeout: 3000 }));
    expect(sheet.borderTopLeftRadius ?? sheet.borderRadius).toBe(14);
    expect(sheet.borderWidth ?? 0).toBe(0);
    expect(String(sheet.boxShadow)).toContain('rgba');
  });

  it('fades Odeslat as one layer, so its words do not sink into the faded ink on Android', async () => {
    const view = await compose();
    await pick(view, mockOvm);
    // Nothing to send yet: no text and no file.
    let layer = view.getByTestId('composeSendFace', hidden).parent;
    while (layer && layer.props.needsOffscreenAlphaCompositing == null) {
      layer = layer.parent;
    }
    expect(layer?.props.needsOffscreenAlphaCompositing).toBe(true);
    // .55, as every blocked button (InkButton, R10, R12 and R14 since the sync-back); .45 until 2026-11-15.
    expect(styleOf(layer as never).opacity).toBe(0.55);
  });
});

describe('compose from the merged view (R12 "No sender yet")', () => {
  it('is the same envelope with the stamp blank, Od a slot to choose the box, and nothing to type', async () => {
    const view = await mount(
      <SenderGate
        accounts={[account]}
        picking={false}
        onOpenPicker={() => {}}
        onClosePicker={() => {}}
        onPick={() => {}}
        onBack={() => {}}
      />,
    );
    expect(view.getByTestId('composeStampBlank', hidden)).toBeTruthy();
    expect(view.getByTestId('composePickSender')).toHaveTextContent(t('send.from.pick'));
    expect(view.queryByTestId('composeRecipientQuery')).toBeNull();
  });
});
