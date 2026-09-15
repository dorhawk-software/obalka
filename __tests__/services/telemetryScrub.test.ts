// The one safety property this whole feature rests on: a crash report cannot carry someone's mail.
//
// Everything else about telemetry is a convenience. This is not. The app tells its users, in Czech,
// that scanned text "neopouští telefon" and that attachments are "nikam neodesíláme"; those
// sentences stay true only for as long as the scrubber holds. So this file is written the way the
// contrast test is written - the claim, as an assertion, rather than as a comment.
//
// The adversarial cases below are not hypothetical. They are the shapes this codebase actually
// produces: a `fast-xml-parser` error quoting the envelope it choked on, an op-sqlite error quoting
// the row, a file-system error carrying an attachment's path, a SOAP fault carrying the sender.

import {
  ALLOWED_KEYS,
  NO_REDACTIONS,
  scrubContext,
  scrubContexts,
  scrubEvent,
  scrubText,
  type RedactionSet,
} from '../../src/services/telemetry/scrub';
import {
  endpointLabel,
  hostLabel,
} from '../../src/services/isds/httpClient';
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
  mepLoginUrl,
  mepStateUrl,
  processLoginUrl,
  vdzWsUrl,
} from '../../src/services/isds/endpoints';
import type { Host } from '../../src/services/isds/types';

/** A device with two boxes on it, the way the app would seed the scrubber at runtime. */
const REAL: RedactionSet = {
  literals: [
    'c57mi5x', // box id
    '7bi62r', // second box id
    'ondrej.simon', // login name
    'Ondřej Šimon - podnikající fyzická osoba', // owner name
    'Finanční úřad pro hlavní město Prahu', // an alias the user set
  ],
};

describe('scrubText', () => {
  it('removes a box id wherever it appears, in any casing', () => {
    expect(scrubText('GetListOfReceivedMessages failed for c57mi5x', REAL)).not.toContain('c57mi5x');
    expect(scrubText('box C57MI5X returned 500', REAL)).not.toContain('C57MI5X');
  });

  it('removes an owner name quoted inside a parser error', () => {
    // The exact shape fast-xml-parser produces when an envelope is malformed.
    const raw =
      'Unexpected close tag at 1:842: <dmSender>Ondřej Šimon - podnikající fyzická osoba</dmSende>';
    const out = scrubText(raw, REAL);
    expect(out).not.toContain('Ondřej Šimon');
    expect(out).toContain('Unexpected close tag'); // the useful half survives
  });

  it('removes a login name', () => {
    expect(scrubText('auth failed for ondrej.simon', REAL)).not.toContain('ondrej.simon');
  });

  it('keeps the numbers that make a report worth reading', () => {
    // dmStatusCode and HTTP status are the single most useful facts in an ISDS failure.
    const out = scrubText('dmStatusCode 1281, HTTP 500, attempt 2', NO_REDACTIONS);
    expect(out).toContain('1281');
    expect(out).toContain('500');
    expect(out).toContain('2');
  });

  it('removes the numbers that identify a person', () => {
    expect(scrubText('rodné číslo 7801234567', NO_REDACTIONS)).not.toContain('7801234567');
    expect(scrubText('IČO 27074358', NO_REDACTIONS)).not.toContain('27074358');
  });

  it('removes an e-mail address', () => {
    expect(scrubText('notify podatelna@mfcr.cz failed', NO_REDACTIONS)).not.toContain('mfcr.cz');
  });

  it('removes a sandbox path, which carries the attachment filename', () => {
    const raw = 'ENOENT: /data/user/0/com.obalkadatovaschranka/files/Rozhodnutí-DPH-2026.pdf';
    const out = scrubText(raw, NO_REDACTIONS);
    expect(out).not.toContain('Rozhodnutí-DPH-2026.pdf');
    expect(out).toContain('ENOENT'); // the diagnosis survives
  });

  it('removes base64, which is how a whole ZFO or key would escape', () => {
    const zfo = 'decode failed: ' + 'UEsDBBQACAgIAA' + 'A'.repeat(120) + '==';
    expect(scrubText(zfo, NO_REDACTIONS)).not.toContain('A'.repeat(60));
  });

  it('caps length, so a quoted document cannot ride along', () => {
    expect(scrubText('x'.repeat(5000), NO_REDACTIONS).length).toBeLessThanOrEqual(301);
  });

  it('survives a literal containing regex metacharacters', () => {
    const set: RedactionSet = { literals: ['a.b*c(d)'] };
    expect(scrubText('id a.b*c(d) failed', set)).not.toContain('a.b*c(d)');
  });

  it('ignores literals too short to identify anybody', () => {
    // A two-character alias would otherwise shred every message it appears in.
    const set: RedactionSet = { literals: ['ab'] };
    expect(scrubText('parse abort at line 4', set)).toContain('abort');
  });
});

