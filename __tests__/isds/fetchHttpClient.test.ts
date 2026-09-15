// What `FetchHttpClient` hands the transport about where an answer came from (018 FR-006, amended
// 2026-09-15).
//
// Native fetch follows a redirect on its own. When the portal sends a cookie box's call to its sign-in
// page, the only trace left in JS is the URL that finally answered - so the client must pass it on, and
// must not invent one when the platform reports none, which would claim no redirect happened.

import { FetchHttpClient } from '../../src/services/isds/httpClient';

const PORTAL_DX = 'https://www.datovka.gov.cz/apps/DS/dx';
const SIGN_IN = 'https://www.datovka.gov.cz/as/login?status=NCOO';

function answer(url: string) {
  return {
    status: 200,
    url,
    headers: new Map([['Content-Type', 'text/html']]),
    text: async () => '<html></html>',
  };
}

const realFetch = global.fetch;
afterEach(() => {
  global.fetch = realFetch;
});

const send = () =>
  new FetchHttpClient().send({
    url: PORTAL_DX,
    method: 'POST',
    body: '<soap/>',
    cookie: 'IPCZ-X-COOKIE=AAA',
    useJar: false,
    signal: new AbortController().signal,
  });

describe('FetchHttpClient', () => {
  it('passes on the URL that finally answered after a redirect, and none when the platform reports none', async () => {
    global.fetch = jest.fn(async () => answer(SIGN_IN)) as unknown as typeof fetch;
    const res = await send();
    expect(res).toMatchObject({ status: 200, url: SIGN_IN, headers: { 'content-type': 'text/html' } });
    // Left out rather than filled with the request's URL, which would claim no redirect happened.
    global.fetch = jest.fn(async () => answer('')) as unknown as typeof fetch;
    expect((await send()).url).toBeUndefined();
  });
});
