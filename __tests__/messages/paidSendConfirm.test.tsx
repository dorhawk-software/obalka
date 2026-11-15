// The paid-send question is R2's sheet (031 I40, agreed 2026-11-12): the stamp the send will take on
// its own, the question, what it costs, the box's credit, and the answers. Until 2026-11-15 it was a
// sheet of its own that slid up (I74), with a card glyph and the credit on a sunken panel. That it is
// the shared sheet (a fade and the sheet's own rise) is held by overlayFocus.test's Modal scan.

import type { ReactElement } from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TamaguiProvider } from 'tamagui';
import { tamaguiConfig } from '../../tamagui.config';
import { AppThemeProvider } from '../../src/theme/ThemeProvider';
import { PaidSendConfirm } from '../../src/features/messages/screens/PaidSendConfirm';
import { t } from '../../src/i18n/strings';

const wrap = (ui: ReactElement) =>
  render(
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

const hidden = { includeHiddenElements: true };

const confirm = (props: { busy?: boolean; onSend?: () => void; onCancel?: () => void } = {}) =>
  wrap(
    <PaidSendConfirm
      approxCzk={10}
      balanceCzk={412}
      busy={props.busy ?? false}
      onSend={props.onSend ?? (() => {})}
      onCancel={props.onCancel ?? (() => {})}
    />,
  );

describe('the paid-send question (R2)', () => {
  it('lays the paid stamp on the sheet: PLACENÁ, ~10 Kč and PDZ', async () => {
    const view = await confirm();
    const stamp = view.getByTestId('composeConfirmStamp', hidden);
    expect(stamp).toHaveTextContent(new RegExp(t('send.cost.paid.badge').toLocaleUpperCase('cs')));
    expect(stamp).toHaveTextContent(/~10/);
    expect(stamp).toHaveTextContent(new RegExp(t('send.stamp.paid.kind')));
  });

  it('says the credit as a line under the words, not on a panel', async () => {
    const view = await confirm();
    const balance = view.getByTestId('composeConfirmBalance');
    expect(balance).toHaveTextContent(t('send.confirm.balance', { czk: 412 }));
    expect(balance.parent?.parent?.props.backgroundColor).toBeUndefined();
  });

  it('sends with the filled answer and keeps the question while the send starts', async () => {
    const onSend = jest.fn();
    const onCancel = jest.fn();
    const view = await confirm({ onSend, onCancel });
    fireEvent.press(view.getByTestId('composeConfirmSend'));
    expect(onSend).toHaveBeenCalledTimes(1);

    const busy = await confirm({ busy: true, onCancel });
    fireEvent.press(busy.getAllByTestId('composeConfirmCancel').at(-1) as never);
    expect(onCancel).not.toHaveBeenCalled();
  });
});