describe('scrubContext', () => {
  it('keeps what is on the allow-list', () => {
    const out = scrubContext(
      { op: 'isds.listReceived', httpStatus: 500, dmStatusCode: '1281' },
      NO_REDACTIONS,
    );
    expect(out).toEqual({
      op: 'isds.listReceived',
      httpStatus: 500,
      dmStatusCode: '1281',
    });
  });

  it('drops anything not on it, however innocent the key looks', () => {
    const out = scrubContext(
      {
        op: 'isds.listReceived',
        subject: 'Rozhodnutí o dani z přidané hodnoty',
        sender: 'Finanční úřad',
        boxId: 'c57mi5x',
        password: 'hunter2',
        messageId: '123456789',
        fileName: 'priloha.pdf',
      },
      NO_REDACTIONS,
    );
    expect(out).toEqual({ op: 'isds.listReceived' });
  });

  it('drops nested structures whole - that is where an envelope hides', () => {
    const out = scrubContext(
      { op: 'x', extra: { envelope: '<dmDm>…</dmDm>' }, list: ['a', 'b'] },
      NO_REDACTIONS,
    );
    expect(out).toEqual({ op: 'x' });
  });

  it('scrubs the values it does keep', () => {
    const out = scrubContext({ op: 'sync for c57mi5x' }, REAL);
    expect(String(out.op)).not.toContain('c57mi5x');
  });

  it('has no key on the allow-list that could hold message content', () => {
    // A guard on the list itself: if someone adds `subject` or `sender` one day, this fails.
    const FORBIDDEN = [
      'subject',
      'sender',
      'recipient',
      'body',
      'text',
      'message',
      'boxid',
      'loginname',
      'messageid',
      'filename',
      'address',
      'name',
      'password',
      'token',
      'cookie',
      'secret',
      'url',
      'query',
    ];
    const offenders = ALLOWED_KEYS.filter(k =>
      FORBIDDEN.some(f => k.toLowerCase().includes(f)),
    );
    expect(offenders).toEqual([]);
  });
});

describe('scrubEvent - the last thing that runs before an event leaves the device', () => {
  it('strips identity and network context outright', () => {
    const out = scrubEvent(
      {
        user: { id: 'c57mi5x', email: 'x@y.cz' },
        request: { url: 'https://ws1.mojedatovaschranka.cz/DS/dz', data: '<soap>' },
        server_name: 'Pixel-7',
      },
      REAL,
    );
    expect(out.user).toBeUndefined();
    expect(out.request).toBeUndefined();
    expect(out.server_name).toBeUndefined();
  });

  it('scrubs an exception message that quotes the mail', () => {
    const out = scrubEvent(
      {
        exception: {
          values: [
            {
              type: 'SyntaxError',
              value:
                'Unexpected token in <dmAnnotation>Rozhodnutí pro Ondřej Šimon - podnikající fyzická osoba</dmAnnotation>',
            },
          ],
        },
      },
      REAL,
    );
    const value = String(out.exception?.values?.[0].value);
    expect(value).not.toContain('Ondřej Šimon');
    expect(value).toContain('Unexpected token'); // the diagnosable half survives
    expect(value).toContain('dmAnnotation'); // and which element it choked on
    expect(out.exception?.values?.[0].type).toBe('SyntaxError'); // the class is kept
  });

  it('deletes per-frame local variables', () => {
    // A debugger's dream and a privacy hole: the decrypted row, the password in scope at the throw.
    const out = scrubEvent(
      {
        exception: {
          values: [
            {
              type: 'Error',
              value: 'boom',
              stacktrace: {
                frames: [
                  {
                    filename: 'app:///src/services/isds/soap.ts',
                    vars: { password: 'hunter2', envelope: '<dmDm>' },
                  },
                ],
              },
            },
          ],
        },
      },
      NO_REDACTIONS,
    );
    expect(out.exception?.values?.[0].stacktrace?.frames?.[0].vars).toBeUndefined();
  });

  it('rebuilds breadcrumbs rather than passing them through', () => {
    // The SDK puts HTTP bodies and navigation params in breadcrumb `data`.
    const out = scrubEvent(
      {
        breadcrumbs: [
          {
            category: 'http',
            level: 'info',
            message: 'POST /DS/dz for c57mi5x',
            data: {
              url: 'https://ws1.mojedatovaschranka.cz/DS/dz',
              body: '<dmDm>secret</dmDm>',
              httpStatus: 500,
            },
          },
        ],
      },
      REAL,
    );
    const crumb = out.breadcrumbs?.[0];
    expect(crumb?.category).toBe('http');
    expect(String(crumb?.message)).not.toContain('c57mi5x');
    expect(crumb?.data).toEqual({ httpStatus: 500 }); // url and body gone
  });

  it('leaves an event with nothing sensitive in it alone', () => {
    const out = scrubEvent(
      {
        exception: { values: [{ type: 'TypeError', value: 'x is not a function' }] },
        tags: { op: 'db.migrate', schemaVersion: 14 },
      },
      REAL,
    );
    expect(out.exception?.values?.[0].value).toBe('x is not a function');
    expect(out.tags).toEqual({ op: 'db.migrate', schemaVersion: 14 });
  });

  it('handles a malformed event without throwing', () => {
    // beforeSend runs on the crash path. If it throws there, the report is lost and so is the crash.
    expect(() => scrubEvent({}, REAL)).not.toThrow();
    expect(() =>
      scrubEvent({ exception: { values: [{}] }, breadcrumbs: [{}] }, REAL),
    ).not.toThrow();
    expect(() => scrubEvent({ message: 42, tags: undefined }, REAL)).not.toThrow();
  });
});

