// What the inbox says when a sync fails (reported 2026-08-19).
//
// Two claims were wrong at once on a signed-out production box: the app announced "Offline" to a
// phone with a working connection, and it did NOT offer "Přihlásit se znovu" - the one control that
// fixes it. The transport-level cause is pinned in `expiredSession.test.ts`; this suite pins what the
// screen does with each outcome, because the banner is where the false claim was actually made.

import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { TamaguiProvider } from 'tamagui';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { tamaguiConfig } from '../../tamagui.config';
import type { DataBoxAccount, MessageEnvelope } from '../../src/services/isds/types';
import { MESSAGE_STATE } from '../../src/features/messages/state/messageState';
import { t } from '../../src/i18n/strings';

const mockCached: MessageEnvelope[] = [
  {
    id: 'm1',
    subject: 'Uložená zpráva',
    sender: 'Úřad',
    senderAddress: null,
    recipient: null,
    recipientAddress: null,
    recipientBoxId: null,
    deliveryTime: Date.now() - 86400000,
    acceptanceTime: null,
    state: MESSAGE_STATE.read,
    attachmentSize: null,
  },
];

/** The outcome the controller returns for the live sync; each test sets it before rendering. */
const mockOutcome: { value: unknown } = { value: null };

jest.mock('../../src/features/accounts/deps', () => ({
  messagesController: {
    listReceived: jest.fn(async () => mockOutcome.value),
    listSent: jest.fn(async () => mockOutcome.value),
    getCachedMessages: jest.fn(async () => ({
      envelopes: mockCached,
      downloaded: [],
      syncedAt: Date.now() - 3600000,
    })),
  },
  draftsStore: { list: jest.fn(async () => []) },
  remindersController: { listForBox: jest.fn(async () => []) },
}));

import { MessageList } from '../../src/features/messages/screens/MessageList';

const account: DataBoxAccount = {
  id: 'b1',
  boxId: 'b1',
  loginName: 'user',
  label: 'Alpha',
  dbType: null,
  alias: null,
  authMethod: 'otp_totp', // an SMS box - the kind that carries a session cookie
  host: 'production',
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

const inboxFor = (acc: DataBoxAccount) => render(inboxTree(acc));

function inboxTree(acc: DataBoxAccount) {
  return (
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <NavigationContainer>
          <MessageList
            account={acc}
            onOpenSwitcher={() => {}}
            onSearch={() => {}}
            onOpenMessage={() => {}}
            onCompose={() => {}}
            onReauth={() => {}}
        onOpenFaq={() => {}}
          />
        </NavigationContainer>
      </TamaguiProvider>
    </SafeAreaProvider>
  );
}

const inbox = () =>
  render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <NavigationContainer>
          <MessageList
            account={account}
            onOpenSwitcher={() => {}}
            onSearch={() => {}}
            onOpenMessage={() => {}}
            onCompose={() => {}}
            onReauth={() => {}}
        onOpenFaq={() => {}}
          />
        </NavigationContainer>
      </TamaguiProvider>
    </SafeAreaProvider>,
  );

