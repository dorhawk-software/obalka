// The inbox's rows (031, board "Inbox - the envelope front"): a sheet in the attention block, its
// sender's envelope sealed while unread and the second envelope's edge under it only when the law
// served it; and the register, which prints each day once beside its first row.

import { render } from '@testing-library/react-native';
import { processColor, StyleSheet } from 'react-native';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { AppThemeProvider } from '../../src/theme/ThemeProvider';
import { lightTheme } from '../../src/theme/theme';
import { AttentionSheet, RegisterRow, weekdayShort } from '../../src/features/messages/screens/InboxRows';
import { MESSAGE_STATE } from '../../src/features/messages/state/messageState';
import { formatTermDate } from '../../src/features/messages/screens/TermPicker';
import { getActiveLocale, setActiveLocale } from '../../src/i18n/strings';
import type { MessageEnvelope } from '../../src/services/isds/types';

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
const style = (n: Node) => (StyleSheet.flatten(n.props.style as never) ?? {}) as Record<string, unknown>;

const DAY_MS = 24 * 60 * 60 * 1000;
// Sunday 8 November 2026, noon local time.
const SUNDAY = new Date(2026, 10, 8, 12).getTime();
const NOW = SUNDAY + 3 * DAY_MS;

const envelope = (over: Partial<MessageEnvelope> = {}): MessageEnvelope => ({
  id: 'm',
  subject: 'Výzva k doplnění',
  sender: 'Městský úřad Kolín',
  senderAddress: null,
  recipient: null,
  recipientAddress: null,
  recipientBoxId: null,
  deliveryTime: SUNDAY,
  acceptanceTime: null,
  state: MESSAGE_STATE.read,
  attachmentSize: null,
  ...over,
});

const wrap = (child: React.ReactElement) => (
  <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
    <AppThemeProvider isDark={false}>{child}</AppThemeProvider>
  </TamaguiProvider>
);

const sheet = (message: MessageEnvelope, termDate: number | null = null) =>
  render(
    wrap(
      <AttentionSheet
        message={message}
        entry={termDate != null ? { reason: 'reminder', date: termDate } as never : null}
        now={NOW}
        onOpen={() => undefined}
        folder="received"
        onExplain={() => undefined}
      />,
    ),
  );

const row = (message: MessageEnvelope, over: { showDay?: boolean; termDate?: number | null } = {}) =>
  render(
    wrap(
      <RegisterRow
        message={message}
        now={NOW}
        termDate={over.termDate ?? null}
        showDay={over.showDay ?? true}
        onOpen={() => undefined}
        folder="received"
      />,
    ),
  );

const hasFlap = (root: unknown) =>
  nodes(root).some(n => n.type === 'RNSVGPath' && JSON.stringify(n.props.fill) === brush(lightTheme.flap));

describe('a sheet in the attention block', () => {
  it('seals the sender\'s envelope with the gold flap while the message is unread', async () => {
    const view = await sheet(envelope({ state: MESSAGE_STATE.servedBySignIn }));
    expect(hasFlap(view.toJSON())).toBe(true);
  });

  it('opens the envelope once it is read', async () => {
    const view = await sheet(envelope({ state: MESSAGE_STATE.read }));
    expect(hasFlap(view.toJSON())).toBe(false);
  });

  it('shows the second envelope\'s edge under a message the law served', async () => {
    const view = await sheet(
      envelope({ state: MESSAGE_STATE.servedByFiction, acceptanceTime: SUNDAY + DAY_MS }),
    );
    const edge = view.getByTestId('sheetEdge');
    expect(style(edge as unknown as Node).backgroundColor).toBe(lightTheme.sheetEdge);
    expect(view.getByTestId('explainFiction')).toHaveTextContent(/Doručeno fikcí/);
  });

  it('draws no edge under a sheet that is there for any other reason', async () => {
    const view = await sheet(envelope({ state: MESSAGE_STATE.servedBySignIn }), NOW + 2 * DAY_MS);
    expect(view.queryByTestId('sheetEdge')).toBeNull();
  });

  it('marks the user\'s own reminder in the blue, past due in the danger ink', async () => {
    const ink = async (date: number) => {
      const view = await sheet(envelope(), date);
      return { view, color: style(view.getByText(formatTermDate(date)) as unknown as Node).color };
    };
    const ahead = await ink(NOW + 2 * DAY_MS);
    expect(ahead.color).toBe(lightTheme.blue);
    expect((await ink(NOW - 2 * DAY_MS)).color).toBe(lightTheme.danger);
    expect(ahead.view.getByTestId('message-m').props.accessibilityLabel).toMatch(/Připomínka /);
  });
});

describe('the register', () => {
  it('prints the day and its weekday beside the first row of the day', async () => {
    const view = await row(envelope());
    expect(view.getByText('8')).toBeTruthy();
    expect(view.getByText('ne')).toBeTruthy();
  });

  it('leaves the column blank on the rest of that day', async () => {
    const view = await row(envelope(), { showDay: false });
    expect(view.queryByText('8')).toBeNull();
    expect(view.queryByText('ne')).toBeNull();
  });

  it('shows a clip only when the message has attachments', async () => {
    // The other drawings on the row stay the same either way, so the clip is the difference.
    const drawings = (root: unknown) => nodes(root).filter(n => n.type === 'RNSVGSvgView').length;
    const withFiles = await row(envelope({ attachmentSize: 48_000 }));
    const without = await row(envelope({ attachmentSize: 0 }));
    const unknown = await row(envelope({ attachmentSize: null }));
    expect(drawings(withFiles.toJSON()) - drawings(without.toJSON())).toBe(1);
    expect(drawings(unknown.toJSON())).toBe(drawings(without.toJSON()));
  });
});

describe('weekdayShort', () => {
  const before = getActiveLocale();
  afterEach(() => setActiveLocale(before));

  it('names the day in Czech', () => {
    setActiveLocale('cs');
    expect(weekdayShort(SUNDAY)).toBe('ne');
  });

  it('and in English', () => {
    setActiveLocale('en');
    expect(weekdayShort(SUNDAY)).toBe('Sun');
  });
});
