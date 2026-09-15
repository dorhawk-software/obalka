import { IsdsHttpTransport } from '../../src/services/isds/isdsTransport';
import { NoopCookieJar } from '../../src/services/isds/cookieJar';
import { TransportNetworkError } from '../../src/services/isds/transport';
import { base64 } from '../../src/services/isds/httpClient';
import { IsdsAuthService } from '../../src/features/accounts/state/authService';
import {
  FakeHttp,
  ok,
  ownerInfoResponse,
  passwordInfoResponse,
} from '../helpers/fakeHttp';
import { liveSignal } from '../helpers/fakeTransport';
import * as telemetry from '../../src/services/telemetry/telemetry';
import * as soap from '../../src/services/isds/soap';
import {
  messageXml,
  signedData,
  signedDownloadResponse,
  toBase64,
  utf8,
} from '../helpers/signedFixtures';

const pwArgs = () => ({
  loginName: 'user',
  password: 'pw',
  host: 'czebox' as const,
  signal: liveSignal(),
});

describe('IsdsHttpTransport - password', () => {
  it('success: POSTs Basic-auth SOAP to /DS/DsManage, returns ownerInfo + password expiry', async () => {
    const http = new FakeHttp().push(
      ok(ownerInfoResponse({ boxId: 'box0001', firmName: 'ACME' })),
      ok(passwordInfoResponse('2026-09-10T00:00:00')),
    );
    const t = new IsdsHttpTransport(http, new NoopCookieJar());
    const r = await t.passwordLogin(pwArgs());

    expect(r).toEqual({
      type: 'success',
      ownerInfo: {
        boxId: 'box0001',
        label: 'ACME',
        dbType: null,
        passwordExpiresAt: Date.parse('2026-09-10T00:00:00'),
      },
    });
    const req = http.requests[0];
    expect(req.url).toBe('https://ws1.datovka-test.gov.cz/DS/DsManage');
    expect(req.method).toBe('POST');
    expect(req.headers?.Authorization).toMatch(/^Basic /);
    expect(req.body).toContain('<p:GetOwnerInfoFromLogin>');
    // second call fetches password info (best-effort enrichment)
    expect(http.requests[1].body).toContain('<p:GetPasswordInfo>');
  });

  it('tolerates a failing password-info lookup (login still succeeds, expiry null)', async () => {
    const http = new FakeHttp().push(
      ok(ownerInfoResponse({ boxId: 'box0002', firmName: 'Beta' })),
      ok('', 500), // GetPasswordInfo fails
    );
    expect(await new IsdsHttpTransport(http, new NoopCookieJar()).passwordLogin(pwArgs())).toEqual({
      type: 'success',
      ownerInfo: { boxId: 'box0002', label: 'Beta', dbType: null, passwordExpiresAt: null },
    });
  });

  it('401 -> authFault', async () => {
    const t = new IsdsHttpTransport(new FakeHttp().push(ok('', 401)), new NoopCookieJar());
    expect(await t.passwordLogin(pwArgs())).toEqual({ type: 'authFault' });
  });

  it('5xx -> serverFault', async () => {
    const t = new IsdsHttpTransport(new FakeHttp().push(ok('', 503)), new NoopCookieJar());
    expect(await t.passwordLogin(pwArgs())).toEqual({ type: 'serverFault' });
  });

  it('non-0000 dbStatusCode -> serverFault', async () => {
    const http = new FakeHttp().push(
      ok(ownerInfoResponse({ statusCode: '1227' })),
    );
    expect(await new IsdsHttpTransport(http, new NoopCookieJar()).passwordLogin(pwArgs())).toEqual({
      type: 'serverFault',
    });
  });

  it('propagates a thrown network error (AuthService maps it)', async () => {
    const http = new FakeHttp().push(new TransportNetworkError());
    await expect(
      new IsdsHttpTransport(http, new NoopCookieJar()).passwordLogin(pwArgs()),
    ).rejects.toBeInstanceOf(TransportNetworkError);
  });
});

