// A sent message in the register (031 I19, board R5 "Sent"): its delivery state at the end of the
// name's line - "Dodáno 11.11." once ISDS delivered it, "Doručeno 25.10." once it was signed for -
// with the postmark glyph only beside a time ISDS certified.

import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { AppThemeProvider } from '../../src/theme/ThemeProvider';
import { darkTheme, lightTheme } from '../../src/theme/theme';
import type { MessageEnvelope } from '../../src/services/isds/types';
import { MESSAGE_STATE } from '../../src/features/messages/state/messageState';
import { SentRegisterRow, sentRowState } from '../../src/features/messages/screens/SentRows';

const NOW = new Date(2026, 10, 13, 9, 0).getTime();
const NOV_11 = new Date(2026, 10, 11, 14, 2).getTime();
const NOV_12 = new Date(2026, 10, 12, 8, 30).getTime();

const sent = (over: Partial<MessageEnvelope> = {}): MessageEnvelope => ({
  id: '4821307',
  subject: 'Žádost o prodloužení lhůty',
  sender: 'Ondřej Dvořák',
  senderAddress: null,
  recipient: 'Finanční úřad pro Lesní kraj',
  recipientAddress: null,
  recipientBoxId: 'fu12ab3',
  deliveryTime: NOV_11,
  acceptanceTime: null,
  state: MESSAGE_STATE.delivered,
  attachmentSize: null,
  ...over,
});

describe('what the end of a sent row says', () => {
  it('Dodáno with its date once ISDS delivered it to the box', () => {
    expect(sentRowState(sent(), NOW)).toEqual({ kind: 'delivered', label: 'Dodáno 11.11.' });
  });

  it('Doručeno with the date it was signed for', () => {
    const m = sent({ state: MESSAGE_STATE.servedBySignIn, acceptanceTime: NOV_12 });
    expect(sentRowState(m, NOW)).toEqual({ kind: 'accepted', label: 'Doručeno 12.11.' });
    expect(sentRowState({ ...m, state: MESSAGE_STATE.read }, NOW)?.kind).toBe('accepted');
  });

  it('Doručeno fikcí with the date the law signed for it', () => {
    const m = sent({ state: MESSAGE_STATE.servedByFiction, acceptanceTime: NOV_12 });
    expect(sentRowState(m, NOW)).toEqual({ kind: 'fiction', label: 'Doručeno fikcí 12.11.' });
  });

  it('falls back to the delivery when ISDS gave no time for the signing', () => {
    const m = sent({ state: MESSAGE_STATE.servedBySignIn, acceptanceTime: null });
    expect(sentRowState(m, NOW)).toEqual({ kind: 'delivered', label: 'Dodáno 11.11.' });
  });

  it('nothing while ISDS has not delivered it, and the stop for one it never will', () => {
    expect(sentRowState(sent({ state: MESSAGE_STATE.stamped, deliveryTime: null }), NOW)).toBeNull();
    expect(sentRowState(sent({ state: MESSAGE_STATE.undeliverable }), NOW)).toEqual({
      kind: 'stop',
      label: 'Nedoručitelné',
    });
  });
});

const row = (message: MessageEnvelope) =>
  render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <SentRegisterRow message={message} now={NOW} showDay onOpen={() => {}} folder="sent" />
    </TamaguiProvider>,
  );

describe('the row', () => {
  it('prints the day, the subject, who it went to and the state', async () => {
    const view = await row(sent());
    expect(view.getByText('11')).toBeTruthy();
    expect(view.getByText('Žádost o prodloužení lhůty')).toBeTruthy();
    expect(view.getByText('Finanční úřad pro Lesní kraj')).toBeTruthy();
    expect(view.getByTestId('sentRowState')).toHaveTextContent('Dodáno 11.11.');
    // The one countdown left in the app: delivered, nobody has signed for it yet.
    expect(view.getByText(/fikce za 8 dní/)).toBeTruthy();
  });

  it('says nothing at the end while the message is still on its way', async () => {
    const view = await row(sent({ state: MESSAGE_STATE.stamped, deliveryTime: null }));
    expect(view.queryByTestId('sentRowState')).toBeNull();
    expect(view.getByTestId('message-4821307').props.accessibilityLabel).toContain('Odesláno');
  });
});

describe('a sent message that was never delivered', () => {
  it.each([
    ['light', false],
    ['dark', true],
  ] as const)('says so in ink on the paper, in %s', async (_, isDark) => {
    // The stop's chip pair is paper on an ink pill; the row has no pill, so its paper was printed on
    // the paper and "Nedoručitelné" could not be read (the I31.1 walk on Obalka_Demo, 2026-11-13).
    const view = await render(
      <TamaguiProvider config={tamaguiConfig} defaultTheme={isDark ? 'dark' : 'light'}>
        <AppThemeProvider isDark={isDark}>
          <SentRegisterRow
            message={sent({ state: MESSAGE_STATE.undeliverable })}
            now={NOW}
            showDay
            onOpen={() => {}}
            folder="sent"
          />
        </AppThemeProvider>
      </TamaguiProvider>,
    );
    const label = view.getByText('Nedoručitelné');
    expect(StyleSheet.flatten(label.props.style).color).toBe((isDark ? darkTheme : lightTheme).text);
  });
});
