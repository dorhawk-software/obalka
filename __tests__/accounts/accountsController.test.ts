import { AccountsController } from '../../src/features/accounts/state/accountsController';
import {
  DuplicateBoxError,
  InMemoryAccountsStore,
} from '../../src/services/db/accountsStore';
import {
  InMemorySecureStore,
  SecureStore,
} from '../../src/services/secureStore/secureStore';
import type { OwnerInfo } from '../../src/services/isds/types';

const owner = (boxId: string, label = 'Box'): OwnerInfo => ({
  boxId,
  label,
  dbType: null,
  passwordExpiresAt: null,
});

function make(secureStore: SecureStore = new InMemorySecureStore()) {
  const accounts = new InMemoryAccountsStore();
  let n = 0;
  const controller = new AccountsController({
    accounts,
    secureStore,
    now: () => 1000,
    genId: () => `id${++n}`,
  });
  return { controller, accounts, secureStore };
}

/** A secure store over a working one, with the listed operations throwing. */
function failingStore(
  inner: SecureStore,
  failing: readonly (keyof SecureStore)[],
): SecureStore {
  const fail = (op: keyof SecureStore) => async () => {
    throw new Error(`keychain down (${op})`);
  };
  return {
    savePassword: failing.includes('savePassword')
      ? fail('savePassword')
      : (boxId, password) => inner.savePassword(boxId, password),
    readPassword: boxId => inner.readPassword(boxId),
    saveSession: failing.includes('saveSession')
      ? fail('saveSession')
      : (boxId, cookie) => inner.saveSession(boxId, cookie),
    readSession: boxId => inner.readSession(boxId),
    deleteBox: failing.includes('deleteBox')
      ? fail('deleteBox')
      : boxId => inner.deleteBox(boxId),
  };
}

const add = (
  controller: AccountsController,
  boxId: string,
  password = 'pw',
  label = 'Box',
) =>
  controller.addAccount({
    loginName: 'u',
    password,
    method: 'password',
    host: 'czebox',
    ownerInfo: owner(boxId, label),
  });

