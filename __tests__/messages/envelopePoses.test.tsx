// The envelope in a pose (031 board R4, agreed 2026-11-12): each empty, failed or search state draws
// the envelope as the state needs it, where 132 px Lucide glyphs were. Sent, nothing yet: a blank
// stamp and an empty window. Could not load: sealed under its flap. Needs a sign-in: an empty window,
// no stamp. The search: a stack of envelopes.

import { fireEvent, render } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { processColor } from 'react-native';
import { TamaguiProvider } from 'tamagui';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { tamaguiConfig } from '../../tamagui.config';
import { lightTheme } from '../../src/theme/theme';
import { EnvelopePose, type EnvelopePoseName } from '../../src/theme/objects/Envelope';
import type { DataBoxAccount, MessageEnvelope } from '../../src/services/isds/types';

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

async function drawn(pose: EnvelopePoseName) {
  const view = await render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <EnvelopePose pose={pose} />
    </TamaguiProvider>,
  );
  const paths = nodes(view.toJSON()).filter(n => n.type === 'RNSVGPath');
  return {
    fills: paths.map(n => JSON.stringify(n.props.fill)),
    dashed: paths.filter(n => n.props.strokeDasharray != null).length,
  };
}

describe('each pose draws what its state means', () => {
  it('sent, nothing yet: a blank stamp and an empty window', async () => {
    const { fills, dashed } = await drawn('unsent');
    expect(fills).toContain(brush(lightTheme.window));
    expect(fills).not.toContain(brush(lightTheme.flap));
    expect(dashed).toBe(2); // the stamp's outline and the window's address lines
  });

  it('could not load: sealed under its gold flap, no window', async () => {
    const { fills } = await drawn('sealed');
    expect(fills).toContain(brush(lightTheme.flap));
    expect(fills).not.toContain(brush(lightTheme.window));
  });

  it('needs a sign-in: the empty window, and no stamp', async () => {
    const { fills, dashed } = await drawn('addressed');
    expect(fills).toContain(brush(lightTheme.window));
    expect(dashed).toBe(1);
  });

  // The creases run to the corners and the flap to the top edge, and the corners are round: unclipped,
  // the crease ends poked out past the paper and a blue rim showed above the flap (the owner's catch
  // on the device, 2026-11-13).
  it.each<EnvelopePoseName>(['unsent', 'sealed', 'addressed', 'archive'])(
    '%s keeps its creases and flap inside the paper',
    async pose => {
      const view = await render(
        <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
          <EnvelopePose pose={pose} />
        </TamaguiProvider>,
      );
      const clips = new Set(
        nodes(view.toJSON())
          .filter(n => n.type === 'RNSVGClipPath')
          .map(n => n.props.name),
      );
      const loose: string[] = [];
      const walk = (n: Node | string, clipped: boolean) => {
        if (typeof n === 'string') {
          return;
        }
        const inside = clipped || (n.type === 'RNSVGGroup' && clips.has(n.props.clipPath));
        const crease = JSON.stringify(n.props.stroke) === brush(lightTheme.envelopeCrease);
        const flap = JSON.stringify(n.props.fill) === brush(lightTheme.flap);
        if (n.type === 'RNSVGPath' && (crease || flap) && !inside) {
          loose.push(crease ? 'crease' : 'flap');
        }
        (n.children ?? []).forEach(c => walk(c, inside));
      };
      walk(view.toJSON() as Node, false);
      expect(loose).toEqual([]);
    },
  );

  it('the search: three envelopes, deepest at the back', async () => {
    const { fills } = await drawn('archive');
    for (const color of [lightTheme.envelopeInside, lightTheme.envelopeBehind, lightTheme.envelope]) {
      expect(fills).toContain(brush(color));
    }
  });
});

jest.mock('../../src/features/accounts/deps', () => ({
  messagesController: {
    getSentNews: async () => 0,
    markSentNewsSeen: async () => {},
    listReceived: jest.fn(async () => ({ kind: 'loaded' as const, messages: [] as MessageEnvelope[], downloaded: [] })),
    listSent: jest.fn(async () => ({ kind: 'loaded' as const, messages: [] as MessageEnvelope[], downloaded: [] })),
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

it('an empty Odeslané shows the unsent envelope and says nothing was sent, without a full stop', async () => {
  const view = await render(
    <SafeAreaProvider
      initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } }}
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
  await view.findByTestId('emptyInbox');
  await fireEvent.press(view.getByText('Odeslané'));
  expect(await view.findByTestId('emptySent')).toBeTruthy();
  expect(view.getByTestId('envelopePose-unsent', { includeHiddenElements: true })).toBeTruthy();
  expect(view.getByText('Žádné odeslané zprávy')).toBeTruthy();
});
