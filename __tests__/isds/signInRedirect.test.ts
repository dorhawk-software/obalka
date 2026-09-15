// Telling the portal's sign-in redirect apart from everything else a request can be redirected to
// (018 FR-006, amended 2026-09-15). The wiring into each call is tested with the call: the transport in
// `expiredSession.test.ts`, the large-volume downloads in `files/vodzAttachmentDownloader.test.ts` and
// `files/signedZfoStream.test.ts`.

import {
  isSignInUrl,
  redirectedToSignIn,
} from '../../src/services/isds/signInRedirect';

// The query is abbreviated the way the probe recorded it (018 T006); only the path is read.
const SIGN_IN = 'https://www.datovka-test.gov.cz/as/login?status=NCOO';
const PORTAL_DX = 'https://www.datovka-test.gov.cz/apps/DS/dx';

describe('the portal sign-in page', () => {
  it.each([
    SIGN_IN,
    'https://www.datovka.gov.cz/as/login',
    'https://www.datovka.gov.cz/as/login/',
    'https://www.datovka.gov.cz/as/login#top',
    '/as/login?status=NCOO',
    ' HTTPS://WWW.DATOVKA.GOV.CZ/AS/LOGIN?x=1 ',
    // The operator's old domains still answer (`endpoints.ts`).
    'https://www.mojedatovaschranka.cz/as/login?status=NCOO',
    'https://www.czebox.cz:443/as/login',
  ])('is recognised in %s', url => {
    expect(isSignInUrl(url)).toBe(true);
  });

  it.each([
    PORTAL_DX,
    'https://www.datovka.gov.cz/as/processLogin?type=totp&uri=https://www.datovka.gov.cz/apps/DS/dz',
    'https://www.datovka.gov.cz/as/mepWsStateUpdate2',
    'https://www.datovka.gov.cz/as/loginx',
    'https://www.datovka.gov.cz/apps/DS/dx?next=/as/login',
    'https://ws2.datovka.gov.cz/DS/vodz',
    // A login page anywhere but ISDS - a Wi-Fi gate - is not the box's session ending.
    'http://wifi.hotel.example/as/login?next=https://www.datovka.gov.cz/apps/DS/dx',
    'https://www.datovka.gov.cz.captive.example/as/login',
    'https://notdatovka.gov.cz/as/login',
    '',
    null,
    undefined,
  ])('is not %s', url => {
    expect(isSignInUrl(url)).toBe(false);
  });
});

describe('a request the portal turned away to sign in', () => {
  it('is seen when the redirect was followed, wherever it sits in the trail', () => {
    expect(redirectedToSignIn({ status: 200, urls: [PORTAL_DX, SIGN_IN] })).toBe(true);
    expect(redirectedToSignIn({ status: 200, urls: [SIGN_IN] })).toBe(true);
    expect(
      redirectedToSignIn({ status: 200, urls: [PORTAL_DX, SIGN_IN, 'https://www.datovka.gov.cz/'] }),
    ).toBe(true);
  });

  it('is seen when the redirect came back unfollowed, whatever the header’s case', () => {
    for (const status of [301, 302, 303, 307, 308]) {
      expect(redirectedToSignIn({ status, headers: { location: '/as/login?status=NCOO' } })).toBe(
        true,
      );
    }
    expect(redirectedToSignIn({ status: 302, headers: { Location: SIGN_IN } })).toBe(true);
  });

  it('is not seen in an answer that stayed where it was sent', () => {
    expect(redirectedToSignIn({ status: 200, urls: [PORTAL_DX] })).toBe(false);
    expect(redirectedToSignIn({ status: 200 })).toBe(false);
    expect(redirectedToSignIn({ status: 500, urls: [] })).toBe(false);
  });

  it('is not seen in a redirect somewhere else, or a Location on an answer that is not a redirect', () => {
    expect(
      redirectedToSignIn({ status: 302, headers: { location: 'https://www.datovka.gov.cz/apps/' } }),
    ).toBe(false);
    expect(redirectedToSignIn({ status: 200, headers: { location: SIGN_IN } })).toBe(false);
  });
});
