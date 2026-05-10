import { beforeEach, describe, expect, it, vi } from 'vitest';

const lookupMock = vi.fn(async (hostname: string) => [{
  address: hostname === 'example.com'
    ? '93.184.216.34'
    : hostname === 'internal.example'
      ? '127.0.0.1'
      : '203.0.113.10',
}]);

import { buildOpenAIProxyTarget, handleOpenAIProxy, validateOpenAIProxyBaseURL } from './openai-dev-proxy';

function createRequest(headers: Record<string, string>, body = '') {
  const listeners = new Map<string, Array<() => void>>();

  return {
    url: '/api/openai/images/generations?debug=1',
    method: 'POST',
    headers,
    once(event: string, handler: () => void) {
      listeners.set(event, [...(listeners.get(event) ?? []), handler]);
      return this;
    },
    off() {
      return this;
    },
    async *[Symbol.asyncIterator]() {
      if (body) {
        yield Buffer.from(body);
      }
    },
  } as unknown as Parameters<typeof handleOpenAIProxy>[0];
}

function createResponse() {
  const headers = new Map<string, string>();

  return {
    destroyed: false,
    writableEnded: false,
    statusCode: 200,
    once() {
      return this;
    },
    setHeader(name: string, value: string) {
      headers.set(name.toLowerCase(), value);
    },
    end: vi.fn(function end(this: { writableEnded: boolean }, _body?: unknown) {
      this.writableEnded = true;
    }),
    headers,
  } as unknown as Parameters<typeof handleOpenAIProxy>[1] & { headers: Map<string, string> };
}

describe('openai-dev-proxy', () => {
  beforeEach(() => {
    lookupMock.mockClear();
  });

  it('preserves the /v1 pathname when proxying compatible endpoints', async () => {
    await expect(
      buildOpenAIProxyTarget(
        '/api/openai/images/generations?debug=1',
        'https://example.com/v1',
      ),
    ).resolves.toMatchObject({
      href: 'https://example.com/v1/images/generations?debug=1',
    });
  });

  it('rejects unsafe proxy targets, allowlist misses, and DNS resolutions to blocked addresses', async () => {
    await expect(validateOpenAIProxyBaseURL('http://example.com/v1')).rejects.toThrow(/https/);
    await expect(validateOpenAIProxyBaseURL('https://127.0.0.1/v1', ['127.0.0.1'])).rejects.toThrow(/blocked/);
    await expect(validateOpenAIProxyBaseURL('https://blocked.example/v1', ['api.openai.com'])).rejects.toThrow(/not allowed/);
    await expect(validateOpenAIProxyBaseURL('https://internal.example/v1', ['*'], lookupMock as never)).rejects.toThrow(/blocked/);
    expect(lookupMock).toHaveBeenCalledWith('internal.example', { all: true });
    await expect(validateOpenAIProxyBaseURL('https://example.com/v1', ['*'], lookupMock as never)).resolves.toMatchObject({
      hostname: 'example.com',
    });
  });

  it('strips cookie headers on the request path and set-cookie on the response path', async () => {
    const fetchMock = vi.fn(async (_input, init) => {
      const requestHeaders = init?.headers as Headers;
      expect(requestHeaders.get('authorization')).toBe('Bearer sk-test');
      expect(requestHeaders.get('cookie')).toBeNull();

      return new Response('{"ok":true}', {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'set-cookie': 'session=1',
          'x-request-id': 'req_123',
        },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const request = createRequest({
      'x-openai-base-url': 'https://example.com/v1',
      authorization: 'Bearer sk-test',
      cookie: 'session=1',
      'content-type': 'application/json',
    }, '{"prompt":"hi"}');
    const response = createResponse();

    await handleOpenAIProxy(request, response);

    expect(response.headers.get('content-type')).toBe('application/json');
    expect(response.headers.get('set-cookie')).toBeUndefined();
    expect(response.headers.get('x-request-id')).toBe('req_123');
  });
});
