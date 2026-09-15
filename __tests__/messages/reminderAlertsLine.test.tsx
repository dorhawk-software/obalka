// The Termín row and the date sheet when notifications are off (2026-09-24, 010 FR-006 amendment).
//
// The reminder keeps working without the notification - the row still shows its date - but the row
// now says the alert will not come and offers to turn notifications on, and the sheet stops
// promising an alert. The controller's half (what `alertsFor` answers, what `turnOnAlerts` does) is
// `reminderAlerts.test.ts`; this file is what the user sees.

import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { t } from '../../src/i18n/strings';
import type { DataBoxAccount, MessageEnvelope } from '../../src/services/isds/types';
import type { ReminderAlerts } from '../../src/features/messages/state/remindersController';

const TERM = new Date(2026, 9, 1).getTime();

const mockEnvelope: MessageEnvelope = {
  id: '1234567',
  subject: 'Výzva k doložení příjmů',
  sender: 'Finanční úřad',
  senderAddress: null,
  recipient: null,
  recipientAddress: null,
  recipientBoxId: null,
  deliveryTime: Date.now() - 2 * 24 * 60 * 60 * 1000,
  acceptanceTime: Date.now() - 24 * 60 * 60 * 1000,
  state: 7,
  attachmentSize: 1,
};

// `mock`-prefixed so the factory below may close over them.
const mockReminders = {
  term: TERM as number | null,
  alerts: 'off' as ReminderAlerts,
};
const mockAlertsFor = jest.fn(async (_boxId: string) => mockReminders.alerts);
const mockTurnOnAlerts = jest.fn(async () => {});

jest.mock('../../src/features/accounts/deps', () => ({
  messagesController: {
    getCachedEnvelope: jest.fn(async () => mockEnvelope),
    getCachedDetail: jest.fn(async () => null),
    markRead: jest.fn(async () => false),
    getDetail: jest.fn(),
    setAttachmentsUnavailable: jest.fn(async () => {}),
    fetchSignedOriginal: jest.fn(),
  },
  accountsController: { decrementUnread: jest.fn(async () => {}) },
  remindersController: {
    get: jest.fn(async () =>
      mockReminders.term == null
        ? null
        : {
            boxId: 'box1',
            messageId: '1234567',
            date: mockReminders.term,
            createdBy: 'user',
            createdAt: 1,
          },
    ),
    setReminder: jest.fn(async () => {}),
    removeReminder: jest.fn(async () => {}),
    alertsFor: (boxId: string) => mockAlertsFor(boxId),
    turnOnAlerts: () => mockTurnOnAlerts(),
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
import { TermPicker, formatTermDate } from '../../src/features/messages/screens/TermPicker';

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

/**
 * AppState driven by the test. Swapped and put back rather than spied on - the same helper as
 * `attachmentOpenOnce.test.tsx`, for the reason `transferScreen.test.tsx` gives.
 */
function drivenAppState() {
  const listeners = new Set<(next: string) => void>();
  const holder = AppState as unknown as { addEventListener: unknown };
  const original = holder.addEventListener;
  holder.addEventListener = (_type: string, listener: (next: string) => void) => {
    listeners.add(listener);
    return { remove: () => listeners.delete(listener) };
  };
  return {
    comeBack: () =>
      act(async () => {
        for (const listener of [...listeners]) {
          listener('active');
        }
      }),
    restore: () => {
      holder.addEventListener = original;
    },
  };
}

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, bottom: 34, left: 0, right: 0 },
};

const wrap = (ui: React.ReactElement) =>
  render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        {ui}
      </TamaguiProvider>
    </SafeAreaProvider>,
  );

/** Open the message and wait until the row shows the stored date and the first read has landed. */
async function openMessage() {
  const view = await wrap(
    <MessageDetail account={account} messageId={mockEnvelope.id} folder="received" onBack={() => {}} />,
  );
  await waitFor(() => view.getByTestId('detail-term'), { timeout: 3000 });
  if (mockReminders.term != null) {
    await waitFor(() =>
      view.getByText(t('term.chip', { d: formatTermDate(mockReminders.term as number) })),
    );
  }
  await waitFor(() => expect(mockAlertsFor).toHaveBeenCalled());
  await act(async () => {});
  return view;
}

let app: ReturnType<typeof drivenAppState>;
beforeEach(() => {
  app = drivenAppState();
  mockReminders.term = TERM;
  mockReminders.alerts = 'off';
  mockAlertsFor.mockClear();
  mockTurnOnAlerts.mockClear();
});
afterEach(() => app.restore());

describe('the Termín row with notifications off', () => {
  it('says the reminder will not alert, and offers to turn notifications on', async () => {
    const view = await openMessage();
    expect(view.getByText(t('term.alertsOff'))).toBeTruthy();
    const action = view.getByTestId('term-alerts-on');
    expect(action.props.accessibilityRole).toBe('button');
    expect(view.getByText(t('term.alertsOff.action'))).toBeTruthy();
  });

  it('still shows the date: the reminder works without the notification (FR-006)', async () => {
    const view = await openMessage();
    expect(view.getByText(t('term.chip', { d: formatTermDate(TERM) }))).toBeTruthy();
  });

  it('turns notifications on from the action, and reads the state again', async () => {
    const view = await openMessage();
    const readsBefore = mockAlertsFor.mock.calls.length;
    await act(async () => {
      fireEvent.press(view.getByTestId('term-alerts-on'));
    });
    expect(mockTurnOnAlerts).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(mockAlertsFor.mock.calls.length).toBeGreaterThan(readsBefore));
  });

  it('goes away when the user comes back with notifications switched on', async () => {
    const view = await openMessage();
    expect(view.queryByTestId('term-alerts-off')).not.toBeNull();

    mockReminders.alerts = 'on'; // switched on in the system settings, outside the app
    await app.comeBack();

    await waitFor(() => expect(view.queryByTestId('term-alerts-off')).toBeNull());
    // The reminder itself is untouched.
    expect(view.getByText(t('term.chip', { d: formatTermDate(TERM) }))).toBeTruthy();
  });
});

