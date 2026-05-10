import { describe, expect, it, vi } from 'vitest';
import {
  createOpenAIHostedProxyFetch,
  DEFAULT_OPENAI_BASE_URL,
  resolveOpenAIModelsRequestTarget,
  resolveOpenAIProviderTransport,
  shouldUseOpenAIDevProxy,
} from './openai-endpoint';

describe('openai-endpoint', () => {
  it('routes default OpenAI traffic through the local dev proxy when proxy mode is enabled in the browser', () => {
    expect(shouldUseOpenAIDevProxy(DEFAULT_OPENAI_BASE_URL, 'localhost', true)).toBe(true);

    expect(resolveOpenAIModelsRequestTarget(DEFAULT_OPENAI_BASE_URL, 'localhost', true)).toMatchObject({
      ok: true,
      url: '/api/openai/models',
      baseURLHeader: DEFAULT_OPENAI_BASE_URL,
      useProxyHeader: 'true',
    });

    const providerTransport = resolveOpenAIProviderTransport(DEFAULT_OPENAI_BASE_URL, 'localhost', true);
    expect(providerTransport).toMatchObject({
      ok: true,
      baseURL: undefined,
    });
    if (providerTransport.ok) {
      expect(providerTransport.fetch).toEqual(expect.any(Function));
    }
  });

  it('keeps default OpenAI traffic direct when proxy mode is disabled', () => {
    expect(shouldUseOpenAIDevProxy(DEFAULT_OPENAI_BASE_URL, 'localhost', false)).toBe(false);

    expect(resolveOpenAIModelsRequestTarget(DEFAULT_OPENAI_BASE_URL, 'localhost', false)).toMatchObject({
      ok: true,
      url: `${DEFAULT_OPENAI_BASE_URL}/models`,
      baseURLHeader: '',
      useProxyHeader: '',
    });
  });

  it('routes hosted proxy traffic through /api/openai without validating browser baseURL', async () => {
    expect(resolveOpenAIModelsRequestTarget('http://invalid.local/v1', 'token-canvas.example', false, true, 'deploy-token')).toMatchObject({
      ok: true,
      url: '/api/openai/models',
      proxyAccessTokenHeader: 'deploy-token',
      hostedProxy: true,
    });

    const providerTransport = resolveOpenAIProviderTransport('http://invalid.local/v1', 'token-canvas.example', false, true, 'deploy-token');
    expect(providerTransport).toMatchObject({
      ok: true,
      baseURL: undefined,
    });
    if (providerTransport.ok) {
      expect(providerTransport.fetch).toEqual(expect.any(Function));
    }
  });

  it('adds hosted proxy access token and strips browser Authorization before fetch', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const hostedFetch = createOpenAIHostedProxyFetch('deploy-token');
    await hostedFetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        authorization: 'Bearer browser-key',
        'content-type': 'application/json',
      },
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/openai/images/generations', expect.objectContaining({
      method: 'POST',
      headers: expect.any(Headers),
    }));
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Headers;
    expect(headers.get('authorization')).toBeNull();
    expect(headers.get('x-tokencanvas-proxy-token')).toBe('deploy-token');
    expect(headers.get('content-type')).toBe('application/json');
  });
});