describe('scrubContexts - the platform\'s own payload, which we do not write', () => {
  // `deviceContextIntegration` merges whatever iOS and Android hand it straight into every event.
  // Nothing in this repo controls that object, so it is enumerated rather than trusted.
  it('drops the device name, which on iOS is usually a person', () => {
    const out = scrubContexts(
      { device: { model: 'iPhone15,2', name: "Ondřej's iPhone", family: 'iOS' } },
      NO_REDACTIONS,
    );
    expect(out.device).toEqual({ model: 'iPhone15,2', family: 'iOS' });
  });

  it('keeps the things that make a crash diagnosable', () => {
    const out = scrubContexts(
      {
        os: { name: 'Android', version: '16' },
        app: { app_version: '0.0.1', in_foreground: true },
        react_native_context: { js_engine: 'hermes', fabric: true },
      },
      NO_REDACTIONS,
    );
    expect(out.os).toEqual({ name: 'Android', version: '16' });
    expect(out.app).toEqual({ app_version: '0.0.1', in_foreground: true });
    expect(out.react_native_context).toEqual({ js_engine: 'hermes', fabric: true });
  });

  it('drops a section it has never heard of', () => {
    // A future SDK adding a context section must not carry it through by default.
    const out = scrubContexts(
      { mystery: { anything: 'at all' }, os: { name: 'iOS' } },
      NO_REDACTIONS,
    );
    expect(out.mystery).toBeUndefined();
    expect(out.os).toEqual({ name: 'iOS' });
  });

  it('drops a nested structure inside a section it does know', () => {
    const out = scrubContexts(
      { device: { model: 'Pixel 7', extra: { envelope: '<dmDm>' } } },
      NO_REDACTIONS,
    );
    expect(out.device).toEqual({ model: 'Pixel 7' });
  });

  it('scrubs the strings it keeps', () => {
    const out = scrubContexts({ os: { name: 'box c57mi5x' } }, REAL) as {
      os: Record<string, string>;
    };
    expect(out.os.name).not.toContain('c57mi5x');
  });
});

describe('a transaction event', () => {
  // These do NOT pass through `beforeSend`. See `telemetryTransport.test.ts` for the hook itself;
  // this is the scrubber's half.
  it('has its name, span descriptions and span data scrubbed', () => {
    const out = scrubEvent(
      {
        type: 'transaction',
        transaction: 'sync c57mi5x',
        spans: [
          {
            op: 'http.client',
            description: 'POST https://ws1.datovka.gov.cz/DS/dz',
            data: { 'http.url': 'https://ws1.datovka.gov.cz/DS/dz', httpStatus: 500 },
          },
        ],
      },
      REAL,
    );
    expect(String(out.transaction)).not.toContain('c57mi5x');
    expect(String(out.spans?.[0].description)).not.toContain('datovka.gov.cz');
    expect(out.spans?.[0].data).toEqual({ httpStatus: 500 });
    expect(out.spans?.[0].op).toBe('http.client'); // the useful half survives
  });

  it('survives having no spans at all', () => {
    expect(() => scrubEvent({ type: 'transaction' }, REAL)).not.toThrow();
  });
});

