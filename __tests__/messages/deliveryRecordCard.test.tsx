// The Doručenka card for a state the app does not recognise (017 T012).
//
// `deliveryRecord.test.ts` proves the record's shape. This file proves what reaches the screen, in
// both locales: an unrecognised state keeps the arrival ISDS reported and prints nothing about
// service - no "Doručeno", no merged row, no fiction. And the other half of the same rule: a genuine
// received message that the store saved with state 0 must not lose its card over it.

import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { AppThemeProvider } from '../../src/theme/ThemeProvider';
import { DeliveryRecordCard } from '../../src/features/messages/screens/DeliveryRecord';
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

describe('DeliveryRecordCard', () => {
  afterEach(() => setActiveLocale('cs'));

  it.each(['cs', 'en'] as const)(
    'shows only the arrival for an unrecognised state carrying both timestamps (%s)',
    async locale => {
      setActiveLocale(locale);
      const view = await wrap(
        <DeliveryRecordCard
          record={deliveryRecord(envelope({ state: 99 }), fmt)}
        />,
      );
      expect(view.getByTestId('deliveryRecord')).toBeTruthy();
      expect(view.getByText(t('recv.head'))).toBeTruthy();
      expect(view.getByText(t('detail.delivered'))).toBeTruthy();
      expect(view.getByText(fmt(DELIVERED_AT))).toBeTruthy();
      // Nothing that would have to be read off the state.
      expect(view.queryByText(t('detail.accepted'))).toBeNull();
      expect(view.queryByText(t('recv.merged'))).toBeNull();
      expect(view.queryByText(t('status.byFiction'))).toBeNull();
      expect(view.queryByText(fmt(ACCEPTED_AT))).toBeNull();
    },
  );

  it('draws no card when an unrecognised state has no arrival time to show', async () => {
    const view = await wrap(
      <DeliveryRecordCard
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
      <DeliveryRecordCard
        record={deliveryRecord(saved as MessageEnvelope, fmt)}
      />,
    );
    expect(view.getByTestId('deliveryRecord')).toBeTruthy();
    expect(view.getByText(fmt(DELIVERED_AT))).toBeTruthy();
    expect(view.queryByText(t('detail.accepted'))).toBeNull();
  });

  it('draws the full card for a served message - so the cases above cannot pass vacuously', async () => {
    const view = await wrap(
      <DeliveryRecordCard record={deliveryRecord(envelope({}), fmt)} />,
    );
    expect(view.getByTestId('deliveryRecord')).toBeTruthy();
    expect(view.getByText(t('detail.delivered'))).toBeTruthy();
    expect(view.getByText(t('detail.accepted'))).toBeTruthy();
  });
});