describe('IsdsHttpTransport - OTP (validated against czebox)', () => {
  it('otpBegin (TOTP) POSTs DummyOperation to the portal sendSms URL -> otpSmsSent', async () => {
    const http = new FakeHttp().push(ok('', 302)); // ISDS returns 302 + totpSended
    const r = await new IsdsHttpTransport(http, new NoopCookieJar()).otpBegin({
      ...pwArgs(),
      method: 'otp_totp',
    });
    expect(r).toEqual({ type: 'otpSmsSent' });
    expect(http.requests[0].url).toBe(
      'https://www.datovka-test.gov.cz/as/processLogin?type=totp&sendSms=true&uri=https://www.datovka-test.gov.cz/apps/DS/dz',
    );
    expect(http.requests[0].body).toContain('<p:DummyOperation>');
  });

  it('otpBegin captures the ISDS notice (code + decoded text) from the response headers', async () => {
    const http = new FakeHttp().push(
      ok('', 302, {
        'x-response-message-code': 'authentication.info.totpSended',
        'x-response-message-text':
          '=?UTF-8?B?SmVkbm9yw6F6b3bDvSBrw7NkIG9kZXNsw6FuLg==?=',
      }),
    );
    const r = await new IsdsHttpTransport(http, new NoopCookieJar()).otpBegin({
      ...pwArgs(),
      method: 'otp_totp',
    });
    expect(r).toEqual({
      type: 'otpSmsSent',
      notice: {
        code: 'authentication.info.totpSended',
        text: 'Jednorázový kód odeslán.',
      },
    });
  });

  it('otpBegin 401 -> authFault', async () => {
    const t = new IsdsHttpTransport(new FakeHttp().push(ok('', 401)), new NoopCookieJar());
    expect(await t.otpBegin({ ...pwArgs(), method: 'otp_totp' })).toEqual({
      type: 'authFault',
    });
  });

  it('otpSubmit success: processLogin (code appended to password) then cookie-auth owner-info', async () => {
    const http = new FakeHttp().push(
      ok('', 302), // processLogin sets the session cookie (handled by the native cookie store)
      ok(ownerInfoResponse({ boxId: 'box0009' })),
    );
    const r = await new IsdsHttpTransport(http, new NoopCookieJar()).otpSubmit({
      loginName: 'u',
      password: 'p',
      code: '123456',
      method: 'otp_totp',
      host: 'czebox',
      signal: liveSignal(),
    });
    expect(r).toMatchObject({
      type: 'success',
      ownerInfo: { boxId: 'box0009' },
    });
    // 1) processLogin on the portal host; the OTP code is appended to the Basic password.
    expect(http.requests[0].url).toBe(
      'https://www.datovka-test.gov.cz/as/processLogin?type=totp&uri=https://www.datovka-test.gov.cz/apps/DS/dz',
    );
    expect(http.requests[0].headers?.Authorization).toBe(
      'Basic ' + base64('u:p123456'),
    );
    expect(http.requests[0].body).toContain('<p:DummyOperation>');
    // 2) owner-info under /apps with the session cookie (no Basic header).
    expect(http.requests[1].url).toBe('https://www.datovka-test.gov.cz/apps/DS/DsManage');
    expect(http.requests[1].headers?.Authorization).toBeUndefined();
  });

  it('otpSubmit with a bad code (owner-info not authorized) -> otpFault', async () => {
    const http = new FakeHttp().push(ok('', 302), ok('', 401));
    const r = await new IsdsHttpTransport(http, new NoopCookieJar()).otpSubmit({
      loginName: 'u',
      password: 'p',
      code: 'wrong',
      method: 'otp_totp',
      host: 'czebox',
      signal: liveSignal(),
    });
    expect(r).toEqual({ type: 'otpFault' });
    // The code goes to the SMS-code processLogin URL.
    expect(http.requests[0].url).toBe(
      'https://www.datovka-test.gov.cz/as/processLogin?type=totp&uri=https://www.datovka-test.gov.cz/apps/DS/dz',
    );
  });
});

