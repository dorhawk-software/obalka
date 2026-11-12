// The empty inbox (031, board Empty): the open envelope with nothing in it but its lining, "Ve schránce
// nic není", what the app does about it, and when it last looked - "Naposledy dnes ve 14:02", the same
// words a list says at its end (I26). Czech says "ve" before some hours and "v" before the rest, and a
// line under the envelope that gets it wrong is the first thing a new user reads.

import { render } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { processColor } from 'react-native';
import { TamaguiProvider } from 'tamagui';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { tamaguiConfig } from '../../tamagui.config';
import { lightTheme } from '../../src/theme/theme';
import { setActiveLocale } from '../../src/i18n/strings';
import { freshnessText } from '../../src/features/messages/screens/InboxRows';
import type { DataBoxAccount, MessageEnvelope } from '../../src/services/isds/types';

const at = (h: number, m: number) => new Date(2026, 10, 12, h, m).getTime();
const EVENING = at(23, 30);

describe('when the app last looked', () => {
  afterEach(() => setActiveLocale('cs'));

  it.each([
    [14, 2, 'Naposledy dnes ve 14:02'],
    [2, 15, 'Naposledy dnes ve 02:15'],
    [3, 0, 'Naposledy dnes ve 03:00'],
    [4, 0, 'Naposledy dnes ve 04:00'],
    [12, 0, 'Naposledy dnes ve 12:00'],
    [13, 0, 'Naposledy dnes ve 13:00'],
    [20, 0, 'Naposledy dnes ve 20:00'],
    [22, 10, 'Naposledy dnes ve 22:10'],
    [1, 0, 'Naposledy dnes v 01:00'],
    [9, 5, 'Naposledy dnes v 09:05'],
    [10, 0, 'Naposledy dnes v 10:00'],
    [11, 0, 'Naposledy dnes v 11:00'],
    [15, 0, 'Naposledy dnes v 15:00'],
    [19, 0, 'Naposledy dnes v 19:00'],
  ])('says %i:%i with the preposition Czech gives that hour', (h, m, said) => {
    expect(freshnessText(at(h, m), EVENING)).toBe(said);
  });

  it('counts the minutes of the last hour, and says a moment ago before that', () => {
    expect(freshnessText(EVENING - 5 * 60_000, EVENING)).toBe('Naposledy před 5 minutami');
    expect(freshnessText(EVENING - 60_000, EVENING)).toBe('Naposledy před 1 minutou');
    expect(freshnessText(EVENING - 20_000, EVENING)).toBe('Naposledy před chvílí');
  });

  it('gives a date before today, and admits it has never looked', () => {
    expect(freshnessText(at(9, 0) - 24 * 3600_000, EVENING)).toMatch(/^Naposledy \d/);
    expect(freshnessText(null, EVENING)).toBe('Zatím neaktualizováno');
  });

  it('says it in English with one preposition for every hour', () => {
    setActiveLocale('en');
    expect(freshnessText(at(14, 2), EVENING)).toBe('Last checked today at 14:02');
    expect(freshnessText(at(9, 5), EVENING)).toBe('Last checked today at 09:05');
  });
});

jest.mock('../../src/features/accounts/deps', () => ({
  messagesController: {
    getSentNews: async () => 0,
    markSentNewsSeen: async () => {},
    listReceived: jest.fn(async () => ({
      kind: 'loaded' as const,
      messages: [] as MessageEnvelope[],
      downloaded: [] as string[],
    })),
    listSent: jest.fn(async () => ({ kind: 'loaded' as const, messages: [], downloaded: [] as string[] })),
    getCachedMessages: jest.fn(async () => ({ envelopes: [], downloaded: [], syncedAt: Date.now() })),
  },
  draftsStore: { list: jest.fn(async () => []) },
  remindersController: { listForBox: jest.fn(async () => []) },
}));

import { MessageList } from '../../src/features/messages/screens/MessageList';

const account = {
  id: 'b1',
  boxId: 'b1',
  loginName: 'user',
  label: 'Alpha',
  dbType: null,
  alias: null,
  authMethod: 'password',
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
} as DataBoxAccount;

type Node = { type: string; props: Record<string, unknown>; children: (Node | string)[] | null };
function nodes(root: unknown): Node[] {
  const out: Node[] = [];
  const walk = (n: Node | string) => {
    if (typeof n === 'string') {
      return;
    }
    out.push(n);
    (n.children ?? []).forEach(walk);
  };
  (Array.isArray(root) ? root : root ? [root] : []).forEach(walk);
  return out;
}
const brush = (color: string) => JSON.stringify({ type: 0, payload: processColor(color) });

describe('an inbox with nothing in it', () => {
  it('shows the open envelope, says so, and says when the app last looked', async () => {
    const view = await render(
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
    const empty = await view.findByTestId('emptyInbox');
    expect(view.getByText('Ve schránce nic není')).toBeTruthy();
    expect(view.getByText('Obálka se podívá pokaždé, když ji otevřete.')).toBeTruthy();
    expect(view.getByText(/^Naposledy /)).toBeTruthy();
    // The open envelope: the flap's gold, the deeper blue inside, the front pocket in the envelope's blue.
    const fills = nodes(empty.children as never)
      .concat(nodes(view.toJSON()))
      .filter(n => n.type === 'RNSVGPath' || n.type === 'RNSVGRect')
      .map(n => JSON.stringify(n.props.fill));
    for (const color of [lightTheme.flap, lightTheme.envelopeInside, lightTheme.envelope]) {
      expect(fills).toContain(brush(color));
    }
  });
});
