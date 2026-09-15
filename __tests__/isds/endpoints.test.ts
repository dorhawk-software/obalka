import {
  appsDfUrl,
  appsDsManageUrl,
  appsDxUrl,
  appsDzUrl,
  appsVodzUrl,
  dfUrl,
  dsManageUrl,
  dxUrl,
  dzUrl,
  hostBase,
  mepLoginUrl,
  mepStateUrl,
  otpHostBase,
  portalUrl,
  processLoginUrl,
  vdzWsUrl,
} from '../../src/services/isds/endpoints';

describe('ISDS endpoints', () => {
  it('uses the czebox test host and production host', () => {
    expect(hostBase('czebox')).toBe('https://ws1.datovka-test.gov.cz');
    expect(hostBase('production')).toBe('https://ws1.datovka.gov.cz');
  });

  it('uses the portal host for OTP', () => {
    expect(otpHostBase('czebox')).toBe('https://www.datovka-test.gov.cz');
    expect(otpHostBase('production')).toBe('https://www.datovka.gov.cz');
  });

  it('sends a user to the portal of the box’s own environment', () => {
    // Where an expired password gets changed and PDZ credit bought - neither of which the app can do.
    // A test login does not exist on the production portal, so a czebox box must never be sent there.
    expect(portalUrl('czebox')).toBe('https://www.datovka-test.gov.cz');
    expect(portalUrl('production')).toBe('https://www.datovka.gov.cz');
  });

  it('builds the /DS/DsManage URL (db_access: login verification)', () => {
    expect(dsManageUrl('czebox')).toBe('https://ws1.datovka-test.gov.cz/DS/DsManage');
    expect(dsManageUrl('production')).toBe(
      'https://ws1.datovka.gov.cz/DS/DsManage',
    );
  });

  it('builds the /DS/dz SOAP service URL (dmOperations: messages)', () => {
    expect(dzUrl('czebox')).toBe('https://ws1.datovka-test.gov.cz/DS/dz');
    expect(dzUrl('production')).toBe('https://ws1.datovka.gov.cz/DS/dz');
  });

  it('builds the SMS-code processLogin URLs on the portal host (uri targets apps/DS/dz)', () => {
    expect(processLoginUrl('czebox', { sendSms: true })).toBe(
      'https://www.datovka-test.gov.cz/as/processLogin?type=totp&sendSms=true&uri=https://www.datovka-test.gov.cz/apps/DS/dz',
    );
    expect(processLoginUrl('czebox')).toBe(
      'https://www.datovka-test.gov.cz/as/processLogin?type=totp&uri=https://www.datovka-test.gov.cz/apps/DS/dz',
    );
  });

  it('builds the post-OTP /apps/DS/DsManage URL on the portal host', () => {
    expect(appsDsManageUrl('czebox')).toBe(
      'https://www.datovka-test.gov.cz/apps/DS/DsManage',
    );
    expect(appsDsManageUrl('production')).toBe(
      'https://www.datovka.gov.cz/apps/DS/DsManage',
    );
  });

  it('builds the VoDZ large-message URL on the separate ws2 host (US3)', () => {
    expect(vdzWsUrl('czebox')).toBe('https://ws2.datovka-test.gov.cz/DS/vodz');
    expect(vdzWsUrl('production')).toBe(
      'https://ws2.datovka.gov.cz/DS/vodz',
    );
  });

  it('builds the cookie-box VoDZ URL on the portal host under /apps, not on ws2', () => {
    // ISDS documents a cookie session only at {portal}/apps/DS/<service>; ws2 is the Basic host.
    expect(appsVodzUrl('czebox')).toBe(
      'https://www.datovka-test.gov.cz/apps/DS/vodz',
    );
    expect(appsVodzUrl('production')).toBe(
      'https://www.datovka.gov.cz/apps/DS/vodz',
    );
  });

  // The gov.cz migration (2026-08-16) is easy to half-undo: the old domains still resolve and still
  // work, so a stray legacy host would pass every functional test and simply keep talking to the
  // retired name until it is switched off. This asserts the whole surface at once.
  it('no endpoint still points at a retired domain', () => {
    const every = [
      hostBase('czebox'),
      hostBase('production'),
      otpHostBase('czebox'),
      otpHostBase('production'),
      dsManageUrl('production'),
      dzUrl('production'),
      dxUrl('production'),
      dfUrl('production'),
      appsDxUrl('production'),
      appsDfUrl('production'),
      appsDzUrl('production'),
      appsDsManageUrl('production'),
      processLoginUrl('production', { sendSms: true }),
      mepLoginUrl('production', 'Obálka'),
      mepStateUrl('production'),
      vdzWsUrl('production'),
      vdzWsUrl('czebox'),
      appsVodzUrl('production'),
      appsVodzUrl('czebox'),
    ].join(' ');
    expect(every).not.toContain('mojedatovaschranka.cz');
    expect(every).not.toContain('czebox.cz');
    expect(every).toContain('datovka.gov.cz');
  });
});