describe('IsdsHttpTransport - Mobile Key (Mobilní klíč)', () => {
  const mkArgs = () => ({
    loginName: 'u',
    communicationCode: 'CODE-123',
    applicationName: 'Obalka',
    host: 'czebox' as const,
    signal: liveSignal(),
  });

  it('mepBegin POSTs type=mep-ws with Basic(login:communicationCode) -> pending', async () => {
    const http = new FakeHttp().push(ok('', 302)); // 302 + S-COOKIE (native jar)
    const r = await new IsdsHttpTransport(http, new NoopCookieJar()).mepBegin(mkArgs());
    expect(r).toEqual({ type: 'pending' });
    expect(http.requests[0].url).toBe(
      'https://www.datovka-test.gov.cz/as/processLogin?type=mep-ws&applicationName=Obalka&uri=https://www.datovka-test.gov.cz/apps/DS/dz',
    );
    expect(http.requests[0].headers?.Authorization).toBe(
      'Basic ' + base64('u:CODE-123'),
    );
  });

  it('mepBegin 401 (wrong communication code) -> authFault', async () => {
    const t = new IsdsHttpTransport(new FakeHttp().push(ok('', 401)), new NoopCookieJar());
    expect(await t.mepBegin(mkArgs())).toEqual({ type: 'authFault' });
  });

  it('mepPoll GETs mepWsStateUpdate2 and parses {status, description}', async () => {
    const http = new FakeHttp().push(
      ok('{"status":11,"description":"Push notifikace odeslana"}'),
    );
    const r = await new IsdsHttpTransport(http, new NoopCookieJar()).mepPoll({
      host: 'czebox',
      signal: liveSignal(),
    });
    expect(r).toEqual({
      type: 'state',
      status: 11,
      description: 'Push notifikace odeslana',
    });
    expect(http.requests[0].url).toBe(
      'https://www.datovka-test.gov.cz/as/mepWsStateUpdate2',
    );
    expect(http.requests[0].method).toBe('GET');
  });

  it('mepPoll non-200 or unparseable body -> serverFault', async () => {
    const bad = new IsdsHttpTransport(new FakeHttp().push(ok('not json', 200)), new NoopCookieJar());
    expect(await bad.mepPoll({ host: 'czebox', signal: liveSignal() })).toEqual({
      type: 'serverFault',
    });
    const err = new IsdsHttpTransport(new FakeHttp().push(ok('', 500)), new NoopCookieJar());
    expect(await err.mepPoll({ host: 'czebox', signal: liveSignal() })).toEqual({
      type: 'serverFault',
    });
  });

  it('mepConfirm posts type=mep-ws again then cookie-auths owner-info -> success', async () => {
    const http = new FakeHttp().push(
      ok('', 302), // sets IPCZ-X-COOKIE (native jar)
      ok(ownerInfoResponse({ boxId: 'box0042' })),
    );
    const r = await new IsdsHttpTransport(http, new NoopCookieJar()).mepConfirm(mkArgs());
    expect(r).toMatchObject({
      type: 'success',
      ownerInfo: { boxId: 'box0042' },
    });
    expect(http.requests[0].url).toContain('type=mep-ws');
    // owner-info under /apps with the session cookie (no Basic header).
    expect(http.requests[1].url).toBe('https://www.datovka-test.gov.cz/apps/DS/DsManage');
    expect(http.requests[1].headers?.Authorization).toBeUndefined();
  });
});

const messageDownloadResponse = (statusCode = '0000'): string =>
  '<?xml version="1.0"?>' +
  '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" ' +
  'xmlns:p="http://isds.czechpoint.cz/v20"><soapenv:Body>' +
  '<p:MessageDownloadResponse><p:dmReturnedMessage>' +
  '<p:dmDm><p:dmID>55</p:dmID><p:dmAnnotation>Faktura</p:dmAnnotation>' +
  '<p:dmSender>ČSSZ</p:dmSender><p:dmFiles>' +
  '<p:dmFile dmFileDescr="Faktura.pdf" dmMimeType="application/pdf" dmFileMetaType="main">' +
  '<p:dmEncodedContent>JVBERi0=</p:dmEncodedContent></p:dmFile></p:dmFiles></p:dmDm>' +
  '</p:dmReturnedMessage>' +
  `<p:dmStatus><p:dmStatusCode>${statusCode}</p:dmStatusCode></p:dmStatus>` +
  '</p:MessageDownloadResponse></soapenv:Body></soapenv:Envelope>';

