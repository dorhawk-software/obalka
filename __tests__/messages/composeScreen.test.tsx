import { createRef, type ReactElement } from 'react';
import { render } from '@testing-library/react-native';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import {
  ComposeScreen,
  type ComposeHandle,
} from '../../src/features/messages/screens/ComposeScreen';
import { SnackbarProvider } from '../../src/app/Snackbar';
import type { DataBoxAccount } from '../../src/services/isds/types';
import { t } from '../../src/i18n/strings';

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