describe('the Termín row otherwise', () => {
  it('shows nothing extra when notifications are on', async () => {
    mockReminders.alerts = 'on';
    const view = await openMessage();
    expect(view.queryByTestId('term-alerts-off')).toBeNull();
    expect(view.queryByText(t('term.alertsOff'))).toBeNull();
  });

  it('shows nothing without a date, whatever the permission', async () => {
    mockReminders.term = null;
    const view = await openMessage();
    expect(view.queryByTestId('term-alerts-off')).toBeNull();
  });
});

describe('the date sheet', () => {
  it('does not promise an alert when notifications are off', async () => {
    const view = await openMessage();
    await act(async () => {
      fireEvent.press(view.getByTestId('detail-term'));
    });
    expect(view.getByText(t('term.sub.silent'))).toBeTruthy();
    for (const promise of ['term.sub', 'term.sub.onDay', 'term.sub.none']) {
      expect(view.queryByText(t(promise))).toBeNull();
    }
  });

  it('changes only that sentence: with notifications on, the promise stands', async () => {
    const now = new Date(2026, 8, 24, 8).getTime();
    const sheet = (alertsOff: boolean) => (
      <SafeAreaProvider initialMetrics={METRICS}>
        <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
          <TermPicker
            current={TERM}
            alertsOff={alertsOff}
            onPick={() => {}}
            onRemove={() => {}}
            onClose={() => {}}
            now={now}
          />
        </TamaguiProvider>
      </SafeAreaProvider>
    );
    const view = await render(sheet(true));
    expect(view.getByText(t('term.sub.silent'))).toBeTruthy();
    await view.rerender(sheet(false));
    expect(view.getByText(t('term.sub'))).toBeTruthy();
    expect(view.queryByText(t('term.sub.silent'))).toBeNull();
  });
});
