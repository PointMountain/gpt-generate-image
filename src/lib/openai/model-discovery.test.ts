import { describe, expect, it, vi } from 'vitest';
import { createDefaultOpenAISettings } from './openai-settings-store';
import {
  fetchOpenAIImageModels,
  isImageModelId,
  mergeCurrentModelCandidate,
} from './model-discovery';

describe('model-discovery', () => {
  it('filters and sorts image-capable models from the models list response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [
        { id: 'gpt-5.5', object: 'model', owned_by: 'openai' },
        { id: 'text-embedding-3-large', object: 'model', owned_by: 'openai' },
        { id: 'dall-e-3', object: 'model', owned_by: 'openai' },
        { id: 'gpt-image-2', object: 'model', owned_by: 'openai' },
      ],
    }), { status: 200 }));

    const result = await fetchOpenAIImageModels(
      createDefaultOpenAISettings({
        apiKey: 'sk-test',
        model: 'gpt-image-1',
      }),
      { fetcher: fetchMock, now: () => new Date('2026-05-10T01:00:00.000Z') },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.fetchedAt).toBe('2026-05-10T01:00:00.000Z');
    expect(result.models.map((model) => model.id)).toEqual([
      'gpt-image-2',
      'gpt-image-1',
      'dall-e-3',
    ]);
    expect(result.models.find((model) => model.id === 'dall-e-3')).toMatchObject({
      legacy: true,
    });
  });

  it('keeps the current model as a manual fallback when it is not returned remotely', () => {
    expect(mergeCurrentModelCandidate([], 'custom-image-model')).toEqual([
      expect.objectContaining({
        id: 'custom-image-model',
        source: 'current',
      }),
    ]);
  });

  it('detects known image model families without matching unrelated text models', () => {
    expect(isImageModelId('gpt-image-2')).toBe(true);
    expect(isImageModelId('chatgpt-image-1')).toBe(true);
    expect(isImageModelId('dall-e-3')).toBe(true);
    expect(isImageModelId('gpt-5.5')).toBe(false);
    expect(isImageModelId('text-embedding-3-large')).toBe(false);
  });

  it('normalizes auth failures without leaking API keys', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: {
        message: 'Authorization: Bearer sk-secret1234567890 is invalid',
      },
    }), { status: 401 }));

    const result = await fetchOpenAIImageModels(
      createDefaultOpenAISettings({ apiKey: 'sk-secret1234567890' }),
      { fetcher: fetchMock },
    );

    expect(result).toMatchObject({
      ok: false,
      statusCode: 401,
      message: 'OpenAI 模型列表认证失败。',
      recommendation: '检查 OpenAI API key 是否正确、是否仍有效，并重新保存设置。',
    });
    expect(JSON.stringify(result)).not.toContain('sk-secret1234567890');
  });

  it('keeps status and text detail for non-JSON error responses', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('upstream gateway failed', { status: 502 }));

    const result = await fetchOpenAIImageModels(
      createDefaultOpenAISettings({ apiKey: 'sk-test' }),
      { fetcher: fetchMock },
    );

    expect(result).toMatchObject({
      ok: false,
      statusCode: 502,
      detail: 'upstream gateway failed',
      message: 'OpenAI 模型列表拉取失败。',
    });
  });

  it('reports connection failures without replacing the current model', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    const result = await fetchOpenAIImageModels(
      createDefaultOpenAISettings({ apiKey: 'sk-test', model: 'gpt-image-1' }),
      { fetcher: fetchMock },
    );

    expect(result).toMatchObject({
      ok: false,
      message: '浏览器无法拉取当前 provider 的模型列表。',
      recommendation: '检查 baseURL 是否允许从本地页面跨域调用；本地调试自定义端点时可通过 dev proxy 转发。',
    });
  });

  it('rejects invalid baseURL values before sending the API key', async () => {
    const fetchMock = vi.fn();

    const result = await fetchOpenAIImageModels(
      createDefaultOpenAISettings({
        apiKey: 'sk-test',
        baseURL: 'http://example.com/v1',
      }),
      { fetcher: fetchMock },
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      ok: false,
      detail: 'baseURL 需要以 https:// 开头。',
    });
  });

  it('routes custom HTTPS endpoints through the local dev proxy when requested', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [{ id: 'gpt-image-2', object: 'model', owned_by: 'openai' }],
    }), { status: 200 }));

    await fetchOpenAIImageModels(
      createDefaultOpenAISettings({
        apiKey: 'sk-test',
        baseURL: 'https://example.com/v1/',
      }),
      { fetcher: fetchMock, hostname: 'localhost' },
    );

    expect(fetchMock).toHaveBeenCalledWith('/api/openai/models', expect.objectContaining({
      headers: expect.any(Headers),
    }));
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Headers;
    expect(headers.get('x-openai-base-url')).toBe('https://example.com/v1');
    expect(headers.get('x-openai-use-proxy')).toBe('false');
  });
});