describe('what an ISDS request is allowed to say about itself', () => {
  // `httpClient` is the single chokepoint every ISDS call passes through, which makes it both the
  // only place HTTP failures can be observed and the only place a request line could escape. Both
  // labels are MATCHED against fixed lists, never derived from the URL.
  it('reduces a host to the environment enum the app already uses', () => {
    expect(hostLabel('https://ws1.datovka.gov.cz/DS/dz')).toBe('production');
    // The pre-2026 domains are still served, so they still name their environment.
    expect(hostLabel('https://ws1.mojedatovaschranka.cz/DS/dz')).toBe('production');
    expect(hostLabel('https://ws1.czebox.cz/DS/dz')).toBe('czebox');
    expect(hostLabel('https://ws1.datovka-test.gov.cz/DS/dz')).toBe('czebox');
    expect(hostLabel('https://example.invalid/whatever')).toBe('other');
  });

  it('labels every ISDS URL of an account with that account\'s own Host value', () => {
    // The HTTP layer derives its label from the URL; the transport and the controllers pass
    // `account.host`. Both reach the same `host` key in a report, so they must spell an environment
    // the same way - production once arrived as 'mojedatovaschranka' from one and 'production' from
    // the other. Checked against every host family a call can go to: ws1, the portal, and ws2.
    const hosts: readonly Host[] = ['production', 'czebox'];
    for (const host of hosts) {
      for (const url of [
        dxUrl(host),
        appsDxUrl(host),
        processLoginUrl(host, { sendSms: true }),
        mepStateUrl(host),
        vdzWsUrl(host),
        appsVodzUrl(host),
      ]) {
        expect(hostLabel(url)).toBe(host);
      }
    }
  });

  it('names every ISDS URL the app builds by its own service, never its password-box twin', () => {
    // The match is `includes`, first hit wins. `/DS/dx` once came first and swallowed `/apps/DS/dx`,
    // so every cookie-box call was reported as the Basic one; and a processLogin URL, whose query
    // carries `uri={portal}/apps/DS/dz`, was reported as a `/DS/dz` call.
    const cases: readonly (readonly [string, string])[] = [
      [dsManageUrl('production'), '/DS/DsManage'],
      [dzUrl('production'), '/DS/dz'],
      [dxUrl('production'), '/DS/dx'],
      [dfUrl('production'), '/DS/df'],
      [vdzWsUrl('production'), '/DS/vodz'],
      [appsDsManageUrl('production'), '/apps/DS/DsManage'],
      [appsDzUrl('production'), '/apps/DS/dz'],
      [appsDxUrl('production'), '/apps/DS/dx'],
      [appsDfUrl('production'), '/apps/DS/df'],
      [appsVodzUrl('production'), '/apps/DS/vodz'],
      [processLoginUrl('production', { sendSms: true }), '/as/processLogin'],
      [mepLoginUrl('production', 'Obálka'), '/as/processLogin'],
    ];
    expect(cases.map(([url]) => endpointLabel(url))).toEqual(cases.map(([, label]) => label));
  });

  it('reduces a path to a known ISDS service, or to nothing', () => {
    expect(endpointLabel('https://ws1.datovka.gov.cz/DS/dz')).toBe('/DS/dz');
    expect(endpointLabel('https://www.datovka.gov.cz/as/processLogin?type=totp')).toBe(
      '/as/processLogin',
    );
    // The property that matters: a URL matching nothing reports a constant, never itself.
    expect(endpointLabel('https://evil.example/?subject=Rozhodnuti')).toBe('other');
  });

  it('never returns any part of the URL it was given', () => {
    const url = 'https://ws1.datovka.gov.cz/DS/dz?boxId=c57mi5x&token=hunter2';
    for (const label of [hostLabel(url), endpointLabel(url)]) {
      expect(label).not.toContain('c57mi5x');
      expect(label).not.toContain('hunter2');
      expect(label).not.toContain('ws1');
    }
  });
});
