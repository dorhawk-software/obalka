// Box secrets sealed under the vault key, and the one-time move out of what earlier builds stored
// (001 T028, research R6b).
//
// Walked over the real Vault and the real sealing, with the Keychain and the accounts table faked, so
// what is asserted is what would sit in a Keychain item on a phone - and what a read returns while
// the app is locked, after the phone lost the key, and after a migration was killed halfway.

import {
  InMemoryVaultKeyStorage,
  Vault,
} from '../../src/services/secureStore/vault';
import {
  InMemorySecretItems,
  VaultSecureStore,
} from '../../src/services/secureStore/vaultSecureStore';

const PASSWORD = 'SENTINEL-heslo-ěščř';
const COOKIE = 'IPCZ-X-COOKIE=SENTINEL-session';
const PROMPT = 'Odemknout Obálku';

/** A phone: Keychain for the key, Keychain for the items, an accounts table with a cookie column. */
function phone(opts: { lockOn?: boolean; boxIds?: string[] } = {}) {
  const keyStorage = new InMemoryVaultKeyStorage();
  const items = new InMemorySecretItems();
  const column = new Map<string, string>();
  const boxIds = opts.boxIds ?? ['boxA', 'boxB'];
  let setting = opts.lockOn ?? false;
  const columnClears: string[] = [];
  const legacySessions = {
    legacySessionCookies: async () =>
      [...column.entries()].map(([boxId, sessionCookie]) => ({ boxId, sessionCookie })),
    clearLegacySessionCookie: async (boxId: string) => {
      column.delete(boxId);
      columnClears.push(boxId);
    },
  };
  /** A fresh process over the same storage - what a relaunch is. */
  const launch = () => {
    const vault = new Vault({
      storage: keyStorage,
      lockSetting: {
        read: async () => setting,
        write: async on => {
          setting = on;
        },
      },
    });
    const store = new VaultSecureStore({
      vault,
      items,
      boxIds: async () => boxIds,
      legacySessions,
    });
    return { vault, store };
  };
  return { keyStorage, items, column, columnClears, launch };
}

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

describe('sealed box secrets', () => {
  it('stores a password and a session as seals - the Keychain item never holds the plaintext', async () => {
    const p = phone();
    const { store } = p.launch();
    await store.savePassword('boxA', PASSWORD);
    await store.saveSession('boxB', COOKIE);

    const stored = [...p.items.values.entries()];
    expect(stored.map(([service]) => service).sort()).toEqual([
      'cz.obalka.box.boxA',
      'cz.obalka.session.boxB',
    ]);
    for (const [, value] of stored) {
      expect(value).not.toContain('SENTINEL');
      expect(value.startsWith('obalka-vault-1:')).toBe(true);
    }
    expect(await store.readPassword('boxA')).toEqual({ status: 'found', value: PASSWORD });
    expect(await store.readSession('boxB')).toEqual({ status: 'found', value: COOKIE });
    expect(await store.readSession('boxA')).toEqual({ status: 'absent' });
  });

  it('removing a box deletes both of its items, and only its own', async () => {
    const p = phone();
    const { store } = p.launch();
    await store.savePassword('boxA', PASSWORD);
    await store.saveSession('boxA', COOKIE);
    await store.savePassword('boxB', 'other');
    await store.deleteBox('boxA');
    expect([...p.items.values.keys()]).toEqual(['cz.obalka.box.boxB']);
    expect(await store.readPassword('boxA')).toEqual({ status: 'absent' });
    expect(await store.readSession('boxA')).toEqual({ status: 'absent' });
  });

  it('forgets a session saved as null, so a re-auth without one cannot keep a dead cookie', async () => {
    const { store } = phone().launch();
    await store.saveSession('boxA', COOKIE);
    await store.saveSession('boxA', null);
    expect(await store.readSession('boxA')).toEqual({ status: 'absent' });
  });
});

