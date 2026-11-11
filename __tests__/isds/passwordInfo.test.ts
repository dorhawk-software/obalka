// GetPasswordInfo on a refresh (030): the date kept in step with a validity switched on the portal.
// Read like the credit - this box's own credentials, its own session, the shared jar kept out (018).

import { IsdsHttpTransport } from '../../src/services/isds/isdsTransport';
import { NoopCookieJar } from '../../src/services/isds/cookieJar';
import { basicAuthHeader } from '../../src/services/isds/httpClient';
import { FakeHttp, ok, passwordInfoResponse } from '../helpers/fakeHttp';

const base = {
  host: 'czebox' as const,
  loginName: 'login1',
  signal: new AbortController().signal,
};

describe('IsdsHttpTransport.getPasswordInfo', () => {
  it('asks with a password box\'s own Basic sign-in, no cookie, the jar kept out', async () => {
    const http = new FakeHttp().push(ok(passwordInfoResponse('2027-02-09T09:49:12.000+01:00')));
    const result = await new IsdsHttpTransport(http, new NoopCookieJar()).getPasswordInfo({
      ...base,
      authMethod: 'password',
      password: 'pw',
      sessionCookie: null,
    });
    expect(result).toEqual({ type: 'expiry', expiresAt: Date.parse('2027-02-09T09:49:12.000+01:00') });
    const [req] = http.requests;
    expect(req.url).toBe('https://ws1.datovka-test.gov.cz/DS/DsManage');
    expect(req.headers?.Authorization).toBe(basicAuthHeader('login1', 'pw'));
    expect(req.cookie).toBeUndefined();
    expect(req.useJar).toBe(false);
    expect(req.body).toContain('GetPasswordInfo');
  });

  it('asks with an SMS box\'s own session at the portal, and no password', async () => {
    const http = new FakeHttp().push(ok(passwordInfoResponse('')));
    const result = await new IsdsHttpTransport(http, new NoopCookieJar()).getPasswordInfo({
      ...base,
      authMethod: 'otp_totp',
      password: null,
      sessionCookie: 'IPCZ-X-COOKIE=MINE',
    });
    expect(result).toEqual({ type: 'expiry', expiresAt: null });
    const [req] = http.requests;
    expect(req.url).toContain('/apps/DS/DsManage');
    expect(req.cookie).toBe('IPCZ-X-COOKIE=MINE');
    expect(req.headers?.Authorization).toBeUndefined();
    expect(req.useJar).toBe(false);
  });

  it('is a fault - never "no date" - for an answer that is not OK', async () => {
    const http = new FakeHttp().push(ok(passwordInfoResponse('').replace('0000', '1214')));
    await expect(
      new IsdsHttpTransport(http, new NoopCookieJar()).getPasswordInfo({
        ...base,
        authMethod: 'password',
        password: 'pw',
        sessionCookie: null,
      }),
    ).resolves.toEqual({ type: 'serverFault' });
  });
});
