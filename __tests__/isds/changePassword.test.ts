// Changing a password box's password through ISDS (030 FR-002).
//
// What goes on the wire matters as much as what comes back: the sign-in is the password the person
// TYPED on the change screen, both passwords are escaped into the body, and the shared cookie jar is
// kept out of it. The answers are the ones ISDS gives: a 401 for a refused current password (captured
// 2026-11-11, the same for a wrong and an expired one), a non-0000 status with ISDS's own sentence
// for a refused new password.

import { IsdsHttpTransport } from '../../src/services/isds/isdsTransport';
import { NoopCookieJar } from '../../src/services/isds/cookieJar';
import { basicAuthHeader } from '../../src/services/isds/httpClient';
import { FakeHttp, ok, passwordInfoResponse } from '../helpers/fakeHttp';

const statusResponse = (code: string, message: string): string =>
  '<?xml version="1.0"?>' +
  '<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/"><SOAP-ENV:Body>' +
  '<p:ChangeISDSPasswordResponse xmlns:p="http://isds.czechpoint.cz/v20">' +
  `<p:dbStatus><p:dbStatusCode>${code}</p:dbStatusCode><p:dbStatusMessage>${message}</p:dbStatusMessage></p:dbStatus>` +
  '</p:ChangeISDSPasswordResponse></SOAP-ENV:Body></SOAP-ENV:Envelope>';

const args = {
  host: 'czebox' as const,
  loginName: 'login1',
  oldPassword: 'Old&Pass1',
  newPassword: 'New<Pass2>',
  signal: new AbortController().signal,
};

describe('IsdsHttpTransport.changePassword', () => {
  it('signs in with the typed current password, escapes both into the body, and keeps the jar out', async () => {
    const http = new FakeHttp().push(
      ok(statusResponse('0000', 'Provedeno úspěšně.')),
      ok(passwordInfoResponse('2027-02-09T09:49:12.000+01:00')),
    );
    await new IsdsHttpTransport(http, new NoopCookieJar()).changePassword(args);
    const [change, info] = http.requests;
    expect(change.url).toBe('https://ws1.datovka-test.gov.cz/DS/DsManage');
    expect(change.headers?.Authorization).toBe(basicAuthHeader('login1', 'Old&Pass1'));
    expect(change.useJar).toBe(false);
    expect(change.body).toContain('<p:dbOldPassword>Old&amp;Pass1</p:dbOldPassword>');
    expect(change.body).toContain('<p:dbNewPassword>New&lt;Pass2&gt;</p:dbNewPassword>');
    // The new date is read with the NEW password - the old one no longer signs in.
    expect(info.headers?.Authorization).toBe(basicAuthHeader('login1', 'New<Pass2>'));
    expect(info.body).toContain('GetPasswordInfo');
  });

  it('returns the new expiry date ISDS gives after the change', async () => {
    const http = new FakeHttp().push(
      ok(statusResponse('0000', 'Provedeno úspěšně.')),
      ok(passwordInfoResponse('2027-02-09T09:49:12.000+01:00')),
    );
    await expect(
      new IsdsHttpTransport(http, new NoopCookieJar()).changePassword(args),
    ).resolves.toEqual({
      type: 'changed',
      passwordExpiresAt: Date.parse('2027-02-09T09:49:12.000+01:00'),
    });
  });

  it('is still changed when the date cannot be read', async () => {
    const http = new FakeHttp().push(ok(statusResponse('0000', 'ok')), ok('', 500));
    await expect(
      new IsdsHttpTransport(http, new NoopCookieJar()).changePassword(args),
    ).resolves.toEqual({ type: 'changed', passwordExpiresAt: null });
  });

  it('reads a 401 as the current password refused', async () => {
    const http = new FakeHttp().push(ok('<html>Authentication required!</html>', 401));
    await expect(
      new IsdsHttpTransport(http, new NoopCookieJar()).changePassword(args),
    ).resolves.toEqual({ type: 'wrongPassword' });
    expect(http.requests).toHaveLength(1);
  });

  it('hands on ISDS’s own sentence when it refuses the new password', async () => {
    const http = new FakeHttp().push(ok(statusResponse('1066', 'Heslo již bylo použito.')));
    await expect(
      new IsdsHttpTransport(http, new NoopCookieJar()).changePassword(args),
    ).resolves.toEqual({ type: 'refused', code: '1066', message: 'Heslo již bylo použito.' });
  });

  it('calls anything else a server fault', async () => {
    const http = new FakeHttp().push(ok('', 503), ok('<not soap'));
    const transport = new IsdsHttpTransport(http, new NoopCookieJar());
    await expect(transport.changePassword(args)).resolves.toEqual({ type: 'serverFault' });
    await expect(transport.changePassword(args)).resolves.toEqual({ type: 'serverFault' });
  });
});
