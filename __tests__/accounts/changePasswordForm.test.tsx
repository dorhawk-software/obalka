// The change-password screen (030 US2).

import { act, fireEvent, render, waitFor, within } from '@testing-library/react-native';
import { TamaguiProvider } from 'tamagui';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { tamaguiConfig } from '../../tamagui.config';
import { ChangePasswordForm } from '../../src/features/accounts/screens/ChangePasswordForm';
import type { ChangePasswordOutcome } from '../../src/features/accounts/state/changePassword';
import type { DataBoxAccount } from '../../src/services/isds/types';
import { t } from '../../src/i18n/strings';

const SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const account = {
  boxId: 'b1',
  loginName: 'novak1',
  label: 'Jan Novák',
  alias: null,
  host: 'czebox',
  authMethod: 'password',
  dbType: 'FO',
  passwordExpiresAt: null,
  color: null,
} as unknown as DataBoxAccount;

async function screen(answer: ChangePasswordOutcome) {
  const onSubmit = jest.fn(async () => answer);
  const onDone = jest.fn();
  const onOpenPortal = jest.fn();
  const view = await render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <ChangePasswordForm
          account={account}
          onSubmit={onSubmit}
          onBack={() => {}}
          onDone={onDone}
          onOpenPortal={onOpenPortal}
        />
      </TamaguiProvider>
    </SafeAreaProvider>,
  );
  const type = async (current: string, next: string, repeat = next) => {
    await act(async () => {
      fireEvent.changeText(view.getByTestId('pwd-current'), current);
      fireEvent.changeText(view.getByTestId('pwd-new'), next);
      fireEvent.changeText(view.getByTestId('pwd-repeat'), repeat);
    });
  };
  const press = async (testID: string) => {
    await act(async () => {
      fireEvent.press(view.getByTestId(testID));
    });
  };
  return { view, onSubmit, onDone, onOpenPortal, type, press };
}

describe('ChangePasswordForm', () => {
  it('lists every rule from the start, none met, and ticks them as they are met', async () => {
    const { view, type } = await screen({ kind: 'serverFault' });
    for (const rule of ['length', 'upper', 'lower', 'digit', 'allowed', 'noLogin', 'noTriple', 'noWeakStart', 'match', 'differs']) {
      expect(view.getByTestId(`rule-${rule}-unmet`)).toBeTruthy();
    }
    await type('Old1pass', 'Brand2New!x');
    for (const rule of ['length', 'upper', 'lower', 'digit', 'allowed', 'noLogin', 'noTriple', 'noWeakStart', 'differs', 'match']) {
      expect(view.getByTestId(`rule-${rule}-met`)).toBeTruthy();
    }
  });

  it('does not send until the current password is there, the rules are met and the two match', async () => {
    const { onSubmit, type, press } = await screen({ kind: 'serverFault' });
    await press('submit');
    await type('', 'Brand2New!x');
    await press('submit');
    await type('Old1pass', 'novak1Abc!');
    await press('submit');
    await type('Old1pass', 'Brand2New!x', 'Brand2New!y');
    await press('submit');
    await type('Brand2New!x', 'Brand2New!x');
    await press('submit');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('sends what was typed, and says it is changed with the date it now runs to', async () => {
    const { view, onSubmit, onDone, type, press } = await screen({
      kind: 'changed',
      passwordExpiresAt: new Date(2027, 1, 9, 9, 49).getTime(),
    });
    await type('Old1pass', 'Brand2New!x');
    await press('submit');
    expect(onSubmit).toHaveBeenCalledWith('Old1pass', 'Brand2New!x');
    await waitFor(() => expect(view.getByTestId('pwdChangeDone')).toBeTruthy());
    expect(view.getByText(t('pwdChange.done.until', { date: '9. 2. 2027' }))).toBeTruthy();
    await press('done');
    expect(onDone).toHaveBeenCalled();
  });

  it('says a refused current password may also be an expired one, with the way to the portal', async () => {
    const { view, onOpenPortal, type, press } = await screen({ kind: 'wrongPassword' });
    await type('Old1pass', 'Brand2New!x');
    await press('submit');
    await waitFor(() => expect(view.getByText(t('pwdChange.error.wrongPassword'))).toBeTruthy());
    await press('pwdChangePortal');
    expect(onOpenPortal).toHaveBeenCalled();
    // The typing stays, to be corrected.
    expect(view.getByTestId('pwd-new').props.value).toBe('Brand2New!x');
  });

  it('shows ISDS’s own sentence when it refuses the new password', async () => {
    const { view, type, press } = await screen({ kind: 'refused', message: 'Heslo již bylo použito.' });
    await type('Old1pass', 'Brand2New!x');
    await press('submit');
    await waitFor(() =>
      expect(view.getByText(t('pwdChange.error.refused', { m: 'Heslo již bylo použito.' }))).toBeTruthy(),
    );
    expect(view.queryByTestId('pwdChangePortal')).toBeNull();
  });
});

// Boards R11 (the form) and R8 (its error and done states), 031, agreed 2026-11-12. Before: an outlined
// box with an avatar, an alert-icon banner, loose rules and a tick beside a heading for done.
describe('as the boards draw it', () => {
  it('shows the box as a sheet with its envelope and the lock, as signing in again does', async () => {
    const { view } = await screen({ kind: 'wrongPassword' });
    const box = view.getByTestId('boxSheet');
    expect(within(box).getByTestId('envelopeTile', { includeHiddenElements: true })).toBeTruthy();
    expect(within(box).getByTestId('boxSheetLock', { includeHiddenElements: true })).toBeTruthy();
  });

  it('lists the rules on a sheet, a met one a filled tick, an open one a ring', async () => {
    const { view, type } = await screen({ kind: 'wrongPassword' });
    await type('Old1pass', 'Brand2New!x', 'Brand2');
    expect(view.getByTestId('pwdRules')).toHaveStyle({ borderTopLeftRadius: 14 });
    expect(view.getByTestId('tick-length')).toHaveStyle({ width: 20, height: 20, borderTopLeftRadius: 999 });
    expect(view.getByTestId('ring-match')).toHaveStyle({ width: 20, height: 20, borderTopLeftRadius: 999 });
  });

  it('puts an error in a danger tone block with no icon', async () => {
    const { view, type, press } = await screen({ kind: 'timeout' });
    await type('Old1pass', 'Brand2New!x');
    await press('submit');
    const banner = await view.findByTestId('pwdChangeError');
    expect(banner).toHaveStyle({ backgroundColor: '#F7E4E1', borderTopLeftRadius: 12 });
    expect(within(banner).queryByTestId('alertIcon')).toBeNull();
    expect(within(banner).getByText(t('pwdChange.error.timeout'))).toBeOnTheScreen();
  });

  it('says it is done under the lock at hero size', async () => {
    const { view, type, press } = await screen({ kind: 'changed', passwordExpiresAt: null });
    await type('Old1pass', 'Brand2New!x');
    await press('submit');
    const hero = await view.findByTestId('pwdDoneLock');
    expect(hero).toHaveStyle({ width: 132, height: 132, borderTopLeftRadius: 999 });
  });
});