describe('when the live sync fails but a cache exists', () => {
  it('offers re-authentication when the session expired - with the cached rows still readable', async () => {
    // The reported bug: a signed-out box showed neither this strip nor any hint that signing in was
    // the fix. The rows stay: a session that expired says nothing about the archive.
    mockOutcome.value = { kind: 'reauth' };
    const view = await inbox();
    await waitFor(() => expect(view.getByTestId('reauth')).toBeTruthy());
    expect(view.getByTestId('message-m1')).toBeTruthy();
    expect(view.queryByText(/Offline/)).toBeNull();
    // …and ONLY the strip. A second banner saying the messages could not be refreshed adds nothing:
    // the strip already says why, and says what to do about it.
    expect(view.queryByText(/nepodařilo aktualizovat/)).toBeNull();
  });

  it('says "offline" ONLY for a real network failure', async () => {
    mockOutcome.value = {
      kind: 'error',
      messageKey: 'messages.error.network',
    };
    const view = await inbox();
    await waitFor(() => expect(view.getByText(/^Offline/)).toBeTruthy());
  });

  it('does not claim to be offline when the SERVER failed', async () => {
    // The app cannot see the user's connection; it can only see that its own call did not work.
    mockOutcome.value = { kind: 'error', messageKey: 'messages.error.load' };
    const view = await inbox();
    await waitFor(() =>
      expect(view.getByText(/nepodařilo aktualizovat/)).toBeTruthy(),
    );
    expect(view.queryByText(/^Offline/)).toBeNull();
  });

  it('says nothing at all when the sync succeeds', async () => {
    mockOutcome.value = { kind: 'loaded', messages: mockCached, downloaded: [] };
    const view = await inbox();
    await waitFor(() => expect(view.getByTestId('message-m1')).toBeTruthy());
    expect(view.queryByText(/^Offline/)).toBeNull();
    expect(view.queryByText(/nepodařilo aktualizovat/)).toBeNull();
    expect(view.queryByTestId('reauth')).toBeNull();
  });
});

describe('the password-expiry strip (001 T041)', () => {
  // The app has always known this date and never said it. A password box whose password lapses stops
  // signing in, and the only place the user could have found out was ISDS itself.
  const withExpiry = (passwordExpiresAt: number | null) => ({
    ...account,
    passwordExpiresAt,
  });

  it('warns when the password runs out within the fortnight', async () => {
    mockOutcome.value = { kind: 'loaded', messages: mockCached, downloaded: [] };
    const view = await inboxFor(withExpiry(Date.now() + 3 * 86400000));
    await waitFor(() => expect(view.getByTestId('passwordExpiry')).toBeTruthy());
    // The action is a hand-off to the portal, because the app cannot change an ISDS password.
    expect(view.getByTestId('passwordExpiryAction')).toBeTruthy();
  });

  it('says nothing while the date is comfortably away', async () => {
    mockOutcome.value = { kind: 'loaded', messages: mockCached, downloaded: [] };
    const view = await inboxFor(withExpiry(Date.now() + 60 * 86400000));
    await waitFor(() => expect(view.getByTestId('message-m1')).toBeTruthy());
    expect(view.queryByTestId('passwordExpiry')).toBeNull();
  });

  it('says nothing when ISDS never gave a date', async () => {
    mockOutcome.value = { kind: 'loaded', messages: mockCached, downloaded: [] };
    const view = await inboxFor(withExpiry(null));
    await waitFor(() => expect(view.getByTestId('message-m1')).toBeTruthy());
    expect(view.queryByTestId('passwordExpiry')).toBeNull();
  });

  it('yields to the sign-in strip - a box you cannot use has one problem, not two', async () => {
    // Both conditions are true here. Stacking two gold strips buries the one the user can act on.
    mockOutcome.value = { kind: 'reauth' };
    const view = await inboxFor(withExpiry(Date.now() + 2 * 86400000));
    await waitFor(() => expect(view.getByTestId('reauth')).toBeTruthy());
    expect(view.queryByTestId('passwordExpiry')).toBeNull();
  });
});