const dlArgs = (overrides: Record<string, unknown> = {}) => ({
  host: 'czebox' as const,
  authMethod: 'password' as const,
  sessionCookie: null,
  loginName: 'user',
  password: 'pw',
  messageId: '55',
  signal: liveSignal(),
  ...overrides,
});

/** A received message's signed original, as SignedMessageDownload carries it (004 amendment). */
const signedOriginal = (id = '55'): string =>
  toBase64(
    signedData(
      messageXml({
        id,
        subject: 'Faktura',
        sender: 'ČSSZ',
        files: [{ name: 'Faktura.pdf', base64: 'JVBERi0=' }],
      }),
    ),
  );

const transportOver = (http: FakeHttp) => new IsdsHttpTransport(http, new NoopCookieJar());

describe('IsdsHttpTransport - downloadMessage', () => {
  it('password box: Basic-auth POST of SignedMessageDownload to /DS/dz -> detail + the signed original', async () => {
    const signature = signedOriginal();
    const http = new FakeHttp().push(ok(signedDownloadResponse(signature)));
    const r = await transportOver(http).downloadMessage(dlArgs());
    expect(r).toMatchObject({
      type: 'detail',
      signedZfo: signature,
      detail: {
        id: '55',
        subject: 'Faktura',
        sender: 'ČSSZ',
        attachments: [
          {
            name: 'Faktura.pdf',
            mimeType: 'application/pdf',
            metaType: 'main',
            contentBase64: 'JVBERi0=',
          },
        ],
      },
    });
    // A signed download that worked is the whole download - nothing unsigned behind it.
    expect(http.requests).toHaveLength(1);
    const req = http.requests[0];
    expect(req.url).toBe('https://ws1.datovka-test.gov.cz/DS/dz');
    expect(req.headers?.Authorization).toMatch(/^Basic /);
    expect(req.body).toContain('<p:SignedMessageDownload>');
    expect(req.body).toContain('<p:dmID>55</p:dmID>');
  });

  it('OTP box: cookie-auth POST to /apps/DS/dz (no Basic header)', async () => {
    const http = new FakeHttp().push(ok(signedDownloadResponse(signedOriginal())));
    await transportOver(http).downloadMessage(
      dlArgs({
        authMethod: 'otp_totp',
        password: null,
        // An OTP box carries its own captured session; without one it cannot call at all (018).
        sessionCookie: 'IPCZ-X-COOKIE=OTP',
      }),
    );
    expect(http.requests[0].url).toBe('https://www.datovka-test.gov.cz/apps/DS/dz');
    expect(http.requests[0].headers?.Authorization).toBeUndefined();
    expect(http.requests[0].cookie).toBe('IPCZ-X-COOKIE=OTP');
    expect(http.requests[0].body).toContain('<p:SignedMessageDownload>');
  });

  it('401 -> authFault, without trying the unsigned download', async () => {
    const http = new FakeHttp().push(ok('', 401));
    expect(await transportOver(http).downloadMessage(dlArgs())).toEqual({ type: 'authFault' });
    expect(http.requests).toHaveLength(1);
    expect(http.requests[0].body).toContain('<p:SignedMessageDownload>');
  });

  it.each([false, true])(
    'never hands the signature to the XML parser (sent: %s) - as one text node it is seconds of the JS thread',
    async sent => {
      // Constitution I. fast-xml-parser walks its input a character at a time in JS: on a 27 MB answer
      // that measured 2.5 s under V8 with its JIT, 4 s without one.
      const parsers = [jest.spyOn(soap, 'parseSoapBody'), jest.spyOn(soap, 'parseSoapBodyWithAttrs')];
      try {
        const signature = signedOriginal();
        const http = new FakeHttp().push(ok(signedDownloadResponse(signature, { sent })));
        const r = await transportOver(http).downloadMessage(dlArgs({ signedSent: sent }));
        expect(r).toMatchObject({ type: 'detail', signedZfo: signature, detail: { id: '55' } });
        const parsed = parsers.flatMap(spy => spy.mock.calls.map(([xml]) => String(xml)));
        expect(parsed.length).toBeGreaterThan(0);
        expect(parsed.some(xml => xml.includes(signature))).toBe(false);
      } finally {
        parsers.forEach(spy => spy.mockRestore());
      }
    },
  );

  it('1281 -> unsupported: a received VoDZ goes to the large-volume path (bulletin 2175 §3.8)', async () => {
    const http = new FakeHttp().push(ok(signedDownloadResponse(null, { statusCode: '1281' })));
    expect(await transportOver(http).downloadMessage(dlArgs())).toEqual({ type: 'unsupported' });
    expect(http.requests).toHaveLength(1);
  });

  it('sent: SignedSentMessageDownload, and the original comes back with the detail', async () => {
    const signature = signedOriginal();
    const http = new FakeHttp().push(ok(signedDownloadResponse(signature, { sent: true })));
    const r = await transportOver(http).downloadMessage(dlArgs({ signedSent: true }));
    expect(r).toMatchObject({ type: 'detail', signedZfo: signature, detail: { id: '55' } });
    expect(http.requests[0].body).toContain('<p:SignedSentMessageDownload>');
  });

  describe('when the signed original cannot give the detail', () => {
    // The received signed download had never been observed on a real box when this shipped. Every
    // way it can fall short has to end in the message opening anyway - and in a report, because a
    // fallback that fires on every message would look like everything working.
    let reports: jest.SpyInstance;
    beforeEach(() => {
      reports = jest.spyOn(telemetry, 'reportFailure').mockImplementation(() => {});
    });
    afterEach(() => {
      reports.mockRestore();
    });

    it('an original that will not parse: MessageDownload gives the detail, and the original is kept', async () => {
      const unreadable = toBase64(utf8('not a signed message at all'));
      const http = new FakeHttp().push(
        ok(signedDownloadResponse(unreadable)),
        ok(messageDownloadResponse()),
      );
      const r = await transportOver(http).downloadMessage(dlArgs());
      expect(r).toMatchObject({
        type: 'detail',
        signedZfo: unreadable,
        detail: { id: '55', subject: 'Faktura' },
      });
      expect(http.requests.map(q => q.body?.includes('<p:MessageDownload>'))).toEqual([false, true]);
      expect(reports).toHaveBeenCalledWith(
        'isds.parse',
        expect.any(Error),
        expect.objectContaining({ stage: 'parse', folder: 'received' }),
      );
    });

    it('an original that names ANOTHER message is not kept', async () => {
      const http = new FakeHttp().push(
        ok(signedDownloadResponse(signedOriginal('999'))),
        ok(messageDownloadResponse()),
      );
      const r = await transportOver(http).downloadMessage(dlArgs());
      expect(r).toMatchObject({ type: 'detail', detail: { id: '55' } });
      expect(r).not.toHaveProperty('signedZfo');
    });

    it.each([
      ['no dmSignature', ok(signedDownloadResponse(null))],
      ['a deletion', ok(signedDownloadResponse(null, { statusCode: '1219' }))],
      ['a refusal', ok(signedDownloadResponse(null, { statusCode: '1222' }))],
      ['a server error', ok('', 500)],
    ])('%s: the detail still arrives, without an original', async (_why, first) => {
      const http = new FakeHttp().push(first, ok(messageDownloadResponse()));
      const r = await transportOver(http).downloadMessage(dlArgs());
      expect(r).toEqual({ type: 'detail', detail: expect.objectContaining({ id: '55' }) });
      expect(reports).toHaveBeenCalledWith(
        'isds.download',
        expect.any(Error),
        expect.objectContaining({ stage: 'transport', folder: 'received' }),
      );
    });

    it('both downloads failing is a server fault', async () => {
      const http = new FakeHttp().push(ok('', 503), ok('', 500));
      expect(await transportOver(http).downloadMessage(dlArgs())).toEqual({ type: 'serverFault' });
      // The unsigned download WAS tried: an outage of the signed one alone never costs the message.
      expect(http.requests.map(q => q.body?.includes('<p:MessageDownload>'))).toEqual([false, true]);
    });

    it('reads the answer ISDS gave the unsigned download: 1219 is a deletion, any other code a refusal', async () => {
      // 1219 is the one code ISDS documents for a message it has deleted (004 research R8). Before
      // 2026-09-15 both came back as a server fault, and the detail screen then took any server fault
      // past 90 days as the message being gone.
      const deleted = new FakeHttp().push(ok('', 503), ok(messageDownloadResponse('1219')));
      expect(await transportOver(deleted).downloadMessage(dlArgs())).toEqual({ type: 'gone' });
      const refused = new FakeHttp().push(ok('', 503), ok(messageDownloadResponse('1222')));
      expect(await transportOver(refused).downloadMessage(dlArgs())).toEqual({ type: 'refused' });
    });

    it('passes a sent message’s answer from ISDS on as that answer, not as a server fault', async () => {
      const deleted = new FakeHttp().push(
        ok(signedDownloadResponse(null, { sent: true, statusCode: '1219' })),
      );
      expect(await transportOver(deleted).downloadMessage(dlArgs({ signedSent: true }))).toEqual({
        type: 'gone',
      });
      const refused = new FakeHttp().push(
        ok(signedDownloadResponse(null, { sent: true, statusCode: '1229' })),
      );
      expect(await transportOver(refused).downloadMessage(dlArgs({ signedSent: true }))).toEqual({
        type: 'refused',
      });
    });

    it('a sent message has no unsigned download to fall back to, and the unreadable original is reported', async () => {
      const http = new FakeHttp().push(
        ok(signedDownloadResponse(toBase64(utf8('garbage')), { sent: true })),
      );
      expect(await transportOver(http).downloadMessage(dlArgs({ signedSent: true }))).toEqual({
        type: 'serverFault',
      });
      expect(http.requests).toHaveLength(1);
      expect(reports).toHaveBeenCalledWith(
        'isds.parse',
        expect.any(Error),
        expect.objectContaining({ stage: 'parse', folder: 'sent' }),
      );
    });
  });
});

