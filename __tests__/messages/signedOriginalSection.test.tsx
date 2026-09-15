// The signed original on the message detail (004 amendment, 2026-09-14).
//
// Three things this row must never do: fetch anything the user did not tap for, claim an original is
// gone on a date alone, or offer a button for something ISDS has confirmed it no longer has. And what
// it says has to follow the record: a stored original names its file, a missing one says so.

import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Dimensions, StyleSheet } from 'react-native';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { t } from '../../src/i18n/strings';
import type {
  DataBoxAccount,
  MessageEnvelope,
  SignedOriginal,
} from '../../src/services/isds/types';

const mockFetch = jest.fn();
jest.mock('../../src/features/accounts/deps', () => ({
  messagesController: {
    fetchSignedOriginal: (...args: unknown[]) => mockFetch(...args),
  },
}));
const mockOpen = jest.fn(async (..._args: unknown[]) => 'opened');
jest.mock('../../src/services/files/attachmentOpener', () => ({
  attachmentOpener: {},
  openSignedOriginal: (...args: unknown[]) => mockOpen(...args),
}));
const mockExists = jest.fn(async (..._args: unknown[]) => true);
jest.mock('../../src/services/files/attachmentFileStore', () => ({
  attachmentFileStore: { exists: (...args: unknown[]) => mockExists(...args) },
}));

import { SignedOriginalSection } from '../../src/features/messages/screens/SignedOriginalSection';

const DAY = 24 * 60 * 60 * 1000;

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

const envelope = (acceptedDaysAgo: number): MessageEnvelope => ({
  id: '1234567',
  subject: 'Rozhodnutí',
  sender: 'Finanční úřad',
  senderAddress: null,
  recipient: null,
  recipientAddress: null,
  recipientBoxId: null,
  deliveryTime: Date.now() - (acceptedDaysAgo + 1) * DAY,
  acceptanceTime: Date.now() - acceptedDaysAgo * DAY,
  state: 7,
  attachmentSize: 1,
});

const stored: SignedOriginal = {
  fileName: 'DZ_1234567.zfo',
  localPath: '/docs/attachments/box1/1234567/DZ_1234567.zfo',
  size: 2048,
};

async function section(
  props: Partial<Parameters<typeof SignedOriginalSection>[0]> = {},
) {
  const onChange = jest.fn();
  const view = await render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <SignedOriginalSection
        account={account}
        messageId="1234567"
        folder="received"
        envelope={envelope(3)}
        original={null}
        unavailable={false}
        formatSize={n => `${Math.round(n / 1024)} kB`}
        onChange={onChange}
        {...props}
      />
    </TamaguiProvider>,
  );
  return { view, onChange };
}

beforeEach(() => {
  mockFetch.mockReset();
  mockOpen.mockClear();
  mockExists.mockReset();
  mockExists.mockImplementation(async () => true);
});

describe('the signed original row', () => {
  it('names a stored original and its size, and opens it on a tap', async () => {
    const { view } = await section({ original: stored });
    const row = await view.findByTestId('signed-original');
    expect(row).toHaveTextContent(/Podepsaný originál \(ZFO\)/);
    expect(row).toHaveTextContent(/DZ_1234567\.zfo · 2 kB/);
    fireEvent.press(row);
    await waitFor(() => expect(mockOpen).toHaveBeenCalledWith(expect.anything(), stored));
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('fetches nothing until asked, then records what the fetch brought', async () => {
    const detail = { id: '1234567', attachments: [], signedZfo: stored };
    mockFetch.mockResolvedValue({ kind: 'saved', detail });
    const { view, onChange } = await section();
    const row = await view.findByTestId('signed-original');
    expect(row).toHaveTextContent(t('detail.original.fetch.note'), { exact: false });
    expect(mockFetch).not.toHaveBeenCalled();
    fireEvent.press(row);
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(detail));
    expect(mockFetch).toHaveBeenCalledWith(account, '1234567', 'received', expect.anything());
  });

  it('past 90 days says ISDS has probably deleted it, and still offers it', async () => {
    const { view } = await section({ envelope: envelope(120) });
    const row = await view.findByTestId('signed-original');
    expect(row).toHaveTextContent(t('detail.original.fetch.late'), { exact: false });
    expect(row.props.accessibilityRole).toBe('button');
  });

  it('offers nothing to press once ISDS has confirmed the message gone', async () => {
    const { view } = await section({ unavailable: true });
    const row = await view.findByTestId('signed-original');
    expect(row).toHaveTextContent(t('detail.original.unavailable.note'), { exact: false });
    expect(row.props.accessibilityRole).toBeUndefined();
    fireEvent.press(row);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('says in the caption, in place, when a fetch failed', async () => {
    mockFetch.mockResolvedValue({ kind: 'error', messageKey: 'detail.original.fetchFailed' });
    const { view } = await section();
    fireEvent.press(await view.findByTestId('signed-original'));
    await waitFor(() =>
      expect(view.getByTestId('signed-original')).toHaveTextContent(
        t('detail.original.fetchFailed'), { exact: false }
      ),
    );
  });

  it('drops a failed fetch s error once the record changes under it', async () => {
    // Reviewed 2026-09-14: the error outlived the record. A fetch failed, the whole message was then
    // downloaded again from the button above and brought its original - and the row named the file
    // with "could not be downloaded" still under it, in red.
    mockFetch.mockResolvedValue({ kind: 'error', messageKey: 'detail.original.fetchFailed' });
    const element = (original: SignedOriginal | null) => (
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <SignedOriginalSection
          account={account}
          messageId="1234567"
          folder="received"
          envelope={envelope(3)}
          original={original}
          unavailable={false}
          formatSize={n => `${Math.round(n / 1024)} kB`}
          onChange={jest.fn()}
        />
      </TamaguiProvider>
    );
    const view = await render(element(null));
    fireEvent.press(await view.findByTestId('signed-original'));
    await waitFor(() =>
      expect(view.getByTestId('signed-original')).toHaveTextContent(
        t('detail.original.fetchFailed'), { exact: false }
      ),
    );
    await view.rerender(element(stored));
    await waitFor(() =>
      expect(view.getByTestId('signed-original')).toHaveTextContent(/DZ_1234567\.zfo · 2 kB/),
    );
    expect(view.getByTestId('signed-original')).not.toHaveTextContent(
      t('detail.original.fetchFailed'), { exact: false }
    );
  });

  it('reserves two caption lines at the reader s text size, not at the default one', async () => {
    // Constitution V. RN scales a caption's line height with the system font; a minHeight in dp does
    // not scale, so a fixed 32 reserved two lines only at 100 %. Jest's window reports a font scale of 2.
    const { fontScale } = Dimensions.get('window');
    expect(fontScale).not.toBe(1);
    const { view } = await section();
    const caption = await view.findByText(t('detail.original.fetch.note'));
    expect(StyleSheet.flatten(caption.props.style).minHeight).toBe(2 * 16 * fontScale);
  });

  it('calls a recorded original whose file has gone missing, and offers it again', async () => {
    mockExists.mockImplementation(async () => false);
    const { view } = await section({ original: stored });
    await waitFor(() =>
      expect(view.getByTestId('signed-original')).toHaveTextContent(
        t('detail.original.fetch.missing'), { exact: false }
      ),
    );
  });
});