// 001 FR-009. A password box refused after its stored expiry date has an expired password, not a
// wrong one - and the fix starts on the portal, so the strip has to say so and offer the way there.
describe('a password box refused after its password expired', () => {
  const DAY = 86400000;
  const passwordBox = (
    host: DataBoxAccount['host'],
    passwordExpiresAt: number | null,
  ): DataBoxAccount => ({
    ...account,
    authMethod: 'password',
    host,
    passwordExpiresAt,
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('says the password expired, and offers the portal before signing in again', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    mockOutcome.value = { kind: 'reauth' };
    const view = await inboxFor(passwordBox('czebox', Date.now() - DAY));
    await waitFor(() => expect(view.getByTestId('reauthPortal')).toBeTruthy());
    expect(view.getByText(t('box.reauth.passwordExpired'))).toBeTruthy();
    // Signing in stays: it is the second step, once the password has been changed.
    expect(view.getByTestId('reauth')).toBeTruthy();
    fireEvent.press(view.getByTestId('reauthPortal'));
    // The test box's own portal - its login does not exist on the production one.
    expect(open).toHaveBeenCalledWith('https://www.datovka-test.gov.cz');
  });

  it('keeps the invalid-credentials strip, with no portal action, while the date is ahead', async () => {
    mockOutcome.value = { kind: 'reauth' };
    const view = await inboxFor(passwordBox('production', Date.now() + 30 * DAY));
    await waitFor(() => expect(view.getByTestId('reauth')).toBeTruthy());
    expect(view.getByText(t('box.reauth.credentials'))).toBeTruthy();
    expect(view.queryByTestId('reauthPortal')).toBeNull();
  });

  it('keeps an SMS box on the session wording, whatever date its row carries', async () => {
    mockOutcome.value = { kind: 'reauth' };
    const view = await inboxFor({ ...account, passwordExpiresAt: Date.now() - DAY });
    await waitFor(() => expect(view.getByTestId('reauth')).toBeTruthy());
    expect(view.getByText(t('box.reauth.session'))).toBeTruthy();
    expect(view.queryByTestId('reauthPortal')).toBeNull();
  });

  it('sends the expiry warning to the box’s own portal too', async () => {
    // It always opened the PRODUCTION portal, whichever environment the box was in.
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    mockOutcome.value = { kind: 'loaded', messages: mockCached, downloaded: [] };
    const view = await inboxFor(passwordBox('czebox', Date.now() + 3 * DAY));
    await waitFor(() => expect(view.getByTestId('passwordExpiryAction')).toBeTruthy());
    fireEvent.press(view.getByTestId('passwordExpiryAction'));
    expect(open).toHaveBeenCalledWith('https://www.datovka-test.gov.cz');
  });

  it('keeps the verdict of the refusal while the clock passes the expiry date', async () => {
    // Read at the render clock, a refusal a minute and a half BEFORE the stored date became "change it
    // on the portal" on a later re-render - and the strip grew a row of actions above the list the
    // user was reading (constitution V). The question is about the refusal, so it is asked then.
    mockOutcome.value = { kind: 'reauth' };
    const refused = Date.now();
    const box = passwordBox('production', refused + 90_000);
    const view = await inboxFor(box);
    await waitFor(() => expect(view.getByTestId('reauth')).toBeTruthy());
    expect(view.getByText(t('box.reauth.credentials'))).toBeTruthy();

    jest.spyOn(Date, 'now').mockReturnValue(refused + 5 * 60_000);
    // Inside act, or the assertions below run before the re-render has committed.
    await act(async () => {
      view.rerender(inboxTree(box));
    });
    expect(view.getByText(t('box.reauth.credentials'))).toBeTruthy();
    expect(view.queryByTestId('reauthPortal')).toBeNull();
  });

  it('gives the verdict already stored for the box, the one its switcher row and re-auth screen give', async () => {
    // A box refused while still in date is stored `reauth`: its row says "Přihlášení vypršelo" and its
    // re-auth screen asks for the credentials. Refused again here once the date had passed, this strip
    // alone said "change it on the portal".
    mockOutcome.value = { kind: 'reauth' };
    const view = await inboxFor({
      ...passwordBox('production', Date.now() - DAY),
      syncError: 'reauth',
    });
    await waitFor(() => expect(view.getByTestId('reauth')).toBeTruthy());
    expect(view.getByText(t('box.reauth.credentials'))).toBeTruthy();
    expect(view.queryByTestId('reauthPortal')).toBeNull();
  });
});