describe('IsdsHttpTransport - downloadSignedMessage (004)', () => {
  it('returns only the signed original, unparsed', async () => {
    const http = new FakeHttp().push(ok(signedDownloadResponse('QUJD', { sent: true })));
    expect(await transportOver(http).downloadSignedMessage(dlArgs({ signedSent: true }))).toEqual({
      type: 'signed',
      signedZfo: 'QUJD',
    });
    expect(http.requests[0].body).toContain('<p:SignedSentMessageDownload>');
  });

  it('tells a deletion from any other ISDS refusal, and both from a failure to get an answer', async () => {
    // Past the retention window only the first may mean the message is gone (1219, 004 research R8).
    const deletion = new FakeHttp().push(ok(signedDownloadResponse(null, { statusCode: '1219' })));
    expect(await transportOver(deletion).downloadSignedMessage(dlArgs())).toEqual({ type: 'gone' });
    const refusal = new FakeHttp().push(ok(signedDownloadResponse(null, { statusCode: '1222' })));
    expect(await transportOver(refusal).downloadSignedMessage(dlArgs())).toEqual({ type: 'refused' });
    const outage = new FakeHttp().push(ok('', 503));
    expect(await transportOver(outage).downloadSignedMessage(dlArgs())).toEqual({
      type: 'serverFault',
    });
  });

  it('says 1281 is a VoDZ, and never calls anonymously for a cookie box without a session', async () => {
    const vodz = new FakeHttp().push(ok(signedDownloadResponse(null, { statusCode: '1281' })));
    expect(await transportOver(vodz).downloadSignedMessage(dlArgs())).toEqual({ type: 'unsupported' });
    const http = new FakeHttp();
    expect(
      await transportOver(http).downloadSignedMessage(
        dlArgs({ authMethod: 'otp_totp', password: null, sessionCookie: null }),
      ),
    ).toEqual({ type: 'authFault' });
    expect(http.requests).toHaveLength(0);
  });
});

