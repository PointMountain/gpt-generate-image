import { describe, expect, it } from 'vitest';
import {
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

  it('validates browser-provided baseURL for static Cloudflare deployments', async () => {
    expect(resolveOpenAIModelsRequestTarget('http://invalid.local/v1', 'token-canvas.example', false)).toMatchObject({
      ok: false,
      message: 'baseURL 需要以 https:// 开头。',
    });
  });
});
