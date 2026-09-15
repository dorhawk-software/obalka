// What ISDS does when a box's session has EXPIRED (reported 2026-08-19).
//
// A missing session was already handled (018). An expired one is a different animal, and the app got
// it wrong in the way that helps the user least:
//
//   ISDS answers a WS call carrying a dead session cookie with **HTTP 200 and a body of pure
//   whitespace** - 26 bytes, no SOAP envelope, no fault, no dmStatus. Captured from a production box.
//
// Read as a server error, that reached the user as "Offline – zobrazeny uložené zprávy." on a phone
// with a working connection, and the one control that fixes it - "Přihlásit se znovu" - is rendered
// only for an auth fault. So the app said something false about the network AND hid the recovery.
//
// The exact bytes matter, which is why they are in the fixture rather than paraphrased.

import { IsdsHttpTransport } from '../../src/services/isds/isdsTransport';
import { NoopCookieJar } from '../../src/services/isds/cookieJar';
import type {
  HttpClient,
  HttpRequest,
  HttpResponse,
} from '../../src/services/isds/httpClient';

/** What the production server actually sent back: whitespace, and a 200. */
const EXPIRED_SESSION_BODY = '            \n            \n';

class StubHttp implements HttpClient {
  readonly sent: HttpRequest[] = [];
  constructor(private readonly res: HttpResponse) {}
  async send(req: HttpRequest): Promise<HttpResponse> {
    this.sent.push(req);
    return this.res;
  }
}

const transport = (res: HttpResponse) =>
  new IsdsHttpTransport(new StubHttp(res), new NoopCookieJar());

const args = (over: Record<string, unknown> = {}) =>
  ({
    host: 'production' as const,
    authMethod: 'otp_totp' as const,
    loginName: 'boxA',
    password: null,
    sessionCookie: 'IPCZ-X-COOKIE=STALE',
    signal: new AbortController().signal,
    ...over,
  } as Parameters<IsdsHttpTransport['listReceivedMessages']>[0]);

const soapFault =
  '<?xml version="1.0"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">' +
  '<soap:Body><soap:Fault><faultstring>server exploded</faultstring></soap:Fault>' +
  '</soap:Body></soap:Envelope>';

describe('an expired cookie session', () => {
  it('is an auth fault, not a server fault - the empty 200 IS the sign-out', async () => {
    const res = await transport({
      status: 200,
      text: EXPIRED_SESSION_BODY,
    }).listReceivedMessages(args());
    expect(res).toEqual({ type: 'authFault' });
  });

  it('is read the same way on the sent list and on a message download', async () => {
    const empty = { status: 200, text: EXPIRED_SESSION_BODY };
    expect(await transport(empty).getSentMessages(args())).toEqual({
      type: 'authFault',
    });
    expect(
      await transport(empty).downloadMessage(
        args({ messageId: '1' }) as Parameters<
          IsdsHttpTransport['downloadMessage']
        >[0],
      ),
    ).toEqual({ type: 'authFault' });
  });

  it('leaves a real SOAP fault a SERVER fault', async () => {
    // The rule is "no XML at all", not "unparseable". A server that answers properly and reports a
    // problem must not be turned into a demand that the user sign in again.
    const res = await transport({
      status: 200,
      text: soapFault,
    }).listReceivedMessages(args());
    expect(res).toEqual({ type: 'serverFault' });
  });

  it('leaves a PASSWORD box’s empty 200 a server fault', async () => {
    // A password box re-authenticates on every call with HTTP Basic and gets a proper 401. An empty
    // 200 there is the server misbehaving; "sign in again" would be a second wrong guess, and its
    // credentials are stored - the user has nothing to re-enter.
    const res = await transport({
      status: 200,
      text: EXPIRED_SESSION_BODY,
    }).listReceivedMessages(
      args({ authMethod: 'password', password: 'pw', sessionCookie: null }),
    );
    expect(res).toEqual({ type: 'serverFault' });
  });

  it('still treats a 500 as a server fault', async () => {
    const res = await transport({
      status: 500,
      text: '',
    }).listReceivedMessages(args());
    expect(res).toEqual({ type: 'serverFault' });
  });
});

