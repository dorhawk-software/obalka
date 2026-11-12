// The sent result (031, board "Sent - the stamp is cancelled", I39): the envelope that went, the stamp
// it cost cancelled by the postmark ISDS struck, "Zpráva odeslána" with when ISDS took it, and the
// delivery record still to fill in. These hold each fact on its object, the Czech preposition, that
// nothing is drawn as done that ISDS has not reported, and the two ways on.

import { fireEvent, render, waitFor } from '@testing-library/react-native';
import RNHaptic from 'react-native-haptic-feedback';
import { useReducedMotion } from 'react-native-reanimated';
import { processColor } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { AppThemeProvider } from '../../src/theme/ThemeProvider';
import { darkTheme, lightTheme } from '../../src/theme/theme';
import { cancellation, postmarkPrint, recordRing } from '../../src/theme/print';
import { setActiveLocale } from '../../src/i18n/strings';
import { SentResult, sendMoment, sendMomentEnd, sentBody, sentSteps } from '../../src/features/messages/screens/SentResult';
import type { DataBoxAccount, Recipient } from '../../src/services/isds/types';
import type { SentStatus } from '../../src/features/messages/state/sendController';

const SENT_AT = new Date(2026, 10, 11, 14, 2).getTime();

const account = {
  id: 'a1',
  boxId: 'k4m9xrt',
  label: 'Jana Nováková',
  alias: null,
} as DataBoxAccount;

const recipient = {
  boxId: 'ab12cd3',
  name: 'Finanční úřad pro Kotlinský kraj',
  address: null,
  dbType: 'OVM',
} as Recipient;

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

const mount = (
  props: { paidCzk?: number | null; status?: SentStatus | null; onDone?: () => void; onOpenSent?: () => void } = {},
  isDark = false,
) =>
  render(
    <SafeAreaProvider
      initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } }}
    >
      <TamaguiProvider config={tamaguiConfig} defaultTheme={isDark ? 'dark' : 'light'}>
        <AppThemeProvider isDark={isDark}>
          <SentResult
            account={account}
            recipient={recipient}
            messageId="1290447180"
            sentAt={SENT_AT}
            paidCzk={props.paidCzk ?? null}
            reconciled={false}
            status={props.status ?? null}
            opening={false}
            onDone={props.onDone ?? jest.fn()}
            onOpenSent={props.onOpenSent ?? jest.fn()}
          />
        </AppThemeProvider>
      </TamaguiProvider>
    </SafeAreaProvider>,
  );

/** Lays out every node that waits for its size (the stamp, the slip), so they draw. */
async function layOut(view: Awaited<ReturnType<typeof mount>>) {
  for (const id of ['sentStamp', 'sentStep-sent']) {
    let host = view.getByTestId(id, { includeHiddenElements: true });
    for (let i = 0; i < 6 && host.parent; i++) {
      if (host.props.onLayout) {
        await fireEvent(host, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 84, height: 90 } } });
      }
      host = host.parent;
    }
  }
}

afterEach(() => setActiveLocale('cs'));

describe.each([
  ['light', false, lightTheme],
  ['dark', true, darkTheme],
] as const)('%s', (_label, isDark, theme) => {
  it('prints the sender on the envelope and the recipient in its window', async () => {
    const view = await mount({}, isDark);
    expect(view.getByText('Jana Nováková')).toBeTruthy();
    expect(view.getByText('ID k4m9xrt')).toBeTruthy();
    expect(view.getByTestId('sentRecipient').props.children).toBe('Finanční úřad pro Kotlinský kraj');
  });

  it('strikes the postmark with the minute ISDS took it, its waves cancelling the stamp in the cancel ink', async () => {
    const view = await mount({}, isDark);
    await waitFor(() => expect(view.getByTestId('sentPostmark', { includeHiddenElements: true })).toBeTruthy());
    await layOut(view);
    const json = JSON.stringify(view.toJSON());
    expect(json).toContain('ODESLÁNO · DATOVÁ SCHRÁNKA ·');
    expect(json).toContain('11.11.');
    expect(json).toContain('14:02');
    const all = nodes(view.toJSON());
    // The postmark's own waves are left off; the stamp carries them.
    expect(all.some(n => n.props.d === postmarkPrint.waves)).toBe(false);
    const cancel = all.find(n => n.props.d === cancellation.d);
    expect(JSON.stringify(cancel?.props.stroke)).toBe(brush(theme.cancelInk));
  });
});

it('says a free send cost nothing on its stamp, and a paid one what it cost', async () => {
  const free = await mount();
  expect(free.getByText('ZDARMA')).toBeTruthy();
  expect(free.getByText('0 Kč')).toBeTruthy();
  await free.unmount();
  const paid = await mount({ paidCzk: 20 });
  expect(paid.getByText('PLACENÁ')).toBeTruthy();
  expect(paid.getByText('~20 Kč')).toBeTruthy();
});

it('says when ISDS took it, with the preposition Czech gives that hour', () => {
  expect(sentBody(SENT_AT)).toBe(
    'ISDS ji přijalo 11.11.2026 ve 14:02. Až ji adresát otevře, doručenka se doplní sama.',
  );
  expect(sentBody(new Date(2026, 10, 11, 9, 5).getTime())).toMatch(/^ISDS ji přijalo 11\.11\.2026 v 09:05\./);
  setActiveLocale('en');
  expect(sentBody(SENT_AT)).toMatch(/^ISDS accepted it on 11\.11\.2026 at 14:02\./);
});