const markResponse = (statusCode = '0000'): string =>
  '<?xml version="1.0"?>' +
  '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" ' +
  'xmlns:p="http://isds.czechpoint.cz/v20"><soapenv:Body>' +
  '<p:MarkMessageAsDownloadedResponse>' +
  `<p:dmStatus><p:dmStatusCode>${statusCode}</p:dmStatusCode></p:dmStatus>` +
  '</p:MarkMessageAsDownloadedResponse></soapenv:Body></soapenv:Envelope>';

describe('IsdsHttpTransport - markMessageAsDownloaded', () => {
  it('password box: Basic-auth POST of MarkMessageAsDownloaded to /DS/dx -> ok', async () => {
    const http = new FakeHttp().push(ok(markResponse()));
    const r = await new IsdsHttpTransport(http, new NoopCookieJar()).markMessageAsDownloaded(
      dlArgs(),
    );
    expect(r).toEqual({ type: 'ok' });
    const req = http.requests[0];
    expect(req.url).toBe('https://ws1.datovka-test.gov.cz/DS/dx');
    expect(req.headers?.Authorization).toMatch(/^Basic /);
    expect(req.body).toContain('<p:MarkMessageAsDownloaded>');
    expect(req.body).toContain('<p:dmID>55</p:dmID>');
  });

  it('OTP box: cookie-auth POST to /apps/DS/dx (no Basic header)', async () => {
    const http = new FakeHttp().push(ok(markResponse()));
    await new IsdsHttpTransport(http, new NoopCookieJar()).markMessageAsDownloaded(
      dlArgs({
        authMethod: 'otp_totp',
        password: null,
        // An OTP box carries its own captured session; without one it cannot call at all (018).
        sessionCookie: 'IPCZ-X-COOKIE=OTP',
      }),
    );
    expect(http.requests[0].url).toBe('https://www.datovka-test.gov.cz/apps/DS/dx');
    expect(http.requests[0].headers?.Authorization).toBeUndefined();
  });

  it('401 -> authFault; 5xx -> serverFault; non-0000 -> serverFault', async () => {
    expect(
      await new IsdsHttpTransport(
        new FakeHttp().push(ok('', 401)),
        new NoopCookieJar(),
      ).markMessageAsDownloaded(dlArgs()),
    ).toEqual({ type: 'authFault' });
    expect(
      await new IsdsHttpTransport(
        new FakeHttp().push(ok('', 503)),
        new NoopCookieJar(),
      ).markMessageAsDownloaded(dlArgs()),
    ).toEqual({ type: 'serverFault' });
    expect(
      await new IsdsHttpTransport(
        new FakeHttp().push(ok(markResponse('1219'))),
        new NoopCookieJar(),
      ).markMessageAsDownloaded(dlArgs()),
    ).toEqual({ type: 'serverFault' });
  });
});