describe('with the app lock on', () => {
  async function lockedPhone() {
    const p = phone();
    const { vault, store } = p.launch();
    await store.savePassword('boxA', PASSWORD);
    await store.saveSession('boxB', COOKIE);
    expect(await vault.enable(PROMPT)).toBe('enabled');
    vault.lock();
    return { ...p, vault, store };
  }

  it('reads nothing while locked, everything after the unlock, and a refresh adds no prompt', async () => {
    const { vault, store, keyStorage } = await lockedPhone();
    let answer: unknown = null;
    const pending = store.readPassword('boxA').then(read => {
      answer = read;
      return read;
    });
    await flush();
    expect(answer).toBeNull(); // not "absent", not anything: waiting

    expect(await vault.unlock(PROMPT)).toBe('unlocked');
    expect(await pending).toEqual({ status: 'found', value: PASSWORD });
    const prompts = keyStorage.prompts;
    for (let i = 0; i < 10; i++) {
      expect((await store.readSession('boxB')).status).toBe('found');
      expect((await store.readPassword('boxA')).status).toBe('found');
    }
    expect(keyStorage.prompts).toBe(prompts);
  });

  it('answers a read abandoned while locked as unavailable - never absent', async () => {
    const { store } = await lockedPhone();
    const ctrl = new AbortController();
    const pending = store.readSession('boxB', ctrl.signal);
    // Past the migration, which settled long ago, and into the wait for the key: aborting before this
    // flush would only test the migration wait, which answers `unavailable` on its own.
    await flush();
    ctrl.abort();
    expect(await pending).toEqual({ status: 'unavailable' });
  });

  it('moves only the key when the lock is toggled - no stored secret is re-encrypted', async () => {
    const p = phone();
    const { vault, store } = p.launch();
    await store.savePassword('boxA', PASSWORD);
    await store.saveSession('boxB', COOKIE);
    const before = new Map(p.items.values);
    const writesBefore = p.items.log.length;

    await vault.enable(PROMPT);
    await vault.disable();
    await vault.enable(PROMPT);

    expect(p.items.values).toEqual(before);
    expect(p.items.log.length).toBe(writesBefore);
    expect(await store.readPassword('boxA')).toEqual({ status: 'found', value: PASSWORD });
    expect(await store.readSession('boxB')).toEqual({ status: 'found', value: COOKIE });
  });
});

