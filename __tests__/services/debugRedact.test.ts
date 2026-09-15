// The one promise a debug bundle makes that the user cannot verify for themselves.
//
// Everything else about this feature is inspectable: the zip holds plain text, the user can open it,
// and if they can read it they can decide whether to send it. Credentials are the exception, because
// nobody scrolls a five-megabyte log looking for their own password before tapping Share. So the
// guarantee has to hold without being checked, which means it has to be tested here.
//
// The strings below are the shapes THIS codebase produces: `basicAuthHeader()` in httpClient.ts, the
// `IPCZ-X-COOKIE` session from cookieJar.ts, the SOAP fields in soap.ts, the grouped recovery key
// from backupSecret.ts.

import {
  stripCredentials,
  stripCredentialsDeep,
} from '../../src/services/debug/debugRedact';

describe('stripCredentials', () => {
  it('removes HTTP Basic, where the base64 IS the password', () => {
    const raw = 'Authorization: Basic b25kcmVqLnNpbW9uOmh1bnRlcjI=';
    const out = stripCredentials(raw);
    expect(out).not.toContain('b25kcmVqLnNpbW9uOmh1bnRlcjI=');
    expect(out).toContain('Authorization'); // the header still shows it was sent
  });

  it('removes a bearer token', () => {
    expect(stripCredentials('authorization: Bearer eyJhbGciOi.abc.def')).not.toContain('eyJhbGciOi');
  });

  it('removes the ISDS session cookie, which IS a signed-in session', () => {
    const raw = 'Cookie: IPCZ-X-COOKIE=8f3a91bb2c; JSESSIONID=AA01';
    const out = stripCredentials(raw);
    expect(out).not.toContain('8f3a91bb2c');
    expect(out).not.toContain('AA01');
  });

  it('removes a Set-Cookie coming back', () => {
    expect(
      stripCredentials('set-cookie: IPCZ-X-COOKIE=deadbeef; Path=/; HttpOnly'),
    ).not.toContain('deadbeef');
  });

  it('removes a SOAP password field, tag and all', () => {
    const raw = '<dbPassword>Tajn3Heslo!</dbPassword><dbID>c57mi5x</dbID>';
    const out = stripCredentials(raw);
    expect(out).not.toContain('Tajn3Heslo!');
    expect(out).toContain('c57mi5x'); // NOT a credential - a Full bundle is allowed to say which box
  });

  it('removes an OTP, which is a credential for the next 30 seconds', () => {
    expect(stripCredentials('otpCode: 48210937')).not.toContain('48210937');
    expect(stripCredentials('password=hunter2&uri=/apps/DS/dz')).not.toContain('hunter2');
  });

  it('removes a recovery key, which is the backup\'s whole security', () => {
    // The real shape from `backup/recoveryKey.ts`: 20 symbols, 5 groups of 4, no I/L/O/U.
    const key = 'FKPX-9WQ2-7TDM-4RJH-2CVB';
    expect(stripCredentials(`restoring with ${key}`)).not.toContain('FKPX');
    // and the QR payload, which carries the same key with a prefix
    expect(stripCredentials(`scanned OBALKA:${key}`)).not.toContain('2CVB');
  });

  it('does not mistake a message id for a recovery key', () => {
    // The rule is anchored to that alphabet and that length precisely so a Full bundle keeps the
    // identifiers it exists to carry.
    const raw = 'dmID 1234-5678 for box c57mi5x at 2026-09-10';
    expect(stripCredentials(raw)).toBe(raw);
  });

  it('leaves the diagnosis intact', () => {
    // The entire point of a Full bundle. If this test ever starts failing the wrong way, the feature
    // has quietly become a second, worse telemetry.
    const raw =
      '<dmStatusCode>1281</dmStatusCode><dmStatusMessage>Nutno specifikovat typ schránky</dmStatusMessage>';
    expect(stripCredentials(raw)).toBe(raw);
  });
});

describe('stripCredentialsDeep', () => {
  it('empties a key by NAME, whatever its value is', () => {
    // `{password: 12345}` is a number and matches no text rule above.
    const out = stripCredentialsDeep({
      password: 12345,
      sessionCookie: 'IPCZ-X-COOKIE=abc',
      op: 'isds.login',
    }) as Record<string, unknown>;
    expect(out.password).not.toBe(12345);
    expect(String(out.sessionCookie)).not.toContain('abc');
    expect(out.op).toBe('isds.login');
  });

  it('reaches a credential nested inside a structure', () => {
    const out = stripCredentialsDeep({
      request: { headers: { Authorization: 'Basic c2VjcmV0' } },
      list: ['Cookie: IPCZ-X-COOKIE=zzz'],
    });
    const json = JSON.stringify(out);
    expect(json).not.toContain('c2VjcmV0');
    expect(json).not.toContain('zzz');
  });

  it('survives a cycle rather than hanging', () => {
    const a: Record<string, unknown> = { name: 'a' };
    a.self = a;
    expect(() => stripCredentialsDeep(a)).not.toThrow();
  });
});
