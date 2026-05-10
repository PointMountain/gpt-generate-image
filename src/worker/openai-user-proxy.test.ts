import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleOpenAIUserProxyRequest } from './openai-user-proxy';

describe('openai-user-proxy', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('forwards model requests to the browser-provided baseURL with the user authorization header', async () => {
    const fetchMock = vi.fn(async () => Response.json({ data: [{ id: 'gpt-image-1' }] }, {
      headers: {
        'content-type': 'application/json',
        'set-cookie': 'blocked=true',
        'x-request-id': 'req_123',
      },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await handleOpenAIUserProxyRequest(new Request('https://token-canvas.example/api/openai/models', {
      headers: {
        authorization: 'Bearer sk-test',
        cookie: 'session=private',
        'x-openai-base-url': 'https://codex.example.com/v1',
      },
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get('x-request-id')).toBe('req_123');
    expect(response.headers.has('set-cookie')).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith(new URL('https://codex.example.com/v1/models'), expect.objectContaining({
      method: 'GET',
      body: undefined,
    }));

    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Headers;
    expect(headers.get('authorization')).toBe('Bearer sk-test');
    expect(headers.has('cookie')).toBe(false);
    await expect(response.json()).resolves.toMatchObject({ data: [{ id: 'gpt-image-1' }] });
  });

  it('forwards image edit uploads to the allowed endpoint', async () => {
    const fetchMock = vi.fn(async () => Response.json({ id: 'img_123' }));
    vi.stubGlobal('fetch', fetchMock);
    const body = new FormData();
    body.set('prompt', '测试图片');

    const response = await handleOpenAIUserProxyRequest(new Request('https://token-canvas.example/api/openai/images/edits?debug=1', {
      method: 'POST',
      body,
      headers: {
        authorization: 'Bearer sk-test',
        'x-openai-base-url': 'https://api.openai.com/v1/',
      },
    }));

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(new URL('https://api.openai.com/v1/images/edits?debug=1'), expect.objectContaining({
      method: 'POST',
      body: expect.any(ArrayBuffer),
    }));
  });

  it('rejects requests without a browser-provided baseURL', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await handleOpenAIUserProxyRequest(new Request('https://token-canvas.example/api/openai/models', {
      headers: {
        authorization: 'Bearer sk-test',
      },
    }));

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      error: 'missing_or_invalid_base_url',
    });
  });

  it('rejects private and non-https baseURL values', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(handleOpenAIUserProxyRequest(new Request('https://token-canvas.example/api/openai/models', {
      headers: {
        authorization: 'Bearer sk-test',
        'x-openai-base-url': 'http://codex.example.com/v1',
      },
    })).then((response) => response.json())).resolves.toMatchObject({
      error: 'https_base_url_required',
    });

    await expect(handleOpenAIUserProxyRequest(new Request('https://token-canvas.example/api/openai/models', {
      headers: {
        authorization: 'Bearer sk-test',
        'x-openai-base-url': 'https://127.0.0.1/v1',
      },
    })).then((response) => response.json())).resolves.toMatchObject({
      error: 'blocked_base_url_host',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not expose arbitrary upstream paths', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await handleOpenAIUserProxyRequest(new Request('https://token-canvas.example/api/openai/chat/completions', {
      method: 'POST',
      headers: {
        authorization: 'Bearer sk-test',
        'x-openai-base-url': 'https://api.openai.com/v1',
      },
    }));

    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