describe('IsdsHttpTransport - sendBigMessage (VoDZ / US3)', () => {
  const bigArgs = () => ({
    host: 'czebox' as const,
    authMethod: 'password' as const,
    sessionCookie: null,
    loginName: 'user',
    password: 'pw',
    recipientBoxId: 'recipient9',
    subject: 'Velká zásilka',
    files: [
      {
        fileName: 'big.zip',
        mimeType: 'application/zip',
        sizeBytes: 25 * 1024 * 1024,
        contentBase64: 'QUJD',
        isMain: true,
      },
    ],
    signal: liveSignal(),
  });

  const uploadResponse = (attId: string) =>
    `<?xml version="1.0"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">` +
    `<soapenv:Body><p:UploadAttachmentResponse xmlns:p="http://isds.czechpoint.cz/v20">` +
    `<p:dmAttID>${attId}</p:dmAttID>` +
    `<p:dmAttHash1 AttHashAlg="SHA-1">h1value</p:dmAttHash1>` +
    `<p:dmAttHash2 AttHashAlg="SHA-256">h2value</p:dmAttHash2>` +
    `<p:dmStatus><p:dmStatusCode>0000</p:dmStatusCode></p:dmStatus>` +
    `</p:UploadAttachmentResponse></soapenv:Body></soapenv:Envelope>`;

  const createResponse = (dmId: string) =>
    `<?xml version="1.0"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">` +
    `<soapenv:Body><p:CreateBigMessageResponse xmlns:p="http://isds.czechpoint.cz/v20">` +
    `<p:dmID>${dmId}</p:dmID><p:dmStatus><p:dmStatusCode>0000</p:dmStatusCode></p:dmStatus>` +
    `</p:CreateBigMessageResponse></soapenv:Body></soapenv:Envelope>`;

  it('uploads each file to ws2 then CreateBigMessage referencing the server id+hashes → sent', async () => {
    const http = new FakeHttp()
      .push(ok(uploadResponse('att-77')))
      .push(ok(createResponse('5550123')));
    const r = await new IsdsHttpTransport(http, new NoopCookieJar()).sendBigMessage(bigArgs());
    expect(r).toEqual({ type: 'sent', messageId: '5550123' });

    // step 1: UploadAttachment of the file content to the SEPARATE ws2 VoDZ host
    expect(http.requests[0].url).toBe('https://ws2.datovka-test.gov.cz/DS/vodz');
    expect(http.requests[0].body).toContain('<p:UploadAttachment>');
    expect(http.requests[0].body).toContain(
      '<p:dmEncodedContent>QUJD</p:dmEncodedContent>',
    );
    // step 2: CreateBigMessage echoes back the server-returned id + both hashes (no content)
    expect(http.requests[1].body).toContain('<p:CreateBigMessage>');
    expect(http.requests[1].body).toContain('dmAttID="att-77"');
    expect(http.requests[1].body).toContain(
      'dmAttHash1="h1value" dmAttHash1Alg="SHA-1"',
    );
    expect(http.requests[1].body).toContain(
      'dmAttHash2="h2value" dmAttHash2Alg="SHA-256"',
    );
  });

  it('a failed upload maps to serverFault and never calls CreateBigMessage', async () => {
    const http = new FakeHttp().push(ok('', 500));
    const r = await new IsdsHttpTransport(http, new NoopCookieJar()).sendBigMessage(bigArgs());
    expect(r).toEqual({ type: 'serverFault' });
    expect(http.requests).toHaveLength(1); // stopped after the upload failed
  });

  it('a 401 during upload maps to authFault (session expired → re-auth)', async () => {
    const http = new FakeHttp().push(ok('', 401));
    expect(await new IsdsHttpTransport(http, new NoopCookieJar()).sendBigMessage(bigArgs())).toEqual(
      { type: 'authFault' },
    );
  });
});

