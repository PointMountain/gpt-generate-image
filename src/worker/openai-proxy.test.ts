import { describe, expect, it, vi } from 'vitest';
import { handleWorkerOpenAIProxy } from './openai-proxy';

const env = {
  OPENAI_API_KEY: 'sk-worker-secret',
  TOKENCANVAS_PROXY_TOKEN: 'proxy-token',
};

function createRequest(path: string, init: RequestInit = {}) {
  return new Request(`https://token-canvas.example${path}`, {
    ...init,
    headers: {
      'x-tokencanvas-proxy-token': 'proxy-token',
      ...(init.headers ?? {}),
    },
  });
}

describe('worker openai proxy', () => {
  it('forwards authenticated model discovery with server-side authorization', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [] }), {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'set-cookie': 'session=1',
        'x-request-id': 'req_123',
      },
    }));

    const response = await handleWorkerOpenAIProxy(
      createRequest('/api/openai/models', {
        method: 'GET',
        headers: {
          authorization: 'Bearer browser-token',
          cookie: 'browser=session',
        },
      }),
      env,
      { fetcher },
    );

    expect(fetcher).toHaveBeenCalledWith('https://api.openai.com/v1/models', expect.objectContaining({
      method: 'GET',
      body: undefined,
      headers: expect.any(Headers),
    }));
    const upstreamHeaders = fetcher.mock.calls[0]?.[1]?.headers as Headers;
    expect(upstreamHeaders.get('authorization')).toBe('Bearer sk-worker-secret');
    expect(upstreamHeaders.get('cookie')).toBeNull();
    expect(response.status).toBe(200);
    expect(response.headers.get('x-request-id')).toBe('req_123');
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('forwards image generation without leaking browser authorization', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ b64_json: 'abc' }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
    const body = JSON.stringify({ prompt: 'warm portrait' });

    const response = await handleWorkerOpenAIProxy(
      createRequest('/api/openai/images/generations', {
        method: 'POST',
        body,
        headers: {
          authorization: 'Bearer browser-token',
          'content-type': 'application/json',
        },
      }),
      env,
      { fetcher },
    );

    const upstreamHeaders = fetcher.mock.calls[0]?.[1]?.headers as Headers;
    const upstreamInit = fetcher.mock.calls[0]?.[1] as RequestInit;
    expect(upstreamHeaders.get('authorization')).toBe('Bearer sk-worker-secret');
    expect(upstreamHeaders.get('content-type')).toBe('application/json');
    expect(upstreamInit.body).toBeInstanceOf(ArrayBuffer);
    expect(response.status).toBe(200);
  });

  it('forwards image edits for image-to-image and mask generation', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ b64_json: 'abc' }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
    const body = new FormData();
    body.set('prompt', 'clean icon');
    body.set('image', new Blob(['image-bytes'], { type: 'image/png' }), 'image.png');

    const response = await handleWorkerOpenAIProxy(
      createRequest('/api/openai/images/edits', {
        method: 'POST',
        body,
      }),
      env,
      { fetcher },
    );

    expect(response.status).toBe(200);
    expect(fetcher).toHaveBeenCalledWith('https://api.openai.com/v1/images/edits', expect.objectContaining({
      method: 'POST',
      body: expect.any(ArrayBuffer),
    }));
  });

  it('rejects missing or invalid proxy access token before upstream fetch', async () => {
    const fetcher = vi.fn();

    const response = await handleWorkerOpenAIProxy(
      new Request('https://token-canvas.example/api/openai/models'),
      env,
      { fetcher },
    );

    expect(response.status).toBe(401);
    expect(fetcher).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      error: 'unauthorized_proxy_request',
    });
  });

  it('accepts the deployment token through a bearer authorization header', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));

    const response = await handleWorkerOpenAIProxy(
      new Request('https://token-canvas.example/api/openai/models', {
        headers: { authorization: 'Bearer proxy-token' },
      }),
      env,
      { fetcher },
    );

    expect(response.status).toBe(200);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('fails closed when Worker secrets are missing', async () => {
    const fetcher = vi.fn();

    const missingKey = await handleWorkerOpenAIProxy(
      createRequest('/api/openai/models'),
      { TOKENCANVAS_PROXY_TOKEN: 'proxy-token' },
      { fetcher },
    );
    const missingToken = await handleWorkerOpenAIProxy(
      createRequest('/api/openai/models'),
      { OPENAI_API_KEY: 'sk-worker-secret' },
      { fetcher },
    );

    expect(missingKey.status).toBe(500);
    expect(missingToken.status).toBe(500);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('rejects unsupported proxy routes', async () => {
    const fetcher = vi.fn();

    const response = await handleWorkerOpenAIProxy(
      createRequest('/api/openai/chat/completions', { method: 'POST' }),
      env,
      { fetcher },
    );

    expect(response.status).toBe(404);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('rejects oversized requests even when content-length is absent', async () => {
    const fetcher = vi.fn();
    const body = new Uint8Array((40 * 1024 * 1024) + 1);

    const response = await handleWorkerOpenAIProxy(
      createRequest('/api/openai/images/generations', {
        method: 'POST',
        body,
      }),
      env,
      { fetcher },
    );

    expect(response.status).toBe(413);
    expect(fetcher).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      error: 'request_body_too_large',
    });
  });

  it('rejects oversized content-length before reading the request body', async () => {
    const fetcher = vi.fn();

    const response = await handleWorkerOpenAIProxy(
      createRequest('/api/openai/images/generations', {
        method: 'POST',
        headers: {
          'content-length': String((40 * 1024 * 1024) + 1),
        },
      }),
      env,
      { fetcher },
    );

    expect(response.status).toBe(413);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('redacts secret-like upstream error detail', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ error: { message: 'Authorization: Bearer sk-secret1234567890 failed' } }),
      { status: 401, headers: { 'content-type': 'application/json' } },
    ));

    const response = await handleWorkerOpenAIProxy(
      createRequest('/api/openai/models'),
      env,
      { fetcher },
    );
    const text = await response.text();

    expect(response.status).toBe(401);
    expect(text).not.toContain('sk-secret1234567890');
    expect(text).toContain('[redacted]');
  });

  it('returns a bounded timeout error when the upstream request does not finish', async () => {
    const fetcher = vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('aborted with sk-secret1234567890')), { once: true });
    }));

    const response = await handleWorkerOpenAIProxy(
      createRequest('/api/openai/models'),
      env,
      { fetcher, timeoutMs: 1 },
    );

    expect(response.status).toBe(504);
    await expect(response.json()).resolves.toMatchObject({
      error: 'openai_proxy_request_timeout',
    });
  });
});