describe('when the phone lost the key', () => {
  it('reads every old secret as lost, says so once, and deletes nothing', async () => {
    const p = phone();
    const first = p.launch();
    await first.store.savePassword('boxA', PASSWORD);
    await first.store.saveSession('boxB', COOKIE);
    await first.vault.enable(PROMPT);

    // The screen lock was removed and set again; the gated key did not survive it.
    p.keyStorage.gated = null;
    const { vault, store } = p.launch();
    const lost = jest.fn();
    store.subscribeLost(lost);
    expect(await vault.unlock(PROMPT)).toBe('unlocked');

    expect(await store.readPassword('boxA')).toEqual({ status: 'lost' });
    expect(await store.readSession('boxB')).toEqual({ status: 'lost' });
    expect(lost).toHaveBeenCalledTimes(2);
    store.acknowledgeLost();
    await store.readPassword('boxA');
    expect(lost).toHaveBeenCalledTimes(2);
    // The items stay: they are not the store's to destroy on a read, and signing in overwrites them.
    expect(p.items.values.size).toBe(2);

    await store.savePassword('boxA', 'new-password');
    expect(await store.readPassword('boxA')).toEqual({ status: 'found', value: 'new-password' });
  });

  it('tells a listener that arrives after the loss at once', async () => {
    const p = phone();
    const first = p.launch();
    await first.store.savePassword('boxA', PASSWORD);
    p.keyStorage.plain = null; // the key is gone; the next use makes a new one
    const { store } = p.launch();
    expect((await store.readPassword('boxA')).status).toBe('lost');
    const late = jest.fn();
    store.subscribeLost(late);
    expect(late).toHaveBeenCalledTimes(1);
  });

  it('reads as lost, not unavailable for ever, when Android lost the Keystore key under the ungated key', async () => {
    // Lock off. The ungated entry survives while the Keystore key that encrypts it does not, so every
    // read of it fails its authentication tag. That used to answer "unavailable" on every read, and
    // no box was ever asked to sign in again.
    const p = phone();
    const first = p.launch();
    await first.store.savePassword('boxA', PASSWORD);
    await first.store.saveSession('boxB', COOKIE);
    p.keyStorage.plainKeyLost = true;

    const { store } = p.launch();
    const lost = jest.fn();
    store.subscribeLost(lost);
    expect(await store.readPassword('boxA')).toEqual({ status: 'lost' });
    expect(await store.readSession('boxB')).toEqual({ status: 'lost' });
    expect(lost).toHaveBeenCalled();
    expect(p.keyStorage.prompts).toBe(0);
    // One new key for the phone, not one per read: a password saved now reads back on a relaunch.
    await store.savePassword('boxA', 'new-password');
    expect(await p.launch().store.readPassword('boxA')).toEqual({
      status: 'found',
      value: 'new-password',
    });
  });

  it('reads every old secret as lost once the lock was set up again over a key that kept failing', async () => {
    // The documented lost-key path, reached on purpose: each box signs in again, and nothing stored is
    // destroyed by a read.
    const p = phone();
    const first = p.launch();
    await first.store.savePassword('boxA', PASSWORD);
    await first.store.saveSession('boxB', COOKIE);
    await first.vault.enable(PROMPT);

    p.keyStorage.gatedReadError = new Error('Wrapped error: Keystore operation failed');
    const { vault, store } = p.launch();
    const lost = jest.fn();
    store.subscribeLost(lost);
    for (let i = 0; i < 3; i++) {
      await vault.unlock(PROMPT);
    }
    expect(await vault.resetKey(PROMPT)).toBe('unlocked');

    expect(await store.readPassword('boxA')).toEqual({ status: 'lost' });
    expect(await store.readSession('boxB')).toEqual({ status: 'lost' });
    expect(lost).toHaveBeenCalled();
    expect(p.items.values.size).toBe(2);
  });
});

describe('a damaged or unreadable item', () => {
  it('reads a damaged seal as absent', async () => {
    const p = phone();
    const { store } = p.launch();
    await store.savePassword('boxA', PASSWORD);
    const sealed = p.items.values.get('cz.obalka.box.boxA') as string;
    p.items.values.set('cz.obalka.box.boxA', sealed.slice(0, -2) + (sealed.endsWith('0') ? '1' : '0'));
    expect(await store.readPassword('boxA')).toEqual({ status: 'absent' });
  });

  it('reads a Keychain that fails as unavailable - the secret may be fine', async () => {
    const p = phone();
    const { store } = p.launch();
    await store.savePassword('boxA', PASSWORD);
    p.items.failWhen = (op, service) => op === 'get' && service === 'cz.obalka.box.boxA';
    expect(await store.readPassword('boxA')).toEqual({ status: 'unavailable' });
  });

  it('reads a password item whose own Keystore key Android lost as lost - that box only, and a Keychain hiccup elsewhere stays unavailable', async () => {
    // Android encrypts each item under a Keystore key of its own. With that key gone and the item
    // still there, every read fails its authentication tag - which used to answer "unavailable" on
    // every read, so the box said "try again" for ever and never asked to be signed in again.
    const p = phone();
    const { store } = p.launch();
    await store.savePassword('boxA', PASSWORD);
    await store.savePassword('boxB', 'pw-B');
    const vaultKey = p.keyStorage.plain?.slice();
    const lost = jest.fn();
    store.subscribeLost(lost);

    p.items.keyLost.add('cz.obalka.box.boxA');
    p.items.failWhen = (op, service) => op === 'get' && service === 'cz.obalka.box.boxB';
    expect(await store.readPassword('boxA')).toEqual({ status: 'lost' });
    expect(await store.readPassword('boxA')).toEqual({ status: 'lost' });
    // A failure that names no lost key proves nothing: once the Keychain answers, the same item reads.
    expect(await store.readPassword('boxB')).toEqual({ status: 'unavailable' });
    expect(await store.readPassword('boxB')).toEqual({ status: 'unavailable' });
    p.items.failWhen = null;
    expect(await store.readPassword('boxB')).toEqual({ status: 'found', value: 'pw-B' });

    // Not the phone losing the vault key: no explanation for every box, no new key, nothing deleted.
    expect(lost).not.toHaveBeenCalled();
    expect(p.keyStorage.plain).toEqual(vaultKey);
    expect(p.items.values.has('cz.obalka.box.boxA')).toBe(true);

    // Signing in again writes the item over, and the box reads it.
    await store.savePassword('boxA', 'new-password');
    expect(await store.readPassword('boxA')).toEqual({ status: 'found', value: 'new-password' });
  });

  it('reads a session item whose own Keystore key Android lost as lost, and leaves the box’s password readable', async () => {
    const p = phone();
    const { store } = p.launch();
    await store.savePassword('boxA', PASSWORD);
    await store.saveSession('boxA', COOKIE);

    p.items.keyLost.add('cz.obalka.session.boxA');
    expect(await store.readSession('boxA')).toEqual({ status: 'lost' });
    expect(await store.readPassword('boxA')).toEqual({ status: 'found', value: PASSWORD });

    await store.saveSession('boxA', 'IPCZ-X-COOKIE=NEW');
    expect(await store.readSession('boxA')).toEqual({ status: 'found', value: 'IPCZ-X-COOKIE=NEW' });
  });
});

