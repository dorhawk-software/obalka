import type { ReactElement } from 'react';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { KeyboardAwareScrollView } from '../../src/theme/KeyboardAwareScrollView';
import { AddBoxForm } from '../../src/features/accounts/screens/AddBoxForm';
import { OtpForm } from '../../src/features/accounts/screens/OtpForm';
import { ReauthForm } from '../../src/features/accounts/screens/ReauthForm';
import { AliasEditor } from '../../src/features/accounts/screens/AliasEditor';
import type { DataBoxAccount } from '../../src/services/isds/types';

// Regression guard for the "inputs hidden behind the keyboard" fix:
// - scroll screens must render a KeyboardAwareScrollView (marked by keyboardShouldPersistTaps), and
// - the alias-editor modal (no scroll view to inset) must wrap its card in a KeyboardAvoidingView.
// A screen that ALSO wraps the scroll view in a KeyboardAvoidingView (to lift a pinned footer) must
// NOT let the scroll view inset for the keyboard too - that double-adjust flings a directly-focused
// bottom field to the top (the add-box "alias" bug). The test renderer only exposes host elements, so
// we assert on the real forwarded props.

function ui(node: ReactElement) {
  return render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      {node}
    </TamaguiProvider>,
  );
}

// Host KeyboardAwareScrollViews, identified by the stable keyboardShouldPersistTaps marker (present
// regardless of whether the keyboard inset is delegated to a wrapping KeyboardAvoidingView). Query
// from `container` so the match works even when the scroll view itself is the rendered root.
function keyboardAwareScrolls(view: Awaited<ReturnType<typeof render>>) {
  return view.container.queryAll(
    n => n.props?.keyboardShouldPersistTaps === 'handled',
  );
}

const account: DataBoxAccount = {
  id: 'a1',
  boxId: 'box1',
  loginName: 'user',
  label: 'Test Box',
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

describe('keyboard avoidance (regression)', () => {
  it('KeyboardAwareScrollView insets for the keyboard and keeps taps working', async () => {
    const view = await ui(
      <KeyboardAwareScrollView contentContainerStyle={{ padding: 1 }}>
        <Text>child</Text>
      </KeyboardAwareScrollView>,
    );
    const scrolls = keyboardAwareScrolls(view);
    expect(scrolls.length).toBeGreaterThanOrEqual(1);
    // Standalone (no wrapping KeyboardAvoidingView) it insets for the keyboard by default.
    expect(
      scrolls.some(s => s.props.automaticallyAdjustKeyboardInsets === true),
    ).toBe(true);
    expect(view.getByText('child')).toBeTruthy();
  });

  it('add-box, OTP and reauth forms scroll inputs above the keyboard', async () => {
    const screens: ReactElement[] = [
      <AddBoxForm onSubmit={() => {}} />,
      <OtpForm onSubmit={() => {}} onCancel={() => {}} />,
      <ReauthForm
        account={account}
        onSubmit={() => {}}
        onBack={() => {}}
        onOpenPortal={() => {}}
      />,
    ];
    for (const node of screens) {
      const view = await ui(node);
      expect(keyboardAwareScrolls(view).length).toBeGreaterThanOrEqual(1);
    }
  });

  it('alias-editor modal lifts its card above the keyboard', async () => {
    const view = await ui(
      <AliasEditor account={account} onSave={() => {}} onClose={() => {}} />,
    );
    expect(view.getByTestId('aliasKeyboardAvoider')).toBeTruthy();
  });
});