describe('AccountsController', () => {
  it('addAccount persists metadata + secret and returns the account', async () => {
    const { controller, secureStore } = make();
    const acc = await add(controller, 'box1', 'pw', 'ACME');
    expect(acc).toMatchObject({
      id: 'id1',
      boxId: 'box1',
      loginName: 'u',
      label: 'ACME',
      authMethod: 'password',
      secretRef: 'box1',
      createdAt: 1000,
    });
    expect(await controller.listAccounts()).toHaveLength(1);
    expect(await secureStore.readPassword('box1')).toEqual({ status: 'found', value: 'pw' });
    expect(acc.lastSyncedAt).toBeNull(); // not refreshed yet
  });

  it('addAccount stores an optional (trimmed) alias; setAlias updates and clears it', async () => {
    const { controller } = make();
    await controller.addAccount({
      loginName: 'u',
      password: 'pw',
      method: 'password',
      host: 'czebox',
      alias: '  Moje osoba  ',
      ownerInfo: owner('box1', 'Ondřej Šimon'),
    });
    expect((await controller.listAccounts())[0].alias).toBe('Moje osoba'); // trimmed
    await controller.setAlias('box1', 'DPFO');
    expect((await controller.listAccounts())[0].alias).toBe('DPFO');
    await controller.setAlias('box1', '   '); // blank → removed
    expect((await controller.listAccounts())[0].alias).toBeNull();
  });

  it('recordSync stores the timestamp + total/unread message counts', async () => {
    const { controller } = make();
    await add(controller, 'box1', 'pw', 'ACME');
    const base = {
      subject: 's',
      sender: 'x',
      senderAddress: null,
      recipient: null,
      recipientAddress: null,
      recipientBoxId: null,
      acceptanceTime: null,
      attachmentSize: 0,
    };
    const messages = [
      { ...base, id: '1', deliveryTime: 1, state: 6 }, // delivered, unread
      { ...base, id: '2', deliveryTime: 2, state: 7 }, // read
    ];
    await controller.recordSync('box1', messages, 1700);
    const [acc] = await controller.listAccounts();
    expect(acc.lastSyncedAt).toBe(1700);
    expect(acc.messageCount).toBe(2);
    expect(acc.unreadCount).toBe(1);
  });

  it('reauthAccount refreshes the secret AND the auth method without adding a row', async () => {
    const { controller, secureStore } = make();
    await add(controller, 'box1', 'pw', 'ACME'); // added as 'password'
    // The box's OTP was turned off on the portal → re-auth succeeds as password again.
    await controller.reauthAccount('box1', 'newpw', 'password');
    expect(await controller.listAccounts()).toHaveLength(1); // still one box
    expect(await secureStore.readPassword('box1')).toEqual({ status: 'found', value: 'newpw' });

    // And the reverse: a box that gained OTP re-auths as otp_totp → method is persisted.
    await controller.reauthAccount('box1', 'newpw', 'otp_totp');
    expect((await controller.listAccounts())[0].authMethod).toBe('otp_totp');
  });

  it('persists a sync-failure flag and clears it on the next successful sync', async () => {
    const { controller } = make();
    await add(controller, 'box1', 'pw', 'ACME');
    await controller.recordSyncFailure('box1', 'reauth');
    expect((await controller.listAccounts())[0].syncError).toBe('reauth'); // survives in the store
    await controller.recordSync('box1', [], 2000); // a success clears it
    expect((await controller.listAccounts())[0].syncError).toBeNull();
  });

  it('persists an expired-password flag the same way (001 FR-009)', async () => {
    // Refresh-all skips a flagged box after a restart only if the flag comes back as it was stored.
    const { controller } = make();
    await add(controller, 'box1', 'pw', 'ACME');
    await controller.recordSyncFailure('box1', 'passwordExpired');
    expect((await controller.listAccounts())[0].syncError).toBe('passwordExpired');
  });

  it('rejects a duplicate box without overwriting the existing secret', async () => {
    const { controller, secureStore } = make();
    await add(controller, 'box1', 'pw');
    await expect(add(controller, 'box1', 'pw2')).rejects.toBeInstanceOf(
      DuplicateBoxError,
    );
    expect(await secureStore.readPassword('box1')).toEqual({ status: 'found', value: 'pw' });
  });

  it('rolls back the account row if storing the secret fails', async () => {
    const { controller } = make(failingStore(new InMemorySecureStore(), ['savePassword']));
    await expect(add(controller, 'box1')).rejects.toThrow('keychain down');
    expect(await controller.listAccounts()).toHaveLength(0);
  });

  it('rolls back the row AND the stored password when the session cannot be stored (001 T028)', async () => {
    // Since the session moved into the secure store it is a second write that can fail after the
    // first succeeded. A box left with a row gone and a password still sealed is a secret nobody
    // can reach or remove from the app.
    const inner = new InMemorySecureStore();
    const { controller } = make(failingStore(inner, ['saveSession']));
    await expect(
      controller.addAccount({
        loginName: 'u',
        password: 'pw',
        method: 'otp_totp',
        host: 'production',
        ownerInfo: owner('boxA', 'A'),
        sessionCookie: 'IPCZ-X-COOKIE=AAA',
      }),
    ).rejects.toThrow('keychain down');
    expect(await controller.listAccounts()).toHaveLength(0);
    expect(await inner.readPassword('boxA')).toEqual({ status: 'absent' });
  });

  it('removeAccount drops the row and purges the secret', async () => {
    const { controller, secureStore } = make();
    await add(controller, 'box1');
    await controller.removeAccount('box1');
    expect(await controller.listAccounts()).toHaveLength(0);
    expect(await secureStore.readPassword('box1')).toEqual({ status: 'absent' });
  });
});

