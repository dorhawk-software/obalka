// Test double for the ISDS HttpClient. NOT a test suite (under __tests__/helpers/).

import type {
  HttpClient,
  HttpRequest,
  HttpResponse,
} from '../../src/services/isds/httpClient';

export const ok = (
  text: string,
  status = 200,
  headers?: Record<string, string>,
): HttpResponse => ({
  status,
  text,
  headers,
});

/** Queue-based fake: returns queued responses in order; an Error in the queue is thrown. */
export class FakeHttp implements HttpClient {
  readonly requests: HttpRequest[] = [];
  private queue: Array<HttpResponse | Error> = [];

  push(...items: Array<HttpResponse | Error>): this {
    this.queue.push(...items);
    return this;
  }

  async send(req: HttpRequest): Promise<HttpResponse> {
    this.requests.push(req);
    const next = this.queue.shift();
    if (!next) {
      throw new Error('FakeHttp: no queued response for ' + req.url);
    }
    if (next instanceof Error) {
      throw next;
    }
    return next;
  }
}

export const ownerInfoResponse = (
  opts: { boxId?: string; firmName?: string; statusCode?: string } = {},
): string => {
  const {
    boxId = 'abcdefg',
    firmName = 'ACME s.r.o.',
    statusCode = '0000',
  } = opts;
  return (
    '<?xml version="1.0"?>' +
    '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" ' +
    'xmlns:p="http://isds.czechpoint.cz/v20"><soapenv:Body>' +
    '<p:GetOwnerInfoFromLoginResponse>' +
    `<p:dbOwnerInfo><p:dbID>${boxId}</p:dbID><p:firmName>${firmName}</p:firmName></p:dbOwnerInfo>` +
    `<p:dbStatus><p:dbStatusCode>${statusCode}</p:dbStatusCode><p:dbStatusMessage>x</p:dbStatusMessage></p:dbStatus>` +
    '</p:GetOwnerInfoFromLoginResponse></soapenv:Body></soapenv:Envelope>'
  );
};

export const passwordInfoResponse = (pswExpDate = '2026-09-10T00:00:00'): string => {
  const exp = pswExpDate ? `<p:pswExpDate>${pswExpDate}</p:pswExpDate>` : '';
  return (
    '<?xml version="1.0"?>' +
    '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" ' +
    'xmlns:p="http://isds.czechpoint.cz/v20"><soapenv:Body>' +
    `<p:GetPasswordInfoResponse>${exp}` +
    '<p:dbStatus><p:dbStatusCode>0000</p:dbStatusCode><p:dbStatusMessage>x</p:dbStatusMessage></p:dbStatus>' +
    '</p:GetPasswordInfoResponse></soapenv:Body></soapenv:Envelope>'
  );
};
