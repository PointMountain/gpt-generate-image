import { describe, expect, it } from 'vitest';
import {
  DEFAULT_OPENAI_BASE_URL,
  resolveOpenAIModelsRequestTarget,
  resolveOpenAIProviderTransport,
  shouldUseOpenAIDevProxy,
} from './openai-endpoint';

describe('openai-endpoint', () => {
  it('routes traffic through the same-origin proxy when proxy mode is enabled in the browser', () => {
    expect(shouldUseOpenAIDevProxy(DEFAULT_OPENAI_BASE_URL, 'token-canvas.example', true)).toBe(true);

    expect(resolveOpenAIModelsRequestTarget(DEFAULT_OPENAI_BASE_URL, 'token-canvas.example', true)).toMatchObject({
      ok: true,
      url: '/api/openai/models',
      baseURLHeader: DEFAULT_OPENAI_BASE_URL,
      useProxyHeader: 'true',
    });

    const providerTransport = resolveOpenAIProviderTransport(DEFAULT_OPENAI_BASE_URL, 'token-canvas.example', true);
    expect(providerTransport).toMatchObject({
      ok: true,
      baseURL: undefined,
    });
    if (providerTransport.ok) {
      expect(providerTransport.fetch).toEqual(expect.any(Function));
    }
  });

  it('still auto-routes local custom baseURL traffic through the dev proxy', () => {
    expect(shouldUseOpenAIDevProxy('https://codex.example.com/v1', 'localhost', false)).toBe(true);

    expect(resolveOpenAIModelsRequestTarget('https://codex.example.com/v1', 'localhost', false)).toMatchObject({
      ok: true,
      url: '/api/openai/models',
      baseURLHeader: 'https://codex.example.com/v1',
      useProxyHeader: 'false',
    });
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

  it('keeps custom production baseURL traffic direct only when proxy mode is disabled', () => {
    expect(shouldUseOpenAIDevProxy('https://codex.example.com/v1', 'token-canvas.example', false)).toBe(false);

    expect(resolveOpenAIModelsRequestTarget('https://codex.example.com/v1', 'token-canvas.example', false)).toMatchObject({
      ok: true,
      url: 'https://codex.example.com/v1/models',
      baseURLHeader: '',
      useProxyHeader: '',
    });
  });

  it('builds proxied fetch requests for custom production baseURL values', async () => {
    const providerTransport = resolveOpenAIProviderTransport('https://codex.example.com/v1', 'token-canvas.example', true);
    expect(providerTransport).toMatchObject({
      ok: true,
      normalizedBaseURL: 'https://codex.example.com/v1',
      baseURL: undefined,
    });
    if (!providerTransport.ok) {
      throw new Error(providerTransport.message);
    }
    const proxiedFetch = providerTransport.fetch;
    if (!proxiedFetch) {
      throw new Error('Expected proxied fetch to be configured');
    }

    const calls: unknown[] = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = ((input, init) => {
      calls.push([input, init]);
      return Promise.resolve(new Response('{}'));
    }) as typeof fetch;
    try {
      await proxiedFetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          authorization: 'Bearer sk-test',
        },
      });
    } finally {
      globalThis.fetch = originalFetch;
    }

    expect(calls).toEqual([
      ['/api/openai/images/generations', expect.objectContaining({
        method: 'POST',
        headers: expect.any(Headers),
      })],
    ]);
    const headers = (calls[0] as [string, RequestInit])[1].headers as Headers;
    expect(headers.get('x-openai-base-url')).toBe('https://codex.example.com/v1');
    expect(headers.get('x-openai-use-proxy')).toBe('true');
  });

  it('validates browser-provided baseURL for static Cloudflare deployments', async () => {
    expect(resolveOpenAIModelsRequestTarget('http://invalid.local/v1', 'token-canvas.example', false)).toMatchObject({
      ok: false,
      message: 'baseURL 需要以 https:// 开头。',
    });
  });
});
