// Changing a box's password from the app (030 US2): what is stored, and when.

import { changeBoxPassword } from '../../src/features/accounts/state/changePassword';
import { AccountsController } from '../../src/features/accounts/state/accountsController';
import { InMemoryAccountsStore } from '../../src/services/db/accountsStore';
import { InMemorySecureStore } from '../../src/services/secureStore/secureStore';
import {
  TransportNetworkError,
  TransportTimeoutError,
  type ChangePasswordResult,
  type PasswordChanger,
} from '../../src/services/isds/transport';

const NEW_DATE = Date.UTC(2027, 1, 9, 8, 49);

async function setup(answer: ChangePasswordResult | Error) {
  const secureStore = new InMemorySecureStore();
  const accounts = new InMemoryAccountsStore();
  const accountsController = new AccountsController({ accounts, secureStore });
  await accountsController.addAccount({
    loginName: 'novak',
    password: 'Stored1pass',
    method: 'password',
    host: 'czebox',
    ownerInfo: { boxId: 'b1', label: 'Box', dbType: 'FO', passwordExpiresAt: Date.UTC(2026, 10, 15) },
  });
  const calls: Parameters<PasswordChanger['changePassword']>[0][] = [];
  const changer: PasswordChanger = {
    changePassword: async args => {
      calls.push(args);
      if (answer instanceof Error) {
        throw answer;
      }
      return answer;
    },
  };
  const [account] = await accountsController.listAccounts();
  const run = () =>
    changeBoxPassword(
      { changer, accounts: accountsController },
      account,
      'Typed1pass',
      'Brand2New!x',
      new AbortController().signal,
    );
  return { run, calls, secureStore, accountsController };
}

describe('changeBoxPassword', () => {
  it('sends the TYPED current password, not the stored one', async () => {
    const { run, calls } = await setup({ type: 'changed', passwordExpiresAt: NEW_DATE });
    await run();
    expect(calls[0]).toMatchObject({
      host: 'czebox',
      loginName: 'novak',
      oldPassword: 'Typed1pass',
      newPassword: 'Brand2New!x',
    });
  });

  it('stores the new password and the new date once ISDS has changed it', async () => {
    const { run, secureStore, accountsController } = await setup({
      type: 'changed',
      passwordExpiresAt: NEW_DATE,
    });
    await expect(run()).resolves.toEqual({ kind: 'changed', passwordExpiresAt: NEW_DATE });
    expect(await secureStore.readPassword('b1')).toEqual({ status: 'found', value: 'Brand2New!x' });
    const [box] = await accountsController.listAccounts();
    expect(box.passwordExpiresAt).toBe(NEW_DATE);
    expect(box.authMethod).toBe('password');
  });

  it.each([
    [{ type: 'wrongPassword' } as const, { kind: 'wrongPassword' }],
    [{ type: 'refused', code: '1066', message: 'Heslo již bylo použito.' } as const, { kind: 'refused', message: 'Heslo již bylo použito.' }],
    [{ type: 'serverFault' } as const, { kind: 'serverFault' }],
    [new TransportNetworkError(), { kind: 'network' }],
    [new TransportTimeoutError(), { kind: 'timeout' }],
    [new Error('boom'), { kind: 'serverFault' }],
  ])('stores nothing when ISDS answers %j', async (answer, outcome) => {
    const { run, secureStore, accountsController } = await setup(answer);
    await expect(run()).resolves.toEqual(outcome);
    expect(await secureStore.readPassword('b1')).toEqual({ status: 'found', value: 'Stored1pass' });
    const [box] = await accountsController.listAccounts();
    expect(box.passwordExpiresAt).toBe(Date.UTC(2026, 10, 15));
  });

  it('says the password is changed but not saved when the store refuses', async () => {
    const { run, accountsController } = await setup({ type: 'changed', passwordExpiresAt: NEW_DATE });
    jest.spyOn(accountsController, 'reauthAccount').mockRejectedValueOnce(new Error('keychain'));
    await expect(run()).resolves.toEqual({ kind: 'notSaved' });
  });
});
