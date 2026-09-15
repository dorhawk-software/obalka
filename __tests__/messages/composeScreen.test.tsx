import { createRef, type ReactElement } from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import {
  ComposeScreen,
  type ComposeHandle,
} from '../../src/features/messages/screens/ComposeScreen';
import { SnackbarProvider } from '../../src/app/Snackbar';
import type { DataBoxAccount } from '../../src/services/isds/types';
import { t } from '../../src/i18n/strings';
import { SenderGate } from '../../src/features/messages/screens/SenderPicker';

// ComposeScreen reads useSnackbar (undoable draft discard) - provide the snackbar context like the
// real navigator does.
function ui(node: ReactElement) {
  return render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <SnackbarProvider>{node}</SnackbarProvider>
    </TamaguiProvider>,
  );
}

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

describe('ComposeScreen', () => {
  it('renders the title and the recipient search', async () => {
    const view = await ui(
      <ComposeScreen account={account} onBack={() => {}} onOpenSent={() => {}} />,
    );
    expect(view.getByText(t('send.title'))).toBeTruthy();
    // The recipient field auto-searches (debounced) - there's no separate Find button.
    expect(view.getByTestId('composeRecipientQuery')).toBeTruthy();
    expect(view.queryByTestId('composeSearch')).toBeNull();
  });

  // The test-env banner is scoped to the MESSAGE DETAIL - the only surface with no other environment
  // cue. Compose is reached from the list, whose header already carries the "Testovací" pill, so a
  // banner here would just say it twice. `account` above is a czebox box, so this would catch a
  // regression that put the banner back on every box screen.
  it('does not show the test-env banner (czebox box) - the list already marks the box', async () => {
    const view = await ui(<ComposeScreen account={account} onBack={() => {}} onOpenSent={() => {}} />);
    expect(view.queryByTestId('testEnvBanner')).toBeNull();
  });

  it('hosts the form in a keyboard-aware scroll view so inputs stay above the keyboard', async () => {
    const view = await ui(
      <ComposeScreen account={account} onBack={() => {}} onOpenSent={() => {}} />,
    );
    const scroll = view.getByTestId('composeScroll');
    expect(scroll.props.keyboardShouldPersistTaps).toBe('handled');
    // Compose wraps this scroll view in a KeyboardAvoidingView (to lift the pinned Send footer over
    // the IME), so the scroll view must NOT also inset for the keyboard - the two together double-
    // adjust and fling a directly-tapped bottom field to the top of the screen.
    expect(scroll.props.automaticallyAdjustKeyboardInsets).toBe(false);
  });

  it('persistOnExit returns null for an empty compose (nothing to auto-save)', async () => {
    const ref = createRef<ComposeHandle>();
    await ui(<ComposeScreen ref={ref} account={account} onBack={() => {}} onOpenSent={() => {}} />);
    // No recipient, subject, or body entered → nothing worth saving, no DB write.
    expect(ref.current?.persistOnExit()).toBeNull();
  });
});

// 027 US1/US2 (decision 1A): which box the message goes from, and changing it.
describe('the sender', () => {
  const other: DataBoxAccount = { ...account, id: 'a2', boxId: 'box2', label: 'Firma s.r.o.' };
  const expired: DataBoxAccount = {
    ...account,
    id: 'a3',
    boxId: 'box3',
    label: 'Prošlá',
    syncError: 'reauth',
  };

  it('is shown above the recipient, with its credit when known', async () => {
    const view = await ui(
      <ComposeScreen
        account={{ ...account, pdzCreditCzk: 120 }}
        onBack={() => {}}
        onOpenSent={() => {}}
      />,
    );
    expect(view.getByTestId('composeSender')).toHaveTextContent(/Sender/);
    expect(view.getByTestId('composeSender')).toHaveTextContent(/120/);
  });

  it('cannot be changed with one box - there is nothing to change to', async () => {
    const view = await ui(
      <ComposeScreen
        account={account}
        accounts={[account]}
        onChangeSender={() => {}}
        onBack={() => {}}
        onOpenSent={() => {}}
      />,
    );
    expect(view.queryByTestId('composeSenderChevron')).toBeNull();
    expect(view.getByTestId('composeSender').props.accessibilityRole).toBeUndefined();
  });

  it('is one button, the whole card, saying what it does', async () => {
    const view = await ui(
      <ComposeScreen
        account={account}
        accounts={[account, { ...account, id: 'a2', boxId: 'box2' }]}
        onChangeSender={() => {}}
        onBack={() => {}}
        onOpenSent={() => {}}
      />,
    );
    const card = view.getByTestId('composeSender');
    expect(card.props.accessibilityRole).toBe('button');
    expect(card.props.accessibilityHint).toBe(t('send.from.change'));
    expect(view.getByTestId('composeSenderChevron')).toBeTruthy();
  });

  it('changes to another box from the sheet, and a box needing a sign-in cannot be picked', async () => {
    const onChangeSender = jest.fn();
    const view = await ui(
      <ComposeScreen
        account={account}
        accounts={[account, other, expired]}
        onChangeSender={onChangeSender}
        onBack={() => {}}
        onOpenSent={() => {}}
      />,
    );
    await act(async () => {
      fireEvent.press(view.getByTestId('composeSender'));
    });
    expect(view.getByTestId('senderOption-box1').props.accessibilityState).toMatchObject({
      checked: true,
    });
    expect(view.getByTestId('senderOption-box3').props.accessibilityState).toMatchObject({
      disabled: true,
    });
    await act(async () => {
      fireEvent.press(view.getByTestId('senderOption-box3'));
    });
    expect(onChangeSender).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.press(view.getByTestId('senderOption-box2'));
    });
    expect(onChangeSender).toHaveBeenCalledWith('box2');
  });
});

describe('compose from the merged view', () => {
  it('asks for the sender first, and the form waits for it', async () => {
    const onOpenPicker = jest.fn();
    const onPick = jest.fn();
    const props = {
      accounts: [account, { ...account, id: 'a2', boxId: 'box2', label: 'Firma s.r.o.' }],
      onOpenPicker,
      onClosePicker: () => {},
      onPick,
      onBack: () => {},
    };
    const view = await ui(<SenderGate {...props} picking={false} />);
    // No recipient field to type into yet - only the prompt.
    expect(view.queryByTestId('composeRecipientQuery')).toBeNull();
    await act(async () => {
      fireEvent.press(view.getByTestId('composePickSender'));
    });
    expect(onOpenPicker).toHaveBeenCalled();

    await act(async () => {
      view.rerender(
        <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
          <SnackbarProvider>
            <SenderGate {...props} picking />
          </SnackbarProvider>
        </TamaguiProvider>,
      );
    });
    // Nothing is chosen yet.
    expect(view.getByTestId('senderOption-box1').props.accessibilityState).toMatchObject({
      checked: false,
    });
    await act(async () => {
      fireEvent.press(view.getByTestId('senderOption-box2'));
    });
    expect(onPick).toHaveBeenCalledWith('box2');
  });
});
