// The Doručenka slip for a state the app does not recognise (017 T012).
//
// `deliveryRecord.test.ts` proves the record's shape. This file proves what reaches the screen, in
// both locales: an unrecognised state keeps the arrival ISDS reported and prints nothing about
// service - no "Doručeno", no merged row, no fiction. And the other half of the same rule: a genuine
// received message that the store saved with state 0 must not lose its card over it.

import { fireEvent, render } from '@testing-library/react-native';
import { processColor, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { AppThemeProvider } from '../../src/theme/ThemeProvider';
import { darkTheme, lightTheme } from '../../src/theme/theme';
import { chipTone } from '../../src/theme/chipTone';
import { recordRing } from '../../src/theme/print';
import { DeliveryRecordSlip, dateAndTime } from '../../src/features/messages/screens/DeliveryRecord';
import { deliveryRecord } from '../../src/features/messages/state/deliveryRecord';
import { MESSAGE_STATE } from '../../src/features/messages/state/messageState';
import { InMemoryMessagesStore } from '../../src/services/db/messagesStore';
import { setActiveLocale, t } from '../../src/i18n/strings';
import type { MessageEnvelope } from '../../src/services/isds/types';

/** Minute-granularity formatter, matching what the detail screen renders. */
const fmt = (ms: number | null) =>
  ms == null ? '—' : new Date(ms).toISOString().slice(0, 16).replace('T', ' ');

const DELIVERED_AT = Date.UTC(2026, 5, 12, 14, 58);
const ACCEPTED_AT = Date.UTC(2026, 5, 14, 9, 15);

const envelope = (over: Partial<MessageEnvelope>): MessageEnvelope => ({
  id: 'm1',
  subject: 'Předmět',
  sender: 'Úřad',
  senderAddress: null,
  recipient: null,
  recipientAddress: null,
  recipientBoxId: null,
  deliveryTime: DELIVERED_AT,
  acceptanceTime: ACCEPTED_AT,
  state: MESSAGE_STATE.servedBySignIn,
  attachmentSize: null,
  ...over,
});

function wrap(ui: React.ReactElement) {
  return render(
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
}

describe('DeliveryRecordSlip', () => {
  afterEach(() => setActiveLocale('cs'));

  it.each(['cs', 'en'] as const)(
    'shows only the arrival for an unrecognised state carrying both timestamps (%s)',
    async locale => {
      setActiveLocale(locale);
      const view = await wrap(
        <DeliveryRecordSlip
          record={deliveryRecord(envelope({ state: 99 }), fmt)}
        />,
      );
      expect(view.getByTestId('deliveryRecord')).toBeTruthy();
      expect(view.getByText(t('recv.head'))).toBeTruthy();
      expect(view.getByText(t('detail.delivered'))).toBeTruthy();
      expect(view.getByText(dateAndTime(DELIVERED_AT)[0])).toBeTruthy();
      // Nothing that would have to be read off the state.
      expect(view.queryByText(t('detail.accepted'))).toBeNull();
      expect(view.queryByText(t('recv.merged'))).toBeNull();
      expect(view.queryByText(t('status.byFiction'))).toBeNull();
      expect(view.queryByText(dateAndTime(ACCEPTED_AT)[0])).toBeNull();
    },
  );

  it('draws no card when an unrecognised state has no arrival time to show', async () => {
    const view = await wrap(
      <DeliveryRecordSlip
        record={deliveryRecord(
          envelope({ state: 99, deliveryTime: null }),
          fmt,
        )}
      />,
    );
    expect(view.queryByTestId('deliveryRecord')).toBeNull();
  });

  it('keeps the card for a received message the store saved without a list row (state 0)', async () => {
    // `cacheDetail` inserts a self-sufficient row with state 0 when a detail arrives before any list
    // sync. The message is real, and on the detail screen this card is the only place its delivery
    // time appears.
    const store = new InMemoryMessagesStore();
    await store.cacheDetail('b1', {
      id: 'm9',
      subject: 'Předmět',
      sender: 'Úřad',
      senderAddress: null,
      recipient: null,
      recipientAddress: null,
      deliveryTime: DELIVERED_AT,
      acceptanceTime: ACCEPTED_AT,
      attachments: [],
    });
    const saved = await store.getEnvelope('b1', 'm9');
    expect(saved?.state).toBe(0);
    const view = await wrap(
      <DeliveryRecordSlip
        record={deliveryRecord(saved as MessageEnvelope, fmt)}
      />,
    );
    expect(view.getByTestId('deliveryRecord')).toBeTruthy();
    expect(view.getByText(dateAndTime(DELIVERED_AT)[0])).toBeTruthy();
    expect(view.queryByText(t('detail.accepted'))).toBeNull();
  });

  it('draws the full card for a served message - so the cases above cannot pass vacuously', async () => {
    const view = await wrap(
      <DeliveryRecordSlip record={deliveryRecord(envelope({}), fmt)} />,
    );
    expect(view.getByTestId('deliveryRecord')).toBeTruthy();
    expect(view.getByText(t('detail.delivered'))).toBeTruthy();
    expect(view.getByText(t('detail.accepted'))).toBeTruthy();
  });
});

// The slip itself (031, board Message): a perforated slip under the envelope; each step struck as a
// ring - checked for the arrival, the clock for fiction, filled for a service someone signed in for -
// with the board's note under its name and the date over the time at its end.

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
const colorOf = (n: unknown) =>
  ((StyleSheet.flatten((n as Node).props.style as never) ?? {}) as Record<string, unknown>).color;

const FICTION = envelope({ state: MESSAGE_STATE.servedByFiction });

function themed(ui: React.ReactElement, isDark: boolean) {
  return render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme={isDark ? 'dark' : 'light'}>
      <AppThemeProvider isDark={isDark}>{ui}</AppThemeProvider>
    </TamaguiProvider>,
  );
}

describe.each([
  ['light', false, lightTheme],
  ['dark', true, darkTheme],
] as const)('the slip, %s', (_label, isDark, theme) => {
  it('lies on the paper as a perforated slip', async () => {
    const view = await themed(<DeliveryRecordSlip record={deliveryRecord(FICTION, fmt)} />, isDark);
    let host = view.getByText(t('recv.head.fiction'));
    while (host.props.onLayout == null && host.parent) {
      host = host.parent;
    }
    await fireEvent(host, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 358, height: 160 } } });
    const paper = nodes(view.toJSON()).filter(
      n => n.type === 'RNSVGPath' && JSON.stringify(n.props.fill) === brush(theme.surface),
    );
    expect(paper).toHaveLength(1);
    expect(paper[0].props.fillRule).toBe(0); // evenodd: the holes are cut out of it
  });

  it('names fiction in gold, an ordinary record in the muted ink, and says it is from ISDS', async () => {
    const fiction = await themed(<DeliveryRecordSlip record={deliveryRecord(FICTION, fmt)} />, isDark);
    expect(colorOf(fiction.getByText(t('recv.head.fiction')))).toBe(chipTone('statusFiction', theme).fg);
    // The header takes the row's width: measured to its own words, Android cut the last one
    // ("DORUČENKA ·", seen on the emulator, 2026-11-12).
    const head = StyleSheet.flatten(fiction.getByText(t('recv.head.fiction')).props.style as never) as Record<string, unknown>;
    expect(head.flex ?? head.flexGrow).toBe(1);
    expect(colorOf(fiction.getByText('ISDS'))).toBe(theme.textFaint);
    await fiction.unmount();
    const plain = await themed(<DeliveryRecordSlip record={deliveryRecord(envelope({}), fmt)} />, isDark);
    expect(colorOf(plain.getByText(t('recv.head')))).toBe(theme.textMuted);
  });

  it('strikes the arrival as a checked ring and fiction as the clock, in the gold and a heavier line', async () => {
    const view = await themed(<DeliveryRecordSlip record={deliveryRecord(FICTION, fmt)} />, isDark);
    const all = nodes(view.toJSON());
    const rings = (color: string) =>
      all.filter(n => n.type === 'RNSVGCircle' && JSON.stringify(n.props.stroke) === brush(color));
    expect(rings(theme.bodyText)).toHaveLength(2);
    expect(rings(theme.goldInk)).toHaveLength(2);
    expect(rings(theme.goldInk).every(n => n.props.strokeWidth === recordRing.strokeGold)).toBe(true);
    const marks = all.filter(n => n.type === 'RNSVGPath').map(n => n.props.d);
    expect(marks).toEqual(expect.arrayContaining([recordRing.check, recordRing.clock]));
  });

  it('fills the ring of a service someone signed in for, the check cut out of it', async () => {
    const view = await themed(<DeliveryRecordSlip record={deliveryRecord(envelope({}), fmt)} />, isDark);
    const all = nodes(view.toJSON());
    const green = chipTone('statusRead', theme).fg;
    expect(all.some(n => n.type === 'RNSVGCircle' && JSON.stringify(n.props.fill) === brush(green))).toBe(true);
    const knocked = all.filter(
      n => n.type === 'RNSVGPath' && n.props.d === recordRing.check && JSON.stringify(n.props.stroke) === brush(theme.surface),
    );
    expect(knocked).toHaveLength(1);
  });

  it("gives each step the board's note, and the date over the time", async () => {
    const view = await themed(<DeliveryRecordSlip record={deliveryRecord(FICTION, fmt)} />, isDark);
    expect(view.getByText('do schránky, nikdo se nepřihlásil')).toBeTruthy();
    expect(view.getByText('po deseti dnech, lhůty běží')).toBeTruthy();
    const [date, time] = dateAndTime(ACCEPTED_AT);
    expect(colorOf(view.getByText(date))).toBe(theme.bodyText);
    expect(colorOf(view.getByText(time))).toBe(theme.textMuted);
  });
});

it('sets the date as dd.mm.yyyy and the time as hh:mm', () => {
  expect(dateAndTime(new Date(2026, 7, 9, 7, 5).getTime())).toEqual(['09.08.2026', '07:05']);
});
