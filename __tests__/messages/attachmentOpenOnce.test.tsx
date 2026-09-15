// One viewer per tap on the message detail (audit 2026-09-23).
//
// The attachment row and the signed-original row guarded their launch with `opening`/`fetching`
// state, which lands a render late: a fast double tap launched the viewer twice, or started a second
// fetch of the signed original. Each tap here is taken from ONE render (`doubleTap`), which is how the
// second finger arrives. Coming back from the viewer frees the row even if its promise never settles,
// as it always did, so that is pinned too.

import { act, render, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import type {
  DataBoxAccount,
  MessageEnvelope,
  SignedOriginal,
} from '../../src/services/isds/types';
import { doubleTap } from '../helpers/doubleTap';

const DAY = 24 * 60 * 60 * 1000;

const mockEnvelope: MessageEnvelope = {
  id: '1234567',
  subject: 'Rozhodnutí',
  sender: 'Finanční úřad',
  senderAddress: null,
  recipient: null,
  recipientAddress: null,
  recipientBoxId: null,
  deliveryTime: Date.now() - 4 * DAY,
  acceptanceTime: Date.now() - 3 * DAY,
  state: 7,
  attachmentSize: 1,
};
const mockDetail = {
  id: mockEnvelope.id,
  subject: mockEnvelope.subject,
  sender: mockEnvelope.sender,
  senderAddress: null,
  recipient: null,
  recipientAddress: null,
  deliveryTime: mockEnvelope.deliveryTime,
  acceptanceTime: mockEnvelope.acceptanceTime,
  attachments: [
    {
      name: 'rozhodnuti.pdf',
      mimeType: 'application/pdf',
      metaType: 'main',
      contentBase64: '',
      localPath: '/docs/attachments/box1/1234567/0_rozhodnuti.pdf',
      size: 2048,
    },
  ],
};

const mockFetchOriginal = jest.fn();
jest.mock('../../src/features/accounts/deps', () => ({
  messagesController: {
    getCachedEnvelope: jest.fn(async () => mockEnvelope),
    getCachedDetail: jest.fn(async () => mockDetail),
    markRead: jest.fn(async () => false),
    getDetail: jest.fn(),
    setAttachmentsUnavailable: jest.fn(async () => {}),
    fetchSignedOriginal: (...args: unknown[]) => mockFetchOriginal(...args),
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
// A viewer that stays open: its promise settles only when the test says, or never.
const mockOpenAttachment = jest.fn((..._args: unknown[]) => new Promise<void>(() => {}));
const mockOpenOriginal = jest.fn((..._args: unknown[]) => new Promise<void>(() => {}));
jest.mock('../../src/services/files/attachmentOpener', () => ({
  attachmentOpener: { open: (...args: unknown[]) => mockOpenAttachment(...args) },
  NoViewerError: class NoViewerError extends Error {},
  openSignedOriginal: (...args: unknown[]) => mockOpenOriginal(...args),
}));

import { MessageDetail } from '../../src/features/messages/screens/MessageDetail';
import { SignedOriginalSection } from '../../src/features/messages/screens/SignedOriginalSection';

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

const stored: SignedOriginal = {
  fileName: 'DZ_1234567.zfo',
  localPath: '/docs/attachments/box1/1234567/DZ_1234567.zfo',
  size: 2048,
};

/**
 * AppState driven by the test. Swapped and put back rather than spied on - see the same helper in
 * `transferScreen.test.tsx` for why a spy breaks every later suite.
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

let app: ReturnType<typeof drivenAppState>;
beforeEach(() => {
  app = drivenAppState();
  mockOpenAttachment.mockClear();
  mockOpenOriginal.mockClear();
  mockFetchOriginal.mockReset();
});
afterEach(() => app.restore());

describe('opening an attachment', () => {
  it('launches the viewer once for a double tap, and again after coming back from it', async () => {
    const view = await render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <MessageDetail account={account} messageId={mockEnvelope.id} folder="received" onBack={() => {}} />
      </TamaguiProvider>,
    );
    const row = await waitFor(() => view.getByTestId('attachment-0'), { timeout: 3000 });

    await doubleTap(row);
    await waitFor(() => expect(mockOpenAttachment).toHaveBeenCalled());
    await act(async () => {});
    expect(mockOpenAttachment).toHaveBeenCalledTimes(1);

    // The viewer's promise never settled. Coming back is what frees the row, as it always was.
    await app.comeBack();
    await doubleTap(view.getByTestId('attachment-0'));
    await waitFor(() => expect(mockOpenAttachment).toHaveBeenCalledTimes(2));
  });
});

describe('the signed original', () => {
  const section = (original: SignedOriginal | null) =>
    render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <SignedOriginalSection
          account={account}
          messageId="1234567"
          folder="received"
          envelope={mockEnvelope}
          original={original}
          unavailable={false}
          formatSize={n => `${Math.round(n / 1024)} kB`}
          onChange={() => {}}
        />
      </TamaguiProvider>,
    );

  it('opens once for a double tap, and again after coming back from the viewer', async () => {
    const view = await section(stored);
    const row = await view.findByTestId('signed-original');

    await doubleTap(row);
    await waitFor(() => expect(mockOpenOriginal).toHaveBeenCalled());
    await act(async () => {});
    expect(mockOpenOriginal).toHaveBeenCalledTimes(1);

    await app.comeBack();
    await doubleTap(view.getByTestId('signed-original'));
    await waitFor(() => expect(mockOpenOriginal).toHaveBeenCalledTimes(2));
  });

  it('fetches once for a double tap - and coming back does not free a fetch still running', async () => {
    let answer: (outcome: unknown) => void = () => {};
    mockFetchOriginal.mockImplementation(
      () =>
        new Promise(resolve => {
          answer = resolve;
        }),
    );
    const view = await section(null);
    const row = await view.findByTestId('signed-original');

    await doubleTap(row);
    await app.comeBack();
    await doubleTap(view.getByTestId('signed-original'));
    expect(mockFetchOriginal).toHaveBeenCalledTimes(1);
    // The one fetch was never aborted by a second.
    expect((mockFetchOriginal.mock.calls[0][3] as AbortSignal).aborted).toBe(false);

    await act(async () => {
      answer({ kind: 'error', messageKey: 'messages.error.load' });
    });
  });
});