// A box's ISDS session is a bearer credential: holding it is being signed in as that box (018).
// These cover where it is written, replaced and destroyed - the parts a wire test cannot see. Since
// 001 T028 that place is the secure store, sealed beside the password, and never the accounts row.
describe('per-box session storage', () => {
  it('stores the session the login established, against that box', async () => {
    const { controller, accounts, secureStore } = make();
    await controller.addAccount({
      loginName: 'u',
      password: 'pw',
      method: 'otp_totp',
      host: 'production',
      ownerInfo: owner('boxA', 'A'),
      sessionCookie: 'IPCZ-X-COOKIE=AAA',
    });
    expect(await secureStore.readSession('boxA')).toEqual({
      status: 'found',
      value: 'IPCZ-X-COOKIE=AAA',
    });
    expect(JSON.stringify(await accounts.list())).not.toContain('IPCZ-X-COOKIE=AAA');
  });

  it('keeps two boxes’ sessions apart', async () => {
    // The whole feature in one assertion: adding B must not touch A.
    const { controller, secureStore } = make();
    for (const [boxId, cookie] of [
      ['boxA', 'IPCZ-X-COOKIE=AAA'],
      ['boxB', 'IPCZ-X-COOKIE=BBB'],
    ] as const) {
      await controller.addAccount({
        loginName: 'u',
        password: 'pw',
        method: 'otp_totp',
        host: 'production',
        ownerInfo: owner(boxId, boxId),
        sessionCookie: cookie,
      });
    }
    expect(await secureStore.readSession('boxA')).toEqual({
      status: 'found',
      value: 'IPCZ-X-COOKIE=AAA',
    });
    expect(await secureStore.readSession('boxB')).toEqual({
      status: 'found',
      value: 'IPCZ-X-COOKIE=BBB',
    });
  });

  it('a password box stores no session at all', async () => {
    const { controller, secureStore } = make();
    await add(controller, 'boxP');
    expect(await secureStore.readSession('boxP')).toEqual({ status: 'absent' });
  });

  it('re-auth REPLACES the dead session rather than leaving it', async () => {
    const { controller, secureStore } = make();
    await controller.addAccount({
      loginName: 'u',
      password: 'pw',
      method: 'otp_totp',
      host: 'production',
      ownerInfo: owner('boxA', 'A'),
      sessionCookie: 'IPCZ-X-COOKIE=OLD',
    });
    await controller.reauthAccount(
      'boxA',
      'pw',
      'otp_totp',
      null,
      'IPCZ-X-COOKIE=NEW',
    );
    // Keeping the old one would leave the box holding the very cookie that stopped working.
    expect(await secureStore.readSession('boxA')).toEqual({
      status: 'found',
      value: 'IPCZ-X-COOKIE=NEW',
    });
  });

  it('re-auth as a password box forgets the session it no longer has', async () => {
    const { controller, secureStore } = make();
    await controller.addAccount({
      loginName: 'u',
      password: 'pw',
      method: 'otp_totp',
      host: 'production',
      ownerInfo: owner('boxA', 'A'),
      sessionCookie: 'IPCZ-X-COOKIE=OLD',
    });
    await controller.reauthAccount('boxA', 'pw', 'password');
    expect(await secureStore.readSession('boxA')).toEqual({ status: 'absent' });
  });

  it('removing a box destroys its session', async () => {
    const { controller, accounts, secureStore } = make();
    await controller.addAccount({
      loginName: 'u',
      password: 'pw',
      method: 'otp_totp',
      host: 'production',
      ownerInfo: owner('boxA', 'A'),
      sessionCookie: 'IPCZ-X-COOKIE=AAA',
    });
    await controller.removeAccount('boxA');
    expect((await accounts.list()).find(a => a.boxId === 'boxA')).toBeUndefined();
    expect(await secureStore.readSession('boxA')).toEqual({ status: 'absent' });
    expect(await secureStore.readPassword('boxA')).toEqual({ status: 'absent' });
  });

  it('removing a box leaves the box that remains its own session', async () => {
    const { controller, accounts, secureStore } = make();
    for (const [boxId, cookie] of [
      ['boxA', 'IPCZ-X-COOKIE=AAA'],
      ['boxB', 'IPCZ-X-COOKIE=BBB'],
    ] as const) {
      await controller.addAccount({
        loginName: boxId,
        password: 'pw',
        method: 'otp_totp',
        host: 'production',
        ownerInfo: owner(boxId, boxId),
        sessionCookie: cookie,
      });
    }
    await controller.removeAccount('boxA');
    const left = await accounts.list();
    expect(left.map(a => a.boxId)).toEqual(['boxB']);
    expect(await secureStore.readSession('boxB')).toEqual({
      status: 'found',
      value: 'IPCZ-X-COOKIE=BBB',
    });
    expect(await secureStore.readPassword('boxB')).toEqual({ status: 'found', value: 'pw' });
  });
});