// The other way the portal says a session is gone (amended 2026-09-15). `/apps/DS/*` sends a request
// without a session to `as/login?...&status=NCOO` (probed without credentials, 018 T006), and fetch
// follows the redirect - so the call gets the sign-in page as a 200 WITH markup, which the rule above
// cannot see, and parsed it as a server fault.
describe('a cookie session the portal turns away to its sign-in page', () => {
  /** Illustrative, not a capture: no sign-in page body has been recorded, and none is read. */
  const SIGN_IN_PAGE =
    '<!DOCTYPE html><html lang="cs"><head><title>Přihlášení</title></head>' +
    '<body><form method="post"><input name="username"/></form></body></html>';
  const followed: HttpResponse = {
    status: 200,
    text: SIGN_IN_PAGE,
    url: 'https://www.datovka.gov.cz/as/login?status=NCOO',
    headers: { 'content-type': 'text/html;charset=UTF-8' },
  };
  const document = {
    fileName: 'podani.pdf',
    mimeType: 'application/pdf',
    isMain: true,
    contentBase64: 'QUJD',
    sizeBytes: 3,
  };
  const calls: ReadonlyArray<
    readonly [string, (t: IsdsHttpTransport, a: ReturnType<typeof args>) => Promise<{ type: string }>]
  > = [
    ['the received list', (t, a) => t.listReceivedMessages(a as never)],
    ['the sent list', (t, a) => t.getSentMessages(a as never)],
    ['a received download', (t, a) => t.downloadMessage({ ...a, messageId: '1', signedSent: false } as never)],
    ['a sent download', (t, a) => t.downloadMessage({ ...a, messageId: '1', signedSent: true } as never)],
    ['a signed original', (t, a) => t.downloadSignedMessage({ ...a, messageId: '1', signedSent: false } as never)],
    ['marking a message read', (t, a) => t.markMessageAsDownloaded({ ...a, messageId: '1' } as never)],
    ['a recipient search', (t, a) => t.findRecipients({ ...a, query: 'ACME' } as never)],
    [
      'a send',
      (t, a) => t.sendMessage({ ...a, recipientBoxId: 'abc1234', subject: 's', files: [document] } as never),
    ],
    [
      'a large send',
      (t, a) => t.sendBigMessage({ ...a, recipientBoxId: 'abc1234', subject: 's', files: [document] } as never),
    ],
    ['the credit balance', (t, a) => t.getCreditInfo({ ...a, boxId: 'b1' } as never)],
  ];

  it.each(calls)('is an auth fault on %s', async (_call, call) => {
    for (const authMethod of ['otp_totp', 'mobile_key'] as const) {
      expect(await call(transport(followed), args({ authMethod }))).toEqual({ type: 'authFault' });
    }
  });

  it('is an auth fault when the redirect comes back unfollowed', async () => {
    const res = await transport({
      status: 302,
      text: '',
      headers: { location: '/as/login?status=NCOO' },
    }).listReceivedMessages(args());
    expect(res).toEqual({ type: 'authFault' });
  });

  it('is an auth fault only for a cookie box, and only when the call ended on the sign-in page', async () => {
    expect(await transport(followed).listReceivedMessages(args())).toEqual({ type: 'authFault' });
    // A PASSWORD box has no session to renew: the same page there stays a server fault.
    const password = args({ authMethod: 'password', password: 'pw', sessionCookie: null });
    expect(await transport(followed).listReceivedMessages(password)).toEqual({ type: 'serverFault' });
    // Nor is every page a cookie box gets back the sign-in.
    const elsewhere = { ...followed, url: 'https://www.datovka.gov.cz/apps/DS/dx' };
    expect(await transport(elsewhere).listReceivedMessages(args())).toEqual({ type: 'serverFault' });
  });
});