describe('moving what earlier builds stored', () => {
  /** A phone as the last pre-vault build left it: plain JSON passwords, cookies in the table. */
  function upgraded(opts: { lockOn?: boolean } = {}) {
    const p = phone(opts);
    p.items.values.set('cz.obalka.box.boxA', JSON.stringify({ password: PASSWORD }));
    p.items.values.set('cz.obalka.box.boxB', JSON.stringify({ password: 'pw-B' }));
    p.column.set('boxB', COOKIE);
    return p;
  }

  it('seals every plain password and cookie, verifies them, then removes the plain copies', async () => {
    const p = upgraded();
    const { store } = p.launch();
    await store.prepare();

    expect(await store.readPassword('boxA')).toEqual({ status: 'found', value: PASSWORD });
    expect(await store.readPassword('boxB')).toEqual({ status: 'found', value: 'pw-B' });
    expect(await store.readSession('boxB')).toEqual({ status: 'found', value: COOKIE });
    for (const value of p.items.values.values()) {
      expect(value.startsWith('obalka-vault-1:')).toBe(true);
    }
    expect([...p.items.values.keys()].some(k => k.endsWith('.plain'))).toBe(false);
    expect(p.column.size).toBe(0); // the column ends up empty

    // The plain copy existed exactly while the seal was being proven.
    expect(p.items.log).toEqual(
      expect.arrayContaining([
        'set cz.obalka.box.boxA.plain',
        'set cz.obalka.box.boxA',
        'remove cz.obalka.box.boxA.plain',
      ]),
    );
    const log = p.items.log;
    expect(log.indexOf('set cz.obalka.box.boxA.plain')).toBeLessThan(log.indexOf('set cz.obalka.box.boxA'));
    expect(log.indexOf('set cz.obalka.box.boxA')).toBeLessThan(log.indexOf('remove cz.obalka.box.boxA.plain'));
  });

  it('does nothing the second time', async () => {
    const p = upgraded();
    await p.launch().store.prepare();
    const writes = p.items.log.length;
    const again = p.launch().store;
    await again.prepare();
    expect(p.items.log.length).toBe(writes);
    expect(await again.readSession('boxB')).toEqual({ status: 'found', value: COOKIE });
  });

  it('keeps a password usable when the sealed write fails, and finishes on the next launch', async () => {
    const p = upgraded();
    // Killed between keeping the plain copy and writing the seal.
    p.items.failWhen = (op, service) => op === 'set' && service === 'cz.obalka.box.boxA';
    const first = p.launch().store;
    await first.prepare();
    expect(p.items.values.get('cz.obalka.box.boxA.plain')).toBe(JSON.stringify({ password: PASSWORD }));
    expect(await first.readPassword('boxA')).toEqual({ status: 'found', value: PASSWORD });

    p.items.failWhen = null;
    const second = p.launch().store;
    await second.prepare();
    expect(await second.readPassword('boxA')).toEqual({ status: 'found', value: PASSWORD });
    expect(p.items.values.has('cz.obalka.box.boxA.plain')).toBe(false);
    expect(p.items.values.get('cz.obalka.box.boxA')?.startsWith('obalka-vault-1:')).toBe(true);
  });

  it('finishes a run killed after the seal was written but before the plain copy went', async () => {
    const p = upgraded();
    p.items.failWhen = (op, service) => op === 'remove' && service === 'cz.obalka.box.boxA.plain';
    await p.launch().store.prepare();
    expect(p.items.values.has('cz.obalka.box.boxA.plain')).toBe(true);

    p.items.failWhen = null;
    const next = p.launch().store;
    await next.prepare();
    expect(p.items.values.has('cz.obalka.box.boxA.plain')).toBe(false);
    expect(await next.readPassword('boxA')).toEqual({ status: 'found', value: PASSWORD });
  });

  it('restores from the plain copy when the seal it left does not open', async () => {
    const p = upgraded();
    // A run that wrote a seal under a key that did not survive, and never removed the copy.
    p.items.values.set('cz.obalka.box.boxA.plain', JSON.stringify({ password: PASSWORD }));
    p.items.values.set('cz.obalka.box.boxA', `obalka-vault-1:${'ab'.repeat(60)}`);
    const { store } = p.launch();
    await store.prepare();
    expect(await store.readPassword('boxA')).toEqual({ status: 'found', value: PASSWORD });
    expect(p.items.values.has('cz.obalka.box.boxA.plain')).toBe(false);
  });

  it('keeps a cookie in the table until its seal reads back, and uses it from there meanwhile', async () => {
    const p = upgraded();
    p.items.failWhen = (op, service) => op === 'set' && service === 'cz.obalka.session.boxB';
    const first = p.launch().store;
    await first.prepare();
    expect(p.column.get('boxB')).toBe(COOKIE);
    expect(await first.readSession('boxB')).toEqual({ status: 'found', value: COOKIE });

    p.items.failWhen = null;
    const second = p.launch().store;
    await second.prepare();
    expect(p.column.size).toBe(0);
    expect(await second.readSession('boxB')).toEqual({ status: 'found', value: COOKIE });
  });

  it('clears the column on the next launch when it was killed after sealing the cookie', async () => {
    const p = upgraded();
    const clear = p.column;
    let refuse = true;
    const first = new VaultSecureStore({
      vault: p.launch().vault,
      items: p.items,
      boxIds: async () => ['boxA', 'boxB'],
      legacySessions: {
        legacySessionCookies: async () =>
          [...clear.entries()].map(([boxId, sessionCookie]) => ({ boxId, sessionCookie })),
        clearLegacySessionCookie: async boxId => {
          if (refuse) {
            throw new Error('database locked');
          }
          clear.delete(boxId);
        },
      },
    });
    await first.prepare();
    expect(clear.get('boxB')).toBe(COOKIE);
    expect(p.items.values.has('cz.obalka.session.boxB')).toBe(true);

    refuse = false;
    const second = p.launch().store;
    await second.prepare();
    expect(p.column.size).toBe(0);
    expect(await second.readSession('boxB')).toEqual({ status: 'found', value: COOKIE });
  });

  it('with the lock on, reads no plain password until the app is unlocked', async () => {
    const p = upgraded({ lockOn: true });
    const { vault, store } = p.launch();
    const gets = jest.spyOn(p.items, 'get');
    const preparing = store.prepare();
    await flush();
    expect(gets).not.toHaveBeenCalled();
    expect(p.column.size).toBe(1);

    expect(await vault.unlock(PROMPT)).toBe('unlocked');
    await preparing;
    expect(p.column.size).toBe(0);
    expect(await store.readPassword('boxA')).toEqual({ status: 'found', value: PASSWORD });
  });

  it('a later password save clears a plain copy a failed migration left behind', async () => {
    const p = upgraded();
    p.items.failWhen = (op, service) => op === 'set' && service === 'cz.obalka.box.boxA';
    const { store } = p.launch();
    await store.prepare();
    p.items.failWhen = null;
    await store.savePassword('boxA', 'changed-on-the-portal');
    expect(p.items.values.has('cz.obalka.box.boxA.plain')).toBe(false);
    // …so the next launch cannot "restore" the old password over the new one.
    const next = p.launch().store;
    await next.prepare();
    expect(await next.readPassword('boxA')).toEqual({
      status: 'found',
      value: 'changed-on-the-portal',
    });
  });

  it('keeps the newer password when a save was killed before it removed an old plain copy', async () => {
    // A failed migration left the plain copy; a re-auth then sealed a new password over the item and
    // died before removing that copy. The next launch finds a seal and a copy that disagree, and the
    // seal is the newer of the two.
    const p = upgraded();
    p.items.failWhen = (op, service) => op === 'set' && service === 'cz.obalka.box.boxA';
    await p.launch().store.prepare();
    expect(p.items.values.has('cz.obalka.box.boxA.plain')).toBe(true);

    p.items.failWhen = (op, service) => op === 'remove' && service === 'cz.obalka.box.boxA.plain';
    const { store } = p.launch();
    await expect(store.savePassword('boxA', 'changed-on-the-portal')).rejects.toThrow();
    expect(p.items.values.has('cz.obalka.box.boxA.plain')).toBe(true);

    p.items.failWhen = null;
    const next = p.launch().store;
    await next.prepare();
    expect(await next.readPassword('boxA')).toEqual({
      status: 'found',
      value: 'changed-on-the-portal',
    });
    expect(p.items.values.has('cz.obalka.box.boxA.plain')).toBe(false);
  });

  it('still uses a table cookie when the launch migration could not run at all', async () => {
    // A Keychain that would not hand over the key at launch stops the migration before it has even
    // listed the table's cookies. Reading every cookie box as having none would sign them all out.
    const p = upgraded();
    p.keyStorage.plainReadError = new Error('keychain busy');
    const { store } = p.launch();
    await store.prepare();
    expect(p.column.get('boxB')).toBe(COOKIE); // nothing moved
    expect(await store.readSession('boxB')).toEqual({ status: 'found', value: COOKIE });

    // A session saved meanwhile empties the column, so the old one cannot come back from there.
    await store.saveSession('boxB', 'IPCZ-X-COOKIE=NEWER');
    expect(p.column.size).toBe(0);
    await store.saveSession('boxB', null);
    expect(await store.readSession('boxB')).toEqual({ status: 'absent' });
  });

  it('answers a read abandoned while the migration waits for the unlock as unavailable', async () => {
    const p = upgraded({ lockOn: true });
    const { store } = p.launch();
    void store.prepare();
    const ctrl = new AbortController();
    const pending = store.readSession('boxB', ctrl.signal);
    await flush();
    ctrl.abort();
    expect(await pending).toEqual({ status: 'unavailable' });
    expect(p.column.get('boxB')).toBe(COOKIE); // and nothing was touched while locked
  });
});

describe('a phone with no box', () => {
  it('discards a key an earlier install left, with the lock off', async () => {
    const p = phone({ boxIds: [] });
    p.keyStorage.gated = new Uint8Array(32).fill(3);
    await p.launch().store.prepare();
    expect(p.keyStorage.gated).toBeNull();
    expect(p.keyStorage.prompts).toBe(0);
  });
});