it('draws only the sending as done until ISDS reports more, the rest as rings still to come', async () => {
  const view = await mount();
  expect(view.getAllByText('zatím ne')).toHaveLength(2);
  expect(view.getByText('až ji adresát otevře')).toBeTruthy();
  const dashed = nodes(view.toJSON()).filter(n => n.type === 'RNSVGCircle' && n.props.strokeDasharray != null);
  expect(dashed).toHaveLength(2);
  expect(dashed.every(n => JSON.stringify(n.props.stroke) === brush(lightTheme.slipMark))).toBe(true);
});

it('fills in what the sent list reports: delivered, then served by fiction', () => {
  const delivered = new Date(2026, 10, 11, 14, 3).getTime();
  const accepted = new Date(2026, 10, 21, 14, 3).getTime();
  const steps = sentSteps(SENT_AT, { deliveryTime: delivered, acceptanceTime: accepted, state: 5 });
  expect(steps.map(s => [s.key, s.ring, s.at])).toEqual([
    ['sent', 'arrived', SENT_AT],
    ['delivered', 'arrived', delivered],
    ['accepted', 'fiction', accepted],
  ]);
  expect(steps[2].label).toBe('send.sent.step.fiction');
  const signed = sentSteps(SENT_AT, { deliveryTime: delivered, acceptanceTime: accepted, state: 6 });
  expect(signed[2].ring).toBe('signed');
  expect(sentSteps(SENT_AT, { deliveryTime: delivered, acceptanceTime: null, state: 4 })[2].ring).toBe('pending');
  expect(recordRing.pendingDash).toBeTruthy();
});

it('lets the centred words and the record head take their width, so Android keeps their last word', async () => {
  const view = await mount();
  const flat = (id: string) => JSON.stringify(view.getByText(id).props.style);
  expect(flat('Zpráva odeslána')).toContain('"alignSelf":"stretch"');
  expect(flat(sentBody(SENT_AT))).toContain('"alignSelf":"stretch"');
  expect(flat('Doručenka')).toMatch(/"flex(Grow)?":1/);
});

it('goes back on "Hotovo" and opens the message on "Ukázat v Odeslaných"', async () => {
  const onDone = jest.fn();
  const onOpenSent = jest.fn();
  const view = await mount({ onDone, onOpenSent });
  await fireEvent.press(view.getByTestId('composeDone'));
  expect(onDone).toHaveBeenCalledTimes(1);
  await fireEvent.press(view.getByLabelText('Ukázat v Odeslaných'));
  expect(onOpenSent).toHaveBeenCalledTimes(1);
});

describe('the sending moment (board Motion 2)', () => {
  const trigger = RNHaptic.trigger as unknown as jest.Mock;
  beforeEach(() => trigger.mockReset());
  afterEach(() => (useReducedMotion as jest.Mock).mockReturnValue(false));

  it('shows the stamp uncancelled first, then lands the postmark with one firm thump', async () => {
    const view = await mount();
    await layOut(view);
    const cancelled = () => nodes(view.toJSON()).some(n => n.props.d === cancellation.d);
    expect(view.queryByTestId('sentPostmark', { includeHiddenElements: true })).toBeNull();
    expect(cancelled()).toBe(false);
    expect(trigger).not.toHaveBeenCalled();
    await waitFor(() => expect(view.getByTestId('sentPostmark', { includeHiddenElements: true })).toBeTruthy());
    expect(cancelled()).toBe(true);
    expect(trigger.mock.calls.map(c => c[0])).toEqual(['impactHeavy']);
  });

  it('keeps the thump under Reduce Motion', async () => {
    (useReducedMotion as jest.Mock).mockReturnValue(true);
    const view = await mount();
    await waitFor(() => expect(view.getByTestId('sentPostmark', { includeHiddenElements: true })).toBeTruthy());
    expect(trigger.mock.calls.map(c => c[0])).toEqual(['impactHeavy']);
  });

  it('ends in plain values React commits itself: everything in place, whole and at full strength', async () => {
    expect(sendMomentEnd(sendMoment(false))).toBe(460);
    const view = await mount();
    const flat = (st: unknown): Record<string, unknown> =>
      Array.isArray(st) ? Object.assign({}, ...st.map(flat)) : ((st ?? {}) as Record<string, unknown>);
    await waitFor(
      () => expect(flat(view.getByTestId('sentPostmark', { includeHiddenElements: true }).props.style).transform).toEqual([{ scale: 1 }]),
      { timeout: 2000 },
    );
    expect(flat(view.getByText('Zpráva odeslána').parent?.parent?.props.style).opacity ?? 1).toBe(1);
  });

  it('lands at 1.06 in 140 ms and rises in 320, ease-out; with Reduce Motion only crossfades', () => {
    expect(sendMoment(false)).toMatchObject({ landMs: 140, landScale: 1.06, landFades: false, riseMs: 320 });
    expect(sendMoment(true)).toMatchObject({ landScale: 1, landFades: true, riseMs: 0, restDelayMs: 0 });
  });
});