describe('AuthService + IsdsHttpTransport (end-to-end with fake HTTP)', () => {
  it('password beginLogin -> signedIn', async () => {
    const http = new FakeHttp().push(
      ok(ownerInfoResponse({ boxId: 'box1234', firmName: 'Firma' })),
    );
    const svc = new IsdsAuthService({ transport: new IsdsHttpTransport(http, new NoopCookieJar()) });
    const r = await svc.beginLogin({
      loginName: 'u',
      password: 'p',
      method: 'password',
      host: 'czebox',
      signal: liveSignal(),
    });
    expect(r).toEqual({
      kind: 'signedIn',
      ownerInfo: { boxId: 'box1234', label: 'Firma', dbType: null, passwordExpiresAt: null },
      sessionCookie: null,
    });
  });

  it('password beginLogin maps a 401 to a recoverable invalidCredentials (never throws)', async () => {
    const http = new FakeHttp().push(ok('', 401));
    const svc = new IsdsAuthService({ transport: new IsdsHttpTransport(http, new NoopCookieJar()) });
    const r = await svc.beginLogin({
      loginName: 'u',
      password: 'bad',
      method: 'password',
      host: 'czebox',
      signal: liveSignal(),
    });
    expect(r).toMatchObject({ kind: 'error', code: 'invalidCredentials' });
  });
});
