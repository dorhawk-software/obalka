// What a dialog does when the app goes to the background (2026-11-12).
//
// An RN Modal draws above the lock cover, so whatever is open when the app leaves is still there over
// the lock screen when it comes back. `modalsCloseOnBackground` checks that every file has an answer;
// these check the two answers that carry weight. The paid-send question, which the person opened,
// closes - a confirmed send carries on, since it runs once. A transfer that arrived, which the app
// raised, waits hidden while the app is covered: it is on disk until it is answered, and closing it
// would throw it away.

import { AppState } from 'react-native';
import { act, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { AppThemeProvider } from '../../src/theme/ThemeProvider';
import { PaidSendConfirm } from '../../src/features/messages/screens/PaidSendConfirm';
import { TransferDialogs } from '../../src/app/settings/TransferDialogs';
import type { ReceivedTransfer } from '../../src/features/transfer/state/transferController';
import { manifest } from '../helpers/backupScreenHarness';

function setAppState(state: 'active' | 'background') {
  (AppState as unknown as { currentState: string }).currentState = state;
}

/** Deliver an AppState change to every listener - the jest mock calls none. */
function emitAppState(state: 'active' | 'background') {
  setAppState(state);
  for (const [type, handler] of (AppState.addEventListener as jest.Mock).mock.calls) {
    if (type === 'change') {
      handler(state);
    }
  }
}

beforeEach(() => {
  setAppState('active');
  (AppState.addEventListener as jest.Mock).mockClear();
});

afterEach(() => {
  setAppState('active');
});

const wrap = (ui: React.ReactElement) =>
  render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <AppThemeProvider isDark={false}>{ui}</AppThemeProvider>
      </TamaguiProvider>
    </SafeAreaProvider>,
  );

const arrived: ReceivedTransfer = {
  manifest: manifest(1_000),
  compatibility: { kind: 'current' },
  restorable: true,
  recoveryKey: 'FKPX-9WQ2-7TDM-4RJH-2CVB',
  archive: new Uint8Array(),
  documents: 0,
  dir: '/staged',
};

describe('the paid-send question', () => {
  it('closes as the app goes to the background', async () => {
    const onCancel = jest.fn();
    await wrap(<PaidSendConfirm approxCzk={10} balanceCzk={412} busy={false} onSend={() => {}} onCancel={onCancel} />);
    await act(async () => emitAppState('background'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('closes even while the confirmed send is running, and does not stop it', async () => {
    const onCancel = jest.fn();
    const onSend = jest.fn();
    await wrap(<PaidSendConfirm approxCzk={10} balanceCzk={412} busy onSend={onSend} onCancel={onCancel} />);
    await act(async () => emitAppState('background'));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSend).not.toHaveBeenCalled();
  });
});

describe('the transfer screen s questions', () => {
  it('closes the mobile-data question as the app goes to the background', async () => {
    const onMeteredCancel = jest.fn();
    await wrap(
      <TransferDialogs
        meteredAsk={52_000_000}
        onMeteredCancel={onMeteredCancel}
        onMeteredConfirm={() => {}}
        got={null}
        onDecline={() => {}}
        onConfirm={() => {}}
      />,
    );
    await act(async () => emitAppState('background'));
    expect(onMeteredCancel).toHaveBeenCalledTimes(1);
  });

  it('hides what arrived while the app is in the background, keeps it, and shows it again on return', async () => {
    const onDecline = jest.fn();
    const view = await wrap(
      <TransferDialogs
        meteredAsk={null}
        onMeteredCancel={() => {}}
        onMeteredConfirm={() => {}}
        got={arrived}
        onDecline={onDecline}
        onConfirm={() => {}}
      />,
    );
    expect(view.getByTestId('transfer-received-dialog')).toBeTruthy();
    await act(async () => emitAppState('background'));
    expect(view.queryByTestId('transfer-received-dialog')).toBeNull();
    expect(onDecline).not.toHaveBeenCalled();
    await act(async () => emitAppState('active'));
    expect(view.getByTestId('transfer-received-dialog')).toBeTruthy();
  });
});
